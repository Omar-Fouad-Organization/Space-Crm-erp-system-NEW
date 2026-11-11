<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\{B2BProfiles, CrmService, ParticipantAuthority};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\B2BFixture;
use Tests\TestCase;

class ExhibitorReadinessTest extends TestCase
{
    use RefreshDatabase;

    private function membership(array $fixture, int $participant, string $role = 'owner'): array
    {
        $identity = (string) Str::uuid();
        $membership = (string) Str::uuid();
        DB::table('portal_identity_controls')->insert(['identity_id' => $identity, 'reviewed_by' => $fixture['user']->id]);
        DB::table('portal_memberships')->insert([
            'id' => $membership, 'identity_id' => $identity, 'participant_id' => $participant,
            'exhibition_id' => $fixture['event'], 'role' => $role, 'status' => 'active',
            'capabilities' => json_encode(ParticipantAuthority::ROLES[$role]),
            'approval_evidence' => B2BProfiles::seal(['reference' => 'Synthetic reviewed authority']),
            'reviewed_by' => $fixture['user']->id,
        ]);
        return ['identity_id' => $identity, 'membership_id' => $membership, 'exhibition_id' => $fixture['event'],
            'operation' => 'readiness', 'payload' => [],
            'authentication' => ['device_id' => (string) Str::uuid(), 'auth_version' => 1]];
    }

    private function signed(array $payload): \Illuminate\Testing\TestResponse
    {
        $target = '/api/internal/participant-portal/command';
        $body = json_encode($payload, JSON_THROW_ON_ERROR);
        $claims = ['version' => 1, 'purpose' => 'SPACE-PARTICIPANT-V1', 'issuer' => 'green-life-portal',
            'audience' => 'space-participant-api', 'key_id' => 'primary', 'issued_at' => time(), 'expires_at' => time()+30,
            'nonce' => (string) Str::uuid(), 'method' => 'POST', 'target' => $target, 'body_sha256' => hash('sha256', $body)];
        $encoded = rtrim(strtr(base64_encode(json_encode($claims)), '+/', '-_'), '=');
        return $this->call('POST', $target, [], [], [], ['CONTENT_TYPE' => 'application/json', 'CONTENT_LENGTH' => strlen($body),
            'HTTP_ACCEPT' => 'application/json', 'HTTP_X_SPACE_PORTAL' => $encoded,
            'HTTP_X_SPACE_PORTAL_SIGNATURE' => hash_hmac('sha256', $encoded, str_repeat('p', 40))], $body);
    }

    private function snapshots(): array
    {
        $tables = ['clients', 'deals', 'booths', 'payment_schedules', 'payments', 'invoices', 'commissions', 'b2b_meetings', 'b2b_participants'];
        return array_map(fn ($table) => DB::table($table)->orderBy('id')->get()->toJson(), $tables);
    }

    public function test_signed_submission_review_handover_and_commercial_preservation(): void
    {
        $fixture = B2BFixture::create();
        config(['participant_portal.enabled' => true, 'participant_portal.keys.primary' => str_repeat('p', 40)]);
        $staff = $fixture['user'];
        $event = $fixture['event'];
        $base = '/api/b2b/readiness/'.$event;
        $this->actingAs($staff)->getJson($base)->assertStatus(503);
        config(['b2b.readiness_enabled' => true]);
        $this->getJson($base)->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('data.0.status', 'not_configured');
        $other = app(CrmService::class)->save('exhibitions', ['name' => 'Synthetic other event', 'start_date' => '2027-03-01',
            'end_date' => '2027-03-02', 'location' => 'Synthetic', 'currency' => 'EGP', 'status' => 'planning'], $staff)['id'];
        $definition = ['version' => 0, 'title_en' => 'Synthetic information', 'title_ar' => 'معلومات تجريبية',
            'type' => 'information', 'required' => true, 'active' => true, 'display_order' => 1, 'due_date' => '2027-01-01'];
        $info = $this->postJson($base.'/requirements', $definition)->assertOk()->json('id');
        $approval = $this->postJson($base.'/requirements', [...$definition, 'title_en' => 'Synthetic staff approval',
            'type' => 'organizer_approval', 'display_order' => 2])->assertOk()->json('id');
        $this->getJson('/api/b2b/readiness/'.$other)->assertOk()->assertJsonCount(0, 'requirements');
        $participant = DB::table('b2b_participants')->find($fixture['participants'][0][1]);
        $deal = DB::table('deals')->find($participant->deal_id);
        $crm = app(CrmService::class);
        $package = $crm->save('sponsorship_packages', ['name' => 'Synthetic branding only', 'exhibition_id' => $event,
            'tier' => 'silver', 'price' => '500', 'currency' => 'EGP'], $staff);
        $commercial = ['client_id' => $deal->client_id, 'exhibition_id' => $event, 'salesperson_id' => $staff->id,
            'amount' => '500', 'currency' => 'EGP', 'commission_percentage' => '0'];
        $sponsor = $crm->save('deals', [...$commercial, 'name' => 'Synthetic sponsorship', 'type' => 'sector_sponsor',
            'status' => 'closed_won', 'sponsorship_package_id' => $package['id']], $staff);
        $this->postJson($base.'/'.$sponsor['id'].'/handover', ['client_id' => $deal->client_id, 'booth_id' => $deal->booth_id])->assertNotFound();
        $unconfirmed = $crm->save('booths', ['name' => 'Synthetic reserved booth', 'exhibition_id' => $event,
            'size_sqm' => '10', 'price' => '500', 'currency' => 'EGP'], $staff);
        $lead = $crm->save('deals', [...$commercial, 'name' => 'Synthetic unconfirmed applicant', 'type' => 'booth',
            'status' => 'lead_created', 'booth_id' => $unconfirmed['id']], $staff);
        $this->postJson($base.'/'.$lead['id'].'/handover', ['client_id' => $deal->client_id, 'booth_id' => $unconfirmed['id']])->assertNotFound();
        $this->getJson($base)->assertOk()->assertJsonCount(2, 'data');
        $before = $this->snapshots();
        $member = $this->membership($fixture, $participant->id);
        $second = $this->membership($fixture, $fixture['participants'][1][1]);
        $buyer = $this->membership($fixture, $fixture['participants'][0][0]);
        $this->signed($member)->assertOk()->assertJsonCount(2, 'readiness.items')->assertJsonPath('readiness.booth.name', 'B2B-0')
            ->assertJsonMissingPath('readiness.deal_id')->assertJsonMissingPath('readiness.handover');
        $this->signed($buyer)->assertForbidden();
        $enquiry = DB::table('intake_submissions')->insertGetId([
            'source_id' => (string) Str::uuid(), 'source_system' => 'synthetic', 'site' => 'test', 'source_form' => 'exhibitor',
            'type' => 'exhibitor', 'exhibition_id' => $event, 'original_payload' => B2BProfiles::seal([]),
            'source_hash' => str_repeat('a', 64), 'name' => 'Synthetic exhibitor enquiry', 'email' => 'enquiry@example.test',
            'country' => 'Egypt', 'language' => 'en', 'submitted_at' => now(), 'status' => 'received',
        ]);
        $this->signed([...$member, 'identity_id' => (string) Str::uuid()])->assertForbidden();
        $this->assertDatabaseHas('intake_submissions', ['id' => $enquiry, 'client_id' => null, 'status' => 'received']);
        $this->signed([...$member, 'exhibition_id' => $other])->assertForbidden();
        $this->signed([...$member, 'membership_id' => $second['membership_id']])->assertForbidden();
        $fields = ['requirement_id' => $info, 'requirement_version' => 1, 'version' => 0];
        $submission = [...$member, 'operation' => 'readiness.submit', 'command_id' => (string) Str::uuid(),
            'payload' => [...$fields, 'response' => 'Synthetic initial response']];
        $this->signed([...$submission, 'payload' => [...$submission['payload'], 'action' => 'approve']])->assertUnprocessable();
        $receipt = $this->signed($submission)->assertOk()->assertJsonPath('status', 'submitted')->json();
        $this->signed($submission)->assertOk()->assertExactJson($receipt);
        $this->signed([...$submission, 'command_id' => (string) Str::uuid()])->assertConflict();
        $this->signed($second)->assertOk()->assertJsonPath('readiness.items.0.response', null);
        $this->assertDatabaseCount('readiness_results', 1);
        $this->assertDatabaseCount('readiness_history', 1);
        $review = $base.'/'.$deal->id.'/review';
        $decision = [...$fields, 'version' => 1, 'action' => 'request_changes', 'reason' => 'Private synthetic reason',
            'feedback' => 'Please clarify the setup details.'];
        $this->postJson($review, $decision)->assertOk()->assertJsonPath('status', 'changes_requested');
        $this->postJson($review, $decision)->assertConflict();
        $this->signed($member)->assertOk()->assertJsonPath('readiness.items.0.feedback', $decision['feedback'])
            ->assertJsonMissingPath('readiness.items.0.history')->assertDontSee('Private synthetic reason');
        $submission['command_id'] = (string) Str::uuid();
        $submission['payload'] = [...$fields, 'version' => 2, 'response' => 'Synthetic revised response'];
        $this->signed($submission)->assertOk()->assertJsonPath('version', 3);
        $this->postJson($review, [...$fields, 'version' => 3, 'action' => 'review', 'reason' => 'Checked'])
            ->assertOk()->assertJsonPath('status', 'under_review');
        $this->postJson($review, [...$fields, 'version' => 4, 'action' => 'approve', 'reason' => 'Checked'])->assertOk();
        $this->postJson($base.'/requirements', [...$definition, 'id' => $info, 'version' => 1, 'title_en' => 'Changed'])->assertUnprocessable();
        $this->getJson($base.'?search=B2B-0&item_status=approved&due=2027-01-01')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.status', 'pending')->assertJsonPath('data.0.items.0.history.0.employee_id', $staff->id);
        $this->assertDatabaseCount('readiness_handovers', 0);
        $handover = ['client_id' => $deal->client_id, 'booth_id' => $deal->booth_id, 'note' => 'Synthetic physical handover'];
        $id = $this->postJson($base.'/'.$deal->id.'/handover', $handover)->assertOk()->json('id');
        $this->postJson($base.'/'.$deal->id.'/handover', $handover)->assertOk()->assertJsonPath('id', $id);
        $this->postJson($base.'/'.$deal->id.'/handover', [...$handover, 'booth_id' => $deal->booth_id+1])->assertConflict();
        $this->postJson($review, [...$fields, 'requirement_id' => $approval, 'action' => 'approve', 'reason' => 'Organizer confirmed'])->assertOk();
        $this->signed($member)->assertOk()->assertJsonPath('readiness.status', 'ready');
        $this->assertDatabaseHas('readiness_handovers', ['id' => $id, 'employee_id' => $staff->id, 'booth_id' => $deal->booth_id, 'exhibition_id' => $event]);
        $this->assertDatabaseCount('readiness_handovers', 1);
        $document = $this->postJson($base.'/requirements', [...$definition, 'type' => 'document', 'required' => false,
            'title_en' => 'Synthetic document'])->assertOk()->json('id');
        $this->postJson($review, [...$fields, 'requirement_id' => $document, 'action' => 'approve', 'reason' => 'Unavailable'])->assertUnprocessable();
        $this->signed([...$submission, 'command_id' => (string) Str::uuid(),
            'payload' => [...$fields, 'requirement_id' => $document, 'response' => 'Unsupported document']])->assertUnprocessable();
        $this->assertSame($before, $this->snapshots());
        $reader = $this->membership($fixture, $participant->id, 'reader');
        $this->signed([...$submission, ...array_intersect_key($reader, array_flip(['identity_id','membership_id']))])->assertForbidden();
        DB::table('portal_memberships')->where('id', $member['membership_id'])->update(['revoked_at' => now()]);
        $this->signed($submission)->assertForbidden();
        $outsider = User::factory()->create(['role' => 'support', 'status' => 'active', 'authorization_scoped' => true]);
        foreach (['b2b.view', 'b2b.readiness.view', 'b2b.readiness.configure', 'exhibitions.view'] as $permission) {
            DB::table('user_permission_overrides')->insert(['user_id' => $outsider->id, 'permission' => $permission,
                'allowed' => true, 'granted_by' => $staff->id]);
        }
        DB::table('exhibition_user')->insert(['user_id' => $outsider->id, 'exhibition_id' => $other, 'granted_by' => $staff->id]);
        $this->actingAs($outsider)->postJson($review, $decision)->assertForbidden();
        $this->postJson($base.'/requirements', $definition)->assertNotFound();
    }
}
