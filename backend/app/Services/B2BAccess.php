<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class B2BAccess
{
    public function __construct(private PermissionPolicy $policy) {}

    public function authorize(string $action, $user): void
    {
        abort_unless(config('b2b.enabled') && $this->policy->enabled(), 503, 'B2B management is not activated.');
        $this->policy->authorize('b2b.view', $user);
        $this->policy->authorize('b2b.'.$action, $user);
    }

    public function event(int $id, $user): void
    {
        abort_unless($this->policy->canExhibition($id, $user) && DB::table('exhibitions')->where('id', $id)->exists(), 404);
    }

    public function participants($user)
    {
        $q = DB::table('b2b_participants');
        if (!$this->policy->allows('b2b.view', $user)) { return $q->whereRaw('1=0'); }
        $events = $this->policy->exhibitionIds($user);
        if ($events !== null) { $q->whereIn('exhibition_id', $events); }
        if (!$this->policy->allows('b2b.buyers.view', $user)) { $q->where('kind', 'exhibitor'); }
        if ($user->role !== 'super_admin' && ($user->record_scope ?? 'all') !== 'all') {
            $owners = $this->policy->owners($user);
            $q->where(fn ($q) => $q->whereIn('assigned_user_id', $owners)->orWhereIn('created_by', $owners));
        }
        return $q;
    }

    public function participant(int $id, $user, bool $lock = false): object
    {
        $q = $this->participants($user)->where('id', $id);
        if ($lock) { $q->lockForUpdate(); }
        $row = $q->first(); abort_unless($row, 404); return $row;
    }

    public function matches($user)
    {
        return DB::table('b2b_matches')->whereIn('buyer_id', $this->participants($user)->select('id'))
            ->whereIn('exhibitor_id', $this->participants($user)->select('id'));
    }

    public function match(int $id, $user, bool $lock = false): object
    {
        $q = $this->matches($user)->where('id', $id);
        if ($lock) { $q->lockForUpdate(); }
        $row = $q->first(); abort_unless($row, 404); return $row;
    }

    public function eligible(object $p, bool $curated = true, bool $lock = false): bool
    {
        if ($p->status !== 'active' || !$p->consent_evidence) { return false; }
        if ($p->kind === 'buyer') {
            $q = DB::table('intake_submissions')->where('id', $p->intake_submission_id);
            if ($lock) { $q->lockForUpdate(); }
            $s = $q->first();
            return $s && $s->type === 'buyer' && $s->status === 'verified' && !$s->withdrawn_at && !$s->redacted_at
                && $s->buyer_organization_id == $p->buyer_organization_id && $s->exhibition_id == $p->exhibition_id;
        }
        $q = DB::table('deals')->where('id', $p->deal_id);
        if ($lock) { $q->lockForUpdate(); }
        $d = $q->first();
        return $d && $d->type === 'booth' && $d->status === 'closed_won' && $d->client_id == $p->client_id
            && $d->exhibition_id == $p->exhibition_id && $p->commercial_evidence
            && (!$curated || ($p->qualification === 'approved' && $p->approved_profile_version == $p->profile_version));
    }
}
