<?php

namespace Tests\Feature;

use App\Services\B2BScheduler;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\Process\Process;
use Tests\Support\B2BFixture;
use Tests\TestCase;

class B2BConcurrencyTest extends TestCase
{
    use DatabaseMigrations;
    protected function tearDown(): void { parent::tearDown(); \Illuminate\Foundation\Testing\RefreshDatabaseState::$migrated=false; }
    public static function collisions(): array { return [['location'],['buyer_person'],['exhibitor_person']]; }

    #[DataProvider('collisions')]
    public function test_simultaneous_independent_bookings_exclude_shared_resources(string $resource): void
    {
        $f=B2BFixture::create(); $bookings=[B2BFixture::booking($f,0),B2BFixture::booking($f,1)];
        if ($resource==='location') { $bookings[1]['location_id']=$bookings[0]['location_id']; }
        else {
            $side=$resource==='buyer_person'?0:1;
            DB::table('b2b_representatives')->where('id',$f['representatives'][$f['participants'][1][$side]])->update(['person_id'=>$f['people'][$f['participants'][0][$side]]]);
        }
        $server=stream_socket_server('tcp://127.0.0.1:0'); $this->assertNotFalse($server); $address='tcp://'.stream_socket_get_name($server,false);
        $db=config('database.connections.mysql'); $env=['APP_ENV'=>'testing','DB_CONNECTION'=>'mysql','DB_URL'=>'','DB_HOST'=>'127.0.0.1','DB_PORT'=>(string)$db['port'],'DB_DATABASE'=>'space_crm_test','DB_USERNAME'=>$db['username'],'DB_PASSWORD'=>$db['password'],'CACHE_STORE'=>'array'];
        $workers=[]; $connections=[];
        try {
            foreach ($bookings as $booking) { $p=new Process([PHP_BINARY,base_path('tests/Support/book-b2b.php')],base_path(),$env); $p->setInput(json_encode(['barrier'=>$address,'user_id'=>$f['user']->id,'booking'=>$booking])); $p->setTimeout(45); $p->start(); $workers[]=$p; }
            foreach ($workers as $worker) { $c=stream_socket_accept($server,20); $this->assertNotFalse($c); stream_set_timeout($c,10); $this->assertSame("ready\n",fgets($c)); $connections[]=$c; }
            foreach ($connections as $c) { fwrite($c,"go\n"); }
            $results=[];
            foreach ($workers as $worker) { $worker->wait(); $this->assertSame(0,$worker->getExitCode(),$worker->getErrorOutput()); $results[]=trim($worker->getOutput()); }
            sort($results); $this->assertSame(['booked','occupied'],$results); $this->assertSame(1,DB::table('b2b_meetings')->count()); $this->assertSame(18,DB::table('b2b_slots')->count());
        } finally { foreach ($connections as $c) { fclose($c); } fclose($server); foreach ($workers as $worker) { if ($worker->isRunning()) { $worker->stop(); } } }
    }

    public function test_conflicting_reschedule_rolls_back_and_multiple_representatives_can_meet_concurrently(): void
    {
        $f=B2BFixture::create(); $a=B2BFixture::booking($f,0); $b=B2BFixture::booking($f,1);
        // A second independently consented representative of the SAME supplier may attend in parallel.
        $sameSupplier=$f['participants'][0][1];
        $rep=DB::table('b2b_representatives')->insertGetId(['participant_id'=>$sameSupplier,'person_id'=>$f['people'][$f['participants'][1][1]],'evidence'=>\App\Services\B2BProfiles::seal(['reference'=>'Synthetic second representative authority'])]);
        $cross=DB::table('b2b_matches')->where('buyer_id',$f['participants'][1][0])->where('exhibitor_id',$sameSupplier)->value('id');
        foreach ([['review',1],['approve',2],['invite',3],['accept',4],['accept',5]] as [$action,$version]) {
            app(\App\Services\B2BWorkflow::class)->transition($cross,['version'=>$version,'action'=>$action,'reason'=>'Synthetic parallel representative coordination','expires_at'=>'2026-12-20T12:00:00+00:00','party'=>$version===4?'buyer':'exhibitor','channel'=>'phone','evidence'=>'Synthetic independent agreement'],$f['user']);
        }
        $b['match_id']=$cross; $b['exhibitor_representative_id']=$rep;
        $first=app(B2BScheduler::class)->schedule($a,$f['user']); $second=app(B2BScheduler::class)->schedule($b,$f['user']);
        $this->assertSame(2,DB::table('b2b_meetings')->count());
        try { app(B2BScheduler::class)->schedule([...$b,'meeting_id'=>$second,'version'=>1,'location_id'=>$a['location_id']],$f['user']); $this->fail('Expected resource collision.'); }
        catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) { $this->assertSame(409,$e->getStatusCode()); }
        $this->assertDatabaseHas('b2b_meetings',['id'=>$second,'location_id'=>$b['location_id'],'version'=>1]);
        $this->assertSame(18,DB::table('b2b_slots')->where('meeting_id',$second)->count());
        app(B2BScheduler::class)->schedule([...$b,'meeting_id'=>$second,'version'=>1,'location_id'=>$a['location_id'],'starts_at'=>'2027-01-01T10:30:00+00:00'],$f['user']);
        $this->assertDatabaseHas('b2b_meetings',['id'=>$second,'version'=>2]);
        $this->assertSame(1,DB::table('b2b_audits')->where('record_id',$second)->where('resource','b2b_meetings')->where('action','reschedule')->count());
    }
}
