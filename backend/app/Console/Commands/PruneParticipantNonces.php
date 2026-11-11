<?php
namespace App\Console\Commands;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
class PruneParticipantNonces extends Command
{
    protected $signature='portal:prune-nonces {--dry-run}';protected $description='Remove expired replay envelopes in bounded batches, retaining business audit records';
    public function handle():int
    {
        if(!config('participant_portal.enabled'))return self::FAILURE;
        $ids=DB::table('portal_gateway_nonces')->where('expires_at','<',now()->subMinutes(5))->orderBy('expires_at')->limit(1000)->pluck('id');
        if(!$this->option('dry-run'))DB::table('portal_gateway_nonces')->whereIn('id',$ids)->delete();$this->line((string)$ids->count());return self::SUCCESS;
    }
}
