<?php
namespace Tests\Feature;
use App\Http\Controllers\ParticipantAdministrationController;
use App\Services\{B2BProfiles,B2BScheduler,ParticipantAuthority};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\B2BFixture;
use Tests\TestCase;
class ParticipantPrivacyTest extends TestCase
{
 use RefreshDatabase;
 private function actor(array $f,int $participant,string $role='owner'):array{
  $identity=(string)Str::uuid();$membership=(string)Str::uuid();DB::table('portal_identity_controls')->insert(['identity_id'=>$identity,'reviewed_by'=>$f['user']->id]);
  DB::table('portal_memberships')->insert(['id'=>$membership,'identity_id'=>$identity,'participant_id'=>$participant,'exhibition_id'=>$f['event'],'role'=>$role,'capabilities'=>json_encode(ParticipantAuthority::ROLES[$role]),'status'=>'active','approval_evidence'=>B2BProfiles::seal(['synthetic'=>true]),'reviewed_by'=>$f['user']->id]);
  return ['identity_id'=>$identity,'membership_id'=>$membership,'exhibition_id'=>$f['event'],'operation'=>'overview','authentication'=>['device_id'=>(string)Str::uuid(),'auth_version'=>1],'payload'=>[]];
 }
 private function command(array $v,string $operation,array $payload):array{return app(ParticipantAuthority::class)->execute([...$v,'operation'=>$operation,'command_id'=>(string)Str::uuid(),'payload'=>$payload]);}
 private function denied(callable $action,int $status):void{try{$action();$this->fail('Unauthorized operation succeeded.');}catch(\Symfony\Component\HttpKernel\Exception\HttpException $e){$this->assertSame($status,$e->getStatusCode());}catch(\Illuminate\Validation\ValidationException $e){$this->assertSame($status,$e->status);}}
 private function staff(array $f,int $participant,string $action,array $payload):array{
  config(['participant_portal.enabled'=>true]);$r=Request::create('/','POST',['action'=>$action,'participant_id'=>$participant,'payload'=>$payload]);$r->setUserResolver(fn()=>$f['user']);return app(ParticipantAdministrationController::class)->command($r);
 }
 public function test_only_released_introductions_are_visible_and_private_counterparty_facts_stay_private():void{
  $f=B2BFixture::create();$v=$this->actor($f,$f['participants'][0][0]);$a=app(ParticipantAuthority::class);$result=$a->execute([...$v,'operation'=>'matches']);$this->assertCount(1,$result['items']);$row=$result['items'][0];$this->assertSame($f['matches'][0],$row['id']);
  foreach(['capacity','capacity_evidence','required_products','preferred_origins','required_certifications','procurement_criteria','catalogue_evidence','origin_evidence']as $field)$this->assertArrayNotHasKey($field,$row['profile']);
  foreach($row['factors']as $factor){$this->assertArrayNotHasKey('reason',$factor);$this->assertArrayNotHasKey('evidence',$factor);}
  $other=$this->actor($f,$f['participants'][1][0]);$this->denied(fn()=>$a->execute([...$v,'membership_id'=>$other['membership_id'],'operation'=>'profile']),403);$this->denied(fn()=>$a->execute([...$v,'exhibition_id'=>$f['event']+1,'operation'=>'profile']),403);
  $this->denied(fn()=>$a->execute([...$v,'operation'=>'profile','payload'=>['participant_id'=>$f['participants'][1][0]]]),422);
 }
 public function test_profile_review_preserves_all_financial_records_and_invalidates_old_matching_facts():void{
  $f=B2BFixture::create();$v=$this->actor($f,$f['participants'][0][0]);$snapshot=[];foreach(['clients','deals','booths','payments','payment_schedules','commissions','invoices']as $table)$snapshot[$table]=json_encode(DB::table($table)->orderBy('id')->get());
  $profile=$f['profile'];unset($profile['catalogue_evidence'],$profile['origin_evidence']);$profile['description_en']='SYNTHETIC proposed sourcing change';
  $draft=$this->command($v,'profile.submit',['profile_version'=>1,'profile'=>$profile]);$this->assertSame('submitted',$draft['status']);$this->assertSame(1,DB::table('b2b_participants')->where('id',$f['participants'][0][0])->value('profile_version'));
  $this->staff($f,$f['participants'][0][0],'amendment.review',['id'=>$draft['id'],'decision'=>'approved','reason'=>'SYNTHETIC reviewed requirements']);$this->assertSame(2,DB::table('b2b_participants')->where('id',$f['participants'][0][0])->value('profile_version'));
  $read=app(ParticipantAuthority::class)->execute([...$v,'operation'=>'matches']);$this->assertTrue($read['items'][0]['review_hold']);foreach($snapshot as $table=>$before)$this->assertSame($before,json_encode(DB::table($table)->orderBy('id')->get()),$table.' changed');
 }
 public function test_concierge_cannot_bypass_qualification_and_unauthorized_fields_are_rejected():void{
  $f=B2BFixture::create();$p=$f['participants'][0][1];$v=$this->actor($f,$p);DB::table('b2b_participants')->where('id',$p)->update(['qualification'=>'standard','approved_profile_version'=>null]);DB::table('b2b_concierge')->insert(['participant_id'=>$p,'active'=>true,'evidence'=>B2BProfiles::seal(['synthetic'=>true]),'coordinator_id'=>$f['user']->id]);
  $this->denied(fn()=>app(ParticipantAuthority::class)->execute([...$v,'operation'=>'matches']),403);
  $profile=$f['profile'];unset($profile['catalogue_evidence'],$profile['origin_evidence']);$profile['qualification']='approved';$this->denied(fn()=>$this->command($v,'profile.submit',['profile_version'=>1,'profile'=>$profile]),422);
  $this->denied(fn()=>$this->command($v,'invitation.respond',['match_id'=>$f['matches'][0],'version'=>6,'action'=>'accept','party'=>'buyer']),422);
  $this->assertSame(0,DB::table('portal_amendments')->count());$this->assertSame(0,DB::table('b2b_meetings')->count());
 }
 public function test_eligibility_holds_and_consent_withdrawal_do_not_cancel_or_delete_existing_meetings():void{
  $f=B2BFixture::create();$meeting=app(B2BScheduler::class)->schedule(B2BFixture::booking($f,0),$f['user']);$v=$this->actor($f,$f['participants'][0][0]);$a=app(ParticipantAuthority::class);$this->assertFalse($a->execute([...$v,'operation'=>'meetings'])['items'][0]['review_hold']);
  DB::table('b2b_participants')->where('id',$f['participants'][0][1])->update(['qualification'=>'standard']);$this->assertTrue($a->execute([...$v,'operation'=>'meetings'])['items'][0]['review_hold']);
  $this->command($v,'participation.withdraw',['reason'=>'SYNTHETIC withdrawal of company networking consent']);$this->assertSame('scheduled',DB::table('b2b_meetings')->where('id',$meeting)->value('status'));$this->assertSame(18,DB::table('b2b_slots')->where('meeting_id',$meeting)->count());$this->denied(fn()=>$a->execute([...$v,'operation'=>'profile']),403);
 }
 public function test_global_identity_deactivation_blocks_every_new_authoritative_action():void{
  $f=B2BFixture::create();$v=$this->actor($f,$f['participants'][0][0]);$this->staff($f,$f['participants'][0][0],'identity.deactivate',['id'=>$v['membership_id'],'reason'=>'SYNTHETIC global security revocation']);
  $this->denied(fn()=>app(ParticipantAuthority::class)->contexts($v['identity_id']),403);$this->denied(fn()=>$this->command($v,'request.submit',['kind'=>'introduction','target_id'=>$f['participants'][0][1],'note'=>'Must not be processed']),403);$this->assertSame(0,DB::table('portal_requests')->count());
 }

 public function test_private_drafts_are_versioned_deduplicated_and_cannot_replace_submitted_history():void{
  $f=B2BFixture::create();$v=$this->actor($f,$f['participants'][0][0]);$profile=$f['profile'];unset($profile['catalogue_evidence'],$profile['origin_evidence']);$profile['description_en']='SYNTHETIC persistent private draft';
  $draft=$this->command($v,'profile.submit',['profile_version'=>1,'intent'=>'draft','profile'=>$profile]);$this->assertSame('draft',$draft['status']);
  $same=$this->command($v,'profile.submit',['profile_version'=>1,'intent'=>'draft','profile'=>$profile]);$this->assertSame($draft,$same);$this->assertSame(1,DB::table('portal_amendments')->count());
  $stored=app(ParticipantAuthority::class)->execute([...$v,'operation'=>'amendment','payload'=>['id'=>$draft['id']]]);$this->assertSame($profile['description_en'],$stored['profile']['description_en']);
  $profile['description_en'].=' revised';$revised=$this->command($v,'profile.submit',['profile_version'=>1,'intent'=>'draft','draft_id'=>$draft['id'],'draft_version'=>1,'profile'=>$profile]);$this->assertSame(2,$revised['version']);
  $this->denied(fn()=>$this->command($v,'profile.submit',['profile_version'=>1,'intent'=>'draft','draft_id'=>$draft['id'],'draft_version'=>1,'profile'=>$profile]),409);
  $submitted=$this->command($v,'profile.submit',['profile_version'=>1,'intent'=>'submit','draft_id'=>$draft['id'],'draft_version'=>2,'profile'=>$profile]);$this->assertSame('submitted',$submitted['status']);$this->assertSame(3,$submitted['version']);
  $this->denied(fn()=>$this->command($v,'profile.submit',['profile_version'=>1,'intent'=>'draft','draft_id'=>$draft['id'],'draft_version'=>3,'profile'=>$profile]),409);$this->assertSame(1,DB::table('b2b_participants')->where('id',$f['participants'][0][0])->value('profile_version'));
 }
 public function test_discovery_respects_contact_consent_and_hidden_products():void{
  $f=B2BFixture::create();$p=$f['participants'][0][1];$v=$this->actor($f,$f['participants'][0][0]);$profile=B2BProfiles::open(DB::table('b2b_participants')->where('id',$p)->value('profile'));$profile['public_email']='private@example.test';$profile['public_phone']='SYNTHETIC private';$profile['public_contact_consent']=false;$profile['products'][0]['visibility']='hidden';
  DB::table('b2b_participants')->where('id',$p)->update(['profile'=>B2BProfiles::seal($profile)]);$this->staff($f,$p,'publish',['published'=>true,'profile_version'=>1]);$r=app(ParticipantAuthority::class)->execute([...$v,'operation'=>'discover'])['items'][0]['profile'];
  $this->assertArrayNotHasKey('public_email',$r);$this->assertArrayNotHasKey('public_phone',$r);$this->assertSame([],$r['products']);
 }
}
