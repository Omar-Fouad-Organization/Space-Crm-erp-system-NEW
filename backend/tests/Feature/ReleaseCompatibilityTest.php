<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\{DB, File, Hash};
use Symfony\Component\Process\Process;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ReleaseCompatibilityTest extends TestCase
{
    use DatabaseMigrations;

    protected function tearDown(): void
    {
        parent::tearDown();
        \Illuminate\Foundation\Testing\RefreshDatabaseState::$migrated = false;
    }

    public static function previousVersions(): array
    {
        return [['a5d054305c2c8c5b49b688ed4e89e17cd5c9c168'], ['76e01be60b8652e288ece4bcbfba890c53267a89']];
    }

    #[DataProvider('previousVersions')]
    public function test_audited_previous_application_runs_against_expanded_schema(string $commit): void
    {
        $this->assertSame('127.0.0.1', config('database.connections.mysql.host'));
        $password = 'HistoricalLoginPassword!2026';
        $user = User::factory()->create(['role' => 'super_admin', 'status' => 'active', 'password' => Hash::make($password)]);
        $before = DB::table('users')->where('id', $user->id)->first();
        $directory = storage_path('framework/testing/previous-app-'.bin2hex(random_bytes(8)));
        File::makeDirectory($directory, 0755, true);
        try {
            $archive = new Process(['git', 'archive', '--format=zip', '--output='.$directory.'/previous.zip',
                $commit, 'backend'], dirname(base_path()));
            $archive->mustRun();
            $zip = new \ZipArchive();
            $this->assertTrue($zip->open($directory.'/previous.zip'));
            $this->assertTrue($zip->extractTo($directory)); $zip->close();
            $db = config('database.connections.mysql');
            $worker = new Process([PHP_BINARY, base_path('tests/Support/previous-application.php')], base_path(), [
                'APP_ENV' => 'testing', 'APP_KEY' => config('app.key'), 'APP_DEBUG' => 'false',
                'DB_CONNECTION' => 'mysql', 'DB_URL' => '', 'DB_HOST' => $db['host'], 'DB_PORT' => (string) $db['port'],
                'DB_DATABASE' => 'space_crm_test', 'DB_USERNAME' => $db['username'], 'DB_PASSWORD' => $db['password'],
                'CACHE_STORE' => 'array', 'SESSION_DRIVER' => 'array', 'MAIL_MAILER' => 'array', 'BCRYPT_ROUNDS' => '4',
                'COMPOSER_VENDOR_DIR' => base_path('vendor'),
            ]);
            $worker->setInput(json_encode(['backend' => $directory.'/backend', 'user_id' => $user->id,
                'email' => $user->email, 'password' => $password]));
            $worker->setTimeout(30); $worker->run();
            $this->assertSame(0, $worker->getExitCode(), $worker->getErrorOutput());
            $this->assertSame(['historical_login' => true, 'client_write' => true, 'new_user_default_version' => 0],
                json_decode($worker->getOutput(), true));
            // Login and old-code reads/writes must not mutate the original user's columns.
            $this->assertEquals($before, DB::table('users')->where('id', $user->id)->first());
            $this->assertDatabaseHas('clients', ['email' => 'historical@example.test']);
        } finally {
            File::deleteDirectory($directory);
        }
    }
}
