<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\CrmService;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class BoothFootprintConcurrencyTest extends TestCase
{
    use DatabaseMigrations;

    protected function tearDown(): void
    {
        parent::tearDown();
        \Illuminate\Foundation\Testing\RefreshDatabaseState::$migrated = false;
    }

    public function test_resizing_and_reserving_cannot_commit_inconsistent_booth_geometry_or_commercial_records(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $crm = app(CrmService::class);
        $event = $crm->save('exhibitions', ['name'=>'SYNTHETIC footprint race','start_date'=>'2027-01-01','end_date'=>'2027-01-03','location'=>'Synthetic','currency'=>'EGP','status'=>'planning'], $admin)['id'];
        $client = $crm->save('clients', ['name'=>'SYNTHETIC race client','contact_person'=>'Synthetic','email'=>'footprint-race@example.test','type'=>'exhibitor','status'=>'active'], $admin)['id'];
        config(['booth_policy.configuration_authorized'=>true]);
        $this->artisan('booths:configure-green-life-policy', ['exhibition'=>$event,'--reviewed-by'=>$admin->id,'--reason'=>'Synthetic approval for race fixture','--activate'=>true])->assertSuccessful();
        $payload = ['name'=>'SYNTHETIC-RACE','exhibition_id'=>$event,'size_sqm'=>'12.00','footprint_width_m'=>'3','footprint_depth_m'=>'4','price'=>'1000','currency'=>'EGP'];
        $booth = $crm->save('booths', $payload, $admin);
        $deal = ['name'=>'SYNTHETIC reservation','client_id'=>$client,'exhibition_id'=>$event,'type'=>'booth','booth_id'=>$booth['id'],'salesperson_id'=>$admin->id,'amount'=>'1000','currency'=>'EGP','status'=>'talking','commission_percentage'=>'0'];
        $server = stream_socket_server('tcp://127.0.0.1:0');
        $this->assertNotFalse($server);
        $address = 'tcp://'.stream_socket_get_name($server, false);
        $db = config('database.connections.mysql');
        $environment = ['APP_ENV'=>'testing','APP_KEY'=>config('app.key'),'DB_CONNECTION'=>'mysql','DB_URL'=>'','DB_HOST'=>'127.0.0.1','DB_PORT'=>(string)$db['port'],'DB_DATABASE'=>'space_crm_test','DB_USERNAME'=>$db['username'],'DB_PASSWORD'=>$db['password'],'CACHE_STORE'=>'array','GRANULAR_AUTHORIZATION_ENABLED'=>'false'];
        $workers = []; $connections = [];
        try {
            foreach (['reserve','resize'] as $mode) {
                $worker = new Process([PHP_BINARY, base_path('tests/Support/reserve-booth.php')], base_path(), $environment);
                $worker->setInput(json_encode(['barrier'=>$address,'user_id'=>$admin->id,'mode'=>$mode,'deal'=>$deal,'booth_id'=>$booth['id'],'booth'=>[...$payload,'size_sqm'=>'20.00','footprint_width_m'=>'4','footprint_depth_m'=>'5']], JSON_THROW_ON_ERROR));
                $worker->setTimeout(45); $worker->start(); $workers[]=$worker;
            }
            foreach ($workers as $worker) {
                $connection = stream_socket_accept($server, 20);
                $this->assertNotFalse($connection); stream_set_timeout($connection, 15);
                $this->assertSame("ready\n", fgets($connection)); $connections[]=$connection;
            }
            foreach ($connections as $connection) { fwrite($connection, "go\n"); }
            $results=[];
            foreach ($workers as $worker) {
                $worker->wait(); $this->assertSame(0, $worker->getExitCode(), $worker->getErrorOutput()); $results[]=trim($worker->getOutput());
            }
            $this->assertSame('reserved', $results[0]);
            $this->assertContains($results[1], ['protected','resized']);
            $actual=DB::table('booths')->find($booth['id']);
            $this->assertSame($results[1]==='resized'?['20.00','4.00','5.00']:['12.00','3.00','4.00'], [$actual->size_sqm,$actual->footprint_width_m,$actual->footprint_depth_m]);
            $this->assertSame('reserved', $actual->status);
            $this->assertDatabaseCount('deals', 1);
            $this->assertDatabaseHas('deals', ['booth_id'=>$booth['id'],'amount'=>'1000.00','currency'=>'EGP']);
            $this->assertDatabaseCount('payments', 0);
            $this->assertDatabaseCount('invoices', 0);
        } finally {
            foreach ($connections as $connection) { fclose($connection); }
            fclose($server);
            foreach ($workers as $worker) { if ($worker->isRunning()) { $worker->stop(); } }
        }
    }
}
