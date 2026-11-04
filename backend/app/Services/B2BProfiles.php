<?php

namespace App\Services;

use Illuminate\Support\Facades\{Crypt, DB, Validator};

class B2BProfiles
{
    public function __construct(private B2BAccess $access, private PermissionPolicy $policy) {}

    public static function seal(array $value): string { return Crypt::encryptString(json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE)); }
    public static function open(string $value): array { return json_decode(Crypt::decryptString($value), true, 512, JSON_THROW_ON_ERROR); }

    public function audit(int $event, string $resource, int $id, string $action, $user, array $details): void
    {
        DB::table('b2b_audits')->insert(['exhibition_id'=>$event,'actor_id'=>$user->id,'resource'=>$resource,'record_id'=>$id,'action'=>$action,'details'=>self::seal($details),'created_at'=>now()]);
        // Existing audit architecture receives privacy-safe pointers, never sourcing or acceptance evidence.
        DB::table('audit_logs')->insert(['resource'=>$resource,'record_id'=>$id,'action'=>'b2b_'.$action,'user_id'=>$user->id,'before'=>null,'after'=>json_encode(['exhibition_id'=>$event]),'created_at'=>now()]);
        if (in_array($resource,['b2b_participants','b2b_matches','b2b_meetings'],true)) {
            DB::table('notifications')->insert(['user_id'=>$user->id,'name'=>'B2B coordination updated #'.$id,'resource'=>$resource,'record_id'=>$id,'created_at'=>now(),'updated_at'=>now()]);
        }
    }

    public function profile(array $input, int $event): array
    {
        $v = Validator::make($input, [
            'name_en'=>'required|string|max:255','name_ar'=>'required|string|max:255','description_en'=>'nullable|string|max:4000','description_ar'=>'nullable|string|max:4000',
            'catalogue_evidence'=>'nullable|string|max:2000','origin_evidence'=>'nullable|string|max:2000','requirement_states'=>'sometimes|array:products,origin,capacity,documentation','requirement_states.*'=>'in:unknown,applicable,not_applicable',
            'industry'=>'nullable|string|max:150','classification'=>'nullable|string|max:150','categories'=>'required|array|min:1|max:30','categories.*'=>'required|integer|distinct',
            'products'=>'present|array|max:50','products.*'=>'array:name_en,name_ar,description_en,description_ar',
            'products.*.name_en'=>'required|string|max:255','products.*.name_ar'=>'required|string|max:255',
            'products.*.description_en'=>'nullable|string|max:2000','products.*.description_ar'=>'nullable|string|max:2000',
            'required_products'=>'present|array|max:30','required_products.*'=>'string|max:100',
            'preferred_origins'=>'present|array|max:30','preferred_origins.*'=>'string|max:100','origin'=>'nullable|string|max:100',
            'quantity'=>'nullable|numeric|min:0|max:1000000000000','capacity'=>'nullable|numeric|min:0|max:1000000000000','unit'=>'nullable|string|max:50',
            'capacity_verified'=>'required|boolean','capacity_evidence'=>'nullable|string|max:1000',
            'required_certifications'=>'present|array|max:30','required_certifications.*'=>'string|max:100',
            'certifications'=>'present|array|max:30','certifications.*'=>'array:name,verified,evidence',
            'certifications.*.name'=>'required|string|max:100','certifications.*.verified'=>'required|boolean','certifications.*.evidence'=>'nullable|string|max:1000',
            'meeting_interests'=>'present|array|max:30','meeting_interests.*'=>'string|max:100','procurement_criteria'=>'nullable|string|max:4000',
        ])->validate();
        abort_unless(DB::table('b2b_categories')->where('exhibition_id',$event)->where('active',true)->whereIn('id',$v['categories'])->count()===count($v['categories']),422,'Categories must belong to this exhibition.');
        abort_if($v['capacity_verified'] && empty($v['capacity_evidence']),422,'Verified capacity needs evidence.');
        abort_if((!empty($v['quantity']) || !empty($v['capacity'])) && empty($v['unit']),422,'Quantities and capacity require an explicit unit.');
        foreach ($v['certifications'] as $c) { abort_if($c['verified'] && empty($c['evidence']),422,'Verified certification needs evidence.'); }
        foreach (['products'=>'required_products','origin'=>'preferred_origins','documentation'=>'required_certifications'] as $criterion=>$field) {
            abort_if(($v['requirement_states'][$criterion]??null)==='not_applicable' && !empty($v[$field]),422,'An explicit requirement cannot also be not applicable.');
        }
        abort_if(($v['requirement_states']['capacity']??null)==='not_applicable' && !empty($v['quantity']),422,'A quantity requirement cannot also be not applicable.');
        return $v;
    }

    public function enroll(array $input, $user): int
    {
        $v=Validator::make($input,['exhibition_id'=>'required|integer','kind'=>'required|in:buyer,exhibitor','source_id'=>'required|integer','consent_evidence'=>'required|string|max:2000','commercial_evidence'=>'nullable|string|max:2000','profile'=>'required|array'])->validate();
        $this->access->authorize($v['kind']==='buyer'?'buyers.manage':'participations.confirm',$user);
        $this->access->event($v['exhibition_id'],$user);
        return DB::transaction(function () use ($v,$user) {
            $data=['exhibition_id'=>$v['exhibition_id'],'kind'=>$v['kind'],'created_by'=>$user->id,'assigned_user_id'=>$user->id,'consent_evidence'=>self::seal(['reference'=>$v['consent_evidence'],'reviewer'=>$user->id,'at'=>now()->toIso8601String()]),'created_at'=>now(),'updated_at'=>now()];
            if ($v['kind']==='buyer') {
                app(IntakeAccess::class)->authorize('buyers.view',$user);
                $s=app(IntakeAccess::class)->record($v['source_id'],$user,true);
                abort_unless($s->type==='buyer' && $s->status==='verified' && $s->buyer_organization_id && !$s->withdrawn_at && !$s->redacted_at && $s->exhibition_id==$v['exhibition_id'],422,'Only verified, current buyer applications may participate.');
                $data+=['intake_submission_id'=>$s->id,'buyer_organization_id'=>$s->buyer_organization_id];
            } else {
                app(RecordAccess::class)->check('deals',$v['source_id'],$user);
                $d=DB::table('deals')->where('id',$v['source_id'])->lockForUpdate()->first();
                abort_unless($d && $d->type==='booth' && $d->status==='closed_won' && $d->exhibition_id==$v['exhibition_id'] && !empty($v['commercial_evidence']),422,'A closed-won booth deal and reviewed commercial evidence are required.');
                $data+=['deal_id'=>$d->id,'client_id'=>$d->client_id,'commercial_evidence'=>self::seal(['reference'=>$v['commercial_evidence'],'reviewer'=>$user->id,'at'=>now()->toIso8601String()])];
            }
            $data['profile']=self::seal($this->profile($v['profile'],$v['exhibition_id']));
            $duplicate=DB::table('b2b_participants')->where('exhibition_id',$v['exhibition_id'])->where($v['kind']==='buyer'?'buyer_organization_id':'client_id',$data[$v['kind']==='buyer'?'buyer_organization_id':'client_id'])->exists();
            abort_if($duplicate,409,'This participant is already enrolled.');
            $id=DB::table('b2b_participants')->insertGetId($data);
            $this->audit($v['exhibition_id'],'b2b_participants',$id,'enroll',$user,['kind'=>$v['kind']]); return $id;
        },3);
    }

    public function update(int $id, array $input, $user): void
    {
        $this->access->authorize('profiles.manage',$user);
        $v=Validator::make($input,['version'=>'required|integer','profile'=>'required|array','status'=>'required|in:active,withdrawn','reason'=>'required|string|max:2000'])->validate();
        DB::transaction(function () use ($id,$v,$user) {
            $p=$this->access->participant($id,$user,true);
            if ($p->kind==='buyer') { $this->access->authorize('buyers.manage',$user); }
            abort_unless($p->version==$v['version'],409,'Profile changed. Refresh before saving.');
            // Reactivation requires a fresh enrolment review; withdrawn consent cannot be silently restored.
            abort_if($p->status==='withdrawn' && $v['status']==='active',422,'Withdrawn participation cannot be reactivated by profile editing.');
            DB::table('b2b_participants')->where('id',$id)->update(['profile'=>self::seal($this->profile($v['profile'],$p->exhibition_id)),'status'=>$v['status'],'profile_version'=>$p->profile_version+1,'version'=>$p->version+1,'qualification'=>'standard','approved_profile_version'=>null,'updated_at'=>now()]);
            $this->audit($p->exhibition_id,'b2b_participants',$id,'profile',$user,['reason'=>$v['reason'],'before_profile'=>self::open($p->profile),'after_profile'=>self::open(DB::table('b2b_participants')->where('id',$id)->value('profile')),'before_status'=>$p->status,'after_status'=>$v['status']]);
        },3);
    }

    public function review(int $id, array $input, $user): int
    {
        $this->access->authorize('qualifications.review',$user);
        $v=Validator::make($input,['version'=>'required|integer','scores'=>'required|array|size:6','scores.*'=>'nullable|integer|min:0|max:100','evidence'=>'required|array|size:6','evidence.*'=>'nullable|string|max:2000','reason'=>'required|string|max:2000'])->validate();
        return DB::transaction(function () use ($id,$v,$user) {
            $p=$this->access->participant($id,$user,true);
            abort_unless($p->kind==='exhibitor' && $this->access->eligible($p,false,true),422,'Confirmed active exhibitor required.');
            abort_unless($p->version==$v['version'],409);
            $program=DB::table('b2b_programs')->where('exhibition_id',$p->exhibition_id)->first();
            $weights=$program?json_decode($program->weights,true):config('b2b.weights'); $bands=$program?json_decode($program->bands,true):config('b2b.bands');
            foreach (array_values($v['scores']) as $i=>$score) { abort_if($score!==null && ($score>$weights[$i] || ($score>0 && empty(array_values($v['evidence'])[$i]))),422,'Points require verified criterion evidence and cannot exceed its weight.'); }
            $total=array_sum($v['scores']);
            $review=DB::table('b2b_qualifications')->insertGetId(['participant_id'=>$id,'profile_version'=>$p->profile_version,'scores'=>json_encode(array_values($v['scores'])),'evidence'=>self::seal(['criteria'=>array_values($v['evidence']),'reason'=>$v['reason']]),'total'=>$total,'recommendation'=>$total>=$bands[0]?'high_priority':($total>=$bands[1]?'conditional_review':'preparation'),'reviewed_by'=>$user->id,'created_at'=>now(),'updated_at'=>now()]);
            DB::table('b2b_participants')->where('id',$id)->update(['version'=>$p->version+1]);
            $this->audit($p->exhibition_id,'b2b_participants',$id,'qualification_review',$user,['review_id'=>$review,'total'=>$total]); return $review;
        },3);
    }

    public function decide(int $id, array $input, $user): void
    {
        $this->access->authorize('qualifications.approve',$user);
        $v=Validator::make($input,['review_id'=>'required|integer','version'=>'required|integer','decision'=>'required|in:approved,rejected','reason'=>'required|string|max:2000'])->validate();
        DB::transaction(function () use ($id,$v,$user) {
            $p=$this->access->participant($id,$user,true);
            abort_unless($p->kind==='exhibitor' && $this->access->eligible($p,false,true),422);
            abort_unless($p->version==$v['version'],409);
            $review=DB::table('b2b_qualifications')->where('id',$v['review_id'])->where('participant_id',$id)->lockForUpdate()->first();
            abort_unless($review && $review->decision==='pending' && $review->profile_version==$p->profile_version,422,'Review must be current and undecided.');
            DB::table('b2b_qualifications')->where('id',$review->id)->update(['decision'=>$v['decision'],'reason'=>self::seal(['reason'=>$v['reason']]),'approved_by'=>$user->id,'updated_at'=>now()]);
            DB::table('b2b_participants')->where('id',$id)->update(['qualification'=>$v['decision'],'approved_profile_version'=>$v['decision']==='approved'?$p->profile_version:null,'version'=>$p->version+1,'updated_at'=>now()]);
            $this->audit($p->exhibition_id,'b2b_participants',$id,'qualification_decision',$user,['decision'=>$v['decision'],'reason'=>$v['reason'],'review_id'=>$review->id]);
        },3);
    }
}
