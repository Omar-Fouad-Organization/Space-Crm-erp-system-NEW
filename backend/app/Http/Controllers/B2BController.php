<?php

namespace App\Http\Controllers;

use App\Services\{B2BAccess,B2BProfiles,B2BWorkflow,B2BScheduler,PermissionPolicy,IntakeAccess,RecordAccess};
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class B2BController extends Controller
{
    public function __construct(private B2BAccess $access, private B2BProfiles $profiles, private PermissionPolicy $policy) {}

    public function index(Request $r): array
    {
        $this->access->authorize('view',$r->user());
        $v=$r->validate(['exhibition_id'=>'required|integer','section'=>'required|in:overview,profiles,qualification,matches,scheduler,results','page'=>'nullable|integer|min:1','q'=>'nullable|string|max:100','day'=>'nullable|date_format:Y-m-d']);
        $event=$v['exhibition_id']; $user=$r->user(); $this->access->event($event,$user);
        $section=$v['section'];
        if ($section==='matches') { $this->access->authorize('matches.view',$user); }
        if ($section==='scheduler') { $this->access->authorize('meetings.view',$user); }
        if ($section==='results') { $this->access->authorize('results.view',$user); }
        if ($section==='qualification') { $this->access->authorize('qualifications.review',$user); }
        $p=$this->access->participants($user)->where('exhibition_id',$event);
        $matches=$this->access->matches($user)->where('exhibition_id',$event);
        $meeting=DB::table('b2b_meetings')->whereIn('match_id',(clone $matches)->select('id'));
        $program=DB::table('b2b_programs')->where('exhibition_id',$event)->first();
        if ($program) { foreach (['weights','bands','meeting_dates'] as $key) { $program->$key=json_decode($program->$key,true); } }
        $out=['program'=>$program,'categories'=>DB::table('b2b_categories')->where('exhibition_id',$event)->get(),'locations'=>DB::table('b2b_locations')->where('exhibition_id',$event)->get()];
        if ($this->policy->allows('b2b.programs.manage',$user)) {
            $people=DB::table('b2b_representatives')->whereIn('participant_id',(clone $p)->select('id'))->select('person_id');
            $out['windows']=DB::table('b2b_windows')->where('exhibition_id',$event)->where(fn($q)=>$q->whereNull('person_id')->orWhereIn('person_id',$people))->orderByDesc('id')->limit(100)->get();
        }
        if ($section==='overview') {
            $participants=(clone $p)->get();
            $out['counts']=['standard_networking'=>$participants->filter(fn($x)=>$x->kind==='exhibitor' && $this->access->eligible($x,false))->count(),'qualified_exhibitors'=>$participants->filter(fn($x)=>$x->kind==='exhibitor' && $this->access->eligible($x))->count()];
            if ($this->policy->allows('b2b.buyers.view',$user)) { $out['counts']['verified_participating_buyers']=$participants->filter(fn($x)=>$x->kind==='buyer' && $this->access->eligible($x))->count(); }
            if ($this->policy->allows('b2b.matches.view',$user)) { $out['match_counts']=(clone $matches)->selectRaw("CASE WHEN rule_version <> ? AND status IN ('approved_for_outreach','invitation_pending','mutually_accepted') THEN 'rule_review_hold' ELSE status END AS display_status, COUNT(*) AS count",[\App\Services\B2BMatching::VERSION])->groupBy('display_status')->get()->map(fn($row)=>['status'=>$row->display_status,'count'=>$row->count]); }
            if ($this->policy->allows('b2b.meetings.view',$user)) {
                $counts=[];
                foreach ((clone $meeting)->get() as $record) {
                    $match=$this->access->match($record->match_id,$user);
                    $held=$match->rule_version!==\App\Services\B2BMatching::VERSION || !$this->access->eligible($this->access->participant($match->buyer_id,$user)) || !$this->access->eligible($this->access->participant($match->exhibitor_id,$user));
                    $status=$held && in_array($record->status,['scheduled','confirmed','in_progress'],true)?'eligibility_hold':$record->status;
                    $counts[$status]=($counts[$status]??0)+1;
                }
                $out['meeting_counts']=array_map(fn($status,$count)=>compact('status','count'),array_keys($counts),array_values($counts));
                if ($this->policy->allows('b2b.results.view',$user)) { $out['pending_coordination']=(clone $meeting)->where('followup_status','pending')->count(); }
            }
            $out['counts']['concierge_entitlements']=DB::table('b2b_concierge')->where('active',true)->whereIn('participant_id',$participants->filter(fn($x)=>$x->kind==='exhibitor' && $this->access->eligible($x))->pluck('id'))->count();
            if ($this->policy->allows('b2b.meetings.view',$user) && $program && $program->dates_approved) {
                $minutes=0;
                foreach (DB::table('b2b_windows')->where('exhibition_id',$event)->whereNotNull('location_id')->where('active',true)->where('available',true)->get() as $window) {
                    $minutes+=max(0,CarbonImmutable::parse($window->starts_at)->diffInMinutes(CarbonImmutable::parse($window->ends_at)));
                }
                $out['gross_location_slot_upper_bound']=(int)floor($minutes/$program->duration);
            }
            $out['capacity_note']='Gross location capacity is an upper bound: overlapping windows, breaks, participant availability and acceptance reduce it. It is never a confirmed meeting count.';
            return $out;
        }
        if (in_array($section,['profiles','qualification'],true)) {
            if ($section==='qualification') { $p->where('kind','exhibitor'); }
            $rows=$p->orderByDesc('id')->paginate(25);
            $out['data']=array_map(function($p) {
                $p->profile=B2BProfiles::open($p->profile); $p->eligible=$this->access->eligible($p); $p->standard_eligible=$this->access->eligible($p,false);
                unset($p->consent_evidence,$p->commercial_evidence); return $p;
            },$rows->items());
        } elseif ($section==='matches') {
            $rows=$matches->orderByDesc('score')->orderBy('id')->paginate(25); $out['data']=$rows->items();
            foreach ($out['data'] as $row) { $row->explanation=json_decode($row->explanation,true); $row->rule_review_hold=$row->rule_version!==\App\Services\B2BMatching::VERSION; $row->invitations=DB::table('b2b_invitations')->where('match_id',$row->id)->get(['id','party','status','communication_status','expires_at','recorded_by']); }
        } else {
            if (!empty($v['day'])) {
                abort_unless($program,422,'Configure a program first.');
                $start=CarbonImmutable::parse($v['day'],$program->timezone)->startOfDay()->utc();
                $meeting->where('starts_at','>=',$start)->where('starts_at','<',CarbonImmutable::parse($v['day'],$program->timezone)->addDay()->startOfDay()->utc());
            }
            $rows=$meeting->orderBy('starts_at')->orderBy('id')->paginate(40); $out['data']=$rows->items();
            foreach ($out['data'] as $row) {
                $m=$this->access->match($row->match_id,$user);
                $row->eligibility_hold=$m->rule_version!==\App\Services\B2BMatching::VERSION || !$this->access->eligible($this->access->participant($m->buyer_id,$user)) || !$this->access->eligible($this->access->participant($m->exhibitor_id,$user));
                if (!$this->policy->allows('b2b.results.view',$user)) { unset($row->result,$row->followup_user_id,$row->followup_due,$row->followup_status); }
                elseif ($row->result) { $row->result=B2BProfiles::open($row->result)['notes']; }
            }
        }
        $out['total']=$rows->total(); $out['last_page']=$rows->lastPage(); return $out;
    }

    public function show(Request $r,int $id): array
    {
        $this->access->authorize('view',$r->user()); $p=$this->access->participant($id,$r->user());
        $p->profile=B2BProfiles::open($p->profile); $p->consent_evidence=B2BProfiles::open($p->consent_evidence);
        if ($p->commercial_evidence && $this->policy->allows('b2b.participations.confirm',$r->user())) { $p->commercial_evidence=B2BProfiles::open($p->commercial_evidence); }
        else { unset($p->commercial_evidence); }
        if (!$this->policy->allows('b2b.profiles.manage',$r->user())) { unset($p->consent_evidence); }
        $out=['participant'=>$p,'representatives'=>DB::table('b2b_representatives')->where('participant_id',$id)->get()];
        foreach ($out['representatives'] as $rep) { $rep->name=B2BProfiles::open(DB::table('b2b_people')->find($rep->person_id)->name)['name']; $rep->evidence=$this->policy->allows('b2b.profiles.manage',$r->user())?B2BProfiles::open($rep->evidence):null; }
        if ($this->policy->allows('b2b.qualifications.review',$r->user()) && $p->kind==='exhibitor') {
            $out['reviews']=DB::table('b2b_qualifications')->where('participant_id',$id)->orderByDesc('id')->get();
            foreach ($out['reviews'] as $review) { $review->scores=json_decode($review->scores,true); $review->evidence=B2BProfiles::open($review->evidence); if ($review->reason) { $review->reason=B2BProfiles::open($review->reason); } }
        }
        $out['windows']=DB::table('b2b_windows')->where('exhibition_id',$p->exhibition_id)->whereIn('person_id',array_column($out['representatives']->all(),'person_id'))->get();
        $out['history']=DB::table('b2b_audits')->where('resource','b2b_participants')->where('record_id',$id)->orderByDesc('id')->limit(100)->get(['id','actor_id','action','created_at']);
        return $out;
    }

    public function sources(Request $r): array
    {
        $v=$r->validate(['exhibition_id'=>'required|integer','kind'=>'required|in:buyer,exhibitor']); $user=$r->user();
        $this->access->authorize($v['kind']==='buyer'?'buyers.manage':'participations.confirm',$user); $this->access->event($v['exhibition_id'],$user);
        if ($v['kind']==='buyer') {
            app(IntakeAccess::class)->authorize('buyers.view',$user);
            return ['data'=>app(IntakeAccess::class)->query($user,'buyers')->where('exhibition_id',$v['exhibition_id'])->where('status','verified')->whereNull('withdrawn_at')->whereNull('redacted_at')->whereNotNull('buyer_organization_id')->limit(100)->get(['id','name','company','buyer_organization_id'])];
        }
        return ['data'=>app(RecordAccess::class)->query('deals',$user)->where('exhibition_id',$v['exhibition_id'])->where('type','booth')->where('status','closed_won')->limit(100)->get(['id','name','client_id'])];
    }

    public function export(Request $r): array
    {
        $this->access->authorize('export',$r->user());
        // Reuse the exact scoped, field-authorized read contract; exports cannot widen access.
        // Bounded pages prevent unbounded decryption and large cross-event exports.
        $result=$this->index($r);
        $this->profiles->audit((int)$r->input('exhibition_id'),'b2b_programs',
            (int)(DB::table('b2b_programs')->where('exhibition_id',$r->input('exhibition_id'))->value('id')??0),
            'export',$r->user(),['section'=>$r->input('section'),'page'=>$r->input('page',1),'count'=>count($result['data']??[])]);
        return $result;
    }

    public function command(Request $r,string $action,?int $id=null): array
    {
        try { return $this->dispatchCommand($r,$action,$id); }
        catch (\Illuminate\Database\QueryException $e) {
            if (($e->errorInfo[1]??null)===1062) { abort(409,'This B2B relationship already exists. Refresh the permitted records.'); }
            throw $e;
        }
    }

    private function dispatchCommand(Request $r,string $action,?int $id=null): array
    {
        abort_if(strlen($r->getContent())>131072,413); $u=$r->user();
        if (in_array($action,['profile','review','decision','transition','meeting','representative','concierge'],true)) { abort_unless($id,404); }
        switch ($action) {
            case 'enroll': return ['id'=>$this->profiles->enroll($r->all(),$u)];
            case 'profile': $this->profiles->update($id,$r->all(),$u); break;
            case 'review': return ['id'=>$this->profiles->review($id,$r->all(),$u)];
            case 'decision': $this->profiles->decide($id,$r->all(),$u); break;
            case 'generate': $v=$r->validate(['exhibition_id'=>'required|integer']); return app(B2BWorkflow::class)->generate($v['exhibition_id'],$u);
            case 'transition': app(B2BWorkflow::class)->transition($id,$r->all(),$u); break;
            case 'schedule': return ['id'=>app(B2BScheduler::class)->schedule($r->all(),$u)];
            case 'meeting': app(B2BScheduler::class)->update($id,$r->all(),$u); break;
            case 'program': return $this->program($r);
            case 'category': return $this->category($r);
            case 'location': return $this->location($r);
            case 'window': return $this->availability($r);
            case 'representative': return $this->representative($r,$id);
            case 'concierge': return $this->concierge($r,$id);
            default: abort(404);
        }
        return ['ok'=>true];
    }

    private function program(Request $r): array
    {
        $this->access->authorize('programs.manage',$r->user());
        $v=$r->validate(['exhibition_id'=>'required|integer','version'=>'required|integer|min:0','timezone'=>'required|timezone','dates_approved'=>'required|boolean','meeting_dates'=>'present|array|max:60','meeting_dates.*'=>'date_format:Y-m-d|distinct','duration'=>'required|integer|min:5|max:120|multiple_of:5','weights'=>'required|array|size:6','weights.*'=>'integer|min:0|max:100','bands'=>'required|array|size:2','bands.*'=>'integer|min:0|max:100']);
        $this->access->event($v['exhibition_id'],$r->user());
        abort_unless(array_sum($v['weights'])===100 && array_values($v['bands'])[0]>array_values($v['bands'])[1],422,'Weights must total 100 and bands must descend.');
        $event=DB::table('exhibitions')->find($v['exhibition_id']);
        foreach ($v['meeting_dates'] as $date) { abort_unless($date>=$event->start_date && $date<=$event->end_date,422,'Dates must be within the existing exhibition dates.'); }
        abort_if($v['dates_approved'] && !$v['meeting_dates'],422,'Explicit approved dates are required.');
        return DB::transaction(function () use ($v,$r) {
            $old=DB::table('b2b_programs')->where('exhibition_id',$v['exhibition_id'])->lockForUpdate()->first();
            abort_unless(($old->version??0)==$v['version'],409);
            abort_if(DB::table('b2b_meetings')->where('exhibition_id',$v['exhibition_id'])->whereIn('status',['scheduled','confirmed','in_progress'])->exists(),422,'Resolve active meetings before changing program rules.');
            $data=$v; foreach (['meeting_dates','weights','bands'] as $key) { $data[$key]=json_encode(array_values($v[$key])); } $data['version']++; $data['updated_at']=now();
            if ($old) { DB::table('b2b_programs')->where('id',$old->id)->update($data); $id=$old->id; }
            else { $id=DB::table('b2b_programs')->insertGetId([...$data,'created_at'=>now()]); }
            $this->profiles->audit($v['exhibition_id'],'b2b_programs',$id,'configuration',$r->user(),$v); return ['id'=>$id];
        },3);
    }

    private function category(Request $r): array
    {
        $this->access->authorize('programs.manage',$r->user());
        $v=$r->validate(['exhibition_id'=>'required|integer','code'=>'required|alpha_dash|max:80','name_en'=>'required|string|max:255','name_ar'=>'required|string|max:255']); $this->access->event($v['exhibition_id'],$r->user());
        $id=DB::transaction(function () use($v,$r) { $id=DB::table('b2b_categories')->insertGetId([...$v,'created_at'=>now(),'updated_at'=>now()]); $this->profiles->audit($v['exhibition_id'],'b2b_categories',$id,'create',$r->user(),$v); return $id; }); return ['id'=>$id];
    }

    private function location(Request $r): array
    {
        $this->access->authorize('programs.manage',$r->user()); $v=$r->validate(['exhibition_id'=>'required|integer','name'=>'required|string|max:255']); $this->access->event($v['exhibition_id'],$r->user());
        return DB::transaction(function () use($v,$r) { $id=DB::table('b2b_locations')->insertGetId([...$v,'created_at'=>now(),'updated_at'=>now()]); $this->profiles->audit($v['exhibition_id'],'b2b_locations',$id,'create',$r->user(),$v); return ['id'=>$id]; });
    }

    private function representative(Request $r,int $id): array
    {
        $this->access->authorize('profiles.manage',$r->user()); $v=$r->validate(['name'=>'required|string|max:255','person_id'=>'nullable|integer','evidence'=>'required|string|max:2000']);
        return DB::transaction(function () use($v,$r,$id) {
            $p=$this->access->participant($id,$r->user(),true); if ($p->kind==='buyer') { $this->access->authorize('buyers.manage',$r->user()); }
            if (!empty($v['person_id'])) {
                abort_unless(DB::table('b2b_representatives')->where('person_id',$v['person_id'])->whereIn('participant_id',$this->access->participants($r->user())->select('id'))->exists(),404,'Only a person already visible through a permitted participant can be reused.'); $person=$v['person_id'];
            } else { $person=DB::table('b2b_people')->insertGetId(['name'=>B2BProfiles::seal(['name'=>$v['name']]),'created_by'=>$r->user()->id,'created_at'=>now(),'updated_at'=>now()]); }
            $rep=DB::table('b2b_representatives')->insertGetId(['participant_id'=>$id,'person_id'=>$person,'evidence'=>B2BProfiles::seal(['reference'=>$v['evidence'],'reviewer'=>$r->user()->id]),'created_at'=>now(),'updated_at'=>now()]);
            $this->profiles->audit($p->exhibition_id,'b2b_participants',$id,'representative',$r->user(),['representative_id'=>$rep,'person_id'=>$person]); return ['id'=>$rep,'person_id'=>$person];
        },3);
    }

    private function availability(Request $r): array
    {
        $this->access->authorize('programs.manage',$r->user());
        $v=$r->validate(['id'=>'nullable|integer','version'=>'nullable|integer','active'=>'sometimes|boolean','exhibition_id'=>'required|integer','person_id'=>'nullable|integer','location_id'=>'nullable|integer','available'=>'required|boolean','starts_at'=>'required|date_format:Y-m-d\TH:i:sP','ends_at'=>'required|date_format:Y-m-d\TH:i:sP|after:starts_at']); $this->access->event($v['exhibition_id'],$r->user());
        abort_if(!empty($v['person_id']) && !empty($v['location_id']),422,'Choose a person, a location or the program.');
        return DB::transaction(function () use($v,$r) {
            abort_unless(DB::table('b2b_programs')->where('exhibition_id',$v['exhibition_id'])->lockForUpdate()->first(),422,'Configure the program first.');
            if (!empty($v['person_id'])) { abort_unless(DB::table('b2b_representatives')->where('person_id',$v['person_id'])->whereIn('participant_id',$this->access->participants($r->user())->where('exhibition_id',$v['exhibition_id'])->select('id'))->exists(),404); }
            if (!empty($v['location_id'])) { abort_unless(DB::table('b2b_locations')->where('id',$v['location_id'])->where('exhibition_id',$v['exhibition_id'])->exists(),404); }
            $old=null;
            if (!empty($v['id'])) {
                $old=DB::table('b2b_windows')->where('exhibition_id',$v['exhibition_id'])->where('id',$v['id'])->lockForUpdate()->first(); abort_unless($old,404);
                if ($old->person_id) { abort_unless(DB::table('b2b_representatives')->where('person_id',$old->person_id)->whereIn('participant_id',$this->access->participants($r->user())->where('exhibition_id',$v['exhibition_id'])->select('id'))->exists(),404); }
                abort_unless(($v['version']??null)==$old->version,409,'Availability changed. Refresh its version.');
                abort_if(DB::table('b2b_meetings')->where('exhibition_id',$v['exhibition_id'])->whereIn('status',['scheduled','confirmed','in_progress'])->exists(),422,'Resolve active event meetings before revising or archiving availability.');
            }
            abort_if(!$old && isset($v['active']) && !$v['active'],422,'Only an existing window may be archived.');
            $data=$v; unset($data['id']); $data['person_id']=$v['person_id']??null; $data['location_id']=$v['location_id']??null; $data['active']=$v['active']??true; $data['version']=$old?$old->version+1:1; $data['starts_at']=CarbonImmutable::parse($v['starts_at'])->utc(); $data['ends_at']=CarbonImmutable::parse($v['ends_at'])->utc();
            abort_if($data['starts_at']->diffInDays($data['ends_at'])>31,422,'Availability windows are limited to 31 days.');
            $meetings=DB::table('b2b_meetings')->where('exhibition_id',$v['exhibition_id'])->whereIn('status',['scheduled','confirmed','in_progress'])->where('starts_at','<',$data['ends_at'])->where('ends_at','>',$data['starts_at']);
            if (!empty($v['person_id'])) { $ids=DB::table('b2b_representatives')->where('person_id',$v['person_id'])->pluck('id'); $meetings->where(fn($q)=>$q->whereIn('buyer_representative_id',$ids)->orWhereIn('exhibitor_representative_id',$ids)); }
            if (!empty($v['location_id'])) { $meetings->where('location_id',$v['location_id']); }
            abort_if(!$v['available'] && $meetings->exists(),422,'Reschedule or cancel affected meetings before adding a break.');
            $data['updated_at']=now(); if ($old) { $id=$old->id; DB::table('b2b_windows')->where('id',$id)->update($data); } else { $id=DB::table('b2b_windows')->insertGetId([...$data,'created_at'=>now()]); } $this->profiles->audit($v['exhibition_id'],'b2b_windows',$id,'availability',$r->user(),$v); return ['id'=>$id];
        },3);
    }

    private function concierge(Request $r,int $id): array
    {
        $this->access->authorize('concierge.manage',$r->user()); $v=$r->validate(['active'=>'required|boolean','evidence'=>'required|string|max:2000']);
        DB::transaction(function () use($r,$v,$id) {
            $p=$this->access->participant($id,$r->user(),true); abort_unless($p->kind==='exhibitor' && (!$v['active'] || $this->access->eligible($p,true,true)),422,'Only qualified exhibitors may receive concierge coordination.');
            DB::table('b2b_concierge')->updateOrInsert(['participant_id'=>$id],['active'=>$v['active'],'evidence'=>B2BProfiles::seal(['reference'=>$v['evidence']]),'coordinator_id'=>$r->user()->id,'created_at'=>now(),'updated_at'=>now()]);
            $this->profiles->audit($p->exhibition_id,'b2b_participants',$id,'concierge',$r->user(),$v);
        },3); return ['ok'=>true];
    }
}
