<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class AuthorizedData
{
    public function __construct(private PermissionPolicy $policy, private RecordAccess $records) {}

    public function auxiliary(string $resource, $user)
    {
        $q = DB::table($resource);
        if (!$this->policy->enabled() || $user->role === 'super_admin') return $q;
        return match ($resource) {
            'workflow_requests' => $this->workflows($q->whereIn('deal_id', $this->records->query('deals', $user)->select('id')), $user),
            'collection_notes' => $q->whereIn('payment_schedule_id', $this->records->query('payment_schedules', $user)->select('id')),
            'expenses' => $this->records->query('expenses', $user),
            'booth_layouts' => $q->whereIn('booth_id', $this->records->query('booths', $user)->select('id')),
            default => $q->whereRaw('1 = 0'),
        };
    }

    public function workflows($q, $user)
    {
        if (!$this->policy->enabled() || $user->role === 'super_admin') return $q;
        if (!$this->policy->allows('workflow.view', $user)) return $q->whereRaw('1 = 0');
        $kinds = array_values(array_filter(WorkflowService::KINDS, fn ($kind) => $this->policy->allows('workflow.'.$kind.'.view', $user)));
        $q->whereIn('kind', $kinds);
        if (!$this->policy->allows('workflow.manage_all.view', $user)) $q->where('requested_by', $user->id);
        return $q;
    }

    /** Scope polymorphic pointers before returning their name, payload, count or existence. */
    public function pointers($q, string $table, $user)
    {
        if (!$this->policy->enabled() || $user->role === 'super_admin') return $q;
        return $q->where(function ($q) use ($table, $user) {
            $q->whereRaw('1 = 0');
            foreach (array_keys(config('crm.resources')) as $resource) {
                if (in_array($resource, ['users', 'employees']) && $table === 'audit_logs') continue;
                if (!$this->policy->allows($resource.'.view', $user)) continue;
                $q->orWhere(fn ($r) => $r->where($table.'.resource', $resource)->whereIn($table.'.record_id', $this->records->query($resource, $user)->select('id')));
            }
            foreach (['workflow_requests' => 'workflow.view', 'expenses' => 'expenses.view', 'collection_notes' => 'collections.view', 'booth_layouts' => 'booths.view'] as $resource => $permission) {
                if (!$this->policy->allows($permission, $user)) continue;
                $q->orWhere(fn ($r) => $r->where($table.'.resource', $resource)->whereIn($table.'.record_id', $this->auxiliary($resource, $user)->select('id')));
            }
        });
    }

    public function audit($q, $user)
    {
        return $this->pointers($q, 'audit_logs', $user);
    }
}
