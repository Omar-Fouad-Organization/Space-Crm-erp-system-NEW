<?php

namespace App\Console\Commands;

use App\Services\ParticipantInvitationDelivery;
use App\Services\ParticipantOnboardingGate;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class DeliverParticipantInvitations extends Command
{
    protected $signature = 'portal:deliver-invitations {--limit=25}';

    protected $description = 'Deliver due invitation intents without exposing secrets or claiming delivery';

    public function handle(ParticipantOnboardingGate $gate, ParticipantInvitationDelivery $delivery): int
    {
        $gate->assertReady();
        $limit = filter_var($this->option('limit'), FILTER_VALIDATE_INT);
        if (! $limit || $limit < 1 || $limit > 100) {
            return self::FAILURE;
        }
        $rows = DB::table('portal_invitation_deliveries')->whereIn('state', ['pending', 'sending'])
            ->where(fn ($query) => $query->whereNull('next_attempt_at')->orWhere('next_attempt_at', '<=', now()))
            ->orderBy('created_at')->orderBy('id')->limit($limit)->get(['id']);
        $states = [];
        foreach ($rows as $row) {
            $state = $delivery->deliver($row->id)['state'];
            $states[$state] = ($states[$state] ?? 0) + 1;
        }
        $this->line(json_encode(['processed' => $rows->count(), 'states' => $states]));

        return self::SUCCESS;
    }
}
