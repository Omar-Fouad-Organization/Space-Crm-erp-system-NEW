# Phase 2 authorization foundation

Base: verified Phase 1 `76e01be60b8652e288ece4bcbfba890c53267a89`; dependent on draft PR #1. Scope excludes website/CMS/intake/portals/matchmaking and operational migrations. This document starts with the pre-implementation entry-point map and is updated with implementation evidence.

## Pre-implementation authorization map

| Entry point | Existing checks/data path | Required integration |
| --- | --- | --- |
| `CrmController::{metadata,index,show,store,update,destroy}` | Module READ/WRITE arrays; RecordAccess; generic relationship validation | Explicit view/create/edit/delete; scoped metadata/labels; both old and new relationship ownership |
| `CrmController::{upload,download,deleteAttachment}` | Document module + parent record; private local disk | Separate upload/download/delete actions AND scoped parent document |
| `CrmController::{dashboard,exhibitors}` | Role-based financial switch; partial scoped deals; unscoped currency/activity queries | Action-aware totals and activity; derive currencies from allowed rows |
| `CrmController::{audit,notifications,readNotification,readAllNotifications}` | Management audit is global; notifications scoped only by recipient | Scope every referenced record; safe audit projection for non-super-admins |
| `CrmController::{settings,diagnostics}` | Super Admin | Protected organization-wide registry actions |
| `WorkspaceController::{finance,cashMovements,collections,collectionNote,profitability,expenses,expense}` | Finance role gate; deal/installment scope; expense exhibition lookup | Separate report/expense/assignment actions; event AND record scope throughout |
| `WorkspaceController::{requests,request,review,timeline}` and `WorkflowService::{request,review}` | Role gates, deal ownership, distinct reviewer, monetary invariants | Kind-specific request/approval; scoped request details/timeline; retain all monetary rules |
| `WorkspaceController::{search,audit}` | Search mostly scoped; audit payloads global to management | Per-module permission; scoped audit without unrelated private snapshots |
| `WorkspaceController::{floorplan,layout,reservation}` | Booth module and object checks | Separate inventory/layout/reservation actions; event-filter inventory |
| `WorkspaceController::{reminders,reminder,cancelReminder,runReminders}` | Creator/manager list; recipient access at creation | Current event/record access on listing/cancellation; protected dispatcher |
| `WorkflowService::dispatchReminders` | Rechecks active recipient, module, record before delivery | Reuse the central policies at delivery, not stale enqueue-time grants |
| `WorkspaceController::{accessSettings,setAccess,team,backup,backupStatus}` | Super Admin; Phase 1 scope-change revocation | Protected registry actions; password/MFA confirmation for new policy changes; transactional audit/revocation |
| `ImportController::clients` | Client write gate; duplicate lookup and atomic commits | Separate import action; no duplicate-match disclosure outside permitted clients |
| `CrmService::{save,delete,present,primeLabels}` | Generic validation, private fields, financial invariants | Exact CRUD action, sensitive fields, event reassignment, safe labels, shared-client modification rule |
| `RecordAccess` | all/team/own; management/global inventory bypass | Apply event predicate BEFORE existing grouped ownership predicate; inventory remains shared within an allowed event |
| `routes/console.php`, backup and expiry commands | Trusted local scheduled system operations | Document system-principal maintenance; never expose global maintenance through employee grants |
| `SessionController`, `SecurityController`, Phase 1 middleware | Active user, CSRF, MFA, authentication version | Preserve; permission changes increment the same authentication version |
| `AuthContext`, `Sidebar`, `CRMLayout`, permission components, workflow navigation | Mixed role checks and resource metadata; no route-level capability check | One server-derived capability contract; deny direct forbidden routes; keep shell/styles/routes |
| `UsersPage` permissions tab and existing Teams & Access | Static role cards; scope/team settings | Real effective permission/membership editor with inheritance/deny reasons and history |
| CSV buttons and `exportCsv` | Client-side exports of loaded data | Server-authorized managed export actions; scope-check record selections and audit exports |

## Rollout decision and impact on existing users

An environment activation switch defaults off, so unapplied schema cannot silently enable a partial policy for operational users. Additive migrations do not create memberships, infer event grants, or rewrite existing users' roles/business records. After schema verification, the switch enables the permission registry; existing users retain explicitly identified compatibility event scope until a Super Admin enrolls them in restricted mode. Restricted mode requires explicit memberships or an explicit all-exhibitions grant; missing membership denies event-owned records. New accounts created with the feature active start restricted, without implicit event grants. Switching a user requires confirmation, audit and Phase 1 revocation. Production activation/enrollment is separate authorized operational work.

Role defaults are derived from the actual existing READ/WRITE matrix and workflow role gates. Granular overrides are inherit/allow/deny, with deny winning for non-super-admins. Super Admin protection is structural; ordinary staff cannot grant security-administration actions or change their own policy. Future namespaces are reserved names, not live modules or navigation entries.

Global clients remain one record. Existing deals and explicit standalone task/meeting/document/ticket links establish event participation, without creating fake deals. Unlinked clients are visible to their creator/team under an explicit owner-only rule, never to everyone merely because they lack an event. Assigned standalone work can establish ownership visibility for its contact, still ANDed with event access. Shared clients require additional permission for updates that would affect an event outside the actor's access. The staff directory exposes minimal name/status references; full user/security administration remains privileged. HR is an explicit organization-wide domain, still subject to its existing record scope and salary permission.

Ambiguous tasks/meetings/documents/tickets/channels receive optional additive event links for standalone records; deal ownership remains authoritative and conflicting event/deal references are rejected. Unscoped internal work requires an explicit organization-record permission AND ownership; it is not a fallback to unrestricted event access. Existing ambiguous data stays unchanged and must be reviewed before enrollment.

## Implemented policy and data model

**Verified in code and disposable MySQL tests.** `PermissionRegistry` derives defaults from the fixed 18 existing resources in `CrmService::READ/WRITE`, not README descriptions or frontend role labels. The canonical roles remain Super Admin, Management, Sales, Finance, Operations, HR and Support. Existing sales/finance display aliases still map to their canonical backend roles; a display label does not grant manager approval authority. The unsupported client-portal account choice was removed from employee creation; HR was added to that existing selector.

Effective authority is **registered action + its prerequisites + event predicate + existing record predicate + business invariant**. Non-super employees use explicit deny, explicit grant, then role inheritance. Unknown permissions fail closed. Individual grants cannot override a missing prerequisite. Security administration actions are nondelegatable and require an actual active Super Admin. Super Admin cannot be demoted or have authority removed through the exception editor. Immutable financial deletion/manual commission creation remain unavailable even for Super Admin.

The additive migration `backend/database/migrations/2026_11_02_000007_add_granular_authorization.php` adds:

| Entity | Fields / constraints | Ownership |
| --- | --- | --- |
| Existing `users` | `authorization_scoped=false`, `all_exhibitions=false`; no backfill | Existing integer user IDs; Phase 1 `auth_version` retained |
| `user_permission_overrides` | Integer ID; user FK cascade; registry permission; allowed boolean; granting user FK restrict; timestamps; unique(user,permission) | One exception per employee/action |
| `exhibition_user` | Integer ID; user FK cascade; exhibition FK restrict; granting user FK restrict; timestamps; unique(user,exhibition), reverse event/user index | Explicit event membership, no inferred grants |
| Existing tasks/meetings/documents/tickets/channels | Nullable integer exhibition FK restrict | Optional standalone ownership; existing rows retain null |

No UUID mapping, user merging, session replacement, business table copying, or changes to historical migrations occur in this phase. All relationships use the existing ERP integer keys. An event cannot be deleted while referenced by new membership/work links; administrators must review references first.

### Resource ownership paths

| Resources | Exhibition restriction | Record restriction |
| --- | --- | --- |
| Exhibitions | Own ID | Existing shared inventory behavior |
| Deals, booths, packages, expenses | Direct exhibition FK | Existing all/team/own; inventory shared within allowed event |
| Schedules, invoices, commissions, proposals | Deal → exhibition | Existing deal/creator ownership rules |
| Payments | Installment → deal → exhibition | Existing installment/deal ownership |
| Workflow requests | Deal → exhibition | Deal scope + kind.view; requester-only unless manage-all granted |
| Collection notes | Installment → deal → exhibition | Permitted installment |
| Booth layout | Booth → exhibition | Permitted booth |
| Standalone work | Deal when present; otherwise explicit exhibition | Existing creator/assignee/organizer/related-record scope |
| Messages | Channel → deal/explicit event/internal ownership | Existing channel ownership |
| Clients | Union of participating permitted events; unlinked creator/team | Existing deal ownership, creator/team and explicitly assigned standalone work |
| Users | Global minimal directory | Full employee/security fields Super Admin only |
| Employees | Organization-wide HR domain | Existing all/team/own + separate salary capability |
| Attachments | Parent document → event/deal/internal policy | Parent document AND exact attachment action |
| Audit, notifications, reminders | Current referenced resource via scoped subqueries | Recipient/creator/manage-all and current target visibility |

Both predicates apply before list/detail/count/search/report/export output. An `all` record scope does not mean all exhibitions. Explicit all-exhibitions membership does not bypass own/team record scope. Management's historical global bypass is retained only during compatibility; enrolled managers use the selected record scope. No event association is inferred from a client's mere existence. Unknown polymorphic targets, deleted targets and ambiguous old client-related work are hidden from enrolled employees until reviewed. Super Admin retains investigation access.

### Actions, fields and deliberate transitions

- Existing module CRUD defaults remain; view is a prerequisite for mutation/export. Finance reports, expenses, collections, layout editing, reservation expiry, imports, attachments, workflow kinds, commission approval/payment and exports have separate actions.
- `financial.fields.view` controls canonical money fields and known legacy aliases in authorized records. Salary is separately controlled by `employees.salary.view/edit`. Ordinary deal stage edits do not require a pricing-change grant; changed rates/prices do. Decimal equality is normalized with the existing cents conversion.
- Aggregate financial dashboard authority is explicitly separate from access to detailed receipt/commission modules, preserving the existing sales dashboard. Deny `dashboard.financial_view` to suppress those aggregates, or deny `financial.fields.view` to suppress financial data across projections. Finance reports require their financial detail prerequisites.
- Workflow kind views/requests/approvals have prerequisites; sensitive pricing/accounting kinds require financial fields. A grant to review a specific kind permits that reviewed operation through the existing approved-change service path without granting unrelated direct CRUD. Distinct reviewer and accounting validators remain mandatory.
- Shared-client edits across inaccessible events now require `clients.shared.edit` (default Super Admin). This is an intentional tightening, not contact duplication. Normal FK constraints continue preventing deletion of referenced clients.
- Non-super audit is a current-visibility summary, without before/after private snapshots. A later ownership/grant change can hide historical entries. Super Admin retains original full audit. Export audit entries contain type/count only; private exported values are not copied into audit.
- Related labels, exhibitor projections, metadata and client-name search respect denied modules/fields. Assigning work to an inactive employee or someone without the event fails validation.
- Existing maintenance commands remain trusted local system actions. HTTP backups/diagnostics/dispatcher are protected Super Admin operations. Do not run commands with employee-supplied database credentials or treat CLI access as an employee portal.

## APIs and security confirmations

All endpoints remain under the existing session/CSRF/active-user/authentication-version middleware. No service token is exposed to React.

| Endpoint | Contract / protection |
| --- | --- |
| `GET /api/authorization/me` | Current server-defined effective decisions, reasons and memberships |
| `GET /api/authorization/registry` | Super Admin: registry, minimal staff/event/team catalogs, activation status, reserved namespace names |
| `GET /api/authorization/users/{id}` | Super Admin: configuration, effective authority, current epoch, latest 50 access changes |
| `PUT /api/authorization/users/{id}` | Super Admin; 10/min; expected epoch, memberships, explicit all/scoped flags, scope/team, known allow/deny overrides, reason, current password, unused MFA code when enrolled |
| `POST /api/exports/records/{resource}` | Registered export + view; max 1,000 distinct IDs; every selected row scoped; safe presentation + audit |
| `POST /api/exports/report` | Exact existing report export capability; audits managed download authorization |
| Existing staff CRUD | Super Admin; current-password/MFA confirmation (`confirm_password`, `confirm_code`); Phase 1 revocation preserved |
| Existing legacy scope/team write | Returns 409 when active; use confirmed editor rather than bypassing it |

Policy changes lock the actor and target in sorted ID order, recheck active Super Admin/current authentication epoch, check target expected version, verify password and unused TOTP counter, update memberships/overrides/scope, increment Phase 1 epoch and write an audit in one transaction. Concurrent administrators cannot silently overwrite a changed configuration. No-op updates do not revoke or create fake audit history. No self-policy change, Super Admin exception change, unknown/future permission or protected-action override is accepted. Once enrolled, compatibility cannot be restored through the API; use a reviewed explicit all-exhibitions grant instead. Empty arrays remove grants rather than preserving stale rows.

The normal request authorization boundary remains the Phase 1 boundary: a request already authenticated and in flight may finish after a concurrent revocation. Subsequent requests and stale session replays fail. Policy writes additionally revalidate under user-row locks. Long-running workers must reload the user/current policy at execution, as the reminder dispatcher does. Do not reuse a policy object across requests; it is container-scoped and its memoization keys include the authentication epoch.

Managed exports are permission-checked server-side before the existing CSV formatters run. Report CSVs contain already displayed scoped projections. This is not a DRM system: information legitimately displayed before access removal cannot be retracted from a browser or prevented from being copied. Revocation rejects subsequent managed requests. Existing custom CSV layouts remain intact; central CSV output continues formula escaping.

## React changes and interface preservation

The existing shell, sidebar structure, business pages, styles and dialogs remain. The Users → Permissions tab and existing Teams & Access workspace now host one reusable access editor: role inheritance, individual grant/deny, saved effective decision/reason, event membership, all/team/own, confirmation and history. Protected/self policies are disabled with an explanation. Pending settings are distinguished from saved effective access. Password/OTP inputs are cleared and never persisted in local storage or record attributes.

The server capability contract drives sidebar/module links, direct detail routes, permission components, workflow sections and commission approve/pay buttons. A denied direct route renders an access message within the same layout. Backend enforcement is authoritative even if a button remains visible or a request is crafted manually.

Existing task, ticket, meeting, document and channel dialogs gain an optional event selector only when the policy is active and the employee can view exhibitions. It lists permitted events. Deal context remains valid without an extra selection. The existing document edit handler now persists through the existing adapter before updating React state; previously it changed only local state. This is necessary to enforce event reassignment and preserve edits on reload. Commission status updates send canonical status fields instead of irrelevant display-only payment annotations; amounts and receipt calculations remain server-derived.

## Schema-first release and rollback prerequisites

**Not executed against operational data. Separate release authorization is required.**

1. Merge/release decisions for Phase 1 PR #1 remain separate. Verify its authentication-version and tombstone migrations, production PHP/MySQL versions, session driver, backups, private-storage restore and workers first. Keep both PRs draft/unmerged during this review.
2. On a restored isolated copy, inventory ambiguous standalone work, contacts shared across events, role aliases, team memberships and exact employee event requirements. Have business owners approve the membership/action matrix. Do not substitute the synthetic test fixtures for this inventory.
3. Keep `GRANULAR_AUTHORIZATION_ENABLED=false`. Apply only the additive Phase 2 migration using controlled migration tooling after backup/restore rehearsal. Check metadata locks/table sizes and constraints. Historical Phase 1 application compatibility is tested on the expanded disposable schema; runtime infrastructure still needs rehearsal.
4. Deploy Phase 2 code with the switch still false; rebuild React, clear/rebuild config caches and restart persistent workers. Verify the old workflows and private files before activation. Never deploy an enabled new frontend with an old API contract.
5. In an isolated staging environment, enable the switch, test the approved matrix and enroll employees explicitly with the confirmed editor. Existing null event links must be classified through ordinary authorized edits; no blanket SQL backfill. Verify minimal access and business cycles with representatives from each department.
6. Before any operational activation, schedule the enrollment plan and communication; existing accounts remain clearly marked compatibility until enrolled. New active-policy accounts start restricted without events. Verify that no employee requiring restriction remains in compatibility. Revocations require reauthentication after each change.
7. Monitor denied requests, query plans and audit events; verify backups include the new tables, nullable event links and private files. Production CI never uses production databases/credentials.

Migration `down()` is for an unused disposable schema or a separately reviewed restored environment. Do not roll it down after grants are in use: this removes security configuration and event links. A code rollback to Phase 1 is schema-compatible but **loses granular enforcement**, so it is not a safe silent rollback for enrolled employees. If enforcement is defective, restrict staff ingress/put the service into maintenance, preserve security data and audit, and roll forward or restore a complete verified backup under separate authorization. Do not simply disable the feature to make denied requests succeed. Never reset/reseed operational tables.

## Extension contract for Phase 3

Reserved names are `website`, `content`, `seo`, `media`, `submissions`, `buyers`, `visitors`, `hosted_buyers`, `matchmaking`. They grant nothing and create no navigation. A future module must register exact actions/default roles/prerequisites, declare direct or indirect event ownership, apply both query predicates to every route/read/write/export/worker, define safe shared/global semantics, add metadata/field projections and negative tests, and add permitted React links only when an actual page exists. New CRM resources do not automatically inherit Management authority from the historical bypass. External portal identities and website service principals require a separate design; do not reuse staff sessions or merge user tables blindly.

## Verification and runtime limits

Final local/CI results and exact file inventory are recorded below after verification. Tests use the existing guarded disposable `space_crm_test` only; suites run sequentially against one database. The operational preservation script uses a direct read-only transaction and content hashes; it does not bootstrap Laravel or write operational tables. Local operational schema remains unapplied and the activation flag remains unchanged.

Requires runtime verification before release: actual deployed code/schema/session/worker infrastructure; employee/event assignments; legacy ambiguous records; backup restoration; large-dataset query plans (client participation UNIONs, polymorphic pointer queries and existing record-ID lists); browser acceptance of the editor/confirmations with representative staff. Pure frontend navigation tests and a production build do not substitute for that staged browser/UAT exercise. Existing bundle-size/mixed-import warnings are performance follow-ups, not a reason to change frontend dependencies in this phase.

### Security verification matrix

| Boundary | Synthetic verification |
| --- | --- |
| All seven employee roles | Existing module READ inheritance, minimal directory fields, protected security actions |
| Grants and denials | Inherited vs explicit decision, dependency denials, unsupported/protected/future strings rejected, malicious protected DB overrides cannot grant authority |
| Event and record intersection | all/team/own, missing/single/multiple/explicit-all events, same-team staff in another event, list/detail/search/dashboard rejection |
| Indirect relationships | Schedules/receipts/invoices/commissions, channel messages, standalone work, matching deal/event and assignee eligibility |
| Shared/global records | One contact across events; owner-only unlinked contacts; standalone contact follow-up without a fake deal; cross-event shared edits denied; HR payroll isolated |
| Privilege changes | Password confirmation, missing/replayed TOTP, no partial updates, stale administrator version conflict, no-op epoch preservation, no self/Super override, explicit enrollment/no compatibility downgrade |
| Session security | Existing Phase 1 login/MFA/reset/logout/legacy/replay/concurrent revocation suites retained; access changes increment the same epoch and reject old stamps |
| Private data | Foreign document download/delete denied without file removal; sensitive canonical and legacy fields absent; metadata/exhibitor/search/workflow projections respect denials |
| Managed exports | Scoped ID selections, exact export denials, salary/financial prerequisites, report gates |
| Business cycle | Scoped salesperson progresses a deal to won; scoped finance records receipt, rejects overpayment, creates paid invoice; separate approve/pay authority pays the computed commission; booth remains sold |
| Reviewed operations | Specific approval grant without direct edit permission; distinct reviewer and replay prohibition; previous refunds/credits/reversals/rates/terms tests preserved |
| Booth contention | Two independent MySQL processes compete for one booth, both with legacy policy and an enrolled own-scope salesperson; exactly one allocation |
| Maintenance | Recipient's current event/action/record eligibility rechecked at reminder delivery; denied recipients receive no notification |
| Compatibility/schema | Actual audited old application and verified Phase 1 application run against the additive schema; login/client write/default auth epoch and original user columns preserved |
| React | Four Node tests for server capability navigation/direct details, unknown-deny contracts, real workflow sections and exact export mappings; TypeScript and production bundle |

### CI evidence

Final local verification on 2 November 2026: **132 Laravel tests passed / 2,053 assertions**, 229.14 seconds, with `--display-warnings --fail-on-warning`. This includes all previous 96 tests plus new authorization cases and the additional historical-application/concurrency modes. TypeScript passed; Vite production build passed; **4 frontend contract tests passed**. The last small UI review also added readable before/after entries in access history and an accurate no-op confirmation message; final-head CI is linked in the PR description.

After the final isolated suite, the read-only preservation check again found **37 operational tables / 3 private files / zero changes**, matching the pre-implementation full-row/file fingerprints. Evidence remains in ignored `logs/phase-2-before.json`, `logs/phase-2-preservation.json`, and `logs/phase-2-final-results.xml`; no operational values or filenames are included in this report. The local MySQL service/socket interruption during the verification session was resolved without running the application scheduler or any operational migrations/seeds. The website working tree is unchanged. Dependency manifests/lockfiles, original CRM field/business configuration and maintenance schedule are unchanged.

Application/test/workflow commit `f9f66a486954515842cf1b6cc9aab902b1ea761d`:

- [Pull-request run 41521206063](https://github.com/Omar-Fouad-Organization/Space-Crm-erp-system-NEW/actions/runs/41521206063): Laravel **132 passed / 2,053 assertions**, 68.30 seconds; frontend **4 passed / 0 failed**, TypeScript + Vite build passed.
- [Independent push run 41521197607](https://github.com/Omar-Fouad-Organization/Space-Crm-erp-system-NEW/actions/runs/41521197607): both jobs succeeded.
- Each Laravel runner has its own disposable MySQL 8.4 container, synthetic account and generated testing environment. One sequential suite per database, no operational credentials/secrets/seed/deploy steps. The existing test guard verifies both configured and actual database identity before migration hooks. Frontend uses the unchanged lockfile and Node 24; no dependency versions were changed.
- Laravel ran with `--display-warnings --fail-on-warning`; no test warnings/failures/skips. CI infrastructure does emit container initialization/self-signed-certificate warnings and pinned-action Node-runtime deprecation notices. Frontend retains bundle-size/mixed-import and transitive package deprecation warnings. `npm ci` reported **14 moderate dependency advisories** in the existing lockfile; production reachability and remediation require a separate dependency review. Do not interpret a passing build as a dependency-security clearance. No automatic audit fix or framework/frontend upgrade was performed.

Draft [PR #2](https://github.com/Omar-Fouad-Organization/Space-Crm-erp-system-NEW/pull/2) targets `codex/phase-1-erp-security`, explicitly depending on draft PR #1. Published review commits separate backend enforcement, existing React integration and tests/CI. Their Git trees were verified identical to the corresponding local commits before publishing; the connected GitHub account supplied remote commit attribution.

### Recommendation

**Ready for Review**, with enforcement deliberately inactive on operational data. No known current protected endpoint is intentionally left outside the policy; open items are staged runtime/UAT, operational data classification, scale checks and the existing dependency advisories. This is not production deployment approval. Phase 3 can be developed on a separate branch dependent on this foundation after separate authorization and review of the real website contracts. Neither PR has been merged/deployed, the website remains untouched and Phase 3 has not started.

## Exact file inventory

Repository-relative paths; all changes belong to this dependent Phase 2 PR.

- `.github/workflows/erp-tests.yml`
- `backend/app/Http/Controllers/AuthorizationController.php`
- `backend/app/Http/Controllers/CrmController.php`
- `backend/app/Http/Controllers/ExportController.php`
- `backend/app/Http/Controllers/ImportController.php`
- `backend/app/Http/Controllers/WorkspaceController.php`
- `backend/app/Http/Middleware/AuthorizeOperation.php`
- `backend/app/Models/User.php`
- `backend/app/Providers/AppServiceProvider.php`
- `backend/app/Services/AuthorizedData.php`
- `backend/app/Services/CrmService.php`
- `backend/app/Services/ExhibitionAccess.php`
- `backend/app/Services/PermissionPolicy.php`
- `backend/app/Services/PermissionRegistry.php`
- `backend/app/Services/PrivilegeConfirmation.php`
- `backend/app/Services/RecordAccess.php`
- `backend/app/Services/SensitiveFields.php`
- `backend/app/Services/WorkflowService.php`
- `backend/config/authorization.php`
- `backend/database/migrations/2026_11_02_000007_add_granular_authorization.php`
- `backend/routes/web.php`
- `backend/tests/Feature/BoothConcurrencyTest.php`
- `backend/tests/Feature/GranularAuthorizationTest.php`
- `backend/tests/Feature/ReleaseCompatibilityTest.php`
- `scripts/authorization-preservation.php`
- `scripts/authorization-ui.test.mjs`
- `src/auth/access.ts`
- `src/components/auth/PermissionButton.tsx`
- `src/components/auth/PermissionGuard.tsx`
- `src/components/forms/useExhibitionField.tsx`
- `src/components/layout/CRMLayout.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/tasks/CreateTaskDialog.tsx`
- `src/components/tasks/CreateTicketDialog.tsx`
- `src/components/users/AuthorizationPanel.tsx`
- `src/components/users/CreateUserDialog.tsx`
- `src/components/users/usePrivilegeConfirmation.tsx`
- `src/components/workspace/WorkflowLinks.tsx`
- `src/contexts/AuthContext.tsx`
- `src/crm/api.ts`
- `src/pages/BoothsPage.tsx`
- `src/pages/CommissionsPage.tsx`
- `src/pages/DealsPage.tsx`
- `src/pages/Documents.tsx`
- `src/pages/Expos.tsx`
- `src/pages/HR.tsx`
- `src/pages/Meetings.tsx`
- `src/pages/Payments.tsx`
- `src/pages/Sponsorship.tsx`
- `src/pages/UsersPage.tsx`
- `src/pages/WorkflowWorkspace.tsx`
- `src/pages/WorkspacePages.tsx`
- `src/services/laravelClient.ts`
- `src/services/supabaseService.ts`
- `src/types/index.ts`
- `docs/PHASE-2-AUTHORIZATION.md`
