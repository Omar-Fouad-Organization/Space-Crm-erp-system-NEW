<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class PermissionPolicy
{
    private array $overrides = [];
    private array $memberships = [];
    private ?array $registry = null;

    public function enabled(): bool { return (bool) config('authorization.enabled'); }
    public function registry(): array { return $this->registry ??= app(PermissionRegistry::class)->all(); }
    public function scoped($user): bool { return $this->enabled() && $user->role !== 'super_admin' && (bool) ($user->authorization_scoped ?? false); }
    private function key($user): string { return $user->id.':'.($user->auth_version ?? 0); }

    public function overrides($user): array
    {
        if (!$this->enabled()) return [];
        return $this->overrides[$this->key($user)] ??= DB::table('user_permission_overrides')->where('user_id', $user->id)->pluck('allowed', 'permission')->all();
    }

    public function decision(string $permission, $user): array
    {
        $entry = $this->registry()[$permission] ?? null;
        if (!$entry) return ['allowed' => false, 'source' => 'unavailable', 'reason' => 'Unknown or future permission.'];
        if (($entry['feature'] ?? null) === 'website_cms' && (!$this->enabled() || !config('cms_gateway.enabled'))) return ['allowed'=>false,'source'=>'unavailable','reason'=>'Website management requires an approved authorization and CMS activation.'];
        if (($entry['feature'] ?? null) === 'intake' && (!$this->enabled() || !config('intake.enabled'))) return ['allowed'=>false,'source'=>'unavailable','reason'=>'Registration integration is not activated.'];
        if (isset($entry['unavailable_reason'])) return ['allowed'=>false,'source'=>'unavailable','reason'=>$entry['unavailable_reason']];
        if ($user->role === 'super_admin') return ['allowed' => true, 'source' => 'protected', 'reason' => 'Super Admin authority is protected.'];
        if ($entry['protected']) return ['allowed' => false, 'source' => 'protected', 'reason' => 'This security operation requires Super Admin.'];
        $overrides = $this->overrides($user);
        $overridden = array_key_exists($permission, $overrides);
        $allowed = $overridden ? (bool) $overrides[$permission] : in_array($user->role, $entry['roles'], true);
        $source = $overridden ? ($allowed ? 'granted' : 'denied') : 'inherited';
        $reason = $overridden ? ($allowed ? 'Individual grant.' : 'Explicit individual denial.') : ($allowed ? 'Inherited from organizational role.' : 'Not included in organizational role.');
        if ($allowed && $this->enabled()) {
            $dependencies = [];
            if (($entry['feature'] ?? null) === 'intake' && !str_ends_with($permission,'.view')) {
                $family=explode('.',$permission)[0];
                if (in_array($family,['submissions','buyers','visitors'])) $dependencies[]=$family.'.view';
                if ($family==='leads') $dependencies[]='submissions.view';
                if ($permission==='registrations.replay') $dependencies[]='registrations.deliveries';
            }
            if (($entry['feature'] ?? null) === 'website_cms' && $permission !== 'website.view') {
                $dependencies[] = 'website.view';
                if (!str_ends_with($permission, '.view')) $dependencies[] = explode('.', $permission)[0].'.view';
            }
            if (preg_match('/^([a-z_]+)\.(create|edit|delete|export)$/', $permission, $match) && isset(config('crm.resources')[$match[1]])) $dependencies[] = $match[1].'.view';
            if (in_array($permission, ['payments.view', 'payment_schedules.view', 'invoices.view', 'commissions.view', 'finance.view', 'profitability.view', 'expenses.view', 'expenses.create', 'collections.view', 'collections.assign', 'dashboard.financial_view'])) $dependencies[] = 'financial.fields.view';
            if (in_array($permission, ['finance.export', 'profitability.export', 'collections.export', 'dashboard.export', 'audit.export'])) $dependencies[] = str_replace('.export', '.view', $permission);
            if ($permission === 'clients.import') $dependencies[] = 'clients.create';
            if ($permission === 'finance.view') $dependencies = [...$dependencies, 'deals.view', 'payments.view', 'commissions.view'];
            if ($permission === 'profitability.view') $dependencies = [...$dependencies, 'deals.view', 'commissions.view', 'expenses.view'];
            if ($permission === 'collections.view') $dependencies = [...$dependencies, 'payment_schedules.view', 'clients.view', 'deals.view'];
            if ($permission === 'collections.assign') $dependencies[] = 'collections.view';
            if ($permission === 'expenses.create') $dependencies[] = 'expenses.view';
            if ($permission === 'employees.salary.edit') $dependencies[] = 'employees.salary.view';
            if ($permission === 'deals.pricing.edit') $dependencies[] = 'financial.fields.view';
            if (in_array($permission, ['deals.export', 'booths.export', 'exhibitions.export', 'sponsorship_packages.export', 'documents.export'])) $dependencies[] = 'financial.fields.view';
            if ($permission === 'employees.export') $dependencies[] = 'employees.salary.view';
            if (preg_match('/^workflow\.([a-z_]+)\.(request|approve)$/', $permission, $match)) $dependencies = [...$dependencies, 'deals.view', 'workflow.'.$match[1].'.view'];
            if (preg_match('/^workflow\.(refund|receipt_reversal|credit_note|commission_recovery|discount|commission_rate)\.(view|request|approve)$/', $permission)) $dependencies[] = 'financial.fields.view';
            if (str_starts_with($permission, 'documents.attachments.')) $dependencies[] = 'documents.view';
            if (str_starts_with($permission, 'commissions.') && in_array($permission, ['commissions.approve', 'commissions.pay'])) $dependencies[] = 'commissions.view';
            foreach ($dependencies as $dependency) if (!$this->allows($dependency, $user)) return ['allowed' => false, 'source' => $source, 'reason' => 'Requires '.$dependency.'.'];
            if ($permission === 'exhibitions.create' && $this->scoped($user) && !$user->all_exhibitions) return ['allowed' => false, 'source' => $source, 'reason' => 'Requires explicit all-exhibitions access.'];
        }
        return compact('allowed', 'source', 'reason');
    }

    public function allows(string $permission, $user): bool { return $this->decision($permission, $user)['allowed']; }
    public function authorize(string $permission, $user): void { abort_unless($this->allows($permission, $user), 403, 'You do not have permission for this operation.'); }

    public function exhibitionIds($user): ?array
    {
        if (!$this->scoped($user) || $user->all_exhibitions) return null;
        return $this->memberships[$this->key($user)] ??= DB::table('exhibition_user')->where('user_id', $user->id)->pluck('exhibition_id')->map(fn ($id) => (int) $id)->all();
    }

    public function canExhibition(int $id, $user): bool
    {
        $ids = $this->exhibitionIds($user);
        return $ids === null || in_array($id, $ids, true);
    }

    public function owners($user): array
    {
        return ($user->record_scope ?? 'all') === 'team' && $user->team_id
            ? DB::table('users')->where('team_id', $user->team_id)->pluck('id')->all() : [$user->id];
    }

    public function contract($user): array
    {
        $effective = [];
        foreach ($this->registry() as $key => $entry) $effective[$key] = $this->decision($key, $user);
        return ['enabled' => $this->enabled(), 'scoped' => $this->scoped($user),
            'all_exhibitions' => $user->role === 'super_admin' || (bool) ($user->all_exhibitions ?? false),
            'compatibility_mode' => !$this->scoped($user) && $user->role !== 'super_admin',
            'exhibition_ids' => $this->exhibitionIds($user), 'permissions' => $effective];
    }
}
