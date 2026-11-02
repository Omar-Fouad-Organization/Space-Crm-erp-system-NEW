<?php
namespace App\Http\Controllers;
use App\Services\{CrmService, WorkflowService, RecordAccess};
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
class WorkspaceController extends Controller
{
    public function __construct(
        private CrmService $crm,
        private WorkflowService $work,
        private RecordAccess $access,
    ) {}
    public function finance(Request $r)
    {
        $this->work->financeUser($r->user());
        $v = $r->validate([
            "days" => "nullable|integer|min:1|max:3660",
            "currency" => [
                "nullable",
                Rule::in(["EGP", "USD", "EUR", "SAR", "AED"]),
            ],
        ]);
        $currency = $v["currency"] ?? DB::table("settings")->value("currency");
        $from = now()
            ->startOfDay()
            ->subDays(($v["days"] ?? 30) - 1);
        $through = now()->endOfDay();
        $deals = $this->access
            ->query("deals", $r->user())
            ->where("currency", $currency)
            ->get();
        $ids = $deals->pluck("id");
        $schedules = $this->access
            ->query("payment_schedules", $r->user())
            ->whereIn("deal_id", $ids)
            ->get();
        $receipts = DB::table("payments")
            ->whereIn("payment_schedule_id", $schedules->pluck("id"))
            ->whereBetween("paid_date", [
                $from->toDateString(),
                $through->toDateString(),
            ])
            ->get();
        $gross = $this->crm->cents($receipts->sum("amount"));
        $adjustments = DB::table("workflow_requests")
            ->whereIn("deal_id", $ids)
            ->where("status", "approved")
            ->whereBetween("reviewed_at", [$from, $through])
            ->whereIn("kind", ["refund", "receipt_reversal"])
            ->sum("amount");
        $won = $deals
            ->where("status", "closed_won")
            ->filter(
                fn($d) => $d->won_at >= $from->toDateTimeString() &&
                    $d->won_at <= $through->toDateTimeString(),
            );
        $balance = 0;
        $overdue = 0;
        foreach ($deals->where("status", "closed_won") as $d) {
            $left = max(
                0,
                $this->crm->cents($d->amount) -
                    $this->work->credit($d->id) -
                    $this->work->received($d->id),
            );
            $balance += $left;
            $late = 0;
            foreach ($schedules->where("deal_id", $d->id) as $s) {
                if ($s->due_date < now()->toDateString()) {
                    $late += max(
                        0,
                        $this->crm->cents($s->amount) -
                            $this->work->scheduleCredit($s->id) -
                            $this->work->scheduleReceived($s->id),
                    );
                }
            }
            $overdue += min($left, $late);
        }
        $commission = DB::table("commissions")->whereIn("deal_id", $ids)->get();
        $pending =
            $this->crm->cents(
                $commission->where("status", "pending")->sum("amount"),
            ) +
            $this->crm->cents(
                $commission->where("status", "approved")->sum("amount"),
            );
        $paid = 0;
        foreach ($commission->where("status", "paid") as $c) {
            $paid +=
                $this->crm->cents($c->amount) -
                $this->work->approved("commission_recovery", $c->deal_id);
        }
        $previousFrom = $from->copy()->subDays($v["days"] ?? 30);
        $previousTo = $from->copy()->subDay()->toDateString();
        $previousGross = $this->crm->cents(
            DB::table("payments")
                ->whereIn("payment_schedule_id", $schedules->pluck("id"))
                ->whereBetween("paid_date", [
                    $previousFrom->toDateString(),
                    $previousTo,
                ])
                ->sum("amount"),
        );
        $previousCorrections = $this->crm->cents(
            DB::table("workflow_requests")
                ->whereIn("deal_id", $ids)
                ->where("status", "approved")
                ->whereIn("kind", ["refund", "receipt_reversal"])
                ->whereBetween("reviewed_at", [$previousFrom, $from])
                ->sum("amount"),
        );
        $previousNet = $previousGross - $previousCorrections;
        $net = $gross - $this->crm->cents($adjustments);
        $growth =
            $previousNet > 0
                ? round((($net - $previousNet) / $previousNet) * 100, 2)
                : null;
        $allCash = 0;
        $allObligation = 0;
        foreach ($deals->where("status", "closed_won") as $d) {
            $allCash += $this->work->received($d->id);
            $allObligation +=
                $this->crm->cents($d->amount) - $this->work->credit($d->id);
        }
        $delayTotal = 0;
        $delayCount = 0;
        foreach ($receipts as $receipt) {
            $schedule = $schedules->firstWhere(
                "id",
                $receipt->payment_schedule_id,
            );
            $deal = $deals->firstWhere("id", $schedule->deal_id);
            if ($deal->won_at) {
                $delayTotal += max(
                    0,
                    (int) \Carbon\Carbon::parse($deal->won_at)
                        ->startOfDay()
                        ->diffInDays(
                            \Carbon\Carbon::parse($receipt->paid_date),
                            false,
                        ),
                );
                $delayCount++;
            }
        }
        $periodInvoiced = DB::table("deals")
            ->whereIn(
                "id",
                DB::table("invoices")
                    ->whereIn("deal_id", $ids)
                    ->whereBetween("created_at", [$from, $through])
                    ->distinct()
                    ->pluck("deal_id"),
            )
            ->sum("amount");
        return [
            "currency" => $currency,
            "from" => $from->toDateString(),
            "through" => $through->toDateString(),
            "metrics" => [
                "total_revenue" => $won->sum("amount"),
                "monthly_revenue" => $this->crm->decimal(
                    $gross - $this->crm->cents($adjustments),
                ),
                "payments_collected" => $this->crm->decimal(
                    $gross - $this->crm->cents($adjustments),
                ),
                "gross_receipts" => $this->crm->decimal($gross),
                "corrections" => $adjustments,
                "invoiced" => $periodInvoiced,
                "payments_pending" => $this->crm->decimal($balance),
                "payments_overdue" => $this->crm->decimal($overdue),
                "commission_pending" => $this->crm->decimal($pending),
                "commission_paid" => $this->crm->decimal($paid),
                "collection_rate" =>
                    $allObligation > 0
                        ? round(($allCash / $allObligation) * 100, 2)
                        : null,
                "avg_payment_time" => $delayCount
                    ? round($delayTotal / $delayCount, 1)
                    : null,
                "revenue_growth" => $growth,
            ],
            "basis" =>
                "Period sales use the won transition date; cash uses receipt date and approved correction date. Balances and commission totals are current, not period movements.",
        ];
    }
    public function search(Request $r)
    {
        $v = $r->validate([
            "q" => "required|string|min:2|max:200",
            "page" => "nullable|integer|min:1",
        ]);
        $results = [];
        foreach (["clients", "deals", "booths"] as $resource) {
            try {
                $this->crm->authorize($resource, $r->user());
            } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
                continue;
            }
            $q = $this->access
                ->query($resource, $r->user())
                ->where(function ($q) use ($resource, $v) {
                    $term = "%" . addcslashes($v["q"], "%_") . "%";
                    $q->where("name", "like", $term);
                    if ($resource === "clients") {
                        $q->orWhere("email", "like", $term)->orWhere(
                            "contact_person",
                            "like",
                            $term,
                        );
                    }
                });
            foreach ($q->orderByDesc("id")->limit(30)->get() as $row) {
                $results[] = [
                    "id" => $row->id,
                    "name" => $row->name,
                    "email" => $row->email ?? null,
                    "resource" => $resource,
                    "path" => "/" . $resource . "/" . $row->id,
                ];
            }
        }
        return ["data" => $results, "limit_per_module" => 30];
    }
    public function cashMovements(Request $r)
    {
        $this->crm->authorize("payments", $r->user());
        $ids = $this->access->query("deals", $r->user())->pluck("id");
        $schedules = DB::table("payment_schedules")
            ->whereIn("deal_id", $ids)
            ->pluck("deal_id", "id");
        $deals = DB::table("deals")->whereIn("id", $ids)->get()->keyBy("id");
        $rows = [];
        foreach (
            DB::table("payments")
                ->whereIn("payment_schedule_id", $schedules->keys())
                ->get()
            as $p
        ) {
            $d = $deals[$schedules[$p->payment_schedule_id]];
            $rows[] = [
                "id" => "receipt-" . $p->id,
                "deal_id" => (string) $d->id,
                "currency" => $d->currency,
                "amount" => $p->amount,
                "paid_date" => $p->paid_date,
                "name" => $p->name,
            ];
        }
        foreach (
            DB::table("workflow_requests")
                ->whereIn("deal_id", $ids)
                ->where("status", "approved")
                ->whereIn("kind", ["refund", "receipt_reversal"])
                ->get()
            as $w
        ) {
            $rows[] = [
                "id" => "correction-" . $w->id,
                "deal_id" => (string) $w->deal_id,
                "currency" => $deals[$w->deal_id]->currency,
                "amount" => $this->crm->decimal(-$this->crm->cents($w->amount)),
                "paid_date" => substr($w->reviewed_at, 0, 10),
                "name" => $w->kind . " #" . $w->id,
            ];
        }
        return ["data" => $rows];
    }
    public function backupStatus(Request $r)
    {
        abort_unless($r->user()->role === "super_admin", 403);
        $files = glob(storage_path("app/crm-backups/*.zip")) ?: [];
        usort($files, fn($a, $b) => filemtime($b) <=> filemtime($a));
        $last = $files[0] ?? null;
        return [
            "latest" => $last
                ? [
                    "name" => basename($last),
                    "created_at" => date(DATE_ATOM, filemtime($last)),
                    "bytes" => filesize($last),
                ]
                : null,
            "scheduler_last_seen" => \Illuminate\Support\Facades\Cache::get(
                "crm.scheduler_seen",
            ),
            "schedule_timezone" => config("app.timezone"),
            "backup_time" => "02:00",
        ];
    }
    public function backup(Request $r)
    {
        abort_unless($r->user()->role === "super_admin", 403);
        try {
            $exit = \Illuminate\Support\Facades\Artisan::call("crm:backup");
            abort_unless($exit === 0, 500, "Backup failed.");
        } catch (\Throwable $e) {
            report($e);
            abort(
                500,
                "Backup failed. Check the configured MySQL tools and private storage.",
            );
        }
        return $this->backupStatus($r);
    }
    public function requests(Request $r)
    {
        $this->crm->authorize("deals", $r->user());
        $ids = $this->access->query("deals", $r->user())->pluck("id");
        $q = app(\App\Services\AuthorizedData::class)->workflows(DB::table("workflow_requests")->whereIn("deal_id", $ids), $r->user());
        if (
            !app(\App\Services\PermissionPolicy::class)->enabled() && !in_array($r->user()->role, [
                "super_admin",
                "management",
                "finance",
            ])
        ) {
            $q->where("requested_by", $r->user()->id);
        }
        return [
            "data" => $q
                ->orderByDesc("id")
                ->limit(250)
                ->get()
                ->map(function ($w) {
                    $w->deal = DB::table("deals")
                        ->where("id", $w->deal_id)
                        ->value("name");
                    $w->requester = DB::table("users")
                        ->where("id", $w->requested_by)
                        ->value("name");
                    $w->reviewer = $w->reviewed_by
                        ? DB::table("users")
                            ->where("id", $w->reviewed_by)
                            ->value("name")
                        : null;
                    return $w;
                }),
        ];
    }
    public function request(Request $r)
    {
        return response()->json(
            ["data" => $this->work->request($r->all(), $r->user())],
            201,
        );
    }
    public function review(Request $r, int $id)
    {
        return ["data" => $this->work->review($id, $r->all(), $r->user())];
    }
    public function collections(Request $r)
    {
        return ["data" => $this->work->collections($r->user())];
    }
    public function collectionNote(Request $r)
    {
        $this->work->financeUser($r->user(), 'collections.assign');
        $v = $r->validate([
            "payment_schedule_id" =>
                "required|integer|exists:payment_schedules,id",
            "assigned_user_id" => "required|integer|exists:users,id",
            "note" => "required|string|min:3|max:5000",
            "next_follow_up" => "nullable|date_format:Y-m-d",
        ]);
        $this->access->check(
            "payment_schedules",
            $v["payment_schedule_id"],
            $r->user(),
        );
        $recipient = User::findOrFail($v["assigned_user_id"]);
        $this->crm->authorize("payment_schedules", $recipient);
        $this->access->check(
            "payment_schedules",
            $v["payment_schedule_id"],
            $recipient,
        );
        $v["created_by"] = $r->user()->id;
        $v["created_at"] = now();
        $v["updated_at"] = now();
        $id = DB::table("collection_notes")->insertGetId($v);
        $this->crm->audit(
            "collection_notes",
            $id,
            "create",
            $r->user()->id,
            null,
            $v,
        );
        return response()->json(["id" => $id], 201);
    }
    public function timeline(Request $r, string $resource, int $id)
    {
        abort_unless(in_array($resource, ["clients", "deals"]), 404);
        $this->crm->authorize($resource, $r->user());
        $this->access->check($resource, $id, $r->user());
        $dealIds =
            $resource === "deals"
                ? collect([$id])
                : $this->access
                    ->query("deals", $r->user())
                    ->where("client_id", $id)
                    ->pluck("id");
        $events = [];
        foreach (config("crm.resources") as $name => $config) {
            try {
                $this->crm->authorize($name, $r->user());
            } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
                continue;
            }
            $q = $this->access->query($name, $r->user());
            $fields = $config["fields"];
            if ($name === "deals") {
                $q->whereIn("id", $dealIds);
            } elseif (isset($fields["deal_id"])) {
                $q->where(function ($q) use (
                    $resource,
                    $id,
                    $dealIds,
                    $fields,
                ) {
                    $q->whereIn("deal_id", $dealIds);
                    if (
                        $resource === "clients" &&
                        isset($fields["client_id"])
                    ) {
                        $q->orWhere("client_id", $id);
                    }
                });
            } elseif ($name === "payments") {
                $q->whereIn(
                    "payment_schedule_id",
                    DB::table("payment_schedules")
                        ->whereIn("deal_id", $dealIds)
                        ->pluck("id"),
                );
            } elseif ($name === "messages") {
                $q->whereIn(
                    "channel_id",
                    DB::table("channels")
                        ->whereIn("deal_id", $dealIds)
                        ->pluck("id"),
                );
            } elseif ($resource === "clients" && isset($fields["client_id"])) {
                $q->where("client_id", $id);
            } else {
                continue;
            }
            foreach ($q->get() as $row) {
                $events[] = [
                    "id" => $row->id,
                    "resource" => $name,
                    "name" => $row->name,
                    "at" => $row->updated_at,
                    "status" => $row->status ?? "saved",
                    "deal_id" => $row->deal_id ?? null,
                ];
            }
        }
        $w = app(\App\Services\AuthorizedData::class)->workflows(DB::table("workflow_requests")->whereIn("deal_id", $dealIds), $r->user());
        if (
            !app(\App\Services\PermissionPolicy::class)->enabled() && !in_array($r->user()->role, [
                "super_admin",
                "management",
                "finance",
            ])
        ) {
            $w->where("requested_by", $r->user()->id)->whereIn("kind", [
                "discount",
                "payment_terms",
                "commission_rate",
            ]);
        }
        foreach ($w->get() as $row) {
            $events[] = [
                "id" => $row->id,
                "resource" => "workflow_requests",
                "name" =>
                    str_replace("_", " ", $row->kind) . " request #" . $row->id,
                "at" => $row->updated_at,
                "status" => $row->status,
            ];
        }
        if (
            app(\App\Services\PermissionPolicy::class)->enabled() ? app(\App\Services\PermissionPolicy::class)->allows('collections.view', $r->user()) : in_array($r->user()->role, ["super_admin", "management", "finance"])
        ) {
            foreach (
                app(\App\Services\AuthorizedData::class)->auxiliary('collection_notes', $r->user())
                    ->whereIn(
                        "payment_schedule_id",
                        DB::table("payment_schedules")
                            ->whereIn("deal_id", $dealIds)
                            ->pluck("id"),
                    )
                    ->get()
                as $row
            ) {
                $events[] = [
                    "id" => $row->id,
                    "resource" => "collection_notes",
                    "name" => $row->note,
                    "at" => $row->updated_at,
                    "status" => "recorded",
                ];
            }
        }
        usort($events, fn($a, $b) => strcmp($b["at"], $a["at"]));
        return ["data" => $events];
    }
    public function audit(Request $r)
    {
        app(\App\Services\PermissionPolicy::class)->authorize('audit.view', $r->user());
        $v = $r->validate([
            "resource" => "nullable|string|max:80",
            "actor" => "nullable|integer",
            "record" => "nullable|integer",
            "page" => "nullable|integer|min:1",
        ]);
        $q = app(\App\Services\AuthorizedData::class)->audit(DB::table("audit_logs"), $r->user())
            ->leftJoin("users", "users.id", "=", "audit_logs.user_id")
            ->select("audit_logs.*", "users.name as actor");
        if (app(\App\Services\PermissionPolicy::class)->enabled() && $r->user()->role !== 'super_admin') $q->select('audit_logs.id', 'resource', 'record_id', 'action', 'audit_logs.created_at', 'users.name as actor');
        if ($r->user()->role !== "super_admin") {
            $q->whereNotIn("resource", ["users", "employees", "security"]);
        }
        foreach (
            [
                "resource" => "resource",
                "actor" => "audit_logs.user_id",
                "record" => "record_id",
            ]
            as $k => $col
        ) {
            if (!empty($v[$k])) {
                $q->where($col, $v[$k]);
            }
        }
        return $q->orderByDesc("audit_logs.id")->paginate(30);
    }
    public function expenses(Request $r)
    {
        $this->work->financeUser($r->user(), 'expenses.view');
        return [
            "data" => app(\App\Services\AuthorizedData::class)->auxiliary('expenses', $r->user())
                ->whereIn(
                    "exhibition_id",
                    $this->access
                        ->query("exhibitions", $r->user())
                        ->pluck("id"),
                )
                ->orderByDesc("id")
                ->get(),
        ];
    }
    public function expense(Request $r)
    {
        $this->work->financeUser($r->user(), 'expenses.create');
        $v = $r->validate([
            "exhibition_id" => "required|integer|exists:exhibitions,id",
            "name" => "required|string|max:255",
            "category" => [
                "required",
                Rule::in([
                    "venue",
                    "marketing",
                    "operations",
                    "staff",
                    "other",
                ]),
            ],
            "amount" =>
                "required|numeric|min:0.01|decimal:0,2|max:9999999999999.99",
            "currency" => [
                "required",
                Rule::in(["EGP", "USD", "EUR", "SAR", "AED"]),
            ],
            "expense_date" => "required|date_format:Y-m-d",
            "reference" => "required|string|max:255|unique:expenses,reference",
        ]);
        $this->access->check("exhibitions", $v["exhibition_id"], $r->user());
        $v["created_by"] = $r->user()->id;
        $v["created_at"] = now();
        $v["updated_at"] = now();
        $id = DB::table("expenses")->insertGetId($v);
        $this->crm->audit("expenses", $id, "create", $r->user()->id, null, $v);
        return response()->json(["id" => $id], 201);
    }
    public function profitability(Request $r)
    {
        $this->work->financeUser($r->user(), 'profitability.view');
        $rows = [];
        foreach (
            $this->access->query("exhibitions", $r->user())->get()
            as $expo
        ) {
            $deals = $this->access
                ->query("deals", $r->user())
                ->where("exhibition_id", $expo->id)
                ->get();
            $expenses = app(\App\Services\AuthorizedData::class)->auxiliary('expenses', $r->user())
                ->where("exhibition_id", $expo->id)
                ->get();
            foreach (
                $deals
                    ->pluck("currency")
                    ->merge($expenses->pluck("currency"))
                    ->unique()
                as $currency
            ) {
                $sales = 0;
                $cash = 0;
                $commissions = 0;
                foreach ($deals->where("currency", $currency) as $d) {
                    if ($d->status === "closed_won") {
                        $sales +=
                            $this->crm->cents($d->amount) -
                            $this->work->credit($d->id);
                    }
                    $cash += $this->work->received($d->id);
                    if ($d->status === "closed_won") {
                        $commissions +=
                            $this->crm->cents(
                                DB::table("commissions")
                                    ->where("deal_id", $d->id)
                                    ->sum("amount"),
                            ) -
                            $this->work->approved(
                                "commission_recovery",
                                $d->id,
                            );
                    }
                }
                $cost = $this->crm->cents(
                    $expenses->where("currency", $currency)->sum("amount"),
                );
                $rows[] = [
                    "id" => $expo->id . "-" . $currency,
                    "exhibition_id" => $expo->id,
                    "exhibition" => $expo->name,
                    "currency" => $currency,
                    "sales" => $this->crm->decimal($sales),
                    "collections" => $this->crm->decimal($cash),
                    "expenses" => $this->crm->decimal($cost),
                    "commissions" => $this->crm->decimal($commissions),
                    "contribution" => $this->crm->decimal(
                        $sales - $cost - $commissions,
                    ),
                ];
            }
        }
        return [
            "data" => $rows,
            "basis" =>
                "Operational contribution: net won sales minus recorded expenses and generated commissions. Not statutory accounting profit.",
        ];
    }
    public function reminders(Request $r)
    {
        return [
            "data" => app(\App\Services\AuthorizedData::class)->pointers(DB::table('reminders'), 'reminders', $r->user())
                ->when(
                    !app(\App\Services\PermissionPolicy::class)->allows('reminders.manage_all', $r->user()),
                    fn($q) => $q->where("created_by", $r->user()->id),
                )
                ->orderByDesc("id")
                ->limit(250)
                ->get(),
        ];
    }
    public function reminder(Request $r)
    {
        $v = $r->validate([
            "resource" => [
                "required",
                Rule::in([
                    "tasks",
                    "meetings",
                    "proposals",
                    "payment_schedules",
                ]),
            ],
            "record_id" => "required|integer",
            "user_id" => "required|integer|exists:users,id",
            "name" => "required|string|max:255",
            "send_at" => "required|date|after_or_equal:now",
            "channel" => ["required", Rule::in(["in_app", "email"])],
        ]);
        $this->crm->authorize($v["resource"], $r->user());
        $this->access->check($v["resource"], $v["record_id"], $r->user());
        $u = User::findOrFail($v["user_id"]);
        $this->crm->authorize($v["resource"], $u);
        $this->access->check($v["resource"], $v["record_id"], $u);
        abort_unless($u->status === "active", 422);
        if ($v["channel"] === "email") {
            abort_unless(
                !in_array(config("mail.default"), ["log", "array"]),
                422,
                "Configure a real email transport before scheduling email.",
            );
        }
        $v["send_at"] = \Carbon\Carbon::parse($v["send_at"])->utc();
        $v["created_by"] = $r->user()->id;
        $v["created_at"] = now();
        $v["updated_at"] = now();
        $id = DB::table("reminders")->insertGetId($v);
        return response()->json(["id" => $id], 201);
    }
    public function cancelReminder(Request $r, int $id)
    {
        return DB::transaction(function () use ($r, $id) {
            $row = DB::table("reminders")
                ->where("id", $id)
                ->lockForUpdate()
                ->first();
            abort_unless($row, 404);
            if (app(\App\Services\PermissionPolicy::class)->enabled()) {
                $this->crm->authorize($row->resource, $r->user());
                $this->access->check($row->resource, $row->record_id, $r->user());
            }
            abort_unless(
                $row->created_by === $r->user()->id ||
                    app(\App\Services\PermissionPolicy::class)->allows('reminders.manage_all', $r->user()),
                403,
            );
            abort_unless(
                in_array($row->status, ["pending", "failed"]),
                422,
                "Only undelivered reminders can be cancelled.",
            );
            DB::table("reminders")
                ->where("id", $id)
                ->update(["status" => "cancelled", "updated_at" => now()]);
            $this->crm->audit(
                "reminders",
                $id,
                "cancel",
                $r->user()->id,
                $row,
                ["status" => "cancelled"],
            );
            return ["cancelled" => true];
        });
    }
    public function runReminders(Request $r)
    {
        abort_unless($r->user()->role === "super_admin", 403);
        return $this->work->dispatchReminders();
    }
    public function reservation(Request $r, int $id)
    {
        $this->crm->operation('booths', 'reserve', $r->user());
        $v = $r->validate(["expires_at" => "required|date|after:now"]);
        return DB::transaction(function () use ($r, $id, $v) {
            $d = DB::table("deals")->where("id", $id)->lockForUpdate()->first();
            abort_unless($d, 404);
            $this->access->check("deals", $id, $r->user());
            abort_unless(
                $d->type === "booth" &&
                    !in_array($d->status, [
                        "closed_won",
                        "closed_lost",
                        "cancelled",
                    ]),
                422,
                "Only open booth deals can expire.",
            );
            $after = [
                "reservation_expires_at" => \Carbon\Carbon::parse(
                    $v["expires_at"],
                )->utc(),
                "updated_at" => now(),
            ];
            DB::table("deals")->where("id", $id)->update($after);
            $this->crm->audit(
                "deals",
                $id,
                "reservation",
                $r->user()->id,
                $d,
                $after,
            );
            return ["saved" => true];
        });
    }
    public function floorplan(Request $r)
    {
        $this->crm->authorize("booths", $r->user());
        return [
            "data" => DB::table("booth_layouts")
                ->whereIn(
                    "booth_id",
                    $this->access->query("booths", $r->user())->pluck("id"),
                )
                ->get(),
        ];
    }
    public function layout(Request $r)
    {
        $this->crm->operation('booths', 'layout.edit', $r->user());
        $v = $r->validate([
            "booth_id" => "required|integer|exists:booths,id",
            "x" => "required|integer|min:0|max:950",
            "y" => "required|integer|min:0|max:550",
            "width" => "required|integer|min:30|max:400",
            "height" => "required|integer|min:30|max:400",
        ]);
        $this->access->check("booths", $v["booth_id"], $r->user());
        abort_if(
            $v["x"] + $v["width"] > 1000 || $v["y"] + $v["height"] > 600,
            422,
            "Booth must fit inside the 1000 × 600 floor plan.",
        );
        $old = DB::table("booth_layouts")
            ->where("booth_id", $v["booth_id"])
            ->first();
        DB::table("booth_layouts")->updateOrInsert(
            ["booth_id" => $v["booth_id"]],
            [
                ...$v,
                "created_by" => $old->created_by ?? $r->user()->id,
                "created_at" => $old->created_at ?? now(),
                "updated_at" => now(),
            ],
        );
        $after = DB::table("booth_layouts")
            ->where("booth_id", $v["booth_id"])
            ->first();
        $this->crm->audit(
            "booth_layouts",
            $after->id,
            "layout",
            $r->user()->id,
            $old,
            $after,
        );
        return ["saved" => true];
    }
    public function accessSettings(Request $r)
    {
        abort_unless($r->user()->role === "super_admin", 403);
        return [
            "users" => DB::table("users")->get([
                "id",
                "name",
                "role",
                "record_scope",
                "team_id",
            ]),
            "teams" => DB::table("teams")->get(),
        ];
    }
    public function setAccess(Request $r, int $id)
    {
        abort_unless($r->user()->role === "super_admin", 403);
        abort_if(app(\App\Services\PermissionPolicy::class)->enabled(), 409, 'Use the confirmed authorization editor to change record scope or team.');
        $v = $r->validate([
            "record_scope" => ["required", Rule::in(["all", "own", "team"])],
            "team_id" => "nullable|integer|exists:teams,id",
        ]);
        if ($v["record_scope"] === "team") {
            abort_unless(!empty($v["team_id"]), 422, "Select a team.");
        }
        $before = DB::table("users")->find($id);
        abort_unless($before, 404);
        abort_if(
            in_array($before->role, ["super_admin", "management"]) &&
                $v["record_scope"] !== "all",
            422,
            "Administrators and management retain organization-wide review access.",
        );
        DB::transaction(function () use ($id, $v, $r) {
            $before = DB::table('users')->where('id', $id)->lockForUpdate()->first();
            abort_unless($before, 404);
            abort_if(in_array($before->role, ['super_admin', 'management']) && $v['record_scope'] !== 'all', 422,
                'Administrators and management retain organization-wide review access.');
            DB::table('users')->where('id', $id)->update($v);
            if ($before->record_scope !== $v['record_scope'] || $before->team_id != ($v['team_id'] ?? null)) {
                app(\App\Services\SessionRevocation::class)->revoke($id);
            }
            $this->crm->audit('users', $id, 'scope', $r->user()->id, $before, $v);
        });
        return ["saved" => true];
    }
    public function team(Request $r)
    {
        abort_unless($r->user()->role === "super_admin", 403);
        $v = $r->validate([
            "name" => "required|string|max:100|unique:teams,name",
        ]);
        return response()->json(
            [
                "id" => DB::table("teams")->insertGetId([
                    ...$v,
                    "created_at" => now(),
                    "updated_at" => now(),
                ]),
            ],
            201,
        );
    }
}
