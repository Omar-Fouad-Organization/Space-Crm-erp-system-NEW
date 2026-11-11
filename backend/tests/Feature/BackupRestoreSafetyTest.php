<?php

namespace Tests\Feature;

use App\Console\Commands\CrmBackup;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class BackupRestoreSafetyTest extends TestCase
{
    private function command(): CrmBackup
    {
        return new class extends CrmBackup
        {
            public function createTarget(string $target): void
            {
                $this->createRestoreDatabase($target);
            }
        };
    }

    public function test_existing_restore_database_is_refused_without_changing_its_tables(): void
    {
        $before = DB::select('SHOW TABLES');

        try {
            $this->command()->createTarget('space_crm_test');
            $this->fail('An existing database must never be reused as a restore target.');
        } catch (QueryException $exception) {
            $this->assertSame(1007, (int) $exception->errorInfo[1]);
        }

        $this->assertSame(json_encode($before), json_encode(DB::select('SHOW TABLES')));
    }

    public function test_invalid_restore_target_is_rejected_before_any_database_statement(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        $this->command()->createTarget('space_crm_test`; DROP DATABASE other; --');
    }
}
