<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\{DB, Validator};

class B2BScheduler
{
    public function __construct(private B2BAccess $access, private B2BWorkflow $workflow, private B2BProfiles $profiles) {}

    public function schedule(array $input, $user): int
    {
        $this->access->authorize('meetings.schedule',$user);
        $v=Validator::make($input,['match_id'=>'required|integer','meeting_id'=>'nullable|integer','version'=>'nullable|integer','buyer_representative_id'=>'required|integer','exhibitor_representative_id'=>'required|integer','location_id'=>'required|integer','starts_at'=>'required|date_format:Y-m-d\TH:i:sP','reason'=>'required|string|max:2000'])->validate();
        try {
            return DB::transaction(function () use ($v,$user) {
                // Program lock serializes date/window administration with bookings; unique resource slots protect across programs too.
                $preview=$this->access->match($v['match_id'],$user);
                $program=DB::table('b2b_programs')->where('exhibition_id',$preview->exhibition_id)->lockForUpdate()->first();
                abort_unless($program && $program->dates_approved,422,'Approved event dates and program configuration are required.');
                $m=$this->access->match($v['match_id'],$user,true);
                abort_unless($m->status==='mutually_accepted',422,'Both parties must independently accept before scheduling.');
                [$buyer,$exhibitor]=$this->workflow->current($m,$user);
                abort_unless(DB::table('b2b_invitations')->where('match_id',$m->id)->where('status','accepted')->count()===2,422);
                $start=CarbonImmutable::parse($v['starts_at'])->utc(); $end=$start->addMinutes($program->duration);
                abort_unless($start->isFuture() && $start->second===0 && $start->minute%5===0,422,'Use a future five-minute boundary.');
                $local=$start->setTimezone($program->timezone); $localEnd=$end->setTimezone($program->timezone);
                abort_unless(in_array($local->toDateString(),json_decode($program->meeting_dates,true),true) && $local->toDateString()===$localEnd->toDateString(),422,'Meeting must fit an approved local event date.');
                abort_unless(DB::table('b2b_locations')->where('id',$v['location_id'])->where('exhibition_id',$m->exhibition_id)->exists(),422,'Location belongs to another exhibition.');
                $people=[];
                foreach (['buyer'=>$buyer,'exhibitor'=>$exhibitor] as $party=>$participant) {
                    $rep=DB::table('b2b_representatives')->where('id',$v[$party.'_representative_id'])->where('participant_id',$participant->id)->where('active',true)->lockForUpdate()->first();
                    abort_unless($rep && $rep->evidence,422,'Choose a verified representative of the correct organization.'); $people[]=$rep->person_id;
                }
                abort_if($people[0]===$people[1],422,'One person cannot represent both sides of this meeting.');
                $this->window($m->exhibition_id,null,null,$start,$end);
                foreach ($people as $person) { $this->window($m->exhibition_id,$person,null,$start,$end); }
                $this->window($m->exhibition_id,null,$v['location_id'],$start,$end);
                $old=DB::table('b2b_meetings')->where('match_id',$m->id)->lockForUpdate()->first();
                if ($old) {
                    $this->access->authorize('meetings.manage',$user);
                    abort_unless(($v['meeting_id']??null)==$old->id && ($v['version']??null)==$old->version && !in_array($old->status,['completed','no_show'],true),409,'Existing meeting requires its current version for rescheduling.');
                    DB::table('b2b_slots')->where('meeting_id',$old->id)->delete();
                } else { abort_if(!empty($v['meeting_id']),404); }
                $data=['match_id'=>$m->id,'exhibition_id'=>$m->exhibition_id,'buyer_representative_id'=>$v['buyer_representative_id'],'exhibitor_representative_id'=>$v['exhibitor_representative_id'],'location_id'=>$v['location_id'],'starts_at'=>$start,'ends_at'=>$end,'status'=>'scheduled','version'=>$old?$old->version+1:1,'updated_at'=>now()];
                if ($old) { $id=$old->id; DB::table('b2b_meetings')->where('id',$id)->update($data); }
                else { $id=DB::table('b2b_meetings')->insertGetId([...$data,'created_at'=>now()]); }
                $resources=[['person',$people[0]],['person',$people[1]],['location',$v['location_id']]];
                usort($resources,fn ($a,$b)=>($a[0].':'.$a[1])<=>($b[0].':'.$b[1])); $slots=[];
                foreach ($resources as [$type,$resource]) {
                    for ($slot=$start;$slot->lt($end);$slot=$slot->addMinutes(5)) { $slots[]=['meeting_id'=>$id,'resource_type'=>$type,'resource_id'=>$resource,'starts_at'=>$slot]; }
                }
                DB::table('b2b_slots')->insert($slots);
                $this->profiles->audit($m->exhibition_id,'b2b_meetings',$id,$old?'reschedule':'schedule',$user,['before'=>$old,'after'=>$data,'reason'=>$v['reason']]); return $id;
            },3);
        } catch (QueryException $e) {
            if (($e->errorInfo[1]??null)===1062) { abort(409,'A person or location has already been booked. Refresh availability.'); }
            throw $e;
        }
    }

    private function window(int $event, ?int $person, ?int $location, CarbonImmutable $start, CarbonImmutable $end): void
    {
        $q=DB::table('b2b_windows')->where('active',true)->where('exhibition_id',$event)->where('person_id',$person)->where('location_id',$location);
        abort_unless((clone $q)->where('available',true)->where('starts_at','<=',$start)->where('ends_at','>=',$end)->exists(),422,'Meeting does not fit verified availability.');
        abort_if((clone $q)->where('available',false)->where('starts_at','<',$end)->where('ends_at','>',$start)->exists(),422,'Meeting overlaps a break or unavailable period.');
    }

    public function update(int $id, array $input, $user): void
    {
        $v=Validator::make($input,['version'=>'required|integer','status'=>'required|in:confirmed,in_progress,completed,cancelled,no_show','reason'=>'required|string|max:2000','result'=>'nullable|string|max:6000','followup_user_id'=>'nullable|integer','followup_due'=>'nullable|date_format:Y-m-d','followup_status'=>'nullable|in:pending,completed'])->validate();
        $this->access->authorize('meetings.manage',$user);
        if (count(array_intersect(array_keys($v),['result','followup_user_id','followup_due','followup_status']))>0) { $this->access->authorize('results.manage',$user); }
        DB::transaction(function () use ($id,$v,$user) {
            $preview=DB::table('b2b_meetings')->whereIn('match_id',$this->access->matches($user)->select('id'))->where('id',$id)->first(); abort_unless($preview,404);
            DB::table('b2b_programs')->where('exhibition_id',$preview->exhibition_id)->lockForUpdate()->first();
            $m=$this->access->match($preview->match_id,$user,true);
            $meeting=DB::table('b2b_meetings')->where('id',$id)->lockForUpdate()->first(); abort_unless($meeting->version==$v['version'],409);
            $allowed=['scheduled'=>['confirmed','cancelled'],'confirmed'=>['in_progress','cancelled','no_show'],'in_progress'=>['completed','cancelled','no_show'],'completed'=>['completed'],'no_show'=>['no_show'],'cancelled'=>[]];
            abort_unless(in_array($v['status'],$allowed[$meeting->status],true),422,'Invalid meeting status transition.');
            if ($v['status']!=='cancelled' && !in_array($meeting->status,['completed','no_show'],true)) { $this->workflow->current($m,$user); abort_unless($m->status==='mutually_accepted',422); }
            if (in_array($v['status'],['in_progress','completed','no_show'],true)) { abort_if(CarbonImmutable::parse($meeting->starts_at)->isFuture(),422,'An unstarted future meeting cannot have an attendance outcome.'); }
            if (!empty($v['followup_user_id'])) {
                $owner=\App\Models\User::find($v['followup_user_id']);
                abort_unless($owner && $owner->status==='active' && app(PermissionPolicy::class)->allows('b2b.results.manage',$owner) && $this->access->matches($owner)->where('id',$m->id)->exists() && !empty($v['followup_due']),422,'Follow-up owner needs current access to this introduction.');
            }
            $data=['status'=>$v['status'],'version'=>$meeting->version+1,'updated_at'=>now()];
            foreach (['followup_user_id','followup_due','followup_status'] as $key) { if (array_key_exists($key,$v)) { $data[$key]=$v[$key]; } }
            if (array_key_exists('result',$v)) { $data['result']=$v['result']?B2BProfiles::seal(['notes'=>$v['result']]):null; }
            DB::table('b2b_meetings')->where('id',$id)->update($data);
            if ($v['status']==='cancelled') { DB::table('b2b_slots')->where('meeting_id',$id)->delete(); }
            $this->profiles->audit($meeting->exhibition_id,'b2b_meetings',$id,'status',$user,$v);
        },3);
    }
}
