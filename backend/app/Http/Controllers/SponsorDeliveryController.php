<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\{PermissionPolicy, RecordAccess};
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\{Crypt, DB};

class SponsorDeliveryController extends Controller
{
    private const STATUSES = ['draft', 'pending', 'in_progress', 'submitted', 'changes_requested', 'fulfilled', 'cancelled'];

    private const ACTIONS = [
        'create' => ['draft', null, 'draft'],
        'edit' => ['draft', ['draft'], 'draft'],
        'approve' => ['approve', ['draft'], 'pending'],
        'amend' => ['approve', ['pending', 'in_progress', 'submitted', 'changes_requested', 'fulfilled'], 'pending'],
        'start' => ['progress', ['pending'], 'in_progress'],
        'progress' => ['progress', ['in_progress', 'changes_requested'], 'in_progress'],
        'submit' => ['progress', ['in_progress', 'changes_requested'], 'submitted'],
        'changes' => ['verify', ['submitted'], 'changes_requested'],
        'fulfill' => ['verify', ['submitted'], 'fulfilled'],
        'cancel' => ['approve', ['draft', 'pending', 'in_progress', 'submitted', 'changes_requested'], 'cancelled'],
    ];

    public function __construct(private PermissionPolicy $policy, private RecordAccess $records) {}

    private function deals($user): Builder
    {
        abort_unless(config('sponsor_delivery.enabled'), 503, 'Sponsorship deliverables are disabled.');
        foreach (['sponsor_delivery.view', 'sponsorship_packages.view', 'deals.view', 'clients.view', 'exhibitions.view'] as $permission) {
            $this->policy->authorize($permission, $user);
        }

        return $this->records->query('deals', $user)
            ->whereIn('deals.type', ['sponsor', 'sector_sponsor'])
            ->where('deals.status', 'closed_won')
            ->whereIn('deals.client_id', $this->records->query('clients', $user)->select('clients.id'))
            ->whereIn('deals.exhibition_id', $this->records->query('exhibitions', $user)->select('exhibitions.id'))
            ->where(function ($query) use ($user) {
                $query->whereNull('deals.sponsorship_package_id')->orWhereIn('deals.sponsorship_package_id',
                    $this->records->query('sponsorship_packages', $user)->select('sponsorship_packages.id')
                        ->whereColumn('sponsorship_packages.exhibition_id', 'deals.exhibition_id'));
            });
    }

    private function items($deal): Builder
    {
        return DB::table('sponsor_deliverables')->where('deal_id', $deal->id)
            ->where('exhibition_id', $deal->exhibition_id)->where('client_id', $deal->client_id);
    }

    public function index(Request $request): array
    {
        $query = $this->deals($request->user());
        $filters = $request->validate([
            'exhibition' => 'nullable|integer|min:1', 'deal' => 'nullable|integer|min:1',
            'sponsor' => 'nullable|string|max:100', 'employee' => 'nullable|integer|min:1',
            'status' => 'nullable|in:'.implode(',', self::STATUSES), 'due' => 'nullable|date_format:Y-m-d',
        ]);
        foreach (['exhibition' => 'exhibition_id', 'deal' => 'id'] as $filter => $column) {
            if (isset($filters[$filter])) $query->where('deals.'.$column, $filters[$filter]);
        }
        if (isset($filters['sponsor'])) {
            $query->whereIn('deals.client_id', DB::table('clients')->where('name', 'like', '%'.$filters['sponsor'].'%')->select('id'));
        }
        if (isset($filters['employee']) || isset($filters['status']) || isset($filters['due'])) {
            $query->whereExists(function ($subquery) use ($filters) {
                $subquery->from('sponsor_deliverables')->selectRaw('1');
                foreach (['deal_id' => 'id', 'exhibition_id' => 'exhibition_id', 'client_id' => 'client_id'] as $item => $deal) {
                    $subquery->whereColumn('sponsor_deliverables.'.$item, 'deals.'.$deal);
                }
                if (isset($filters['employee'])) $subquery->where('assigned_user_id', $filters['employee']);
                if (isset($filters['status'])) $subquery->where('status', $filters['status']);
                if (isset($filters['due'])) $subquery->where('due_date', '<=', $filters['due']);
            });
        }

        return $query->orderByDesc('deals.id')->paginate(20, ['deals.id', 'deals.name', 'deals.status', 'deals.type',
            'deals.client_id', 'deals.exhibition_id', 'deals.sponsorship_package_id'])->through(function ($deal) {
            $items = $this->items($deal)->get(['status', 'required', 'due_date', 'approved_at', 'assigned_user_id', 'updated_at']);
            $approved = $items->whereNotNull('approved_at');
            $outstanding = $approved->whereNotIn('status', ['fulfilled', 'cancelled']);

            return [
                'id' => $deal->id, 'name' => $deal->name, 'type' => $deal->type, 'commercial_status' => $deal->status,
                'sponsor' => DB::table('clients')->where('id', $deal->client_id)->value('name'),
                'exhibition' => DB::table('exhibitions')->where('id', $deal->exhibition_id)->value('name'),
                'package' => DB::table('sponsorship_packages')->where('id', $deal->sponsorship_package_id)->value('name'),
                'approved' => $approved->count(), 'fulfilled' => $approved->where('status', 'fulfilled')->count(),
                'in_progress' => $outstanding->whereIn('status', ['in_progress', 'submitted', 'changes_requested'])->count(),
                'outstanding' => $outstanding->count(), 'cancelled' => $approved->where('status', 'cancelled')->count(),
                'overdue' => $outstanding->filter(fn ($item) => $item->due_date && $item->due_date < today()->toDateString())->count(),
                'employees' => DB::table('users')->whereIn('id', $items->pluck('assigned_user_id')->unique())->orderBy('name')->pluck('name'),
                'last_update' => $items->max('updated_at'),
                'fulfillment' => match (true) {
                    $items->isEmpty() => 'Deliverables not configured.',
                    $approved->isEmpty() => 'No approved deliverables recorded.',
                    $outstanding->where('required', true)->isNotEmpty() => 'Required commitments outstanding',
                    $outstanding->isNotEmpty() => 'Optional commitments outstanding',
                    $approved->where('status', 'fulfilled')->isEmpty() => 'No active commitments',
                    default => 'Fulfilled',
                },
            ];
        })->toArray();
    }

    public function show(Request $request, int $deal): array
    {
        $user = $request->user();
        $record = $this->deals($user)->find($deal);
        abort_unless($record, 404);
        $documents = $this->policy->allows('documents.view', $user) ? $this->contracts($record, $user)->get(['id', 'name']) : collect();
        $visibleContracts = $documents->pluck('id')->all();
        $items = $this->items($record)->orderByDesc('id')->paginate(20)->through(function ($row) use ($visibleContracts) {
            $row->contract_restricted = $row->document_id !== null && !in_array($row->document_id, $visibleContracts, true);
            if ($row->contract_restricted) unset($row->document_id);
            $row->employee_name = DB::table('users')->where('id', $row->assigned_user_id)->value('name');
            return $row;
        })->toArray();
        $employees = [];
        if ($this->policy->allows('sponsor_delivery.draft', $user) || $this->policy->allows('sponsor_delivery.approve', $user)) {
            $employees = User::where('status', 'active')->orderBy('name')->get()
                ->filter(fn ($employee) => $this->canAssign($record, $employee))->map->only(['id', 'name'])->values();
        }

        return ['items' => $items, 'documents' => $documents, 'employees' => $employees];
    }

    public function history(Request $request, int $deal, int $item): array
    {
        $user = $request->user();
        $record = $this->deals($user)->find($deal);
        abort_unless($record && $this->items($record)->where('id', $item)->exists(), 404);
        $visibleContracts = $this->policy->allows('documents.view', $user)
            ? $this->contracts($record, $user)->pluck('id')->all() : [];

        return DB::table('sponsor_deliverable_events')->where('deliverable_id', $item)->orderByDesc('version')
            ->paginate(20, ['actor_id', 'version', 'action', 'status', 'details', 'created_at'])
            ->through(function ($row) use ($visibleContracts) {
                $row->details = json_decode(Crypt::decryptString($row->details), true, flags: JSON_THROW_ON_ERROR);
                unset($row->details['fingerprint']);
                if (!in_array($row->details['terms']['document_id'] ?? null, $visibleContracts, true)) {
                    unset($row->details['terms']['document_id']);
                }
                return $row;
            })->toArray();
    }

    private function contracts($deal, $user): Builder
    {
        return $this->records->query('documents', $user)->where('deal_id', $deal->id)
            ->where('client_id', $deal->client_id)->where('type', 'contract')->whereIn('status', ['approved', 'signed'])
            ->where(fn ($query) => $query->whereNull('exhibition_id')->orWhere('exhibition_id', $deal->exhibition_id));
    }

    private function canAssign($deal, $employee): bool
    {
        if (!$employee || $employee->status !== 'active' || !$this->policy->allows('sponsor_delivery.progress', $employee)) {
            return false;
        }
        foreach (['sponsor_delivery.view', 'sponsorship_packages.view', 'deals.view', 'clients.view', 'exhibitions.view'] as $permission) {
            if (!$this->policy->allows($permission, $employee)) return false;
        }

        return $this->deals($employee)->where('deals.id', $deal->id)->exists();
    }

    public function command(Request $request, int $deal): array
    {
        $user = $request->user();
        $query = $this->deals($user);
        $input = $request->validate([
            'action' => 'required|in:'.implode(',', array_keys(self::ACTIONS)),
            'id' => 'required_unless:action,create|prohibited_if:action,create|integer|min:1',
            'version' => 'required|integer|min:0', 'request_id' => 'required|uuid',
            'note' => 'required_if:action,progress,submit,changes,fulfill,cancel,amend|nullable|string|max:2000',
        ]);
        $action = $input['action'];
        [$permission, $from, $status] = self::ACTIONS[$action];
        $this->policy->authorize('sponsor_delivery.'.$permission, $user);
        $terms = in_array($action, ['create', 'edit', 'amend'], true) ? $request->validate([
            'title' => 'required|string|max:200', 'description' => 'required|string|max:4000', 'category' => 'nullable|string|max:80',
            'due_date' => 'nullable|date_format:Y-m-d', 'required' => 'required|boolean', 'assigned_user_id' => 'required|integer|min:1',
            'document_id' => 'nullable|integer|min:1',
        ]) + ['category' => null, 'due_date' => null, 'document_id' => null] : [];
        $fingerprint = hash('sha256', json_encode([$input, $terms], JSON_THROW_ON_ERROR));

        return DB::transaction(function () use ($query, $deal, $user, $input, $action, $permission, $from, $status, $terms, $fingerprint) {
            $record = $query->where('deals.id', $deal)->lockForUpdate()->first();
            abort_unless($record, 404);
            $receipt = DB::table('sponsor_deliverable_events')->where([
                'deal_id' => $deal, 'actor_id' => $user->id, 'request_id' => $input['request_id'],
            ])->lockForUpdate()->first();
            if ($receipt) {
                $previous = json_decode(Crypt::decryptString($receipt->details), true, flags: JSON_THROW_ON_ERROR);
                abort_unless($previous['fingerprint'] === $fingerprint
                    && $this->items($record)->where('id', $receipt->deliverable_id)->lockForUpdate()->first(), 409, 'This request has already been used.');
                return ['id' => $receipt->deliverable_id, 'version' => $receipt->version, 'status' => $receipt->status];
            }

            $item = isset($input['id']) ? $this->items($record)->where('id', $input['id'])->lockForUpdate()->first() : null;
            abort_if(isset($input['id']) && !$item, 404);
            abort_unless((int) $input['version'] === ($item->version ?? 0), 409, 'This deliverable changed. Refresh and try again.');
            abort_if($item && !in_array($item->status, $from ?? [], true), 409, 'This action is unavailable in the current status.');
            if ($permission === 'progress') abort_unless((int) $item->assigned_user_id === (int) $user->id, 403);

            $responsible = $terms['assigned_user_id'] ?? $item?->assigned_user_id;
            if ($terms || $action === 'approve') {
                $employee = User::find($responsible);
                abort_unless($this->canAssign($record, $employee), 422, 'Select an active employee with delivery access to this deal.');
                if ($item?->document_id && $terms) {
                    $this->policy->authorize('documents.view', $user);
                    $this->records->check('documents', $item->document_id, $user);
                }
                $document = $terms ? $terms['document_id'] : $item->document_id;
                if ($document) {
                    $this->policy->authorize('documents.view', $user);
                    abort_unless($this->contracts($record, $user)->where('id', $document)->lockForUpdate()->first(), 422, 'Select an approved or signed contract for this deal.');
                }
            }

            $version = ($item->version ?? 0) + 1;
            $now = now();
            $update = $terms + ['status' => $status, 'version' => $version, 'updated_at' => $now];
            if (in_array($action, ['approve', 'amend'], true)) {
                $update += ['approved_by' => $user->id, 'approved_at' => $now];
            }
            if ($item) {
                $id = $item->id;
                $this->items($record)->where('id', $id)->update($update);
            } else {
                $id = DB::table('sponsor_deliverables')->insertGetId($update + [
                    'deal_id' => $deal, 'client_id' => $record->client_id, 'exhibition_id' => $record->exhibition_id,
                    'created_by' => $user->id, 'created_at' => $now,
                ]);
            }
            DB::table('sponsor_deliverable_events')->insert([
                'deliverable_id' => $id, 'deal_id' => $deal, 'actor_id' => $user->id, 'request_id' => $input['request_id'],
                'version' => $version, 'action' => $action, 'status' => $status, 'created_at' => $now,
                'details' => Crypt::encryptString(json_encode([
                    'fingerprint' => $fingerprint, 'note' => $input['note'] ?? null,
                    'terms' => in_array($action, ['create', 'edit', 'approve', 'amend'], true)
                        ? array_intersect_key((array) $this->items($record)->where('id', $id)->lockForUpdate()->first(),
                            array_flip(['title', 'description', 'category', 'assigned_user_id', 'due_date', 'required', 'document_id']))
                        : null,
                ], JSON_THROW_ON_ERROR)),
            ]);

            return ['id' => $id, 'version' => $version, 'status' => $status];
        }, 3);
    }
}
