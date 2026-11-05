<?php
namespace App\Http\Controllers;
use App\Services\ParticipantAuthority;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
class ParticipantGatewayController extends Controller
{
    public function preflight(Request $r)
    {
        abort_unless(app()->environment(['local','testing']),503,'Operational verified-email invitation delivery is not activated.');
        $v=Validator::make($r->json()->all(),['email'=>'required|email|max:255','token'=>'required|string|min:40|max:255'])->validate();$db=\Illuminate\Support\Facades\DB::class;
        $inv=$db::table('portal_access_invitations')->where('token_hash',hash('sha256',$v['token']))->first();abort_unless($inv && !$inv->revoked_at && strtolower($inv->email)===strtolower($v['email']) && \Carbon\CarbonImmutable::parse($inv->expires_at)->isFuture(),403,'Invitation is invalid or expired.');
        $p=$db::table('b2b_participants')->where('id',$inv->participant_id)->first();abort_unless($p && app(\App\Services\B2BAccess::class)->eligible($p,false),403);
        if($inv->redeemed_identity_id)abort_unless($db::table('portal_identity_controls')->where('identity_id',$inv->redeemed_identity_id)->whereNull('disabled_at')->exists(),403);
        return response()->json(['valid'=>true,'identity_id'=>$inv->redeemed_identity_id])->header('Cache-Control','no-store');
    }
    public function activate(Request $r)
    {
        abort_unless(app()->environment(['local','testing']),503,'Operational verified-email invitation delivery is not activated.');
        $v=Validator::make($r->json()->all(),['identity_id'=>'required|uuid','email'=>'required|email|max:255','token'=>'required|string|min:40|max:255'])->validate();
        return \Illuminate\Support\Facades\DB::transaction(function()use($v){
            $db=\Illuminate\Support\Facades\DB::class;
            $inv=$db::table('portal_access_invitations')->where('token_hash',hash('sha256',$v['token']))->lockForUpdate()->first();
            abort_unless($inv && !$inv->revoked_at && strtolower($inv->email)===strtolower($v['email']) && \Carbon\CarbonImmutable::parse($inv->expires_at)->isFuture(),403,'Invitation is invalid or expired.');
            $db::table('portal_identity_controls')->insertOrIgnore(['identity_id'=>$v['identity_id'],'reviewed_by'=>$inv->invited_by,'created_at'=>now(),'updated_at'=>now()]);$control=$db::table('portal_identity_controls')->where('identity_id',$v['identity_id'])->lockForUpdate()->first();abort_unless($control && !$control->disabled_at,403,'Participant account access is revoked.');
            $p=$db::table('b2b_participants')->where('id',$inv->participant_id)->lockForUpdate()->first();
            abort_unless($p && app(\App\Services\B2BAccess::class)->eligible($p,false,true),403);
            if($inv->redeemed_identity_id){abort_unless($inv->redeemed_identity_id===$v['identity_id'],409,'Invitation already used.');return ['membership_id'=>$inv->membership_id];}
            $existing=$db::table('portal_memberships')->where('identity_id',$v['identity_id'])->where('participant_id',$p->id)->where('exhibition_id',$p->exhibition_id)->lockForUpdate()->first();
            $id=$existing?->id??(string)\Illuminate\Support\Str::uuid();
            $db::table('portal_memberships')->updateOrInsert(['id'=>$id],['identity_id'=>$v['identity_id'],'participant_id'=>$p->id,'exhibition_id'=>$p->exhibition_id,'role'=>$inv->role,'capabilities'=>json_encode(ParticipantAuthority::ROLES[$inv->role]),'status'=>'active','revoked_at'=>null,'approval_evidence'=>$inv->evidence,'reviewed_by'=>$inv->invited_by,'created_at'=>$existing?->created_at??now(),'updated_at'=>now()]);
            $db::table('portal_access_invitations')->where('id',$inv->id)->update(['redeemed_identity_id'=>$v['identity_id'],'membership_id'=>$id,'updated_at'=>now()]);
            $db::table('portal_activity')->insert(['membership_id'=>$id,'identity_id'=>$v['identity_id'],'exhibition_id'=>$p->exhibition_id,'operation'=>'account.activate','details'=>\App\Services\B2BProfiles::seal(['invitation_id'=>$inv->id,'before'=>$existing?['role'=>$existing->role,'status'=>$existing->status,'capabilities'=>json_decode($existing->capabilities,true),'approval_evidence'=>$existing->approval_evidence]:null,'after'=>['role'=>$inv->role,'capabilities'=>ParticipantAuthority::ROLES[$inv->role]]]),'created_at'=>now()]);
            return ['membership_id'=>$id];
        },3);
    }
    public function command(Request $r,ParticipantAuthority $authority)
    {
        return response()->json($authority->execute($r->json()->all()))->header('Cache-Control','no-store');
    }
    public function contexts(Request $r,ParticipantAuthority $authority)
    {
        $v=Validator::make($r->json()->all(),['identity_id'=>'required|uuid'])->validate();
        return response()->json(['items'=>$authority->contexts($v['identity_id']),'authoritative_at'=>now()->toIso8601String()])->header('Cache-Control','no-store');
    }
    public function identityStatus(Request $r)
    {
        $v=Validator::make($r->json()->all(),['identity_id'=>'required|uuid'])->validate();return response()->json(['active'=>\Illuminate\Support\Facades\DB::table('portal_identity_controls')->where('identity_id',$v['identity_id'])->whereNull('disabled_at')->exists()])->header('Cache-Control','no-store');
    }
}
