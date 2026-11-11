<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class ParticipantInvitationDelivery
{
    public function __construct(
        private ParticipantOnboardingGate $gate,
        private ParticipantDeliveryCipher $cipher,
        private ParticipantInvitationMailer $mailer,
        private ParticipantInvitations $invitations,
    ) {}

    public function deliver(string $id): array
    {
        $this->gate->assertReady();
        $claimed = DB::transaction(function () use ($id): ?array {
            $seed = DB::table('portal_invitation_deliveries')->where('id', $id)->first();
            abort_unless($seed, 404);
            $invitation = DB::table('portal_access_invitations')->where('id', $seed->invitation_id)->lockForUpdate()->first();
            $delivery = DB::table('portal_invitation_deliveries')->where('id', $id)->lockForUpdate()->first();
            if (! in_array($delivery->state, ['pending', 'sending'], true)) {
                return null;
            }
            if ($delivery->state === 'sending') {
                if (now()->gte($delivery->lease_until)) {
                    $this->finish($delivery, 'delivery_unknown', null, 'lease_expired', true);
                }

                return null;
            }
            if ($delivery->next_attempt_at && now()->lt($delivery->next_attempt_at)) {
                return null;
            }
            $participant = $invitation ? DB::table('b2b_participants')->where('id', $invitation->participant_id)->first() : null;
            if (! $invitation || $invitation->revoked_at || $invitation->redeemed_identity_id || now()->gte($invitation->expires_at)
                || $invitation->generation != $delivery->generation || ! $participant || ! app(B2BAccess::class)->eligible($participant, false)) {
                $this->finish($delivery, 'cancelled', null, 'authorization_no_longer_current', true);

                return null;
            }
            if ($delivery->attempts >= 5 || ! $delivery->secret_payload) {
                $this->finish($delivery, 'failed', null, 'retry_or_secret_lifetime_exhausted', true);

                return null;
            }
            DB::table('portal_invitation_deliveries')->where('id', $id)->update([
                'state' => 'sending', 'attempts' => $delivery->attempts + 1, 'attempted_at' => now(),
                'lease_until' => now()->addSeconds(90), 'updated_at' => now(),
            ]);
            $this->invitations->event($invitation->id, 'delivery_claimed', null, ['attempt' => $delivery->attempts + 1], $id);

            return [$delivery, $invitation, $participant];
        }, 3);
        if (! $claimed) {
            return $this->status($id);
        }
        [$delivery, $invitation, $participant] = $claimed;
        try {
            $secret = $this->cipher->open($delivery->key_id, $delivery->secret_payload);
            $profile = B2BProfiles::open($participant->profile);
            $event = DB::table('exhibitions')->where('id', $participant->exhibition_id)->value('name');
            $origin = rtrim(config('participant_onboarding.website_origin'), '/');
            $url = $origin.'/#/portal/activate?'.http_build_query(['token' => $secret['token'], 'email' => $invitation->email]);
            $current = DB::table('portal_access_invitations')->where('id', $invitation->id)->first();
            if ($current->revoked_at || $current->generation != $delivery->generation || $current->redeemed_identity_id) {
                $state = 'cancelled';
                $reference = null;
                $code = 'authorization_changed_before_send';
            } else {
                $result = $this->mailer->send($invitation->email, [
                    'event' => $event, 'organization' => ($invitation->locale === 'ar' ? $profile['name_ar'] : $profile['name_en']),
                    'recipient' => $invitation->email, 'role' => $invitation->role, 'locale' => $invitation->locale ?? 'en',
                    'url' => $url, 'expires_at' => $invitation->expires_at,
                    'support' => filter_var(config('participant_onboarding.support_email'), FILTER_VALIDATE_EMAIL) ?: null,
                ]);
                abort_unless(in_array($result['state'] ?? '', ['provider_accepted', 'sandbox_accepted'], true), 502);
                $state = $result['state'];
                $reference = $result['reference'] ?? null;
                $code = null;
            }
        } catch (ParticipantDeliveryFailure $failure) {
            $state = match ($failure->category) {
                'temporary' => 'pending', 'permanent' => 'failed', default => 'delivery_unknown'
            };
            $reference = null;
            $code = 'transport_'.$failure->category;
        } catch (\Throwable) {
            $state = 'delivery_unknown';
            $reference = null;
            $code = 'provider_outcome_unknown';
        }
        DB::transaction(function () use ($id, $state, $reference, $code): void {
            $row = DB::table('portal_invitation_deliveries')->where('id', $id)->lockForUpdate()->first();
            if ($row->state !== 'sending') {
                $this->invitations->event($row->invitation_id, 'late_delivery_outcome', null, ['state' => $state], $id);

                return;
            }
            if ($state === 'pending' && $row->attempts >= 5) {
                $this->finish($row, 'failed', null, 'retry_exhausted', true);
            } else {
                $this->finish($row, $state, $reference, $code, $state !== 'pending');
            }
        }, 3);

        return $this->status($id);
    }

    private function finish(object $row, string $state, ?string $reference, ?string $code, bool $erase): void
    {
        DB::table('portal_invitation_deliveries')->where('id', $row->id)->update([
            'state' => $state, 'provider_reference' => $reference, 'failure_code' => $code,
            'secret_payload' => $erase ? null : $row->secret_payload, 'lease_until' => null,
            'next_attempt_at' => $state === 'pending' ? now()->addSeconds(min(3600, 30 * (2 ** $row->attempts))) : null,
            'updated_at' => now(),
        ]);
        $this->invitations->event($row->invitation_id, 'delivery_'.$state, null, ['failure_code' => $code], $row->id);
    }

    public function status(string $id): array
    {
        $row = DB::table('portal_invitation_deliveries')->where('id', $id)->first();
        abort_unless($row, 404);

        return ['id' => $row->id, 'state' => $row->state, 'attempts' => $row->attempts];
    }
}
