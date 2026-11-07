<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

\Illuminate\Support\Facades\Artisan::command('crm:reminders',function(){ $this->line(json_encode(app(\App\Services\WorkflowService::class)->dispatchReminders())); });
\Illuminate\Support\Facades\Artisan::command('crm:expire-reservations',function(){
    $count=0;foreach(\Illuminate\Support\Facades\DB::table('deals')->whereNotNull('reservation_expires_at')->where('reservation_expires_at','<=',now())->whereNotIn('status',['closed_won','closed_lost','cancelled'])->pluck('id') as $id){
        \Illuminate\Support\Facades\DB::transaction(function()use($id,&$count){$db=\Illuminate\Support\Facades\DB::class;$d=$db::table('deals')->where('id',$id)->lockForUpdate()->first();if(!$d||in_array($d->status,['closed_won','closed_lost','cancelled'])||!$d->reservation_expires_at||$d->reservation_expires_at>now())return;
            if($db::table('payment_schedules')->where('deal_id',$id)->whereIn('id',$db::table('payments')->pluck('payment_schedule_id'))->exists())return;
            if($db::table('commissions')->where('deal_id',$id)->whereIn('status',['approved','paid'])->exists())return;
            $db::table('booths')->where('id',$d->booth_id)->lockForUpdate()->first();$db::table('deals')->where('id',$id)->update(['status'=>'cancelled','updated_at'=>now()]);$db::table('commissions')->where('deal_id',$id)->where('status','pending')->update(['amount'=>'0.00','updated_at'=>now()]);$crm=app(\App\Services\CrmService::class);$crm->syncBooth($d->booth_id);$crm->audit('deals',$id,'reservation_expired',$d->created_by,$d,['status'=>'cancelled']);$count++;});
    }$this->line('Expired '.$count.' reservations.');
});
\Illuminate\Support\Facades\Schedule::command('crm:reminders')->everyMinute()->withoutOverlapping();
\Illuminate\Support\Facades\Schedule::command('crm:expire-reservations')->everyMinute()->withoutOverlapping();
\Illuminate\Support\Facades\Schedule::command('crm:backup')->dailyAt('02:00')->withoutOverlapping();

\Illuminate\Support\Facades\Artisan::command('crm:heartbeat',fn()=>\Illuminate\Support\Facades\Cache::put('crm.scheduler_seen',now()->toIso8601String(),3600));
\Illuminate\Support\Facades\Schedule::command('crm:heartbeat')->everyMinute()->withoutOverlapping();

\Illuminate\Support\Facades\Artisan::command('crm:scheduler-status',function(){ $this->line(\Illuminate\Support\Facades\Cache::get('crm.scheduler_seen')??''); });

Artisan::command('intake:prune-nonces',function(): int {
    $count=\Illuminate\Support\Facades\DB::table('intake_nonces')->where('expires_at','<',now()->subMinutes(5))->limit(5000)->delete();
    $this->info('Expired replay nonces: '.$count);return 0;
})->purpose('Prune expired service replay nonces only; preserve inbox, outbox and audit history');

// Phase 6.1: dedicated bounded sweeps, enabled only for the approved onboarding feature.
\Illuminate\Support\Facades\Schedule::command('portal:deliver-invitations --limit=25')->everyMinute()->onOneServer()->withoutOverlapping(5)->when(fn()=>config('participant_portal.enabled') && config('participant_onboarding.enabled'));

\Illuminate\Support\Facades\Schedule::command('portal:purge-delivery-secrets')->everyTenMinutes()->onOneServer()->withoutOverlapping(5)->when(fn()=>config('participant_portal.enabled'));
