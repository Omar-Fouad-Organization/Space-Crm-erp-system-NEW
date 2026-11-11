# Phase 9 — B2B follow-up to CRM task integration

2026-11-10. ERP-only increment on existing Draft PR #6. Verified remote/local baseline `069f26e54de947bab246a6bcedf57f2fdc4f63aa`; website baseline `90af7f79c8f1c9efffe43772cc13b22b9594414f` remains unchanged. Prior Phase 7/8 reports were read; only B2B follow-up and CRM task paths were inspected. No merge, deployment, operational activation, dependency change or demo-data edit.

## Existing versus missing

Reused B2B completed-meeting/outcome/attendance history, follow-up owner/date, staff session/CSRF, action/event/record policy, `CrmService::save`, the tasks table, original Tasks page/dialog and existing task lifecycle. Missing: an authoritative meeting/task relationship, explicit creation action and live task progress in B2B. No duplicate CRUD or synchronization engine was needed.

## Data model and behavior

Additive migration `backend/database/migrations/2026_11_09_000002_link_b2b_followup_tasks.php` creates `b2b_followup_tasks`: unique integer meeting ID, unique integer task ID, exhibition ID, linking employee and timestamp. All four foreign keys restrict deletion. No historical records are inferred or backfilled.

`GET/POST /api/b2b/followup-tasks/{id}` reviews/creates one primary follow-up. Creation requires a completed meeting with `followup_required`, current version, explicit title/description/owner/due date/priority and initial `pending` status. Other outcomes remain unchanged and create nothing. Existing follow-up owner/date are suggested only when available and authorized; missing values stay blank. The original task dialog is reused with fixed meeting/exhibition context. It does not copy private notes or suggest a fake client/deal.

The meeting row lock spans validation, existing CRM task creation, link insertion and audit in one transaction. Concurrent/repeated requests return the one existing task; they do not replace its fields or create orphan tasks. A cancelled primary task remains linked and is not silently replaced. Linked-task deletion is rejected by the existing FK error handling; cancellation remains available through existing task CRUD.

Task status is authoritative: B2B operations, results and pending coordination counts read actual permitted tasks. Legacy follow-up fields remain historical, not a synchronized second lifecycle. Refresh/navigation re-reads status; no background worker or circular event handler. Task completion/cancellation does not modify original meeting outcome, version, attendance or publication. Both directions use existing routes: task ID filter on Tasks, exact exhibition/meeting/date context on B2B overview.

## Permissions and privacy

- Creation requires B2B view, buyer visibility, on-site view, meeting view, results management (and its existing results-view dependency), task creation/view and user-directory view for assignment, plus meeting participant record scope and explicit exhibition membership. No new permission grants.
- Assignee must be active, able to read tasks and explicitly belong to the event (or existing organization-wide authority). Assignees need not access B2B results. If client/deal links are requested, both creator and assignee must have access. Only exact originating exhibitor closed-won booth FKs in the same exhibition are accepted; no name/email matching or buyer-as-client assumption. The new UI conservatively leaves both optional commercial links empty; the endpoint supports only the validated exact relationship.
- Linked task event/client/deal context is immutable through ordinary task edits. Assignment changes re-check eligibility, even if the new feature is disabled. Ordinary independent tasks retain their previous behavior.
- Task-only staff get the task without a B2B source reference; direct meeting/follow-up calls remain forbidden. Authorized task and B2B readers see a minimal source reference. Employee names in B2B require user-directory visibility. Results-denied readers receive no new follow-up projection.
- No private qualification, sourcing, consent or encrypted B2B notes are automatically copied. Participant projections/website contracts are unchanged and return no internal tasks, IDs, descriptions, staff details or private follow-up decisions. No leads, deals, clients, payments, invoices, commissions, sponsorships or booth changes are generated.

## Changed files

- Domain/data: `backend/app/Services/B2BFollowupTasks.php`, `CrmService.php`; migration above.
- Routes/read projections: `backend/routes/web.php`, `backend/config/b2b.php`, `backend/app/Http/Controllers/B2BOperationsController.php`, `B2BController.php`.
- Existing ERP UI: `src/b2b/FollowupTask.tsx`, `OnsiteOperations.tsx`, `src/pages/B2BWorkspace.tsx`, `TasksPage.tsx`, `src/components/tasks/CreateTaskDialog.tsx`. Task-only loading respects module metadata; reviewed calendar dates serialize without UTC day shifts. Existing classes, fields, global styles, sidebar and header are preserved; new controls reuse native primitives.
- Tests/CI: `backend/tests/Feature/B2BFollowupTaskTest.php`, `B2BFollowupConcurrencyTest.php`, `backend/tests/Support/B2BFollowupFixture.php`, `create-b2b-followup.php`, `scripts/b2b-followup-ui.test.mjs`, `preserved-erp-source.mjs`, `.github/workflows/erp-tests.yml`. The task-page source guard has a reviewed fixed hash; every previous literal class on the four affected UI files remains checked.

## Actual verification

- Focused Laravel integration + concurrency + unchanged on-site tests: **12 passed / 196 assertions**. Subsequent authoritative count/results refinement: **6 passed / 80 assertions** (overlapping cases, not additional unique tests). Tests cover authorized creation, replay, real simultaneous processes, lifecycle and cancellation, cross-event/unrelated-client/deal rejection, buyer without a CRM client, denied staff/record scopes, assignee privacy, unchanged meeting/financial rows and ordinary task creation/edit/deletion.
- Local final frontend suite **42 passed**, navigation **38 passed**, TypeScript and production build passed. No dependency updates; existing build size/dynamic-import warnings remain.
- Real browser on synthetic-only database `space_crm_phase9_ui_test`: reviewed prefills → explicit create → Open Task → existing Mark Complete → source meeting. Task1/meeting1/event1 retained, due `2027-01-04`, no client/deal association, completed task shown in B2B and pending coordination count0. Eleven protected business/meeting tables are byte-identical; four link FK checks returned zero orphans. [Sanitized evidence](phase9-evidence.json).
- Final full ERP regression/audits run once on the delivered GitHub head. Exact final SHA, Actions URL, Laravel/assertion totals and job conclusions are recorded in [existing Draft PR #6](https://github.com/Omar-Fouad-Organization/Space-Crm-erp-system-NEW/pull/6), avoiding a documentation-only CI rerun. Baseline counts are not represented as new results. Website regression is not repeated: no website code or participant integration contract changed; Draft PR #4 stays untouched.

## Release, rollback and limitations

`B2B_CRM_FOLLOWUP_ENABLED` defaults **false**, behind existing B2B/on-site/granular authorization gates. It was enabled only in disposable tests and this new synthetic preview process. The additive migration ran only in dedicated synthetic databases; existing demo/operational databases were not migrated or modified.

Future authorized release: backup, apply additive schema with the new flag off, deploy code, isolated smoke test, then seek separate activation approval. Previous code tolerates the added table but lacks linked-task context guards: freeze linked-task mutation/deletion before rolling back to it, retain links/tasks/audits and backup. Disabling only the new flag on current code hides the integration while retaining write guards. Do not run `migrate:rollback` on populated links as a normal code rollback; down removes the relationship history. Existing Phase 1–7 rollback precautions still apply.

One primary task per meeting, explicit human creation, manual refresh and conservative empty commercial links in the new dialog are intentional limits. Cancelled tasks can be reviewed using existing task controls; there is no replacement-task workflow. No external service, email campaign, QR flow, FAQ work or unrelated shortcut repair is included. No known unresolved defect remains in the tested Phase 9 workflow; this is not a new full-platform or all-device audit.
