<?php

namespace App\Services;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\{Crypt, DB, Validator};

class ExhibitorReadiness
{
    public function gate(): void
    {
        abort_unless(config('b2b.readiness_enabled'), 503, 'Operational readiness is unavailable.');
    }

    public function staff(int $event, string $permission, $user): void
    {
        $this->gate();
        $access = app(B2BAccess::class);
        $access->authorize('readiness.view', $user);
        $access->authorize('readiness.'.$permission, $user);
        $access->event($event, $user);
        app(PermissionPolicy::class)->authorize('exhibitions.view', $user);
    }

    public function deals(int $event, ?Builder $scope = null): Builder
    {
        return ($scope ?? DB::table('deals'))->where('deals.exhibition_id', $event)
            ->where('deals.type', 'booth')->where('deals.status', 'closed_won')
            ->whereIn('deals.booth_id', DB::table('booths')->where('exhibition_id', $event)->where('status', 'sold')->select('id'));
    }

    public function staffDeals(int $event, $user): Builder
    {
        $policy = app(PermissionPolicy::class);
        foreach (['deals.view', 'booths.view', 'clients.view'] as $permission) {
            $policy->authorize($permission, $user);
        }
        $records = app(RecordAccess::class);
        return $this->deals($event, $records->query('deals', $user))
            ->whereIn('deals.booth_id', $records->query('booths', $user)->select('id'))
            ->whereIn('deals.client_id', $records->query('clients', $user)->select('id'));
    }

    public function requirements(int $event): Builder
    {
        return DB::table('readiness_requirements')->where('exhibition_id', $event)->orderBy('display_order')->orderBy('id');
    }

    public function configure(int $event, array $input): int
    {
        $data = Validator::make($input, [
            'id' => 'sometimes|integer|min:1', 'version' => 'required|integer|min:0',
            'title_en' => 'required|string|max:200', 'title_ar' => 'nullable|string|max:200',
            'description_en' => 'nullable|string|max:1000', 'description_ar' => 'nullable|string|max:1000',
            'type' => 'required|in:information,document,organizer_approval', 'required' => 'required|boolean',
            'due_date' => 'nullable|date_format:Y-m-d', 'display_order' => 'required|integer|min:0|max:10000',
            'active' => 'required|boolean',
        ])->validate();
        return DB::transaction(function () use ($event, $data) {
            DB::table('exhibitions')->where('id', $event)->lockForUpdate()->first();
            $id = $data['id'] ?? null;
            $version = (int) $data['version'];
            unset($data['id'], $data['version']);
            if (!$id) {
                abort_unless($version === 0, 409);
                abort_if($this->requirements($event)->count() >= 100, 422, 'The exhibition checklist limit is 100 requirements.');
                return DB::table('readiness_requirements')->insertGetId([...$data, 'exhibition_id' => $event, 'created_at' => now(), 'updated_at' => now()]);
            }
            $query = $this->requirements($event)->where('id', $id);
            $old = $query->lockForUpdate()->first();
            abort_unless($old, 404);
            abort_unless($old->version === $version, 409, 'The requirement changed. Refresh first.');
            if (DB::table('readiness_results')->where('requirement_id', $id)->exists()) {
                foreach (array_diff_key($data, array_flip(['active', 'display_order'])) as $field => $value) {
                    abort_if($old->$field != $value, 422, 'Archive the used requirement and add a new one to change its terms.');
                }
            }
            $query->update([...$data, 'version' => $version + 1, 'updated_at' => now()]);
            return $id;
        }, 3);
    }

    public function projection(object $deal, bool $staff = false): array
    {
        $booth = DB::table('booths')->where('id', $deal->booth_id)->where('exhibition_id', $deal->exhibition_id)->first(['name', 'hall', 'size_sqm']);
        $results = DB::table('readiness_results')->where('deal_id', $deal->id)
            ->where('client_id', $deal->client_id)->where('booth_id', $deal->booth_id)->get()->keyBy('requirement_id');
        $items = $this->requirements($deal->exhibition_id)->get()
            ->filter(fn ($requirement) => $requirement->active || ($staff && $results->has($requirement->id)))->values()
            ->map(function ($requirement) use ($results, $staff) {
            $result = $results->get($requirement->id);
            $status = $result->status ?? ($requirement->type === 'information' ? 'awaiting_information' : 'not_started');
            $item = [...(array) $requirement, 'requirement_version' => $requirement->version,
                'status' => $status, 'version' => $result->version ?? 0,
                'feedback' => $result?->feedback ? Crypt::decryptString($result->feedback) : null,
                'response' => $result?->response ? Crypt::decryptString($result->response) : null];
            if ($staff && $result) {
                $item['history'] = DB::table('readiness_history')->where('result_id', $result->id)->orderByDesc('version')->limit(50)->get()
                    ->map(fn ($entry) => [...(array) $entry, 'details' => json_decode(Crypt::decryptString($entry->details), true)]);
            }
            return $item;
        });
        $active = $items->filter(fn ($item) => $item['active']);
        $applicable = $active->where('status', '!=', 'not_applicable');
        $completed = $applicable->where('status', 'approved')->count();
        $review = $applicable->whereIn('status', ['submitted', 'under_review'])->count();
        $status = $active->isEmpty() ? 'not_configured' : ($applicable->isEmpty() ? 'not_applicable'
            : ($applicable->where('required', true)->where('status', '!=', 'approved')->isEmpty() ? 'ready' : 'pending'));
        $output = compact('booth', 'items', 'status', 'completed', 'review') + [
            'applicable' => $applicable->count(), 'pending' => $applicable->count() - $completed,
        ];
        if ($staff) {
            $output['deal_id'] = $deal->id;
            $output['client_id'] = $deal->client_id;
            $output['booth_id'] = $deal->booth_id;
            $output['client'] = DB::table('clients')->where('id', $deal->client_id)->value('name');
            $output['handover'] = DB::table('readiness_handovers')->where('deal_id', $deal->id)
                ->where('client_id', $deal->client_id)->where('booth_id', $deal->booth_id)->first();
            if ($output['handover']?->note) {
                $output['handover']->note = Crypt::decryptString($output['handover']->note);
            }
        }
        return $output;
    }

    public function portal(object $participant, object $membership, ?array $input = null, int $page = 1): array
    {
        $this->gate();
        abort_unless($participant->kind === 'exhibitor', 403);
        $query = $this->deals($participant->exhibition_id)->where('deals.id', $participant->deal_id)
            ->where('deals.client_id', $participant->client_id);
        $deal = ($input === null ? $query : $query->lockForUpdate())->first();
        abort_unless($deal, 403, 'Confirmed booth participation is required.');
        if ($input !== null) {
            return $this->transition($deal, $input, null, $membership->id);
        }
        $view = $this->projection($deal);
        $view['last_page'] = max(1, (int) ceil($view['items']->count() / 5));
        $view['items'] = $view['items']->forPage($page, 5)->values();
        return $view;
    }

    /** The caller holds the confirmed deal lock throughout the change. */
    public function transition(object $deal, array $input, ?int $employee, ?string $membership = null): array
    {
        $data = Validator::make($input, [
            'requirement_id' => 'required|integer|min:1', 'requirement_version' => 'required|integer|min:1',
            'version' => 'required|integer|min:0', 'response' => $employee ? 'prohibited' : 'required|string|max:1000',
            'action' => $employee ? 'required|in:review,approve,request_changes,not_applicable' : 'prohibited',
            'reason' => $employee ? 'required|string|max:2000' : 'prohibited',
            'feedback' => $employee ? 'required_if:action,request_changes|nullable|string|max:500' : 'prohibited',
        ])->validate();
        $requirement = $this->requirements($deal->exhibition_id)->where('id', $data['requirement_id'])
            ->where('active', true)->lockForUpdate()->first();
        abort_unless($requirement, 404);
        abort_unless($requirement->version === (int) $data['requirement_version'], 409, 'The requirement changed. Refresh first.');
        $query = DB::table('readiness_results')->where('deal_id', $deal->id)->where('requirement_id', $requirement->id);
        $old = $query->lockForUpdate()->first();
        abort_if($old && ($old->client_id !== $deal->client_id || $old->booth_id !== $deal->booth_id), 409, 'The commercial allocation changed. The organizer must reconcile the historical record.');
        $version = $old->version ?? 0;
        $previous = $old->status ?? ($requirement->type === 'information' ? 'awaiting_information' : 'not_started');
        abort_unless($version === (int) $data['version'], 409, 'The readiness result changed. Refresh first.');
        $status = match ($data['action'] ?? 'submit') {
            'submit' => $requirement->type === 'information' && in_array($previous, ['awaiting_information', 'changes_requested'], true) ? 'submitted' : null,
            'review' => $previous === 'submitted' ? 'under_review' : null,
            'approve' => ($requirement->type === 'information' && in_array($previous, ['submitted', 'under_review'], true)) ||
                ($requirement->type === 'organizer_approval' && $previous === 'not_started') ? 'approved' : null,
            'request_changes' => in_array($previous, ['submitted', 'under_review'], true) ? 'changes_requested' : null,
            'not_applicable' => !in_array($previous, ['approved', 'not_applicable'], true) ? 'not_applicable' : null,
        };
        abort_unless($status, 422, 'This readiness transition is unavailable.');
        $record = ['status' => $status, 'version' => $version + 1, 'updated_at' => now()];
        if (!$employee) {
            $record['response'] = Crypt::encryptString($data['response']);
        }
        $record['feedback'] = $status === 'changes_requested' ? Crypt::encryptString($data['feedback']) : null;
        if ($old) {
            $query->update($record);
            $id = $old->id;
        } else {
            $id = DB::table('readiness_results')->insertGetId($record + [
                'deal_id' => $deal->id, 'requirement_id' => $requirement->id, 'client_id' => $deal->client_id,
                'booth_id' => $deal->booth_id, 'created_at' => now(),
            ]);
        }
        DB::table('readiness_history')->insert([
            'result_id' => $id, 'employee_id' => $employee, 'membership_id' => $membership,
            'version' => $version + 1, 'previous_status' => $previous, 'status' => $status,
            'details' => Crypt::encryptString(json_encode(array_intersect_key($data, array_flip(['response', 'reason', 'feedback'])), JSON_THROW_ON_ERROR)),
            'created_at' => now(),
        ]);
        return ['id' => $id, 'status' => $status, 'version' => $version + 1];
    }
}
