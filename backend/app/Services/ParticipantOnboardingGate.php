<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class ParticipantOnboardingGate
{
    public function isolated(): bool
    {
        $connection = config('database.connections.mysql');

        return app()->environment('testing')
            && config('database.default') === 'mysql'
            && in_array($connection['host'] ?? '', ['127.0.0.1', 'localhost'], true)
            && empty($connection['url'])
            && in_array($connection['database'] ?? '', ['space_crm_test', 'space_crm_phase6_ui_test'], true)
            && DB::selectOne('SELECT DATABASE() AS name')->name === $connection['database'];
    }

    public function testInvites(): bool
    {
        return config('participant_onboarding.test_invites') && $this->isolated();
    }

    public function sandbox(): bool
    {
        return config('participant_onboarding.sandbox') && $this->isolated();
    }

    public function assertReady(): void
    {
        abort_unless(config('participant_portal.enabled') && config('participant_onboarding.enabled'), 503, 'Verified-email onboarding is disabled.');
        $origin = parse_url((string) config('participant_onboarding.website_origin'));
        $sandbox = $this->sandbox();
        abort_unless($origin && ! empty($origin['host']) && empty($origin['user']) && empty($origin['pass']) && empty($origin['query']) && empty($origin['fragment']) && empty($origin['path'])
            && (($origin['scheme'] ?? '') === 'https' || ($sandbox && ($origin['scheme'] ?? '') === 'http' && in_array($origin['host'] ?? '', ['127.0.0.1', 'localhost'], true))), 503, 'Approved participant website origin is required.');
        $mailer = config('mail.mailers.'.config('participant_onboarding.mailer'), []);
        if ($sandbox) {
            abort_unless(($mailer['transport'] ?? '') === 'array', 503, 'Isolated delivery requires the non-network array transport.');
        } else {
            abort_if(config('app.debug'), 503, 'Debug mode must be disabled for operational onboarding.');
            abort_unless(config('participant_onboarding.live_mail_authorized') && config('participant_onboarding.sender_approved') && config('participant_onboarding.tracking_disabled_approved'), 503, 'Live transactional mail requires explicit configuration approvals.');
            $from = (string) config('participant_onboarding.from_address');
            $domain = (string) config('participant_onboarding.sender_domain');
            abort_unless(filter_var($from, FILTER_VALIDATE_EMAIL) && $domain !== '' && str_ends_with(strtolower($from), '@'.strtolower($domain)), 503, 'Approved sender identity is required.');
            abort_unless(($mailer['transport'] ?? '') === 'smtp' && (($mailer['scheme'] ?? '') === 'smtps' || (($mailer['scheme'] ?? '') === 'smtp' && ($mailer['require_tls'] ?? false) === true && ($mailer['auto_tls'] ?? true) === true)) && ! empty($mailer['host']) && ! empty($mailer['username']) && ! empty($mailer['password']) && ($mailer['verify_peer'] ?? true) === true, 503, 'Authenticated TLS mail transport is required.');
            abort_unless(in_array(config('cache.default'), ['redis', 'database', 'memcached'], true) && in_array(config('queue.default'), ['redis', 'database', 'sqs'], true), 503, 'Shared cache and durable queue are required.');
        }
        abort_unless(strlen((string) config('participant_portal.keys.primary')) >= 32, 503, 'Participant gateway authentication is not configured.');
        app(ParticipantDeliveryCipher::class)->assertConfigured();
    }

    public function assertProof(object $invitation): void
    {
        if (in_array($invitation->proof_channel ?? null, ['verified_email', 'verified_email_sandbox'], true)) {
            if ($invitation->proof_channel === 'verified_email_sandbox') {
                abort_unless($this->sandbox(), 503, 'Isolated sandbox proofs cannot authorize operational onboarding.');
            }
            $this->assertReady();
            abort_unless(DB::table('portal_invitation_deliveries')->where('invitation_id', $invitation->id)
                ->where('generation', $invitation->generation)->whereNotNull('attempted_at')->exists(), 403, 'Invitation email proof is not available.');
        } else {
            abort_unless($this->testInvites(), 503, 'Raw test invitation proofs are unavailable.');
        }
    }
}
