<?php
namespace Tests\Support;

use App\Services\{B2BScheduler,B2BOperations};
use Illuminate\Support\Facades\DB;

class B2BFollowupFixture
{
    public static function create(): array
    {
        \Carbon\Carbon::setTestNow('2026-11-09T10:00:00Z');
        \Carbon\CarbonImmutable::setTestNow('2026-11-09T10:00:00Z');
        $f=B2BFixture::create(); config(['b2b.onsite_enabled'=>true,'b2b.crm_followup_enabled'=>true]);
        $f['meeting']=app(B2BScheduler::class)->schedule(B2BFixture::booking($f,0),$f['user']);
        \Carbon\Carbon::setTestNow('2027-01-01T10:00:00Z');
        \Carbon\CarbonImmutable::setTestNow('2027-01-01T10:00:00Z');
        foreach ([['arrive',1,'buyer'],['arrive',2,'exhibitor'],['start',3,null],['complete',4,null]] as [$action,$version,$party]) {
            app(B2BOperations::class)->meeting($f['meeting'],['action'=>$action,'version'=>$version,'booking_revision'=>1,'reason'=>'SYNTHETIC PRIVATE B2B notes',...($party?['party'=>$party]:[]),...($action==='complete'?['outcome_code'=>'followup_required']:[])],$f['user']);
        }
        $f['input']=['version'=>5,'name'=>'SYNTHETIC follow-up task','description'=>'Approved operational instruction only','assigned_user_id'=>$f['user']->id,'due_date'=>'2027-01-04','priority'=>'high','status'=>'pending','exhibition_id'=>$f['event']];
        return $f;
    }
}
