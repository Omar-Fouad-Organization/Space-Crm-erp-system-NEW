<?php
namespace App\Console\Commands;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
class ReportIntakeRetention extends Command
{
    protected $signature='intake:retention-report';
    protected $description='Read-only counts against an explicitly approved retention window; never deletes or redacts records';
    public function handle(): int
    {
        $days=filter_var(config('intake.retention_days'),FILTER_VALIDATE_INT);
        if (!$days || $days<1 || $days>36500) {$this->error('Set an approved INTAKE_RETENTION_DAYS policy first.');return 1;}
        $cutoff=now()->subDays($days);
        $counts=DB::table('intake_submissions')->where('submitted_at','<',$cutoff)->whereNull('redacted_at')
            ->select('site','exhibition_id','type')->selectRaw('COUNT(*) AS candidates')->groupBy('site','exhibition_id','type')->get();
        $this->line(json_encode(['mode'=>'report_only','cutoff_utc'=>$cutoff->utc()->toIso8601String(),'groups'=>$counts,
            'requires'=>'Approved purpose, legal holds, cross-system reconciliation and backup policy review before any redaction.']));
        return 0;
    }
}
