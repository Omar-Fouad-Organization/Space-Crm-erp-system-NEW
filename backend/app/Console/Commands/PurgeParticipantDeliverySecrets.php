<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PurgeParticipantDeliverySecrets extends Command
{
    protected $signature = 'portal:purge-delivery-secrets';

    protected $description = 'Erase expired encrypted participant delivery payloads without deleting audit or business records';

    public function handle(): int
    {
        $count = DB::table('portal_invitation_deliveries')->whereNotNull('secret_payload')->where('expires_at', '<=', now())->update(['secret_payload' => null, 'state' => 'cancelled', 'failure_code' => 'proof_expired', 'lease_until' => null, 'next_attempt_at' => null, 'updated_at' => now()]);
        $this->line(json_encode(['expired_payloads_erased' => $count]));

        return self::SUCCESS;
    }
}
