<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\{B2BProfiles,B2BScheduler,B2BWorkflow,PermissionPolicy};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\B2BFixture;
use Tests\TestCase;

class B2BSecurityTest extends TestCase
{
    use RefreshDatabase;

    private function staff(array $f,array $permissions,string $scope='all',bool $membership=true): User
    {
        $u=User::factory()->create(['role'=>'support','status'=>'active','authorization_scoped'=>true,'record_scope'=>$scope]);
        if ($membership) { DB::table('exhibition_user')->insert(['exhibition_id'=>$f['event'],'user_id'=>$u->id,'granted_by'=>$f['user']->id]); }
        foreach ($permissions as $p) { DB::table('user_permission_overrides')->insert(['user_id'=>$u->id,'permission'=>'b2b.'.$p,'allowed'=>true,'granted_by'=>$f['user']->id]); }
        return $u;
    }

    public function test_actions_event_record_scope_fields_and_exports_are_independent(): void
    {
        $f=B2BFixture::create(); $u=$this->staff($f,['view','matches.view','meetings.view','export']); $this->actingAs($u);
        $url='/api/b2b?exhibition_id='.$f['event'].'&section=';
        // A match grant without buyer sourcing visibility is insufficient.
        $this->getJson($url.'matches')->assertForbidden();
        $this->getJson($url.'profiles')->assertOk()->assertJsonPath('total',2)->assertJsonMissing(['kind'=>'buyer']);
        $this->getJson('/api/b2b/participants/'.$f['participants'][0][0])->assertNotFound();
        $this->getJson('/api/b2b/sources?exhibition_id='.$f['event'].'&kind=exhibitor')->assertForbidden();
        $this->postJson('/api/b2b/decision/'.$f['participants'][0][1],['review_id'=>1,'version'=>3,'decision'=>'approved','reason'=>'Unauthorized'])->assertForbidden();
        $this->getJson('/api/b2b/export?exhibition_id='.$f['event'].'&section=profiles')->assertOk()->assertJsonPath('total',2)->assertJsonMissing(['kind'=>'buyer']);
        $private=$this->getJson('/api/b2b/participants/'.$f['participants'][0][1])->assertOk()->json('participant');
        $this->assertArrayNotHasKey('consent_evidence',$private); $this->assertArrayNotHasKey('commercial_evidence',$private);
        $u=$this->staff($f,['view','buyers.view','matches.view','meetings.view','export'],'own'); $this->actingAs($u);
        $this->getJson($url.'profiles')->assertOk()->assertJsonPath('total',0);
        $this->getJson($url.'matches')->assertOk()->assertJsonPath('total',0);
        $this->getJson('/api/b2b/export?exhibition_id='.$f['event'].'&section=scheduler')->assertOk()->assertJsonPath('total',0);
        $u=$this->staff($f,['view','buyers.view','matches.view','meetings.view','export'],'all',false); $this->actingAs($u);
        $u->authorization_scoped=false; $u->save();
        foreach (['overview','profiles','matches','scheduler','results'] as $section) { $this->getJson($url.$section)->assertNotFound(); }
        $this->getJson('/api/b2b/export?exhibition_id='.$f['event'].'&section=profiles')->assertNotFound();
    }

    public function test_results_fields_require_results_authority_even_for_null_or_followup_only_updates(): void
    {
        $f=B2BFixture::create(); $id=app(B2BScheduler::class)->schedule(B2BFixture::booking($f,0),$f['user']);
        $u=$this->staff($f,['view','buyers.view','meetings.view','meetings.manage']); $this->actingAs($u);
        foreach ([['result'=>null],['followup_due'=>'2027-01-02'],['followup_status'=>'completed'],['followup_user_id'=>null]] as $fields) {
            $this->postJson('/api/b2b/meeting/'.$id,[...$fields,'version'=>1,'status'=>'confirmed','reason'=>'Field injection'])->assertForbidden();
        }
        $data=$this->getJson('/api/b2b?exhibition_id='.$f['event'].'&section=scheduler')->assertOk()->json('data.0');
        $this->getJson('/api/b2b?exhibition_id='.$f['event'].'&section=overview')->assertOk()->assertJsonMissingPath('pending_coordination');
        foreach (['result','followup_user_id','followup_due','followup_status'] as $key) { $this->assertArrayNotHasKey($key,$data); }
        $this->postJson('/api/b2b/meeting/'.$id,['version'=>1,'status'=>'confirmed','reason'=>'Authorized coordination'])->assertOk();
        $this->assertFalse(app(PermissionPolicy::class)->allows('finance.view',$u));
        $this->assertFalse(app(PermissionPolicy::class)->allows('users.manage',$u));
    }

    public function test_withdrawal_blocks_booking_and_reporting_but_never_blocks_recording_a_decline(): void
    {
        $f=B2BFixture::create(); $this->actingAs($f['user']); $booking=B2BFixture::booking($f,0); $id=app(B2BScheduler::class)->schedule($booking,$f['user']);
        $p=DB::table('b2b_participants')->find($f['participants'][0][0]);
        DB::table('intake_submissions')->where('id',$p->intake_submission_id)->update(['status'=>'withdrawn','withdrawn_at'=>now()]);
        DB::table('b2b_invitations')->where('match_id',$booking['match_id'])->update(['expires_at'=>now()->subDay()]);
        $this->postJson('/api/b2b/schedule',[...$booking,'meeting_id'=>$id,'version'=>1,'starts_at'=>'2027-01-01T11:00:00+00:00'])->assertStatus(422);
        $this->getJson('/api/b2b?exhibition_id='.$f['event'].'&section=overview')->assertOk()->assertJsonFragment(['status'=>'eligibility_hold','count'=>1]);
        $this->postJson('/api/b2b/transition/'.$booking['match_id'],['action'=>'decline','version'=>6,'party'=>'buyer','channel'=>'phone','evidence'=>'Staff verified withdrawal','reason'=>'Consent withdrawn'])->assertOk();
        $this->assertDatabaseHas('b2b_meetings',['id'=>$id,'status'=>'cancelled']); $this->assertSame(0,DB::table('b2b_slots')->count());
        $this->postJson('/api/b2b/generate',['exhibition_id'=>$f['event']])->assertOk();
        $this->assertDatabaseHas('b2b_matches',['id'=>$booking['match_id'],'status'=>'declined']);
    }

    public function test_breaks_wrong_event_stale_profiles_and_unapproved_dates_reject_scheduling(): void
    {
        $f=B2BFixture::create(); $this->actingAs($f['user']); $booking=B2BFixture::booking($f,0);
        $this->postJson('/api/b2b/window',['exhibition_id'=>$f['event'],'available'=>false,'starts_at'=>'2027-01-01T10:00:00+00:00','ends_at'=>'2027-01-01T10:30:00+00:00'])->assertOk();
        $this->postJson('/api/b2b/schedule',$booking)->assertStatus(422);
        $break=DB::table('b2b_windows')->where('available',false)->first();
        $revision=['id'=>$break->id,'version'=>1,'active'=>false,'exhibition_id'=>$f['event'],'available'=>false,'starts_at'=>'2027-01-01T10:00:00+00:00','ends_at'=>'2027-01-01T10:30:00+00:00'];
        $this->postJson('/api/b2b/window',$revision)->assertOk();
        $this->postJson('/api/b2b/window',$revision)->assertStatus(409);
        $this->assertDatabaseHas('b2b_windows',['id'=>$break->id,'active'=>false,'version'=>2]);
        DB::table('b2b_programs')->where('exhibition_id',$f['event'])->update(['dates_approved'=>false]);
        $this->postJson('/api/b2b/schedule',$booking)->assertStatus(422);
        DB::table('b2b_programs')->where('exhibition_id',$f['event'])->update(['dates_approved'=>true]);
        $p=DB::table('b2b_participants')->find($f['participants'][0][1]);
        $this->postJson('/api/b2b/profile/'.$p->id,['version'=>$p->version,'profile'=>B2BProfiles::open($p->profile),'status'=>'active','reason'=>'Documented offer update'])->assertOk();
        $this->postJson('/api/b2b/schedule',$booking)->assertStatus(422);
        $this->postJson('/api/b2b/transition/'.$booking['match_id'],['version'=>6,'action'=>'reconsider','reason'=>'New offer and interest reviewed','evidence'=>'New verified interest'])->assertOk();
        $this->postJson('/api/b2b/generate',['exhibition_id'=>$f['event']])->assertOk();
        $this->assertDatabaseHas('b2b_participants',['id'=>$p->id,'qualification'=>'standard']);
    }

    public function test_realistic_completion_records_outcome_without_touching_finance(): void
    {
        $f=B2BFixture::create(); $this->actingAs($f['user']); $before=DB::table('deals')->orderBy('id')->get()->toJson();
        $id=app(B2BScheduler::class)->schedule(B2BFixture::booking($f,0),$f['user']);
        $this->postJson('/api/b2b/meeting/'.$id,['version'=>1,'status'=>'confirmed','reason'=>'Synthetic coordinator verified time'])->assertOk();
        $this->travelTo(\Carbon\Carbon::parse('2027-01-01T10:00:00Z'));
        $this->postJson('/api/b2b/meeting/'.$id,['version'=>2,'status'=>'in_progress','reason'=>'Synthetic attendance observed'])->assertOk();
        $this->postJson('/api/b2b/meeting/'.$id,['version'=>3,'status'=>'completed','reason'=>'Synthetic meeting ended','result'=>'Both parties requested a catalogue follow-up; no sales contract','followup_user_id'=>$f['user']->id,'followup_due'=>'2027-01-02','followup_status'=>'pending'])->assertOk();
        $this->getJson('/api/b2b?exhibition_id='.$f['event'].'&section=results')->assertOk()->assertJsonPath('data.0.result','Both parties requested a catalogue follow-up; no sales contract');
        $this->assertSame($before,DB::table('deals')->orderBy('id')->get()->toJson());
        $this->travelBack();
    }

    public function test_rule_upgrade_holds_active_legacy_matches_without_rewriting_history(): void
    {
        $f=B2BFixture::create(); $this->actingAs($f['user']); $booking=B2BFixture::booking($f,0);
        $id=app(B2BScheduler::class)->schedule($booking,$f['user']);
        DB::table('b2b_matches')->where('id',$booking['match_id'])->update(['rule_version'=>'1']);
        $before=DB::table('b2b_matches')->find($booking['match_id']);
        $suggested=DB::table('b2b_matches')->where('status','suggested')->first();
        DB::table('b2b_matches')->where('id',$suggested->id)->update(['rule_version'=>'1','score'=>91,'explanation'=>json_encode(['rule_version'=>'1','score'=>91,'factors'=>['historical'=>'preserve']])]);
        $evidence=DB::table('b2b_invitations')->where('match_id',$before->id)->get()->toJson();
        $this->postJson('/api/b2b/schedule',[...$booking,'meeting_id'=>$id,'version'=>1])->assertStatus(409);
        $this->getJson('/api/b2b?exhibition_id='.$f['event'].'&section=scheduler')->assertOk()->assertJsonPath('data.0.eligibility_hold',true);
        $this->postJson('/api/b2b/generate',['exhibition_id'=>$f['event']])->assertOk();
        $this->assertSame((array)$before,(array)DB::table('b2b_matches')->find($before->id));
        $this->assertSame($evidence,DB::table('b2b_invitations')->where('match_id',$before->id)->get()->toJson());
        $audit=DB::table('b2b_audits')->where('resource','b2b_matches')->where('record_id',$suggested->id)->where('action','recommendation')->orderByDesc('id')->first();
        $history=B2BProfiles::open($audit->details);
        $this->assertSame(91,$history['before']['score']); $this->assertSame('1',$history['before']['rule_version']);
        $this->assertSame(['historical'=>'preserve'],$history['before']['explanation']['factors']); $this->assertSame('2',$history['after']['rule_version']);
        $this->assertDatabaseHas('b2b_meetings',['id'=>$id,'status'=>'scheduled','version'=>1]);
    }

    public function test_recalculation_never_reactivates_an_eligible_declined_pair(): void
    {
        $f=B2BFixture::create(); $this->actingAs($f['user']); $id=$f['matches'][0];
        $this->postJson('/api/b2b/transition/'.$id,['action'=>'decline','version'=>6,'party'=>'buyer','channel'=>'phone','evidence'=>'Synthetic independently verified decline','reason'=>'Buyer declines this introduction'])->assertOk();
        $before=(array)DB::table('b2b_matches')->find($id);
        $this->postJson('/api/b2b/generate',['exhibition_id'=>$f['event']])->assertOk();
        $this->assertSame($before,(array)DB::table('b2b_matches')->find($id));
        $this->assertSame(2,DB::table('b2b_invitations')->where('match_id',$id)->count());
        $this->assertSame(0,DB::table('b2b_meetings')->count());
    }
}
