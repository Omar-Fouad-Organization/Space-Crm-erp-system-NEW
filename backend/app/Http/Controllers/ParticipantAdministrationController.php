<?php
namespace App\Http\Controllers;
use App\Services\{B2BAccess,B2BProfiles,ParticipantAuthority,PermissionPolicy};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\{DB,Validator};
use Illuminate\Support\Str;
class ParticipantAdministrationController extends Controller
{
    private function authorize(Request $r,string $action):void
    {
        abort_unless(config('participant_portal.enabled'),503);
        app(B2BAccess::class)->authorize('view',$r->user());app(PermissionPolicy::class)->authorize('b2b.portal.'.$action,$r->user());
    }
    public function index(Request $r)
    {
        $this->authorize($r,'users.view');$v=$r->validate(['exhibition_id'=>'required|integer','page'=>'sometimes|integer|min:1|max:10000']);app(B2BAccess::class)->event($v['exhibition_id'],$r->user());
        $ids=app(B2BAccess::class)->participants($r->user())->where('exhibition_id',$v['exhibition_id'])->select('id');$offset=(($v['page']??1)-1)*25;
        return ['memberships'=>DB::table('portal_memberships')->whereIn('participant_id',$ids)->offset($offset)->limit(25)->get(['id','participant_id','role','status','revoked_at']),
            'amendments'=>DB::table('portal_amendments')->whereIn('participant_id',$ids)->offset($offset)->limit(25)->get(['id','participant_id','profile_version','status','created_at']),
            'invitations'=>DB::table('portal_access_invitations')->whereIn('participant_id',$ids)->offset($offset)->limit(25)->get(['id','participant_id','email','role','expires_at','revoked_at']),
            'requests'=>DB::table('portal_requests as r')->join('portal_memberships as m','m.id','=','r.membership_id')->whereIn('m.participant_id',$ids)->offset($offset)->limit(25)->get(['r.id','r.kind','r.target_id','r.status','r.version','m.participant_id'])];
    }
    public function command(Request $r)
    {
        $v=$r->validate(['action'=>'required|in:invite,revoke,invitation.revoke,publish,amendment.review,request.review,identity.deactivate','participant_id'=>'required|integer','payload'=>'required|array']);
        $permission=match($v['action']){'identity.deactivate'=>'accounts.deactivate','invite'=>'invitations.manage','revoke','invitation.revoke'=>'access.revoke','request.review'=>'requests.manage',default=>'profiles.review'};
        $this->authorize($r,$permission);
        return DB::transaction(function()use($v,$r){
            if($v['action']==='identity.deactivate'){$id=Validator::make($v['payload'],['id'=>'required|uuid'])->validate()['id'];$member=DB::table('portal_memberships')->where('id',$id)->where('participant_id',$v['participant_id'])->first();abort_unless($member,404);DB::table('portal_identity_controls')->where('identity_id',$member->identity_id)->lockForUpdate()->first();}
            $p=app(B2BAccess::class)->participant($v['participant_id'],$r->user(),true);$a=$v['payload'];
            if($v['action']==='invite'){
                abort_unless(app()->environment(['local','testing']),503,'Operational invitation delivery requires an approved verified-email transport. Raw test invitations cannot be issued in production.');
                $a=Validator::make($a,['email'=>'required|email|max:255','role'=>'required|in:owner,editor,coordinator,reader','evidence'=>'required|string|min:10|max:2000'])->validate();
                abort_unless(app(B2BAccess::class)->eligible($p,false,true),422);
                $token=Str::random(64);$id=(string)Str::uuid();
                DB::table('portal_access_invitations')->insert(['id'=>$id,'participant_id'=>$p->id,'email'=>strtolower($a['email']),'role'=>$a['role'],'token_hash'=>hash('sha256',$token),'evidence'=>B2BProfiles::seal(['authority'=>$a['evidence'],'reviewer'=>$r->user()->id]),'invited_by'=>$r->user()->id,'expires_at'=>now()->addHours(24),'created_at'=>now(),'updated_at'=>now()]);
                app(B2BProfiles::class)->audit($p->exhibition_id,'b2b_participants',$p->id,'portal_invite',$r->user(),['invitation_id'=>$id]);
                return response()->json(['id'=>$id,'token'=>$token,'delivery'=>'not_sent','expires_in_hours'=>24])->header('Cache-Control','no-store');
            }
            if($v['action']==='revoke' || $v['action']==='invitation.revoke'){
                $a=Validator::make($a,['id'=>'required|uuid'])->validate();$table=$v['action']==='revoke'?'portal_memberships':'portal_access_invitations';
                $query=DB::table($table)->where('id',$a['id'])->where('participant_id',$p->id);abort_unless($query->exists(),404);
                $query->update(['revoked_at'=>now(),'updated_at'=>now(),...($table==='portal_memberships'?['status'=>'revoked']:[])]);
            }
            if($v['action']==='identity.deactivate'){
                $a=Validator::make($a,['id'=>'required|uuid','reason'=>'required|string|max:2000'])->validate();$member=DB::table('portal_memberships')->where('id',$a['id'])->where('participant_id',$p->id)->first();abort_unless($member,404);DB::table('portal_identity_controls')->updateOrInsert(['identity_id'=>$member->identity_id],['disabled_at'=>now(),'reason'=>B2BProfiles::seal(['reason'=>$a['reason']]),'reviewed_by'=>$r->user()->id,'created_at'=>now(),'updated_at'=>now()]);
            }
            if($v['action']==='publish'){
                $a=Validator::make($a,['published'=>'required|boolean','profile_version'=>'required|integer'])->validate();abort_unless($a['profile_version']==$p->profile_version && app(B2BAccess::class)->eligible($p,false,true),409);
                $profile=B2BProfiles::open($p->profile);$terms=[$profile['name_en'],$profile['name_ar'],$profile['industry']??''];foreach(array_filter($profile['products']??[],fn($product)=>($product['visibility']??'published')==='published') as $product)$terms[]=($product['name_en']??'').' '.($product['name_ar']??'').' '.($product['description_en']??'').' '.($product['description_ar']??'');foreach($profile['categories'] as $category)$terms[]='category:'.$category.':';
                DB::table('portal_publications')->updateOrInsert(['participant_id'=>$p->id],['profile_version'=>$p->profile_version,'published'=>$a['published'],'categories'=>json_encode($profile['categories']),'country'=>$profile['country']??null,'sector'=>$profile['industry']??null,'search_text'=>mb_substr(implode(' ',$terms),0,12000),'reviewed_by'=>$r->user()->id,'created_at'=>now(),'updated_at'=>now()]);
            }
            if($v['action']==='request.review'){
                $a=Validator::make($a,['id'=>'required|uuid','status'=>'required|in:acknowledged,rejected,coordinated','version'=>'required|integer|min:1','reason'=>'required|string|max:2000'])->validate();
                $q=DB::table('portal_requests')->where('id',$a['id'])->whereIn('membership_id',DB::table('portal_memberships')->where('participant_id',$p->id)->select('id'))->where('exhibition_id',$p->exhibition_id); $request=$q->lockForUpdate()->first();abort_unless($request,404);abort_unless($request->version==$a['version'] && in_array($request->status,['submitted','acknowledged'],true),409,'Organizer request changed or already resolved.');
                $q->update(['status'=>$a['status'],'version'=>$request->version+1,'updated_at'=>now()]);
                // Acknowledgment never changes bookings; staff must use the existing scheduler separately.
            }
            if($v['action']==='amendment.review'){
                $a=Validator::make($a,['id'=>'required|uuid','decision'=>'required|in:approved,changes_requested,rejected','reason'=>'required|string|max:2000','profile'=>'sometimes|array'])->validate();
                $draft=DB::table('portal_amendments')->where('id',$a['id'])->where('participant_id',$p->id)->lockForUpdate()->first();abort_unless($draft && $draft->status==='submitted' && $draft->profile_version==$p->profile_version,409);
                if($a['decision']==='approved')app(B2BProfiles::class)->update($p->id,['version'=>$p->version,'status'=>$p->status,'profile'=>$a['profile']??B2BProfiles::open($draft->payload),'reason'=>$a['reason']],$r->user());
                DB::table('portal_amendments')->where('id',$draft->id)->update(['status'=>$a['decision'],'version'=>$draft->version+1,'review_note'=>B2BProfiles::seal(['reason'=>$a['reason']]),'reviewed_by'=>$r->user()->id,'updated_at'=>now()]);
            }
            app(B2BProfiles::class)->audit($p->exhibition_id,'b2b_participants',$p->id,'portal_'.$v['action'],$r->user(),['payload'=>array_diff_key($a,['profile'=>true])]);return ['saved'=>true];
        },3);
    }
    public function amendment(Request $r,string $id)
    {
        $this->authorize($r,'profiles.review');$a=DB::table('portal_amendments')->where('id',$id)->first();abort_unless($a,404);app(B2BAccess::class)->participant($a->participant_id,$r->user());
        return response()->json(['id'=>$id,'profile'=>B2BProfiles::open($a->payload),'status'=>$a->status,'profile_version'=>$a->profile_version])->header('Cache-Control','no-store');
    }
    public function requestDetails(Request $r,string $id)
    {
        $this->authorize($r,'requests.manage');$row=DB::table('portal_requests')->where('id',$id)->first();abort_unless($row,404);$m=DB::table('portal_memberships')->where('id',$row->membership_id)->first();abort_unless($m,404);app(B2BAccess::class)->participant($m->participant_id,$r->user());return ['id'=>$id,'participant_id'=>$m->participant_id,'kind'=>$row->kind,'status'=>$row->status,'version'=>$row->version,'payload'=>B2BProfiles::open($row->payload)];
    }
    public function file(Request $r,string $id,string $file)
    {
        $this->authorize($r,'profiles.review');$draft=DB::table('portal_amendments')->where('id',$id)->first();abort_unless($draft,404);$p=app(B2BAccess::class)->participant($draft->participant_id,$r->user());$profile=B2BProfiles::open($draft->payload);
        $ids=[...array_column($profile['products']??[],'media_id'),...array_column($profile['certifications']??[],'media_id'),$profile['logo_media_id']??null];abort_unless(in_array($file,$ids,true),404);
        [$raw,$mime]=app(\App\Services\ParticipantMedia::class)->read(['file_id'=>$file,'participant_id'=>$p->id,'membership_id'=>$draft->membership_id,'exhibition_id'=>$p->exhibition_id,'employee_id'=>$r->user()->id]);
        app(B2BProfiles::class)->audit($p->exhibition_id,'b2b_participants',$p->id,'portal_private_media_read',$r->user(),['amendment_id'=>$id,'file_id'=>$file]);
        return response($raw)->withHeaders(['Content-Type'=>$mime,'Content-Disposition'=>'attachment; filename="review-evidence"','Cache-Control'=>'no-store, private','X-Content-Type-Options'=>'nosniff','Content-Security-Policy'=>"default-src 'none'; sandbox"]);
    }
    public function audit(Request $r)
    {
        $this->authorize($r,'audit.view');$v=$r->validate(['exhibition_id'=>'required|integer','page'=>'sometimes|integer|min:1|max:10000']);app(B2BAccess::class)->event($v['exhibition_id'],$r->user());
        $participants=app(B2BAccess::class)->participants($r->user())->where('exhibition_id',$v['exhibition_id'])->select('id');$memberships=DB::table('portal_memberships')->whereIn('participant_id',$participants)->select('id');$offset=(($v['page']??1)-1)*25;
        return response()->json(['items'=>DB::table('portal_activity')->where('exhibition_id',$v['exhibition_id'])->whereIn('membership_id',$memberships)->orderByDesc('id')->offset($offset)->limit(25)->get(['id','membership_id','identity_id','operation','command_id','created_at']),
            'receipts'=>DB::table('portal_commands')->whereIn('membership_id',$memberships)->orderByDesc('created_at')->offset($offset)->limit(25)->get(['id','operation','created_at'])])->header('Cache-Control','no-store');
    }
}
