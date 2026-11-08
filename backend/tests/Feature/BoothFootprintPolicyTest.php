<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\CrmService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\B2BFixture;
use Tests\TestCase;

class BoothFootprintPolicyTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(): array
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $event = app(CrmService::class)->save('exhibitions', ['name' => 'SYNTHETIC Green Life binding', 'start_date' => '2027-01-01', 'end_date' => '2027-01-03', 'location' => 'Synthetic', 'currency' => 'EGP', 'status' => 'planning'], $admin);
        $this->actingAs($admin);
        return [$admin, $event['id']];
    }

    private function activate(User $admin, int $event): void
    {
        config(['booth_policy.configuration_authorized' => true]);
        $this->artisan('booths:configure-green-life-policy', ['exhibition' => $event, '--reviewed-by' => $admin->id, '--reason' => 'Synthetic business approval for policy tests', '--activate' => true])->assertSuccessful();
    }

    private function payload(int $event, array $extra = []): array
    {
        return [...['name' => 'SYNTHETIC-BOOTH', 'exhibition_id' => $event, 'size_sqm' => '12.00', 'price' => '1000.00', 'currency' => 'EGP'], ...$extra];
    }

    public static function footprints(): array
    {
        return [
            'minimum' => ['3', '4', '12.00', true], 'rotated' => ['4', '3', '12.00', true],
            'larger' => ['4', '5', '20.00', true], 'precision' => ['3.01', '4.01', '12.07', true],
            'narrow equal area' => ['2', '6', '12.00', false], 'too small' => ['3', '3', '9.00', false],
            'narrow larger area' => ['2.5', '5', '12.50', false], 'claimed wrong area' => ['3', '4', '16.00', false],
            'too precise' => ['3.001', '4', '12.00', false], 'negative' => ['-3', '4', '12.00', false],
        ];
    }

    #[DataProvider('footprints')]
    public function test_api_enforces_the_bound_rectangular_footprint(string $width, string $depth, string $area, bool $accepted): void
    {
        [$admin, $event] = $this->fixture();
        $this->activate($admin, $event);
        $response = $this->postJson('/api/records/booths', $this->payload($event, ['footprint_width_m' => $width, 'footprint_depth_m' => $depth, 'size_sqm' => $area]));
        if ($accepted) {
            $response->assertCreated()->assertJsonPath('data.size_sqm', $area)->assertJsonPath('data.footprint_policy_version', 'green_life_3x4_v1');
            $this->assertDatabaseHas('booths', ['id' => $response->json('data.id'), 'exhibition_id' => $event, 'size_sqm' => $area]);
        } else {
            $response->assertUnprocessable();
            $this->assertDatabaseCount('booths', 0);
        }
    }

    public function test_area_only_and_client_claimed_legacy_or_custom_labels_cannot_bypass_a_new_policy(): void
    {
        [$admin, $event] = $this->fixture();
        $this->activate($admin, $event);
        $this->postJson('/api/records/booths', $this->payload($event))->assertUnprocessable()->assertJsonValidationErrors('footprint_width_m');
        $this->postJson('/api/records/booths', $this->payload($event, ['footprint_policy_version' => 'legacy']))->assertUnprocessable();
        $this->postJson('/api/records/booths', $this->payload($event, ['attributes' => ['booth_type' => 'Custom'], 'footprint_width_m' => '2', 'footprint_depth_m' => '6']))->assertUnprocessable();
        $this->assertDatabaseCount('booths', 0);
    }

    public function test_historical_area_only_booth_and_financial_records_survive_policy_and_unrelated_edits(): void
    {
        $f = B2BFixture::create();
        $admin = $f['user'];
        $this->actingAs($admin);
        $booth = DB::table('booths')->where('exhibition_id', $f['event'])->first();
        $before = [];
        foreach (['deals', 'payment_schedules', 'payments', 'invoices', 'commissions'] as $table) {
            $before[$table] = json_encode(DB::table($table)->orderBy('id')->get());
        }
        $this->activate($admin, $f['event']);
        $payload = $this->payload($f['event'], ['name' => $booth->name, 'size_sqm' => '10.00', 'notes' => 'Synthetic unrelated legacy note']);
        $this->putJson('/api/records/booths/'.$booth->id, $payload)->assertOk()->assertJsonPath('data.size_sqm', '10.00')->assertJsonPath('data.footprint_width_m', null);
        $this->putJson('/api/records/booths/'.$booth->id, [...$payload, 'size_sqm' => '20.00', 'footprint_width_m' => '4', 'footprint_depth_m' => '5'])->assertUnprocessable()->assertJsonValidationErrors('size_sqm');
        foreach ($before as $table => $snapshot) {
            $this->assertSame($snapshot, json_encode(DB::table($table)->orderBy('id')->get()), $table.' changed unexpectedly');
        }
        $this->assertDatabaseHas('booths', ['id' => $booth->id, 'size_sqm' => '10.00', 'status' => $booth->status, 'price' => $booth->price, 'footprint_width_m' => null]);
    }

    public function test_other_event_with_identical_name_keeps_area_only_rules_but_cannot_move_into_policy_without_dimensions(): void
    {
        [$admin, $event] = $this->fixture();
        $other = app(CrmService::class)->save('exhibitions', ['name' => 'SYNTHETIC Green Life binding', 'start_date' => '2027-02-01', 'end_date' => '2027-02-03', 'location' => 'Synthetic', 'currency' => 'EGP', 'status' => 'planning'], $admin);
        $this->activate($admin, $event);
        $created = $this->postJson('/api/records/booths', $this->payload($other['id'], ['size_sqm' => '9.00']))->assertCreated()->json('data');
        $this->putJson('/api/records/booths/'.$created['id'], $this->payload($event, ['size_sqm' => '9.00']))->assertUnprocessable();
        $this->assertDatabaseHas('booths', ['id' => $created['id'], 'exhibition_id' => $other['id'], 'size_sqm' => '9.00']);
    }

    public function test_policy_activation_requires_explicit_approval_and_cannot_overwrite_an_existing_binding(): void
    {
        [$admin, $event] = $this->fixture();
        $args = ['exhibition' => $event, '--reviewed-by' => $admin->id, '--reason' => 'Synthetic reviewed event approval'];
        $this->artisan('booths:configure-green-life-policy', $args)->assertSuccessful();
        $this->artisan('booths:configure-green-life-policy', [...$args, '--activate' => true])->assertFailed();
        $this->assertDatabaseCount('exhibition_booth_policies', 0);
        $this->activate($admin, $event);
        $this->getJson('/api/records/exhibitions/'.$event)->assertOk()->assertJsonPath('data.booth_policy.min_short_m', '3.00');
        $this->postJson('/api/records/booths', $this->payload($event, ['footprint_width_m' => '3', 'footprint_depth_m' => '4']))->assertCreated();
        $this->artisan('booths:configure-green-life-policy', [...$args, '--activate' => true])->assertFailed();
        $this->assertDatabaseCount('exhibition_booth_policies', 1);
    }
}
