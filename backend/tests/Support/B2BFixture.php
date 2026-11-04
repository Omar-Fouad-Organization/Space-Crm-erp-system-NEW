<?php

namespace Tests\Support;

use App\Models\User;
use App\Services\{B2BProfiles,B2BWorkflow,CrmService};
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class B2BFixture
{
    /** Synthetic committed fixtures for independent connections; caller must enforce a disposable DB. */
    public static function create(): array
    {
        config(['authorization.enabled'=>true,'intake.enabled'=>true,'b2b.enabled'=>true]);
        $user=User::factory()->create(['role'=>'super_admin','status'=>'active']); $crm=app(CrmService::class);
        $event=$crm->save('exhibitions',['name'=>'SYNTHETIC B2B event','start_date'=>'2027-01-01','end_date'=>'2027-01-03','location'=>'Synthetic','currency'=>'EGP','status'=>'planning'],$user)['id'];
        DB::table('b2b_programs')->insert(['exhibition_id'=>$event,'timezone'=>'Africa/Cairo','dates_approved'=>true,'meeting_dates'=>'["2027-01-01"]','weights'=>'[35,20,15,10,10,10]','bands'=>'[80,65]','duration'=>30]);
        $category=DB::table('b2b_categories')->insertGetId(['exhibition_id'=>$event,'code'=>'organic','name_en'=>'Organic food','name_ar'=>'غذاء عضوي']);
        $profile=['name_en'=>'SYNTHETIC business','name_ar'=>'شركة اختبار','industry'=>'Food','classification'=>'Importer','categories'=>[$category],'products'=>[['name_en'=>'Herbs','name_ar'=>'أعشاب']],'required_products'=>['Herbs'],'preferred_origins'=>['Egypt'],'origin'=>'Egypt','capacity_verified'=>false,'required_certifications'=>[],'certifications'=>[],'meeting_interests'=>['wholesale']];
        $participants=[]; $people=[]; $representatives=[]; $locations=[]; $matches=[];
        for ($i=0;$i<2;$i++) {
            $client=$crm->save('clients',['name'=>'SYNTHETIC supplier '.$i,'contact_person'=>'Test','email'=>'supplier'.$i.'@example.test','type'=>'exhibitor','status'=>'active'],$user)['id'];
            $booth=$crm->save('booths',['name'=>'B2B-'.$i,'exhibition_id'=>$event,'size_sqm'=>'10','price'=>'1000','currency'=>'EGP'],$user)['id'];
            $deal=$crm->save('deals',['name'=>'SYNTHETIC confirmed booth '.$i,'client_id'=>$client,'exhibition_id'=>$event,'type'=>'booth','booth_id'=>$booth,'salesperson_id'=>$user->id,'amount'=>'1000','currency'=>'EGP','status'=>'closed_won','commission_percentage'=>'0'],$user)['id'];
            $exhibitor=app(B2BProfiles::class)->enroll(['exhibition_id'=>$event,'kind'=>'exhibitor','source_id'=>$deal,'consent_evidence'=>'Synthetic consent','commercial_evidence'=>'Synthetic reviewed contract','profile'=>[...$profile,'name_en'=>'SYNTHETIC exhibitor '.$i]],$user);
            $review=app(B2BProfiles::class)->review($exhibitor,['version'=>1,'scores'=>[35,20,15,10,10,10],'evidence'=>array_fill(0,6,'Synthetic verified criterion'),'reason'=>'Synthetic review'],$user);
            app(B2BProfiles::class)->decide($exhibitor,['version'=>2,'review_id'=>$review,'decision'=>'approved','reason'=>'Synthetic manager approval'],$user);
            $org=DB::table('buyer_organizations')->insertGetId(['name'=>'SYNTHETIC buyer '.$i,'country'=>'Japan','created_by'=>$user->id]);
            $source=DB::table('intake_submissions')->insertGetId(['source_id'=>Str::uuid(),'source_system'=>'test','site'=>'test','source_form'=>'buyer','type'=>'buyer','exhibition_id'=>$event,'historical'=>false,'original_payload'=>B2BProfiles::seal([]),'source_hash'=>str_repeat('a',64),'name'=>'SYNTHETIC buyer '.$i,'email'=>'buyer'.$i.'@example.test','country'=>'Japan','language'=>'en','interests'=>'[]','submitted_at'=>now(),'status'=>'verified','assigned_user_id'=>$user->id,'buyer_organization_id'=>$org,'created_at'=>now(),'updated_at'=>now()]);
            $buyer=app(B2BProfiles::class)->enroll(['exhibition_id'=>$event,'kind'=>'buyer','source_id'=>$source,'consent_evidence'=>'Synthetic buyer consent','profile'=>[...$profile,'name_en'=>'SYNTHETIC buyer '.$i]],$user);
            $participants[]=[$buyer,$exhibitor];
            foreach ([$buyer,$exhibitor] as $p) {
                $person=DB::table('b2b_people')->insertGetId(['name'=>B2BProfiles::seal(['name'=>'SYNTHETIC person '.$p]),'created_by'=>$user->id]); $people[$p]=$person;
                $representatives[$p]=DB::table('b2b_representatives')->insertGetId(['participant_id'=>$p,'person_id'=>$person,'evidence'=>B2BProfiles::seal(['reference'=>'Synthetic consent and authority'])]);
                DB::table('b2b_windows')->insert(['exhibition_id'=>$event,'person_id'=>$person,'available'=>true,'starts_at'=>'2027-01-01 08:00:00','ends_at'=>'2027-01-01 16:00:00']);
            }
            $locations[]=DB::table('b2b_locations')->insertGetId(['exhibition_id'=>$event,'name'=>'SYNTHETIC table '.$i]);
            DB::table('b2b_windows')->insert(['exhibition_id'=>$event,'location_id'=>$locations[$i],'available'=>true,'starts_at'=>'2027-01-01 08:00:00','ends_at'=>'2027-01-01 16:00:00']);
        }
        DB::table('b2b_windows')->insert(['exhibition_id'=>$event,'available'=>true,'starts_at'=>'2027-01-01 08:00:00','ends_at'=>'2027-01-01 16:00:00']);
        app(B2BWorkflow::class)->generate($event,$user);
        foreach ($participants as [$buyer,$exhibitor]) {
            $id=DB::table('b2b_matches')->where('buyer_id',$buyer)->where('exhibitor_id',$exhibitor)->value('id');
            foreach ([['review',1],['approve',2],['invite',3],['accept',4],['accept',5]] as [$action,$version]) {
                app(B2BWorkflow::class)->transition($id,['version'=>$version,'action'=>$action,'reason'=>'Synthetic verified coordination','expires_at'=>'2026-12-20T12:00:00+00:00','party'=>$version===4?'buyer':'exhibitor','channel'=>'phone','evidence'=>'Synthetic independent evidence'],$user);
            }
            $matches[]=$id;
        }
        return compact('user','event','profile','participants','people','representatives','locations','matches');
    }

    public static function booking(array $f,int $index): array
    {
        [$buyer,$exhibitor]=$f['participants'][$index];
        return ['match_id'=>$f['matches'][$index],'buyer_representative_id'=>$f['representatives'][$buyer],'exhibitor_representative_id'=>$f['representatives'][$exhibitor],'location_id'=>$f['locations'][$index],'starts_at'=>'2027-01-01T10:00:00+00:00','reason'=>'Synthetic scheduling'];
    }
}
