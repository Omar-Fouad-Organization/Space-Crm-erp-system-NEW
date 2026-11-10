<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\{DB,Schema,Validator};

class B2BFollowupTasks
{
    public function __construct(private B2BAccess $access, private PermissionPolicy $policy) {}

    private function authorize($user, bool $create=false): void
    {
        abort_unless(config('b2b.crm_followup_enabled'),503,'CRM follow-up linking is not activated.');
        app(B2BOperations::class)->authorize('onsite.view',$user);
        $this->access->authorize('meetings.view',$user);
        $this->access->authorize($create?'results.manage':'results.view',$user);
        $this->policy->authorize($create?'tasks.create':'tasks.view',$user);
        if ($create) $this->policy->authorize('users.view',$user);
    }

    private function meeting(int $id,$user,bool $lock=false): object
    {
        $q=DB::table('b2b_meetings')->where('id',$id)->whereIn('match_id',$this->access->matches($user)->select('id'));
        if ($lock) $q->lockForUpdate();
        $m=$q->first(); abort_unless($m,404); $this->access->event($m->exhibition_id,$user); return $m;
    }

    private function assignee(User $owner,int $event,?int $client,?int $deal): bool
    {
        // New B2B work requires explicit event membership, including legacy staff.
        $events=$this->access->events($owner);
        if ($owner->status!=='active' || ($events!==null && !in_array($event,$events,true)) || !$this->policy->allows('tasks.view',$owner)) return false;
        foreach (['clients'=>$client,'deals'=>$deal] as $resource=>$id) {
            if ($id && (!$this->policy->allows($resource.'.view',$owner) || !app(RecordAccess::class)->query($resource,$owner)->where('id',$id)->exists())) return false;
        }
        return true;
    }

    public function context(int $id,$user): array
    {
        $this->authorize($user,true); $m=$this->meeting($id,$user);
        abort_unless($m->status==='completed' && $m->outcome_code==='followup_required',422,'A completed follow-up-required meeting is required.');
        $owners=User::where('status','active')->get()->filter(fn($u)=>$this->assignee($u,$m->exhibition_id,null,null))->map(fn($u)=>['id'=>(string)$u->id,'full_name'=>$u->name,'role'=>$u->role])->values();
        return ['meeting_id'=>$m->id,'version'=>$m->version,'exhibition_id'=>$m->exhibition_id,'title'=>'Follow up B2B meeting #'.$m->id,
            'assigned_user_id'=>$owners->contains('id',(string)$m->followup_user_id)?(string)$m->followup_user_id:'','due_date'=>$m->followup_due,
            'assignees'=>$owners,'task'=>$this->linked($m,$user)];
    }

    public function create(int $id,array $input,$user): array
    {
        $this->authorize($user,true);
        abort_if(array_diff(array_keys($input),['version','name','description','assigned_user_id','due_date','priority','status','exhibition_id','client_id','deal_id']),422,'Unsupported follow-up task fields.');
        $v=Validator::make($input,['version'=>'required|integer|min:1','name'=>'required|string|max:100','description'=>'nullable|string|max:5000',
            'assigned_user_id'=>'required|integer','due_date'=>'required|date_format:Y-m-d','priority'=>'required|in:low,medium,high,urgent','status'=>'required|in:pending',
            'exhibition_id'=>'required|integer','client_id'=>'nullable|integer','deal_id'=>'nullable|integer'])->validate();
        return DB::transaction(function() use($id,$v,$user) {
            $m=$this->meeting($id,$user,true);
            abort_unless($m->exhibition_id===$v['exhibition_id'],422,'Meeting and task exhibition must match.');
            abort_unless($m->status==='completed' && $m->outcome_code==='followup_required',422,'A completed follow-up-required meeting is required.');
            $existing=DB::table('b2b_followup_tasks')->where('meeting_id',$id)->first();
            if ($existing) {
                $task=$this->linked($m,$user); abort_unless($task,404); return ['task'=>$task,'created'=>false];
            }
            abort_unless($m->version===$v['version'],409,'Meeting changed. Refresh before creating a task.');
            $match=$this->access->match($m->match_id,$user);
            $exhibitor=$this->access->participant($match->exhibitor_id,$user);
            $client=$v['client_id']??null; $deal=$v['deal_id']??null;
            if ($client || $deal) {
                $source=DB::table('deals')->where('id',$exhibitor->deal_id)->lockForUpdate()->first();
                abort_unless($source && $source->exhibition_id===$m->exhibition_id && $source->client_id===$exhibitor->client_id && $source->type==='booth' && $source->status==='closed_won',422,'An exact authoritative exhibitor contract is required.');
                abort_unless((!$client || $client===$source->client_id) && (!$deal || $deal===$source->id),422,'Only the originating exhibitor relationship can be linked.');
            }
            $owner=User::where('id',$v['assigned_user_id'])->lockForUpdate()->first();
            abort_unless($owner && $this->assignee($owner,$m->exhibition_id,$client,$deal),422,'Choose an active task reader authorized for this exhibition and any linked records.');
            $data=$v; unset($data['version']);
            $task=app(CrmService::class)->save('tasks',$data,$user);
            DB::table('b2b_followup_tasks')->insert(['meeting_id'=>$id,'task_id'=>$task['id'],'exhibition_id'=>$m->exhibition_id,'linked_by'=>$user->id,'created_at'=>now()]);
            app(B2BProfiles::class)->audit($m->exhibition_id,'b2b_meetings',$id,'crm_followup_linked',$user,['task_id'=>$task['id']]);
            return ['task'=>$this->linked($m,$user),'created'=>true];
        },3);
    }

    public function linked(object $m,$user): ?array
    {
        if (!config('b2b.crm_followup_enabled') || !$this->policy->allows('tasks.view',$user) || !$this->policy->allows('b2b.results.view',$user)) return null;
        $link=DB::table('b2b_followup_tasks')->where('meeting_id',$m->id)->where('exhibition_id',$m->exhibition_id)->first();
        if (!$link) return null;
        $t=app(RecordAccess::class)->query('tasks',$user)->where('id',$link->task_id)->first();
        if (!$t) return null;
        $owner=$this->policy->allows('users.view',$user)?User::find($t->assigned_user_id):null;
        return ['id'=>$t->id,'title'=>$t->name,'status'=>$t->status,'due_date'=>$t->due_date,'assigned_employee'=>$owner?['id'=>$owner->id,'name'=>$owner->name]:null];
    }

    public function projection(object $m,$user): array
    {
        if (!config('b2b.crm_followup_enabled') || !$this->policy->allows('b2b.results.view',$user)) return [];
        $link=DB::table('b2b_followup_tasks')->where('meeting_id',$m->id)->exists();
        return ['followup_task'=>$this->linked($m,$user),'followup_task_exists'=>$link,
            'can_create_followup'=>!$link && $m->status==='completed' && $m->outcome_code==='followup_required' && $this->policy->allows('b2b.onsite.view',$user) && $this->policy->allows('b2b.results.manage',$user) && $this->policy->allows('b2b.meetings.view',$user) && $this->policy->allows('tasks.create',$user) && $this->policy->allows('users.view',$user)];
    }

    public function pendingCount($meetings,$user): int
    {
        if (!config('b2b.crm_followup_enabled')) return (clone $meetings)->where('followup_status','pending')->count();
        $legacy=(clone $meetings)->where('followup_status','pending')->whereNotIn('id',DB::table('b2b_followup_tasks')->select('meeting_id'))->count();
        if (!$this->policy->allows('tasks.view',$user)) return $legacy;
        return $legacy+DB::table('b2b_followup_tasks')->whereIn('meeting_id',(clone $meetings)->select('id'))
            ->whereIn('task_id',app(RecordAccess::class)->query('tasks',$user)->whereIn('status',['pending','in_progress'])->select('id'))->count();
    }

    public function source(int $task,$user): ?array
    {
        if (!config('b2b.crm_followup_enabled') || !config('b2b.onsite_enabled') || !config('b2b.enabled')) return null;
        foreach (['b2b.view','b2b.buyers.view','b2b.meetings.view','b2b.onsite.view','b2b.results.view'] as $p) if (!$this->policy->allows($p,$user)) return null;
        $link=DB::table('b2b_followup_tasks')->where('task_id',$task)->first(); if (!$link) return null;
        $m=DB::table('b2b_meetings')->where('id',$link->meeting_id)->whereIn('match_id',$this->access->matches($user)->select('id'))->first();
        if (!$m) return null;
        $tz=DB::table('b2b_programs')->where('exhibition_id',$m->exhibition_id)->value('timezone')??'UTC';
        return ['meeting_id'=>$m->id,'exhibition_id'=>$m->exhibition_id,'day'=>\Carbon\CarbonImmutable::parse($m->starts_at)->setTimezone($tz)->toDateString()];
    }

    public function validateTaskWrite(array $data,object $before): void
    {
        // Keep linked context protected even after the feature is disabled.
        if (!Schema::hasTable('b2b_followup_tasks')) return;
        $link=DB::table('b2b_followup_tasks')->where('task_id',$before->id)->first(); if (!$link) return;
        foreach (['exhibition_id','client_id','deal_id'] as $field) abort_if(array_key_exists($field,$data) && ($data[$field]??null)!=($before->$field??null),422,'A B2B follow-up task cannot change its originating context.');
        $owner=User::where('id',$data['assigned_user_id']??$before->assigned_user_id)->lockForUpdate()->first();
        abort_unless($owner && $this->assignee($owner,$link->exhibition_id,$before->client_id,$before->deal_id),422,'The task assignee cannot access its originating context.');
    }
}
