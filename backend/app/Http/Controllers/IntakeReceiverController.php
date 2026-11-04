<?php
namespace App\Http\Controllers;

use App\Services\IntakePayload;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\{Crypt,DB,Validator};

class IntakeReceiverController extends Controller
{
    public function accept(Request $request): array
    {
        $v=$request->validate(['message_id'=>'required|uuid','source_id'=>'required|uuid','source_system'=>'required|in:green-life-website',
            'site'=>'required|string','exhibition_id'=>'required|integer','source_form'=>'required|in:contact,buyer,visitor,legacy_contact_submissions,legacy_visitor_registrations',
            'type'=>'required|in:'.implode(',',IntakePayload::TYPES),'event'=>'required|in:submitted,withdrawn','historical'=>'required|boolean',
            'submitted_at'=>'required|date_format:Y-m-d\TH:i:s\Z','payload'=>'required|array','source_hash'=>'required|size:64']);
        abort_unless($v['site']===config('intake.site') && $v['exhibition_id']===config('intake.exhibition_id'),422);
        abort_unless(DB::table('exhibitions')->where('id',$v['exhibition_id'])->exists(),422);
        $payload=IntakePayload::validate($v['payload'],$v['type'],$v['historical']);
        abort_unless(hash_equals(IntakePayload::hash($v['payload']),$v['source_hash']),422);
        abort_unless($v['historical']===str_starts_with($v['source_form'],'legacy_'),422);
        abort_if($v['historical'] && in_array($v['type'],['buyer','visitor'],true),422,'Historic interest is not a completed registration.');
        $expectedForm=match($v['type']) {'buyer'=>'buyer','visitor'=>'visitor',default=>'contact'};
        abort_unless($v['historical'] || $v['source_form']===$expectedForm,422,'Submission form does not match its type.');
        abort_if($v['source_form']==='legacy_visitor_registrations' && $v['type']!=='visitor_interest',422);
        $hash=IntakePayload::hash($v);
        return DB::transaction(function() use($v,$hash,$payload){
            // Serialize an event's accepts, including a first submission and its retries.
            DB::table('exhibitions')->where('id',$v['exhibition_id'])->lockForUpdate()->first();
            $old=DB::table('intake_inbox')->where('id',$v['message_id'])->first();
            if ($old) {
                abort_unless(hash_equals($old->payload_hash,$hash),409,'Idempotency payload mismatch.');
                return ['accepted'=>true,'source_id'=>$v['source_id'],'message_id'=>$v['message_id']];
            }
            $row=DB::table('intake_submissions')->where('site',$v['site'])->where('source_id',$v['source_id'])->lockForUpdate()->first();
            if ($row) {
                abort_unless(hash_equals($row->source_hash,$v['source_hash']) && $row->type===$v['type'] && (int)$row->exhibition_id===$v['exhibition_id'],409,'Source identity mismatch.');
                abort_unless($row->source_system===$v['source_system'] && $row->source_form===$v['source_form']
                    && (bool)$row->historical===$v['historical']
                    && \Carbon\Carbon::parse($row->submitted_at)->utc()->format('Y-m-d\TH:i:s\Z')===$v['submitted_at'],409,'Source provenance mismatch.');
                $id=$row->id;
            } else {
                abort_unless($v['event']==='submitted',409,'Awaiting the original submission.');
                $status=match($v['type']){'buyer','visitor'=>'submitted',default=>'received'};
                $id=DB::table('intake_submissions')->insertGetId(['source_id'=>$v['source_id'],'source_system'=>$v['source_system'],'site'=>$v['site'],
                    'source_form'=>$v['source_form'],'type'=>$v['type'],'exhibition_id'=>$v['exhibition_id'],'historical'=>$v['historical'],
                    'original_payload'=>Crypt::encryptString(json_encode($payload,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE)),
                    'source_hash'=>$v['source_hash'],'name'=>$payload['name'],'email'=>mb_strtolower(trim($payload['email'])),
                    'phone'=>IntakePayload::phone($payload),'company'=>$payload['company']??null,'country'=>$payload['country'],
                    'language'=>$payload['language'],'interests'=>json_encode($payload['interests']??[]),'submitted_at'=>\Carbon\Carbon::parse($v['submitted_at']),
                    'status'=>$status,'created_at'=>now(),'updated_at'=>now()]);
                DB::table('intake_history')->insert(['submission_id'=>$id,'action'=>'received','to_status'=>$status,'created_at'=>now()]);
                $policy=app(\App\Services\PermissionPolicy::class);
                foreach(\App\Models\User::where('status','active')->get() as $staff) {
                    if ($policy->allows(IntakePayload::family($v['type']).'.view',$staff) && app(\App\Services\IntakeAccess::class)->query($staff)->where('id',$id)->exists()) {
                        DB::table('notifications')->insert(['user_id'=>$staff->id,'name'=>'New registration or enquiry requires review','resource'=>'intake_submissions','record_id'=>$id,'created_at'=>now(),'updated_at'=>now()]);
                    }
                }
            }
            if ($v['event']==='withdrawn' && !$row?->withdrawn_at) {
                DB::table('intake_submissions')->where('id',$id)->update(['status'=>'withdrawn','withdrawn_at'=>now(),'version'=>DB::raw('version+1'),'updated_at'=>now()]);
                DB::table('intake_history')->insert(['submission_id'=>$id,'action'=>'public_withdrawal','from_status'=>$row->status,'to_status'=>'withdrawn','created_at'=>now()]);
            }
            DB::table('intake_inbox')->insert(['id'=>$v['message_id'],'payload_hash'=>$hash,'submission_id'=>$id,'accepted_at'=>now()]);
            return ['accepted'=>true,'source_id'=>$v['source_id'],'message_id'=>$v['message_id']];
        },3);
    }

    public function controls(): array
    {
        $event=DB::table('exhibitions')->find(config('intake.exhibition_id'));
        abort_unless($event,503);
        $controls=[];
        foreach(['exhibitor','sponsor','buyer','visitor','general'] as $type) {
            $row=DB::table('registration_controls')->where('site',config('intake.site'))->where('exhibition_id',$event->id)->where('type',$type)->first();
            $open=$row && $row->enabled && !in_array($event->status,['cancelled','completed','postponed'],true)
                && (!$row->opens_at || now()->gte($row->opens_at)) && (!$row->closes_at || now()->lt($row->closes_at))
                && $row->policy_version && $row->privacy_notice_en && $row->privacy_notice_ar && ($type!=='visitor' || $row->dates_approved);
            $controls[$type]=['open'=>(bool)$open,'dates'=>$row?->dates_approved ? json_decode($row->visit_dates??'[]',true):[],
                'timezone'=>$row->timezone??'Africa/Cairo','policy_version'=>$row->policy_version??null,'version'=>$row->version??0,
                'privacy_notice_en'=>$row->privacy_notice_en??null,'privacy_notice_ar'=>$row->privacy_notice_ar??null];
        }
        return ['site'=>config('intake.site'),'exhibition_id'=>(int)$event->id,'exhibition_name'=>$event->name,'controls'=>$controls];
    }

    public function status(Request $request): array
    {
        $v=$request->validate(['source_id'=>'required|uuid']);
        $row=DB::table('intake_submissions')->where('site',config('intake.site'))->where('exhibition_id',config('intake.exhibition_id'))->where('source_id',$v['source_id'])->first();
        return ['status'=>$row?->status??'awaiting_processing'];
    }
}
