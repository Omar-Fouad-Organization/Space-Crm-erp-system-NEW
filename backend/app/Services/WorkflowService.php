<?php
namespace App\Services;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class WorkflowService
{
    public const KINDS = [
        "refund",
        "receipt_reversal",
        "credit_note",
        "commission_recovery",
        "discount",
        "payment_terms",
        "commission_rate",
    ];
    public function __construct(
        private CrmService $crm,
        private RecordAccess $access,
    ) {}
    private function fail(string $message): never
    {
        throw ValidationException::withMessages(["workflow" => $message]);
    }
    public function financeUser($user, string $permission = 'finance.view'): void
    {
        if (app(PermissionPolicy::class)->enabled()) { app(PermissionPolicy::class)->authorize($permission, $user); return; }
        abort_unless(
            in_array($user->role, ["super_admin", "management", "finance"]),
            403,
        );
    }
    public function approved(string $kind, int $deal): int
    {
        $cache = FinancialSnapshot::get();
        if (isset($cache["deals"][$deal])) {
            return $cache["approved"][$deal][$kind] ?? 0;
        }
        return $this->crm->cents(
            DB::table("workflow_requests")
                ->where("deal_id", $deal)
                ->where("kind", $kind)
                ->where("status", "approved")
                ->sum("amount"),
        );
    }
    public function credit(int $deal): int
    {
        return $this->approved("credit_note", $deal);
    }
    public function scheduleCredit(int $id): int
    {
        $cache = FinancialSnapshot::get();
        if (isset($cache["schedules"][$id])) {
            return $cache["credits"][$id] ?? 0;
        }
        return $this->crm->cents(
            DB::table("workflow_requests")
                ->where("payment_schedule_id", $id)
                ->where("kind", "credit_note")
                ->where("status", "approved")
                ->sum("amount"),
        );
    }
    public function received(int $deal): int
    {
        $cache = FinancialSnapshot::get();
        if (isset($cache["deals"][$deal])) {
            return ($cache["gross"][$deal] ?? 0) -
                ($cache["approved"][$deal]["refund"] ?? 0) -
                ($cache["approved"][$deal]["receipt_reversal"] ?? 0);
        }
        $gross = DB::table("payments")
            ->whereIn(
                "payment_schedule_id",
                DB::table("payment_schedules")
                    ->where("deal_id", $deal)
                    ->pluck("id"),
            )
            ->sum("amount");
        return $this->crm->cents($gross) -
            $this->approved("refund", $deal) -
            $this->approved("receipt_reversal", $deal);
    }
    public function scheduleReceived(int $schedule): int
    {
        $cache = FinancialSnapshot::get();
        if (isset($cache["schedules"][$schedule])) {
            return ($cache["bySchedule"][$schedule] ?? 0) -
                ($cache["corrections"][$schedule] ?? 0);
        }
        $ids = DB::table("payments")
            ->where("payment_schedule_id", $schedule)
            ->pluck("id");
        return $this->crm->cents(
            DB::table("payments")->whereIn("id", $ids)->sum("amount"),
        ) -
            $this->crm->cents(
                DB::table("workflow_requests")
                    ->whereIn("payment_id", $ids)
                    ->whereIn("kind", ["refund", "receipt_reversal"])
                    ->where("status", "approved")
                    ->sum("amount"),
            );
    }
    public function request(array $input, $user): array
    {
        if (app(PermissionPolicy::class)->enabled()) {
            foreach (['deal_id' => 'deals', 'payment_id' => 'payments', 'payment_schedule_id' => 'payment_schedules', 'commission_id' => 'commissions'] as $field => $resource) {
                $value = $input[$field] ?? null;
                if ((is_int($value) || is_string($value)) && ctype_digit((string) $value) && (int) $value > 0) {
                    $this->crm->authorize($resource, $user); $this->access->check($resource, (int) $value, $user);
                }
            }
        }
        $v = Validator::make($input, [
            "kind" => ["required", Rule::in(self::KINDS)],
            "deal_id" => "required|integer|exists:deals,id",
            "payment_id" => "nullable|integer|exists:payments,id",
            "payment_schedule_id" =>
                "nullable|integer|exists:payment_schedules,id",
            "commission_id" => "nullable|integer|exists:commissions,id",
            "amount" =>
                "nullable|numeric|min:0.01|decimal:0,2|max:9999999999999.99",
            "reason" => "required|string|min:8|max:5000",
            "payload" => "nullable|array",
        ])->validate();
        $this->crm->authorize("deals", $user);
        $this->access->check("deals", $v["deal_id"], $user);
        if (app(PermissionPolicy::class)->enabled()) app(PermissionPolicy::class)->authorize('workflow.'.$v['kind'].'.request', $user);
        $financial = in_array($v["kind"], [
            "refund",
            "receipt_reversal",
            "credit_note",
            "commission_recovery",
        ]);
        if ($financial) {
            $this->financeUser($user, 'workflow.'.$v['kind'].'.request');
            if (empty($v["amount"])) {
                $this->fail("Enter a positive adjustment amount.");
            }
        } else {
            if (!app(PermissionPolicy::class)->enabled()) $this->crm->authorize("deals", $user, true);
            $p = $v["payload"] ?? [];
            $rules = match ($v["kind"]) {
                "discount" => [
                    "discount_percentage" =>
                        "required|numeric|min:0|max:100|decimal:0,2",
                ],
                "commission_rate" => [
                    "commission_percentage" =>
                        "required|numeric|min:0|max:100|decimal:0,2",
                ],
                default => ["due_date" => "required|date_format:Y-m-d"],
            };
            $v["payload"] = Validator::make($p, $rules)->validate();
            $v["amount"] = null;
        }
        $this->validateLinks($v);
        $v["payload"] = json_encode($v["payload"] ?? []);
        $v["requested_by"] = $user->id;
        $v["created_at"] = now();
        $v["updated_at"] = now();
        $id = DB::table("workflow_requests")->insertGetId($v);
        $row = DB::table("workflow_requests")->find($id);
        $this->crm->audit(
            "workflow_requests",
            $id,
            "request",
            $user->id,
            null,
            $row,
        );
        return (array) $row;
    }
    private function validateLinks(array $v): void
    {
        if (in_array($v["kind"], ["credit_note", "payment_terms"])) {
            if (empty($v["payment_schedule_id"])) {
                $this->fail("Choose the related installment.");
            }
            $schedule = DB::table("payment_schedules")->find(
                $v["payment_schedule_id"],
            );
            if ((int) $schedule->deal_id !== (int) $v["deal_id"]) {
                $this->fail("Installment and deal must match.");
            }
        } elseif (!empty($v["payment_schedule_id"])) {
            $this->fail(
                "Only credits and payment terms accept an installment allocation.",
            );
        }
        if (in_array($v["kind"], ["refund", "receipt_reversal"])) {
            if (empty($v["payment_id"])) {
                $this->fail("Choose the original receipt.");
            }
            $p = DB::table("payments")->find($v["payment_id"]);
            $s = DB::table("payment_schedules")->find($p->payment_schedule_id);
            if ((int) $s->deal_id !== (int) $v["deal_id"]) {
                $this->fail("Receipt and deal must match.");
            }
        } elseif (!empty($v["payment_id"])) {
            $this->fail("Only receipt corrections accept a receipt reference.");
        }
        if ($v["kind"] === "commission_recovery") {
            if (empty($v["commission_id"])) {
                $this->fail("Choose the original paid commission.");
            }
            $c = DB::table("commissions")->find($v["commission_id"]);
            if (
                (int) $c->deal_id !== (int) $v["deal_id"] ||
                $c->status !== "paid"
            ) {
                $this->fail(
                    "Recovery must reference a paid commission on this deal.",
                );
            }
        } elseif (!empty($v["commission_id"])) {
            $this->fail(
                "Only commission recoveries accept a commission reference.",
            );
        }
    }
    public function review(int $id, array $input, $user): array
    {
        if (!app(PermissionPolicy::class)->enabled()) abort_unless(in_array($user->role, ["super_admin", "management"]), 403);
        $v = Validator::make($input, [
            "decision" => ["required", Rule::in(["approved", "rejected"])],
            "review_note" => "required|string|min:8|max:5000",
        ])->validate();
        return DB::transaction(function () use ($id, $v, $user) {
            $w = DB::table("workflow_requests")
                ->where("id", $id)
                ->lockForUpdate()
                ->first();
            abort_unless($w, 404);
            if (app(PermissionPolicy::class)->enabled()) {
                $this->access->check('deals', $w->deal_id, $user);
                app(PermissionPolicy::class)->authorize('workflow.'.$w->kind.'.approve', $user);
            }
            if ($w->status !== "pending") {
                $this->fail("This request has already been reviewed.");
            }
            if ($w->requested_by === $user->id) {
                $this->fail(
                    "A different manager or administrator must review this request.",
                );
            }
            $deal = DB::table("deals")
                ->where("id", $w->deal_id)
                ->lockForUpdate()
                ->first();
            if ($v["decision"] === "approved") {
                $this->validateLinks((array) $w);
                $amount = $this->crm->cents($w->amount ?? 0);
                if (in_array($w->kind, ["refund", "receipt_reversal"])) {
                    $payment = DB::table("payments")
                        ->where("id", $w->payment_id)
                        ->lockForUpdate()
                        ->first();
                    $used = $this->crm->cents(
                        DB::table("workflow_requests")
                            ->where("payment_id", $payment->id)
                            ->whereIn("kind", ["refund", "receipt_reversal"])
                            ->where("status", "approved")
                            ->sum("amount"),
                    );
                    if (
                        $amount + $used > $this->crm->cents($payment->amount) ||
                        $amount > $this->received($deal->id)
                    ) {
                        $this->fail(
                            "Correction exceeds the remaining receipt amount.",
                        );
                    }
                    if (
                        $w->kind === "receipt_reversal" &&
                        $amount !== $this->crm->cents($payment->amount) - $used
                    ) {
                        $this->fail(
                            "A reversal must reverse the entire remaining receipt; use refund for a partial correction.",
                        );
                    }
                } elseif ($w->kind === "credit_note") {
                    $schedule = DB::table("payment_schedules")
                        ->where("id", $w->payment_schedule_id)
                        ->lockForUpdate()
                        ->first();
                    if (
                        $amount >
                        $this->crm->cents($schedule->amount) -
                            $this->scheduleCredit($schedule->id) -
                            $this->scheduleReceived($schedule->id)
                    ) {
                        $this->fail(
                            "Credit exceeds the unpaid installment balance.",
                        );
                    }
                    $obligation =
                        $this->crm->cents($deal->amount) -
                        $this->credit($deal->id);
                    if ($amount > $obligation - $this->received($deal->id)) {
                        $this->fail(
                            "Credit exceeds the unpaid deal balance. Refund overpayments first.",
                        );
                    }
                } elseif ($w->kind === "commission_recovery") {
                    $commission = DB::table("commissions")
                        ->where("id", $w->commission_id)
                        ->lockForUpdate()
                        ->first();
                    if (
                        $amount +
                            $this->approved("commission_recovery", $deal->id) >
                        $this->crm->cents($commission->amount)
                    ) {
                        $this->fail("Recovery exceeds the paid commission.");
                    }
                } elseif ($w->kind === "payment_terms") {
                    $schedule = DB::table("payment_schedules")
                        ->where("id", $w->payment_schedule_id)
                        ->lockForUpdate()
                        ->first();
                    $payload = json_decode($w->payload, true);
                    $this->crm->approvedChange = true;
                    try {
                        $this->crm->save(
                            "payment_schedules",
                            [
                                "name" => $schedule->name,
                                "deal_id" => $schedule->deal_id,
                                "amount" => $schedule->amount,
                                "due_date" => $payload["due_date"],
                            ],
                            $user,
                            $schedule->id,
                        );
                    } finally {
                        $this->crm->approvedChange = false;
                    }
                } else {
                    $p = json_decode($w->payload, true);
                    $data = (array) $deal;
                    unset(
                        $data["id"],
                        $data["created_by"],
                        $data["created_at"],
                        $data["updated_at"],
                        $data["attributes"],
                        $data["reservation_expires_at"],
                        $data["won_at"],
                    );
                    $data = [...$data, ...$p];
                    if ($w->kind === "discount") {
                        if ($deal->base_price === null) {
                            $this->fail(
                                "Set a base price before requesting a discount.",
                            );
                        }
                        $base = \Brick\Math\BigDecimal::of($deal->base_price);
                        $discount = $base
                            ->multipliedBy($p["discount_percentage"])
                            ->dividedBy(
                                100,
                                2,
                                \Brick\Math\RoundingMode::HALF_UP,
                            );
                        $net = $base->minus($discount);
                        $tax = $net
                            ->multipliedBy($deal->tax_percentage ?? 0)
                            ->dividedBy(
                                100,
                                2,
                                \Brick\Math\RoundingMode::HALF_UP,
                            );
                        $data["amount"] = (string) $net->plus($tax);
                    }
                    $this->crm->approvedChange = true;
                    try {
                        $this->crm->save("deals", $data, $user, $deal->id);
                    } finally {
                        $this->crm->approvedChange = false;
                    }
                }
            }
            DB::table("workflow_requests")
                ->where("id", $id)
                ->update([
                    "status" => $v["decision"],
                    "review_note" => $v["review_note"],
                    "reviewed_by" => $user->id,
                    "reviewed_at" => now(),
                    "updated_at" => now(),
                ]);
            $after = DB::table("workflow_requests")->find($id);
            $this->crm->audit(
                "workflow_requests",
                $id,
                $v["decision"],
                $user->id,
                $w,
                $after,
            );
            return (array) $after;
        }, 3);
    }
    public function collections($user): array
    {
        $this->financeUser($user, 'collections.view');
        $rows = [];
        foreach (
            $this->access->query("payment_schedules", $user)->get()
            as $s
        ) {
            $deal = DB::table("deals")->find($s->deal_id);
            if ($deal->status !== "closed_won") {
                continue;
            }
            $left =
                $this->crm->cents($s->amount) -
                $this->scheduleCredit($s->id) -
                $this->scheduleReceived($s->id);
            if ($left <= 0) {
                continue;
            }
            $days = (int) now()
                ->startOfDay()
                ->diffInDays(\Carbon\Carbon::parse($s->due_date), false);
            $rows[] = [
                ...(array) $s,
                "deal" => $deal->name,
                "client" => DB::table("clients")
                    ->where("id", $deal->client_id)
                    ->value("name"),
                "currency" => $deal->currency,
                "outstanding" => $this->crm->decimal($left),
                "deal_outstanding" => $this->crm->decimal(
                    $this->crm->cents($deal->amount) -
                        $this->credit($deal->id) -
                        $this->received($deal->id),
                ),
                "aging" =>
                    $days >= 0
                        ? "upcoming"
                        : ($days >= -30
                            ? "1–30 days"
                            : ($days >= -60
                                ? "31–60 days"
                                : ($days >= -90
                                    ? "61–90 days"
                                    : "90+ days"))),
                "notes" => DB::table("collection_notes")
                    ->where("payment_schedule_id", $s->id)
                    ->orderByDesc("id")
                    ->get(),
            ];
        }
        return $rows;
    }
    public function dispatchReminders(): array
    {
        $sent = 0;
        $failed = 0;
        foreach (
            DB::table("reminders")
                ->whereIn("status", ["pending", "failed"])
                ->where("attempts", "<", 3)
                ->where("send_at", "<=", now())
                ->pluck("id")
            as $id
        ) {
            DB::transaction(function () use ($id, &$sent, &$failed) {
                $r = DB::table("reminders")
                    ->where("id", $id)
                    ->lockForUpdate()
                    ->first();
                if (
                    !in_array($r->status, ["pending", "failed"]) ||
                    $r->attempts >= 3
                ) {
                    return;
                }
                try {
                    $u = \App\Models\User::find($r->user_id);
                    abort_unless(
                        $u && $u->status === "active",
                        422,
                        "Recipient inactive.",
                    );
                    $this->crm->authorize($r->resource, $u);
                    if (app(PermissionPolicy::class)->enabled()) app(PermissionPolicy::class)->authorize('reminders.view', $u);
                    $this->access->check($r->resource, $r->record_id, $u);
                    if ($r->channel === "email") {
                        if (
                            in_array(config("mail.default"), ["log", "array"])
                        ) {
                            throw new \RuntimeException(
                                "Real email transport is not configured.",
                            );
                        }
                        Mail::raw(
                            $r->name,
                            fn($m) => $m
                                ->to($u->email)
                                ->subject("SPACE CRM reminder"),
                        );
                    } else {
                        DB::table("notifications")->insert([
                            "user_id" => $u->id,
                            "name" => $r->name,
                            "resource" => $r->resource,
                            "record_id" => $r->record_id,
                            "created_at" => now(),
                            "updated_at" => now(),
                        ]);
                    }
                    DB::table("reminders")
                        ->where("id", $id)
                        ->update([
                            "status" => "delivered",
                            "attempts" => $r->attempts + 1,
                            "delivered_at" => now(),
                            "last_error" => null,
                            "updated_at" => now(),
                        ]);
                    $sent++;
                } catch (\Throwable $e) {
                    DB::table("reminders")
                        ->where("id", $id)
                        ->update([
                            "status" => "failed",
                            "attempts" => $r->attempts + 1,
                            "last_error" =>
                                "Delivery failed. Check recipient access and configured transport.",
                            "updated_at" => now(),
                        ]);
                    $failed++;
                }
            });
        }
        return compact("sent", "failed");
    }
}
