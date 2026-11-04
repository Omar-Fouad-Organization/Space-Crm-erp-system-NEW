<?php
namespace App\Http\Controllers;

use App\Models\User;
use App\Services\{IntakeAccess,IntakePayload,IntakeTransport,PermissionPolicy,RecordAccess,CrmService};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\{Crypt,DB};

class IntakeController extends Controller
{
    public function __construct(private IntakeAccess $access, private PermissionPolicy $policy) {}

    private function query(Request $r)
    {
        $v=$r->validate(['family'=>'required|in:submissions,buyers,visitors','q'=>'nullable|string|max:200','type'=>'nullable|in:'.implode(',',IntakePayload::TYPES),
            'status'=>'nullable|string|max:40','country'=>'nullable|string|max:100','interest'=>'nullable|string|max:100','exhibition_id'=>'nullable|integer','page'=>'nullable|integer|min:1','overdue'=>'nullable|boolean','queue'=>'nullable|in:general']);
        $this->access->authorize($v['family'].'.view',$r->user());
        $q=$this->access->query($r->user(),$v['family']);
        if(($v['queue']??null)==='general'){$q->whereNotIn('type',['exhibitor','sponsor','buyer','visitor']);}
        foreach(['type','status','country','exhibition_id'] as $key){if(!empty($v[$key])){$q->where($key,$v[$key]);}}
        if(!empty($v['interest'])){$q->whereJsonContains('interests',$v['interest']);}
        if(!empty($v['q'])){$q->where(function($q)use($v){$term='%'.addcslashes($v['q'],'%_\\').'%';$q->where('name','like',$term)->orWhere('company','like',$term)->orWhere('email','like',$term)->orWhere('source_id',$v['q']);});}
        if(!empty($v['overdue'])){$q->whereIn('id',DB::table('intake_activities')->whereNull('completed_at')->where('due_at','<',now())->select('submission_id'));}
        return $q;
    }

    public function index(Request $r): array
    {
        $q=$this->query($r);
        $counts=(clone $q)->selectRaw('status,COUNT(*) AS count')->groupBy('status')->get();
        $rows=$q->orderByDesc('id')->paginate(30,['id','source_id','type','exhibition_id','name','company','country','status','submitted_at','assigned_user_id','version','historical','buyer_organization_id']);
        return ['data'=>$rows->items(),'total'=>$rows->total(),'last_page'=>$rows->lastPage(),'counts'=>$counts];
    }

    public function show(Request $r,int $id): array
    {
        $row=$this->access->record($id,$r->user());
        $payload=$row->redacted_at?null:json_decode(Crypt::decryptString($row->original_payload),true);
        unset($row->original_payload);
        $matches=$this->access->query($r->user())->where('id','!=',$id)->where(function($q)use($row){
            $q->where('email',$row->email);if($row->phone){$q->orWhere('phone',$row->phone);}if($row->company){$q->orWhere('company',$row->company);}
        })->limit(20)->get(['id','name','company','type','status','exhibition_id']);
        $clients=[];
        if(in_array($row->type,['exhibitor','sponsor'],true) && $this->policy->allows('clients.view',$r->user())) {
            $clients=app(RecordAccess::class)->query('clients',$r->user())->where(fn($q)=>$q->where('email',$row->email)->orWhere('name',$row->company))->limit(20)->get(['id','name','type']);
        }
        $history=DB::table('intake_history')->where('submission_id',$id)->orderByDesc('id')->limit(100)->get();
        foreach($history as $item){if($item->reason){$item->reason=Crypt::decryptString($item->reason);}}
        $activities=DB::table('intake_activities')->where('submission_id',$id)->orderByDesc('id')->limit(100)->get();
        foreach($activities as $item){$item->note=Crypt::decryptString($item->note);}
        return ['data'=>$row,'payload'=>$payload,'matches'=>$matches,'client_matches'=>$clients,'history'=>$history,'activities'=>$activities];
    }

    public function staff(Request $r,int $id): array
    {
        $row=$this->access->record($id,$r->user());$family=IntakePayload::family($row->type);
        $this->access->authorize($family.'.assign',$r->user());
        return ['data'=>User::where('status','active')->get()->filter(fn($u)=>$this->policy->allows($family.'.view',$u) && $this->policy->canExhibition((int)$row->exhibition_id,$u))->map(fn($u)=>['id'=>$u->id,'name'=>$u->name])->values()];
    }

    private function history(object $row,int $actor,string $action,?string $reason=null,?string $to=null): void
    {
        DB::table('intake_history')->insert(['submission_id'=>$row->id,'actor_id'=>$actor,'action'=>$action,'from_status'=>$row->status,'to_status'=>$to,'reason'=>$reason,'created_at'=>now()]);
    }

    public function update(Request $r,int $id): array
    {
        $v=$r->validate(['version'=>'required|integer|min:1','action'=>'required|in:assign,status,duplicate,activity,complete_activity,convert,organization',
            'assigned_user_id'=>'nullable|integer','status'=>'nullable|string|max:40','reason'=>'nullable|string|max:2000','note'=>'nullable|string|max:4000',
            'due_at'=>'nullable|date','activity_id'=>'nullable|integer','duplicate_of'=>'nullable|integer','duplicate_review'=>'nullable|in:distinct,linked',
            'client_id'=>'nullable|integer','client'=>'nullable|array:name,contact_person,email,phone,type,industry,address,notes',
            'organization_id'=>'nullable|integer','organization'=>'nullable|array:name,country,website']);
        return DB::transaction(function()use($r,$id,$v){
            $row=$this->access->record($id,$r->user(),true);$family=IntakePayload::family($row->type);
            abort_unless((int)$row->version===$v['version'],409,'Submission changed. Reload before saving.');
            abort_if($row->redacted_at,409,'This record was redacted under retention policy.');
            $change=[];
            switch($v['action']) {
                case 'assign':
                    $this->access->authorize($family.'.assign',$r->user());
                    $staff=User::find($v['assigned_user_id']??0);
                    abort_unless($staff && $staff->status==='active' && $this->policy->allows($family.'.view',$staff) && $this->policy->canExhibition((int)$row->exhibition_id,$staff),422,'Select an active employee permitted to view this exhibition and module.');
                    $change['assigned_user_id']=$staff->id;
                    if($family==='submissions' && in_array($row->status,['received','triage'],true)){$change['status']='assigned';}
                    DB::table('notifications')->insert(['user_id'=>$staff->id,'name'=>'A registration or enquiry was assigned to you','resource'=>'intake_submissions','record_id'=>$id,'created_at'=>now(),'updated_at'=>now()]);
                    break;
                case 'status':
                    $next=$v['status']??'';
                    $permission=$family==='buyers'?(in_array($next,['verified','rejected'],true)?'buyers.approve':'buyers.review'):($family==='visitors'?'visitors.manage':(in_array($row->type,['exhibitor','sponsor'],true)?'leads.qualify':'submissions.manage'));
                    $this->access->authorize($permission,$r->user());
                    abort_unless(trim($v['reason']??'')!=='',422,'A review reason is required.');
                    $transitions=match($family){
                        'buyers'=>['submitted'=>['under_review','withdrawn'],'under_review'=>['more_information_required','verified','rejected','withdrawn'],'more_information_required'=>['under_review','withdrawn'],'verified'=>['under_review','withdrawn'],'rejected'=>['under_review','withdrawn']],
                        'visitors'=>['registered'=>['cancelled','duplicate','withdrawn'],'duplicate'=>['cancelled','withdrawn'],'cancelled'=>['withdrawn'],'submitted'=>['cancelled','duplicate','withdrawn'],'confirmed'=>['cancelled','duplicate','withdrawn']],
                        default=>['received'=>['triage','contacted','disqualified','duplicate','withdrawn'],'triage'=>['assigned','contacted','disqualified','duplicate','withdrawn'],'assigned'=>['contacted','disqualified','duplicate','withdrawn'],'contacted'=>['qualified','disqualified','duplicate','withdrawn'],'qualified'=>['contacted','withdrawn'],'disqualified'=>['triage','withdrawn'],'duplicate'=>['triage','withdrawn']]
                    };
                    abort_unless(in_array($next,$transitions[$row->status]??[],true),422,'This status transition is not allowed.');
                    abort_if($next==='verified' && !$row->buyer_organization_id,422,'Review and link a buyer organization first.');
                    abort_if($next==='duplicate' && !$row->duplicate_of,422,'Review and link the possible duplicate first.');
                    abort_if($next==='assigned' && !$row->assigned_user_id,422,'Assign an employee first.');
                    $change['status']=$next;
                    if($next==='withdrawn'){$change['withdrawn_at']=now();}
                    break;
                case 'duplicate':
                    $this->access->authorize($family.'.review_duplicates',$r->user());
                    abort_unless(trim($v['reason']??'')!=='',422,'A matching review reason is required.');
                    if(($v['duplicate_review']??'')==='linked') {
                        $match=$this->access->record($v['duplicate_of']??0,$r->user());
                        abort_unless($match->id!==$id && $match->exhibition_id===$row->exhibition_id && IntakePayload::family($match->type)===$family,422,'Choose a different submission in this exhibition and module.');
                        $change['duplicate_of']=$match->id;
                    } else { abort_unless(($v['duplicate_review']??'')==='distinct',422);$change['duplicate_of']=null; }
                    $change['duplicate_review']=$v['duplicate_review'];
                    break;
                case 'activity':
                    $this->access->authorize($family.'.activity',$r->user());
                    abort_unless(trim($v['note']??'')!=='',422,'A note is required.');
                    DB::table('intake_activities')->insert(['submission_id'=>$id,'created_by'=>$r->user()->id,'note'=>Crypt::encryptString($v['note']),'due_at'=>empty($v['due_at'])?null:\Carbon\Carbon::parse($v['due_at'])->utc(),'created_at'=>now(),'updated_at'=>now()]);
                    break;
                case 'complete_activity':
                    $this->access->authorize($family.'.activity',$r->user());
                    abort_unless(DB::table('intake_activities')->where('id',$v['activity_id']??0)->where('submission_id',$id)->update(['completed_at'=>now(),'updated_at'=>now()]),404);
                    break;
                case 'convert':
                    $this->access->authorize('leads.convert',$r->user());
                    abort_unless(in_array($row->type,['exhibitor','sponsor'],true) && $row->status==='qualified' && !$row->client_id && $row->duplicate_review==='distinct',422,'Qualify the lead and resolve matching review before conversion.');
                    if(!empty($v['client_id'])) {
                        $this->policy->authorize('clients.view',$r->user());app(RecordAccess::class)->check('clients',$v['client_id'],$r->user());
                        $client=DB::table('clients')->find($v['client_id']);
                        abort_unless(in_array($client->type,$row->type==='sponsor'?['sponsor','sector_sponsor']:['exhibitor'],true),422,'Commercial client type does not match.');
                        $change['client_id']=$client->id;
                    } else {
                        $client=$v['client']??[];
                        abort_unless(in_array($client['type']??'',$row->type==='sponsor'?['sponsor','sector_sponsor']:['exhibitor'],true),422,'Select the appropriate commercial client type.');
                        $saved=app(CrmService::class)->save('clients',[...$client,'status'=>'prospect'],$r->user());
                        $change['client_id']=$saved['id'];
                    }
                    break;
                case 'organization':
                    $this->access->authorize('buyers.review',$r->user());abort_unless($family==='buyers' && !in_array($row->status,['verified','withdrawn'],true),422);
                    if(!empty($v['organization_id'])) {
                        abort_unless($this->access->query($r->user(),'buyers')->where('buyer_organization_id',$v['organization_id'])->exists(),404);
                        $change['buyer_organization_id']=$v['organization_id'];
                    } else {
                        $data=validator($v['organization']??[],['name'=>'required|string|max:255','country'=>'required|string|max:100','website'=>'nullable|url:http,https|max:2048'])->validate();
                        $change['buyer_organization_id']=DB::table('buyer_organizations')->insertGetId([...$data,'created_by'=>$r->user()->id,'created_at'=>now(),'updated_at'=>now()]);
                    }
                    break;
            }
            DB::table('intake_submissions')->where('id',$id)->update([...$change,'version'=>$row->version+1,'updated_at'=>now()]);
            $this->history($row,$r->user()->id,$v['action'],isset($v['reason'])?Crypt::encryptString($v['reason']):null,$change['status']??null);
            if(isset($change['status']) && $row->assigned_user_id) {
                DB::table('notifications')->insert(['user_id'=>$row->assigned_user_id,'name'=>'A registration review status changed','resource'=>'intake_submissions','record_id'=>$id,'created_at'=>now(),'updated_at'=>now()]);
            }
            return ['saved'=>true,'version'=>$row->version+1];
        },3);
    }

    public function organizations(Request $r): array
    {
        $this->access->authorize('buyers.view',$r->user());
        return ['data'=>DB::table('buyer_organizations')->whereIn('id',$this->access->query($r->user(),'buyers')->whereNotNull('buyer_organization_id')->select('buyer_organization_id'))->orderBy('name')->paginate(30)];
    }

    public function export(Request $r)
    {
        $q=$this->query($r);$this->access->authorize($r->input('family').'.export',$r->user());
        abort_if((clone $q)->count()>5000,422,'Narrow the export to at most 5000 records.');
        $rows=$q->orderBy('id')->get(['source_id','type','exhibition_id','name','email','company','country','status','submitted_at']);
        DB::table('intake_control_audits')->insert(['actor_id'=>$r->user()->id,'exhibition_id'=>config('intake.exhibition_id'),'action'=>'export',
            'configuration'=>json_encode(['family'=>$r->input('family'),'count'=>$rows->count()]),'created_at'=>now()]);
        return response()->streamDownload(function()use($rows){
            $out=fopen('php://output','w');fwrite($out,"\xEF\xBB\xBF");
            fputcsv($out,['Source reference','Type','Exhibition','Name','Email','Company','Country','Processing status','Submitted UTC'],',','"','');
            foreach($rows as $row){$cells=array_map(function($value){$value=(string)$value;return preg_match('/^[\s\x00-\x1f]*[=+@-]/u',$value)?"'".$value:$value;},(array)$row);fputcsv($out,$cells,',','"','');}fclose($out);
        },'registrations.csv',['Content-Type'=>'text/csv; charset=UTF-8','Cache-Control'=>'no-store']);
    }

    public function controls(Request $r): array
    {
        $this->access->authorize('registrations.configure',$r->user());$event=config('intake.exhibition_id');$this->access->event($event,$r->user());
        return ['data'=>DB::table('registration_controls')->where('site',config('intake.site'))->where('exhibition_id',$event)->get(),
            'exhibition_id'=>$event,'site'=>config('intake.site'),'public'=>app(IntakeReceiverController::class)->controls()];
    }

    public function saveControls(Request $r): array
    {
        $this->access->authorize('registrations.configure',$r->user());$event=config('intake.exhibition_id');$this->access->event($event,$r->user());
        $v=$r->validate(['type'=>'required|in:exhibitor,sponsor,buyer,visitor,general','enabled'=>'required|boolean','dates_approved'=>'required|boolean',
            'visit_dates'=>'required|array|max:30','visit_dates.*'=>'date_format:Y-m-d','timezone'=>'required|timezone','opens_at'=>'nullable|date','closes_at'=>'nullable|date|after:opens_at','policy_version'=>'required|string|max:80',
            'privacy_notice_en'=>'required|string|max:10000','privacy_notice_ar'=>'required|string|max:10000','version'=>'required|integer|min:0']);
        return DB::transaction(function()use($r,$event,$v){
            DB::table('exhibitions')->where('id',$event)->lockForUpdate()->first();
            $q=DB::table('registration_controls')->where('site',config('intake.site'))->where('exhibition_id',$event)->where('type',$v['type']);$old=$q->first();
            abort_unless((int)($old->version??0)===$v['version'],409,'Controls changed. Reload before saving.');
            abort_if($v['type']==='visitor' && $v['enabled'] && (!$v['dates_approved'] || !$v['visit_dates']),422,'Visitor registration requires approved dates.');
            $expo=DB::table('exhibitions')->find($event);
            foreach($v['visit_dates'] as $date){abort_unless($date>=$expo->start_date && $date<=$expo->end_date,422,'Visit date must be within the linked exhibition.');}
            $data=[...$v,'visit_dates'=>json_encode(array_values(array_unique($v['visit_dates']))),'version'=>$v['version']+1,'updated_by'=>$r->user()->id,'updated_at'=>now()];
            foreach(['opens_at','closes_at'] as $date){$data[$date]=empty($v[$date])?null:\Carbon\Carbon::parse($v[$date])->utc();}
            if($old){$q->update($data);}else{DB::table('registration_controls')->insert([...$data,'site'=>config('intake.site'),'exhibition_id'=>$event,'created_at'=>now()]);}
            DB::table('intake_control_audits')->insert(['actor_id'=>$r->user()->id,'exhibition_id'=>$event,'action'=>'controls_changed','configuration'=>json_encode($v),'created_at'=>now()]);
            return ['saved'=>true];
        });
    }

    public function deliveries(Request $r): array
    {
        $this->access->authorize('registrations.deliveries',$r->user());$this->access->event(config('intake.exhibition_id'),$r->user());
        return app(IntakeTransport::class)->send('monitor',[]);
    }

    public function replay(Request $r): array
    {
        $this->access->authorize('registrations.replay',$r->user());$this->access->event(config('intake.exhibition_id'),$r->user());
        $v=$r->validate(['message_id'=>'required|uuid']);return app(IntakeTransport::class)->send('replay',[...$v,'actor'=>'erp:'.$r->user()->id]);
    }

    public function reconcile(Request $r): array
    {
        $this->access->authorize('registrations.deliveries',$r->user());$this->access->event(config('intake.exhibition_id'),$r->user());
        $v=$r->validate(['after'=>'nullable|uuid']);$manifest=app(IntakeTransport::class)->send('manifest',$v);$rows=$manifest['data']??[];
        $present=DB::table('intake_submissions')->where('site',config('intake.site'))->where('exhibition_id',config('intake.exhibition_id'))->whereIn('source_id',array_column($rows,'id'))->pluck('source_id')->all();
        return ['source_count'=>count($rows),'accepted_count'=>count($present),'missing'=>array_values(array_diff(array_column($rows,'id'),$present)),'cursor'=>$manifest['cursor']??null,'checksum'=>$manifest['checksum']??null];
    }
}
