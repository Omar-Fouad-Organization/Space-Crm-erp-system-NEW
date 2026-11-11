<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\{DatabaseMigrations, RefreshDatabaseState};
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;
use Tests\Support\SponsorDeliveryFixture as Fixture;
use Tests\TestCase;

class SponsorDeliveryConcurrencyTest extends TestCase
{
    use DatabaseMigrations;

    protected function tearDown(): void
    {
        parent::tearDown();
        RefreshDatabaseState::$migrated = false;
    }

    public function test_simultaneous_approvals_have_one_authoritative_transition(): void
    {
        $f = Fixture::create();
        $path = '/api/sponsor-delivery/'.$f['sponsor'];
        $second = User::factory()->create(['role' => 'management', 'status' => 'active', 'authorization_scoped' => true,
            'record_scope' => 'all', 'all_exhibitions' => false]);
        DB::table('exhibition_user')->insert(['exhibition_id' => $f['event'], 'user_id' => $second->id, 'granted_by' => $f['manager']->id]);
        $id = $this->actingAs($f['manager'])->postJson($path, Fixture::command('create', 0, Fixture::terms($f['worker'])))
            ->assertOk()->json('id');
        $server = stream_socket_server('tcp://127.0.0.1:0');
        $this->assertNotFalse($server);
        $barrier = 'tcp://'.stream_socket_get_name($server, false);
        $db = config('database.connections.mysql');
        $env = ['APP_ENV' => 'testing', 'APP_KEY' => config('app.key'), 'DB_CONNECTION' => 'mysql', 'DB_URL' => '',
            'DB_HOST' => '127.0.0.1', 'DB_PORT' => (string) $db['port'], 'DB_DATABASE' => 'space_crm_test',
            'DB_USERNAME' => $db['username'], 'DB_PASSWORD' => $db['password'], 'CACHE_STORE' => 'array'];
        $workers = [];
        $connections = [];
        try {
            foreach ([$f['manager'], $second] as $actor) {
                $process = new Process([PHP_BINARY, base_path('tests/Support/approve-sponsor-delivery.php')], base_path(), $env);
                $process->setTimeout(45);
                $process->setInput(json_encode([
                    'barrier' => $barrier, 'deal' => $f['sponsor'], 'actor' => $actor->id,
                    'command' => Fixture::command('approve', 1, ['id' => $id]),
                ], JSON_THROW_ON_ERROR));
                $process->start();
                $workers[] = $process;
            }
            foreach ($workers as $worker) {
                $connection = stream_socket_accept($server, 20);
                $this->assertNotFalse($connection);
                $connections[] = $connection;
                stream_set_timeout($connection, 10);
                $this->assertSame("ready\n", fgets($connection));
            }
            foreach ($connections as $connection) fwrite($connection, "go\n");
            $results = [];
            foreach ($workers as $worker) {
                $this->assertSame(0, $worker->wait(), $worker->getErrorOutput());
                $results[] = (int) $worker->getOutput();
            }
            sort($results);
            $this->assertSame([200, 409], $results);
            $this->assertDatabaseHas('sponsor_deliverables', ['id' => $id, 'status' => 'pending', 'version' => 2]);
            $this->assertDatabaseCount('sponsor_deliverable_events', 2);
            $this->assertSame(1, DB::table('sponsor_deliverable_events')->where('action', 'approve')->count());
        } finally {
            foreach ($connections as $connection) fclose($connection);
            fclose($server);
            foreach ($workers as $worker) if ($worker->isRunning()) $worker->stop();
        }
    }
}
