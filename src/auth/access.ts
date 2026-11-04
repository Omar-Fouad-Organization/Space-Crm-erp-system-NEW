export interface PermissionDecision { allowed: boolean; source: string; reason: string }
export interface AuthorizationContract {
  enabled: boolean; scoped: boolean; compatibility_mode: boolean; all_exhibitions: boolean;
  exhibition_ids: number[] | null; permissions: Record<string, PermissionDecision>;
}
export const workflowPermissions: Record<string, string | null> = {
  collections: 'collections.view', approvals: 'workflow.view', floorplan: 'booths.view',
  profitability: 'profitability.view', imports: 'clients.import', audit: 'audit.view',
  reminders: 'reminders.view', access: 'permissions.manage', security: null,
};
const routePermissions: Record<string, string | null> = {
  b2b:'b2b.view', submissions:'submissions.view', buyers:'buyers.view', visitors:'visitors.view', 'registration-controls':'registrations.configure', 'registration-delivery':'registrations.deliveries',
  website: 'website.view',
  dashboard: 'dashboard.view', clients: 'clients.view', expos: 'exhibitions.view',
  booths: 'booths.view', deals: 'deals.view', finance: 'finance.view', commissions: 'commissions.view',
  tasks: 'tasks.view', tickets: 'tickets.view', users: 'users.manage', sponsorship: 'sponsorship_packages.view',
  exhibitors: 'deals.view', payments: 'payments.view', proposals: 'proposals.view', meetings: 'meetings.view',
  hr: 'employees.view', contracts: 'documents.view', chat: 'channels.view', analytics: 'deals.view',
  advanced: 'advanced.view', settings: 'system.settings', 'user-testing': 'system.diagnostics',
  performance: 'system.diagnostics', design: 'system.settings', 'modern-delete': 'system.settings',
  notifications: null, profile: null, search: null, help: null, workspace: null,
};
export function routePermission(path: string): string | null {
  if (path.startsWith('/b2b/')) {
    const section=path.split('/')[2];
    return ({qualification:'b2b.qualifications.review',matches:'b2b.matches.view',scheduler:'b2b.meetings.view',results:'b2b.results.view'} as Record<string,string>)[section]||'b2b.view';
  }
  const root = path.split('/').filter(Boolean)[0] || 'dashboard';
  return routePermissions[root] ?? null;
}
export function permitted(contract: AuthorizationContract | null, permission: string): boolean {
  return contract?.permissions[permission]?.allowed === true;
}
export function exportSource(name: string): {resource?: string; report?: string} {
  const reports: Record<string, string> = {dashboard: 'dashboard', collections: 'collections', 'exhibition-profitability': 'profitability', 'pipeline-analytics': 'pipeline'};
  if (reports[name]) return {report: reports[name]};
  if (name.startsWith('finance-')) return {report: 'finance'};
  return {resource: ({'installment-register': 'payment_schedules', 'commission-register': 'commissions'} as Record<string,string>)[name] || name};
}
