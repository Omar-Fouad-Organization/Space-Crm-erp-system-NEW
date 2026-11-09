# Phase 7 — Hosted Buyers and on-site B2B operations

2026-11-09. Baselines verified against remote Draft PRs: ERP 5765618459978be5504841e2804303b14e4520c6 / PR #6; website abf627d3236ba859169f20438ca6d025fa7153ab / PR #4. Both remain dependent, Draft and unmerged. All records are demo data; no application is publicly deployed. No operational database, infrastructure, dependency, marketing-copy or commercial-price changes.

## Gap analysis before implementation

| Capability | Existing | Partial | Missing / action |
|---|---|---|---|
| Hosted eligibility | Verified buyer participation and consent | Hosted-specific gate | Reuse B2BAccess eligibility |
| Hosted approval | — | — | Separate organizer nomination/review decision |
| Hosted status | — | — | Separate program status, without changing verification |
| Buyer participation | Event-scoped B2B participants | — | Reuse; no duplicate buyer identity |
| On-site operations | Existing scheduler, statuses, audit/version locks | Start/completion metadata | Extend the same meeting |
| Meeting attendance | — | — | Independent party attendance and manual event arrival |
| Rescheduling | Requests, staff review, atomic booking exclusion | Attendance invalidation | Add booking revision; retain original history |
| Meeting outcomes | Encrypted internal notes and follow-up coordination | Structured/public outcome | Explicit separate publication |
| Operations dashboard | B2B workspace and scheduler/results | Arrival-focused information | Add a refresh-based panel in existing overview/scheduler |
| Visitor boundary | Separate registration domain | No verified external QR contract | Manual staff attendance only; no QR service |

## Delivered behavior

Hosted participation uses candidate, approved, rejected, suspended and cancelled states. Nomination/approval requires a currently verified, consenting buyer in the same exhibition. Rejection/cancellation and re-nomination preserve history. Staff actor, timestamp and encrypted reason are recorded. Suspending/cancelling hosted status does not overwrite buyer verification. Approval grants no employee, organization or financial permissions.

Benefits are separately approved organizer classifications with an idempotent request UUID. They create no booking, procurement, reimbursement or financial liability. Only approved, currently eligible hosted participation exposes its approved classifications to that buyer. This is not a benefits fulfillment system.

Meeting attendance is unique per meeting, booking revision and participant. Buyer and exhibitor arrival are independent, use server timestamps and staff identity, and always say staff_manual. A party already recorded as arrived cannot be declared absent. No-show supports buyer, exhibitor or both, retaining the meeting and booking history. Starting requires a current valid mutually accepted booking, both arrivals, the scheduled time and current eligibility. Completion requires an in-progress meeting and one of four outcome codes. Start/completion/no-show and outcome publication use distinct permissions and audited optimistic versions inside transactions. Two concurrent staff completions produce one authoritative result and one 409 response.

The existing scheduler remains authoritative. Rescheduling advances booking_revision and clears current operational metadata; older attendance remains historical rather than applying to the new booking. Existing request review is reused: acknowledge, use the scheduler, then mark coordinated. Slot exclusion and independent invitation decisions remain unchanged. Existing terminal result-note/follow-up edits remain supported; the legacy status endpoint cannot bypass the new lifecycle controls when Phase 7 is enabled.

The existing light B2B workspace now contains Hosted Buyers and On-site meetings views, exhibition/date/status/buyer/exhibitor filters, counts, paginated rows and manual refresh. Held eligibility is excluded from ready counts. There is no assigned meeting coordinator model, so no invented coordinator assignment/filter. Native cards, tables, dialogs, sidebar/header and typography are reused; no global CSS changes. A browser-discovered stale response contract crash when switching sections was corrected with a tested view-key guard.

The existing signed portal gateway returns hosted program status, authorized benefit classifications, own attendance, booking revision/reschedule indicator, start/completion timestamps and explicitly published outcome codes. It never returns operational notes, staff attendance actor IDs, the other organization's attendance, private qualification evidence or financial details. Website changes only render these additions in the existing bilingual portal layout. No new authentication or gateway operation was introduced.

## Schema and changed files

One additive ERP migration: backend/database/migrations/2026_11_09_000001_add_hosted_and_onsite_operations.php. New tables: b2b_hosted_participations, b2b_hosted_benefits, b2b_arrivals, b2b_meeting_attendance. Existing b2b_meetings gains booking_revision (default 1), nullable start/completion/outcome fields and outcome_published (default false). Existing integer participant/event/meeting/user FKs remain authoritative; only benefit request IDs and existing portal membership IDs use UUIDs. No user/session/job/business tables are merged and no old attendance is inferred.

- Domain/API: backend/app/Services/B2BOperations.php; backend/app/Http/Controllers/B2BOperationsController.php; B2BScheduler.php, ParticipantAuthority.php and B2BController.php extensions in their existing directories.
- Permissions/config/routes: backend/app/Services/PermissionRegistry.php, PermissionPolicy.php; backend/config/b2b.php; backend/routes/web.php.
- ERP UI: src/b2b/OnsiteOperations.tsx, operations.ts; src/pages/B2BWorkspace.tsx.
- Tests: backend/tests/Feature/B2BOperationsTest.php, B2BConcurrencyTest.php; backend/tests/Support/operate-b2b.php; scripts/b2b-ui.test.mjs.
- Website: src/pages/ParticipantPortal.tsx, src/portal/onsiteState.ts; scripts/onsite-ui.test.mjs and existing CI command. No website backend/schema changes.

## Authorization and contracts

Default-off B2B_ONSITE_ENABLED requires the existing granular authorization and B2B gates. New permissions: b2b.hosted.view/nominate/approve/revoke and b2b.onsite.view/attendance/start/complete/publish. Only Super Admin has these by default; other authorized staff use the existing permission editor/overrides and exhibition/record scopes. Each mutation also requires its family view and buyer visibility. Completion additionally requires existing b2b.results.manage. UI hiding is not relied upon for security.

GET /api/b2b/operations accepts exhibition_id, section=hosted|meetings, date/status/participant filters and pagination. POST /api/b2b/operations/hosted|benefit|arrival|meeting/{id} uses the existing staff session/CSRF and throttling boundary. Meeting mutations require the current version; arrival also requires booking_revision. There is no external attendance route. Meeting arrival is restricted to its scheduled local day; manual event arrival is restricted to exhibition dates. Repeated arrival on the same booking has one effect.

Future external integration is UNVERIFIED and NOT operational. A reviewed contract would need an ERP event ID mapped to the external event, opaque external registration ID, explicitly authorized ERP participant mapping, UTC arrival time, approved verification source, source/event-scoped idempotency key, and server-side event authorization with authenticated replay protection. Never infer identity from email, claim QR verification from a staff click, or accept arbitrary source labels. This phase does not generate QR tickets or duplicate visitor registration.

## Actual verification

- Focused ERP suite: 6 tests / 103 assertions passed, including real parallel staff processes. Later focused hosted lifecycle refinement passed 1 test / 34 assertions; completion compatibility refinement passed 1 test / 43 assertions. These groups overlap, not additional unique cases.
- ERP frontend: 32 passed; website frontend: 23 passed. TypeScript checks and builds passed in both applications. ERP navigation: 38 passed.
- Real paired HTTP gateways: synthetic event 4, completed meeting 3 and no-show meeting 4. Hosted approval reached the Buyer Portal. Buyer arrival did not set exhibitor arrival. Both portals received the published follow-up outcome only after explicit organizer publication. Cross-identity access returned 403. Notes/staff attendance identities were absent from participant projections.
- Browser: hosted approval, independent buyer arrival/exhibitor no-show, outcome publication, section switching, English/Arabic portal content and RTL passed. Observed layouts had no page horizontal overflow at the browser's actual measured 560px portal and 1910px ERP widths. The requested 375px override did not take effect in the browser tool, so 375px coverage is not claimed. Screenshot APIs failed in hidden and visible modes; no screenshot evidence is fabricated.
- Saved original business rows across 12 tables are byte-identical; 155 FK diagnostics reported zero orphans. Synthetic Phase 7 records are retained for review. Existing private files and public assets were not written by Phase 7.
- Final full regression and dependency audits run once in existing GitHub Actions on the delivered heads. Actual final run URLs, totals and conclusions are recorded in the existing [ERP Draft PR #6](https://github.com/Omar-Fouad-Organization/Space-Crm-erp-system-NEW/pull/6) and [website Draft PR #4](https://github.com/Omar-Fouad-Organization/Premium-website/pull/4), avoiding a documentation-only CI rerun. Local focused results and sanitized integration/preservation evidence are in phase7-evidence.

## Rollback and limits

No merge, deployment or operational activation is authorized. The new migration was applied only to isolated test/UI databases. A future authorized release must apply the additive schema first with the feature off, then paired code, then isolated smoke verification and explicit activation. Older code tolerates the added schema, but it does not maintain booking revisions or enforce the new lifecycle: freeze B2B scheduling/status and hosted/attendance writes before rollback or disabling this feature after use. Retain the new schema/history and backups; do not blindly migrate down after records exist.

External QR verification awaits an approved contract and trusted source. Benefits are classifications, not fulfillment or financial commitments. Refresh-based updates are intentional. Full 375px browser verification remains a tooling limitation; no application defect was observed at the measured widths. Screenshot capture is unavailable. Prior workflow evidence: [core integration review](CORE-FUNCTIONAL-INTEGRATION-REVIEW.md). No known unresolved functional blocker remains in the exercised Phase 7 paths.
