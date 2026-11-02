<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\CrmService;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\{DB, Schema};
use Symfony\Component\Process\Process;
use Tests\TestCase;

class BoothConcurrencyTest extends TestCase
{
    // Committed disposable fixtures are required for independent MySQL connections.
    use DatabaseMigrations;

    protected function tearDown(): void
    {
        parent::tearDown();
        \Illuminate\Foundation\Testing\RefreshDatabaseState::$migrated = false;
    }

    public function test_two_independent_processes_cannot_reserve_the_same_booth(): void
    {
        $this->assertSame('127.0.0.1', config('database.connections.mysql.host'));
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $crm = app(CrmService::class);
        $client = $crm->save('clients', ['name' => 'Concurrency client', 'contact_person' => 'Test',
            'email' => 'concurrency@example.test', 'type' => 'exhibitor', 'status' => 'prospect'], $admin);
        $expo = $crm->save('exhibitions', ['name' => 'Concurrency expo', 'start_date' => '2027-01-01',
            'end_date' => '2027-01-02', 'location' => 'Test', 'currency' => 'EGP', 'status' => 'planning'], $admin);
        $booth = $crm->save('booths', ['name' => 'RACE-01', 'exhibition_id' => $expo['id'],
            'size_sqm' => '10', 'price' => '1000', 'currency' => 'EGP'], $admin);
        $deal = ['name' => 'Concurrent reservation', 'client_id' => $client['id'], 'exhibition_id' => $expo['id'],
            'type' => 'booth', 'booth_id' => $booth['id'], 'salesperson_id' => $admin->id,
            'amount' => '1000', 'currency' => 'EGP', 'status' => 'talking', 'commission_percentage' => '0'];
        $server = stream_socket_server('tcp://127.0.0.1:0');
        $this->assertNotFalse($server);
        $address = 'tcp://'.stream_socket_get_name($server, false);
        $db = config('database.connections.mysql');
        $environment = ['APP_ENV' => 'testing', 'DB_CONNECTION' => 'mysql', 'DB_URL' => '',
            'DB_HOST' => $db['host'], 'DB_PORT' => (string) $db['port'], 'DB_DATABASE' => 'space_crm_test',
            'DB_USERNAME' => $db['username'], 'DB_PASSWORD' => $db['password'], 'CACHE_STORE' => 'array'];
        $workers = []; $connections = [];
        try {
            for ($i = 0; $i < 2; $i++) {
                $worker = new Process([PHP_BINARY, base_path('tests/Support/reserve-booth.php')], base_path(), $environment);
                $worker->setInput(json_encode(['barrier' => $address, 'user_id' => $admin->id, 'deal' => $deal]));
                $worker->setTimeout(30); $worker->start(); $workers[] = $worker;
            }
            foreach ($workers as $worker) {
                $connection = stream_socket_accept($server, 15);
                $this->assertNotFalse($connection, 'Reservation workers must reach the barrier.');
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
            sort($results);
            $this->assertSame(['occupied', 'reserved'], $results);
            $this->assertSame(1, DB::table('deals')->where('booth_id', $booth['id'])->count());
            $this->assertDatabaseHas('booths', ['id' => $booth['id'], 'status' => 'reserved']);
        } finally {
            foreach ($connections as $connection) fclose($connection);
            fclose($server);
            foreach ($workers as $worker) if ($worker->isRunning()) $worker->stop();
        }
    }

    public function test_security_migration_can_reverse_without_deleting_business_records(): void
    {
        $user = User::factory()->create(['role' => 'sales', 'status' => 'active']);
        $before = DB::table('users')->where('id', $user->id)->first();
        $migration = require database_path('migrations/2026_11_02_000006_add_auth_version_to_users.php');
        $migration->down();
        $this->assertFalse(Schema::hasColumn('users', 'auth_version'));
        $this->assertFalse(Schema::hasTable('revoked_staff_sessions'));
        $migration->up();
        $after = DB::table('users')->where('id', $user->id)->first();
        $this->assertEquals($before, $after);
        $this->assertSame(1, DB::table('users')->count());
    }
}
