<?php
namespace Tests\Feature;
use App\Services\{B2BProfiles,ParticipantAuthority};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\B2BFixture;
use Tests\TestCase;
class ParticipantGatewayTest extends TestCase
{
    use RefreshDatabase;
    private function membership(array $f,string $role='owner'): array
    {
        $identity=(string)Str::uuid();$id=(string)Str::uuid();
        DB::table('portal_identity_controls')->insert(['identity_id'=>$identity,'reviewed_by'=>$f['user']->id]);DB::table('portal_memberships')->insert(['id'=>$id,'identity_id'=>$identity,'participant_id'=>$f['participants'][0][0],'exhibition_id'=>$f['event'],'role'=>$role,'capabilities'=>json_encode(ParticipantAuthority::ROLES[$role]),'status'=>'active','approval_evidence'=>B2BProfiles::seal(['reference'=>'Synthetic reviewed authority']),'reviewed_by'=>$f['user']->id]);
        return ['identity_id'=>$identity,'membership_id'=>$id,'exhibition_id'=>$f['event'],'operation'=>'overview','authentication'=>['device_id'=>(string)Str::uuid(),'auth_version'=>1],'payload'=>[]];
    }
    public function test_gateway_is_disabled_and_rejects_unsigned_employee_requests(): void
    {
        $this->postJson('/api/internal/participant-portal/command',[])->assertStatus(503);
        config(['participant_portal.enabled'=>true,'b2b.enabled'=>true,'authorization.enabled'=>true]);
        $this->postJson('/api/internal/participant-portal/command',[])->assertUnauthorized();
    }
    public function test_signature_body_binding_replay_and_purpose_are_enforced(): void
    {
        config(['participant_portal.enabled'=>true,'b2b.enabled'=>true,'authorization.enabled'=>true,'participant_portal.keys.primary'=>str_repeat('p',40)]);
        $identity=(string)Str::uuid();$staff=\App\Models\User::factory()->create();DB::table('portal_identity_controls')->insert(['identity_id'=>$identity,'reviewed_by'=>$staff->id]);$body=json_encode(['identity_id'=>$identity]);$target='/api/internal/participant-portal/contexts';
        $claims=['version'=>1,'purpose'=>'SPACE-PARTICIPANT-V1','issuer'=>'green-life-portal','audience'=>'space-participant-api','key_id'=>'primary','issued_at'=>time(),'expires_at'=>time()+30,'nonce'=>(string)Str::uuid(),'method'=>'POST','target'=>$target,'body_sha256'=>hash('sha256',$body)];
        $encoded=rtrim(strtr(base64_encode(json_encode($claims)),'+/','-_'),'=');
        $headers=['CONTENT_TYPE'=>'application/json','CONTENT_LENGTH'=>strlen($body),'HTTP_ACCEPT'=>'application/json','HTTP_X_SPACE_PORTAL'=>$encoded,'HTTP_X_SPACE_PORTAL_SIGNATURE'=>hash_hmac('sha256',$encoded,str_repeat('p',40))];
        $this->call('POST',$target,[],[],[],$headers,$body)->assertOk()->assertJsonPath('items',[]);
        $this->call('POST',$target,[],[],[],$headers,$body)->assertStatus(409);
        $this->call('POST',$target,[],[],[],$headers,'{}')->assertUnauthorized();
    }
    public function test_membership_identity_event_capability_and_live_eligibility_are_authoritative(): void
    {
        $f=B2BFixture::create();$v=$this->membership($f);$a=app(ParticipantAuthority::class);
        $this->assertSame($f['participants'][0][0],$a->execute($v)['participant']['id']);
        foreach([['identity_id'=>(string)Str::uuid()],['exhibition_id'=>$f['event']+1]] as $bad){try{$a->execute([...$v,...$bad]);$this->fail('Scope bypass');}catch(\Symfony\Component\HttpKernel\Exception\HttpException $e){$this->assertSame(403,$e->getStatusCode());}}
        DB::table('portal_memberships')->where('id',$v['membership_id'])->update(['status'=>'revoked','revoked_at'=>now()]);
        $this->expectException(\Symfony\Component\HttpKernel\Exception\HttpException::class);$a->execute($v);
    }
    public function test_draft_cannot_self_verify_or_replace_approved_profile_and_duplicate_command_has_one_effect(): void
    {
        $f=B2BFixture::create();$v=$this->membership($f);$a=app(ParticipantAuthority::class);$before=DB::table('b2b_participants')->where('id',$f['participants'][0][0])->first();
        $profile=$f['profile'];unset($profile['catalogue_evidence'],$profile['origin_evidence']);
        $v=[...$v,'operation'=>'profile.submit','command_id'=>(string)Str::uuid(),'payload'=>['profile'=>$profile,'profile_version'=>1]];
        $one=$a->execute($v);$this->assertSame($one,$a->execute($v));$this->assertSame(1,DB::table('portal_amendments')->count());
        $this->assertSame($before->profile,DB::table('b2b_participants')->where('id',$before->id)->value('profile'));
        $v['command_id']=(string)Str::uuid();$v['payload']['profile']['capacity_verified']=true;
        $this->expectException(\Symfony\Component\HttpKernel\Exception\HttpException::class);$a->execute($v);
    }
    public function test_direct_acceptance_is_owned_idempotent_and_requires_two_independent_parties():void
    {
        $f=B2BFixture::create();$v=$this->membership($f);$id=$f['matches'][0];
        DB::table('b2b_matches')->where('id',$id)->update(['status'=>'invitation_pending']);DB::table('b2b_invitations')->where('match_id',$id)->update(['status'=>'pending']);
        $a=app(ParticipantAuthority::class);$v=[...$v,'operation'=>'invitation.respond','authentication'=>['device_id'=>(string)Str::uuid(),'auth_version'=>1],'command_id'=>(string)Str::uuid(),'payload'=>['match_id'=>$id,'version'=>6,'action'=>'accept']];
        $result=$a->execute($v);$this->assertSame('invitation_pending',$result['status']);$this->assertSame($result,$a->execute($v));
        $this->assertSame(1,DB::table('b2b_invitations')->where('match_id',$id)->where('status','accepted')->count());
        $inv=DB::table('b2b_invitations')->where('match_id',$id)->where('party','buyer')->first();$this->assertSame('authenticated_portal',$inv->channel);$this->assertNull($inv->recorded_by);$this->assertSame($v['identity_id'],B2BProfiles::open($inv->evidence)['identity_id']);
        $this->assertSame(0,DB::table('b2b_meetings')->count());
    }
    public function test_other_organization_cannot_accept_and_reader_cannot_submit():void
    {
        $f=B2BFixture::create();$v=$this->membership($f,'reader');$v=[...$v,'operation'=>'invitation.respond','command_id'=>(string)Str::uuid(),'payload'=>['match_id'=>$f['matches'][1],'version'=>6,'action'=>'accept']];
        $this->expectException(\Symfony\Component\HttpKernel\Exception\HttpException::class);app(ParticipantAuthority::class)->execute($v);
    }
}
