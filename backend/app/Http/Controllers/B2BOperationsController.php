<?php

namespace App\Http\Controllers;

use App\Services\{B2BAccess,B2BOperations,B2BProfiles};
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class B2BOperationsController extends Controller
{
    public function __construct(private B2BAccess $access, private B2BOperations $operations) {}

    public function index(Request $r): array
    {
        $v=$r->validate(['exhibition_id'=>'required|integer','section'=>'required|in:hosted,meetings','day'=>'nullable|date_format:Y-m-d','status'=>'nullable|in:scheduled,confirmed,in_progress,completed,no_show,cancelled,ready,awaiting,rescheduled,eligibility_hold','buyer_id'=>'nullable|integer','exhibitor_id'=>'nullable|integer','page'=>'nullable|integer|min:1']);
        $u=$r->user(); $event=(int)$v['exhibition_id'];
        $this->operations->authorize($v['section']==='hosted'?'hosted.view':'onsite.view',$u);
        $this->access->event($event,$u);
        $participants=$this->access->participants($u)->where('exhibition_id',$event);
        if ($v['section']==='hosted') {
            $rows=(clone $participants)->where('kind','buyer')->orderBy('id')->paginate(25);
            $ids=collect($rows->items())->pluck('id');
            $hosted=DB::table('b2b_hosted_participations')->whereIn('participant_id',$ids)->get()->keyBy('participant_id');
            $history=DB::table('b2b_audits')->where('resource','b2b_hosted_participations')->whereIn('record_id',$hosted->pluck('id'))->orderByDesc('id')->limit(500)->get()->groupBy('record_id');
            $benefits=DB::table('b2b_hosted_benefits')->whereIn('hosted_id',$hosted->pluck('id'))->get()->groupBy('hosted_id');
            $arrivals=DB::table('b2b_arrivals')->whereIn('participant_id',$ids)->get()->keyBy('participant_id');
            $eligible=$this->access->eligibleMany($rows->items(),true);
            $data=collect($rows->items())->map(function ($p) use ($hosted,$history,$benefits,$arrivals,$eligible) {
                $h=$hosted[$p->id]??null; $profile=B2BProfiles::open($p->profile);
                return ['participant_id'=>$p->id,'name'=>$profile['name_en'],'name_ar'=>$profile['name_ar'],'eligible'=>$eligible[$p->id],
                    'hosted'=>$h?['id'=>$h->id,'status'=>$h->status,'version'=>$h->version,'decided_by'=>$h->decided_by,'decided_at'=>$h->decided_at,'reason'=>B2BProfiles::open($h->reason)['reason'],'benefits'=>($benefits[$h->id]??collect())->map(fn($b)=>['classification'=>$b->classification,'status'=>$b->status,'approved_by'=>$b->approved_by]),
                        'history'=>($history[$h->id]??collect())->map(fn($a)=>['action'=>$a->action,'actor_id'=>$a->actor_id,'created_at'=>$a->created_at,'reason'=>B2BProfiles::open($a->details)['reason']??null])]:null,
                    'arrival'=>isset($arrivals[$p->id])?['status'=>'arrived','source'=>$arrivals[$p->id]->source,'recorded_at'=>$arrivals[$p->id]->recorded_at,'recorded_by'=>$arrivals[$p->id]->recorded_by]:null];
            });
            return ['data'=>$data,'last_page'=>$rows->lastPage(),'total'=>$rows->total()];
        }
        $program=DB::table('b2b_programs')->where('exhibition_id',$event)->first();
        $timezone=$program->timezone??'UTC';
        $day=$v['day']??now()->setTimezone($timezone)->toDateString();
        $start=CarbonImmutable::parse($day,$timezone)->startOfDay()->utc();
        $q=DB::table('b2b_meetings as meeting')->join('b2b_matches as introduction','introduction.id','=','meeting.match_id')
            ->whereIn('introduction.id',$this->access->matches($u)->where('exhibition_id',$event)->select('id'))
            ->where('meeting.starts_at','>=',$start)->where('meeting.starts_at','<',$start->setTimezone($timezone)->addDay()->startOfDay()->utc());
        foreach (['buyer_id','exhibitor_id'] as $key) { if (!empty($v[$key])) { $q->where('introduction.'.$key,$v[$key]); } }
        $arrived="(SELECT COUNT(*) FROM b2b_meeting_attendance attendance WHERE attendance.meeting_id=meeting.id AND attendance.booking_revision=meeting.booking_revision AND attendance.status='arrived')";
        $held=[];
        (clone $q)->whereIn('meeting.status',['scheduled','confirmed','in_progress'])
            ->select('meeting.id','introduction.buyer_id','introduction.exhibitor_id','introduction.buyer_version','introduction.exhibitor_version','introduction.rule_version')->orderBy('meeting.id')->chunk(100,function ($meetings) use (&$held) {
                $participants=DB::table('b2b_participants')->whereIn('id',$meetings->pluck('buyer_id')->merge($meetings->pluck('exhibitor_id')))->get()->keyBy('id');
                $eligible=[];
                foreach ($participants->chunk(100) as $batch) { $eligible+=$this->access->eligibleMany($batch,true); }
                foreach ($meetings as $m) {
                    $hold=$m->rule_version!==\App\Services\B2BMatching::VERSION;
                    foreach (['buyer','exhibitor'] as $party) {
                        $p=$participants[$m->{$party.'_id'}]??null;
                        $hold=$hold || !$p || !($eligible[$p->id]??false) || $p->profile_version!==$m->{$party.'_version'};
                    }
                    if ($hold) { $held[]=$m->id; }
                }
            });
        $counts=(clone $q)->selectRaw('meeting.status, COUNT(*) AS count')->groupBy('meeting.status')->pluck('count','status')->all();
        $counts['eligibility_hold']=count($held);
        $counts['ready']=(clone $q)->whereNotIn('meeting.id',$held)->whereIn('meeting.status',['scheduled','confirmed'])->whereRaw($arrived.'=2')->count();
        $counts['awaiting']=(clone $q)->whereNotIn('meeting.id',$held)->whereIn('meeting.status',['scheduled','confirmed'])->whereRaw($arrived.'<2')->count();
        $counts['rescheduled']=(clone $q)->where('meeting.booking_revision','>',1)->count();
        if (($v['status']??null)==='ready' || ($v['status']??null)==='awaiting') {
            $q->whereNotIn('meeting.id',$held)->whereIn('meeting.status',['scheduled','confirmed'])->whereRaw($arrived.(($v['status']==='ready')?'=2':'<2'));
        } elseif (($v['status']??null)==='eligibility_hold') { $q->whereIn('meeting.id',$held); }
        elseif (($v['status']??null)==='rescheduled') { $q->where('meeting.booking_revision','>',1); }
        elseif (!empty($v['status'])) { $q->where('meeting.status',$v['status']); }
        $rows=$q->select('meeting.*','introduction.buyer_id','introduction.exhibitor_id')->orderBy('meeting.starts_at')->orderBy('meeting.id')->paginate(40);
        $people=(clone $participants)->whereIn('id',collect($rows->items())->pluck('buyer_id')->merge(collect($rows->items())->pluck('exhibitor_id')))->get()->keyBy('id');
        $attendance=DB::table('b2b_meeting_attendance')->whereIn('meeting_id',collect($rows->items())->pluck('id'))->get()->groupBy('meeting_id');
        $locations=DB::table('b2b_locations')->where('exhibition_id',$event)->pluck('name','id');
        $data=collect($rows->items())->map(function ($m) use ($people,$attendance,$locations,$held) {
            $out=['eligibility_hold'=>in_array($m->id,$held,true),'id'=>$m->id,'exhibition_id'=>$m->exhibition_id,'match_id'=>$m->match_id,'version'=>$m->version,'booking_revision'=>$m->booking_revision,'starts_at'=>$m->starts_at,'ends_at'=>$m->ends_at,'location'=>$locations[$m->location_id]??null,'status'=>$m->status,'started_at'=>$m->started_at,'completed_at'=>$m->completed_at,'outcome_code'=>$m->outcome_code,'outcome_published'=>(bool)$m->outcome_published];
            foreach (['buyer','exhibitor'] as $party) {
                $p=$people[$m->{$party.'_id'}]; $profile=B2BProfiles::open($p->profile);
                $a=($attendance[$m->id]??collect())->first(fn($a)=>$a->participant_id===$p->id && $a->booking_revision===$m->booking_revision);
                $out[$party]=['id'=>$p->id,'name'=>$profile['name_en'],'name_ar'=>$profile['name_ar'],'attendance'=>$a?['status'=>$a->status,'recorded_at'=>$a->recorded_at,'recorded_by'=>$a->recorded_by,'source'=>$a->source]:null];
            }
            return $out;
        });
        $approved=DB::table('b2b_hosted_participations')->where('status','approved')->whereIn('participant_id',(clone $participants)->where('kind','buyer')->select('id'));
        $hostedStats=app(\App\Services\PermissionPolicy::class)->allows('b2b.hosted.view',$u)?['hosted_approved'=>(clone $approved)->count(),'hosted_arrived'=>(clone $approved)->whereIn('participant_id',DB::table('b2b_arrivals')->select('participant_id'))->count()]:[];
        return [...$hostedStats,'data'=>$data,'day'=>$day,'timezone'=>$timezone,'counts'=>$counts,'last_page'=>$rows->lastPage(),'total'=>$rows->total()];
    }

    public function command(Request $r, string $action, int $id): array
    {
        abort_if(strlen($r->getContent())>16384,413);
        try { match ($action) {
            'hosted'=>$this->operations->hosted($id,$r->all(),$r->user()),
            'benefit'=>$this->operations->benefit($id,$r->all(),$r->user()),
            'arrival'=>$this->operations->participantArrival($id,$r->all(),$r->user()),
            'meeting'=>$this->operations->meeting($id,$r->all(),$r->user()),
            default=>abort(404),
        }; } catch (\Illuminate\Database\QueryException $e) {
            if (($e->errorInfo[1]??null)===1062) { abort(409,'An operation with this relationship or request key already exists.'); }
            throw $e;
        }
        return ['ok'=>true];
    }
}
