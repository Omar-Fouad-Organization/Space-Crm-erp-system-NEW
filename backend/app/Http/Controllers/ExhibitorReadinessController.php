<?php

namespace App\Http\Controllers;

use App\Services\ExhibitorReadiness;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\{Crypt, DB};

class ExhibitorReadinessController extends Controller
{
    public function index(Request $request, int $event, ExhibitorReadiness $readiness): array
    {
        $user = $request->user();
        $readiness->staff($event, 'view', $user);
        $filters = $request->validate([
            'search' => 'nullable|string|max:100', 'status' => 'nullable|in:not_configured,not_applicable,ready,pending',
            'item_status' => 'nullable|in:not_started,awaiting_information,submitted,under_review,changes_requested,approved,not_applicable',
            'due' => 'nullable|date_format:Y-m-d',
        ]);
        $query = $readiness->staffDeals($event, $user);
        if (!empty($filters['search'])) {
            $term = '%'.$filters['search'].'%';
            $query->where(function ($search) use ($term) {
                $search->whereIn('deals.client_id', DB::table('clients')->where('name', 'like', $term)->select('id'))
                    ->orWhereIn('deals.booth_id', DB::table('booths')->where('name', 'like', $term)->select('id'));
            });
        }
        $matches = [];
        $total = 0;
        $page = max(1, min(10000, $request->integer('page', 1)));
        foreach ($query->orderBy('deals.id')->cursor() as $deal) {
            $row = $readiness->projection($deal, true);
            if (!empty($filters['status']) && $row['status'] !== $filters['status']) {
                continue;
            }
            $items = $row['items']->filter(fn ($item) =>
                (empty($filters['item_status']) || $item['status'] === $filters['item_status']) &&
                (empty($filters['due']) || ($item['due_date'] && $item['due_date'] <= $filters['due'])));
            if ((!empty($filters['item_status']) || !empty($filters['due'])) && $items->isEmpty()) {
                continue;
            }
            $total++;
            if ($total > ($page - 1) * 20 && count($matches) < 20) {
                $matches[] = $row;
            }
        }
        return ['requirements' => $readiness->requirements($event)->get(), 'data' => $matches, 'total' => $total, 'page' => $page];
    }

    public function configure(Request $request, int $event, ExhibitorReadiness $readiness): array
    {
        $readiness->staff($event, 'configure', $request->user());
        return ['id' => $readiness->configure($event, $request->all())];
    }

    public function review(Request $request, int $event, int $deal, ExhibitorReadiness $readiness): array
    {
        $user = $request->user();
        $readiness->staff($event, 'review', $user);
        return DB::transaction(function () use ($readiness, $event, $deal, $user, $request) {
            $record = $readiness->staffDeals($event, $user)->where('deals.id', $deal)->lockForUpdate()->first();
            abort_unless($record, 404);
            return $readiness->transition($record, $request->all(), $user->id);
        }, 3);
    }

    public function handover(Request $request, int $event, int $deal, ExhibitorReadiness $readiness): array
    {
        $user = $request->user();
        $readiness->staff($event, 'handover', $user);
        $data = $request->validate(['booth_id' => 'required|integer|min:1', 'client_id' => 'required|integer|min:1', 'note' => 'nullable|string|max:2000']);
        return DB::transaction(function () use ($readiness, $event, $deal, $user, $data) {
            $record = $readiness->staffDeals($event, $user)->where('deals.id', $deal)->lockForUpdate()->first();
            abort_unless($record, 404);
            abort_unless((int) $data['booth_id'] === $record->booth_id && (int) $data['client_id'] === $record->client_id, 409, 'The booth allocation changed. Refresh first.');
            DB::table('booths')->where('id', $record->booth_id)->lockForUpdate()->first();
            $prior = DB::table('readiness_handovers')->where('deal_id', $deal)
                ->orWhere('booth_id', $record->booth_id)->lockForUpdate()->first();
            if ($prior) {
                abort_unless($prior->deal_id === $deal && $prior->booth_id === $record->booth_id && $prior->client_id === $record->client_id, 409, 'A different handover is already recorded.');
                return ['id' => $prior->id, 'created_at' => $prior->created_at];
            }
            $at = now();
            $id = DB::table('readiness_handovers')->insertGetId([
                'deal_id' => $deal, 'booth_id' => $record->booth_id, 'client_id' => $record->client_id, 'exhibition_id' => $event,
                'employee_id' => $user->id, 'note' => empty($data['note']) ? null : Crypt::encryptString($data['note']), 'created_at' => $at,
            ]);
            return ['id' => $id, 'created_at' => $at];
        }, 3);
    }
}
