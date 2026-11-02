<?php
namespace App\Http\Controllers;

use App\Services\CrmService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class CrmController extends Controller
{
    public function __construct(private CrmService $crm) {}
    public function metadata(Request $r)
    {
        $resources=[];
        foreach (config('crm.resources') as $name=>$config) {
            try { $this->crm->authorize($name,$r->user()); }
            catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) { continue; }
            try { $this->crm->authorize($name,$r->user(),true); $write=true; }
            catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) { $write=false; }
            if ($name==='users' && !$write) $config['fields']=array_intersect_key($config['fields'],array_flip(['name','status']));
            foreach ($config['fields'] as $key=>$field) {
                if ($field['type']!=='relation') continue;
                try { $this->crm->authorize($field['resource'],$r->user()); }
                catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) { unset($config['fields'][$key]); }
            }
            $resources[$name]=[...$config,'can_write'=>$write,'can_delete'=>$write && !in_array($name,['payments','commissions','invoices'])];
        }
        return ['resources'=>$resources,'settings'=>DB::table('settings')->first(),'user'=>$r->user()];
    }
    public function index(Request $r,string $resource) {
        return DB::transaction(function()use($r,$resource){
        $config=$this->crm->authorize($resource,$r->user());$v=$r->validate(['page'=>'nullable|integer|min:1','per_page'=>'nullable|integer|min:1|max:100','q'=>'nullable|string|max:200','status'=>'nullable|string|max:80','type'=>'nullable|string|max:80','priority'=>'nullable|string|max:80','ids'=>['nullable','regex:/^\d+(,\d+){0,99}$/'],'client_ids'=>['nullable','regex:/^\d+(,\d+){0,99}$/']]);
        $q=$this->crm->visible($resource,$r->user());if(!empty($v['ids']))$q->whereIn('id',explode(',',$v['ids']));if(!empty($v['client_ids'])&&isset($config['fields']['client_id']))$q->whereIn('client_id',explode(',',$v['client_ids']));
        if(!empty($v['type'])&&isset($config['fields']['type']))$q->where('type',$v['type']);if($resource==='deals'&&!empty($v['priority']))$q->where(function($q)use($v){$q->where('attributes->priority',$v['priority']);if($v['priority']==='Medium')$q->orWhereNull('attributes->priority');});
        if(!empty($v['q']))$q->where(function($q)use($resource,$v){$term='%'.addcslashes($v['q'],'%_').'%';$q->where('name','like',$term);if($resource==='clients')$q->orWhere('email','like',$term)->orWhere('contact_person','like',$term);if($resource==='deals')$q->orWhere('notes','like',$term)->orWhereIn('client_id',DB::table('clients')->where('name','like',$term)->pluck('id'));});if(!empty($v['status'])&&isset($config['fields']['status']))$q->where('status',$v['status']);
        $page=$q->orderByDesc('id')->paginate($v['per_page']??100);$this->crm->primeLabels($resource,$page->items());$page->setCollection($page->getCollection()->map(fn($row)=>$this->crm->present($resource,$row,$r->user())));return $page;
        });
    }
    public function show(Request $r,string $resource,int $id)
    {
        $this->crm->authorize($resource,$r->user());
        $this->crm->checkRecord($resource,$id,$r->user()); $row=DB::table($resource)->find($id); abort_unless($row,404,'Record not found.');
        $relations=[];
        foreach (config('crm.resources') as $other=>$config) {
            try { $this->crm->authorize($other,$r->user()); }
            catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) { continue; }
            foreach ($config['fields'] as $key=>$field) if ($field['type']==='relation' && $field['resource']===$resource) {
                $relations[$other]=$this->crm->visible($other,$r->user())->where($key,$id)->get()->map(fn($row)=>$this->crm->present($other,$row,$r->user()));
            }
        }
        return ['data'=>$this->crm->present($resource,$row,$r->user()),'relations'=>$relations];
    }
    public function store(Request $r,string $resource) { return response()->json(['data'=>$this->crm->save($resource,$r->all(),$r->user())],201); }
    public function update(Request $r,string $resource,int $id) { return ['data'=>$this->crm->save($resource,$r->all(),$r->user(),$id)]; }
    public function destroy(Request $r,string $resource,int $id) { $this->crm->delete($resource,$id,$r->user()); return response()->noContent(); }
    public function dashboard(Request $r)
    {
        $financial=in_array($r->user()->role,['super_admin','management','finance','sales']); $totals=[];
        if ($financial) foreach (DB::table('deals')->select('currency')->distinct()->pluck('currency') as $currency) {
            $deals=$this->crm->visible('deals',$r->user())->where('currency',$currency); $ids=(clone $deals)->pluck('id');
            $schedules=DB::table('payment_schedules')->whereIn('deal_id',$ids)->pluck('id');
            $totals[]=['currency'=>$currency,'pipeline'=>(clone $deals)->whereNotIn('status',['closed_lost','cancelled'])->sum('amount'),'won'=>(clone $deals)->where('status','closed_won')->sum('amount'),'received'=>DB::table('payments')->whereIn('payment_schedule_id',$schedules)->sum('amount'),'commission'=>DB::table('commissions')->whereIn('deal_id',$ids)->sum('amount')];
        }
        $counts=[];
        foreach (config('crm.resources') as $resource=>$config) {
            try { $this->crm->authorize($resource,$r->user()); $counts[$resource]=$this->crm->visible($resource,$r->user())->count(); }
            catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) { continue; }
        }
        return ['totals'=>$totals,'counts'=>$counts,'pipeline'=>$financial ? $this->crm->visible('deals',$r->user())->selectRaw('status,COUNT(*) as count')->groupBy('status')->get() : [],'activity'=>in_array($r->user()->role,['super_admin','management']) ? DB::table('audit_logs')->orderByDesc('id')->limit(15)->get(['id','resource','record_id','action','created_at']) : []];
    }
    public function exhibitors(Request $r)
    {
        $this->crm->authorize('deals',$r->user());
        return ['data'=>DB::table('deals')->join('clients','clients.id','=','deals.client_id')->join('exhibitions','exhibitions.id','=','deals.exhibition_id')->leftJoin('booths','booths.id','=','deals.booth_id')->whereIn('deals.id',$this->crm->visible('deals',$r->user())->pluck('id'))->where('deals.status','closed_won')->select('deals.id','clients.name','clients.contact_person','exhibitions.name as exhibition','booths.name as booth','deals.type','deals.amount','deals.currency')->get()];
    }
    public function diagnostics(Request $r)
    {
        abort_unless($r->user()->role==='super_admin',403);
        DB::select('SELECT 1');
        $counts=[]; $orphans=[];
        foreach (array_merge(array_keys(config('crm.resources')),['workflow_requests','expenses','collection_notes','reminders','teams','booth_layouts']) as $resource) $counts[$resource]=DB::table($resource)->count();
        // Inspect the actual MySQL constraints, including creator, audit, notification,
        // attachment, and meeting attendee relationships outside the form metadata.
        $keys=DB::table('information_schema.KEY_COLUMN_USAGE')
            ->where('CONSTRAINT_SCHEMA',DB::connection()->getDatabaseName())
            ->whereNotNull('REFERENCED_TABLE_NAME')
            ->get(['TABLE_NAME as child_table','COLUMN_NAME as child_column','REFERENCED_TABLE_NAME as parent_table','REFERENCED_COLUMN_NAME as parent_column']);
        foreach ($keys as $key) {
            $orphans[]=['field'=>$key->child_table.'.'.$key->child_column,'count'=>DB::table($key->child_table.' as child')
                ->leftJoin($key->parent_table.' as parent','child.'.$key->child_column,'=','parent.'.$key->parent_column)
                ->whereNotNull('child.'.$key->child_column)->whereNull('parent.'.$key->parent_column)->count()];
        }
        return ['database'=>'MySQL','counts'=>$counts,'orphans'=>$orphans,'checked_at'=>now()->toIso8601String()];
    }
    public function audit(Request $r)
    {
        abort_unless(in_array($r->user()->role,['super_admin','management']),403);
        return ['data'=>DB::table('audit_logs')->join('users','users.id','=','audit_logs.user_id')->when($r->user()->role!=='super_admin',fn($q)=>$q->whereNotIn('resource',['users','employees']))->orderByDesc('audit_logs.id')->limit(500)->get(['audit_logs.*','users.name as user_name'])];
    }
    public function notifications(Request $r) { return ['data'=>DB::table('notifications')->where('user_id',$r->user()->id)->orderByDesc('id')->limit(200)->get()]; }
    public function readAllNotifications(Request $r)
    {
        return ['updated'=>DB::table('notifications')->where('user_id',$r->user()->id)->whereNull('read_at')->update(['read_at'=>now(),'updated_at'=>now()])];
    }
    public function readNotification(Request $r,int $id)
    {
        abort_unless(DB::table('notifications')->where('id',$id)->where('user_id',$r->user()->id)->exists(),404);
        DB::table('notifications')->where('id',$id)->update(['read_at'=>now(),'updated_at'=>now()]); return ['ok'=>true];
    }
    public function settings(Request $r)
    {
        abort_unless($r->user()->role==='super_admin',403);
        $data=$r->validate(['company_name'=>'required|string|max:255','currency'=>['required',Rule::in(['EGP','USD','EUR','SAR','AED'])]]);
        DB::transaction(function () use ($data,$r) {
            $before=DB::table('settings')->first(); DB::table('settings')->where('id',1)->update([...$data,'updated_at'=>now()]);
            $this->crm->audit('settings',1,'update',$r->user()->id,$before,DB::table('settings')->first());
        });
        return ['data'=>DB::table('settings')->first()];
    }
    public function upload(Request $r,int $document)
    {
        $this->crm->authorize('documents',$r->user(),true); abort_unless(DB::table('documents')->where('id',$document)->exists(),404);
        $r->validate(['file'=>'required|file|max:10240|mimes:pdf,txt,csv,png,jpg,jpeg,docx,xlsx']);
        $this->crm->checkRecord('documents',$document,$r->user()); $file=$r->file('file'); $path=$file->store('documents','local');
        try { $id=DB::transaction(function () use ($file,$path,$document,$r) {
            $id=DB::table('attachments')->insertGetId(['document_id'=>$document,'name'=>$file->getClientOriginalName(),'mime'=>$file->getMimeType(),'size'=>$file->getSize(),'path'=>$path,'created_by'=>$r->user()->id,'created_at'=>now(),'updated_at'=>now()]);
            $this->crm->audit('attachments',$id,'upload',$r->user()->id,null,['name'=>$file->getClientOriginalName(),'document_id'=>$document]); return $id;
        }); } catch (\Throwable $e) { Storage::disk('local')->delete($path); throw $e; }
        return response()->json(['data'=>DB::table('attachments')->where('id',$id)->first(['id','name','mime','size'])],201);
    }
    public function download(Request $r,int $id)
    {
        $this->crm->authorize('documents',$r->user()); $file=DB::table('attachments')->find($id); abort_unless($file,404); $this->crm->checkRecord('documents',$file->document_id,$r->user());
        return Storage::disk('local')->download($file->path,$file->name,['X-Content-Type-Options'=>'nosniff']);
    }
    public function deleteAttachment(Request $r,int $id)
    {
        $this->crm->authorize('documents',$r->user(),true); $file=DB::table('attachments')->find($id); abort_unless($file,404);
        DB::transaction(function () use ($file,$id,$r) { DB::table('attachments')->where('id',$id)->delete(); $this->crm->audit('attachments',$id,'delete',$r->user()->id,$file,null); });
        Storage::disk('local')->delete($file->path); return response()->noContent();
    }
}
