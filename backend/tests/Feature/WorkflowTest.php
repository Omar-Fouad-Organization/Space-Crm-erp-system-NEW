<?php
namespace Tests\Feature;
use App\Models\User;
use App\Services\{CrmService, Totp};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{DB, Hash, Crypt, Notification, Password};
use Tests\TestCase;
class WorkflowTest extends TestCase
{
    use RefreshDatabase;
    public function test_financial_list_queries_are_batched_without_stale_mutation_balances(): void
    {
        $f = $this->cycle("BATCH");
        $pack = $this->record("sponsorship_packages", [
            "name" => "Batch package",
            "exhibition_id" => $f["expo"]["id"],
            "tier" => "silver",
            "price" => "1000",
            "currency" => "EGP",
        ]);
        $rows = [];
        for ($i = 0; $i < 25; $i++) {
            $rows[] = [
                "name" => "Batch " . $i,
                "client_id" => $f["client"]["id"],
                "exhibition_id" => $f["expo"]["id"],
                "sponsorship_package_id" => $pack["id"],
                "type" => "sponsor",
                "salesperson_id" => $this->sales->id,
                "amount" => "1000",
                "currency" => "EGP",
                "status" => "talking",
                "commission_percentage" => "0",
                "created_by" => $this->admin->id,
                "created_at" => now(),
                "updated_at" => now(),
            ];
        }
        DB::table("deals")->insert($rows);
        DB::enableQueryLog();
        DB::flushQueryLog();
        $this->getJson("/api/records/deals?per_page=50")
            ->assertOk()
            ->assertJsonCount(26, "data");
        $queries = count(DB::getQueryLog());
        DB::disableQueryLog();
        $this->assertLessThanOrEqual(
            20,
            $queries,
            "List labels and financial balances must not issue queries per deal.",
        );
        $this->record("payments", [
            "name" => "FRESH-BALANCE",
            "payment_schedule_id" => $f["schedule"]["id"],
            "amount" => "100",
            "paid_date" => now()->toDateString(),
            "method" => "cash",
        ]);
        $this->getJson("/api/records/deals/" . $f["deal"]["id"])
            ->assertJsonPath("data.paid_amount", "100.00")
            ->assertJsonPath("data.remaining_amount", "900.00");
    }
    public function test_backup_rate_limit_is_independent_of_normal_navigation(): void
    {
        for ($i = 0; $i < 8; $i++) {
            $this->getJson("/api/metadata")->assertOk();
        }
        \Illuminate\Support\Facades\Artisan::shouldReceive("call")
            ->twice()
            ->with("crm:backup")
            ->andReturn(0);
        $this->postJson("/api/workspace/backup")->assertOk();
        $this->postJson("/api/workspace/backup")->assertOk();
        $this->postJson("/api/workspace/backup")->assertStatus(429);
    }
    private User $admin;
    private User $manager;
    private User $sales;
    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create([
            "role" => "super_admin",
            "status" => "active",
        ]);
        $this->manager = User::factory()->create([
            "role" => "management",
            "status" => "active",
        ]);
        $this->sales = User::factory()->create([
            "role" => "sales",
            "status" => "active",
        ]);
        DB::table("settings")->insert([
            "company_name" => "Test",
            "currency" => "EGP",
        ]);
        $this->actingAs($this->admin);
    }
    private function record($resource, $data): array
    {
        return $this->postJson("/api/records/" . $resource, $data)
            ->assertCreated()
            ->json("data");
    }
    private function cycle(string $suffix = "", bool $won = true): array
    {
        $client = $this->record("clients", [
            "name" => "Client " . $suffix,
            "contact_person" => "Test",
            "email" => "test" . $suffix . "@example.test",
            "type" => "exhibitor",
            "status" => "active",
        ]);
        $expo = $this->record("exhibitions", [
            "name" => "Expo " . $suffix,
            "location" => "Cairo",
            "start_date" => now()->addDays(10)->toDateString(),
            "end_date" => now()->addDays(12)->toDateString(),
            "status" => "planning",
            "currency" => "EGP",
        ]);
        $booth = $this->record("booths", [
            "name" => "A" . $suffix,
            "exhibition_id" => $expo["id"],
            "size_sqm" => "20",
            "price" => "1000",
            "currency" => "EGP",
        ]);
        $payload = [
            "name" => "Deal " . $suffix,
            "client_id" => $client["id"],
            "exhibition_id" => $expo["id"],
            "booth_id" => $booth["id"],
            "type" => "booth",
            "salesperson_id" => $this->sales->id,
            "amount" => "1000",
            "base_price" => "1000",
            "discount_percentage" => "0",
            "tax_percentage" => "0",
            "currency" => "EGP",
            "status" => $won ? "closed_won" : "talking",
            "commission_percentage" => "5",
        ];
        $deal = $this->record("deals", $payload);
        $schedule = $this->record("payment_schedules", [
            "name" => "Installment " . $suffix,
            "deal_id" => $deal["id"],
            "amount" => "1000",
            "due_date" => now()->subDays(40)->toDateString(),
        ]);
        return compact(
            "client",
            "expo",
            "booth",
            "deal",
            "schedule",
            "payload",
        );
    }
    private function request($kind, $f, $extra = []): array
    {
        return $this->postJson("/api/workspace/requests", [
            "kind" => $kind,
            "deal_id" => $f["deal"]["id"],
            "reason" => "Testing a reviewed workflow",
            ...$extra,
        ])
            ->assertCreated()
            ->json("data");
    }
    private function approve($w)
    {
        $this->actingAs($this->manager);
        $response = $this->postJson(
            "/api/workspace/requests/" . $w["id"] . "/review",
            [
                "decision" => "approved",
                "review_note" => "Reviewed against source records",
            ],
        );
        $this->actingAs($this->admin);
        return $response;
    }
    public function test_refund_reversal_credit_allocation_and_recollection_preserve_history(): void
    {
        $f = $this->cycle();
        $payment = $this->record("payments", [
            "name" => "RECEIPT",
            "payment_schedule_id" => $f["schedule"]["id"],
            "amount" => "600",
            "paid_date" => now()->toDateString(),
            "method" => "cash",
        ]);
        $w = $this->request("refund", $f, [
            "payment_id" => $payment["id"],
            "amount" => "100",
        ]);
        $this->postJson("/api/workspace/requests/" . $w["id"] . "/review", [
            "decision" => "approved",
            "review_note" => "Cannot approve my own request",
        ])->assertUnprocessable();
        $this->approve($w)->assertOk();
        $this->approve($w)->assertUnprocessable();
        $this->getJson("/api/records/deals/" . $f["deal"]["id"])
            ->assertJsonPath("data.paid_amount", "500.00")
            ->assertJsonPath("data.remaining_amount", "500.00");
        $over = $this->request("refund", $f, [
            "payment_id" => $payment["id"],
            "amount" => "501",
        ]);
        $this->approve($over)->assertUnprocessable();
        $partial = $this->request("receipt_reversal", $f, [
            "payment_id" => $payment["id"],
            "amount" => "100",
        ]);
        $this->approve($partial)->assertUnprocessable();
        $credit = $this->request("credit_note", $f, [
            "payment_schedule_id" => $f["schedule"]["id"],
            "amount" => "200",
        ]);
        $this->approve($credit)->assertOk();
        $this->getJson("/api/records/payment_schedules/" . $f["schedule"]["id"])
            ->assertJsonPath("data.remaining_amount", "300.00")
            ->assertJsonPath("data.credit_amount", "200.00");
        $this->record("payments", [
            "name" => "FINAL",
            "payment_schedule_id" => $f["schedule"]["id"],
            "amount" => "300",
            "paid_date" => now()->toDateString(),
            "method" => "cash",
        ]);
        $this->getJson(
            "/api/records/deals/" . $f["deal"]["id"],
        )->assertJsonPath("data.remaining_amount", "0.00");
        $commission = DB::table("commissions")
            ->where("deal_id", $f["deal"]["id"])
            ->first();
        $c = (array) $commission;
        $c["status"] = "approved";
        $this->putJson(
            "/api/records/commissions/" . $commission->id,
            $c,
        )->assertOk();
        $c["status"] = "paid";
        $this->putJson(
            "/api/records/commissions/" . $commission->id,
            $c,
        )->assertOk();
        $recovery = $this->request("commission_recovery", $f, [
            "commission_id" => $commission->id,
            "amount" => "10",
        ]);
        $this->approve($recovery)->assertOk();
        $this->getJson(
            "/api/records/commissions/" . $commission->id,
        )->assertJsonPath("data.recovered_amount", "10.00");
        $reverse = $this->request("receipt_reversal", $f, [
            "payment_id" => $payment["id"],
            "amount" => "500",
        ]);
        $this->approve($reverse)->assertOk();
        $this->record("payments", [
            "name" => "REPLACEMENT",
            "payment_schedule_id" => $f["schedule"]["id"],
            "amount" => "500",
            "paid_date" => now()->toDateString(),
            "method" => "cash",
        ]);
        $this->assertDatabaseHas("payments", [
            "id" => $payment["id"],
            "amount" => "600.00",
        ]);
        $this->assertDatabaseHas("commissions", [
            "id" => $commission->id,
            "amount" => "50.00",
            "status" => "paid",
        ]);
        $this->getJson(
            "/api/records/deals/" . $f["deal"]["id"],
        )->assertJsonPath("data.remaining_amount", "0.00");
        $this->getJson("/api/workspace/finance?days=30")
            ->assertOk()
            ->assertJsonPath("metrics.payments_collected", "800.00")
            ->assertJsonPath("metrics.commission_paid", "40.00");
    }
    public function test_correction_rejects_cross_deal_references_and_credit_overallocation(): void
    {
        $a = $this->cycle("A");
        $b = $this->cycle("B");
        $p = $this->record("payments", [
            "name" => "OTHER",
            "payment_schedule_id" => $b["schedule"]["id"],
            "amount" => "10",
            "paid_date" => now()->toDateString(),
            "method" => "cash",
        ]);
        $this->postJson("/api/workspace/requests", [
            "kind" => "refund",
            "deal_id" => $a["deal"]["id"],
            "payment_id" => $p["id"],
            "amount" => "1",
            "reason" => "Mismatched payment reference",
        ])->assertUnprocessable();
        $this->postJson("/api/workspace/requests", [
            "kind" => "credit_note",
            "deal_id" => $a["deal"]["id"],
            "payment_schedule_id" => $b["schedule"]["id"],
            "amount" => "1",
            "reason" => "Mismatched installment reference",
        ])->assertUnprocessable();
        $w = $this->request("credit_note", $a, [
            "payment_schedule_id" => $a["schedule"]["id"],
            "amount" => "1001",
        ]);
        $this->approve($w)->assertUnprocessable();
    }
    public function test_discount_commission_and_extended_terms_require_distinct_review(): void
    {
        $f = $this->cycle("", false);
        $this->putJson("/api/records/deals/" . $f["deal"]["id"], [
            ...$f["payload"],
            "discount_percentage" => "25",
            "amount" => "750",
        ])->assertUnprocessable();
        $w = $this->request("discount", $f, [
            "payload" => ["discount_percentage" => "25"],
        ]);
        $this->approve($w)->assertUnprocessable(); // Existing installments cannot exceed discounted value.
        DB::table("payment_schedules")
            ->where("id", $f["schedule"]["id"])
            ->delete();
        $this->approve($w)->assertOk();
        $this->assertDatabaseHas("deals", [
            "id" => $f["deal"]["id"],
            "amount" => "750.00",
            "discount_percentage" => "25.00",
        ]);
        $rate = $this->request("commission_rate", $f, [
            "payload" => ["commission_percentage" => "12"],
        ]);
        $this->approve($rate)->assertOk();
        $this->assertDatabaseHas("commissions", [
            "deal_id" => $f["deal"]["id"],
            "amount" => "120.00",
        ]);
        $schedule = $this->record("payment_schedules", [
            "name" => "Approved terms",
            "deal_id" => $f["deal"]["id"],
            "amount" => "750",
            "due_date" => now()->addDay()->toDateString(),
        ]);
        $terms = $this->request("payment_terms", $f, [
            "payment_schedule_id" => $schedule["id"],
            "payload" => ["due_date" => now()->addDays(100)->toDateString()],
        ]);
        $this->approve($terms)->assertOk();
        $this->assertDatabaseHas("payment_schedules", [
            "id" => $schedule["id"],
            "due_date" => now()->addDays(100)->toDateString(),
        ]);
    }
    public function test_finance_period_filter_and_profitability_separate_currencies(): void
    {
        $f = $this->cycle();
        $this->record("payments", [
            "name" => "OLD",
            "payment_schedule_id" => $f["schedule"]["id"],
            "amount" => "100",
            "paid_date" => now()->subDays(40)->toDateString(),
            "method" => "cash",
        ]);
        $this->record("payments", [
            "name" => "NEW",
            "payment_schedule_id" => $f["schedule"]["id"],
            "amount" => "200",
            "paid_date" => now()->toDateString(),
            "method" => "cash",
        ]);
        $this->getJson("/api/workspace/finance?days=7&currency=EGP")
            ->assertOk()
            ->assertJsonPath("metrics.payments_collected", "200.00");
        $this->getJson(
            "/api/workspace/finance?days=90&currency=EGP",
        )->assertJsonPath("metrics.payments_collected", "300.00");
        $this->getJson(
            "/api/workspace/finance?days=90&currency=USD",
        )->assertJsonPath("metrics.payments_collected", "0.00");
        $this->postJson("/api/workspace/expenses", [
            "exhibition_id" => $f["expo"]["id"],
            "name" => "Venue",
            "category" => "venue",
            "amount" => "100",
            "currency" => "EGP",
            "expense_date" => now()->toDateString(),
            "reference" => "EXP-1",
        ])->assertCreated();
        $this->getJson("/api/workspace/profitability")->assertJsonPath(
            "data.0.contribution",
            "850.00",
        );
    }
    public function test_own_and_team_scope_apply_to_lists_details_links_timeline_and_pagination(): void
    {
        $f = $this->cycle("OWN");
        $other = $this->cycle("OTHER");
        DB::table("deals")
            ->where("id", $other["deal"]["id"])
            ->update(["salesperson_id" => $this->manager->id]);
        DB::table("users")
            ->where("id", $this->sales->id)
            ->update(["record_scope" => "own"]);
        $this->sales->refresh();
        $this->actingAs($this->sales);
        $this->getJson("/api/records/deals?per_page=1")
            ->assertOk()
            ->assertJsonCount(1, "data")
            ->assertJsonPath("total", 1);
        $this->getJson(
            "/api/records/deals/" . $other["deal"]["id"],
        )->assertNotFound();
        $this->getJson(
            "/api/workspace/timeline/deals/" . $other["deal"]["id"],
        )->assertNotFound();
        $this->getJson(
            "/api/workspace/timeline/deals/" . $f["deal"]["id"],
        )->assertOk();
        $this->getJson("/api/exhibitors")->assertJsonCount(1, "data");
        $this->postJson("/api/records/proposals", [
            "name" => "Bad reference",
            "deal_id" => $other["deal"]["id"],
            "status" => "draft",
        ])->assertNotFound();
        $this->getJson("/api/workspace/audit")->assertForbidden();
        $this->actingAs($this->admin);
        $team = $this->postJson("/api/workspace/teams", ["name" => "Team"])
            ->assertCreated()
            ->json("id");
        $this->putJson("/api/workspace/access/" . $this->sales->id, [
            "record_scope" => "team",
            "team_id" => $team,
        ])->assertOk();
        $this->putJson("/api/workspace/access/" . $this->manager->id, [
            "record_scope" => "all",
            "team_id" => $team,
        ])->assertOk();
        $this->sales->refresh();
        $this->actingAs($this->sales);
        $this->getJson("/api/records/deals")->assertJsonCount(2, "data");
    }
    public function test_import_preview_detects_duplicates_and_commit_is_atomic(): void
    {
        $csv =
            "name,contact_person,email\nNew Client,Jane,jane@example.test\nSecond,John,not-an-email\n";
        $this->postJson("/api/workspace/import/clients", ["csv" => $csv])
            ->assertOk()
            ->assertJsonPath("valid", false);
        $this->postJson("/api/workspace/import/clients", [
            "csv" => $csv,
            "commit" => true,
        ])->assertUnprocessable();
        $this->assertDatabaseCount("clients", 0);
        $csv = "name,contact_person,email\nNew Client,Jane,jane@example.test\n";
        $this->postJson("/api/workspace/import/clients", [
            "csv" => $csv,
        ])->assertJsonPath("valid", true);
        $this->postJson("/api/workspace/import/clients", [
            "csv" => $csv,
            "commit" => true,
        ])->assertJsonPath("imported", 1);
        $this->postJson("/api/workspace/import/clients", [
            "csv" => $csv,
        ])->assertJsonPath("valid", false);
        $this->assertDatabaseCount("clients", 1);
    }
    public function test_reminder_delivery_is_idempotent_and_failed_mail_is_not_claimed_delivered(): void
    {
        $f = $this->cycle();
        $this->postJson("/api/workspace/reminders", [
            "resource" => "payment_schedules",
            "record_id" => $f["schedule"]["id"],
            "user_id" => $this->admin->id,
            "name" => "Check payment",
            "send_at" => now()->addMinutes(2)->toIso8601String(),
            "channel" => "in_app",
        ])->assertCreated();
        DB::table("reminders")->update(["send_at" => now()->subMinute()]);
        $before = DB::table("notifications")->count();
        $this->artisan("crm:reminders")->assertSuccessful();
        $this->artisan("crm:reminders")->assertSuccessful();
        $this->assertDatabaseCount("notifications", $before + 1);
        $this->assertDatabaseHas("reminders", [
            "status" => "delivered",
            "attempts" => 1,
        ]);
        config(["mail.default" => "log"]);
        $this->postJson("/api/workspace/reminders", [
            "resource" => "payment_schedules",
            "record_id" => $f["schedule"]["id"],
            "user_id" => $this->admin->id,
            "name" => "No fake email",
            "send_at" => now()->addMinutes(2)->toIso8601String(),
            "channel" => "email",
        ])->assertUnprocessable();
        DB::table("reminders")->insert([
            "resource" => "payment_schedules",
            "record_id" => $f["schedule"]["id"],
            "user_id" => $this->admin->id,
            "name" => "Transport fails",
            "send_at" => now()->subMinute(),
            "channel" => "email",
            "created_by" => $this->admin->id,
            "created_at" => now(),
            "updated_at" => now(),
        ]);
        for ($i = 0; $i < 4; $i++) {
            $this->artisan("crm:reminders")->assertSuccessful();
        }
        $this->assertDatabaseHas("reminders", [
            "name" => "Transport fails",
            "status" => "failed",
            "attempts" => 3,
        ]);
    }
    public function test_collection_assignment_floorplan_and_expiration_keep_relations(): void
    {
        $f = $this->cycle("", false);
        DB::table("deals")
            ->where("id", $f["deal"]["id"])
            ->update(["status" => "closed_won"]);
        $this->getJson("/api/workspace/collections")->assertJsonPath(
            "data.0.aging",
            "31–60 days",
        );
        $this->postJson("/api/workspace/collection-notes", [
            "payment_schedule_id" => $f["schedule"]["id"],
            "assigned_user_id" => $this->admin->id,
            "note" => "Called client",
            "next_follow_up" => now()->addDay()->toDateString(),
        ])->assertCreated();
        $this->getJson("/api/workspace/collections")->assertJsonPath(
            "data.0.notes.0.note",
            "Called client",
        );
        $this->putJson("/api/workspace/floorplan", [
            "booth_id" => $f["booth"]["id"],
            "x" => 10,
            "y" => 20,
            "width" => 100,
            "height" => 100,
        ])->assertOk();
        $this->getJson("/api/workspace/floorplan")->assertJsonPath(
            "data.0.x",
            10,
        );
        $this->putJson("/api/workspace/floorplan", [
            "booth_id" => $f["booth"]["id"],
            "x" => 950,
            "y" => 20,
            "width" => 100,
            "height" => 100,
        ])->assertUnprocessable();
        $this->assertDatabaseHas("collection_notes", [
            "payment_schedule_id" => $f["schedule"]["id"],
        ]);
        DB::table("deals")
            ->where("id", $f["deal"]["id"])
            ->update(["status" => "talking"]);
        $this->postJson("/api/workspace/reservations/" . $f["deal"]["id"], [
            "expires_at" => now()->addMinutes(3)->toIso8601String(),
        ])->assertOk();
        DB::table("deals")
            ->where("id", $f["deal"]["id"])
            ->update(["reservation_expires_at" => now()->subMinute()]);
        $this->artisan("crm:expire-reservations")->assertSuccessful();
        $this->assertDatabaseHas("deals", [
            "id" => $f["deal"]["id"],
            "status" => "cancelled",
        ]);
        $this->assertDatabaseHas("booths", [
            "id" => $f["booth"]["id"],
            "status" => "available",
        ]);
        $this->assertDatabaseHas("commissions", [
            "deal_id" => $f["deal"]["id"],
            "amount" => "0.00",
        ]);
    }
    public function test_authenticator_rfc_vector_login_replay_and_secret_redaction(): void
    {
        $totp = new Totp();
        $this->assertSame(
            "287082",
            $totp->code("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 1),
        );
        $secret = $totp->secret();
        $password = "StrongPassword!2026";
        DB::table("users")
            ->where("id", $this->admin->id)
            ->update([
                "password" => Hash::make($password),
                "mfa_secret" => Crypt::encryptString($secret),
                "mfa_confirmed_at" => now(),
                "mfa_last_counter" => null,
            ]);
        $this->getJson(
            "/api/records/users/" . $this->admin->id,
        )->assertJsonMissingPath("data.mfa_secret");
        app(CrmService::class)->audit(
            "users",
            $this->admin->id,
            "check",
            $this->admin->id,
            DB::table("users")->find($this->admin->id),
            null,
        );
        $this->assertStringNotContainsString(
            "mfa_secret",
            DB::table("audit_logs")->orderByDesc("id")->value("before"),
        );
        $this->postJson("/api/logout")->assertOk();
        $this->postJson("/api/login", [
            "email" => $this->admin->email,
            "password" => $password,
        ])->assertUnprocessable();
        $code = $totp->code($secret, intdiv(time(), 30));
        $this->postJson("/api/login", [
            "email" => $this->admin->email,
            "password" => $password,
            "code" => $code,
        ])->assertOk();
        $this->postJson("/api/logout");
        $this->postJson("/api/login", [
            "email" => $this->admin->email,
            "password" => $password,
            "code" => $code,
        ])->assertUnprocessable();
    }
    public function test_server_pagination_search_and_filters_cover_rows_beyond_first_page(): void
    {
        $rows = [];
        for ($i = 0; $i < 125; $i++) {
            $rows[] = [
                "name" => sprintf("Client %03d", $i),
                "contact_person" => "Contact " . $i,
                "email" => "person" . $i . "@example.test",
                "type" => $i % 2 ? "sponsor" : "exhibitor",
                "status" => "active",
                "created_by" => $this->admin->id,
                "created_at" => now(),
                "updated_at" => now(),
            ];
        }
        DB::table("clients")->insert($rows);
        $this->getJson("/api/records/clients?per_page=50&page=1")
            ->assertJsonCount(50, "data")
            ->assertJsonPath("total", 125)
            ->assertJsonPath("last_page", 3);
        $this->getJson(
            "/api/records/clients?per_page=50&page=3",
        )->assertJsonCount(25, "data");
        $this->getJson(
            "/api/records/clients?q=person124%40example.test",
        )->assertJsonCount(1, "data");
        $this->getJson("/api/records/clients?type=sponsor")->assertJsonPath(
            "total",
            62,
        );
        $this->getJson(
            "/api/records/clients?per_page=1000",
        )->assertUnprocessable();
        $this->getJson(
            "/api/workspace/search?q=Contact%20124",
        )->assertJsonCount(1, "data");
    }
    public function test_security_enrollment_replay_disable_and_session_ids_stay_private(): void
    {
        $password = "EnrollmentPassword!2026";
        $this->admin->forceFill(["password" => Hash::make($password)])->save();
        $this->postJson("/api/security/enroll", [
            "password" => "wrong",
        ])->assertUnprocessable();
        $secret = $this->postJson("/api/security/enroll", [
            "password" => $password,
        ])
            ->assertOk()
            ->json("secret");
        $totp = new Totp();
        $counter = intdiv(time(), 30);
        $code = $totp->code($secret, $counter);
        $this->postJson("/api/security/confirm", ["code" => $code])->assertOk();
        $this->admin->refresh();
        $this->postJson("/api/security/disable", [
            "password" => $password,
            "code" => $code,
        ])->assertUnprocessable();
        $this->postJson("/api/security/disable", [
            "password" => $password,
            "code" => $totp->code($secret, $counter + 1),
        ])->assertOk();
        $this->assertNull($this->admin->fresh()->mfa_secret);
        DB::table("sessions")->insert([
            "id" => "private-test-session-token",
            "user_id" => $this->admin->id,
            "payload" => "",
            "last_activity" => time(),
        ]);
        $this->getJson("/api/security")
            ->assertOk()
            ->assertJsonMissing(["id" => "private-test-session-token"]);
        $this->postJson("/api/security/revoke", [
            "password" => $password,
        ])->assertOk();
        $this->assertDatabaseMissing("sessions", [
            "id" => "private-test-session-token",
        ]);
    }
    public function test_active_reminders_block_delete_until_cancelled(): void
    {
        $f = $this->cycle();
        $task = $this->record("tasks", [
            "name" => "Reminder target",
            "assigned_user_id" => $this->admin->id,
            "status" => "pending",
            "priority" => "medium",
            "due_date" => now()->addDay()->toDateString(),
        ]);
        $id = $this->postJson("/api/workspace/reminders", [
            "resource" => "tasks",
            "record_id" => $task["id"],
            "user_id" => $this->admin->id,
            "name" => "Pending alert",
            "send_at" => now()->addHour()->toIso8601String(),
            "channel" => "in_app",
        ])
            ->assertCreated()
            ->json("id");
        $this->deleteJson(
            "/api/records/tasks/" . $task["id"],
        )->assertUnprocessable();
        $this->postJson(
            "/api/workspace/reminders/" . $id . "/cancel",
        )->assertOk();
        $this->deleteJson(
            "/api/records/tasks/" . $task["id"],
        )->assertNoContent();
        $this->postJson(
            "/api/workspace/reminders/" . $id . "/cancel",
        )->assertUnprocessable();
    }
    public function test_password_reset_invalid_token_and_recovery_preserves_mfa(): void
    {
        Notification::fake();
        config(["mail.default" => "smtp"]);
        $this->postJson("/api/password/forgot", [
            "email" => $this->admin->email,
        ])->assertOk();
        Notification::assertSentTo(
            $this->admin,
            \Illuminate\Auth\Notifications\ResetPassword::class,
        );
        $token = Password::createToken($this->admin);
        $new = "ReplacementPassword!2026";
        $this->postJson("/api/password/reset", [
            "email" => $this->admin->email,
            "token" => "bad",
            "password" => $new,
            "password_confirmation" => $new,
        ])->assertUnprocessable();
        $this->postJson("/api/password/reset", [
            "email" => $this->admin->email,
            "token" => $token,
            "password" => $new,
            "password_confirmation" => $new,
        ])->assertOk();
        $this->assertTrue(Hash::check($new, $this->admin->fresh()->password));
        // The password reset now invalidates the existing authenticated browser too.
        $this->getJson('/api/session')->assertUnauthorized();
        $this->postJson("/api/password/reset", [
            "email" => $this->admin->email,
            "token" => $token,
            "password" => $new,
            "password_confirmation" => $new,
        ])->assertUnprocessable();
    }
}
