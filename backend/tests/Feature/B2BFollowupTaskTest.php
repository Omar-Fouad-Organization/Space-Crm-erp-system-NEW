<?php
namespace Tests\Feature;

use App\Models\User;
use App\Services\{B2BProfiles,CrmService,ParticipantAuthority};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\B2BFollowupFixture;
use Tests\TestCase;

class B2BFollowupTaskTest extends TestCase
{
    use RefreshDatabase;
    private function fixture(): array { $f=B2BFollowupFixture::create(); $this->actingAs($f['user']); return $f; }
    private function url(array $f): string { return '/api/b2b/followup-tasks/'.$f['meeting']; }
    private function snapshots(): array
    {
        $out=[];foreach (['clients','deals','booths','sponsorship_packages','payments','payment_schedules','invoices','commissions','b2b_meetings','b2b_meeting_attendance','buyer_organizations'] as $t) $out[$t]=DB::table($t)->orderBy('id')->get()->toJson(); return $out;
    }
    private function staff(array $f,array $grants,bool $member=true): User
    {
        $u=User::factory()->create(['role'=>'support','status'=>'active','authorization_scoped'=>true,'record_scope'=>'own']);
        if ($member) DB::table('exhibition_user')->insert(['user_id'=>$u->id,'exhibition_id'=>$f['event'],'granted_by'=>$f['user']->id]);
        foreach ($grants as $p=>$allowed) DB::table('user_permission_overrides')->insert(['user_id'=>$u->id,'permission'=>$p,'allowed'=>$allowed,'granted_by'=>$f['user']->id]);
        return $u;
    }

    public function test_explicit_creation_is_idempotent_and_preserves_meeting_and_finances(): void
    {
        $f=$this->fixture(); $before=$this->snapshots();
        $this->assertDatabaseCount('tasks',0); $this->assertNull(DB::table('b2b_participants')->find($f['participants'][0][0])->client_id);
        $this->getJson($this->url($f))->assertOk()->assertJsonPath('assigned_user_id','')->assertJsonPath('due_date',null);
        $r=$this->postJson($this->url($f),$f['input'])->assertOk()->assertJsonPath('created',true)->assertJsonPath('task.status','pending'); $task=$r->json('task.id');
        $this->postJson($this->url($f),$f['input'])->assertOk()->assertJsonPath('created',false)->assertJsonPath('task.id',$task);
        $this->assertDatabaseCount('tasks',1);$this->assertDatabaseCount('b2b_followup_tasks',1);
        $this->assertDatabaseHas('b2b_followup_tasks',['meeting_id'=>$f['meeting'],'task_id'=>$task,'exhibition_id'=>$f['event'],'linked_by'=>$f['user']->id]);
        $this->assertDatabaseHas('tasks',['id'=>$task,'client_id'=>null,'deal_id'=>null,'due_date'=>'2027-01-04']);
        $this->assertSame($before,$this->snapshots());
        $this->assertDatabaseHas('b2b_audits',['resource'=>'b2b_meetings','record_id'=>$f['meeting'],'action'=>'crm_followup_linked']);
    }

    public function test_task_lifecycle_is_read_authoritatively_without_changing_history(): void
    {
        $f=$this->fixture();$id=$this->postJson($this->url($f),$f['input'])->json('task.id');$history=$this->snapshots();
        foreach (['in_progress','completed','cancelled'] as $status) {
            $this->putJson('/api/records/tasks/'.$id,[...$f['input'],'status'=>$status])->assertOk();
            $this->getJson('/api/b2b?section=overview&exhibition_id='.$f['event'])->assertOk()->assertJsonPath('pending_coordination',$status==='in_progress'?1:0);
            $this->getJson('/api/b2b/operations?exhibition_id='.$f['event'].'&section=meetings&day=2027-01-01&meeting_id='.$f['meeting'])->assertOk()->assertJsonPath('data.0.followup_task.status',$status);
        }
        $this->postJson($this->url($f),$f['input'])->assertOk()->assertJsonPath('task.status','cancelled')->assertJsonPath('created',false);
        $this->deleteJson('/api/records/tasks/'.$id)->assertUnprocessable();
        $this->assertDatabaseCount('tasks',1); $this->assertSame($history,$this->snapshots());
        $this->getJson('/api/records/tasks/'.$id)->assertOk()->assertJsonPath('data.b2b_source.meeting_id',$f['meeting']);
    }

    public function test_nonfollowup_stale_and_incomplete_commands_do_not_create_tasks(): void
    {
        $f=$this->fixture();
        foreach (['positive_interest','no_immediate_opportunity','not_interested'] as $outcome) {
            DB::table('b2b_meetings')->where('id',$f['meeting'])->update(['outcome_code'=>$outcome]);
            $this->postJson($this->url($f),$f['input'])->assertUnprocessable();
        }
        DB::table('b2b_meetings')->where('id',$f['meeting'])->update(['outcome_code'=>'followup_required','status'=>'in_progress']);
        $this->postJson($this->url($f),$f['input'])->assertUnprocessable();
        DB::table('b2b_meetings')->where('id',$f['meeting'])->update(['status'=>'completed']);
        $this->postJson($this->url($f),[...$f['input'],'version'=>4])->assertConflict();
        foreach (['assigned_user_id','due_date'] as $key) { $v=$f['input'];unset($v[$key]);$this->postJson($this->url($f),$v)->assertUnprocessable(); }
        $this->postJson($this->url($f),[...$f['input'],'status'=>'completed'])->assertUnprocessable();
        config(['b2b.crm_followup_enabled'=>false]);$this->postJson($this->url($f),$f['input'])->assertStatus(503);
        $this->assertDatabaseCount('tasks',0);
    }

    public function test_context_and_relationship_tampering_are_rejected_and_ordinary_tasks_still_work(): void
    {
        $f=$this->fixture();$crm=app(CrmService::class);
        $other=$crm->save('exhibitions',['name'=>'SYNTHETIC other event','start_date'=>'2027-02-01','end_date'=>'2027-02-02','location'=>'Test','currency'=>'EGP','status'=>'planning'],$f['user'])['id'];
        $wrong=DB::table('b2b_participants')->find($f['participants'][1][1]);
        $this->postJson($this->url($f),[...$f['input'],'exhibition_id'=>$other])->assertUnprocessable();
        $this->postJson($this->url($f),[...$f['input'],'client_id'=>$wrong->client_id,'deal_id'=>$wrong->deal_id])->assertUnprocessable();
        $own=DB::table('b2b_participants')->find($f['participants'][0][1]);
        $id=$this->postJson($this->url($f),[...$f['input'],'client_id'=>$own->client_id,'deal_id'=>$own->deal_id])->assertOk()->json('task.id');
        foreach (['exhibition_id'=>$other,'client_id'=>$wrong->client_id,'deal_id'=>$wrong->deal_id] as $key=>$value) $this->putJson('/api/records/tasks/'.$id,[...$f['input'],'client_id'=>$own->client_id,'deal_id'=>$own->deal_id,$key=>$value])->assertUnprocessable();
        $ordinary=$this->postJson('/api/records/tasks',$f['input'],)->assertCreated()->json('data.id');
        $this->putJson('/api/records/tasks/'.$ordinary,[...$f['input'],'status'=>'completed'])->assertOk();
        $this->deleteJson('/api/records/tasks/'.$ordinary)->assertNoContent();$this->assertDatabaseCount('b2b_followup_tasks',1);
    }

    public function test_direct_calls_require_both_permissions_and_event_and_record_scope(): void
    {
        $f=$this->fixture();
        $view=$this->staff($f,['b2b.view'=>true,'b2b.buyers.view'=>true,'b2b.onsite.view'=>true,'b2b.meetings.view'=>true,'tasks.create'=>false]);
        $this->actingAs($view)->postJson($this->url($f),$f['input'])->assertForbidden();
        $grants=array_fill_keys(['b2b.view','b2b.buyers.view','b2b.onsite.view','b2b.meetings.view','b2b.results.view','b2b.results.manage','tasks.view','tasks.create','users.view'],true);
        $noEvent=$this->staff($f,$grants,false);
        $this->actingAs($noEvent)->postJson($this->url($f),$f['input'])->assertNotFound();
        $scoped=$this->staff($f,$grants);
        $this->actingAs($scoped)->postJson($this->url($f),$f['input'])->assertNotFound();
        $this->actingAs($f['user']);$this->assertDatabaseCount('tasks',0);
    }

    public function test_assignee_gets_only_task_data_and_cannot_follow_private_meeting_details(): void
    {
        $f=$this->fixture();$owner=$this->staff($f,['tasks.view'=>true,'tickets.view'=>false]);
        $this->getJson($this->url($f))->assertOk();
        $id=$this->postJson($this->url($f),[...$f['input'],'assigned_user_id'=>$owner->id])->assertOk()->json('task.id');
        $this->actingAs($owner)->getJson('/api/records/tasks/'.$id)->assertOk()->assertJsonPath('data.b2b_source',null)->assertDontSee('SYNTHETIC PRIVATE B2B notes')->assertDontSee('consent_evidence')->assertDontSee('required_products');
        $this->getJson($this->url($f))->assertForbidden();
        $outsider=$this->staff($f,['tasks.view'=>true],false);
        $this->actingAs($f['user'])->putJson('/api/records/tasks/'.$id,[...$f['input'],'assigned_user_id'=>$outsider->id])->assertUnprocessable();
        $identity=(string)Str::uuid();$membership=(string)Str::uuid();
        DB::table('portal_identity_controls')->insert(['identity_id'=>$identity,'reviewed_by'=>$f['user']->id]);
        DB::table('portal_memberships')->insert(['id'=>$membership,'identity_id'=>$identity,'participant_id'=>$f['participants'][0][0],'exhibition_id'=>$f['event'],'role'=>'owner','capabilities'=>json_encode(ParticipantAuthority::ROLES['owner']),'status'=>'active','approval_evidence'=>B2BProfiles::seal(['reference'=>'Synthetic']),'reviewed_by'=>$f['user']->id]);
        config(['participant_portal.enabled'=>true]);
        $portal=app(ParticipantAuthority::class)->execute(['identity_id'=>$identity,'membership_id'=>$membership,'exhibition_id'=>$f['event'],'operation'=>'overview','payload'=>[],'authentication'=>['device_id'=>(string)Str::uuid(),'auth_version'=>1]]);
        $json=json_encode($portal);foreach (['SYNTHETIC follow-up task','Approved operational instruction','followup_task','task_id','SYNTHETIC PRIVATE'] as $secret) $this->assertStringNotContainsString($secret,$json);
        $this->assertDatabaseCount('tasks',1);
    }
}
