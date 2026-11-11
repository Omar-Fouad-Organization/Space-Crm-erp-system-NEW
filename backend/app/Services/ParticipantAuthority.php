<?php
namespace App\Services;
use Illuminate\Support\Facades\{DB,Validator};
use Illuminate\Support\Str;

/** External actors are never synthesized as employee accounts. */
class ParticipantAuthority
{
    public const ROLES=[
        'owner'=>['view','profile.submit','evidence.read','meetings.respond','requests.submit','team.request','team.manage','consent.withdraw'],
        'editor'=>['view','profile.submit','evidence.read'],
        'coordinator'=>['view','meetings.respond','requests.submit'],
        'reader'=>['view'],
    ];

    public function binding(array $v,string $capability,bool $lock=false): array
    {
        $identity=DB::table('portal_identity_controls')->where('identity_id',$v['identity_id']);if($lock)$identity->lockForUpdate();$control=$identity->first();abort_unless($control && !$control->disabled_at,403,'Participant account access is revoked.');
        $q=DB::table('portal_memberships')->where('id',$v['membership_id'])->where('identity_id',$v['identity_id'])->where('exhibition_id',$v['exhibition_id']);
        $m=$q->first(); abort_unless($m && $m->status==='active' && !$m->revoked_at,403,'Membership is unavailable.');
        abort_unless(in_array($capability,json_decode($m->capabilities,true),true),403);
        $q=DB::table('b2b_participants')->where('id',$m->participant_id)->where('exhibition_id',$m->exhibition_id);
        if($lock) $q->lockForUpdate();
        $p=$q->first(); abort_unless($p && app(B2BAccess::class)->eligible($p,false,$lock),403,'Participation is no longer eligible.');
        if($lock){$m=DB::table('portal_memberships')->where('id',$m->id)->where('identity_id',$v['identity_id'])->where('exhibition_id',$v['exhibition_id'])->lockForUpdate()->first();abort_unless($m && $m->status==='active' && !$m->revoked_at && in_array($capability,json_decode($m->capabilities,true),true),403,'Membership changed.');}
        return [$m,$p];
    }

    public function contexts(string $identity): array
    {
        abort_unless(DB::table('portal_identity_controls')->where('identity_id',$identity)->whereNull('disabled_at')->exists(),403,'Participant account access is revoked.');
        $memberships=DB::table('portal_memberships')->where('identity_id',$identity)->where('status','active')->whereNull('revoked_at')->limit(101)->get();abort_if($memberships->count()>100,422,'Ask the organizer to narrow this identity’s active exhibition memberships.');
        $participants=DB::table('b2b_participants')->whereIn('id',$memberships->pluck('participant_id'))->get()->keyBy('id');$eligible=app(B2BAccess::class)->eligibleMany($participants,false);
        $events=DB::table('exhibitions')->whereIn('id',$memberships->pluck('exhibition_id'))->pluck('name','id');
        return $memberships->filter(fn($m)=>isset($participants[$m->participant_id]) && $participants[$m->participant_id]->exhibition_id==$m->exhibition_id && ($eligible[$m->participant_id]??false))->map(function($m)use($participants,$events){$p=$participants[$m->participant_id];$profile=B2BProfiles::open($p->profile);return ['id'=>$m->id,'exhibition_id'=>$m->exhibition_id,'exhibition_name'=>$events[$m->exhibition_id]??null,'participant_id'=>$m->participant_id,'kind'=>$p->kind,'readiness_available'=>$p->kind==='exhibitor' && (bool)config('b2b.readiness_enabled'),'name_en'=>$profile['name_en'],'name_ar'=>$profile['name_ar'],'role'=>$m->role,'capabilities'=>json_decode($m->capabilities,true)];})->values()->all();
    }

    public function execute(array $input): array
    {
        abort_if(array_diff(array_keys($input),['identity_id','membership_id','exhibition_id','operation','command_id','payload','page','authentication']),422,'Unsupported participant command fields.');
        $v=Validator::make($input,[
            'identity_id'=>'required|uuid','membership_id'=>'required|uuid','exhibition_id'=>'required|integer|min:1',
            'operation'=>'required|in:overview,profile,amendment,categories,matches,meetings,discover,team,activity,requests,readiness,readiness.submit,media.authorize,profile.submit,invitation.respond,request.submit,team.revoke,participation.withdraw,membership.leave',
            'command_id'=>'nullable|uuid','payload'=>'present|array','page'=>'sometimes|integer|min:1|max:10000',
            'authentication'=>'sometimes|array:device_id,auth_version','authentication.device_id'=>'required_with:authentication|uuid','authentication.auth_version'=>'required_with:authentication|integer|min:1',
        ])->validate();
        $cap=match($v['operation']){'profile.submit','readiness.submit'=>'profile.submit','invitation.respond'=>'meetings.respond','request.submit'=>'requests.submit','team.revoke'=>'team.manage','participation.withdraw'=>'consent.withdraw',default=>'view'};
        return DB::transaction(function()use($v,$cap){
            $write=in_array($v['operation'],['readiness.submit','profile.submit','invitation.respond','request.submit','team.revoke','participation.withdraw','membership.leave'],true);
            $fields=['readiness.submit'=>['requirement_id','requirement_version','version','response'],'profile.submit'=>['profile','profile_version','intent','draft_id','draft_version'],'invitation.respond'=>['match_id','version','action'],'request.submit'=>['kind','target_id','note','email','role'],'team.revoke'=>['membership_id'],'participation.withdraw'=>['reason'],'membership.leave'=>[]];
            if($write)abort_if(array_diff(array_keys($v['payload']),$fields[$v['operation']]),422,'Unsupported participant action fields.');
            abort_if($write && empty($v['authentication']),422,'Authenticated participant session attestation is required.');
            if($write){$control=DB::table('portal_identity_controls')->where('identity_id',$v['identity_id'])->lockForUpdate()->first();abort_unless($control && !$control->disabled_at,403,'Participant account access is revoked.');}
            if($v['operation']==='invitation.respond'){
                [, $actor]=$this->binding($v,$cap,false);$input=Validator::make($v['payload'],['match_id'=>'required|integer'])->validate();
                $match=DB::table('b2b_matches')->where('id',$input['match_id'])->where('exhibition_id',$actor->exhibition_id)->where($actor->kind==='buyer'?'buyer_id':'exhibitor_id',$actor->id)->lockForUpdate()->first();abort_unless($match,404);
                // Same canonical match -> ordered participants lock sequence as the staff workflow.
                DB::table('b2b_participants')->whereIn('id',[$match->buyer_id,$match->exhibitor_id])->orderBy('id')->lockForUpdate()->get();
            }
            [$m,$p]=$this->binding($v,$cap,$write);
            $hash=hash('sha256',json_encode([$v['operation'],$v['payload']],JSON_THROW_ON_ERROR));
            if($write){
                abort_unless(!empty($v['command_id']),422,'An idempotency reference is required.');
                $prior=DB::table('portal_commands')->where('id',$v['command_id'])->lockForUpdate()->first();
                if($prior){abort_unless($prior->membership_id===$m->id && hash_equals($prior->body_hash,$hash),409,'Command reference already used.');return B2BProfiles::open($prior->result);}
            }
            $result = match ($v['operation']) {
                'readiness' => ['readiness' => app(ExhibitorReadiness::class)->portal($p, $m, null, (int) ($v['page'] ?? 1))],
                'readiness.submit' => app(ExhibitorReadiness::class)->portal($p, $m, $v['payload']),
                default => $write ? $this->mutate($v, $m, $p) : $this->read($v, $m, $p),
            };
            if($write){
                DB::table('portal_commands')->insert(['id'=>$v['command_id'],'membership_id'=>$m->id,'operation'=>$v['operation'],'body_hash'=>$hash,'result'=>B2BProfiles::seal($result),'created_at'=>now()]);
                DB::table('portal_activity')->insert(['membership_id'=>$m->id,'identity_id'=>$m->identity_id,'exhibition_id'=>$m->exhibition_id,'operation'=>$v['operation'],'command_id'=>$v['command_id'],'details'=>B2BProfiles::seal(['result'=>$result,'request'=>$v['operation']==='profile.submit'?['amendment_id'=>$result['id'],'profile_version'=>$v['payload']['profile_version']]:$v['payload'],'participant_id'=>$p->id,'party'=>$p->kind,'membership_role'=>$m->role,'organization'=>['type'=>$p->kind==='buyer'?'buyer_organization':'client','id'=>$p->kind==='buyer'?$p->buyer_organization_id:$p->client_id],'authentication'=>$v['authentication']]),'created_at'=>now()]);
            }
            return $result;
        },3);
    }

    private function publicProfile(object $p): array
    {
        $profile=B2BProfiles::open($p->profile);
        $public=array_intersect_key($profile,array_flip(['name_en','name_ar','description_en','description_ar','industry','categories','products','origin','country','city','website','supported_markets','business_languages','logo_media_id','public_email','public_phone','public_contact_consent','business_capabilities','export_interests']));
        foreach(['description_en','description_ar'] as $field)if(isset($public[$field]))$public[$field]=mb_substr($public[$field],0,500);
        $public['products']=array_map(function($product){$product=array_intersect_key($product,array_flip(['name_en','name_ar','description_en','description_ar','media_id','origin','packaging','specifications']));foreach($product as $key=>$value)if(is_string($value))$product[$key]=mb_substr($value,0,200);return $product;},array_slice(array_values(array_filter($public['products']??[],fn($product)=>($product['visibility']??'published')==='published')),0,5));
        if(empty($profile['public_contact_consent']))unset($public['public_email'],$public['public_phone']);
        // Keep every 25-row public projection inside the gateway response budget.
        foreach($public as $key=>$value)if(is_string($value))$public[$key]=mb_substr($value,0,500);
        foreach(['supported_markets','business_languages']as $key)if(isset($public[$key]))$public[$key]=array_slice($public[$key],0,5);
        while(strlen(json_encode($public,JSON_THROW_ON_ERROR))>8192 && $public['products'])array_pop($public['products']);
        if(strlen(json_encode($public,JSON_THROW_ON_ERROR))>8192){foreach($public as $key=>$value)if(is_string($value))$public[$key]=mb_strcut($value,0,128,'UTF-8');foreach(['supported_markets','business_languages']as $key)if(isset($public[$key]))$public[$key]=array_slice($public[$key],0,2);}
        return $public;
    }

    private function read(array $v,object $m,object $p): array
    {
        abort_if(!in_array($v['operation'],['discover','media.authorize','amendment'],true) && $v['payload']!==[],422,'This read does not accept record override fields.');
        $page=$v['page']??1; $offset=($page-1)*25;
        $meta=['authoritative_at'=>now()->toIso8601String(),'page'=>$page,'per_page'=>25,'timezone'=>DB::table('b2b_programs')->where('exhibition_id',$p->exhibition_id)->value('timezone')];
        if($v['operation']==='overview'){
            $booth=null;if($p->kind==='exhibitor')$booth=DB::table('booths')->where('id',DB::table('deals')->where('id',$p->deal_id)->value('booth_id'))->where('exhibition_id',$p->exhibition_id)->first(['id','name','zone','hall','size_sqm']);
            $ownMatches=DB::table('b2b_matches')->where('exhibition_id',$p->exhibition_id)->where($p->kind==='buyer'?'buyer_id':'exhibitor_id',$p->id)->whereIn('status',['invitation_pending','mutually_accepted','declined','expired']);
            $profile=B2BProfiles::open($p->profile);$checks=['bilingual_names'=>!empty($profile['name_en'])&&!empty($profile['name_ar']),'categories'=>!empty($profile['categories']),'products'=>!empty($profile[$p->kind==='buyer'?'required_products':'products']),'meeting_interests'=>!empty($profile['meeting_interests'])];
            return $meta+['participant'=>['id'=>$p->id,'kind'=>$p->kind,'status'=>$p->status,'qualification'=>$p->qualification,'profile_version'=>$p->profile_version,'curated_eligible'=>app(B2BAccess::class)->eligible($p,true),'hosted'=>app(B2BOperations::class)->publicHosted($p),'concierge'=>DB::table('b2b_concierge')->where('participant_id',$p->id)->where('active',true)->exists()],
                'counts'=>['published_introductions'=>(clone $ownMatches)->count(),'pending_responses'=>DB::table('b2b_invitations')->whereIn('match_id',(clone $ownMatches)->select('id'))->where('party',$p->kind)->where('status','pending')->where('expires_at','>',now())->count(),'upcoming_bookings'=>DB::table('b2b_meetings')->whereIn('match_id',(clone $ownMatches)->select('id'))->whereIn('status',['scheduled','confirmed'])->where('starts_at','>',now())->count(),'pending_amendments'=>DB::table('portal_amendments')->where('participant_id',$p->id)->where('status','submitted')->count()],
                'profile_checklist'=>$checks,'exhibition'=>DB::table('exhibitions')->where('id',$p->exhibition_id)->first(['id','name']),'booth'=>$booth,'profile'=>$this->publicProfile($p),'capabilities'=>json_decode($m->capabilities,true)];
        }
        if($v['operation']==='media.authorize'){
            $a=Validator::make($v['payload'],['id'=>'required|uuid','participant_id'=>'required|integer','owner_membership_id'=>'required|uuid'])->validate();
            abort_unless(DB::table('portal_memberships')->where('id',$a['owner_membership_id'])->where('participant_id',$a['participant_id'])->where('exhibition_id',$p->exhibition_id)->exists(),404);
            $row=DB::table('b2b_participants as p')->join('portal_publications as pub','pub.participant_id','=','p.id')->where('p.id',$a['participant_id'])->where('p.exhibition_id',$p->exhibition_id)->where('p.kind','exhibitor')->where('pub.published',true)->whereColumn('pub.profile_version','p.profile_version')->select('p.*')->first();
            if($row && app(B2BAccess::class)->eligible($row,false)){$profile=B2BProfiles::open($row->profile);$ids=[...array_column(array_filter($profile['products']??[],fn($product)=>($product['visibility']??'published')==='published'),'media_id'),$profile['logo_media_id']??null];if(in_array($a['id'],$ids,true))return ['allowed'=>true];}
            abort(404);
        }
        if($v['operation']==='profile'){
            $profile=B2BProfiles::open($p->profile);
            unset($profile['catalogue_evidence'],$profile['origin_evidence'],$profile['capacity_evidence']);
            $profile['certifications']=array_map(fn($c)=>array_intersect_key($c,array_flip(['name','verified','media_id'])),$profile['certifications']??[]);
            $amendments=DB::table('portal_amendments')->where('participant_id',$p->id)->orderByDesc('created_at')->offset($offset)->limit(25)->get(['id','status','profile_version','version','review_note','created_at','updated_at'])->map(function($a){$a->feedback=$a->review_note?mb_substr(B2BProfiles::open($a->review_note)['reason']??'',0,500):null;unset($a->review_note);return $a;});
            return $meta+['participant_id'=>$p->id,'capabilities'=>json_decode($m->capabilities,true),'profile'=>$profile,'version'=>$p->profile_version,'amendments'=>$amendments];
        }
        if($v['operation']==='amendment'){
            $a=Validator::make($v['payload'],['id'=>'required|uuid'])->validate();$draft=DB::table('portal_amendments')->where('id',$a['id'])->where('participant_id',$p->id)->first();abort_unless($draft,404);
            return $meta+['id'=>$draft->id,'status'=>$draft->status,'version'=>$draft->version,'profile_version'=>$draft->profile_version,'profile'=>B2BProfiles::open($draft->payload),'feedback'=>$draft->review_note?mb_substr(B2BProfiles::open($draft->review_note)['reason']??'',0,500):null];
        }
        if($v['operation']==='categories')return $meta+['items'=>DB::table('b2b_categories')->where('exhibition_id',$p->exhibition_id)->where('active',true)->offset($offset)->limit(25)->get(['id','name_en','name_ar'])];
        if($v['operation']==='team')return $meta+['items'=>DB::table('portal_memberships')->where('participant_id',$p->id)->where('exhibition_id',$p->exhibition_id)->offset($offset)->limit(25)->get(['id','identity_id','role','status','revoked_at'])];
        if($v['operation']==='requests')return $meta+['items'=>DB::table('portal_requests')->where('membership_id',$m->id)->orderByDesc('created_at')->offset($offset)->limit(25)->get(['id','kind','target_id','status','version','created_at'])];
        if($v['operation']==='activity'){
            $events=DB::table('portal_activity')->where('membership_id',$m->id)->selectRaw("CONCAT('activity:',id) AS id, operation, created_at");
            $invites=DB::table('b2b_invitations as i')->join('b2b_matches as m','m.id','=','i.match_id')->where('m.exhibition_id',$p->exhibition_id)->where($p->kind==='buyer'?'m.buyer_id':'m.exhibitor_id',$p->id)->where('i.party',$p->kind)->whereIn('m.status',['invitation_pending','mutually_accepted','declined','expired'])->selectRaw("CONCAT('invitation:',i.id,':',i.status) AS id, CONCAT('invitation.',i.status) AS operation, i.updated_at AS created_at");
            $amendments=DB::table('portal_amendments')->where('participant_id',$p->id)->selectRaw("CONCAT('amendment:',id,':',status) AS id, CONCAT('profile.',status) AS operation, updated_at AS created_at");
            $matches=DB::table('b2b_matches')->where('exhibition_id',$p->exhibition_id)->where($p->kind==='buyer'?'buyer_id':'exhibitor_id',$p->id)->whereIn('status',['invitation_pending','mutually_accepted','declined','expired']);
            $introductions=(clone $matches)->selectRaw("CONCAT('introduction:',id,':',version) AS id, CONCAT('match.',status) AS operation, updated_at AS created_at");
            $meetings=DB::table('b2b_meetings')->whereIn('match_id',(clone $matches)->select('id'))->selectRaw("CONCAT('meeting:',id,':',version) AS id, CONCAT('meeting.',status) AS operation, updated_at AS created_at");
            $requests=DB::table('portal_requests')->where('membership_id',$m->id)->selectRaw("CONCAT('request:',id,':',version) AS id, CONCAT('request.',status) AS operation, updated_at AS created_at");
            $feed=$events->unionAll($invites)->unionAll($amendments)->unionAll($introductions)->unionAll($meetings)->unionAll($requests);
            return $meta+['items'=>DB::query()->fromSub($feed,'portal_events')->orderByDesc('created_at')->orderBy('id')->offset($offset)->limit(25)->get()];
        }
        if($v['operation']==='discover'){
            $filters=Validator::make($v['payload'],['search'=>'nullable|string|max:100','country'=>'nullable|string|max:100','sector'=>'nullable|string|max:150','category'=>'nullable|integer|min:1'])->validate();
            $query=DB::table('b2b_participants as p')->join('portal_publications as pub','pub.participant_id','=','p.id')->where('p.exhibition_id',$p->exhibition_id)->where('p.kind','exhibitor')->where('pub.published',true)->whereColumn('pub.profile_version','p.profile_version');
            foreach(['country','sector']as $filter)if(!empty($filters[$filter]))$query->where('pub.'.$filter,$filters[$filter]);
            if(!empty($filters['search']))$query->where('pub.search_text','like','%'.addcslashes($filters['search'],'%_\\').'%');
            if(!empty($filters['category']))$query->whereJsonContains('pub.categories',(int)$filters['category']);
            $rows=$query->orderBy('p.id')->offset($offset)->limit(25)->select('p.*')->get();
            $eligible=app(B2BAccess::class)->eligibleMany($rows,false);return $meta+['items'=>$rows->filter(fn($r)=>$eligible[$r->id]??false)->map(fn($r)=>['id'=>$r->id,'profile'=>$this->publicProfile($r)])->values()];
        }
        $matches=DB::table('b2b_matches')->where('exhibition_id',$p->exhibition_id)->where($p->kind==='buyer'?'buyer_id':'exhibitor_id',$p->id)->whereIn('status',['invitation_pending','mutually_accepted','declined','expired']);
        if($v['operation']==='meetings'){
            $rows=DB::table('b2b_meetings')->whereIn('match_id',$matches->select('id'))->orderBy('starts_at')->offset($offset)->limit(25)->get(['id','match_id','starts_at','ends_at','location_id','status','version','buyer_representative_id','exhibitor_representative_id',...(config('b2b.onsite_enabled')?['booking_revision','started_at','completed_at','outcome_code','outcome_published']:[])]);
            $introductions=DB::table('b2b_matches')->whereIn('id',$rows->pluck('match_id'))->get()->keyBy('id');
            $participants=DB::table('b2b_participants')->whereIn('id',$introductions->pluck('buyer_id')->merge($introductions->pluck('exhibitor_id'))->unique())->get()->keyBy('id');$eligible=app(B2BAccess::class)->eligibleMany($participants,true);
            $reps=DB::table('b2b_representatives')->whereIn('id',$rows->pluck('buyer_representative_id')->merge($rows->pluck('exhibitor_representative_id'))->unique())->get()->keyBy('id');
            $people=DB::table('b2b_people')->whereIn('id',$reps->pluck('person_id'))->get()->keyBy('id');$names=[];foreach($people as $person)$names[$person->id]=B2BProfiles::open($person->name)['name']??'';
            $businessNames=[];foreach($participants as $part){$profile=B2BProfiles::open($part->profile);$businessNames[$part->id]=['en'=>$profile['name_en'],'ar'=>$profile['name_ar']];}
            $locations=DB::table('b2b_locations')->where('exhibition_id',$p->exhibition_id)->whereIn('id',$rows->pluck('location_id'))->pluck('name','id');
            return $meta+['items'=>$rows->map(function($meeting)use($p,$introductions,$participants,$eligible,$reps,$names,$businessNames,$locations){
                $intro=$introductions->get($meeting->match_id);$hold=!$intro||$intro->rule_version!==B2BMatching::VERSION;
                if($intro){foreach([$intro->buyer_id,$intro->exhibitor_id]as $id){$part=$participants->get($id);$hold=$hold||!$part||!($eligible[$id]??false)||$part->profile_version!=($part->kind==='buyer'?$intro->buyer_version:$intro->exhibitor_version);}}
                return [...app(B2BOperations::class)->publicMeeting($meeting,$p->id),'id'=>$meeting->id,'match_id'=>$meeting->match_id,'starts_at'=>$meeting->starts_at,'ends_at'=>$meeting->ends_at,'location_id'=>$meeting->location_id,'location'=>$locations[$meeting->location_id]??null,'status'=>$meeting->status,'version'=>$meeting->version,'review_hold'=>!in_array($meeting->status,['completed','cancelled','no_show'],true)&&$hold,'buyer'=>$intro?$businessNames[$intro->buyer_id]??null:null,'exhibitor'=>$intro?$businessNames[$intro->exhibitor_id]??null:null,'buyer_representative'=>$names[$reps[$meeting->buyer_representative_id]->person_id??0]??null,'exhibitor_representative'=>$names[$reps[$meeting->exhibitor_representative_id]->person_id??0]??null];
            })];
        }
        abort_unless(app(B2BAccess::class)->eligible($p,true),403,'Curated networking is not currently available.');
        $rows=$matches->orderBy('id')->offset($offset)->limit(25)->get();$invitations=DB::table('b2b_invitations')->whereIn('match_id',$rows->pluck('id'))->where('party',$p->kind)->get()->keyBy('match_id');
        $participants=DB::table('b2b_participants')->whereIn('id',$rows->pluck('buyer_id')->merge($rows->pluck('exhibitor_id'))->unique())->get()->keyBy('id');$eligible=app(B2BAccess::class)->eligibleMany($participants,true);
        return $meta+['items'=>$rows->map(function($r)use($p,$invitations,$participants,$eligible){
            $e=json_decode($r->explanation,true); $i=$invitations->get($r->id);
            $pair=$participants->only([$r->buyer_id,$r->exhibitor_id]);
            $hold=$r->rule_version!==B2BMatching::VERSION || $pair->count()!==2;
            foreach($pair as $part)$hold=$hold || !($eligible[$part->id]??false) || $part->profile_version!=($part->kind==='buyer'?$r->buyer_version:$r->exhibitor_version);
            $other=$pair->get($p->kind==='buyer'?$r->exhibitor_id:$r->buyer_id);$otherProfile=$other?$this->publicProfile($other):[];
            if($p->kind==='exhibitor')$otherProfile=array_intersect_key($otherProfile,array_flip(['name_en','name_ar','industry']));
            return ['id'=>$r->id,'version'=>$r->version,'status'=>$r->status,'profile'=>$otherProfile,'review_hold'=>$hold,'rule_version'=>$r->rule_version,'compatibility_score'=>$r->score,'evidence_coverage'=>$e['evidence_coverage']??null,'recommendation'=>$e['recommendation']??'requires_human_review','factors'=>collect($e['factors']??[])->map(fn($f)=>array_intersect_key($f,array_flip(['state','points'])))->all(),'invitation'=>$i?['status'=>$i->status,'expires_at'=>$i->expires_at]:null];
        })];
    }

    private function mutate(array $v,object $m,object $p): array
    {
        if($v['operation']==='membership.leave'){
            DB::table('portal_memberships')->where('id',$m->id)->update(['status'=>'revoked','revoked_at'=>now(),'updated_at'=>now()]);return ['id'=>$m->id,'status'=>'revoked'];
        }
        if($v['operation']==='participation.withdraw'){
            $reason=Validator::make($v['payload'],['reason'=>'required|string|max:2000'])->validate();
            DB::table('b2b_participants')->where('id',$p->id)->update(['status'=>'withdrawn','version'=>$p->version+1,'updated_at'=>now()]);
            return ['id'=>$p->id,'status'=>'withdrawn','reason'=>$reason['reason'],'existing_bookings'=>'organizer_review_required'];
        }
        if($v['operation']==='team.revoke'){
            $a=Validator::make($v['payload'],['membership_id'=>'required|uuid'])->validate();$q=DB::table('portal_memberships')->where('id',$a['membership_id'])->where('participant_id',$p->id)->where('exhibition_id',$p->exhibition_id);abort_unless($q->lockForUpdate()->first(),404);$q->update(['revoked_at'=>now(),'status'=>'revoked','updated_at'=>now()]);return ['id'=>$a['membership_id'],'status'=>'revoked'];
        }
        if($v['operation']==='profile.submit'){
            $a=Validator::make($v['payload'],['profile'=>'required|array','profile_version'=>'required|integer','intent'=>'sometimes|in:draft,submit','draft_id'=>'nullable|uuid','draft_version'=>'required_with:draft_id|integer|min:1'])->validate();
            abort_unless($a['profile_version']==$p->profile_version,409,'Approved profile changed.');
            $profile=$a['profile'];
            $allowed=['name_en','name_ar','description_en','description_ar','industry','classification','categories','products','required_products','preferred_origins','origin','quantity','capacity','unit','capacity_verified','required_certifications','certifications','meeting_interests','procurement_criteria','requirement_states','country','city','website','logo_media_id','supported_markets','business_languages','public_email','public_phone','public_contact_consent','business_capabilities','export_interests'];
            abort_if(array_diff(array_keys($profile),$allowed),422,'Profile contains fields reserved for the organizer.');
            abort_if(!empty($profile['capacity_verified']) || !empty($profile['catalogue_evidence']) || !empty($profile['origin_evidence']) || !empty($profile['capacity_evidence']),422,'Participants cannot verify their own claims.');
            foreach($profile['certifications']??[] as $cert)abort_if(!empty($cert['verified']) || !empty($cert['evidence']),422,'Certification requires organizer review.');
            $profile=app(B2BProfiles::class)->profile($profile,$p->exhibition_id);$hash=hash('sha256',json_encode($profile,JSON_THROW_ON_ERROR));$status=($a['intent']??'submit')==='draft'?'draft':'submitted';$draft=null;
            if(!empty($a['draft_id'])){$draft=DB::table('portal_amendments')->where('id',$a['draft_id'])->where('participant_id',$p->id)->lockForUpdate()->first();abort_unless($draft && $draft->status==='draft' && $draft->profile_version==$p->profile_version && $draft->version==$a['draft_version'],409,'Draft changed or was already submitted.');}
            $same=DB::table('portal_amendments')->where('participant_id',$p->id)->where('profile_version',$p->profile_version)->where('payload_hash',$hash)->lockForUpdate()->first();
            if($same && (!$draft || $same->id!==$draft->id)){
                if($same->status==='draft' && $status==='submitted'){DB::table('portal_amendments')->where('id',$same->id)->update(['status'=>'submitted','version'=>$same->version+1,'updated_at'=>now()]);return ['id'=>$same->id,'status'=>'submitted','version'=>$same->version+1];}
                return ['id'=>$same->id,'status'=>$same->status,'version'=>$same->version];
            }
            if($draft && $draft->payload_hash===$hash && $draft->status===$status)return ['id'=>$draft->id,'status'=>$status,'version'=>$draft->version];
            if($draft){DB::table('portal_amendments')->where('id',$draft->id)->update(['payload'=>B2BProfiles::seal($profile),'payload_hash'=>$hash,'status'=>$status,'version'=>$draft->version+1,'updated_at'=>now()]);return ['id'=>$draft->id,'status'=>$status,'version'=>$draft->version+1];}
            abort_if(DB::table('portal_amendments')->where('participant_id',$p->id)->where('created_at','>',now()->subHour())->count()>=20,429,'Profile proposal limit reached; revise an existing draft.');
            $id=(string)Str::uuid();DB::table('portal_amendments')->insert(['id'=>$id,'membership_id'=>$m->id,'participant_id'=>$p->id,'profile_version'=>$p->profile_version,'payload_hash'=>$hash,'payload'=>B2BProfiles::seal($profile),'status'=>$status,'created_at'=>now(),'updated_at'=>now()]);
            return ['id'=>$id,'status'=>$status,'version'=>1];
        }
        if($v['operation']==='request.submit'){
            $a=Validator::make($v['payload'],['kind'=>'required|in:introduction,reschedule,cancellation,acknowledge,team_invite','target_id'=>'required|integer','note'=>'required|string|max:2000','email'=>'required_if:kind,team_invite|email|max:255','role'=>'required_if:kind,team_invite|in:owner,editor,coordinator,reader'])->validate();
            $orgRequests=DB::table('portal_requests')->whereIn('membership_id',DB::table('portal_memberships')->where('participant_id',$p->id)->where('exhibition_id',$p->exhibition_id)->select('id'));
            abort_if((clone $orgRequests)->where('created_at','>',now()->subHour())->count()>=10,429,'Organization request limit reached; contact the organizer.');
            if(in_array($a['kind'],['introduction','reschedule','cancellation'],true))abort_if((clone $orgRequests)->where('kind',$a['kind'])->where('target_id',$a['target_id'])->whereIn('status',['submitted','acknowledged'])->exists(),409,'An organizer request is already outstanding.');
            if($a['kind']==='team_invite'){abort_unless(in_array('team.request',json_decode($m->capabilities,true),true) && $a['target_id']==$p->id,403);}
            elseif($a['kind']==='introduction'){
                $target=DB::table('b2b_participants')->where('id',$a['target_id'])->where('exhibition_id',$p->exhibition_id)->where('kind','exhibitor')->first();
                abort_unless($target && app(B2BAccess::class)->eligible($target,false) && DB::table('portal_publications')->where('participant_id',$target->id)->where('profile_version',$target->profile_version)->where('published',true)->exists(),404);
            }else{
                abort_unless(DB::table('b2b_meetings as meeting')->join('b2b_matches as match','match.id','=','meeting.match_id')->where('meeting.id',$a['target_id'])->where('meeting.exhibition_id',$p->exhibition_id)->where($p->kind==='buyer'?'match.buyer_id':'match.exhibitor_id',$p->id)->exists(),404);
            }
            $id=(string)Str::uuid();DB::table('portal_requests')->insert(['id'=>$id,'membership_id'=>$m->id,'exhibition_id'=>$p->exhibition_id,'kind'=>$a['kind'],'target_id'=>$a['target_id'],'payload'=>B2BProfiles::seal($a),'created_at'=>now(),'updated_at'=>now()]);return ['id'=>$id,'status'=>'submitted'];
        }
        $a=Validator::make($v['payload'],['match_id'=>'required|integer','version'=>'required|integer','action'=>'required|in:accept,decline'])->validate();
        $match=DB::table('b2b_matches')->where('id',$a['match_id'])->where('exhibition_id',$p->exhibition_id)->where($p->kind==='buyer'?'buyer_id':'exhibitor_id',$p->id)->lockForUpdate()->first();
        abort_unless($match,404);abort_unless($match->version==$a['version'],409,'Introduction changed.');
        abort_unless(in_array($match->status,['invitation_pending','mutually_accepted'],true),409,'Introduction is not open.');
        // Do not impersonate staff or reuse employee-authorized transition methods.
        $ids=[$match->buyer_id,$match->exhibitor_id];sort($ids);$pair=[];
        foreach($ids as $id){$row=DB::table('b2b_participants')->where('id',$id)->lockForUpdate()->first();abort_unless($row && app(B2BAccess::class)->eligible($row,true,true),403);$pair[$id]=$row;}
        abort_unless($match->rule_version===B2BMatching::VERSION && $match->buyer_version==$pair[$match->buyer_id]->profile_version && $match->exhibitor_version==$pair[$match->exhibitor_id]->profile_version,409,'Introduction requires organizer review.');
        $e=app(B2BMatching::class)->compare(B2BProfiles::open($pair[$match->buyer_id]->profile),B2BProfiles::open($pair[$match->exhibitor_id]->profile));
        abort_unless($e['baseline_met'] && !$e['blockers'],422,'Requirements need organizer review.');
        $inv=DB::table('b2b_invitations')->where('match_id',$match->id)->where('party',$p->kind)->lockForUpdate()->first();
        abort_unless($inv && $inv->status==='pending' && \Carbon\CarbonImmutable::parse($inv->expires_at)->isFuture(),409,'Invitation expired or already decided.');
        // Withdrawal of an accepted/scheduled meeting is a reviewed cancellation request, never a slot rewrite.
        DB::table('b2b_invitations')->where('id',$inv->id)->update(['status'=>$a['action']==='accept'?'accepted':'declined','channel'=>'authenticated_portal','recorded_by'=>null,'evidence'=>B2BProfiles::seal(['identity_id'=>$m->identity_id,'membership_id'=>$m->id,'participant_id'=>$p->id,'exhibition_id'=>$p->exhibition_id,'command_id'=>$v['command_id'],'invitation_id'=>$inv->id,'match_id'=>$match->id,'party'=>$p->kind,'membership_role'=>$m->role,'organization'=>['type'=>$p->kind==='buyer'?'buyer_organization':'client','id'=>$p->kind==='buyer'?$p->buyer_organization_id:$p->client_id],'action'=>$a['action'],'invitation_version'=>$match->version,'authentication'=>$v['authentication'],'at'=>now()->toIso8601String()]),'updated_at'=>now()]);
        $status=$a['action']==='decline'?'declined':(DB::table('b2b_invitations')->where('match_id',$match->id)->where('status','accepted')->count()===2?'mutually_accepted':'invitation_pending');
        DB::table('b2b_matches')->where('id',$match->id)->update(['status'=>$status,'version'=>$match->version+1,'updated_at'=>now()]);
        return ['id'=>$match->id,'status'=>$status,'version'=>$match->version+1];
    }
}
