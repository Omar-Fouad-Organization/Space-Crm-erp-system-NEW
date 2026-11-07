<?php
namespace Tests\Feature;
use App\Services\{B2BProfiles,ParticipantAuthority};
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;
use Tests\Support\B2BFixture;
use Tests\TestCase;
class ParticipantConcurrencyTest extends TestCase
{
 use DatabaseMigrations;
 protected function tearDown():void{parent::tearDown();\Illuminate\Foundation\Testing\RefreshDatabaseState::$migrated=false;}
 private function race(string $kind,array $payloads):array{
  $server=stream_socket_server('tcp://127.0.0.1:0');$this->assertNotFalse($server);$address='tcp://'.stream_socket_get_name($server,false);$db=config('database.connections.mysql');
  $env=['APP_ENV'=>'testing','APP_KEY'=>config('app.key'),'DB_CONNECTION'=>'mysql','DB_URL'=>'','DB_HOST'=>'127.0.0.1','DB_PORT'=>(string)$db['port'],'DB_DATABASE'=>'space_crm_test','DB_USERNAME'=>$db['username'],'DB_PASSWORD'=>$db['password'],'CACHE_STORE'=>'array'];$workers=[];$connections=[];
  try{foreach($payloads as $payload){$p=new Process([PHP_BINARY,base_path('tests/Support/participant-worker.php')],base_path(),$env);$p->setInput(json_encode(compact('kind','payload')+['barrier'=>$address],JSON_THROW_ON_ERROR));$p->setTimeout(45);$p->start();$workers[]=$p;}
   foreach($workers as $worker){$c=stream_socket_accept($server,20);$this->assertNotFalse($c);stream_set_timeout($c,15);$this->assertSame("ready\n",fgets($c));$connections[]=$c;}foreach($connections as $c)fwrite($c,"go\n");
   $results=[];foreach($workers as $worker){$worker->wait();$this->assertSame(0,$worker->getExitCode(),$worker->getErrorOutput());$results[]=trim($worker->getOutput());}sort($results);return $results;
  }finally{foreach($connections as $c)fclose($c);fclose($server);foreach($workers as $worker)if($worker->isRunning())$worker->stop();}
 }
 public function test_same_acceptance_command_has_one_effect_across_independent_processes():void{
  $f=B2BFixture::create();$id=$f['matches'][0];DB::table('b2b_matches')->where('id',$id)->update(['status'=>'invitation_pending']);DB::table('b2b_invitations')->where('match_id',$id)->update(['status'=>'pending']);
  $identity=(string)Str::uuid();$membership=(string)Str::uuid();DB::table('portal_identity_controls')->insert(['identity_id'=>$identity,'reviewed_by'=>$f['user']->id]);DB::table('portal_memberships')->insert(['id'=>$membership,'identity_id'=>$identity,'participant_id'=>$f['participants'][0][0],'exhibition_id'=>$f['event'],'role'=>'coordinator','capabilities'=>json_encode(ParticipantAuthority::ROLES['coordinator']),'status'=>'active','approval_evidence'=>B2BProfiles::seal(['synthetic'=>true]),'reviewed_by'=>$f['user']->id]);
  $payload=['identity_id'=>$identity,'membership_id'=>$membership,'exhibition_id'=>$f['event'],'operation'=>'invitation.respond','authentication'=>['device_id'=>(string)Str::uuid(),'auth_version'=>1],'command_id'=>(string)Str::uuid(),'payload'=>['match_id'=>$id,'version'=>6,'action'=>'accept']];
  $this->assertSame(['confirmed','confirmed'],$this->race('command',[$payload,$payload]));$this->assertSame(1,DB::table('portal_commands')->count());$this->assertSame(1,DB::table('portal_activity')->where('operation','invitation.respond')->count());$this->assertSame(1,DB::table('b2b_invitations')->where('match_id',$id)->where('status','accepted')->count());$this->assertSame(0,DB::table('b2b_meetings')->count());
 }
 public function test_simultaneous_invitation_redemption_cannot_bind_two_identities():void{
  $f=B2BFixture::create();$token=Str::random(64);DB::table('portal_access_invitations')->insert(['id'=>(string)Str::uuid(),'participant_id'=>$f['participants'][0][0],'email'=>'synthetic@example.test','token_hash'=>hash('sha256',$token),'role'=>'owner','evidence'=>B2BProfiles::seal(['synthetic'=>true]),'invited_by'=>$f['user']->id,'expires_at'=>now()->addHour()]);
  $payload=['email'=>'synthetic@example.test','token'=>$token];$this->assertSame(['confirmed','conflict'],$this->race('activate',[[...$payload,'identity_id'=>(string)Str::uuid()],[...$payload,'identity_id'=>(string)Str::uuid()]]));$this->assertSame(1,DB::table('portal_memberships')->count());
 }

 public function test_simultaneous_verified_email_redemption_has_exactly_one_membership(): void
 {
  $f=B2BFixture::create();$token=Str::random(64);$id=(string)Str::uuid();
  DB::table('portal_access_invitations')->insert(['id'=>$id,'participant_id'=>$f['participants'][0][1],'email'=>'synthetic@example.test','token_hash'=>hash('sha256',$token),'role'=>'editor','evidence'=>B2BProfiles::seal(['synthetic'=>true]),'invited_by'=>$f['user']->id,'expires_at'=>now()->addHour(),'proof_channel'=>'verified_email','generation'=>1,'status'=>'issued']);
  DB::table('portal_invitation_deliveries')->insert(['id'=>(string)Str::uuid(),'invitation_id'=>$id,'generation'=>1,'key_id'=>'primary','state'=>'sandbox_accepted','attempts'=>1,'attempted_at'=>now(),'expires_at'=>now()->addHour()]);
  $p=['email'=>'synthetic@example.test','token'=>$token];
  $this->assertSame(['confirmed','conflict'],$this->race('activate-verified',[[...$p,'identity_id'=>(string)Str::uuid()],[...$p,'identity_id'=>(string)Str::uuid()]]));
  $this->assertDatabaseCount('portal_memberships',1);$this->assertDatabaseHas('portal_access_invitations',['id'=>$id,'status'=>'redeemed']);
  $this->assertSame(1,DB::table('portal_invitation_events')->where('invitation_id',$id)->where('event','redemption_rejected')->count());
 }
}
