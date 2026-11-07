<?php
namespace Tests\Feature;
use App\Http\Controllers\{ParticipantAdministrationController,ParticipantGatewayController};
use App\Services\{B2BProfiles,ParticipantAuthority};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\B2BFixture;
use Tests\TestCase;
class ParticipantOnboardingTest extends TestCase
{
 use RefreshDatabase;
 private function invite(array $f,int $participant):array{
  config(['participant_portal.enabled'=>true,'participant_onboarding.test_invites'=>true]);$r=Request::create('/','POST',['action'=>'invite','participant_id'=>$participant,'payload'=>['email'=>'synthetic@example.test','role'=>'owner','evidence'=>'SYNTHETIC verified individual and organization authority']]);$r->setUserResolver(fn()=>$f['user']);return app(ParticipantAdministrationController::class)->command($r)->getData(true);
 }
 private function redeem(array $inv,string $identity,?string $email=null):array{
  $r=Request::create('/','POST',[],[],[],['CONTENT_TYPE'=>'application/json'],json_encode(['identity_id'=>$identity,'email'=>$email??'synthetic@example.test','token'=>$inv['token']]));return app(ParticipantGatewayController::class)->activate($r);
 }
 public function test_single_use_invitation_is_hashed_recipient_bound_and_retry_safe():void{
  $f=B2BFixture::create();$inv=$this->invite($f,$f['participants'][0][0]);$stored=DB::table('portal_access_invitations')->where('id',$inv['id'])->first();$this->assertSame(hash('sha256',$inv['token']),$stored->token_hash);$this->assertStringNotContainsString($inv['token'],json_encode($stored));
  $id=(string)Str::uuid();$one=$this->redeem($inv,$id);$this->assertSame($one,$this->redeem($inv,$id));$this->assertSame(1,DB::table('portal_memberships')->count());
  $this->expectException(\Symfony\Component\HttpKernel\Exception\HttpException::class);$this->redeem($inv,(string)Str::uuid());
 }
 public function test_email_knowledge_without_the_invited_recipient_channel_cannot_claim_organization():void{
  $f=B2BFixture::create();$inv=$this->invite($f,$f['participants'][0][1]);$this->expectException(\Symfony\Component\HttpKernel\Exception\HttpException::class);$this->redeem($inv,(string)Str::uuid(),'another@example.test');
 }
 public function test_expired_and_revoked_invitations_create_no_membership():void{
  $f=B2BFixture::create();$inv=$this->invite($f,$f['participants'][0][0]);
  foreach([['expires_at'=>now()->subSecond()],['expires_at'=>now()->addHour(),'revoked_at'=>now()]]as $invalid){DB::table('portal_access_invitations')->where('id',$inv['id'])->update($invalid);try{$this->redeem($inv,(string)Str::uuid());$this->fail('Invalid invitation accepted');}catch(\Symfony\Component\HttpKernel\Exception\HttpException $e){$this->assertSame(403,$e->getStatusCode());}}
  $this->assertSame(0,DB::table('portal_memberships')->count());
 }
 public function test_lost_buyer_verification_and_exhibitor_commercial_eligibility_block_onboarding():void{
  $f=B2BFixture::create();foreach($f['participants'][0]as $participant){$p=DB::table('b2b_participants')->where('id',$participant)->first();if($p->kind==='buyer')DB::table('intake_submissions')->where('id',$p->intake_submission_id)->update(['type'=>'visitor','status'=>'registered']);else DB::table('deals')->where('id',$p->deal_id)->update(['status'=>'lead_created']);try{$this->invite($f,$participant);$this->fail('Ineligible source received access');}catch(\Symfony\Component\HttpKernel\Exception\HttpException $e){$this->assertSame(422,$e->getStatusCode());}}
  $this->assertSame(0,DB::table('portal_access_invitations')->count());
 }
 public function test_live_source_withdrawal_revokes_existing_external_access_without_deleting_history():void{
  $f=B2BFixture::create();$id=(string)Str::uuid();$result=$this->redeem($this->invite($f,$f['participants'][0][0]),$id);$p=DB::table('b2b_participants')->where('id',$f['participants'][0][0])->first();DB::table('intake_submissions')->where('id',$p->intake_submission_id)->update(['withdrawn_at'=>now()]);
  $this->assertSame([],app(ParticipantAuthority::class)->contexts($id));$this->assertSame(2,DB::table('b2b_matches')->whereIn('id',$f['matches'])->count());
  $this->expectException(\Symfony\Component\HttpKernel\Exception\HttpException::class);app(ParticipantAuthority::class)->execute(['identity_id'=>$id,'membership_id'=>$result['membership_id'],'exhibition_id'=>$f['event'],'operation'=>'overview','payload'=>[]]);
 }
}
