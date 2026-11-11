<?php

namespace App\Services;

use App\Jobs\DeliverParticipantInvitation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ParticipantInvitations
{
    public function __construct(private ParticipantOnboardingGate $gate, private ParticipantDeliveryCipher $cipher) {}

    public function issue(object $participant, object $employee, array $input, ?string $supersedes = null): array
    {
        $synthetic = $this->gate->testInvites() && ! config('participant_onboarding.enabled');
        if (! $synthetic) {
            $this->gate->assertReady();
        }
        abort_unless(app(B2BAccess::class)->eligible($participant, false, true), 422);
        $email = strtolower($input['email']);
        abort_if(DB::table('portal_access_invitations')->where('participant_id', $participant->id)->where('email', $email)
            ->whereNull('revoked_at')->whereNull('redeemed_identity_id')->where('expires_at', '>', now())->exists(), 409, 'An active invitation already exists. Review or resend it.');
        abort_if(DB::table('portal_access_invitations')->where('participant_id', $participant->id)->where('email', $email)
            ->where('created_at', '>', now()->subHour())->count() >= 3, 429, 'Invitation issuance limit reached.');
        $id = (string) Str::uuid();
        $token = Str::random(64);
        $hours = min(24, max(1, (int) config('participant_onboarding.hours')));
        $regrant = null;
        if (! empty($input['regrant_membership_id'])) {
            $regrant = DB::table('portal_memberships')->where('id', $input['regrant_membership_id'])->where('participant_id', $participant->id)->where('exhibition_id', $participant->exhibition_id)->lockForUpdate()->first();
            abort_unless($regrant && $regrant->status === 'revoked' && $regrant->revoked_at, 409, 'A revoked membership in this organization is required for regrant review.');
        }
        DB::table('portal_access_invitations')->insert([
            'id' => $id, 'participant_id' => $participant->id, 'email' => $email, 'role' => $input['role'],
            'token_hash' => hash('sha256', $token), 'proof_channel' => $synthetic ? 'synthetic' : ($this->gate->sandbox() ? 'verified_email_sandbox' : 'verified_email'),
            'status' => 'issued', 'generation' => 1, 'locale' => $input['locale'] ?? config('participant_onboarding.locale'),
            'evidence' => B2BProfiles::seal(['authority' => $input['evidence'], 'reviewer' => $employee->id]),
            'invited_by' => $employee->id, 'expires_at' => now()->addHours($hours),
            'issued_at' => now(), 'supersedes_id' => $supersedes, 'created_at' => now(), 'updated_at' => now(),
            'regrant_membership_id' => $regrant?->id,
            'regrant_revocation_hash' => $regrant ? self::revocationHash($regrant) : null,
        ]);
        $this->event($id, 'issued', $employee->id, ['participant_id' => $participant->id, 'role' => $input['role'], 'supersedes_id' => $supersedes]);
        app(B2BProfiles::class)->audit($participant->exhibition_id, 'b2b_participants', $participant->id, 'portal_invite', $employee, ['invitation_id' => $id]);
        if ($synthetic) {
            return ['id' => $id, 'token' => $token, 'delivery' => 'not_sent', 'expires_in_hours' => $hours];
        }
        $delivery = $this->queue(DB::table('portal_access_invitations')->where('id', $id)->first(), $token);

        return ['id' => $id, 'status' => 'issued', 'delivery' => 'pending', 'delivery_id' => $delivery, 'expires_in_hours' => $hours];
    }

    public function resend(object $participant, object $employee, string $id, string $reason): array
    {
        $this->gate->assertReady();
        $invitation = DB::table('portal_access_invitations')->where('id', $id)->where('participant_id', $participant->id)->lockForUpdate()->first();
        abort_unless($invitation && ! $invitation->revoked_at && ! $invitation->redeemed_identity_id && now()->lt($invitation->expires_at), 409, 'Only an unrevoked, unexpired, unused invitation can be resent.');
        abort_unless(app(B2BAccess::class)->eligible($participant, false, true), 403);
        abort_if(now()->diffInSeconds($invitation->updated_at, true) < 60, 429, 'Wait before resending an invitation.');
        abort_if(DB::table('portal_invitation_deliveries')->where('invitation_id', $id)->where('created_at', '>', now()->subHour())->count() >= 3, 429, 'Invitation resend limit reached.');
        $token = Str::random(64);
        $generation = (int) ($invitation->generation ?? 1) + 1;
        DB::table('portal_invitation_deliveries')->where('invitation_id', $id)->whereNotIn('state', ['provider_accepted', 'sandbox_accepted', 'failed', 'bounced', 'cancelled'])
            ->update(['state' => 'cancelled', 'secret_payload' => null, 'updated_at' => now()]);
        DB::table('portal_access_invitations')->where('id', $id)->update([
            'generation' => $generation, 'token_hash' => hash('sha256', $token), 'proof_channel' => $this->gate->sandbox() ? 'verified_email_sandbox' : 'verified_email', 'status' => 'issued', 'updated_at' => now(),
        ]);
        $this->event($id, 'secret_rotated_for_resend', $employee->id, ['reason' => $reason, 'previous_hash' => $invitation->token_hash, 'generation' => $generation]);
        $delivery = $this->queue(DB::table('portal_access_invitations')->where('id', $id)->first(), $token);

        return ['id' => $id, 'delivery_id' => $delivery, 'delivery' => 'pending', 'generation' => $generation];
    }

    public function revoke(string $id, int $employee): void
    {
        DB::table('portal_access_invitations')->where('id', $id)->update(['status' => 'revoked', 'revoked_at' => now(), 'updated_at' => now()]);
        DB::table('portal_invitation_deliveries')->where('invitation_id', $id)->update(['secret_payload' => null, 'updated_at' => now()]);
        DB::table('portal_invitation_deliveries')->where('invitation_id', $id)->whereIn('state', ['pending', 'sending', 'delivery_unknown'])
            ->update(['state' => 'cancelled', 'updated_at' => now()]);
        $this->event($id, 'revoked', $employee);
    }

    public function reconcile(string $id, int $employee, string $state, string $reason): void
    {
        $invitation = DB::table('portal_access_invitations')->where('id', $id)->lockForUpdate()->first();
        abort_unless($invitation, 404);
        $delivery = DB::table('portal_invitation_deliveries')->where('invitation_id', $id)->where('generation', $invitation->generation)->lockForUpdate()->first();
        abort_unless($delivery && in_array($state, ['failed', 'bounced', 'delivery_unknown'], true), 422);
        DB::table('portal_invitation_deliveries')->where('id', $delivery->id)->update(['state' => $state, 'secret_payload' => null, 'failure_code' => 'staff_reported', 'updated_at' => now()]);
        $this->event($id, 'staff_delivery_reconciliation', $employee, ['state' => $state, 'reason' => $reason, 'evidence_channel' => 'staff_reported'], $delivery->id);
    }

    private function queue(object $invitation, #[\SensitiveParameter] string $token): string
    {
        $id = (string) Str::uuid();
        DB::table('portal_invitation_deliveries')->insert([
            'id' => $id, 'invitation_id' => $invitation->id, 'generation' => $invitation->generation,
            'key_id' => config('participant_onboarding.key_id'), 'secret_payload' => $this->cipher->seal(['token' => $token]),
            'expires_at' => $invitation->expires_at, 'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->event($invitation->id, 'delivery_intent_persisted', null, [], $id);
        DB::afterCommit(function () use ($id): void {
            try {
                DeliverParticipantInvitation::dispatch($id)->onQueue(config('participant_onboarding.queue'));
            } catch (\Throwable) {
                // The durable intent is recovered by the bounded sweep command.
            }
        });

        return $id;
    }

    public function event(string $invitation, string $event, ?int $employee = null, array $details = [], ?string $delivery = null): void
    {
        DB::table('portal_invitation_events')->insert([
            'invitation_id' => $invitation, 'delivery_id' => $delivery, 'employee_id' => $employee,
            'event' => $event, 'details' => $details ? B2BProfiles::seal($details) : null, 'created_at' => now(),
        ]);
    }

    public static function revocationHash(object $membership): string
    {
        return hash('sha256', json_encode([$membership->id, $membership->identity_id, $membership->participant_id, $membership->status, $membership->revoked_at], JSON_THROW_ON_ERROR));
    }
}
