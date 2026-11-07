<?php

namespace App\Services;

use App\Mail\ParticipantInvitationMail;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mailer\Exception\UnexpectedResponseException;

class ParticipantInvitationMailer
{
    public function __construct(private ParticipantOnboardingGate $gate) {}

    public function send(string $recipient, #[\SensitiveParameter] array $message): array
    {
        $this->gate->assertReady();
        try {
            $sent = Mail::mailer(config('participant_onboarding.mailer'))->to($recipient)->send(new ParticipantInvitationMail($message));
        } catch (UnexpectedResponseException $exception) {
            $code = (int) $exception->getCode();
            throw new ParticipantDeliveryFailure($code >= 400 && $code < 500 ? 'temporary' : ($code >= 500 && $code < 600 ? 'permanent' : 'unknown'));
        }
        if ($this->gate->sandbox()) {
            return ['state' => 'sandbox_accepted', 'reference' => null];
        }
        if (! $sent) {
            throw new ParticipantDeliveryFailure('unknown');
        }

        return ['state' => 'provider_accepted', 'reference' => mb_substr($sent->getMessageId(), 0, 255)];
    }
}
