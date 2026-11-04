<?php

namespace App\Services;

class B2BMatching
{
    public const VERSION = '2';

    /** Missing answers remain unknown; explicit non-applicability removes weight, not uncertainty. */
    public function compare(array $buyer, array $exhibitor): array
    {
        foreach (['products'=>'required_products','origin'=>'preferred_origins','capacity'=>'quantity','documentation'=>'required_certifications'] as $key=>$field) {
            if (($buyer['requirement_states'][$key]??null)==='unknown') { $buyer[$field]=$key==='capacity'?null:[]; }
        }
        $factors=[]; $blockers=[]; $unknown=[]; $na=[];
        $add=function(string $key,int $weight,string $state,string $reason,bool $block=false) use (&$factors,&$blockers,&$unknown,&$na): void {
            $factors[$key]=['weight'=>$weight,'state'=>$state,'points'=>$state==='verified_match'?$weight:0,'reason'=>$reason,'blocking'=>$block];
            if ($block) { $blockers[]=$reason; }
            if ($state==='unknown') { $unknown[]=$reason; }
            if ($state==='not_applicable') { $na[]=$key; }
        };
        $common=array_intersect($buyer['categories']??[],$exhibitor['categories']??[]);
        $add('categories',35,$common?'verified_match':'verified_mismatch',$common?'Documented categories overlap.':'No compatible product category.',!$common);
        $states=$buyer['requirement_states']??[];
        $catalogue=!empty($exhibitor['products']) && !empty($exhibitor['catalogue_evidence']);
        $text=mb_strtolower(implode(' ',array_map(fn($p)=>implode(' ',array_intersect_key($p,array_flip(['name_en','name_ar','description_en','description_ar']))),$exhibitor['products']??[])));
        $terms=$buyer['required_products']??[];
        $missing=array_filter($terms,fn($term)=>!str_contains($text,mb_strtolower($term)));
        if ($terms) {
            $add('products',15,!$catalogue?'unknown':($missing?'verified_mismatch':'verified_match'),!$catalogue?'Product catalogue evidence is missing.':($missing?'Required product is absent from the reviewed catalogue.':'Required product terms occur in the reviewed bilingual catalogue.'),$catalogue && count($missing)>0);
        } else { $add('products',15,($states['products']??'unknown')==='not_applicable'?'not_applicable':'unknown','Buyer has not documented specific product requirements.'); }
        $origins=$buyer['preferred_origins']??[];
        if ($origins) {
            $verified=!empty($exhibitor['origin']) && !empty($exhibitor['origin_evidence']);
            $ok=in_array($exhibitor['origin']??null,$origins,true);
            $add('origin',15,!$verified?'unknown':($ok?'verified_match':'verified_mismatch'),!$verified?'Exhibitor origin evidence is missing.':($ok?'Reviewed origin satisfies the explicit restriction.':'Explicit origin restriction is not met.'),$verified && !$ok);
        } else { $add('origin',15,($states['origin']??'unknown')==='not_applicable'?'not_applicable':'unknown',($states['origin']??'unknown')==='not_applicable'?'Buyer explicitly accepts any origin.':'Buyer origin requirement is unanswered.'); }
        $quantity=$buyer['quantity']??null;
        if ($quantity!==null && $quantity>0) {
            $verified=!empty($exhibitor['capacity_verified']) && !empty($exhibitor['capacity_evidence']) && isset($exhibitor['capacity']) && !empty($exhibitor['unit']);
            $sameUnit=($exhibitor['unit']??null)===($buyer['unit']??null);
            $enough=$verified && $sameUnit && $exhibitor['capacity']>=$quantity;
            $add('capacity',15,!$verified||!$sameUnit?'unknown':($enough?'verified_match':'verified_mismatch'),!$verified?'Supply capacity is unverified.':(!$sameUnit?'Capacity units require human clarification.':($enough?'Verified capacity satisfies requested quantity.':'Verified capacity is insufficient.')),$verified && $sameUnit && !$enough);
        } else { $add('capacity',15,($states['capacity']??'unknown')==='not_applicable'?'not_applicable':'unknown',($states['capacity']??'unknown')==='not_applicable'?'Buyer explicitly has no quantity constraint.':'Buyer quantity requirement is unknown.'); }
        $required=$buyer['required_certifications']??[];
        $certs=array_column(array_filter($exhibitor['certifications']??[],fn($c)=>!empty($c['verified'])&&!empty($c['evidence'])),'name');
        $missingCerts=array_diff($required,$certs);
        if ($required) { $add('documentation',10,$missingCerts?'unknown':'verified_match',$missingCerts?'Mandatory certification is absent or unverified; clearance is required before outreach.':'All mandatory certifications have reviewed evidence.',count($missingCerts)>0); }
        else { $add('documentation',10,($states['documentation']??'unknown')==='not_applicable'?'not_applicable':'unknown',($states['documentation']??'unknown')==='not_applicable'?'Buyer explicitly requires no certification.':'Buyer documentation requirement is unanswered.'); }
        $interests=$buyer['meeting_interests']??[];
        $shared=array_intersect($interests,$exhibitor['meeting_interests']??[]);
        $add('preferences',10,!$interests||empty($exhibitor['meeting_interests'])?'unknown':($shared?'verified_match':'verified_mismatch'),$shared?'Documented meeting interests overlap.':'Meeting interests need clarification.');
        $excluded=array_sum(array_map(fn($f)=>$f['state']==='not_applicable'?$f['weight']:0,$factors));
        $earned=array_sum(array_column($factors,'points'));
        $resolved=array_sum(array_map(fn($f)=>$f['state']!=='unknown'?$f['weight']:0,$factors));
        $compatibility=(int)round(100*$earned/max(1,100-$excluded));
        // Coverage includes explicit answers, including NA, but NA never adds compatibility points.
        $coverage=$resolved;
        $baseline=$catalogue && !empty($terms) && !empty($interests) && $factors['products']['state']==='verified_match';
        $verifiedMismatch=count(array_filter($factors,fn($f)=>$f['state']==='verified_mismatch' && !empty($f['blocking'])))>0;
        $recommendation=$verifiedMismatch?'incompatible':(!$baseline?'requires_human_review':($unknown?'potential_match_needs_information':($compatibility>=80 && $coverage===100?'strong_match':'requires_human_review')));
        return ['rule_version'=>self::VERSION,'score'=>$compatibility,'compatibility_score'=>$compatibility,'evidence_coverage'=>$coverage,'earned_weight'=>$earned,'applicable_weight'=>100-$excluded,'recommendation'=>$recommendation,'baseline_met'=>$baseline,'factors'=>$factors,'blockers'=>$blockers,'unknown_information'=>$unknown,'not_applicable'=>$na,'required_actions'=>$recommendation==='strong_match'?['Staff review, approval and both parties acceptance are still required.']:['Clarify missing information or incompatibilities; update profiles and request a new review.']];
    }
}
