<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;

class ParticipantInvitationMail extends Mailable
{
    public function __construct(#[\SensitiveParameter] public array $invitation) {}

    public function build(): self
    {
        $arabic = $this->invitation['locale'] === 'ar';
        $event = str_replace(["\r", "\n"], ' ', mb_substr($this->invitation['event'], 0, 150));
        $this->subject($arabic ? 'دعوتك لتفعيل حسابك في بوابة '.$event : 'Your '.$event.' Portal Invitation');
        $address = config('participant_onboarding.from_address');
        if ($address) {
            $this->from($address, config('participant_onboarding.from_name'));
        }

        return $this->view('mail.participant-invitation')->text('mail.participant-invitation-text');
    }
}
