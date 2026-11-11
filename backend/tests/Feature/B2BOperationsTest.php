<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\{B2BOperations,B2BProfiles,B2BScheduler,ParticipantAuthority};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\B2BFixture;
use Tests\TestCase;

class B2BOperationsTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(): array
    {
        $this->travelTo(\Carbon\CarbonImmutable::parse('2026-11-09T10:00:00Z'));
        $f=B2BFixture::create(); config(['b2b.onsite_enabled'=>true,'participant_portal.enabled'=>true]);
        $this->actingAs($f['user']); return $f;
    }

    private function context(array $f, int $participant): array
    {
        $identity=(string)Str::uuid(); $id=(string)Str::uuid();
        DB::table('portal_identity_controls')->insert(['identity_id'=>$identity,'reviewed_by'=>$f['user']->id]);
        DB::table('portal_memberships')->insert(['id'=>$id,'identity_id'=>$identity,'participant_id'=>$participant,'exhibition_id'=>$f['event'],'role'=>'owner','capabilities'=>json_encode(ParticipantAuthority::ROLES['owner']),'status'=>'active','approval_evidence'=>B2BProfiles::seal(['reference'=>'SYNTHETIC authority']),'reviewed_by'=>$f['user']->id]);
        return ['identity_id'=>$identity,'membership_id'=>$id,'exhibition_id'=>$f['event'],'operation'=>'overview','payload'=>[],'authentication'=>['device_id'=>(string)Str::uuid(),'auth_version'=>1]];
    }

    private function command(int $meeting, string $action, array $extra=[]): \Illuminate\Testing\TestResponse
    {
        $m=DB::table('b2b_meetings')->find($meeting);
        return $this->postJson('/api/b2b/operations/meeting/'.$meeting,['version'=>$m->version,'booking_revision'=>$m->booking_revision,'action'=>$action,'reason'=>'SYNTHETIC internal operations note',...$extra]);
    }

    public function test_hosted_decision_does_not_replace_verification_or_grant_financial_authority(): void
    {
        $f=$this->fixture(); $buyer=$f['participants'][0][0]; $context=$this->context($f,$buyer);
        $before=DB::table('b2b_participants')->find($buyer); $intake=DB::table('intake_submissions')->find($before->intake_submission_id);
        $url='/api/b2b/operations/hosted/'.$buyer;
        config(['b2b.onsite_enabled'=>false]);
        $this->postJson($url,['action'=>'nominate','version'=>0,'reason'=>'SYNTHETIC disabled'])->assertStatus(503);
        config(['b2b.onsite_enabled'=>true]);
        $this->postJson($url,['action'=>'approve','version'=>0,'reason'=>'SYNTHETIC bypass'])->assertUnprocessable();
        $this->postJson($url,['action'=>'nominate','version'=>0,'reason'=>'SYNTHETIC organizer nomination'])->assertOk();
        $this->postJson($url,['action'=>'approve','version'=>1,'reason'=>'SYNTHETIC organizer approval'])->assertOk();
        $h=DB::table('b2b_hosted_participations')->where('participant_id',$buyer)->first();
        $this->assertSame($f['event'],$h->exhibition_id); $this->assertSame($f['user']->id,$h->decided_by);
        $this->assertSame('verified',DB::table('intake_submissions')->find($intake->id)->status);
        $this->assertSame($before->version,DB::table('b2b_participants')->find($buyer)->version);
        $a=app(ParticipantAuthority::class); $result=$a->execute($context);
        $this->assertSame('approved',$result['participant']['hosted']['status']);
        $this->assertSame([],$result['participant']['hosted']['benefits']);
        $benefit=['request_id'=>(string)Str::uuid(),'classification'=>'SYNTHETIC organizer reception','reason'=>'SYNTHETIC separately approved nonfinancial benefit'];
        $this->postJson('/api/b2b/operations/benefit/'.$buyer,$benefit)->assertOk();
        $this->postJson('/api/b2b/operations/benefit/'.$buyer,$benefit)->assertOk();
        $this->assertDatabaseCount('b2b_hosted_benefits',1);
        $this->assertCount(1,$a->execute($context)['participant']['hosted']['benefits']);
        $this->postJson($url,['action'=>'suspend','version'=>2,'reason'=>'SYNTHETIC suspension'])->assertOk();
        $this->assertSame([],$a->execute($context)['participant']['hosted']['benefits']);
        $this->getJson('/api/b2b/operations?section=hosted&exhibition_id='.$f['event'])->assertOk()->assertJsonPath('data.0.hosted.status','suspended')->assertJsonCount(4,'data.0.hosted.history');
        $this->postJson('/api/b2b/operations/arrival/'.$buyer,['reason'=>'SYNTHETIC premature arrival'])->assertUnprocessable();
        $this->travelTo(\Carbon\CarbonImmutable::parse('2027-01-01T10:00:00Z'));
        $this->postJson('/api/b2b/operations/arrival/'.$buyer,['reason'=>'SYNTHETIC organizer event arrival'])->assertOk();
        $this->postJson('/api/b2b/operations/arrival/'.$buyer,['reason'=>'SYNTHETIC repeated event arrival'])->assertOk();
        $this->assertDatabaseCount('b2b_arrivals',1);
        $this->getJson('/api/b2b/operations?section=hosted&exhibition_id='.$f['event'])->assertJsonPath('data.0.arrival.status','arrived');
        foreach ([['approve',3],['cancel',4],['nominate',5],['reject',6],['nominate',7],['approve',8]] as [$action,$version]) {
            $this->postJson($url,compact('action','version')+['reason'=>'SYNTHETIC organizer decision '.$action])->assertOk();
        }
        $this->assertSame('approved',$a->execute($context)['participant']['hosted']['status']);
        $this->assertSame(0,DB::table('payments')->count());
        $this->assertDatabaseCount('deals',2);
        $this->assertSame(ParticipantAuthority::ROLES['owner'],json_decode(DB::table('portal_memberships')->where('id',$context['membership_id'])->value('capabilities'),true));
    }

    public function test_unverified_and_cross_event_or_unprivileged_hosted_approval_is_rejected(): void
    {
        $f=$this->fixture(); $p=DB::table('b2b_participants')->find($f['participants'][0][0]);
        DB::table('intake_submissions')->where('id',$p->intake_submission_id)->update(['status'=>'submitted']);
        $this->postJson('/api/b2b/operations/hosted/'.$p->id,['action'=>'nominate','version'=>0,'reason'=>'SYNTHETIC unverified'])->assertUnprocessable();
        $u=User::factory()->create(['role'=>'operations','status'=>'active','authorization_scoped'=>true,'record_scope'=>'all']);
        DB::table('exhibition_user')->insert(['exhibition_id'=>$f['event'],'user_id'=>$u->id,'granted_by'=>$f['user']->id]);
        foreach (['view','buyers.view','hosted.view','hosted.nominate','onsite.view','onsite.attendance'] as $key) {
            DB::table('user_permission_overrides')->insert(['user_id'=>$u->id,'permission'=>'b2b.'.$key,'allowed'=>true,'granted_by'=>$f['user']->id]);
        }
        $this->actingAs($u)->postJson('/api/b2b/operations/hosted/'.$p->id,['action'=>'approve','version'=>0,'reason'=>'SYNTHETIC unauthorized'])->assertForbidden();
        $this->getJson('/api/b2b/operations?section=hosted&exhibition_id='.$f['event'])->assertOk();
        $meeting=app(B2BScheduler::class)->schedule(B2BFixture::booking($f,1),$f['user']);
        foreach (['start','complete','publish'] as $action) {
            $this->command($meeting,$action,['outcome_code'=>'positive_interest','published'=>true])->assertForbidden();
        }
        DB::table('exhibition_user')->where('user_id',$u->id)->delete();
        $this->app->forgetInstance(\App\Services\PermissionPolicy::class);
        $this->getJson('/api/b2b/operations?section=hosted&exhibition_id='.$f['event'])->assertNotFound();
        $this->postJson('/api/b2b/operations/arrival/'.$p->id,['reason'=>'SYNTHETIC cross-event'])->assertNotFound();
        $this->assertDatabaseCount('b2b_hosted_participations',0);
    }

    public function test_independent_arrival_start_completion_publication_and_private_portal_projection(): void
    {
        $f=$this->fixture(); $id=app(B2BScheduler::class)->schedule(B2BFixture::booking($f,0),$f['user']);
        $buyerContext=$this->context($f,$f['participants'][0][0]); $exhibitorContext=$this->context($f,$f['participants'][0][1]);
        $this->command($id,'start')->assertUnprocessable();
        $this->travelTo(\Carbon\CarbonImmutable::parse('2027-01-01T10:00:00Z'));
        $this->command($id,'arrive',['party'=>'buyer','source'=>'external_qr'])->assertUnprocessable();
        $this->command($id,'arrive',['party'=>'buyer'])->assertOk();
        $this->command($id,'arrive',['party'=>'buyer','version'=>1])->assertOk();
        $this->command($id,'start')->assertUnprocessable();
        $this->assertDatabaseCount('b2b_meeting_attendance',1);
        $this->getJson('/api/b2b/operations?section=meetings&exhibition_id='.$f['event'].'&day=2027-01-01')->assertJsonPath('counts.awaiting',1);
        $this->command($id,'arrive',['party'=>'exhibitor'])->assertOk();
        $this->getJson('/api/b2b/operations?section=meetings&exhibition_id='.$f['event'].'&day=2027-01-01&status=ready')->assertJsonPath('counts.ready',1)->assertJsonCount(1,'data');
        $this->postJson('/api/b2b/meeting/'.$id,['version'=>3,'status'=>'in_progress','reason'=>'SYNTHETIC legacy bypass'])->assertUnprocessable();
        $source=DB::table('b2b_participants')->find($f['participants'][0][0])->intake_submission_id;
        DB::table('intake_submissions')->where('id',$source)->update(['status'=>'submitted']);
        $this->getJson('/api/b2b/operations?section=meetings&exhibition_id='.$f['event'].'&day=2027-01-01')->assertJsonPath('counts.ready',0)->assertJsonPath('counts.eligibility_hold',1);
        $this->command($id,'start')->assertUnprocessable();
        DB::table('intake_submissions')->where('id',$source)->update(['status'=>'verified']);
        $this->command($id,'start')->assertOk();
        $this->command($id,'complete',['outcome_code'=>'followup_required'])->assertOk();
        $this->command($id,'complete',['outcome_code'=>'positive_interest'])->assertUnprocessable();
        $version=DB::table('b2b_meetings')->find($id)->version;
        $this->postJson('/api/b2b/meeting/'.$id,['version'=>$version,'status'=>'completed','reason'=>'SYNTHETIC internal follow-up','result'=>'SYNTHETIC private staff follow-up note'])->assertOk();
        $a=app(ParticipantAuthority::class); $view=$a->execute([...$buyerContext,'operation'=>'meetings']);
        $this->assertNull($view['items'][0]['outcome']);
        $this->command($id,'publish',['published'=>true])->assertOk();
        foreach ([$buyerContext,$exhibitorContext] as $context) {
            $view=$a->execute([...$context,'operation'=>'meetings']); $item=$view['items'][0];
            $this->assertSame('followup_required',$item['outcome']);
            $this->assertSame('arrived',$item['own_attendance']['status']);
            $this->assertSame('staff_manual',$item['own_attendance']['source']);
            foreach (['notes','result','recorded_by','buyer_attendance','exhibitor_attendance'] as $private) { $this->assertArrayNotHasKey($private,$item); }
            $this->assertStringNotContainsString('SYNTHETIC internal operations note',json_encode($item));
        }
        $other=$this->context($f,$f['participants'][1][0]);
        $this->assertCount(0,$a->execute([...$other,'operation'=>'meetings'])['items']);
        $this->assertDatabaseHas('b2b_meetings',['id'=>$id,'status'=>'completed','outcome_published'=>true]);
        $this->assertSame(5,DB::table('b2b_audits')->where('resource','b2b_meetings')->where('record_id',$id)->where('action','like','onsite_%')->count());

        $reader=User::factory()->create(['role'=>'operations','status'=>'active','authorization_scoped'=>true,'record_scope'=>'all']);
        DB::table('exhibition_user')->insert(['exhibition_id'=>$f['event'],'user_id'=>$reader->id,'granted_by'=>$f['user']->id]);
        foreach (['view','buyers.view','meetings.view'] as $permission) {
            DB::table('user_permission_overrides')->insert(['user_id'=>$reader->id,'permission'=>'b2b.'.$permission,'allowed'=>true,'granted_by'=>$f['user']->id]);
        }
        $this->actingAs($reader)->getJson('/api/b2b?section=scheduler&exhibition_id='.$f['event'])->assertOk()
            ->assertJsonPath('data.0.status','completed')->assertJsonMissingPath('data.0.outcome_code')->assertJsonMissingPath('data.0.outcome_published')->assertJsonMissingPath('data.0.result');
        $this->getJson('/api/b2b/operations?section=meetings&exhibition_id='.$f['event'])->assertForbidden();
        $this->assertDatabaseCount('deals',2); $this->assertDatabaseCount('b2b_arrivals',2);
    }

    public function test_no_show_preserves_the_booking_and_does_not_mark_an_arrived_party_absent(): void
    {
        $f=$this->fixture(); $id=app(B2BScheduler::class)->schedule(B2BFixture::booking($f,0),$f['user']);
        $this->travelTo(\Carbon\CarbonImmutable::parse('2027-01-01T10:00:00Z'));
        $this->command($id,'arrive',['party'=>'buyer'])->assertOk();
        $this->command($id,'no_show',['party'=>'both'])->assertUnprocessable();
        $this->command($id,'no_show',['party'=>'exhibitor'])->assertOk();
        $this->assertDatabaseHas('b2b_meeting_attendance',['meeting_id'=>$id,'participant_id'=>$f['participants'][0][1],'status'=>'no_show']);
        $this->assertDatabaseHas('b2b_meetings',['id'=>$id,'status'=>'no_show']);
        $this->assertDatabaseCount('b2b_slots',18);
        $this->command($id,'start')->assertUnprocessable();
    }

    public function test_rescheduling_keeps_request_history_and_invalidates_previous_booking_attendance(): void
    {
        $f=$this->fixture(); $scheduler=app(B2BScheduler::class); $booking=B2BFixture::booking($f,0);
        $id=$scheduler->schedule($booking,$f['user']); $context=$this->context($f,$f['participants'][0][0]);
        $a=app(ParticipantAuthority::class);
        $request=$a->execute([...$context,'operation'=>'request.submit','command_id'=>(string)Str::uuid(),'payload'=>['kind'=>'reschedule','target_id'=>$id,'note'=>'SYNTHETIC approved timing change']]);
        $this->postJson('/api/participant-administration/command',['action'=>'request.review','participant_id'=>$f['participants'][0][0],'payload'=>['id'=>$request['id'],'version'=>1,'status'=>'acknowledged','reason'=>'SYNTHETIC organizer review']])->assertOk();
        $this->travelTo(\Carbon\CarbonImmutable::parse('2027-01-01T09:30:00Z'));
        $this->command($id,'arrive',['party'=>'buyer'])->assertOk();
        $scheduler->schedule([...$booking,'meeting_id'=>$id,'version'=>2,'starts_at'=>'2027-01-01T11:00:00+00:00'],$f['user']);
        $this->assertDatabaseHas('b2b_meetings',['id'=>$id,'booking_revision'=>2,'starts_at'=>'2027-01-01 11:00:00']);
        $this->assertDatabaseHas('b2b_meeting_attendance',['meeting_id'=>$id,'booking_revision'=>1,'status'=>'arrived']);
        $this->command($id,'arrive',['party'=>'buyer','booking_revision'=>1])->assertConflict();
        $view=$a->execute([...$context,'operation'=>'meetings'])['items'][0];
        $this->assertNull($view['own_attendance']); $this->assertTrue($view['rescheduled']);
        $this->postJson('/api/participant-administration/command',['action'=>'request.review','participant_id'=>$f['participants'][0][0],'payload'=>['id'=>$request['id'],'version'=>2,'status'=>'coordinated','reason'=>'SYNTHETIC new booking confirmed']])->assertOk();
        $this->assertDatabaseHas('portal_requests',['id'=>$request['id'],'status'=>'coordinated','version'=>3]);
        $this->assertSame(1,DB::table('b2b_audits')->where('record_id',$id)->where('resource','b2b_meetings')->where('action','reschedule')->count());
    }
}
