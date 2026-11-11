<?php

namespace App\Jobs;

use App\Services\ParticipantInvitationDelivery;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class DeliverParticipantInvitation implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 30;

    public function __construct(public string $deliveryId) {}

    public function handle(ParticipantInvitationDelivery $delivery): void
    {
        $delivery->deliver($this->deliveryId);
    }
}
