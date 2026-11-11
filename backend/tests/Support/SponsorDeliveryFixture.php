<?php

namespace Tests\Support;

use App\Models\User;
use App\Services\CrmService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SponsorDeliveryFixture
{
    public static function create(): array
    {
        config(['authorization.enabled' => true, 'sponsor_delivery.enabled' => true]);
        $manager = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $worker = User::factory()->create(['role' => 'sales', 'status' => 'active', 'authorization_scoped' => true, 'record_scope' => 'own', 'all_exhibitions' => false]);
        $crm = app(CrmService::class);
        $event = $crm->save('exhibitions', ['name' => 'Synthetic exhibition', 'start_date' => '2027-05-01',
            'end_date' => '2027-05-03', 'location' => 'Synthetic', 'currency' => 'EGP', 'status' => 'planning'], $manager)['id'];
        $client = $crm->save('clients', ['name' => 'Synthetic sponsor', 'contact_person' => 'Test',
            'email' => 'sponsor@example.test', 'type' => 'sponsor', 'status' => 'active'], $manager)['id'];
        $package = $crm->save('sponsorship_packages', ['name' => 'Synthetic package', 'exhibition_id' => $event,
            'tier' => 'silver', 'price' => '500', 'currency' => 'EGP'], $manager)['id'];
        DB::table('exhibition_user')->insert(['exhibition_id' => $event, 'user_id' => $worker->id, 'granted_by' => $manager->id]);
        foreach (['view', 'progress'] as $permission) {
            DB::table('user_permission_overrides')->insert(['user_id' => $worker->id, 'permission' => 'sponsor_delivery.'.$permission,
                'allowed' => true, 'granted_by' => $manager->id]);
        }
        $commercial = ['client_id' => $client, 'exhibition_id' => $event, 'sponsorship_package_id' => $package,
            'amount' => '500', 'currency' => 'EGP', 'commission_percentage' => '2', 'salesperson_id' => $worker->id];
        $sponsor = $crm->save('deals', $commercial + ['name' => 'Synthetic confirmed sponsorship', 'type' => 'sponsor', 'status' => 'closed_won'], $manager)['id'];
        $sector = $crm->save('deals', $commercial + ['name' => 'Synthetic sector sponsorship', 'type' => 'sector_sponsor', 'status' => 'closed_won'], $manager)['id'];
        $lead = $crm->save('deals', $commercial + ['name' => 'Synthetic preliminary sponsorship', 'type' => 'sponsor', 'status' => 'lead_created'], $manager)['id'];
        $contract = $crm->save('documents', ['name' => 'Synthetic reviewed contract', 'deal_id' => $sponsor, 'client_id' => $client,
            'type' => 'contract', 'status' => 'approved'], $manager)['id'];

        return compact('manager', 'worker', 'event', 'client', 'package', 'sponsor', 'sector', 'lead', 'contract');
    }

    public static function command(string $action, int $version, array $fields = []): array
    {
        return $fields + ['action' => $action, 'version' => $version, 'request_id' => (string) Str::uuid()];
    }

    public static function terms($worker): array
    {
        return ['title' => 'Synthetic branding placement', 'description' => 'Synthetic negotiated placement for test only',
            'assigned_user_id' => $worker->id, 'due_date' => '2025-01-01', 'required' => true];
    }
}
