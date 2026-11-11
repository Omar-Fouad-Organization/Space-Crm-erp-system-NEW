<?php
namespace Tests\Feature;

use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;
use Tests\Support\B2BFollowupFixture;
use Tests\TestCase;

class B2BFollowupConcurrencyTest extends TestCase
{
    use DatabaseMigrations;
    protected function tearDown(): void { parent::tearDown(); \Illuminate\Foundation\Testing\RefreshDatabaseState::$migrated=false; }

    public function test_simultaneous_requests_commit_one_task_and_no_orphan_task(): void
    {
        $f=B2BFollowupFixture::create();
        $server=stream_socket_server('tcp://127.0.0.1:0');$this->assertNotFalse($server);$address='tcp://'.stream_socket_get_name($server,false);
        $db=config('database.connections.mysql');$env=['APP_ENV'=>'testing','DB_CONNECTION'=>'mysql','DB_URL'=>'','DB_HOST'=>'127.0.0.1','DB_PORT'=>(string)$db['port'],'DB_DATABASE'=>'space_crm_test','DB_USERNAME'=>$db['username'],'DB_PASSWORD'=>$db['password'],'CACHE_STORE'=>'array'];
        $workers=[];$connections=[];
        try {
            for ($i=0;$i<2;$i++) {
                $p=new Process([PHP_BINARY,base_path('tests/Support/create-b2b-followup.php')],base_path(),$env);
                $p->setInput(json_encode(['barrier'=>$address,'user'=>$f['user']->id,'meeting'=>$f['meeting'],'input'=>$f['input']]));$p->setTimeout(45);$p->start();$workers[]=$p;
            }
            foreach ($workers as $p) {$c=stream_socket_accept($server,20);$this->assertNotFalse($c);stream_set_timeout($c,10);$this->assertSame("ready\n",fgets($c));$connections[]=$c;}
            foreach ($connections as $c) fwrite($c,"go\n");
            $results=[];foreach ($workers as $p) {$p->wait();$this->assertSame(0,$p->getExitCode(),$p->getErrorOutput());$results[]=json_decode($p->getOutput(),true,512,JSON_THROW_ON_ERROR);}
            $this->assertSame($results[0]['id'],$results[1]['id']);$this->assertSame(1,count(array_filter($results,fn($r)=>$r['created'])));
            $this->assertDatabaseCount('tasks',1);$this->assertDatabaseCount('b2b_followup_tasks',1);
            $this->assertSame(0,DB::table('tasks')->whereNotIn('id',DB::table('b2b_followup_tasks')->select('task_id'))->count());
            $this->assertSame(1,DB::table('b2b_audits')->where('action','crm_followup_linked')->count());
        } finally {foreach ($connections as $c) fclose($c);fclose($server);foreach ($workers as $p) if ($p->isRunning()) $p->stop();}
    }
}
