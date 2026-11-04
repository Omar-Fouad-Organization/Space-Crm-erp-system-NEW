<?php

namespace App\Services;

use Illuminate\Support\Facades\{DB, Validator};

class B2BWorkflow
{
    public function __construct(private B2BAccess $access, private B2BProfiles $profiles, private B2BMatching $matching) {}

    public function generate(int $event, $user): array
    {
        $this->access->authorize('matches.manage',$user); $this->access->event($event,$user);
        return DB::transaction(function () use ($event,$user) {
            abort_unless(DB::table('b2b_programs')->where('exhibition_id',$event)->lockForUpdate()->first(),422,'Configure a B2B program first.');
            $participants=$this->access->participants($user)->where('exhibition_id',$event)->orderBy('id')->limit(801)->lockForUpdate()->get();
            abort_if($participants->count()>800,422,'Limit participant batch size before generating candidates.');
            $buyers=$participants->where('kind','buyer'); $exhibitors=$participants->where('kind','exhibitor');
            abort_if($buyers->count()*$exhibitors->count()>400,422,'Limit this event batch to 400 candidate pairs.');
            $profiles=[]; $availability=[]; $eligibility=[];
            $existing=DB::table('b2b_matches')->where('exhibition_id',$event)->whereIn('buyer_id',$buyers->pluck('id'))->whereIn('exhibitor_id',$exhibitors->pluck('id'))->orderBy('id')->lockForUpdate()->get()->keyBy(fn($m)=>$m->buyer_id.':'.$m->exhibitor_id);
            $ids=$participants->pluck('id');
            $representatives=DB::table('b2b_representatives')->whereIn('participant_id',$ids)->where('active',true)->get();
            $allWindows=DB::table('b2b_windows')->where('exhibition_id',$event)->where('active',true)->where('available',true)->whereIn('person_id',$representatives->pluck('person_id'))->limit(2001)->get();
            abort_if($allWindows->count()>2000,422,'Availability batch is too large; narrow the program before recalculation.');
            $allWindows=$allWindows->groupBy('person_id');
            foreach ($participants as $participant) {
                $eligibility[$participant->id]=$this->access->eligible($participant,true,true);
                $profiles[$participant->id]=B2BProfiles::open($participant->profile);
                $availability[$participant->id]=[];
                foreach ($representatives->where('participant_id',$participant->id) as $rep) { foreach ($allWindows->get($rep->person_id,collect()) as $window) { $availability[$participant->id][]=$window; } }
            }
            $created=0; $updated=0;
            foreach ($buyers as $buyer) {
                foreach ($exhibitors as $exhibitor) {
                    if (!$eligibility[$buyer->id] || !$eligibility[$exhibitor->id]) { continue; }
                    $m=$existing->get($buyer->id.':'.$exhibitor->id);
                    // Recalculation cannot resurrect a decline, erase consent history or silently change approved outreach.
                    if ($m && !in_array($m->status,['suggested','under_review'],true)) { continue; }
                    $explanation=$this->matching->compare($profiles[$buyer->id],$profiles[$exhibitor->id]);
                    $windows=[$availability[$buyer->id],$availability[$exhibitor->id]];
                    $overlap=false;
                    foreach ($windows as &$list) { usort($list,fn($a,$b)=>strcmp($a->starts_at,$b->starts_at)); } unset($list);
                    $i=0; $j=0;
                    while ($i<count($windows[0]) && $j<count($windows[1])) {
                        $a=$windows[0][$i]; $b=$windows[1][$j];
                        if ($a->starts_at<$b->ends_at && $b->starts_at<$a->ends_at) { $overlap=true; break; }
                        if ($a->ends_at<=$b->ends_at) { $i++; } else { $j++; }
                    }
                    $explanation['factors']['availability']=['points'=>0,'basis'=>$overlap?'candidate_window_overlap':'unknown_or_no_window_overlap','note'=>'Planning signal only; approved dates, duration, breaks, people and location must pass the scheduler.'];
                    $data=['exhibition_id'=>$event,'buyer_id'=>$buyer->id,'exhibitor_id'=>$exhibitor->id,'buyer_version'=>$buyer->profile_version,'exhibitor_version'=>$exhibitor->profile_version,'rule_version'=>B2BMatching::VERSION,'score'=>$explanation['score'],'explanation'=>json_encode($explanation),'status'=>'suggested','updated_at'=>now()];
                    if ($m) {
                        if ($m->rule_version===B2BMatching::VERSION && $m->buyer_version==$buyer->profile_version && $m->exhibitor_version==$exhibitor->profile_version && json_decode($m->explanation,true)==$explanation) { continue; }
                        DB::table('b2b_matches')->where('id',$m->id)->update([...$data,'version'=>$m->version+1]); $id=$m->id; $updated++;
                    } else { $id=DB::table('b2b_matches')->insertGetId([...$data,'created_at'=>now()]); $created++; }
                    $this->profiles->audit($event,'b2b_matches',$id,'recommendation',$user,['before'=>$m?['score'=>$m->score,'rule_version'=>$m->rule_version,'status'=>$m->status,'explanation'=>json_decode($m->explanation,true)]:null,'after'=>$explanation]);
                }
            }
            return compact('created','updated');
        },3);
    }

    public function current(object $m, $user, bool $lock=true): array
    {
        abort_unless($m->rule_version===B2BMatching::VERSION,409,'Matching rule changed. Authorized reconsideration and recalculation are required; history is preserved.');
        $ids=[$m->buyer_id,$m->exhibitor_id]; sort($ids); $rows=[];
        foreach ($ids as $id) { $rows[$id]=$this->access->participant($id,$user,$lock); }
        $buyer=$rows[$m->buyer_id]; $exhibitor=$rows[$m->exhibitor_id];
        abort_unless($this->access->eligible($buyer,true,$lock) && $this->access->eligible($exhibitor,true,$lock),422,'Participation is no longer eligible.');
        abort_unless($buyer->profile_version==$m->buyer_version && $exhibitor->profile_version==$m->exhibitor_version,409,'Profiles changed. Reconsider and recalculate this introduction.');
        $e=$this->matching->compare(B2BProfiles::open($buyer->profile),B2BProfiles::open($exhibitor->profile));
        abort_if(count($e['blockers'])>0,422,'Hard compatibility requirements are not met.');
        abort_unless($e['baseline_met'],422,'A reviewed catalogue and meaningful buyer sourcing baseline are required before outreach.'); return [$buyer,$exhibitor];
    }

    public function transition(int $id, array $input, $user): void
    {
        $v=Validator::make($input,['version'=>'required|integer','action'=>'required|in:review,approve,invite,accept,decline,expire,reconsider','reason'=>'required|string|max:2000','party'=>'nullable|in:buyer,exhibitor','channel'=>'nullable|in:phone,email_document,in_person','evidence'=>'nullable|string|max:2000','expires_at'=>'nullable|date_format:Y-m-d\TH:i:sP'])->validate();
        $this->access->authorize(in_array($v['action'],['approve','reconsider'])?'matches.approve':'matches.manage',$user);
        DB::transaction(function () use ($id,$v,$user) {
            $m=$this->access->match($id,$user,true); abort_unless($m->version==$v['version'],409,'Introduction changed. Refresh.');
            $action=$v['action']; $next=$m->status;
            if ($action==='review') { abort_unless($m->status==='suggested',422); $next='under_review'; }
            if ($action==='approve') { abort_unless($m->status==='under_review',422); $this->current($m,$user); $next='approved_for_outreach'; }
            if ($action==='invite') {
                abort_unless($m->status==='approved_for_outreach',422); $this->current($m,$user);
                abort_unless(!empty($v['expires_at']) && \Carbon\CarbonImmutable::parse($v['expires_at'])->isFuture(),422,'Choose a future invitation expiry.');
                foreach (['buyer','exhibitor'] as $party) { DB::table('b2b_invitations')->updateOrInsert(['match_id'=>$id,'party'=>$party],['status'=>'pending','communication_status'=>'not_sent','expires_at'=>\Carbon\CarbonImmutable::parse($v['expires_at'])->utc(),'evidence'=>null,'channel'=>null,'recorded_by'=>null,'created_at'=>now(),'updated_at'=>now()]); }
                $next='invitation_pending';
            }
            if (in_array($action,['accept','decline'],true)) {
                abort_unless(in_array($m->status,['invitation_pending','mutually_accepted'],true) && !empty($v['party']) && !empty($v['evidence']) && !empty($v['channel']),422,'Independent evidence, party and verification channel are required.');
                if ($action==='accept') { $this->current($m,$user); }
                $inv=DB::table('b2b_invitations')->where('match_id',$id)->where('party',$v['party'])->lockForUpdate()->first();
                abort_unless($inv && ($action==='decline' || (\Carbon\CarbonImmutable::parse($inv->expires_at)->isFuture() && $inv->status==='pending')),422,'Invitation is expired or already decided.');
                DB::table('b2b_invitations')->where('id',$inv->id)->update(['status'=>$action==='accept'?'accepted':'declined','channel'=>$v['channel'],'evidence'=>B2BProfiles::seal(['reference'=>$v['evidence'],'reason'=>$v['reason'],'recorded_at'=>now()->toIso8601String()]),'recorded_by'=>$user->id,'updated_at'=>now()]);
                $next=$action==='decline'?'declined':(DB::table('b2b_invitations')->where('match_id',$id)->where('status','accepted')->count()===2?'mutually_accepted':'invitation_pending');
                if ($action==='decline') { $this->cancelMeetings($id,$user,'Acceptance withdrawn'); }
            }
            if ($action==='expire') {
                abort_unless($m->status==='invitation_pending' && DB::table('b2b_invitations')->where('match_id',$id)->where('expires_at','<=',now())->exists(),422);
                DB::table('b2b_invitations')->where('match_id',$id)->where('status','pending')->update(['status'=>'expired','updated_at'=>now()]); $next='expired';
            }
            if ($action==='reconsider') {
                abort_unless(in_array($m->status,['declined','expired','approved_for_outreach','invitation_pending','mutually_accepted'],true) && !empty($v['evidence']),422,'New interest evidence and a reason are required.');
                abort_if(DB::table('b2b_meetings')->where('match_id',$id)->whereNotIn('status',['cancelled','completed','no_show'])->exists(),422,'Cancel the active meeting before reconsideration.');
                // Prior invitations remain preserved; a later invite updates their current projection and audit retains evidence.
                $next='suggested';
            }
            DB::table('b2b_matches')->where('id',$id)->update(['status'=>$next,'version'=>$m->version+1,'updated_at'=>now()]);
            $this->profiles->audit($m->exhibition_id,'b2b_matches',$id,$action,$user,$v);
        },3);
    }

    private function cancelMeetings(int $match, $user, string $reason): void
    {
        foreach (DB::table('b2b_meetings')->where('match_id',$match)->whereIn('status',['scheduled','confirmed','in_progress'])->lockForUpdate()->get() as $meeting) {
            DB::table('b2b_slots')->where('meeting_id',$meeting->id)->delete();
            DB::table('b2b_meetings')->where('id',$meeting->id)->update(['status'=>'cancelled','version'=>$meeting->version+1,'updated_at'=>now()]);
            $this->profiles->audit($meeting->exhibition_id,'b2b_meetings',$meeting->id,'cancel',$user,['reason'=>$reason]);
        }
    }
}
