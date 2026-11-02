<?php

namespace Tests\Feature;

use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class DatabaseSafetyTest extends TestCase
{
    public static function unsafeConfigurations(): array
    {
        return [[['DB_DATABASE' => 'space_crm']], [['DB_HOST' => '192.0.2.1']],
            [['DB_URL' => 'mysql://synthetic:synthetic@127.0.0.1/space_crm']]];
    }

    #[DataProvider('unsafeConfigurations')]
    public function test_unsafe_connection_configuration_is_rejected_before_refresh(array $overrides): void
    {
        $worker = new Process([PHP_BINARY, base_path('tests/Support/database-guard.php')], base_path(), [
            'APP_ENV' => 'testing', 'APP_KEY' => config('app.key'), 'DB_CONNECTION' => 'mysql',
            'DB_DATABASE' => 'space_crm_test', 'DB_HOST' => '127.0.0.1', 'DB_URL' => '',
            'CACHE_STORE' => 'array', 'SESSION_DRIVER' => 'array', ...$overrides,
        ]);
        $worker->setTimeout(15); $worker->run();
        $this->assertSame(0, $worker->getExitCode(), $worker->getErrorOutput());
        $this->assertSame('refused-before-refresh', trim($worker->getOutput()));
    }
}
