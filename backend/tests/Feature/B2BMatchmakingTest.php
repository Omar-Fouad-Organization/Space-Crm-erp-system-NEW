<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\{B2BMatching,B2BProfiles,CrmService};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class B2BMatchmakingTest extends TestCase
{
    use RefreshDatabase;
    private User $admin;
    private int $event;
    private int $deal;
    private int $category;

    protected function setUp(): void
    {
        parent::setUp(); config(['authorization.enabled'=>true,'intake.enabled'=>true,'b2b.enabled'=>true]);
        $this->admin=User::factory()->create(['role'=>'super_admin','status'=>'active']); $this->actingAs($this->admin);
        $crm=app(CrmService::class);
        $e=$crm->save('exhibitions',['name'=>'Synthetic B2B','start_date'=>'2027-01-01','end_date'=>'2027-01-03','location'=>'Test','currency'=>'EGP','status'=>'planning'],$this->admin); $this->event=$e['id'];
        $c=$crm->save('clients',['name'=>'Synthetic supplier','contact_person'=>'Test','email'=>'supply@example.test','type'=>'exhibitor','status'=>'prospect'],$this->admin);
        $b=$crm->save('booths',['name'=>'Synthetic booth','exhibition_id'=>$this->event,'size_sqm'=>'9','price'=>'1000','currency'=>'EGP','status'=>'available'],$this->admin);
        $d=$crm->save('deals',['name'=>'Synthetic participation','client_id'=>$c['id'],'exhibition_id'=>$this->event,'type'=>'booth','booth_id'=>$b['id'],'salesperson_id'=>$this->admin->id,'amount'=>'1000','currency'=>'EGP','status'=>'closed_won','commission_percentage'=>'0'],$this->admin); $this->deal=$d['id'];
        $this->category=$this->postJson('/api/b2b/category',['exhibition_id'=>$this->event,'code'=>'organic','name_en'=>'Organic','name_ar'=>'عضوي'])->assertOk()->json('id');
        $this->postJson('/api/b2b/program',['exhibition_id'=>$this->event,'version'=>0,'timezone'=>'Africa/Cairo','dates_approved'=>true,'meeting_dates'=>['2027-01-01'],'duration'=>30,'weights'=>[35,20,15,10,10,10],'bands'=>[80,65]])->assertOk();
    }

    private function profile(): array
    {
        return ['name_en'=>'Synthetic business','name_ar'=>'شركة تجريبية','categories'=>[$this->category],'products'=>[['name_en'=>'Organic herbs','name_ar'=>'أعشاب عضوية']],'required_products'=>['herbs'],'preferred_origins'=>['Egypt'],'origin'=>'Egypt','capacity_verified'=>true,'capacity_evidence'=>'Synthetic reviewed capacity','quantity'=>20,'capacity'=>100,'unit'=>'kg','required_certifications'=>['Organic'],'certifications'=>[['name'=>'Organic','verified'=>true,'evidence'=>'Synthetic certificate reference']],'meeting_interests'=>['retail'],'industry'=>'Food','classification'=>'Importer'];
    }

    private function exhibitor(): int
    {
        return $this->postJson('/api/b2b/enroll',['exhibition_id'=>$this->event,'kind'=>'exhibitor','source_id'=>$this->deal,'consent_evidence'=>'Synthetic staff verified consent','commercial_evidence'=>'Reviewed closed-won contract reference','profile'=>$this->profile()])->assertOk()->json('id');
    }

    private function buyer(string $status='verified',string $type='buyer'): int
    {
        $org=DB::table('buyer_organizations')->insertGetId(['name'=>'Synthetic buyer organization','country'=>'Japan','created_by'=>$this->admin->id,'created_at'=>now(),'updated_at'=>now()]);
        $id=DB::table('intake_submissions')->insertGetId(['source_id'=>\Illuminate\Support\Str::uuid(),'source_system'=>'test','site'=>'test','source_form'=>'buyer','type'=>$type,'exhibition_id'=>$this->event,'historical'=>false,'original_payload'=>B2BProfiles::seal([]),'source_hash'=>str_repeat('a',64),'name'=>'Synthetic buyer','email'=>'buyer@example.test','country'=>'Japan','language'=>'en','interests'=>'[]','submitted_at'=>now(),'status'=>$status,'assigned_user_id'=>$this->admin->id,'buyer_organization_id'=>$org,'created_at'=>now(),'updated_at'=>now()]);
        return $id;
    }

    public function test_standard_networking_requires_reviewed_closed_won_participation_and_is_separate_from_qualification(): void
    {
        DB::table('deals')->where('id',$this->deal)->update(['status'=>'talking']);
        $body=['exhibition_id'=>$this->event,'kind'=>'exhibitor','source_id'=>$this->deal,'consent_evidence'=>'Test consent','commercial_evidence'=>'Reviewed','profile'=>$this->profile()];
        $this->postJson('/api/b2b/enroll',$body)->assertStatus(422);
        DB::table('deals')->where('id',$this->deal)->update(['status'=>'closed_won']); $id=$this->exhibitor();
        $this->assertDatabaseHas('b2b_participants',['id'=>$id,'qualification'=>'standard','approved_profile_version'=>null]);
        $this->postJson('/api/b2b/concierge/'.$id,['active'=>true,'evidence'=>'Paid premium package'])->assertStatus(422);
        $this->postJson('/api/b2b/enroll',$body)->assertStatus(409);
        $this->postJson('/api/b2b/category',['exhibition_id'=>$this->event,'code'=>'organic','name_en'=>'Duplicate','name_ar'=>'مكرر'])->assertStatus(409);
        $this->getJson('/api/b2b?exhibition_id='.$this->event.'&section=overview')->assertJsonPath('counts.standard_networking',1)->assertJsonPath('counts.qualified_exhibitors',0);
    }

    public function test_visitors_and_unreviewed_buyers_are_not_curated_buyers(): void
    {
        foreach ([['submitted','buyer'],['registered','visitor'],['rejected','buyer']] as [$status,$type]) {
            $this->postJson('/api/b2b/enroll',['exhibition_id'=>$this->event,'kind'=>'buyer','source_id'=>$this->buyer($status,$type),'consent_evidence'=>'Test','profile'=>$this->profile()])->assertStatus(422);
        }
        $source=$this->buyer();
        $this->postJson('/api/b2b/enroll',['exhibition_id'=>$this->event,'kind'=>'buyer','source_id'=>$source,'consent_evidence'=>'Test','profile'=>$this->profile()])->assertOk();
        $second=$this->buyer(); DB::table('intake_submissions')->where('id',$second)->update(['buyer_organization_id'=>DB::table('intake_submissions')->where('id',$source)->value('buyer_organization_id')]);
        $this->postJson('/api/b2b/enroll',['exhibition_id'=>$this->event,'kind'=>'buyer','source_id'=>$second,'consent_evidence'=>'Test','profile'=>$this->profile()])->assertStatus(409);
    }

    public function test_scores_are_explainable_and_required_unknown_information_blocks_a_high_score(): void
    {
        $p=$this->profile(); $match=app(B2BMatching::class)->compare($p,$p);
        $this->assertSame(100,$match['score']); $this->assertSame([],$match['blockers']);
        $offer=$p; $offer['capacity_verified']=false; $offer['certifications'][0]['verified']=false;
        $match=app(B2BMatching::class)->compare($p,$offer); $this->assertSame(75,$match['score']); $this->assertCount(2,$match['blockers']);
    }

    private function qualified(): int
    {
        $id=$this->exhibitor();
        $review=$this->postJson('/api/b2b/review/'.$id,['version'=>1,'scores'=>[35,20,15,10,10,10],'evidence'=>array_fill(0,6,'Synthetic independently reviewed criterion'),'reason'=>'Synthetic review'])->assertOk()->json('id');
        $this->assertDatabaseHas('b2b_participants',['id'=>$id,'qualification'=>'standard']);
        $this->postJson('/api/b2b/decision/'.$id,['version'=>2,'review_id'=>$review,'decision'=>'approved','reason'=>'Manager reviewed all evidence'])->assertOk(); return $id;
    }

    public function test_full_staff_introduction_and_scheduling_cycle_preserves_commercial_records(): void
    {
        $before=(array)DB::table('deals')->find($this->deal); $exhibitor=$this->qualified();
        $buyer=$this->postJson('/api/b2b/enroll',['exhibition_id'=>$this->event,'kind'=>'buyer','source_id'=>$this->buyer(),'consent_evidence'=>'Synthetic buyer consent','profile'=>$this->profile()])->assertOk()->json('id');
        $this->postJson('/api/b2b/generate',['exhibition_id'=>$this->event])->assertJsonPath('created',1);
        $this->postJson('/api/b2b/generate',['exhibition_id'=>$this->event])->assertJsonPath('created',0);
        $m=DB::table('b2b_matches')->first(); $this->assertSame('suggested',$m->status); $this->assertSame(0,DB::table('b2b_meetings')->count());
        $reps=[];
        foreach ([$buyer,$exhibitor] as $p) { $reps[]=$this->postJson('/api/b2b/representative/'.$p,['name'=>'Synthetic person '.$p,'evidence'=>'Authority and attendance consent reviewed'])->assertOk()->json(); }
        $location=$this->postJson('/api/b2b/location',['exhibition_id'=>$this->event,'name'=>'Synthetic table'])->assertOk()->json('id');
        foreach ([[],['person_id'=>$reps[0]['person_id']],['person_id'=>$reps[1]['person_id']],['location_id'=>$location]] as $resource) { $this->postJson('/api/b2b/window',[...$resource,'exhibition_id'=>$this->event,'available'=>true,'starts_at'=>'2027-01-01T08:00:00+00:00','ends_at'=>'2027-01-01T16:00:00+00:00'])->assertOk(); }
        $booking=['match_id'=>$m->id,'buyer_representative_id'=>$reps[0]['id'],'exhibitor_representative_id'=>$reps[1]['id'],'location_id'=>$location,'starts_at'=>'2027-01-01T10:00:00+00:00','reason'=>'Synthetic meeting coordination'];
        $this->postJson('/api/b2b/schedule',$booking)->assertStatus(422);
        foreach ([['review',1],['approve',2],['invite',3]] as [$action,$version]) { $this->postJson('/api/b2b/transition/'.$m->id,['action'=>$action,'version'=>$version,'reason'=>'Reviewed introduction','expires_at'=>'2026-12-20T12:00:00+00:00'])->assertOk(); }
        $this->postJson('/api/b2b/transition/'.$m->id,['action'=>'accept','version'=>4,'party'=>'buyer','channel'=>'phone','evidence'=>'Synthetic call reference B','reason'=>'Staff independently verified buyer interest'])->assertOk();
        $this->postJson('/api/b2b/schedule',$booking)->assertStatus(422);
        $this->postJson('/api/b2b/transition/'.$m->id,['action'=>'accept','version'=>5,'party'=>'exhibitor','channel'=>'email_document','evidence'=>'Synthetic email reference E','reason'=>'Staff independently verified exhibitor interest'])->assertOk();
        $id=$this->postJson('/api/b2b/schedule',$booking)->assertOk()->json('id'); $this->assertSame(18,DB::table('b2b_slots')->count());
        $this->postJson('/api/b2b/schedule',[...$booking,'meeting_id'=>$id,'version'=>1,'starts_at'=>'2027-01-01T11:00:00+00:00'])->assertOk();
        $this->postJson('/api/b2b/meeting/'.$id,['version'=>2,'status'=>'confirmed','reason'=>'Schedule confirmed by coordinator'])->assertOk();
        $this->postJson('/api/b2b/meeting/'.$id,['version'=>3,'status'=>'completed','reason'=>'Future outcome must be rejected'])->assertStatus(422);
        $this->postJson('/api/b2b/meeting/'.$id,['version'=>3,'status'=>'cancelled','reason'=>'Synthetic cancellation'])->assertOk();
        $this->assertSame(0,DB::table('b2b_slots')->count()); $this->assertSame($before,(array)DB::table('deals')->find($this->deal));
        $this->assertSame(0,DB::table('b2b_invitations')->where('communication_status','!=','not_sent')->count());
    }

    public function test_qualification_evidence_permissions_scope_and_feature_gates(): void
    {
        $id=$this->exhibitor();
        $this->postJson('/api/b2b/review/'.$id,['version'=>1,'scores'=>[35,20,15,10,10,10],'evidence'=>array_fill(0,6,null),'reason'=>'Unknown information'])->assertStatus(422);
        $staff=User::factory()->create(['role'=>'operations','status'=>'active','authorization_scoped'=>true,'record_scope'=>'own']); $this->actingAs($staff);
        $this->getJson('/api/b2b?exhibition_id='.$this->event.'&section=profiles')->assertForbidden();
        $this->postJson('/api/b2b/decision/'.$id,['version'=>1,'review_id'=>1,'decision'=>'approved','reason'=>'Unauthorized'])->assertForbidden();
        $this->actingAs($this->admin); config(['b2b.enabled'=>false]);
        $this->getJson('/api/b2b?exhibition_id='.$this->event.'&section=profiles')->assertStatus(503);
    }
}
