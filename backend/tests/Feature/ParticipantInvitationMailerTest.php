<?php

namespace Tests\Feature;

use App\Services\ParticipantDeliveryFailure;
use App\Services\ParticipantInvitationMailer;
use App\Services\ParticipantOnboardingGate;
use Illuminate\Mail\Mailer;
use Illuminate\Mail\PendingMail;
use Illuminate\Support\Facades\Mail;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\Mailer\Exception\UnexpectedResponseException;
use Tests\TestCase;

class ParticipantInvitationMailerTest extends TestCase
{
    public static function rejections(): array
    {
        return ['temporary' => [451, 'temporary'], 'permanent' => [550, 'permanent'], 'ambiguous' => [0, 'unknown']];
    }

    #[DataProvider('rejections')]
    public function test_definitive_smtp_rejection_is_classified_without_recording_provider_text(int $code, string $category): void
    {
        config(['participant_onboarding.mailer' => 'array']);
        $this->mock(ParticipantOnboardingGate::class)->shouldReceive('assertReady')->once()->andReturnNull();
        $pending = \Mockery::mock(PendingMail::class);
        $pending->shouldReceive('send')->once()->andThrow(new UnexpectedResponseException('Synthetic confidential provider text', $code));
        $mailer = \Mockery::mock(Mailer::class);
        $mailer->shouldReceive('to')->with('synthetic@example.test')->once()->andReturn($pending);
        Mail::shouldReceive('mailer')->with('array')->once()->andReturn($mailer);
        try {
            app(ParticipantInvitationMailer::class)->send('synthetic@example.test', []);
            $this->fail('Unaccepted mail reported as successful');
        } catch (ParticipantDeliveryFailure $error) {
            $this->assertSame($category, $error->category);
            $this->assertStringNotContainsString('confidential', $error->getMessage());
        }
    }
}
