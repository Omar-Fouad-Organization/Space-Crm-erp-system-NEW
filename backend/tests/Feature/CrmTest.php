<?php
namespace Tests\Feature;

use App\Models\User;
use App\Services\CrmService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CrmTest extends TestCase
{
    use RefreshDatabase;
    private User $admin;
    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('space_crm_test',DB::connection()->getDatabaseName(),'Tests must never use the review database.');
        $this->admin=User::factory()->create(['name'=>'Test Admin','role'=>'super_admin','status'=>'active','password'=>Hash::make('TestPassword!2026')]);
        DB::table('settings')->insert(['id'=>1,'company_name'=>'Test Company','currency'=>'EGP']);
        $this->actingAs($this->admin);
    }
    private function createRecord(string $resource,array $data): array
    {
        return $this->postJson('/api/records/'.$resource,$data)->assertCreated()->json('data');
    }
    private function fixture(): array
    {
        $client=$this->createRecord('clients',['name'=>'Test Client','contact_person'=>'Jane','email'=>'jane@example.test','type'=>'exhibitor','status'=>'active']);
        $expo=$this->createRecord('exhibitions',['name'=>'Test Expo','start_date'=>'2026-12-01','end_date'=>'2026-12-03','location'=>'Cairo','status'=>'planning','currency'=>'EGP']);
        $booth=$this->createRecord('booths',['name'=>'A-01','exhibition_id'=>$expo['id'],'size_sqm'=>'25.00','price'=>'10000.00','currency'=>'EGP']);
        $payload=['name'=>'Test Deal','client_id'=>$client['id'],'exhibition_id'=>$expo['id'],'type'=>'booth','booth_id'=>$booth['id'],'salesperson_id'=>$this->admin->id,'amount'=>'10000.00','currency'=>'EGP','status'=>'talking','commission_percentage'=>'5.00'];
        return compact('client','expo','booth','payload');
    }
    public function test_original_fields_round_trip_without_overriding_relationships(): void
    {
        $f=$this->fixture();
        $payload=[...$f['payload'],'attributes'=>['priority'=>'High','terms_conditions'=>'Dummy original dialog terms','custom_tags'=>['review']]];
        $deal=$this->createRecord('deals',$payload);
        $this->getJson('/api/records/deals/'.$deal['id'])->assertJsonPath('data.priority','High')->assertJsonPath('data.custom_tags.0','review')->assertJsonPath('data.client_id',$f['client']['id']);
        $this->putJson('/api/records/deals/'.$deal['id'],[...$f['payload'],'attributes'=>['next_action'=>'Follow up']])->assertOk()->assertJsonPath('data.terms_conditions','Dummy original dialog terms')->assertJsonPath('data.next_action','Follow up');
        foreach (['client_id','permission','password','user_id','deal_id'] as $key) $this->putJson('/api/records/deals/'.$deal['id'],[...$f['payload'],'attributes'=>[$key=>'invalid']])->assertUnprocessable();
        $this->putJson('/api/records/deals/'.$deal['id'],[...$f['payload'],'attributes'=>null])->assertOk();
    }
    public function test_original_base_price_tax_discount_and_commission_calculation(): void
    {
        $f=$this->fixture();
        $pricing=[...$f['payload'],'amount'=>'10260.00','base_price'=>'10000.00','discount_percentage'=>'10.00','tax_percentage'=>'14.00'];
        $deal=$this->createRecord('deals',$pricing);
        $this->assertDatabaseHas('commissions',['deal_id'=>$deal['id'],'amount'=>'500.00']);
        $this->putJson('/api/records/deals/'.$deal['id'],[...$pricing,'amount'=>'10260.01'])->assertUnprocessable();
        $this->putJson('/api/records/deals/'.$deal['id'],[...$pricing,'discount_percentage'=>'101.00'])->assertUnprocessable();
    }
    public function test_authentication_and_logout(): void
    {
        $this->postJson('/api/logout')->assertOk();
        $this->getJson('/api/metadata')->assertUnauthorized();
        $this->postJson('/api/login',['email'=>$this->admin->email,'password'=>'wrong'])->assertUnprocessable();
        $this->postJson('/api/login',['email'=>$this->admin->email,'password'=>'TestPassword!2026'])->assertOk()->assertJsonPath('user.role','super_admin')->assertJsonMissingPath('user.password');
    }
    public function test_admin_sidebar_diagnostics_are_read_only_and_check_relationships(): void
    {
        $f=$this->fixture();
        $before=DB::table('audit_logs')->count();
        $result=$this->getJson('/api/diagnostics')->assertOk()->assertJsonPath('database','MySQL')->assertJsonPath('counts.clients',1)->json();
        $this->assertGreaterThan(20,count($result['orphans']));
        foreach($result['orphans'] as $check)$this->assertSame(0,$check['count'],$check['field']);
        $this->assertSame($before,DB::table('audit_logs')->count());
        $this->actingAs(User::factory()->create(['role'=>'sales','status'=>'active']));
        $this->getJson('/api/diagnostics')->assertForbidden();
    }
    public function test_mark_all_notifications_read_is_scoped_to_the_signed_in_user(): void
    {
        $this->fixture();
        $other=User::factory()->create(['role'=>'sales','status'=>'active']);
        $this->actingAs($other);
        $this->createRecord('channels',['name'=>'Other account channel']);
        $this->actingAs($this->admin);
        $this->patchJson('/api/notifications/read-all')->assertOk()->assertJsonPath('updated',3);
        $this->assertSame(0,DB::table('notifications')->where('user_id',$this->admin->id)->whereNull('read_at')->count());
        $this->assertSame(1,DB::table('notifications')->where('user_id',$other->id)->whereNull('read_at')->count());
        $this->patchJson('/api/notifications/read-all')->assertOk()->assertJsonPath('updated',0);
    }
    public function test_inactive_account_is_denied(): void
    {
        $this->admin->forceFill(['status'=>'inactive'])->save();
        $this->getJson('/api/metadata')->assertUnauthorized();
    }
    public function test_roles_cannot_read_hr_or_modify_users_or_money(): void
    {
        $sales=User::factory()->create(['role'=>'sales','status'=>'active']); $this->actingAs($sales);
        $this->getJson('/api/records/employees')->assertForbidden();
        $this->postJson('/api/records/users',[])->assertForbidden();
        $this->postJson('/api/records/payments',[])->assertForbidden();
        $this->getJson('/api/records/users')->assertOk()->assertJsonMissingPath('data.0.email')->assertJsonMissingPath('data.0.role');
    }
    public function test_atomic_deal_creation_and_full_payment_commission_cycle(): void
    {
        $f=$this->fixture();
        $deal=$this->createRecord('deals',[...$f['payload'],'installments'=>[['name'=>'Deposit','amount'=>'4000.00','due_date'=>'2026-12-01'],['name'=>'Balance','amount'=>'6000.00','due_date'=>'2026-12-02']]]);
        $this->assertDatabaseHas('booths',['id'=>$f['booth']['id'],'status'=>'reserved']);
        $this->assertDatabaseHas('commissions',['deal_id'=>$deal['id'],'amount'=>'500.00','status'=>'pending']);
        $schedules=DB::table('payment_schedules')->where('deal_id',$deal['id'])->get();
        $commission=(array)DB::table('commissions')->where('deal_id',$deal['id'])->first();
        $this->putJson('/api/records/commissions/'.$commission['id'],[...$commission,'status'=>'approved'])->assertUnprocessable();
        $this->putJson('/api/records/deals/'.$deal['id'],[...$f['payload'],'status'=>'closed_won'])->assertOk();
        foreach ($schedules as $s) $this->createRecord('payments',['name'=>'PAY-'.$s->id,'payment_schedule_id'=>$s->id,'amount'=>$s->amount,'paid_date'=>'2026-12-02','method'=>'bank_transfer']);
        $this->getJson('/api/records/deals/'.$deal['id'])->assertOk()->assertJsonPath('data.remaining_amount','0.00');
        $this->assertDatabaseHas('booths',['id'=>$f['booth']['id'],'status'=>'sold']);
        $this->putJson('/api/records/commissions/'.$commission['id'],[...$commission,'status'=>'approved'])->assertOk();
        $this->putJson('/api/records/commissions/'.$commission['id'],[...$commission,'status'=>'paid'])->assertOk();
        $invoice=$this->createRecord('invoices',['name'=>'INV-001','deal_id'=>$deal['id'],'due_date'=>'2026-12-02']);
        $this->assertSame('paid',$invoice['status']);
        $this->getJson('/api/exhibitors')->assertOk()->assertJsonCount(1,'data');
        $this->getJson('/api/dashboard')->assertOk()->assertJsonPath('totals.0.received','10000.00');
        $this->deleteJson('/api/records/clients/'.$f['client']['id'])->assertUnprocessable();
        $this->putJson('/api/records/deals/'.$deal['id'],[...$f['payload'],'amount'=>'12000.00','status'=>'closed_won'])->assertUnprocessable();
    }
    public function test_invalid_installment_plan_rolls_back_everything(): void
    {
        $f=$this->fixture();
        $this->postJson('/api/records/deals',[...$f['payload'],'installments'=>[['name'=>'Wrong','amount'=>'1.00','due_date'=>'2026-12-01']]])->assertUnprocessable();
        $this->assertDatabaseCount('deals',0); $this->assertDatabaseCount('commissions',0); $this->assertDatabaseCount('payment_schedules',0);
        $this->assertDatabaseHas('booths',['id'=>$f['booth']['id'],'status'=>'available']);
    }
    public function test_cross_exhibition_and_nonexistent_relationships_are_rejected(): void
    {
        $f=$this->fixture();
        $other=$this->createRecord('exhibitions',['name'=>'Other','start_date'=>'2026-12-01','end_date'=>'2026-12-03','location'=>'Giza','status'=>'planning','currency'=>'EGP']);
        $this->postJson('/api/records/deals',[...$f['payload'],'exhibition_id'=>$other['id']])->assertUnprocessable();
        $this->postJson('/api/records/deals',[...$f['payload'],'client_id'=>999999])->assertUnprocessable();
        $this->postJson('/api/records/deals',[...$f['payload'],'currency'=>'USD'])->assertUnprocessable();
    }
    public function test_double_booking_and_cancellation_release(): void
    {
        $f=$this->fixture(); $deal=$this->createRecord('deals',$f['payload']);
        $this->postJson('/api/records/deals',[...$f['payload'],'name'=>'Duplicate'])->assertUnprocessable();
        $this->putJson('/api/records/deals/'.$deal['id'],[...$f['payload'],'status'=>'cancelled'])->assertOk();
        $this->assertDatabaseHas('booths',['id'=>$f['booth']['id'],'status'=>'available']);
        $this->createRecord('deals',[...$f['payload'],'name'=>'Replacement']);
    }
    public function test_installments_and_payments_cannot_exceed_balances(): void
    {
        $f=$this->fixture(); $deal=$this->createRecord('deals',[...$f['payload'],'status'=>'closed_won']);
        $s=$this->createRecord('payment_schedules',['name'=>'Full','deal_id'=>$deal['id'],'amount'=>'10000.00','due_date'=>'2026-12-01']);
        $this->postJson('/api/records/payment_schedules',['name'=>'Extra','deal_id'=>$deal['id'],'amount'=>'1.00','due_date'=>'2026-12-01'])->assertUnprocessable();
        $pay=['name'=>'PAY-001','payment_schedule_id'=>$s['id'],'amount'=>'6000.00','paid_date'=>'2026-12-01','method'=>'bank_transfer'];
        $this->createRecord('payments',$pay);
        $this->postJson('/api/records/payments',[...$pay,'name'=>'PAY-002','amount'=>'4000.01'])->assertUnprocessable();
        $this->postJson('/api/records/payments',[...$pay,'name'=>'PAY-003','amount'=>'0'])->assertUnprocessable();
        $this->postJson('/api/records/payments',[...$pay,'name'=>'PAY-004','amount'=>'0.001'])->assertUnprocessable();
        $this->putJson('/api/records/payment_schedules/'.$s['id'],['name'=>'Full','deal_id'=>$deal['id'],'amount'=>'5000','due_date'=>'2026-12-01'])->assertUnprocessable();
        $this->putJson('/api/records/deals/'.$deal['id'],[...$f['payload'],'status'=>'cancelled'])->assertUnprocessable();
        $this->assertDatabaseCount('payments',1);
    }
    public function test_booth_and_sponsorship_models_cannot_be_mixed(): void
    {
        $f=$this->fixture();
        $p=$this->createRecord('sponsorship_packages',['name'=>'Gold','exhibition_id'=>$f['expo']['id'],'tier'=>'gold','price'=>'10000','currency'=>'EGP']);
        $this->postJson('/api/records/deals',[...$f['payload'],'sponsorship_package_id'=>$p['id']])->assertUnprocessable();
        $this->createRecord('deals',[...$f['payload'],'name'=>'Sponsor Deal','type'=>'sponsor','booth_id'=>null,'sponsorship_package_id'=>$p['id']]);
    }
    public function test_related_modules_crud_and_backlinks(): void
    {
        $f=$this->fixture(); $deal=$this->createRecord('deals',$f['payload']);
        $base=['client_id'=>$f['client']['id'],'deal_id'=>$deal['id']];
        $cases=[
            'tasks'=>[...$base,'name'=>'Follow up','assigned_user_id'=>$this->admin->id,'due_date'=>'2026-12-01','priority'=>'high','status'=>'pending'],
            'meetings'=>[...$base,'name'=>'Kickoff','organizer_id'=>$this->admin->id,'meeting_date'=>'2026-12-01','meeting_time'=>'10:00','duration'=>60,'status'=>'scheduled','attendee_ids'=>[$this->admin->id]],
            'documents'=>[...$base,'name'=>'Contract','type'=>'contract','status'=>'draft'],
            'tickets'=>[...$base,'name'=>'Support ticket','assigned_user_id'=>$this->admin->id,'priority'=>'high','status'=>'open'],
            'proposals'=>['name'=>'Proposal','deal_id'=>$deal['id'],'status'=>'draft','content'=>'Scope'],
            'employees'=>['name'=>'Employee','user_id'=>$this->admin->id,'department'=>'Sales','position'=>'Manager','hire_date'=>'2026-01-01','status'=>'active','currency'=>'EGP'],
            'channels'=>['name'=>'Deal discussion','deal_id'=>$deal['id']],
        ];
        foreach ($cases as $resource=>$payload) {
            $row=$this->createRecord($resource,$payload);
            $this->getJson('/api/records/'.$resource.'/'.$row['id'])->assertOk();
            $this->putJson('/api/records/'.$resource.'/'.$row['id'],[...$payload,'name'=>'Updated '.$resource])->assertOk();
            if ($resource==='meetings') $this->assertDatabaseHas('meeting_attendees',['meeting_id'=>$row['id'],'user_id'=>$this->admin->id]);
            $this->deleteJson('/api/records/'.$resource.'/'.$row['id'])->assertNoContent();
        }
        $this->getJson('/api/records/clients/'.$f['client']['id'])->assertOk()->assertJsonCount(1,'relations.deals');
    }
    public function test_linked_client_cannot_differ_from_deal(): void
    {
        $f=$this->fixture(); $deal=$this->createRecord('deals',$f['payload']);
        $other=$this->createRecord('clients',['name'=>'Other','contact_person'=>'Jim','email'=>'jim@example.test','type'=>'sponsor','status'=>'active']);
        $this->postJson('/api/records/documents',['name'=>'Wrong','client_id'=>$other['id'],'deal_id'=>$deal['id'],'type'=>'contract','status'=>'draft'])->assertUnprocessable();
    }
    public function test_attachment_persistence_download_and_delete(): void
    {
        Storage::fake('local'); $f=$this->fixture();
        $doc=$this->createRecord('documents',['name'=>'Agreement','client_id'=>$f['client']['id'],'type'=>'contract','status'=>'draft']);
        $id=$this->post('/api/documents/'.$doc['id'].'/attachments',['file'=>UploadedFile::fake()->createWithContent('agreement.txt','Dummy agreement')],['Accept'=>'application/json'])->assertCreated()->json('data.id');
        $this->get('/api/attachments/'.$id)->assertOk()->assertDownload('agreement.txt');
        $this->deleteJson('/api/records/documents/'.$doc['id'])->assertUnprocessable();
        $this->deleteJson('/api/attachments/'.$id)->assertNoContent();
        $this->get('/api/attachments/'.$id)->assertNotFound();
        $this->deleteJson('/api/records/documents/'.$doc['id'])->assertNoContent();
    }
    public function test_audit_redacts_passwords_and_notification_ownership(): void
    {
        $other=$this->createRecord('users',['name'=>'Sales','email'=>'sales@example.test','role'=>'sales','status'=>'active','password'=>'SecurePassword!2026']);
        $audit=DB::table('audit_logs')->where('resource','users')->first(); $this->assertStringNotContainsString('password',$audit->after);
        $notification=DB::table('notifications')->first(); $this->actingAs(User::find($other['id']));
        $this->patchJson('/api/notifications/'.$notification->id)->assertNotFound();
        $this->getJson('/api/audit')->assertForbidden();
    }
    public function test_date_validation_self_protection_and_unknown_resources(): void
    {
        $this->postJson('/api/records/exhibitions',['name'=>'Bad','start_date'=>'2026-12-03','end_date'=>'2026-12-01','location'=>'Cairo','currency'=>'EGP','status'=>'planning'])->assertUnprocessable();
        $this->putJson('/api/records/users/'.$this->admin->id,['name'=>$this->admin->name,'email'=>$this->admin->email,'role'=>'sales','status'=>'active'])->assertUnprocessable();
        $this->getJson('/api/records/not_a_table')->assertNotFound();
        $this->getJson('/api/records/users/999999')->assertNotFound();
    }
    public function test_decimal_rounding_is_exact(): void
    {
        $service=app(CrmService::class); $this->assertSame(29,$service->cents('0.29')); $this->assertSame('123.45',$service->decimal(12345));
    }
    public function test_master_records_crud_and_link_protection(): void
    {
        $client=$this->createRecord('clients',['name'=>'Disposable','contact_person'=>'Jane','email'=>'delete@example.test','type'=>'exhibitor','status'=>'active']);
        $this->putJson('/api/records/clients/'.$client['id'],[...$client,'name'=>'Updated'])->assertOk();
        $this->deleteJson('/api/records/clients/'.$client['id'])->assertNoContent();
        $f=$this->fixture();
        $package=$this->createRecord('sponsorship_packages',['name'=>'Gold','exhibition_id'=>$f['expo']['id'],'tier'=>'gold','price'=>'5000','currency'=>'EGP']);
        $this->putJson('/api/records/sponsorship_packages/'.$package['id'],[...$package,'price'=>'6000'])->assertOk();
        $this->deleteJson('/api/records/sponsorship_packages/'.$package['id'])->assertNoContent();
        $this->putJson('/api/records/booths/'.$f['booth']['id'],[...$f['booth'],'zone'=>'A'])->assertOk();
        $this->deleteJson('/api/records/exhibitions/'.$f['expo']['id'])->assertUnprocessable();
        $deal=$this->createRecord('deals',[...$f['payload'],'commission_percentage'=>'0']);
        $this->deleteJson('/api/records/booths/'.$f['booth']['id'])->assertUnprocessable();
        $this->deleteJson('/api/records/deals/'.$deal['id'])->assertNoContent();
        $this->assertDatabaseHas('booths',['id'=>$f['booth']['id'],'status'=>'available']);
        $this->deleteJson('/api/records/booths/'.$f['booth']['id'])->assertNoContent();
        $this->putJson('/api/records/exhibitions/'.$f['expo']['id'],[...$f['expo'],'status'=>'active'])->assertOk();
        $this->deleteJson('/api/records/exhibitions/'.$f['expo']['id'])->assertNoContent();
        $user=$this->createRecord('users',['name'=>'Temporary','email'=>'temp@example.test','role'=>'support','status'=>'active','password'=>'SecurePassword!2026']);
        $this->putJson('/api/records/users/'.$user['id'],[...$user,'status'=>'inactive'])->assertOk();
        $this->deleteJson('/api/records/users/'.$user['id'])->assertNoContent();
    }
    public function test_chat_crud_parent_protection_and_author_tracking(): void
    {
        $channel=$this->createRecord('channels',['name'=>'Team']);
        $message=$this->createRecord('messages',['name'=>'Hello','channel_id'=>$channel['id']]);
        $this->assertSame($this->admin->id,$message['created_by']);
        $this->putJson('/api/records/messages/'.$message['id'],[...$message,'name'=>'Updated'])->assertOk();
        $this->deleteJson('/api/records/channels/'.$channel['id'])->assertUnprocessable();
        $this->deleteJson('/api/records/messages/'.$message['id'])->assertNoContent();
        $this->putJson('/api/records/channels/'.$channel['id'],[...$channel,'name'=>'Updated channel'])->assertOk();
        $this->deleteJson('/api/records/channels/'.$channel['id'])->assertNoContent();
    }
    public function test_foreign_keys_cannot_be_invalidated_by_parent_edits(): void
    {
        $f=$this->fixture();
        $p=$this->createRecord('sponsorship_packages',['name'=>'Gold','exhibition_id'=>$f['expo']['id'],'tier'=>'gold','price'=>'10000','currency'=>'EGP']);
        $this->createRecord('deals',[...$f['payload'],'type'=>'sponsor','booth_id'=>null,'sponsorship_package_id'=>$p['id']]);
        $this->putJson('/api/records/sponsorship_packages/'.$p['id'],[...$p,'currency'=>'USD'])->assertUnprocessable();
        $deal=$this->createRecord('deals',$f['payload']);
        $this->putJson('/api/records/booths/'.$f['booth']['id'],[...$f['booth'],'currency'=>'USD'])->assertUnprocessable();
        $this->createRecord('documents',['name'=>'Contract','client_id'=>$f['client']['id'],'deal_id'=>$deal['id'],'type'=>'contract','status'=>'draft']);
        $other=$this->createRecord('clients',['name'=>'Other','contact_person'=>'Jim','email'=>'other@example.test','type'=>'exhibitor','status'=>'active']);
        $this->putJson('/api/records/deals/'.$deal['id'],[...$f['payload'],'client_id'=>$other['id']])->assertUnprocessable();
    }
    public function test_chat_users_cannot_change_another_authors_message(): void
    {
        $channel=$this->createRecord('channels',['name'=>'Shared']);
        $message=$this->createRecord('messages',['name'=>'Admin message','channel_id'=>$channel['id']]);
        $sales=User::factory()->create(['role'=>'sales','status'=>'active']); $this->actingAs($sales);
        $this->putJson('/api/records/messages/'.$message['id'],[...$message,'name'=>'Tampered'])->assertForbidden();
        $this->deleteJson('/api/records/messages/'.$message['id'])->assertForbidden();
        $own=$this->createRecord('messages',['name'=>'Own message','channel_id'=>$channel['id']]);
        $this->putJson('/api/records/messages/'.$own['id'],[...$own,'name'=>'Own edit'])->assertOk();
        $this->deleteJson('/api/records/messages/'.$own['id'])->assertNoContent();
    }
}
