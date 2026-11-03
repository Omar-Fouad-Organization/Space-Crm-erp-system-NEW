<?php

namespace App\Http\Middleware;

use App\Services\PermissionPolicy;
use Closure;
use Illuminate\Http\Request;

class AuthorizeOperation
{
    public function handle(Request $request, Closure $next)
    {
        $policy = app(PermissionPolicy::class);
        if (!$policy->enabled()) return $next($request);
        $method = $request->route()->getActionMethod();
        $controller = class_basename($request->route()->getControllerClass());
        $permission = null;
        if ($controller === 'CrmController') {
            $permission = match ($method) {
                'index', 'show' => $request->route('resource').'.view',
                'store' => $request->route('resource').'.create', 'update' => $request->route('resource') === 'commissions' ? null : $request->route('resource').'.edit',
                'destroy' => $request->route('resource').'.delete', 'dashboard' => 'dashboard.view',
                'exhibitors' => 'deals.view', 'audit' => 'audit.view', 'settings' => 'system.settings',
                'diagnostics' => 'system.diagnostics', 'upload' => 'documents.attachments.upload',
                'download' => 'documents.attachments.download', 'deleteAttachment' => 'documents.attachments.delete',
                'metadata', 'notifications', 'readAllNotifications', 'readNotification' => null,
                default => 'unregistered.operation',
            };
        } elseif ($controller === 'WorkspaceController') {
            $permission = match ($method) {
                'finance', 'cashMovements' => 'finance.view', 'profitability' => 'profitability.view',
                'expenses' => 'expenses.view', 'expense' => 'expenses.create',
                'collections' => 'collections.view', 'collectionNote' => 'collections.assign',
                'requests' => 'workflow.view', 'audit' => 'audit.view',
                'floorplan' => 'booths.view', 'layout' => 'booths.layout.edit', 'reservation' => 'booths.reserve',
                'reminders' => 'reminders.view', 'reminder' => 'reminders.create', 'cancelReminder' => 'reminders.cancel',
                'runReminders' => 'system.reminders', 'backup', 'backupStatus' => 'system.backup',
                'accessSettings', 'setAccess', 'team' => 'permissions.manage',
                'timeline' => $request->route('resource').'.view', 'search', 'request', 'review' => null,
                default => 'unregistered.operation',
            };
        } elseif ($controller === 'ImportController') $permission = 'clients.import';
        elseif (!in_array($controller, ['SecurityController', 'AuthorizationController', 'ExportController', 'WebsiteCmsController'])) $permission = 'unregistered.operation';
        if ($permission) $policy->authorize($permission, $request->user());
        if ($controller === 'CrmController' && $request->route('resource') === 'users'
            && in_array($method, ['store', 'update', 'destroy'])) app(\App\Services\PrivilegeConfirmation::class)->confirm($request);
        if (!in_array($controller, ['SecurityController', 'AuthorizationController', 'ExportController', 'WebsiteCmsController'])) {
            foreach (['exhibition_id' => 'exhibitions', 'deal_id' => 'deals', 'client_id' => 'clients', 'booth_id' => 'booths',
                'sponsorship_package_id' => 'sponsorship_packages', 'payment_schedule_id' => 'payment_schedules', 'payment_id' => 'payments',
                'commission_id' => 'commissions', 'channel_id' => 'channels'] as $field => $resource) {
                $id = $request->input($field);
                if ((is_int($id) || is_string($id)) && ctype_digit((string) $id) && (int) $id > 0) {
                    $policy->authorize($resource.'.view', $request->user());
                    app(\App\Services\RecordAccess::class)->check($resource, (int) $id, $request->user());
                }
            }
        }
        return $next($request);
    }
}
