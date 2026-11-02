<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\{DB, Hash, Password};
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class SecurityConcurrencyTest extends TestCase
{
    use DatabaseMigrations;

    protected function tearDown(): void
    {
        parent::tearDown();
        \Illuminate\Foundation\Testing\RefreshDatabaseState::$migrated = false;
    }

    public static function operations(): array
    {
        return [['keep', ['revoked', 'stale'], 1], ['all', ['revoked', 'revoked'], 2],
            ['logout', ['logged-out', 'logged-out'], 0], ['reset', ['invalid-token', 'reset'], 1]];
    }

    #[DataProvider('operations')]
    public function test_security_operations_are_serialized_across_processes(string $operation, array $expected, int $version): void
    {
        $this->assertSame('127.0.0.1', config('database.connections.mysql.host'));
        $user = User::factory()->create(['role' => 'sales', 'status' => 'active']);
        $payload = [];
        if ($operation === 'reset') {
            $payload = ['email' => $user->email, 'token' => Password::createToken($user),
                'password' => 'ConcurrentResetPassword!2026', 'password_confirmation' => 'ConcurrentResetPassword!2026'];
        }
        $server = stream_socket_server('tcp://127.0.0.1:0');
        $this->assertNotFalse($server);
        $address = 'tcp://'.stream_socket_get_name($server, false);
        $db = config('database.connections.mysql');
        $environment = ['APP_ENV' => 'testing', 'APP_KEY' => config('app.key'),
            'DB_CONNECTION' => 'mysql', 'DB_URL' => '', 'DB_HOST' => $db['host'],
            'DB_PORT' => (string) $db['port'], 'DB_DATABASE' => 'space_crm_test',
            'DB_USERNAME' => $db['username'], 'DB_PASSWORD' => $db['password'],
            'CACHE_STORE' => 'array', 'SESSION_DRIVER' => 'array', 'BCRYPT_ROUNDS' => '4'];
        $workers = []; $connections = []; $sessionId = bin2hex(random_bytes(20));
        try {
            for ($i = 0; $i < 2; $i++) {
                $worker = new Process([PHP_BINARY, base_path('tests/Support/security-race.php')], base_path(), $environment);
                $worker->setInput(json_encode(['barrier' => $address, 'user_id' => $user->id,
                    'session_id' => $operation === 'logout' ? $sessionId : bin2hex(random_bytes(20)),
                    'operation' => $operation, 'payload' => $payload]));
                $worker->setTimeout(30); $worker->start(); $workers[] = $worker;
            }
            foreach ($workers as $worker) {
                $connection = stream_socket_accept($server, 15);
                $this->assertNotFalse($connection, 'Security worker must reach the barrier.');
                stream_set_timeout($connection, 10);
                $this->assertSame("ready\n", fgets($connection));
                $connections[] = $connection;
            }
            foreach ($connections as $connection) fwrite($connection, "go\n");
            $results = [];
            foreach ($workers as $worker) {
                $worker->wait();
                $this->assertSame(0, $worker->getExitCode(), $worker->getErrorOutput());
                $results[] = trim($worker->getOutput());
            }
            sort($results); sort($expected);
            $this->assertSame($expected, $results);
            $this->assertSame($version, $user->fresh()->auth_version);
            if ($operation === 'logout') $this->assertSame(1, DB::table('revoked_staff_sessions')->count());
            if ($operation === 'reset') {
                $this->assertSame(0, DB::table('password_reset_tokens')->count());
                $this->assertTrue(Hash::check($payload['password'], $user->fresh()->password));
            }
        } finally {
            foreach ($connections as $connection) fclose($connection);
            fclose($server);
            foreach ($workers as $worker) if ($worker->isRunning()) $worker->stop();
        }
    }
}
