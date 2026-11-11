<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\CrmService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\SponsorDeliveryFixture as Fixture;
use Tests\TestCase;

class SponsorDeliveryTest extends TestCase
{
    use RefreshDatabase;

    public function test_confirmed_sponsorship_approval_delivery_amendments_and_scope(): void
    {
        $f = Fixture::create();
        $base = '/api/sponsor-delivery';
        $path = $base.'/'.$f['sponsor'];
        $manager = $f['manager'];
        $worker = $f['worker'];
        $terms = Fixture::terms($worker);
        DB::table('user_permission_overrides')->insert(['user_id' => $worker->id, 'permission' => 'documents.view', 'allowed' => false, 'granted_by' => $manager->id]);
        config(['sponsor_delivery.enabled' => false]);
        $this->actingAs($manager)->getJson($base)->assertStatus(503);
        config(['sponsor_delivery.enabled' => true]);
        $this->getJson($base.'?deal='.$f['sponsor'])->assertOk()->assertJsonPath('data.0.fulfillment', 'Deliverables not configured.');
        $this->postJson($base.'/'.$f['lead'], Fixture::command('create', 0, $terms))->assertNotFound();
        $this->postJson($base.'/'.$f['sector'], Fixture::command('create', 0, $terms + ['document_id' => $f['contract']]))->assertUnprocessable();

        $otherEvent = app(CrmService::class)->save('exhibitions', ['name' => 'Synthetic unrelated event', 'start_date' => '2027-06-01',
            'end_date' => '2027-06-03', 'location' => 'Synthetic', 'currency' => 'EGP', 'status' => 'planning'], $manager)['id'];
        $outsider = User::factory()->create(['role' => 'operations', 'status' => 'active', 'authorization_scoped' => true, 'record_scope' => 'all', 'all_exhibitions' => false]);
        DB::table('exhibition_user')->insert(['exhibition_id' => $otherEvent, 'user_id' => $outsider->id, 'granted_by' => $manager->id]);
        $this->actingAs($outsider)->getJson($path)->assertNotFound();
        $this->actingAs($manager)->postJson($path, Fixture::command('create', 0, array_replace($terms,
            ['assigned_user_id' => $outsider->id])))->assertUnprocessable();
        $unowned = User::factory()->create(['role' => 'operations', 'status' => 'active', 'authorization_scoped' => true, 'record_scope' => 'own', 'all_exhibitions' => false]);
        DB::table('exhibition_user')->insert(['exhibition_id' => $f['event'], 'user_id' => $unowned->id, 'granted_by' => $manager->id]);
        $this->actingAs($unowned)->getJson($path)->assertNotFound();
        $reader = User::factory()->create(['role' => 'sales', 'status' => 'active']);
        $this->actingAs($reader)->getJson($path)->assertForbidden();

        $draft = Fixture::command('create', 0, $terms + ['document_id' => $f['contract']]);
        $id = $this->actingAs($manager)->postJson($path, $draft)->assertOk()->assertJsonPath('status', 'draft')->json('id');
        $this->postJson($path, $draft)->assertOk()->assertJsonPath('id', $id);
        $this->postJson($path, array_replace($draft, ['title' => 'Different content']))->assertConflict();
        $this->getJson($base.'?deal='.$f['sponsor'])->assertOk()->assertJsonPath('data.0.approved', 0)
            ->assertJsonPath('data.0.fulfillment', 'No approved deliverables recorded.');
        $approval = Fixture::command('approve', 1, ['id' => $id]);
        $this->actingAs($worker)->postJson($path, $approval)->assertForbidden();
        $this->actingAs($manager)->postJson($path, $approval)->assertOk()->assertJsonPath('status', 'pending');
        $this->postJson($path, Fixture::command('edit', 2, $terms + ['id' => $id]))->assertConflict();

        app(CrmService::class)->save('sponsorship_packages', ['name' => 'Synthetic package', 'exhibition_id' => $f['event'],
            'price' => '500', 'tier' => 'silver', 'currency' => 'EGP', 'description' => 'Synthetic changed marketing copy'], $manager, $f['package']);
        $tables = ['deals', 'clients', 'sponsorship_packages', 'payments', 'payment_schedules', 'invoices',
            'commissions', 'booths', 'b2b_participants', 'portal_memberships', 'tasks'];
        $snapshot = fn () => array_map(fn ($table) => DB::table($table)->orderBy('id')->get()->toJson(), $tables);
        $before = $snapshot();
        $this->getJson($base.'?employee='.$worker->id.'&status=pending&due=2025-01-01&sponsor=Synthetic&exhibition='.$f['event'])
            ->assertOk()->assertJsonPath('data.0.overdue', 1)->assertJsonMissingPath('data.0.amount');
        $this->getJson($path)->assertOk()->assertJsonPath('items.data.0.title', $terms['title']);
        $this->postJson($path, Fixture::command('start', 2, ['id' => $id]))->assertForbidden();

        $this->actingAs($worker)->getJson($path)->assertOk()->assertJsonMissingPath('items.data.0.document_id');
        $this->getJson($path.'/'.$id.'/history')->assertOk()->assertJsonMissingPath('data.0.details.terms.document_id');
        $this->postJson($path, Fixture::command('start', 2, ['id' => $id]))->assertOk();
        $this->postJson($path, Fixture::command('progress', 3, ['id' => $id, 'note' => 'Synthetic progress']))->assertOk();
        $this->postJson($path, Fixture::command('submit', 4, ['id' => $id, 'note' => 'Synthetic staff claim']))->assertOk();
        $this->postJson($path, Fixture::command('fulfill', 5, ['id' => $id, 'note' => 'Attempted self verification']))->assertForbidden();
        $this->actingAs($manager)->postJson($path, Fixture::command('changes', 5, ['id' => $id, 'note' => 'Synthetic changes requested']))->assertOk();
        $this->actingAs($worker)->postJson($path, Fixture::command('submit', 6, ['id' => $id, 'note' => 'Synthetic corrected claim']))->assertOk();
        $this->actingAs($manager)->postJson($path, Fixture::command('fulfill', 7, ['id' => $id, 'note' => 'Synthetic organizer verification']))
            ->assertOk()->assertJsonPath('status', 'fulfilled');
        $this->getJson($base.'?deal='.$f['sponsor'])->assertOk()->assertJsonPath('data.0.fulfilled', 1)->assertJsonPath('data.0.fulfillment', 'Fulfilled');
        $this->postJson($path, Fixture::command('amend', 8, array_replace($terms, [
            'id' => $id, 'title' => 'Synthetic amended placement', 'document_id' => $f['contract'], 'note' => 'Synthetic approved amendment',
        ])))->assertOk()->assertJsonPath('status', 'pending');
        $this->getJson($path.'/'.$id.'/history')->assertOk()->assertJsonCount(9, 'data')
            ->assertJsonPath('data.0.details.terms.title', 'Synthetic amended placement')->assertJsonPath('data.7.details.terms.title', $terms['title']);
        $this->postJson($path, Fixture::command('cancel', 9, ['id' => $id]))->assertUnprocessable();
        $this->postJson($path, Fixture::command('cancel', 9, ['id' => $id, 'note' => 'Synthetic cancellation']))->assertOk();
        $this->getJson($base.'?deal='.$f['sponsor'])->assertOk()->assertJsonPath('data.0.fulfillment', 'No active commitments');

        $sector = $base.'/'.$f['sector'];
        $optional = array_replace($terms, ['required' => false]);
        $sectorId = $this->postJson($sector, Fixture::command('create', 0, $optional))->assertOk()->json('id');
        $this->postJson($sector, Fixture::command('approve', 1, ['id' => $sectorId]))->assertOk();
        $this->getJson($base.'?deal='.$f['sector'])->assertOk()->assertJsonPath('data.0.fulfillment', 'Optional commitments outstanding');
        $this->actingAs($worker)->postJson($sector, Fixture::command('start', 2, ['id' => $sectorId]))->assertOk();
        $this->postJson($sector, Fixture::command('submit', 3, ['id' => $sectorId, 'note' => 'Synthetic branding claim']))->assertOk();
        $this->actingAs($manager)->postJson($sector, Fixture::command('fulfill', 4, ['id' => $sectorId, 'note' => 'Synthetic branding verification']))->assertOk();
        $this->assertDatabaseHas('sponsor_deliverables', ['id' => $sectorId, 'exhibition_id' => $f['event'], 'client_id' => $f['client'],
            'deal_id' => $f['sector'], 'status' => 'fulfilled']);
        $this->assertDatabaseHas('deals', ['id' => $f['sector'], 'booth_id' => null]);
        $this->assertSame($before, $snapshot());
    }
}
