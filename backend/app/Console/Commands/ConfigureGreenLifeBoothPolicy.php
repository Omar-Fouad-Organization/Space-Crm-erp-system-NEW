<?php

namespace App\Console\Commands;

use App\Services\BoothFootprintPolicy;
use App\Services\CrmService;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

class ConfigureGreenLifeBoothPolicy extends Command
{
    protected $signature = 'booths:configure-green-life-policy {exhibition} {--reviewed-by=} {--reason=} {--activate}';
    protected $description = 'Review an explicit exhibition binding; activation requires separately authorized configuration';

    public function handle(): int
    {
        $id = filter_var($this->argument('exhibition'), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        $reviewer = User::find($this->option('reviewed-by'));
        if (!$id || !$reviewer || $reviewer->role !== 'super_admin' || $reviewer->status !== 'active'
            || strlen(trim((string) $this->option('reason'))) < 10 || strlen((string) $this->option('reason')) > 1000) {
            $this->error('Explicit exhibition ID, active administrator reviewer and approval reason (10–1000 characters) are required.');
            return self::FAILURE;
        }
        app(CrmService::class)->checkRecord('exhibitions', $id, $reviewer);
        if (!$this->option('activate')) {
            $this->info('Dry run: no policy or historical booth was changed.');
            return self::SUCCESS;
        }
        if (!config('booth_policy.configuration_authorized')) {
            $this->error('Policy configuration is not authorized. No exhibition binding was activated.');
            return self::FAILURE;
        }
        $activated = DB::transaction(function () use ($id, $reviewer): bool {
            abort_unless(DB::table('exhibitions')->where('id', $id)->lockForUpdate()->first(), 404);
            if (DB::table('exhibition_booth_policies')->where('exhibition_id', $id)->exists()) {
                return false;
            }
            DB::table('exhibition_booth_policies')->insert(['exhibition_id' => $id, 'code' => BoothFootprintPolicy::CODE,
                'legacy_max_booth_id' => DB::table('booths')->max('id') ?? 0, 'reviewed_by' => $reviewer->id,
                'approval_evidence' => Crypt::encryptString(trim((string) $this->option('reason'))), 'activated_at' => now()]);
            app(CrmService::class)->audit('exhibitions', $id, 'booth_policy_activated', $reviewer->id, null, ['policy' => BoothFootprintPolicy::CODE]);
            return true;
        }, 3);
        if (! $activated) {
            $this->error('An existing policy binding cannot be overwritten.');
            return self::FAILURE;
        }
        $this->info('Reviewed binding activated; existing booth dimensions and commercial records were not rewritten.');
        return self::SUCCESS;
    }
}
