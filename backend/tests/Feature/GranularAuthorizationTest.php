<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\{CrmService, PermissionPolicy, SessionRevocation};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\{Auth, DB, Hash, Storage};
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class GranularAuthorizationTest extends TestCase
{
    use RefreshDatabase;
    private User $admin;
    private User $sales;
    private User $peer;
    private User $other;
    private User $stranger;
    private array $a;
    private array $b;
    private array $deals = [];
    private array $payloads = [];
    private array $clients = [];
    private const PASSWORD = 'PolicyAdminPassword!2026';

    protected function setUp(): void
    {
        parent::setUp();
        config(['authorization.enabled' => true]);
        $this->admin = User::factory()->create(['role'=>'super_admin','status'=>'active','password'=>Hash::make(self::PASSWORD)]);
        $team = DB::table('teams')->insertGetId(['name'=>'Synthetic authorization team']);
        $this->sales = $this->staff('sales', $team);
        $this->peer = $this->staff('sales', $team);
        $this->other = $this->staff('sales', $team);
        $this->stranger = $this->staff('sales');
        DB::table('settings')->insert(['id'=>1,'company_name'=>'Synthetic','currency'=>'EGP']);
        $this->a = $this->save('exhibitions', ['name'=>'Allowed exhibition','start_date'=>'2027-01-01','end_date'=>'2027-01-03','location'=>'Synthetic','status'=>'planning','currency'=>'EGP']);
        $this->b = $this->save('exhibitions', ['name'=>'Restricted exhibition','start_date'=>'2027-02-01','end_date'=>'2027-02-03','location'=>'Synthetic','status'=>'planning','currency'=>'USD']);
        foreach ([$this->sales,$this->peer,$this->stranger] as $user) $this->member($user, $this->a['id']);
        $this->member($this->other, $this->b['id']);
        foreach ([[$this->sales,$this->a],[$this->peer,$this->a],[$this->stranger,$this->a],[$this->other,$this->b]] as $i=>[$user,$event]) {
            $client=$this->save('clients',['name'=>'Client '.$i,'contact_person'=>'Synthetic','email'=>'policy'.$i.'@example.test','type'=>'exhibitor','status'=>'prospect']);
            $booth=$this->save('booths',['name'=>'POLICY-'.$i,'exhibition_id'=>$event['id'],'size_sqm'=>'10','price'=>'1000','currency'=>$event['currency']]);
            $payload=['name'=>'Policy deal '.$i,'client_id'=>$client['id'],'exhibition_id'=>$event['id'],'booth_id'=>$booth['id'],'salesperson_id'=>$user->id,
                'type'=>'booth','amount'=>'1000','currency'=>$event['currency'],'status'=>'talking','commission_percentage'=>'5'];
            $this->deals[]=$this->save('deals',[...$payload,'installments'=>[['name'=>'Policy installment '.$i,'amount'=>'1000','due_date'=>'2027-03-01']]]);
            $this->payloads[]=$payload; $this->clients[]=$client;
        }
        $this->actingAs($this->admin);
    }

    private function staff(string $role, ?int $team=null): User
    {
        return User::factory()->create(['role'=>$role,'status'=>'active','authorization_scoped'=>true,'all_exhibitions'=>false,'record_scope'=>'all','team_id'=>$team]);
    }
    private function member(User $user, int $event): void
    {
        DB::table('exhibition_user')->insert(['user_id'=>$user->id,'exhibition_id'=>$event,'granted_by'=>$this->admin->id,'created_at'=>now(),'updated_at'=>now()]);
    }
    private function save(string $resource, array $data, ?int $id=null): array { return app(CrmService::class)->save($resource,$data,$this->admin,$id); }
    private function overrides(User $user, array $values): void
    {
        foreach ($values as $key=>$allowed) DB::table('user_permission_overrides')->updateOrInsert(['user_id'=>$user->id,'permission'=>$key],['allowed'=>$allowed,'granted_by'=>$this->admin->id,'created_at'=>now(),'updated_at'=>now()]);
        app(SessionRevocation::class)->revoke($user->id); $user->refresh();
    }
    private function accessPayload(User $user): array
    {
        return ['version'=>$user->fresh()->auth_version,'authorization_scoped'=>true,'all_exhibitions'=>false,'record_scope'=>'all','team_id'=>null,
            'exhibition_ids'=>[$this->a['id']],'overrides'=>[],'password'=>self::PASSWORD,'reason'=>'Synthetic policy review'];
    }
    public static function roles(): array { return array_map(fn($role)=>[$role],['super_admin','management','sales','finance','operations','hr','support']); }

    #[DataProvider('roles')]
    public function test_role_defaults_remain_the_verified_module_matrix(string $role): void
    {
        $user=$this->staff($role); $this->member($user,$this->a['id']); $this->actingAs($user);
        $meta=$this->getJson('/api/metadata')->assertOk()->json();
        foreach (array_keys(config('crm.resources')) as $resource) {
            $read=$role==='super_admin'||($role==='management'&&!in_array($resource,['users','employees']))||in_array($resource,CrmService::READ[$role]??[]);
            $this->getJson('/api/records/'.$resource)->assertStatus($read?200:403);
            $this->assertSame($read,isset($meta['resources'][$resource]));
        }
        if($role!=='super_admin') {
            $users=$this->getJson('/api/records/users')->assertOk()->json('data');
            foreach($users as $row){$this->assertArrayNotHasKey('email',$row);$this->assertArrayNotHasKey('password',$row);$this->assertArrayNotHasKey('auth_version',$row);}
        }
    }

    public static function scopes(): array { return [['all',3],['team',2],['own',1]]; }
    #[DataProvider('scopes')]
    public function test_record_scope_is_combined_with_event_scope(string $scope,int $expected): void
    {
        $this->sales->forceFill(['record_scope'=>$scope])->save(); $this->actingAs($this->sales);
        $rows=$this->getJson('/api/records/deals')->assertOk()->json('data'); $this->assertCount($expected,$rows);
        foreach($rows as $row)$this->assertSame($this->a['id'],$row['exhibition_id']);
        $this->getJson('/api/records/deals/'.$this->deals[3]['id'])->assertNotFound();
        $this->getJson('/api/records/exhibitions/'.$this->b['id'])->assertNotFound();
        $this->getJson('/api/records/booths/'.$this->payloads[3]['booth_id'])->assertNotFound();
        $this->getJson('/api/workspace/search?q=Restricted')->assertOk()->assertJsonCount(0,'data');
        $this->getJson('/api/dashboard')->assertOk()->assertJsonCount(1,'totals')->assertJsonPath('totals.0.currency','EGP');
    }

    public function test_multiple_memberships_and_explicit_all_are_distinct_from_missing_access(): void
    {
        $user=$this->staff('sales');$this->actingAs($user);
        $this->getJson('/api/records/deals')->assertOk()->assertJsonCount(0,'data');
        $this->member($user,$this->a['id']);$this->member($user,$this->b['id']);app(SessionRevocation::class)->revoke($user->id);$user->refresh();$this->actingAs($user);
        $this->getJson('/api/records/deals')->assertOk()->assertJsonCount(4,'data');
        DB::table('exhibition_user')->where('user_id',$user->id)->delete();$user->forceFill(['all_exhibitions'=>true])->save();app(SessionRevocation::class)->revoke($user->id);$user->refresh();$this->actingAs($user);
        $this->getJson('/api/records/deals')->assertOk()->assertJsonCount(4,'data');
    }

    public function test_indirect_financial_records_and_reports_are_scoped(): void
    {
        foreach([0,3] as $i){$this->save('deals',[...$this->payloads[$i],'status'=>'closed_won'],$this->deals[$i]['id']);
            $schedule=DB::table('payment_schedules')->where('deal_id',$this->deals[$i]['id'])->first();
            $this->save('payments',['name'=>'Policy receipt '.$i,'payment_schedule_id'=>$schedule->id,'amount'=>'100','paid_date'=>'2027-03-01','method'=>'cash']);
            $this->save('invoices',['name'=>'Policy invoice '.$i,'deal_id'=>$this->deals[$i]['id'],'due_date'=>'2027-03-01']);}
        $finance=$this->staff('finance');$this->member($finance,$this->a['id']);$this->actingAs($finance);
        foreach(['payment_schedules','payments','invoices','commissions'] as $resource){
            $foreign=DB::table($resource)->when($resource==='payments',fn($q)=>$q->where('payment_schedule_id',DB::table('payment_schedules')->where('deal_id',$this->deals[3]['id'])->value('id')),fn($q)=>$q->where('deal_id',$this->deals[3]['id']))->value('id');
            $this->getJson('/api/records/'.$resource.'/'.$foreign)->assertNotFound();
        }
        $this->getJson('/api/workspace/finance?days=3660')->assertOk()->assertJsonPath('currency','EGP');
        $this->getJson('/api/workspace/profitability')->assertOk()->assertJsonCount(1,'data')->assertJsonPath('data.0.exhibition_id',$this->a['id']);
        $this->getJson('/api/workspace/cash-movements')->assertOk()->assertJsonMissing(['name'=>'Policy receipt 3']);
    }

    public function test_denial_and_grant_are_server_enforced_and_do_not_escalate_security_administration(): void
    {
        $this->overrides($this->sales,['deals.edit'=>false,'expenses.view'=>true]);$this->actingAs($this->sales);
        $meta=$this->getJson('/api/metadata')->assertOk()->json();
        $this->assertSame('denied',$meta['authorization']['permissions']['deals.edit']['source']);
        $this->putJson('/api/records/deals/'.$this->deals[0]['id'],$this->payloads[0])->assertForbidden();
        $this->getJson('/api/workspace/expenses')->assertOk();
        $this->putJson('/api/authorization/users/'.$this->sales->id,$this->accessPayload($this->sales))->assertForbidden();
        $this->overrides($this->sales,['permissions.manage'=>true,'users.edit'=>true]);$this->actingAs($this->sales);
        $this->getJson('/api/authorization/registry')->assertForbidden();
        $this->putJson('/api/records/users/'.$this->sales->id,['role'=>'super_admin'])->assertForbidden();
    }

    public function test_unknown_protected_self_and_stale_policy_changes_are_rejected(): void
    {
        $this->putJson('/api/authorization/users/'.$this->admin->id,$this->accessPayload($this->admin))->assertUnprocessable();
        $payload=$this->accessPayload($this->sales);
        $this->putJson('/api/authorization/users/'.$this->sales->id,[...$payload,'overrides'=>[['permission'=>'website.publish','effect'=>'allow']]])->assertUnprocessable();
        $this->putJson('/api/authorization/users/'.$this->sales->id,[...$payload,'overrides'=>[['permission'=>'permissions.manage','effect'=>'allow']]])->assertUnprocessable();
        $this->putJson('/api/authorization/users/'.$this->sales->id,[...$payload,'password'=>'wrong'])->assertUnprocessable();
        $this->putJson('/api/authorization/users/'.$this->sales->id,[...$payload,'version'=>99])->assertStatus(409);
        $this->assertSame(0,$this->sales->fresh()->auth_version);
    }

    public function test_confirmed_policy_changes_revoke_sessions_and_preserve_audit_without_secrets(): void
    {
        $payload=[...$this->accessPayload($this->sales),'exhibition_ids'=>[$this->a['id'],$this->b['id']],
            'overrides'=>[['permission'=>'deals.export','effect'=>'deny']]];
        $result=$this->putJson('/api/authorization/users/'.$this->sales->id,$payload)->assertOk()->json();
        $this->assertSame(1,$result['version']);$this->assertSame('denied',$result['effective']['permissions']['deals.export']['source']);
        $this->assertCount(2,$result['configuration']['exhibition_ids']);
        $audit=DB::table('audit_logs')->where('resource','authorization')->first();
        $this->assertStringNotContainsString(self::PASSWORD,$audit->after);$this->assertStringContainsString('Synthetic policy review',$audit->after);
        // Reproduce an already-issued browser stamp rather than adopting the new version.
        $this->actingAs($this->sales)->withSession([SessionRevocation::STAMP=>['user_id'=>$this->sales->id,'version'=>0]]);
        $this->getJson('/api/session')->assertUnauthorized();
    }

    public function test_event_reassignment_foreign_keys_and_assignees_cannot_bypass_scope(): void
    {
        $this->actingAs($this->sales);
        foreach([$this->b['id'],999999] as $event)$this->putJson('/api/records/deals/'.$this->deals[0]['id'],[...$this->payloads[0],'exhibition_id'=>$event])->assertNotFound();
        $this->putJson('/api/records/deals/'.$this->deals[0]['id'],[...$this->payloads[0],'salesperson_id'=>$this->other->id])->assertUnprocessable();
        $this->assertDatabaseHas('deals',['id'=>$this->deals[0]['id'],'exhibition_id'=>$this->a['id'],'salesperson_id'=>$this->sales->id]);
        $this->postJson('/api/records/tasks',['name'=>'Crafted','client_id'=>$this->clients[3]['id'],'assigned_user_id'=>$this->sales->id,'due_date'=>'2027-03-01','priority'=>'medium','status'=>'pending'])->assertNotFound();
    }

    public function test_shared_clients_are_not_duplicated_and_cross_event_edits_need_extra_permission(): void
    {
        $booth=$this->save('booths',['name'=>'SHARED-B','exhibition_id'=>$this->b['id'],'size_sqm'=>'10','price'=>'1000','currency'=>'USD']);
        $this->save('deals',[...$this->payloads[3],'name'=>'Shared other-event deal','client_id'=>$this->clients[0]['id'],'booth_id'=>$booth['id']]);
        $this->actingAs($this->sales);
        $this->getJson('/api/records/clients/'.$this->clients[0]['id'])->assertOk()->assertJsonMissing(['name'=>'Shared other-event deal']);
        $data=['name'=>'Shared revised','contact_person'=>'Synthetic','email'=>'policy0@example.test','type'=>'exhibitor','status'=>'prospect'];
        $this->putJson('/api/records/clients/'.$this->clients[0]['id'],$data)->assertForbidden();
        $this->overrides($this->sales,['clients.shared.edit'=>true]);$this->actingAs($this->sales);
        $this->putJson('/api/records/clients/'.$this->clients[0]['id'],$data)->assertOk();$this->assertSame(4,DB::table('clients')->count());
    }

    public function test_owned_unlinked_clients_and_personal_work_have_explicit_non_event_rules(): void
    {
        $this->actingAs($this->sales);
        $client=$this->postJson('/api/records/clients',['name'=>'Owned unlinked','contact_person'=>'Synthetic','email'=>'owned@example.test','type'=>'exhibitor','status'=>'prospect'])->assertCreated()->json('data');
        $this->getJson('/api/records/clients/'.$client['id'])->assertOk();
        $this->postJson('/api/records/tasks',['name'=>'Personal work','assigned_user_id'=>$this->sales->id,'due_date'=>'2027-03-01','priority'=>'medium','status'=>'pending'])->assertCreated();
        $this->postJson('/api/records/documents',['name'=>'Ambiguous client document','client_id'=>$client['id'],'type'=>'other','status'=>'draft'])->assertUnprocessable();
        $this->actingAs($this->peer);$this->getJson('/api/records/clients/'.$client['id'])->assertNotFound();
    }

    public function test_private_attachments_exports_and_sensitive_aliases_are_protected(): void
    {
        Storage::fake('local');
        $document=$this->save('documents',['name'=>'Foreign private document','deal_id'=>$this->deals[3]['id'],'client_id'=>$this->clients[3]['id'],'type'=>'other','status'=>'draft']);
        $attachment=$this->post('/api/documents/'.$document['id'].'/attachments',['file'=>UploadedFile::fake()->createWithContent('policy.txt','Synthetic private')],['Accept'=>'application/json'])->assertCreated()->json('data.id');
        $path=DB::table('attachments')->where('id',$attachment)->value('path');
        $this->actingAs($this->sales);$this->getJson('/api/attachments/'.$attachment)->assertNotFound();$this->deleteJson('/api/attachments/'.$attachment)->assertNotFound();Storage::disk('local')->assertExists($path);
        $this->postJson('/api/exports/records/deals',['ids'=>[$this->deals[3]['id']]])->assertNotFound();
        $this->postJson('/api/exports/records/deals',['ids'=>[$this->deals[0]['id']]])->assertOk()->assertJsonCount(1,'data');
        $this->overrides($this->sales,['deals.export'=>false]);$this->actingAs($this->sales);
        $this->postJson('/api/exports/records/deals',['ids'=>[$this->deals[0]['id']]])->assertForbidden();
        DB::table('deals')->where('id',$this->deals[0]['id'])->update(['attributes'=>json_encode(['contract_value'=>'900','total_price'=>'800'])]);
        $this->overrides($this->sales,['financial.fields.view'=>false]);$this->actingAs($this->sales);
        $this->getJson('/api/records/deals/'.$this->deals[0]['id'])->assertOk()->assertJsonMissingPath('data.amount')->assertJsonMissingPath('data.contract_value')->assertJsonMissingPath('data.total_price');
        $this->getJson('/api/dashboard')->assertOk()->assertJsonCount(0,'totals');
    }

    public function test_audit_notifications_and_reminders_do_not_reveal_inaccessible_records(): void
    {
        foreach([0,3] as $i)DB::table('notifications')->insert(['user_id'=>$this->sales->id,'resource'=>'deals','record_id'=>$this->deals[$i]['id'],'name'=>'Notice '.$i,'created_at'=>now(),'updated_at'=>now()]);
        $manager=$this->staff('management');$this->member($manager,$this->a['id']);$this->actingAs($manager);
        $audit=$this->getJson('/api/audit')->assertOk()->json('data');foreach($audit as $row){$this->assertArrayNotHasKey('before',$row);$this->assertArrayNotHasKey('after',$row);}
        $this->getJson('/api/workspace/audit?resource=deals&record='.$this->deals[3]['id'])->assertOk()->assertJsonCount(0,'data');
        $this->actingAs($this->sales);$this->getJson('/api/notifications')->assertOk()->assertJsonCount(1,'data')->assertJsonPath('data.0.name','Notice 0');
        $this->getJson('/api/workspace/timeline/deals/'.$this->deals[3]['id'])->assertNotFound();
    }

    public function test_staff_security_changes_require_confirmation_and_start_new_users_with_no_event_grants(): void
    {
        $data=['name'=>'New synthetic staff','email'=>'new-policy@example.test','role'=>'sales','status'=>'active','password'=>'NewStaffPassword!2026'];
        $this->postJson('/api/records/users',$data)->assertUnprocessable();
        $created=$this->postJson('/api/records/users',[...$data,'confirm_password'=>self::PASSWORD])->assertCreated()->json('data');
        $new=User::findOrFail($created['id']);$this->assertTrue($new->authorization_scoped);$this->assertFalse($new->all_exhibitions);
        $this->actingAs($new);$this->getJson('/api/records/deals')->assertOk()->assertJsonCount(0,'data');
    }

    public function test_standalone_work_and_indirect_messages_require_both_ownership_and_event_access(): void
    {
        $a=$this->save('channels',['name'=>'Allowed channel','exhibition_id'=>$this->a['id']]);
        $b=$this->save('channels',['name'=>'Restricted channel','exhibition_id'=>$this->b['id']]);
        $messageA=$this->save('messages',['name'=>'Allowed message','channel_id'=>$a['id']]);
        $messageB=$this->save('messages',['name'=>'Restricted message','channel_id'=>$b['id']]);
        $this->actingAs($this->sales);
        $this->getJson('/api/records/messages/'.$messageA['id'])->assertOk();
        $this->getJson('/api/records/messages/'.$messageB['id'])->assertNotFound();
        $this->postJson('/api/records/messages',['name'=>'Crafted','channel_id'=>$b['id']])->assertNotFound();
        $this->postJson('/api/records/tasks',['name'=>'Conflicting event','exhibition_id'=>$this->a['id'],'deal_id'=>$this->deals[3]['id'],
            'assigned_user_id'=>$this->sales->id,'due_date'=>'2027-03-01','priority'=>'medium','status'=>'pending'])->assertNotFound();
        $this->postJson('/api/records/tasks',['name'=>'Meeting context','exhibition_id'=>$this->a['id'],'deal_id'=>$this->deals[0]['id'],
            'assigned_user_id'=>$this->sales->id,'due_date'=>'2027-03-01','priority'=>'medium','status'=>'pending'])->assertCreated();
    }

    public function test_explicit_standalone_participation_shares_one_contact_without_a_fake_deal(): void
    {
        $this->actingAs($this->sales);
        $client=$this->postJson('/api/records/clients',['name'=>'Standalone contact','contact_person'=>'Synthetic','email'=>'standalone@example.test','type'=>'exhibitor','status'=>'prospect'])->assertCreated()->json('data');
        $dealCount=DB::table('deals')->count();
        $this->postJson('/api/records/tasks',['name'=>'Follow up without a deal','exhibition_id'=>$this->a['id'],'client_id'=>$client['id'],
            'assigned_user_id'=>$this->peer->id,'due_date'=>'2027-03-01','priority'=>'medium','status'=>'pending'])->assertCreated();
        $this->peer->forceFill(['record_scope'=>'own'])->save();$this->actingAs($this->peer);
        $this->getJson('/api/records/clients/'.$client['id'])->assertOk();
        $this->assertSame($dealCount,DB::table('deals')->count());
        $this->actingAs($this->other);$this->getJson('/api/records/clients/'.$client['id'])->assertNotFound();
    }

    public function test_payroll_fields_are_independent_of_global_financial_fields(): void
    {
        $employee=$this->save('employees',['name'=>'Payroll fixture','user_id'=>$this->sales->id,'department'=>'Sales','position'=>'Synthetic',
            'hire_date'=>'2027-01-01','salary'=>'1000','currency'=>'EGP','status'=>'active']);
        $hr=$this->staff('hr');$this->actingAs($hr);
        $this->getJson('/api/records/employees/'.$employee['id'])->assertOk()->assertJsonPath('data.salary','1000.00');
        $this->overrides($hr,['employees.salary.view'=>false]);$this->actingAs($hr);
        $this->getJson('/api/records/employees/'.$employee['id'])->assertOk()->assertJsonMissingPath('data.salary');
        $this->postJson('/api/exports/records/employees',['ids'=>[$employee['id']]])->assertForbidden();
        $this->getJson('/api/metadata')->assertOk()->assertJsonMissingPath('resources.employees.fields.salary');
    }

    public function test_current_recipient_access_is_checked_when_background_reminders_run(): void
    {
        $task=$this->save('tasks',['name'=>'Reminder target','exhibition_id'=>$this->a['id'],'assigned_user_id'=>$this->sales->id,
            'due_date'=>'2027-03-01','priority'=>'medium','status'=>'pending']);
        DB::table('reminders')->insert(['resource'=>'tasks','record_id'=>$task['id'],'user_id'=>$this->sales->id,'name'=>'Private reminder',
            'send_at'=>now()->subMinute(),'channel'=>'in_app','status'=>'pending','attempts'=>0,'created_by'=>$this->admin->id,'created_at'=>now(),'updated_at'=>now()]);
        $payload=[...$this->accessPayload($this->sales),'exhibition_ids'=>[]];
        $this->putJson('/api/authorization/users/'.$this->sales->id,$payload)->assertOk();
        $result=app(\App\Services\WorkflowService::class)->dispatchReminders();
        $this->assertSame(0,$result['sent']);$this->assertSame(1,$result['failed']);
        $this->assertSame(0,DB::table('notifications')->where('user_id',$this->sales->id)->count());
    }

    public function test_immutable_financial_operations_cannot_be_enabled_with_overrides(): void
    {
        $payload=[...$this->accessPayload($this->sales),'overrides'=>[['permission'=>'payments.delete','effect'=>'allow']]];
        $this->putJson('/api/authorization/users/'.$this->sales->id,$payload)->assertUnprocessable();
        $meta=$this->getJson('/api/metadata')->assertOk()->json('authorization.permissions');
        $this->assertFalse($meta['payments.delete']['allowed']);$this->assertFalse($meta['commissions.create']['allowed']);
        $this->assertSame('unavailable',$meta['payments.delete']['source']);
    }

    public function test_enrollment_is_explicit_and_cannot_be_downgraded_to_compatibility_mode(): void
    {
        $legacy=User::factory()->create(['role'=>'sales','status'=>'active','authorization_scoped'=>false]);
        $this->actingAs($legacy);$this->getJson('/api/records/deals')->assertOk()->assertJsonCount(4,'data');
        $this->actingAs($this->admin);$this->putJson('/api/authorization/users/'.$legacy->id,$this->accessPayload($legacy))->assertOk();
        $this->actingAs($legacy->fresh());$this->getJson('/api/records/deals')->assertOk()->assertJsonCount(3,'data');
        $this->actingAs($this->admin);$this->putJson('/api/authorization/users/'.$legacy->id,[...$this->accessPayload($legacy),'authorization_scoped'=>false])->assertUnprocessable();
    }

    public function test_scoped_sales_receipt_invoice_and_separate_commission_actions_complete_a_cycle(): void
    {
        $this->sales->forceFill(['record_scope'=>'own'])->save();$this->actingAs($this->sales);
        foreach (['meeting','strategy_proposal','objection_handling','terms_finalized','closed_won'] as $status) {
            $this->putJson('/api/records/deals/'.$this->deals[0]['id'],[...$this->payloads[0],'status'=>$status])->assertOk();
        }
        $finance=$this->staff('finance');$this->member($finance,$this->a['id']);
        $this->overrides($finance,['commissions.edit'=>false,'commissions.approve'=>true,'commissions.pay'=>true]);$this->actingAs($finance);
        $schedule=DB::table('payment_schedules')->where('deal_id',$this->deals[0]['id'])->first();
        $receipt=['name'=>'Scoped synthetic receipt','payment_schedule_id'=>$schedule->id,'amount'=>'1000','paid_date'=>'2027-01-01','method'=>'bank_transfer'];
        $this->postJson('/api/records/payments',$receipt)->assertCreated();
        $this->postJson('/api/records/payments',[...$receipt,'name'=>'Overpayment','amount'=>'0.01'])->assertUnprocessable();
        $invoice=$this->postJson('/api/records/invoices',['name'=>'SCOPED-INV-001','deal_id'=>$this->deals[0]['id'],'due_date'=>'2027-03-01'])->assertCreated()->json('data');
        $this->getJson('/api/records/invoices/'.$invoice['id'])->assertOk()->assertJsonPath('data.status','paid')->assertJsonPath('data.remaining_amount','0.00');
        $commission=DB::table('commissions')->where('deal_id',$this->deals[0]['id'])->first();
        $payload=['name'=>$commission->name,'deal_id'=>$commission->deal_id,'salesperson_id'=>$commission->salesperson_id,'amount'=>'50'];
        $this->putJson('/api/records/commissions/'.$commission->id,[...$payload,'status'=>'approved'])->assertOk();
        $this->putJson('/api/records/commissions/'.$commission->id,[...$payload,'status'=>'paid'])->assertOk();
        $this->putJson('/api/records/commissions/'.$commission->id,[...$payload,'name'=>'Unauthorized rename','status'=>'paid'])->assertForbidden();
        $this->assertDatabaseHas('commissions',['id'=>$commission->id,'amount'=>'50.00','status'=>'paid']);
        $this->assertDatabaseHas('booths',['id'=>$this->payloads[0]['booth_id'],'status'=>'sold']);
        $this->getJson('/api/records/payments')->assertOk()->assertJsonCount(1,'data');
        $this->deleteJson('/api/records/payments/'.DB::table('payments')->value('id'))->assertForbidden();
    }

    public function test_workflow_approval_grant_does_not_require_unrelated_direct_edit_authority(): void
    {
        $this->actingAs($this->sales);
        $request=$this->postJson('/api/workspace/requests',['kind'=>'commission_rate','deal_id'=>$this->deals[0]['id'],
            'reason'=>'Synthetic commission review','payload'=>['commission_percentage'=>'12']])->assertCreated()->json('data');
        $reviewer=$this->staff('sales');$this->member($reviewer,$this->a['id']);
        $this->overrides($reviewer,['workflow.commission_rate.approve'=>true,'deals.edit'=>false,'deals.pricing.edit'=>false]);$this->actingAs($reviewer);
        $this->postJson('/api/workspace/requests/'.$request['id'].'/review',['decision'=>'approved','review_note'=>'Reviewed synthetic rate'])->assertOk();
        $this->assertDatabaseHas('commissions',['deal_id'=>$this->deals[0]['id'],'amount'=>'120.00']);
        $this->putJson('/api/records/deals/'.$this->deals[0]['id'],$this->payloads[0])->assertForbidden();
        $this->postJson('/api/workspace/requests/'.$request['id'].'/review',['decision'=>'approved','review_note'=>'Replayed approval'])->assertUnprocessable();
    }

    public function test_mfa_policy_confirmation_rejects_missing_and_replayed_codes_without_partial_changes(): void
    {
        $totp=app(\App\Services\Totp::class);$secret=$totp->secret();$counter=(int) floor(time()/30);
        $this->admin->forceFill(['mfa_secret'=>\Illuminate\Support\Facades\Crypt::encryptString($secret),'mfa_confirmed_at'=>now(),'mfa_last_counter'=>$counter-1])->save();
        $payload=[...$this->accessPayload($this->sales),'overrides'=>[['permission'=>'clients.delete','effect'=>'deny']]];
        $before=$this->sales->fresh()->auth_version;
        $this->putJson('/api/authorization/users/'.$this->sales->id,$payload)->assertUnprocessable();
        $this->assertSame($before,$this->sales->fresh()->auth_version);
        $code=$totp->code($secret,$counter);
        $this->putJson('/api/authorization/users/'.$this->sales->id,[...$payload,'code'=>$code])->assertOk();
        $this->assertSame($before+1,$this->sales->fresh()->auth_version);
        $next=[...$this->accessPayload($this->peer),'code'=>$code];
        $this->putJson('/api/authorization/users/'.$this->peer->id,$next)->assertUnprocessable();
        $this->assertSame(0,$this->peer->fresh()->auth_version);
    }

    public function test_no_op_confirmation_preserves_epoch_and_second_administrator_cannot_overwrite_stale_policy(): void
    {
        $payload=$this->accessPayload($this->stranger);
        $this->putJson('/api/authorization/users/'.$this->stranger->id,$payload)->assertOk();
        $this->assertSame(0,$this->stranger->fresh()->auth_version);
        $this->assertSame(0,DB::table('audit_logs')->where('resource','authorization')->count());
        $this->putJson('/api/authorization/users/'.$this->stranger->id,[...$payload,'exhibition_ids'=>[]])->assertOk();
        $second=User::factory()->create(['role'=>'super_admin','status'=>'active','password'=>Hash::make(self::PASSWORD)]);$this->actingAs($second);
        $this->putJson('/api/authorization/users/'.$this->stranger->id,$payload)->assertStatus(409);
        $this->assertSame(1,$this->stranger->fresh()->auth_version);
        $this->assertSame(0,DB::table('exhibition_user')->where('user_id',$this->stranger->id)->count());
    }

    public function test_direct_expense_and_layout_endpoints_enforce_actions_and_foreign_events(): void
    {
        $finance=$this->staff('finance');$this->member($finance,$this->a['id']);$this->actingAs($finance);
        $expense=['exhibition_id'=>$this->b['id'],'name'=>'Foreign expense','category'=>'venue','amount'=>'20','currency'=>'USD','expense_date'=>'2027-01-01'];
        $this->postJson('/api/workspace/expenses',$expense)->assertNotFound();
        $this->overrides($finance,['expenses.create'=>false]);$this->actingAs($finance);
        $this->postJson('/api/workspace/expenses',[...$expense,'exhibition_id'=>$this->a['id'],'currency'=>'EGP'])->assertForbidden();
        $this->overrides($this->sales,['booths.layout.edit'=>true]);$this->actingAs($this->sales);
        $layout=['booth_id'=>$this->payloads[3]['booth_id'],'x'=>0,'y'=>0,'width'=>50,'height'=>50];
        $this->putJson('/api/workspace/floorplan',$layout)->assertNotFound();
        $this->overrides($this->sales,['booths.layout.edit'=>false]);$this->actingAs($this->sales);
        $this->putJson('/api/workspace/floorplan',[...$layout,'booth_id'=>$this->payloads[0]['booth_id']])->assertForbidden();
    }

    public function test_special_projections_and_search_do_not_bypass_sensitive_or_client_denials(): void
    {
        $this->save('deals',[...$this->payloads[0],'status'=>'closed_won'],$this->deals[0]['id']);
        $request=$this->postJson('/api/workspace/requests',['kind'=>'commission_rate','deal_id'=>$this->deals[0]['id'],
            'reason'=>'Synthetic private pricing request','payload'=>['commission_percentage'=>'12']])->assertCreated()->json('data');
        $manager=$this->staff('management');$this->member($manager,$this->a['id']);
        $this->overrides($manager,['financial.fields.view'=>false,'clients.view'=>false]);$this->actingAs($manager);
        $this->getJson('/api/exhibitors')->assertOk()->assertJsonMissingPath('data.0.amount')->assertJsonMissingPath('data.0.contact_person')->assertJsonMissingPath('data.0.name');
        $this->getJson('/api/records/deals?q=Client%200')->assertOk()->assertJsonCount(0,'data');
        $this->getJson('/api/workspace/requests')->assertOk()->assertJsonCount(0,'data');
        $this->postJson('/api/workspace/requests/'.$request['id'].'/review',['decision'=>'approved','review_note'=>'Attempt private approval'])->assertForbidden();
        $this->getJson('/api/metadata')->assertOk()->assertJsonMissingPath('resources.deals.fields.amount');
    }

    public function test_sensitive_pricing_denial_does_not_block_ordinary_status_edits(): void
    {
        $this->overrides($this->sales,['deals.pricing.edit'=>false]);$this->actingAs($this->sales);
        $this->putJson('/api/records/deals/'.$this->deals[0]['id'],[...$this->payloads[0],'status'=>'meeting'])->assertOk();
        $this->putJson('/api/records/deals/'.$this->deals[0]['id'],[...$this->payloads[0],'amount'=>'900'])->assertForbidden();
        $this->assertDatabaseHas('deals',['id'=>$this->deals[0]['id'],'amount'=>'1000.00']);
    }
}
