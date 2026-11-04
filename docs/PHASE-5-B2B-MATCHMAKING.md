# Phase 5 — staff-managed B2B matchmaking

## Delivery status and boundaries

Prepared on `codex/phase-5-b2b-matchmaking`, based on verified ERP Phase 4 commit `d494a6b93b717402c223fb23570de09bbab5ed53`. Target: `codex/phase-4-registrations` (draft PR #4). Phase 4 remains an unmerged draft, dependent on Phase 3 → Phase 2 → Phase 1. Website remains unchanged at `34086e3e177c0ca5f92afc66a61088aca0c287fb` (draft PR #3).

**Implemented:** employee-only B2B administration, profiles, taxonomy, human qualification, separate concierge entitlement, deterministic matching, reviewed introductions, evidenced acceptance, event-local scheduling, results/follow-up, scoped reads/exports, encrypted evidence and privacy-safe audit/notification pointers.

**Not performed:** merge, deployment, operational migration/enrollment/activation, operational seeding, dependency upgrade, website changes, external participant accounts or Phase 6 portals. `B2B_ENABLED` defaults to false; granular authorization must also be enabled. Super Admin cannot bypass feature deactivation.

Local results, GitHub Actions results and outstanding operational verification are distinguished below. Passing isolated tests does not authorize activation or validate actual event dates, supplier capacity, consent documents or production infrastructure.

## Architecture and ownership

The React ERP remains the only employee interface. New lazy route `/b2b/:section?` uses the existing layout, design tokens, Card, Table, Input, Button, Checkbox, Select and Dialog components. Six authorized sidebar destinations: overview, exhibitor qualification, buyer sourcing/business profiles, matchmaking, scheduler/daily agenda and results. No global CSS, original page layout, existing field/dialog, shared primitive, font or theme changes.

Dedicated `/api/b2b` session-authenticated Laravel routes use the existing CSRF and staff-session revocation stack. They deliberately do not weaken the generic CRM operation middleware. `B2BAccess` enforces action + exhibition + participant record scope. Both sides of a match must be accessible. `B2BProfiles`, `B2BWorkflow`, `B2BMatching` and `B2BScheduler` own new-domain writes. They read existing commercial and Buyer Relations authorities; they never write their business state.

| Authority | Reference and rules |
| --- | --- |
| Existing ERP exhibition | `exhibitions.id`, date range, membership; B2B program explicitly approves meeting dates and timezone |
| Existing ERP commercial participation | `deals.id`: same event/client, **booth** type, **closed_won**; separate staff commercial-review evidence required |
| Existing client | `clients.id`; no duplicate client master, ownership reassignment or automatic lead conversion |
| Phase 4 buyer identity | `intake_submissions.id`, `type=buyer`, `status=verified`, organization present, no withdrawal/redaction, same event |
| Phase 4 organization | `buyer_organizations.id`; no duplicate buyer organization creation by B2B |
| New B2B business data | Participant profile, products, sourcing requirements, consent evidence, scoring, decisions, concierge, introductions, people, availability, meetings, outcomes |
| Employee identity/authority | Existing `users`, permissions, exhibition membership, record scope and session authentication |

IDs are unsigned bigint foreign keys matching the ERP. Website source UUIDs remain in Phase 4 intake; B2B references the existing integer intake identity rather than converting UUIDs or creating parallel identities. Business contacts in `b2b_people` are **not** users or authentication principals.

Existing generic CRM `meetings` represent internal CRM activities. Dedicated `b2b_meetings` prevent changing its attendee, financial, CRM or scheduling semantics.

## Commercial eligibility, qualification and concierge

Verified code baseline: `CrmService::validateDeal` distinguishes booth from sponsorship deals; `syncBooth` treats closed-won booth deals as sold, other active stages as reserved. Received payments require a closed-won deal. B2B uses the closed-won booth relationship plus explicit reviewed evidence; it does not infer confirmation from an enquiry, prospect client, draft offer, premium package, sponsorship or payment amount. Whether actual contracts satisfy the organization's official commercial policy still requires operational review.

1. **Standard Networking:** staff enrolls an authoritative confirmed exhibitor, records reviewed commercial and B2B consent evidence. Commercial confirmation grants no curated qualification.
2. **Qualified exhibitor:** separate six-criterion review, supporting evidence, reviewer/time, profile revision and justification. Default maxima: 35 demand, 20 supply, 15 documentation, 10 completeness, 10 decision-maker, 10 sector/market. Null is unknown; positive points require evidence; values cannot exceed configured weights. Recommendations: ≥80 high priority, ≥65 conditional review, otherwise preparation. These are recommendations only. `b2b.qualifications.approve` requires a separate explicit manager decision/reason. The score alone never activates qualification.
3. **Concierge:** separate `b2b_concierge` row, evidence and coordinator. Activation requires current approved qualification. It changes neither compatibility scores nor consent and creates no meetings or financial records. Profile revision invalidates qualification; reporting excludes stale concierge eligibility.

Weights must total 100; bands descend. Profile edits increment profile/version and clear approval. Reviews retain their source profile revision. Withdrawn B2B consent cannot be silently reactivated by editing a profile. Rejection, withdrawal, source redaction or commercial reversal blocks new curated actions. Existing future meetings become eligibility holds until staff cancel/review; a recorded decline cancels active meetings and releases their slots.

Buyer enrollment additionally requires the existing Phase 4 `buyers.view` permission and source record scope. Ordinary/business visitors, unreviewed/rejected applications, historical visitor interest and withdrawn buyers cannot enter through this path. Buyer verification never grants Hosted Buyer privileges.

## Schema and relationships

Two additive migrations; no historical migration is changed.

| New table | Purpose / integrity |
| --- | --- |
| `b2b_programs` | One program per exhibition; explicit timezone/dates/duration, weights/bands, optimistic version |
| `b2b_categories` | Exhibition-specific code, English/Arabic labels, active flag; unique event/code |
| `b2b_participants` | Event/kind; existing client/deal OR buyer application/organization; creator/assignee; encrypted profile/consent/commercial evidence; revisions and qualification projection; unique event/client, event/intake and event/buyer organization (multiple representatives share the organization participant) |
| `b2b_qualifications` | Immutable review evidence/scores/recommendation, source profile revision, reviewer; separately recorded manager decision/reason/actor |
| `b2b_concierge` | Separate unique participant entitlement/evidence/coordinator |
| `b2b_people` | Encrypted contact name; no login/password or external-account permissions |
| `b2b_representatives` | Multiple explicitly consented/authorized people per participant; unique participant/person |
| `b2b_locations` | Event-specific rooms/tables |
| `b2b_windows` | Program, person OR location availability/break; UTC interval; active/archive flag and revision |
| `b2b_matches` | Unique event/buyer/exhibitor; profile snapshots, rule version, deterministic factors/blockers, state/version |
| `b2b_invitations` | Unique match/party; pending/accepted/declined/expired; expiry; independent staff evidence/channel/actor; communication state |
| `b2b_meetings` | Unique match; event, buyer/exhibitor representative, location, UTC interval, status/version; encrypted result and follow-up responsibility/date/status |
| `b2b_slots` | Unique `(resource_type, resource_id, starts_at)` five-minute exclusion slots for people and locations |
| `b2b_audits` | Actor/event/resource/action/time and encrypted domain details; no update/delete endpoint |

Foreign keys restrict orphaning, including deletion of existing records referenced by B2B. This deliberate referential protection means linked commercial/client/source records cannot be physically deleted while B2B references remain. Ordinary commercial calculations and state transitions are unchanged. Application code validates same-event relationships, kind/source combinations, available references and permitted fields; it does not rely on frontend controls for integrity.

Products are bounded bilingual structures inside the encrypted versioned profile, not a separate e-commerce catalogue. Structured sourcing includes categories, product terms, classification/industry, origin preferences, optional quantity/unit, procurement notes, certifications and meeting interests. Positive verified capacity/certification claims require evidence. No cart, checkout or public payment processing.

## Matching algorithm and introduction lifecycle

Rule version 1 is deterministic and independent of the overall qualification score and concierge entitlement:

| Factor | Points / behavior |
| --- | --- |
| Category intersection | 35; no intersection is a hard blocker |
| Required product terms | 15; Unicode case-insensitive containment in bilingual product names/descriptions; missing required term blocks |
| Required origin | 15; explicit standardized value; incompatible/unknown required origin blocks |
| Requested capacity | 15; verified evidence, sufficient quantity and exact unit required when buyer specifies quantity; otherwise explicitly no quantity requirement |
| Required certifications | 10; exact reviewed names, verified flag and evidence; missing required certification blocks |
| Shared meeting interests | 10; deterministic shared terms; no match earns zero |
| Availability | Separate zero-point planning signal for representative-window overlap; never implies a bookable slot |

No optional quantity/certification requirement is not a claim that capacity or certifications were verified; factor `basis` explains this distinction. Free-text procurement notes remain human review inputs, not automatically satisfied facts. Matching uses no AI. A high total cannot override any hard blocker. Scheduling revalidates actual dates, duration, availability, breaks and resource reservations.

Batch generation is bounded to 400 candidate pairs for an event and permitted participants. A unique pair constraint and semantic JSON comparison prevent duplicates/unnecessary revision changes. Recalculation updates only suggested/under-review projections; it never resurrects a decline or rewrites approved/accepted outreach silently. Profile changes require recalculation and fresh approvals. Reconsideration requires authorized staff, a reason and new interest evidence; active meetings must first be resolved. Audit retains previous decision/evidence history when the current invitation projection is renewed.

`suggested → under_review → approved_for_outreach → invitation_pending → mutually_accepted / declined / expired`

Scheduling is a separate action after both independently verified acceptances. Until Phase 6, an authorized employee records phone, documented-email or in-person evidence, actor and reason. The API does not say participants clicked Accept. A decline is respected even after invitation expiry or eligibility loss. Invitation expiry prevents late acceptance. Existing accepted agreements may be scheduled after their invitation response deadline, provided eligibility and both acceptances remain current.

Communication projection defaults to **not_sent**. No email/SMS integration or delivery claim is implemented; no frontend or backend service credential is exposed. Future queued/sent/delivered states must be backed by an actual authenticated provider/outbox and delivery evidence before enabling them.

## Scheduling, concurrency and results

Event dates must be explicitly approved within existing exhibition dates. An unapproved program permits planning configuration but rejects scheduling. ISO 8601 inputs require explicit offsets; storage is UTC; display/calendar filtering uses the program timezone and local-day boundaries (including DST day lengths). Meeting duration is configurable, 5–120 minutes, in five-minute increments. Starts must align to a future five-minute boundary and the full meeting must fit one approved event-local date.

Verified representative links are required for each organization. A person can be explicitly reused through an already visible participant; no name/email-based auto-merge. One organization can send different people to simultaneous meetings. A shared person cannot attend two overlapping meetings even when explicitly linked to multiple organizations/events.

Bookings lock the event program, match, participants, authoritative source rows and representatives within a transaction; deterministic slot insertion order and transaction retries handle contention. Unique person/location slots are the final exclusion guarantee across programs. Intervals are half-open: adjacent meetings can touch. Rescheduling deletes old slots and inserts replacements in the same transaction; a collision rolls everything back, preserving the old meeting/version/reservations. Cancellation releases slots and preserves meeting/audit history.

Availability requires a covering available program window, both person windows and location window, with no intersecting break. Availability rows can be revised or archived with their current revision; they are not physically deleted. Program configuration and availability revisions are conservatively blocked while the event has active meetings. Adding an unavailable period that intersects active meetings is rejected. Breaks/windows remain visible to permitted configuration staff.

Meeting lifecycle: scheduled → confirmed → in progress → completed, with controlled cancellation/no-show branches. Future attendance/outcomes cannot be recorded as if observed. Completed/no-show meetings cannot be rescheduled. Results and optional follow-up employee/date/status require results authority; follow-up owner must be active and have access to that introduction. Outcome notes do not create CRM opportunities, deals, invoices, payments or agreements.

Overview separates Standard Networking, qualified exhibitors, current verified buyers, current concierge entitlements, introduction stages, meeting stages and eligibility holds. Gross location slot capacity is explicitly an **upper bound**, reduced by breaks, overlapping windows, actual participant availability and accepted requests; it is not a confirmed-meeting metric or a meeting guarantee. Daily agenda is a scoped date-filtered native ERP table, not an external calendar or participant portal.

## Authorization matrix

All permissions default only to Super Admin; other staff need explicit reviewed grants. Organizational Finance/HR/Operations/Sales roles gain no implicit B2B grants or unrestricted commercial access.

| Permission | Authorized data/action |
| --- | --- |
| `b2b.view` | Base module/exhibitor directory, permitted event and creator/assignee own/team/all scope |
| `b2b.buyers.view` / `.manage` | Private sourcing visibility / enrollment and buyer profile management; source enrollment also needs Phase 4 buyer view/scope |
| `b2b.profiles.manage` | Allowed profile changes and representative evidence; cannot set commercial/qualification/financial fields through profile payload |
| `b2b.participations.confirm` | Reviewed enrollment from scope-authorized closed-won booth deal; returns minimal deal/client references, no amounts |
| `b2b.programs.manage` | Event program, bilingual categories, locations, scoped availability/break revisions |
| `b2b.qualifications.review` / `.approve` | Scored evidence review / explicit current-review manager approval or rejection |
| `b2b.concierge.manage` | Separate qualified-participant coordination entitlement |
| `b2b.matches.view` / `.manage` / `.approve` | Both participant scopes + buyer visibility; view, recommend/review/invite/evidence, approve/reconsider |
| `b2b.meetings.view` / `.schedule` / `.manage` | Both participant scopes + buyer visibility; agenda, create/reschedule, lifecycle/cancel |
| `b2b.results.view` / `.manage` | Private outcomes/follow-up fields / permitted result edits; lifecycle edits also require meeting management |
| `b2b.export` | Bounded JSON page export reusing the exact section read permission/scope/field projection; separate throttle and audit |

Non-base actions depend on `b2b.view`; family actions depend on their view where applicable, and matches/meetings/results require private-buyer visibility. Event membership and record scope are evaluated server-side for direct requests, lists, totals, source selectors, calendars and exports. Own/team scope uses creator/assignee and existing policy owners. Results-field injection is rejected even when null or supplied only as follow-up fields. Commercial evidence and consent evidence have separate field visibility. Private notification text contains resource IDs only; existing `AuthorizedData` scopes B2B audit/notification pointers before returning data.

Session revocation, MFA, reset, attachment authorization and employee management remain existing Phase 1–4 services and regression tests. External participant authentication and organization ownership must remain a separate Phase 6 boundary; staff APIs must never be exposed as portal APIs.

## Verification evidence

### Local execution

Full ERP sequential suite: **169 tests, 2,416 assertions passed**, 728.68 seconds, including all Phase 1–4 regressions. Initial full run preceded the final availability-revision addition; focused B2B re-verification and final-head CI are recorded in the delivery verification section below. Earlier focused B2B run: **14 tests / 157 assertions**, including three real simultaneous-process resource races and rollback/same-supplier multiple-representative scheduling.

Frontend: **24 tests passed**, all **38 sidebar destinations** resolve, TypeScript check and production build pass. Existing CSS/shared primitives/original business pages remain byte-equivalent under the existing preservation tests. Website unchanged: **49 Laravel tests / 354 assertions**, **9 frontend tests**, TypeScript and production build pass. Existing bundle-size/dynamic-import and website Browserslist-age notices remain; no dependencies were upgraded to suppress them.

MySQL tests verify `APP_ENV=testing`, loopback host, MySQL driver, no overriding connection URL and actual `SELECT DATABASE() = space_crm_test` before destructive test hooks. Suites run sequentially. Concurrency workers share committed **synthetic** fixtures in that disposable DB, not independent destructive migrations. A separate fresh MySQL instance on port 23307 was used for this final test/browser pass after local service access problems; no existing data directory was reset or reinitialized. Website tests use its independently guarded disposable database.

### Browser checks and synthetic data

Production React preview `127.0.0.1:18781` → isolated Laravel `127.0.0.1:18780` → `space_crm_phase5_ui_test` on disposable MySQL. Synthetic-only feature activation; no operational app target changed.

Browser exercised: sign-in, exhibition program/date approval, bilingual category, closed-won exhibitor enrollment, product/profile input, evidenced scoring, separate manager approval, verified existing buyer enrollment/sourcing, multiple representative evidence, program/person/location windows, generation/explanations, review/outreach, invitation preparation, separately recorded buyer/exhibitor acceptance, scheduling, confirmation, rescheduling and local-date agenda. Results and follow-up were inspected using a labelled completed synthetic cycle.

Event 1 retains copied Phase 4 synthetic business records and the new future meeting. Event 2, **SYNTHETIC completed B2B cycle**, has a completed example, explicitly synthetic outcome and pending follow-up. Only the isolated fixture builder uses a controlled clock to exercise completion on a synthetic past event; application runtime code does not fake attendance or bypass future-outcome guards. These are not actual meetings, exhibitors or buyer statistics. Existing Phase 4 fixture rows remain intact.

Paired Clients captures use archived exact Phase 4 frontend source and current frontend against the same synthetic database/session, at matching measured DOM **1600×1000**. Visual inspection confirms the original layout, fields and dialog. Native IAB capture/Windows scaling produces larger image canvases; this is a manual visual comparison, not a claim of pixel-identical screenshots. Mobile breakpoint requested 390×844, measured DOM 469×1055. Existing responsive layout is retained; native table horizontal scrolling remains available.

Evidence directory: `docs/evidence/phase5/`. Paired Clients images, original client dialog, mobile Clients/Matchmaking, scheduler and completed-results captures are referenced in the final delivery section. No operational personal data, secrets or receipt withdrawal tokens were captured.

### Operational preservation

Read-only, full-row canonical hashes match the previously saved operational baseline: **ERP 37 tables / 3 private files; website 19 tables / 2 assets**. The check uses read-only transactions and asset hashes, not row counts alone. No operational migrations, writes or seed/reset commands ran. The website Git worktree and verified HEAD remain unchanged. New migrations were applied only to guarded disposable databases and the explicitly named synthetic browser database.

## Exact file inventory

New backend:

- `backend/config/b2b.php`
- `backend/database/migrations/2026_11_05_000001_create_b2b_domain.php`
- `backend/database/migrations/2026_11_05_000002_add_b2b_window_revision.php`
- `backend/app/Services/B2BAccess.php`
- `backend/app/Services/B2BProfiles.php`
- `backend/app/Services/B2BMatching.php`
- `backend/app/Services/B2BWorkflow.php`
- `backend/app/Services/B2BScheduler.php`
- `backend/app/Http/Controllers/B2BController.php`
- `backend/tests/Feature/B2BMatchmakingTest.php`
- `backend/tests/Feature/B2BConcurrencyTest.php`
- `backend/tests/Feature/B2BSecurityTest.php`
- `backend/tests/Support/B2BFixture.php`
- `backend/tests/Support/book-b2b.php`

Modified backend integration only: `backend/routes/web.php`, `backend/app/Services/PermissionRegistry.php`, `backend/app/Services/PermissionPolicy.php`, `backend/app/Services/AuthorizedData.php`.

New frontend: `src/b2b/forms.ts`, `src/pages/B2BWorkspace.tsx`, `scripts/b2b-ui.test.mjs`.

Modified frontend integration only: `src/App.tsx` (lazy route), `src/components/layout/Sidebar.tsx` (six authorized entries/empty-section filter), `src/auth/access.ts` (direct route permissions), `src/contexts/AuthContext.tsx` (menu capabilities), `scripts/verify-navigation.mjs` (38 real destinations).

CI: `.github/workflows/erp-tests.yml` adds Phase 4 PR target/Phase 5 push trigger and B2B frontend tests. Existing pinned actions, read-only contents permission, one sequential Laravel job, isolated MySQL service, synthetic credentials, safety guard and concurrency cancellation remain. No deployment workflow or production credentials are introduced.

Documentation: this report and selected `docs/evidence/phase5/*.png` captures. Local `.env.phase5-ui`, runtime helper scripts, database files, builds, dependencies and generated JUnit XML are excluded from commits.

## Known limits and release prerequisites

- Rule v1 uses curated exact categories/names/origins and substring product terms. It is explainable, not semantic procurement understanding. Human review must handle free-text details, evidence authenticity and translations. Batches above 400 pairs require a future bounded queued implementation before scaling.
- Availability overlap is a planning signal. Only the scheduler validates actual feasibility. Capacity is explicitly a gross upper bound, not a global optimized allocation or guaranteed meetings. No external calendar/provider, email sending, delivery callbacks, portal or public matchmaking directory is implemented.
- Dates in tests/browser fixtures are synthetic. Real Green Life Expo dates, hours, timezone, tables, commercial confirmation policy, consent wording, evidence retention and staff grants require formal operational review. No real event program is enabled by this PR.
- Encrypted sourcing/evidence requires stable managed Laravel encryption keys and tested backups/key rotation. Source withdrawal/redaction prevents new curated actions; B2B evidence retention/erasure policy still needs operational approval and a reviewed retention procedure. Do not activate without that policy.
- Final staging must verify TLS/cookies/session revocation, trusted proxy/CSRF behavior, persistent shared rate-limit cache, database isolation/collation/indexes, deadlock monitoring, realistic volume/latency and simultaneous scheduling load. Isolated local and CI tests do not establish production capacity or high availability.
- Staff administrators must explicitly assign least-privilege actions, membership and record scope. No broad role grants should be inferred from this implementation. Review any existing compatibility-mode staff before activation.
- No dependency lockfile, financial/commission/receipt/booth service or original UI page was modified. New restrictive foreign keys intentionally preserve referenced B2B history; operational cleanup must respect them.

## Staging, deployment and rollback blueprint — not executed

1. Independently review this draft and unmerged Phase 1–4 dependency chain. Take encrypted database/private-file/config backups and prove restore on an isolated staging clone. Record exact branch heads, schema state and deployed infrastructure.
2. Keep `B2B_ENABLED=false`; verify existing Phase 4 staff/public workflows. Apply only the two additive B2B migrations in staging, then test old application compatibility while the flag remains off. Existing rows are not backfilled or updated.
3. Deploy the reviewed application build to staging with the feature still off; verify old UI/workflows, sessions/MFA, receipts, commissions, allocation invariants, CMS/intake and automatic visitor registration/manual buyer qualification.
4. After operational policy/date/privacy review, enable only in approved staging with synthetic participants; grant explicit actions/memberships/scopes. Run the evidenced full cycle and load/concurrency/security tests. Obtain separate authorization before any production deployment or activation.
5. Roll back application behavior by disabling the B2B feature and restoring the prior reviewed build; retain new tables/evidence. Do **not** blindly run migration rollback after collecting B2B records. A schema rollback drops only new B2B data and requires a reviewed backup/export/restore plan, disabled writes and dependency-order checks. The availability revision rollback must precede the domain rollback.

## Phase 6 preparation only

Business people, organizations, participants, consent, profile revisions, introductions, invitations and meetings are separate from employee users. Future portal principals must have separately verified organization ownership and exhibition/participant-scoped policies, dedicated API routes/authentication, consent and contact-channel verification. Reuse the domain services with an explicit participant actor contract; do not grant external users staff permissions or expose staff endpoints. No Phase 6 implementation is included.

## Delivery verification

Draft PR, exact published commit hashes, final focused test results and GitHub Actions links are appended after publication and verification. Until then, GitHub Actions is **not yet verified for Phase 5**.

### Evidence links

- [Phase 4 Clients baseline](evidence/phase5/clients-phase4-paired.png) and [Phase 5 Clients comparison](evidence/phase5/clients-phase5-paired.png).
- [Original client dialog](evidence/phase5/client-dialog.png), [mobile Clients](evidence/phase5/clients-mobile.png).
- [Staff acceptance evidence dialog](evidence/phase5/acceptance-evidence-dialog.png), [mobile Matchmaking](evidence/phase5/matchmaking-mobile.png).
- [Daily scheduler](evidence/phase5/scheduler-desktop.png), [completed synthetic result and follow-up](evidence/phase5/completed-results.png).

Availability revision/archiving re-verification: **14 B2B tests / 160 assertions passed**. Subsequent duplicate-conflict and encrypted profile-history corrections passed the affected **10 tests / 125 assertions**. The final organization-level deduplication check and published-head CI are recorded below after execution. Existing Phase 4 synthetic rows independently matched across exhibitions, clients, booths, deals, installments, payments, commissions, eight intake records, buyer organization and five registration controls.

Final local organization-deduplication check: **5 tests / 64 assertions passed**. Duplicate category/relationship writes return 409, including database-enforced conflicts. Profile edits retain encrypted before/after history. Browser export downloaded the bounded permitted results page successfully; availability window #12 archived to version 2 without deletion. Temporary browser viewport overrides were reset.
