<?php

namespace Tests\Feature;

use App\Http\Controllers\ParticipantAdministrationController;
use App\Http\Controllers\ParticipantGatewayController;
use App\Jobs\DeliverParticipantInvitation;
use App\Mail\ParticipantInvitationMail;
use App\Services\ParticipantDeliveryCipher;
use App\Services\ParticipantDeliveryFailure;
use App\Services\ParticipantInvitationDelivery;
use App\Services\ParticipantInvitationMailer;
use App\Services\ParticipantInvitations;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Mail\Mailer;
use Illuminate\Mail\PendingMail;
use Illuminate\Mail\SentMessage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\Support\B2BFixture;
use Tests\TestCase;

class ParticipantVerifiedEmailTest extends TestCase
{
    use RefreshDatabase;

    private function enable(): void
    {
        config(['participant_portal.enabled' => true, 'participant_portal.keys.primary' => str_repeat('g', 40),
            'participant_onboarding.enabled' => true, 'participant_onboarding.sandbox' => true,
            'participant_onboarding.website_origin' => 'http://127.0.0.1:18891', 'participant_onboarding.mailer' => 'array',
            'participant_onboarding.from_address' => 'synthetic@example.test', 'participant_onboarding.from_name' => 'Synthetic SPACE',
            'participant_onboarding.keys.primary' => 'base64:'.base64_encode(str_repeat('k', 32))]);
        Queue::fake();
    }

    private function issue(array $fixture): array
    {
        $r = Request::create('/', 'POST', ['action' => 'invite', 'participant_id' => $fixture['participants'][0][1],
            'payload' => ['email' => 'synthetic@example.test', 'role' => 'owner', 'locale' => 'ar', 'evidence' => 'Synthetic approved representative identity and authority']]);
        $r->setUserResolver(fn () => $fixture['user']);

        return app(ParticipantAdministrationController::class)->command($r)->getData(true);
    }

    private function secret(array $inv): string
    {
        $row = DB::table('portal_invitation_deliveries')->where('id', $inv['delivery_id'])->first();

        return app(ParticipantDeliveryCipher::class)->open($row->key_id, $row->secret_payload)['token'];
    }

    private function redeem(string $token, string $identity): array
    {
        $r = Request::create('/', 'POST', [], [], [], ['CONTENT_TYPE' => 'application/json'], json_encode(['email' => 'synthetic@example.test', 'token' => $token, 'identity_id' => $identity]));

        return app(ParticipantGatewayController::class)->activate($r);
    }

    public function test_verified_email_is_durable_secret_free_to_staff_and_redeems_once_after_delivery(): void
    {
        $this->enable();
        $f = B2BFixture::create();
        $inv = $this->issue($f);
        $token = $this->secret($inv);
        $this->assertArrayNotHasKey('token', $inv);
        $this->assertGreaterThanOrEqual(64, strlen($token));
        $this->assertStringNotContainsString($token, json_encode(DB::table('portal_invitation_deliveries')->first()));
        try {
            $this->redeem($token, (string) Str::uuid());
            $this->fail('Undelivered proof accepted');
        } catch (HttpException $e) {
            $this->assertSame(403, $e->getStatusCode());
        }
        Mail::fake();
        $sent = app(ParticipantInvitationDelivery::class)->deliver($inv['delivery_id']);
        $this->assertSame('sandbox_accepted', $sent['state']);
        Mail::assertSent(ParticipantInvitationMail::class);
        $this->assertNull(DB::table('portal_invitation_deliveries')->value('secret_payload'));
        $identity = (string) Str::uuid();
        $one = $this->redeem($token, $identity);
        $this->assertSame('verified_email_sandbox', $one['proof_channel']);
        $this->assertSame($one, $this->redeem($token, $identity));
        $this->assertSame(1, DB::table('portal_memberships')->count());
        try {
            $this->redeem($token, (string) Str::uuid());
            $this->fail('Proof reused by different identity');
        } catch (HttpException $e) {
            $this->assertSame(409, $e->getStatusCode());
        }
        $this->assertDatabaseHas('portal_invitation_events', ['invitation_id' => $inv['id'], 'event' => 'redemption_rejected']);
        Queue::assertPushed(DeliverParticipantInvitation::class, fn ($job) => $job->deliveryId === $inv['delivery_id'] && ! str_contains(serialize($job), $token));
    }

    public function test_resend_rotates_proof_and_cancels_old_intent_without_erasing_history(): void
    {
        $this->enable();
        $f = B2BFixture::create();
        $inv = $this->issue($f);
        $old = $this->secret($inv);
        $this->travel(61)->seconds();
        $next = DB::transaction(fn () => app(ParticipantInvitations::class)->resend(DB::table('b2b_participants')->where('id', $f['participants'][0][1])->first(), $f['user'], $inv['id'], 'Synthetic recipient requested a fresh delivery'));
        $this->assertSame(2, $next['generation']);
        $this->assertNotSame($old, $this->secret($next));
        $this->assertDatabaseHas('portal_invitation_deliveries', ['id' => $inv['delivery_id'], 'state' => 'cancelled', 'secret_payload' => null]);
        $this->assertSame(2, DB::table('portal_invitation_deliveries')->count());
        try {
            $this->redeem($old, (string) Str::uuid());
            $this->fail('Rotated proof accepted');
        } catch (HttpException $e) {
            $this->assertSame(403, $e->getStatusCode());
        }
    }

    public function test_known_temporary_failure_retries_boundedly_and_unknown_failure_never_blindly_resends(): void
    {
        $this->enable();
        $f = B2BFixture::create();
        $inv = $this->issue($f);
        $this->mock(ParticipantInvitationMailer::class)->shouldReceive('send')->once()->andThrow(new ParticipantDeliveryFailure('temporary'));
        $this->assertSame('pending', app(ParticipantInvitationDelivery::class)->deliver($inv['delivery_id'])['state']);
        $row = DB::table('portal_invitation_deliveries')->first();
        $this->assertNotNull($row->secret_payload);
        $this->assertNotNull($row->next_attempt_at);
        $this->travel(61)->seconds();
        $this->app->forgetInstance(ParticipantInvitationDelivery::class);
        $this->mock(ParticipantInvitationMailer::class)->shouldReceive('send')->once()->andThrow(new \RuntimeException('Simulated ambiguous timeout'));
        $this->assertSame('delivery_unknown', app(ParticipantInvitationDelivery::class)->deliver($inv['delivery_id'])['state']);
        $this->assertSame('delivery_unknown', app(ParticipantInvitationDelivery::class)->deliver($inv['delivery_id'])['state']);
        $this->assertNull(DB::table('portal_invitation_deliveries')->value('secret_payload'));
        $this->assertSame(2, DB::table('portal_invitation_deliveries')->value('attempts'));
    }

    public function test_revoked_membership_cannot_be_reopened_by_a_previously_redeemed_invitation(): void
    {
        $this->enable();
        $f = B2BFixture::create();
        $inv = $this->issue($f);
        $token = $this->secret($inv);
        Mail::fake();
        app(ParticipantInvitationDelivery::class)->deliver($inv['delivery_id']);
        $id = (string) Str::uuid();
        $membership = $this->redeem($token, $id);
        DB::table('portal_memberships')->where('id', $membership['membership_id'])->update(['status' => 'revoked', 'revoked_at' => now()]);
        try {
            $this->redeem($token, $id);
            $this->fail('Revoked authority restored');
        } catch (HttpException $e) {
            $this->assertSame(403, $e->getStatusCode());
        }
        $this->assertDatabaseHas('portal_memberships', ['id' => $membership['membership_id'], 'status' => 'revoked']);
    }

    public function test_environment_label_does_not_enable_operational_raw_tokens_or_sandbox(): void
    {
        $this->enable();
        config(['participant_onboarding.sandbox' => false, 'participant_onboarding.test_invites' => false]);
        $f = B2BFixture::create();
        try {
            $this->issue($f);
            $this->fail('Unconfigured real delivery accepted');
        } catch (HttpException $e) {
            $this->assertSame(503, $e->getStatusCode());
        }
        $this->assertDatabaseCount('portal_access_invitations', 0);
        $this->assertDatabaseCount('portal_invitation_deliveries', 0);
    }

    public function test_expired_delivery_secret_is_erased_without_deleting_invitation_or_audit(): void
    {
        $this->enable();
        $f = B2BFixture::create();
        $inv = $this->issue($f);
        $events = DB::table('portal_invitation_events')->count();
        DB::table('portal_invitation_deliveries')->where('id', $inv['delivery_id'])->update(['expires_at' => now()->subSecond()]);
        config(['participant_onboarding.enabled' => false]);
        $this->artisan('portal:purge-delivery-secrets')->assertSuccessful();
        $this->assertDatabaseHas('portal_invitation_deliveries', ['id' => $inv['delivery_id'], 'secret_payload' => null, 'state' => 'cancelled']);
        $this->assertDatabaseHas('portal_access_invitations', ['id' => $inv['id'], 'status' => 'issued']);
        $this->assertSame($events, DB::table('portal_invitation_events')->count());
    }

    public function test_sandbox_proof_is_rejected_outside_the_explicit_isolated_sandbox(): void
    {
        $this->enable();
        $f = B2BFixture::create();
        $inv = $this->issue($f);
        $token = $this->secret($inv);
        config(['participant_onboarding.sandbox' => false]);
        try {
            $this->redeem($token, (string) Str::uuid());
            $this->fail('Sandbox proof became operational');
        } catch (HttpException $e) {
            $this->assertSame(503, $e->getStatusCode());
        }
        $this->assertDatabaseCount('portal_memberships', 0);
    }

    public static function secureSmtpSchemes(): array
    {
        return ['implicit_tls' => ['smtps'], 'required_starttls' => ['smtp']];
    }

    #[DataProvider('secureSmtpSchemes')]
    public function test_operational_protocol_uses_a_fake_approved_transport_without_any_network_mail(string $scheme): void
    {
        $this->enable();
        config(['app.debug' => false, 'cache.default' => 'database', 'queue.default' => 'database',
            'participant_onboarding.sandbox' => false, 'participant_onboarding.live_mail_authorized' => true, 'participant_onboarding.sender_approved' => true, 'participant_onboarding.tracking_disabled_approved' => true,
            'participant_onboarding.sender_domain' => 'example.test', 'participant_onboarding.mailer' => 'participant_onboarding', 'participant_onboarding.website_origin' => 'https://portal.example.test',
            'mail.mailers.participant_onboarding.transport' => 'smtp', 'mail.mailers.participant_onboarding.scheme' => $scheme, 'mail.mailers.participant_onboarding.verify_peer' => true,
            'mail.mailers.participant_onboarding.host' => 'smtp.example.test', 'mail.mailers.participant_onboarding.username' => 'synthetic-only', 'mail.mailers.participant_onboarding.password' => 'synthetic-placeholder-not-an-operational-credential']);
        $sent = \Mockery::mock(SentMessage::class);
        $sent->shouldReceive('getMessageId')->once()->andReturn('synthetic-provider-reference');
        $pending = \Mockery::mock(PendingMail::class);
        $pending->shouldReceive('send')->once()->andReturn($sent);
        $mailer = \Mockery::mock(Mailer::class);
        $mailer->shouldReceive('to')->once()->with('synthetic@example.test')->andReturn($pending);
        Mail::shouldReceive('mailer')->once()->with('participant_onboarding')->andReturn($mailer);
        $f = B2BFixture::create();
        $inv = $this->issue($f);
        $token = $this->secret($inv);
        $this->assertArrayNotHasKey('token', $inv);
        $this->assertSame('provider_accepted', app(ParticipantInvitationDelivery::class)->deliver($inv['delivery_id'])['state']);
        $this->assertSame('verified_email', $this->redeem($token, (string) Str::uuid())['proof_channel']);
        $this->assertDatabaseCount('portal_memberships', 1);
    }
}
