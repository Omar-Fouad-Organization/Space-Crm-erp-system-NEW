<?php
namespace App\Services;
use Illuminate\Support\Facades\DB;

/** Request-local batch data for read-only record lists and financial reports. */
class FinancialSnapshot
{
    public static function prime(array $ids): void
    {
        $crm = app(CrmService::class);
        $deals = DB::table("deals")
            ->whereIn("id", $ids)
            ->get()
            ->keyBy("id")
            ->all();
        $schedules = DB::table("payment_schedules")
            ->whereIn("deal_id", $ids)
            ->get()
            ->keyBy("id")
            ->all();
        $payments = DB::table("payments")
            ->whereIn("payment_schedule_id", array_keys($schedules))
            ->orderByDesc("paid_date")
            ->orderByDesc("id")
            ->get();
        $gross = [];
        $bySchedule = [];
        $latest = [];
        $byPayment = [];
        $approved = [];
        $corrections = [];
        $credits = [];
        foreach ($payments as $p) {
            $deal = $schedules[$p->payment_schedule_id]->deal_id;
            $c = $crm->cents($p->amount);
            $gross[$deal] = ($gross[$deal] ?? 0) + $c;
            $bySchedule[$p->payment_schedule_id] =
                ($bySchedule[$p->payment_schedule_id] ?? 0) + $c;
            $latest[$p->payment_schedule_id] ??= $p;
            $byPayment[$p->id] = $p;
        }
        foreach (
            DB::table("workflow_requests")
                ->whereIn("deal_id", $ids)
                ->where("status", "approved")
                ->get()
            as $w
        ) {
            $amount = $crm->cents($w->amount ?? 0);
            $approved[$w->deal_id][$w->kind] =
                ($approved[$w->deal_id][$w->kind] ?? 0) + $amount;
            if (in_array($w->kind, ["refund", "receipt_reversal"])) {
                $s = $byPayment[$w->payment_id]->payment_schedule_id;
                $corrections[$s] = ($corrections[$s] ?? 0) + $amount;
            }
            if ($w->kind === "credit_note") {
                $credits[$w->payment_schedule_id] =
                    ($credits[$w->payment_schedule_id] ?? 0) + $amount;
            }
        }
        request()->attributes->set(
            "crm.financial",
            compact(
                "deals",
                "schedules",
                "gross",
                "bySchedule",
                "latest",
                "approved",
                "corrections",
                "credits",
            ),
        );
    }
    public static function get(): ?array
    {
        return request()->attributes->get("crm.financial");
    }
}
