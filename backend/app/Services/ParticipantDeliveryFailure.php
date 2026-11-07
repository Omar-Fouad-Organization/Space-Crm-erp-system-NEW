<?php

namespace App\Services;

class ParticipantDeliveryFailure extends \RuntimeException
{
    public function __construct(public readonly string $category)
    {
        parent::__construct('Participant invitation delivery did not complete.');
    }
}
