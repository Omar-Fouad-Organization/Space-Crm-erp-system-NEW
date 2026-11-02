<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

class ExhibitionAccess
{
    public function __construct(private PermissionPolicy $policy) {}

    private function events($query, string $column, $user)
    {
        $ids = $this->policy->exhibitionIds($user);
        return $ids === null ? $query : $query->whereIn($column, $ids);
    }

    public function deals($user)
    {
        return $this->events(DB::table('deals'), 'exhibition_id', $user);
    }

    public function clientParticipation($user = null)
    {
        $query = DB::table('deals')->whereNotNull('client_id');
        if ($user) $this->events($query, 'exhibition_id', $user);
        $query->select('client_id');
        foreach (['tasks', 'meetings', 'documents', 'tickets'] as $resource) {
            $part = DB::table($resource)->whereNotNull('client_id')->whereNotNull('exhibition_id');
            if ($user) $this->events($part, 'exhibition_id', $user);
            $query->union($part->select('client_id'));
        }
        return $query;
    }

    public function apply($query, string $resource, $user)
    {
        if (!$this->policy->scoped($user)) return $query;
        if (in_array($resource, ['users', 'employees'], true)) return $query;
        if ($resource === 'exhibitions') return $this->events($query, 'exhibitions.id', $user);
        if (in_array($resource, ['deals', 'booths', 'sponsorship_packages', 'expenses'])) return $this->events($query, $resource.'.exhibition_id', $user);
        $deals = $this->deals($user)->select('id');
        if ($resource === 'clients') {
            return $query->where(function ($q) use ($user) {
                $q->whereIn('clients.id', $this->clientParticipation($user))
                    ->orWhere(function ($q) use ($user) {
                        $q->whereNotIn('clients.id', $this->clientParticipation())
                            ->whereIn('clients.created_by', $this->policy->owners($user));
                    });
            });
        }
        if (in_array($resource, ['payment_schedules', 'invoices', 'commissions', 'proposals', 'workflow_requests'])) return $query->whereIn($resource.'.deal_id', $deals);
        if (in_array($resource, ['payments', 'collection_notes'])) return $query->whereIn($resource.'.payment_schedule_id', DB::table('payment_schedules')->whereIn('deal_id', $deals)->select('id'));
        if ($resource === 'messages') return $query->whereIn('messages.channel_id', $this->apply(DB::table('channels'), 'channels', $user)->select('id'));
        if ($resource === 'booth_layouts') return $query->whereIn('booth_id', $this->apply(DB::table('booths'), 'booths', $user)->select('id'));
        if (in_array($resource, config('authorization.standalone_resources'), true)) {
            return $query->where(function ($q) use ($resource, $user, $deals) {
                $q->where(function ($q) use ($resource, $user, $deals) {
                    $q->whereNotNull($resource.'.deal_id')->whereIn($resource.'.deal_id', $deals)
                        ->where(function ($q) use ($resource, $user) {
                            $q->whereNull($resource.'.exhibition_id')->orWhere(function ($q) use ($resource, $user) {
                                $this->events($q->whereNotNull($resource.'.exhibition_id'), $resource.'.exhibition_id', $user);
                            });
                        });
                })->orWhere(function ($q) use ($resource, $user) {
                    $this->events($q->whereNull($resource.'.deal_id')->whereNotNull($resource.'.exhibition_id'), $resource.'.exhibition_id', $user);
                });
                if ($this->policy->allows('organization.records.view', $user)) {
                    $q->orWhere(function ($q) use ($resource, $user) {
                        $q->whereNull($resource.'.deal_id')->whereNull($resource.'.exhibition_id');
                        if (isset(config('crm.resources.'.$resource.'.fields')['client_id'])) $q->whereNull($resource.'.client_id');
                        $owners = $this->policy->owners($user);
                        $q->where(function ($q) use ($resource, $owners) {
                            $q->whereIn($resource.'.created_by', $owners);
                            foreach (['assigned_user_id', 'organizer_id'] as $field) {
                                if (isset(config('crm.resources.'.$resource.'.fields')[$field])) $q->orWhereIn($resource.'.'.$field, $owners);
                            }
                        });
                    });
                }
            });
        }
        // Unknown ownership is not an invitation to return all rows.
        return $query->whereRaw('1 = 0');
    }

    public function event(string $resource, $row): ?int
    {
        if (!$row) return null;
        $row = (object) $row;
        if ($resource === 'exhibitions') return isset($row->id) ? (int) $row->id : null;
        if (!empty($row->exhibition_id)) return (int) $row->exhibition_id;
        if (!empty($row->deal_id)) return (int) DB::table('deals')->where('id', $row->deal_id)->value('exhibition_id');
        if ($resource === 'payments') return $this->event('payment_schedules', DB::table('payment_schedules')->find($row->payment_schedule_id));
        if ($resource === 'messages') return $this->event('channels', DB::table('channels')->find($row->channel_id));
        return null;
    }

    public function validateWrite(string $resource, array $data, $before, $user): void
    {
        if (!$this->policy->enabled()) return;
        $after = (object) [...(array) ($before ?? []), ...$data];
        $event = $this->event($resource, $after);
        if ($this->policy->scoped($user)) {
            if ($resource === 'exhibitions' && !$before) abort_unless($user->all_exhibitions, 403, 'Creating exhibitions requires explicit organization-wide exhibition access.');
            if ($event) abort_unless($this->policy->canExhibition($event, $user), 404, 'Record not found.');
            if (!$event && in_array($resource, config('authorization.standalone_resources'), true)) {
                abort_unless($this->policy->allows('organization.records.view', $user) && empty($after->client_id), 422,
                    'Select an exhibition or a deal for client-related work.');
                if ($before) {
                    $owners = $this->policy->owners($user);
                    $owned = in_array($after->created_by ?? null, $owners);
                    foreach (['assigned_user_id','organizer_id'] as $field) $owned = $owned || in_array($after->$field ?? null, $owners);
                    abort_unless($owned, 422, 'Unscoped internal work must belong to you or your team.');
                }
            }
        }
        if ($before && $this->event($resource, $before) !== $event) $this->policy->authorize($resource.'.reassign', $user);
        if (!empty($after->deal_id) && !empty($after->exhibition_id)) {
            abort_unless((int) DB::table('deals')->where('id', $after->deal_id)->value('exhibition_id') === (int) $after->exhibition_id, 422, 'Exhibition and deal must match.');
        }
        if ($event) {
            foreach ($data['attendee_ids'] ?? [] as $attendee) {
                $recipient = User::find($attendee);
                abort_unless($recipient && $recipient->status === 'active' && $this->policy->canExhibition($event, $recipient), 422, 'A meeting attendee cannot access this exhibition.');
            }
            foreach (['salesperson_id', 'assigned_user_id', 'organizer_id', 'manager_id'] as $field) {
                if (!empty($after->$field)) {
                    $recipient = User::find($after->$field);
                    abort_unless($recipient && $recipient->status === 'active' && $this->policy->canExhibition($event, $recipient), 422, 'The assigned staff member cannot access this exhibition.');
                }
            }
        }
        if ($resource === 'clients' && $before && $this->policy->scoped($user) && !$this->policy->allows('clients.shared.edit', $user)) {
            $ids = $this->policy->exhibitionIds($user);
            if ($ids !== null) {
                $outside = DB::table('deals')->where('client_id', $before->id)->whereNotIn('exhibition_id', $ids)->exists();
                foreach (['tasks', 'meetings', 'documents', 'tickets'] as $table) $outside = $outside || DB::table($table)->where('client_id', $before->id)->whereNotNull('exhibition_id')->whereNotIn('exhibition_id', $ids)->exists();
                abort_if($outside, 403, 'Changing a shared contact requires additional permission.');
            }
        }
    }
}
