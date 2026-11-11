<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\{DB, Validator};

class B2BOperations
{
    public const OUTCOMES = ['positive_interest','followup_required','no_immediate_opportunity','not_interested'];

    public function __construct(private B2BAccess $access, private B2BProfiles $profiles) {}

    public function authorize(string $action, $user): void
    {
        abort_unless(config('b2b.onsite_enabled'),503,'Hosted and on-site operations are not activated.');
        $this->access->authorize($action,$user);
        $this->access->authorize('buyers.view',$user);
        $this->access->authorize(str_starts_with($action,'hosted.')?'hosted.view':'onsite.view',$user);
    }

    public function hosted(int $participant, array $input, $user): int
    {
        $v=Validator::make($input,['action'=>'required|in:nominate,approve,reject,suspend,cancel','version'=>'required|integer|min:0','reason'=>'required|string|max:2000'])->validate();
        $this->authorize(match($v['action']) {'nominate'=>'hosted.nominate','suspend','cancel'=>'hosted.revoke',default=>'hosted.approve'},$user);
        return DB::transaction(function () use ($participant,$v,$user) {
            $p=$this->access->participant($participant,$user,true);
            abort_unless($p->kind==='buyer',422,'Hosted participation is only for buyers.');
            if (!in_array($v['action'],['cancel','suspend'],true)) {
                abort_unless($this->access->eligible($p,true,true),422,'Current verified buyer participation and consent are required.');
            }
            $old=DB::table('b2b_hosted_participations')->where('participant_id',$p->id)->lockForUpdate()->first();
            abort_unless(($old->version??0)===$v['version'],409,'Hosted participation changed. Refresh.');
            $allowed=['none'=>['nominate'],'candidate'=>['approve','reject','cancel'],'approved'=>['suspend','cancel'],'rejected'=>['nominate'],'suspended'=>['approve','cancel'],'cancelled'=>['nominate']];
            abort_unless(in_array($v['action'],$allowed[$old->status??'none'],true),422,'Invalid hosted participation decision.');
            $status=['nominate'=>'candidate','approve'=>'approved','reject'=>'rejected','suspend'=>'suspended','cancel'=>'cancelled'][$v['action']];
            $data=['participant_id'=>$p->id,'exhibition_id'=>$p->exhibition_id,'status'=>$status,'version'=>$v['version']+1,'decided_by'=>$user->id,'decided_at'=>now(),'reason'=>B2BProfiles::seal(['reason'=>$v['reason']]),'updated_at'=>now()];
            if ($old) { $id=$old->id; DB::table('b2b_hosted_participations')->where('id',$id)->update($data); }
            else { $id=DB::table('b2b_hosted_participations')->insertGetId([...$data,'created_at'=>now()]); }
            $this->profiles->audit($p->exhibition_id,'b2b_hosted_participations',$id,$v['action'],$user,['before'=>$old,'status'=>$status,'reason'=>$v['reason']]);
            return $id;
        },3);
    }

    public function benefit(int $participant, array $input, $user): int
    {
        $this->authorize('hosted.approve',$user);
        $v=Validator::make($input,['request_id'=>'required|uuid','classification'=>'required|string|max:100','reason'=>'required|string|max:2000'])->validate();
        return DB::transaction(function () use ($participant,$v,$user) {
            $p=$this->access->participant($participant,$user,true);
            $hosted=DB::table('b2b_hosted_participations')->where('participant_id',$p->id)->lockForUpdate()->first();
            abort_unless($p->kind==='buyer' && $hosted && $hosted->status==='approved' && $this->access->eligible($p,true,true),422,'An eligible approved hosted buyer is required.');
            $old=DB::table('b2b_hosted_benefits')->where('request_id',$v['request_id'])->first();
            if ($old) {
                abort_unless($old->hosted_id===$hosted->id && $old->classification===$v['classification'] && B2BProfiles::open($old->reason)['reason']===$v['reason'],409,'Benefit request key was already used.');
                return $old->id;
            }
            $id=DB::table('b2b_hosted_benefits')->insertGetId(['hosted_id'=>$hosted->id,'classification'=>$v['classification'],'reason'=>B2BProfiles::seal(['reason'=>$v['reason']]),'request_id'=>$v['request_id'],'approved_by'=>$user->id,'created_at'=>now(),'updated_at'=>now()]);
            $this->profiles->audit($p->exhibition_id,'b2b_hosted_participations',$hosted->id,'benefit_approved',$user,['benefit_id'=>$id,...$v]);
            return $id;
        },3);
    }

    private function arrival(object $p, string $reason, $user): void
    {
        if (!DB::table('b2b_arrivals')->where('participant_id',$p->id)->exists()) {
            DB::table('b2b_arrivals')->insert(['participant_id'=>$p->id,'source'=>'staff_manual','recorded_by'=>$user->id,'recorded_at'=>now(),'notes'=>B2BProfiles::seal(['reason'=>$reason])]);
            $this->profiles->audit($p->exhibition_id,'b2b_participants',$p->id,'manual_arrival',$user,['source'=>'staff_manual','reason'=>$reason]);
        }
    }

    public function participantArrival(int $id, array $input, $user): void
    {
        $this->authorize('onsite.attendance',$user);
        $v=Validator::make($input,['reason'=>'required|string|max:2000'])->validate();
        DB::transaction(function () use ($id,$v,$user) {
            $p=$this->access->participant($id,$user,true);
            abort_unless($this->access->eligible($p,false,true),422,'Current participation is required.');
            $event=DB::table('exhibitions')->find($p->exhibition_id);
            $timezone=DB::table('b2b_programs')->where('exhibition_id',$p->exhibition_id)->value('timezone')??'UTC';
            $today=now()->setTimezone($timezone)->toDateString();
            abort_unless($event && $today>=$event->start_date && $today<=$event->end_date,422,'Manual event arrival must be recorded during the exhibition dates.');
            $this->arrival($p,$v['reason'],$user);
        },3);
    }

    public function meeting(int $id, array $input, $user): void
    {
        abort_if(array_diff(array_keys($input),['action','version','booking_revision','party','reason','outcome_code','published']),422,'Unsupported on-site command fields. External verification sources are not accepted.');
        $v=Validator::make($input,['action'=>'required|in:arrive,start,complete,no_show,publish','version'=>'required|integer|min:1','booking_revision'=>'required_if:action,arrive|integer|min:1','party'=>'required_if:action,arrive,no_show|in:buyer,exhibitor,both','reason'=>'required|string|max:2000','outcome_code'=>'required_if:action,complete|in:'.implode(',',self::OUTCOMES),'published'=>'required_if:action,publish|boolean'])->validate();
        $this->authorize(match($v['action']) {'arrive','no_show'=>'onsite.attendance','start'=>'onsite.start','complete'=>'onsite.complete','publish'=>'onsite.publish'},$user);
        if ($v['action']==='complete') { $this->access->authorize('results.manage',$user); }
        DB::transaction(function () use ($id,$v,$user) {
            $preview=DB::table('b2b_meetings')->where('id',$id)->whereIn('match_id',$this->access->matches($user)->select('id'))->first();
            abort_unless($preview,404);
            DB::table('b2b_programs')->where('exhibition_id',$preview->exhibition_id)->lockForUpdate()->first();
            $match=$this->access->match($preview->match_id,$user,true);
            [$buyer,$exhibitor]=app(B2BWorkflow::class)->current($match,$user);
            abort_unless($match->status==='mutually_accepted',422,'Independent acceptances remain required.');
            $m=DB::table('b2b_meetings')->where('id',$id)->lockForUpdate()->first();
            $attendance=DB::table('b2b_meeting_attendance')->where('meeting_id',$id)->where('booking_revision',$m->booking_revision)->get()->keyBy('participant_id');
            if ($v['action']==='arrive') {
                abort_unless(in_array($m->status,['scheduled','confirmed'],true) && $v['party']!=='both',422,'Record each party separately before the meeting starts.');
                abort_unless($v['booking_revision']===$m->booking_revision,409,'The booking was rescheduled. Refresh.');
                $timezone=DB::table('b2b_programs')->where('exhibition_id',$m->exhibition_id)->value('timezone');
                abort_unless(CarbonImmutable::parse($m->starts_at)->setTimezone($timezone)->toDateString()===now()->setTimezone($timezone)->toDateString(),422,'Meeting arrival must be recorded on the scheduled event day.');
                $p=$v['party']==='buyer'?$buyer:$exhibitor;
                if (isset($attendance[$p->id]) && $attendance[$p->id]->status==='arrived') { return; }
                abort_unless($m->version===$v['version'],409,'Meeting changed. Refresh.');
                $this->recordAttendance($m,$p,'arrived',$v['reason'],$user);
                $this->arrival($p,$v['reason'],$user);
            } else {
                abort_unless($m->version===$v['version'],409,'Meeting changed. Refresh.');
                if ($v['action']==='publish') {
                    abort_unless($m->status==='completed' && $m->outcome_code,422,'Only a recorded completed outcome may be published.');
                    DB::table('b2b_meetings')->where('id',$id)->update(['outcome_published'=>$v['published']]);
                } else {
                    abort_if(CarbonImmutable::parse($m->starts_at)->isFuture(),422,'The scheduled meeting time has not arrived.');
                    if ($v['action']==='start') {
                        abort_unless(in_array($m->status,['scheduled','confirmed'],true),422,'Only an unstarted scheduled meeting can start.');
                        abort_unless(($attendance[$buyer->id]->status??null)==='arrived' && ($attendance[$exhibitor->id]->status??null)==='arrived',422,'Both parties must independently arrive.');
                        DB::table('b2b_meetings')->where('id',$id)->update(['status'=>'in_progress','started_at'=>now()]);
                    } elseif ($v['action']==='complete') {
                        abort_unless($m->status==='in_progress',422,'Start the meeting before completion.');
                        DB::table('b2b_meetings')->where('id',$id)->update(['status'=>'completed','completed_at'=>now(),'outcome_code'=>$v['outcome_code'],'outcome_published'=>false]);
                    } else {
                        abort_unless(in_array($m->status,['scheduled','confirmed'],true),422,'No-show is only valid for an unstarted meeting.');
                        $absent=$v['party']==='both'?[$buyer,$exhibitor]:[$v['party']==='buyer'?$buyer:$exhibitor];
                        foreach ($absent as $p) {
                            abort_if(isset($attendance[$p->id]),422,'An arrived participant cannot be declared absent.');
                            $this->recordAttendance($m,$p,'no_show',$v['reason'],$user);
                        }
                        DB::table('b2b_meetings')->where('id',$id)->update(['status'=>'no_show']);
                    }
                }
            }
            DB::table('b2b_meetings')->where('id',$id)->update(['version'=>$m->version+1,'updated_at'=>now()]);
            $this->profiles->audit($m->exhibition_id,'b2b_meetings',$id,'onsite_'.$v['action'],$user,['booking_revision'=>$m->booking_revision,...$v]);
        },3);
    }

    private function recordAttendance(object $meeting, object $participant, string $status, string $reason, $user): void
    {
        DB::table('b2b_meeting_attendance')->insert(['meeting_id'=>$meeting->id,'booking_revision'=>$meeting->booking_revision,'participant_id'=>$participant->id,'status'=>$status,'source'=>'staff_manual','recorded_by'=>$user->id,'recorded_at'=>now(),'notes'=>B2BProfiles::seal(['reason'=>$reason])]);
    }

    public function publicHosted(object $p): ?array
    {
        if (!config('b2b.onsite_enabled') || $p->kind!=='buyer') { return null; }
        $h=DB::table('b2b_hosted_participations')->where('participant_id',$p->id)->first();
        $eligible=$this->access->eligible($p,true);
        return ['status'=>$h->status??'not_nominated','effective_status'=>$h && $h->status==='approved' && !$eligible?'eligibility_hold':($h->status??'not_nominated'),
            'benefits'=>$h && $h->status==='approved' && $eligible?DB::table('b2b_hosted_benefits')->where('hosted_id',$h->id)->where('status','approved')->pluck('classification')->all():[]];
    }

    public function publicMeeting(object $m, int $participant): array
    {
        if (!config('b2b.onsite_enabled')) { return []; }
        $a=DB::table('b2b_meeting_attendance')->where('meeting_id',$m->id)->where('booking_revision',$m->booking_revision)->where('participant_id',$participant)->first();
        return ['own_attendance'=>$a?['status'=>$a->status,'source'=>$a->source,'recorded_at'=>$a->recorded_at]:null,
            'started_at'=>$m->started_at,'completed_at'=>$m->completed_at,'outcome'=>$m->status==='completed' && $m->outcome_published?$m->outcome_code:null,
            'rescheduled'=>$m->booking_revision>1];
    }
}
