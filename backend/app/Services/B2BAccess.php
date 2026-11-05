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
        $ids=$this->events($user);
        abort_unless(($ids===null || in_array($id,$ids,true)) && DB::table('exhibitions')->where('id', $id)->exists(), 404);
    }

    /** New-domain access never inherits legacy unscoped compatibility access. */
    public function events($user): ?array
    {
        if ($user->role==='super_admin' || (bool)($user->all_exhibitions??false)) { return null; }
        return DB::table('exhibition_user')->where('user_id',$user->id)->pluck('exhibition_id')->map(fn($id)=>(int)$id)->all();
    }

    public function participants($user)
    {
        $q = DB::table('b2b_participants');
        if (!$this->policy->allows('b2b.view', $user)) { return $q->whereRaw('1=0'); }
        $events = $this->events($user);
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
        return $this->checkedEligibility($p,$curated,$lock,null);
    }

    /** Bounded read-only projection; sensitive mutations always re-check locked sources. */
    public function eligibleMany(iterable $participants,bool $curated=true): array
    {
        $rows=collect($participants);abort_if($rows->count()>100,422,'Eligibility projection batch is too large.');
        $sources=['intakes'=>DB::table('intake_submissions')->whereIn('id',$rows->pluck('intake_submission_id')->filter()->unique())->get()->keyBy('id'),
            'deals'=>DB::table('deals')->whereIn('id',$rows->pluck('deal_id')->filter()->unique())->get()->keyBy('id')];
        $result=[];foreach($rows as $p)$result[$p->id]=$this->checkedEligibility($p,$curated,false,$sources);return $result;
    }

    private function checkedEligibility(object $p,bool $curated,bool $lock,?array $sources):bool
    {
        if ($p->status !== 'active' || !$p->consent_evidence) { return false; }
        if ($p->kind === 'buyer') {
            $q = DB::table('intake_submissions')->where('id', $p->intake_submission_id);
            if ($lock) { $q->lockForUpdate(); }
            $s = $sources===null?$q->first():($sources['intakes'][$p->intake_submission_id]??null);
            return $s && $s->type === 'buyer' && $s->status === 'verified' && !$s->withdrawn_at && !$s->redacted_at
                && $s->buyer_organization_id == $p->buyer_organization_id && $s->exhibition_id == $p->exhibition_id;
        }
        $q = DB::table('deals')->where('id', $p->deal_id);
        if ($lock) { $q->lockForUpdate(); }
        $d = $sources===null?$q->first():($sources['deals'][$p->deal_id]??null);
        return $d && $d->type === 'booth' && $d->status === 'closed_won' && $d->client_id == $p->client_id
            && $d->exhibition_id == $p->exhibition_id && $p->commercial_evidence
            && (!$curated || ($p->qualification === 'approved' && $p->approved_profile_version == $p->profile_version));
    }
}
