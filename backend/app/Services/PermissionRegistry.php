<?php

namespace App\Services;

class PermissionRegistry
{
    public const ROLES = ['super_admin', 'management', 'sales', 'finance', 'operations', 'hr', 'support'];
    private const LEGACY_RESOURCES = ['clients','exhibitions','booths','sponsorship_packages','deals','payment_schedules','payments','invoices','commissions','proposals','tasks','meetings','employees','documents','tickets','channels','messages','users'];

    public function all(): array
    {
        $registry = [];
        foreach (config('crm.resources') as $resource => $config) {
            foreach (['view', 'create', 'edit', 'delete', 'export'] as $action) {
                $roles = [];
                foreach (self::ROLES as $role) {
                    if (!in_array($resource, self::LEGACY_RESOURCES, true)) continue;
                    $write = !in_array($action, ['view', 'export']);
                    if ($role === 'super_admin' || ($role === 'management' && !in_array($resource, ['users', 'employees']))
                        || in_array($resource, ($write ? CrmService::WRITE : CrmService::READ)[$role] ?? [])) $roles[] = $role;
                }
                $registry[$resource.'.'.$action] = $this->entry($config['title'], ucfirst($action), $roles, $resource === 'users' && !in_array($action, ['view', 'export']));
            }
        }
        $definitions = [
            'dashboard.view' => ['Overview', 'View dashboard', self::ROLES],
            'advanced.view' => ['Overview', 'View advanced workspace', ['super_admin', 'management']],
            'dashboard.export' => ['Overview', 'Export dashboard', self::ROLES],
            'dashboard.financial_view' => ['Overview', 'View financial totals', ['super_admin', 'management', 'finance', 'sales']],
            'finance.view' => ['Finance', 'View finance report', ['super_admin', 'management', 'finance']],
            'finance.export' => ['Finance', 'Export finance report', ['super_admin', 'management', 'finance']],
            'profitability.view' => ['Finance', 'View exhibition contribution', ['super_admin', 'management', 'finance']],
            'profitability.export' => ['Finance', 'Export exhibition contribution', ['super_admin', 'management', 'finance']],
            'expenses.view' => ['Finance', 'View expenses', ['super_admin', 'management', 'finance']],
            'expenses.create' => ['Finance', 'Record expenses', ['super_admin', 'management', 'finance']],
            'collections.view' => ['Finance', 'View collections', ['super_admin', 'management', 'finance']],
            'collections.assign' => ['Finance', 'Assign collection follow-up', ['super_admin', 'management', 'finance']],
            'collections.export' => ['Finance', 'Export collections', ['super_admin', 'management', 'finance']],
            'audit.view' => ['Administration', 'View authorized audit history', ['super_admin', 'management']],
            'audit.export' => ['Administration', 'Export authorized audit history', ['super_admin', 'management']],
            'reminders.view' => ['Operations', 'View reminders', self::ROLES],
            'reminders.create' => ['Operations', 'Schedule reminders', self::ROLES],
            'reminders.cancel' => ['Operations', 'Cancel permitted reminders', self::ROLES],
            'reminders.manage_all' => ['Operations', 'Manage others’ reminders', ['super_admin', 'management']],
            'organization.records.view' => ['Operations', 'View owned unscoped internal work', self::ROLES],
            'financial.fields.view' => ['Finance', 'View financial fields in authorized records', ['super_admin', 'management', 'sales', 'finance', 'operations', 'support']],
            'workflow.manage_all.view' => ['Approvals', 'View others’ permitted requests', ['super_admin', 'management', 'finance']],
            'clients.shared.edit' => ['Clients', 'Change contacts shared with other exhibitions', ['super_admin']],
            'users.manage' => ['Administration', 'Manage staff accounts', ['super_admin'], true],
            'users.sensitive.view' => ['Administration', 'View private staff account fields', ['super_admin'], true],
            'permissions.manage' => ['Administration', 'Manage permission overrides', ['super_admin'], true],
            'exhibitions.manage_access' => ['Administration', 'Manage exhibition memberships', ['super_admin'], true],
            'system.settings' => ['Administration', 'Manage system settings', ['super_admin'], true],
            'system.diagnostics' => ['Administration', 'View global diagnostics', ['super_admin'], true],
            'system.backup' => ['Administration', 'Run and inspect backups', ['super_admin'], true],
            'system.reminders' => ['Administration', 'Run reminder dispatcher', ['super_admin'], true],
        ];
        foreach ($definitions as $key => $definition) $registry[$key] = $this->entry(...$definition);
        foreach (['upload', 'download', 'delete'] as $action) {
            $roles = $registry['documents.'.($action === 'download' ? 'view' : 'edit')]['roles'];
            $registry['documents.attachments.'.$action] = $this->entry('Documents', ucfirst($action).' private attachments', $roles);
        }
        foreach (['booths.layout.edit', 'booths.reserve'] as $key) $registry[$key] = $this->entry('Booths', $key === 'booths.reserve' ? 'Set reservation expiry' : 'Position booths', $registry['booths.edit']['roles']);
        $registry['clients.import'] = $this->entry('Clients', 'Import clients', $registry['clients.create']['roles']);
        $registry['deals.pricing.edit'] = $this->entry('Deals', 'Change deal pricing and rates', $registry['deals.edit']['roles']);
        foreach (['deals', 'booths', 'sponsorship_packages', ...config('authorization.standalone_resources')] as $resource) {
            $registry[$resource.'.reassign'] = $this->entry(config('crm.resources.'.$resource.'.title'), 'Change exhibition ownership', $registry[$resource.'.edit']['roles']);
        }
        foreach (['approve', 'pay'] as $action) $registry['commissions.'.$action] = $this->entry('Commissions', ucfirst($action).' commissions', $registry['commissions.edit']['roles']);
        foreach (['view', 'edit'] as $action) $registry['employees.salary.'.$action] = $this->entry('HR & Team', ucfirst($action).' salary fields', $registry['employees.'.$action]['roles']);
        foreach (WorkflowService::KINDS as $kind) {
            $financial = in_array($kind, ['refund', 'receipt_reversal', 'credit_note', 'commission_recovery']);
            $registry['workflow.'.$kind.'.request'] = $this->entry('Approvals', 'Request '.str_replace('_', ' ', $kind), $financial ? ['super_admin', 'management', 'finance'] : ['super_admin', 'management', 'sales']);
            $registry['workflow.'.$kind.'.view'] = $this->entry('Approvals', 'View '.str_replace('_', ' ', $kind), $financial ? ['super_admin', 'management', 'finance'] : $registry['deals.view']['roles']);
            $registry['workflow.'.$kind.'.approve'] = $this->entry('Approvals', 'Review '.str_replace('_', ' ', $kind), ['super_admin', 'management']);
        }
        $registry['workflow.view'] = $this->entry('Approvals', 'View permitted approval requests', $registry['deals.view']['roles']);
        foreach (['payments.delete', 'invoices.delete', 'commissions.delete', 'commissions.create'] as $key) {
            $registry[$key]['unavailable_reason'] = str_ends_with($key, '.delete') ? 'Financial records require reviewed corrections and cannot be deleted.' : 'Commissions are generated by deals and cannot be created manually.';
        }
        $registry['payments.edit']['unavailable_reason'] = 'Receipts are immutable. Request a reversal and record a corrected receipt.';
        return $registry;
    }

    private function entry(string $group, string $label, array $roles, bool $protected = false): array
    {
        return compact('group', 'label', 'roles', 'protected');
    }
}
