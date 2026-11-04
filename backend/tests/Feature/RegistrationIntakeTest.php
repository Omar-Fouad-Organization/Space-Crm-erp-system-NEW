<?php
namespace Tests\Feature;
use App\Models\User;
use App\Services\{IntakePayload,IntakeTransport,SessionRevocation};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class RegistrationIntakeTest extends TestCase
{
    use RefreshDatabase;
    private User $admin;
    private int $event;
    protected function setUp(): void
    {
        parent::setUp();
        $this->admin=User::factory()->create(['role'=>'super_admin','status'=>'active']);
        $this->event=DB::table('exhibitions')->insertGetId(['name'=>'Synthetic intake exhibition','start_date'=>'2027-01-01','end_date'=>'2027-01-03','location'=>'Synthetic','currency'=>'EGP','status'=>'planning','created_by'=>$this->admin->id]);
        config(['authorization.enabled'=>true,'intake.enabled'=>true,'intake.exhibition_id'=>$this->event,'intake.key'=>'SyntheticRegistrationServiceKeyForTestsOnly123456789']);
    }
    private function envelope(string $type='exhibitor'): array
    {
        $p=['name'=>'شركة تجريبية Test Person','email'=>'Buyer@Example.test','company'=>'Synthetic International Company','country'=>'Japan','country_code'=>'+81','phone'=>'9012345678','language'=>'ar',
            'job_title'=>'Procurement','classification'=>'retailer','interests'=>['organic'],'sourcing_interests'=>'Organic products','message'=>'Synthetic request','operational_consent'=>true,'marketing_consent'=>false,'policy_version'=>'synthetic-v1','consented_at'=>'2026-11-03T12:00:00Z'];
        return ['message_id'=>Str::uuid()->toString(),'source_id'=>Str::uuid()->toString(),'source_system'=>'green-life-website','site'=>'green-life-expo','exhibition_id'=>$this->event,
            'source_form'=>in_array($type,['buyer','visitor'])?$type:'contact','type'=>$type,'event'=>'submitted','historical'=>false,'submitted_at'=>'2026-11-03T12:00:00Z','payload'=>$p,'source_hash'=>IntakePayload::hash($p)];
    }
    private function service(string $operation,array $body,?array $headers=null)
    {
        $raw=json_encode($body,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
        config(['intake.role'=>'website','intake.peer'=>'erp']);
        $headers??=app(IntakeTransport::class)->headers('/api/internal/intake/'.$operation,$raw);
        config(['intake.role'=>'erp','intake.peer'=>'website']);
        return $this->call('POST','/api/internal/intake/'.$operation,[],[],[],['CONTENT_TYPE'=>'application/json','CONTENT_LENGTH'=>strlen($raw),'HTTP_ACCEPT'=>'application/json','HTTP_X_SPACE_INTAKE'=>$headers['X-Space-Intake'],'HTTP_X_SPACE_INTAKE_SIGNATURE'=>$headers['X-Space-Intake-Signature']],$raw);
    }
    private function staff(string $path,array $body,string $method='POST')
    {
        return $this->withServerVariables(['CONTENT_LENGTH'=>strlen(json_encode($body))])->json($method,'/api/intake/'.$path,$body);
    }
    public function test_signed_acceptance_routes_without_commercial_side_effects(): void
    {
        foreach(['exhibitor','sponsor','speaker','general','media','partnership','buyer','visitor'] as $type){$e=$this->envelope($type);$this->service('accept',$e)->assertOk()->assertJsonPath('accepted',true);}
        $this->assertDatabaseCount('intake_submissions',8);$this->assertDatabaseCount('intake_inbox',8);
        foreach(['clients','deals','booths','payments','commissions','buyer_organizations'] as $table){$this->assertDatabaseCount($table,0);}
        $this->assertDatabaseHas('intake_submissions',['type'=>'buyer','status'=>'submitted','country'=>'Japan','email'=>'buyer@example.test','phone'=>'+819012345678']);
        $this->assertStringNotContainsString('Synthetic International',DB::table('intake_submissions')->first()->original_payload);
    }
    public function test_idempotent_retry_and_payload_conflicts(): void
    {
        $e=$this->envelope();$this->service('accept',$e)->assertOk();$this->service('accept',$e)->assertOk();
        $e['payload']['name']='Changed';$e['source_hash']=IntakePayload::hash($e['payload']);$this->service('accept',$e)->assertStatus(409);
        $this->assertDatabaseCount('intake_submissions',1);$this->assertDatabaseCount('intake_history',1);
    }
    public function test_nonce_replay_bad_signatures_and_wrong_exhibition_are_rejected(): void
    {
        $e=$this->envelope();$raw=json_encode($e,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
        config(['intake.role'=>'website','intake.peer'=>'erp']);$h=app(IntakeTransport::class)->headers('/api/internal/intake/accept',$raw);
        $this->service('accept',$e,$h)->assertOk();$this->service('accept',$e,$h)->assertStatus(409);
        $h['X-Space-Intake-Signature']=str_repeat('0',64);$this->service('accept',$e,$h)->assertUnauthorized();
        $e['exhibition_id']++;$this->service('accept',$e)->assertUnprocessable();
    }
    public function test_source_provenance_and_form_mapping_are_immutable(): void
    {
        $e=$this->envelope('buyer');
        $bad=[...$e,'source_form'=>'contact'];$this->service('accept',$bad)->assertUnprocessable();
        $this->service('accept',$e)->assertOk();
        $retry=[...$e,'message_id'=>Str::uuid()->toString(),'submitted_at'=>'2026-11-02T12:00:00Z'];
        $this->service('accept',$retry)->assertStatus(409);
        $this->assertDatabaseCount('intake_submissions',1);$this->assertDatabaseCount('intake_inbox',1);
    }
    public function test_legacy_interest_never_becomes_a_registration(): void
    {
        $e=$this->envelope('visitor');$e['historical']=true;$e['source_form']='legacy_visitor_registrations';$e['payload']['legacy_original']=['id'=>$e['source_id'],'name'=>'Historic test'];$e['source_hash']=IntakePayload::hash($e['payload']);$this->service('accept',$e)->assertUnprocessable();
        $e['type']='visitor_interest';$this->service('accept',$e)->assertOk();$this->assertDatabaseHas('intake_submissions',['type'=>'visitor_interest','status'=>'received','historical'=>true]);
    }
    public function test_public_withdrawal_is_durable_and_cannot_be_undone_by_replay(): void
    {
        $e=$this->envelope('visitor');$this->service('accept',$e)->assertOk();$w=[...$e,'event'=>'withdrawn','message_id'=>Str::uuid()->toString()];
        $this->service('accept',$w)->assertOk();$this->service('accept',$w)->assertOk();$this->service('accept',$e)->assertOk();
        $this->assertDatabaseHas('intake_submissions',['source_id'=>$e['source_id'],'status'=>'withdrawn']);
    }
    public function test_staff_permissions_event_and_record_scope_are_all_required(): void
    {
        $this->service('accept',$this->envelope('buyer'))->assertOk();$id=DB::table('intake_submissions')->value('id');
        $u=User::factory()->create(['role'=>'support','status'=>'active','authorization_scoped'=>true,'record_scope'=>'own']);
        DB::table('user_permission_overrides')->insert(['user_id'=>$u->id,'permission'=>'buyers.view','allowed'=>true,'granted_by'=>$this->admin->id]);
        $this->actingAs($u);$this->getJson('/api/intake/submissions/'.$id)->assertNotFound();
        DB::table('exhibition_user')->insert(['user_id'=>$u->id,'exhibition_id'=>$this->event,'granted_by'=>$this->admin->id]);
        app(SessionRevocation::class)->revoke($u->id);$u->refresh();$this->actingAs($u);
        $this->getJson('/api/intake/submissions/'.$id)->assertNotFound();
        DB::table('intake_submissions')->where('id',$id)->update(['assigned_user_id'=>$u->id]);
        $this->getJson('/api/intake/submissions/'.$id)->assertOk();
        $this->staff('submissions/'.$id,['version'=>1,'action'=>'status','status'=>'verified','reason'=>'Not authorized'])->assertForbidden();
        $this->staff('export',['family'=>'buyers'])->assertForbidden();$this->getJson('/api/workspace/finance')->assertForbidden();
    }
    public function test_buyer_review_requires_organization_and_explicit_approval(): void
    {
        $this->service('accept',$this->envelope('buyer'))->assertOk();$id=DB::table('intake_submissions')->value('id');$this->actingAs($this->admin);
        $this->staff('submissions/'.$id,['version'=>1,'action'=>'status','status'=>'verified','reason'=>'Skip review'])->assertUnprocessable();
        $this->staff('submissions/'.$id,['version'=>1,'action'=>'status','status'=>'under_review','reason'=>'Review started'])->assertOk();
        $this->staff('submissions/'.$id,['version'=>2,'action'=>'status','status'=>'verified','reason'=>'Reviewed'])->assertUnprocessable();
        $this->staff('submissions/'.$id,['version'=>2,'action'=>'organization','organization'=>['name'=>'Synthetic buyer organization','country'=>'Japan']])->assertOk();
        $this->staff('submissions/'.$id,['version'=>3,'action'=>'status','status'=>'verified','reason'=>'Business details reviewed'])->assertOk();
        $this->assertDatabaseCount('clients',0);$this->assertDatabaseCount('deals',0);$this->assertDatabaseCount('buyer_organizations',1);
    }
    public function test_controlled_conversion_reuses_existing_client_service(): void
    {
        $this->service('accept',$this->envelope())->assertOk();$id=DB::table('intake_submissions')->value('id');$this->actingAs($this->admin);
        $this->staff('submissions/'.$id,['version'=>1,'action'=>'convert'])->assertUnprocessable();
        $this->staff('submissions/'.$id,['version'=>1,'action'=>'status','status'=>'contacted','reason'=>'Contacted'])->assertOk();
        $this->staff('submissions/'.$id,['version'=>2,'action'=>'status','status'=>'qualified','reason'=>'Qualified'])->assertOk();
        $this->staff('submissions/'.$id,['version'=>3,'action'=>'duplicate','duplicate_review'=>'distinct','reason'=>'Reviewed matching candidates'])->assertOk();
        $input=['version'=>4,'action'=>'convert','client'=>['name'=>'Synthetic company','contact_person'=>'Test person','email'=>'test@example.test','type'=>'exhibitor']];
        $this->staff('submissions/'.$id,$input)->assertOk();$this->staff('submissions/'.$id,$input)->assertStatus(409);
        $this->assertDatabaseCount('clients',1);$this->assertDatabaseHas('clients',['status'=>'prospect']);$this->assertDatabaseCount('deals',0);$this->assertDatabaseCount('commissions',0);
    }
    public function test_controls_default_closed_and_require_approved_visitor_dates(): void
    {
        $this->service('controls',[])->assertOk()->assertJsonPath('controls.visitor.open',false);
        $this->actingAs($this->admin);$control=['version'=>0,'type'=>'visitor','enabled'=>true,'dates_approved'=>false,'visit_dates'=>[],'timezone'=>'Africa/Cairo','policy_version'=>'synthetic-v1','privacy_notice_en'=>'Synthetic test notice only.','privacy_notice_ar'=>'إشعار تجريبي للاختبار فقط.'];
        $this->staff('controls',$control,'PUT')->assertUnprocessable();
        $control['dates_approved']=true;$control['visit_dates']=['2027-01-02'];$this->staff('controls',$control,'PUT')->assertOk();
        $this->service('controls',[])->assertOk()->assertJsonPath('controls.visitor.open',true);
    }
    public function test_assignment_rejects_unpermitted_staff_and_export_neutralizes_formulas(): void
    {
        $e=$this->envelope();$e['payload']['name']='=HYPERLINK("bad")';$e['source_hash']=IntakePayload::hash($e['payload']);
        $this->service('accept',$e)->assertOk();$id=DB::table('intake_submissions')->value('id');$this->actingAs($this->admin);
        $staff=User::factory()->create(['role'=>'finance','status'=>'active']);
        $this->staff('submissions/'.$id,['version'=>1,'action'=>'assign','assigned_user_id'=>$staff->id])->assertUnprocessable();
        $response=$this->staff('export',['family'=>'submissions']);$response->assertOk();$this->assertStringContainsString("'=HYPERLINK",$response->streamedContent());
    }
}
