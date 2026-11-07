# Phase 6 — secure participant portals

Status: implementation under final isolated verification. Draft delivery only; no merge, deployment, operational migration, live invitations or operational matchmaking activation is authorized by this work.

## Boundaries and sources of truth

SPACE ERP owns commercial confirmation, Buyer Relations verification, exhibition participation, organization membership approvals, consent, qualification, approved B2B facts, publications, introductions, invitation decisions and resource-safe scheduling. The website owns external individual identities, passwords, encrypted participant sessions, device revocation, private uploaded objects, durable outbound commands and notification read state.

Employee users, website CMS users and external participants remain three separate authentication domains. Neither matching email addresses nor CMS/employee sessions establish organization ownership. No user, session, job, migration, finance or CMS business table is merged between databases.

ERP participant, exhibition, client, buyer organization, match, representative, location and meeting identifiers remain unsigned integer references. Website identity, device, command, file, amendment, membership and access invitation identifiers are UUIDs. Website references to ERP integers and ERP references to website UUIDs are foreign-authority references, not cross-database foreign keys. Every action revalidates the signed actor, membership, participant, exhibition and current canonical eligibility.

The website contains no alternate matching engine, financial authority, meeting scheduler, registration approval authority or independent participant business profile database. Its profile proposals are delivered to ERP and reviewed there.

## Access lifecycle and permissions

An existing verified buyer application or commercially reviewed closed-won booth participant is required before staff can issue access. A generic CRM client, ordinary visitor, Business Visitor, sponsor, preliminary interest lead or unverified buyer cannot obtain access through public registration. Existing Phase 4 ordinary visitor registration stays automatic and buyer verification stays manual.

Staff must record independent identity and organization authority evidence. Invitations use 64-character random tokens, only SHA-256 hashes at rest, a 24-hour validity window, exact lowercased intended email and canonical participant binding. Revoked/expired/ineligible invitations fail closed. A consumed token may only acknowledge an uncertain retry for the same already-bound identity; it cannot create a second membership or reactivate a revoked membership. A fresh reviewed invitation is needed to change a membership.

**Operational delivery prerequisite:** an approved verified-email invitation delivery adapter is not configured. Raw-token issue, preflight and activation are deliberately restricted to local/testing environments. Controlled synthetic onboarding has been tested; no live email delivery or production email-ownership verification is claimed. Merely enabling flags does not unlock production onboarding. Password recovery uses the dedicated Laravel broker and mail notification, but real delivery still requires configured and verified provider infrastructure. No live emails were sent.

Website activation verifies invitation proof before reserving an email. An uncertain remote outcome preserves an inactive pending identity UUID for retry. Valid proof can recover that pending reservation, but cannot overwrite an active verified account; that user must sign in and link the invitation. Existing account email/domain alone never claims an organization.

| Organization role | Explicit capabilities |
| --- | --- |
| Owner | view, profile.submit, evidence.read, meetings.respond, requests.submit, team.request, team.manage, consent.withdraw |
| Editor | view, profile.submit, evidence.read |
| Coordinator | view, meetings.respond, requests.submit |
| Reader | view |

Capabilities are an explicit ERP membership snapshot, not frontend authority. All roles can leave their own membership. Owners may request another representative and revoke a representative in their own organization/event; staff approval and invitation acceptance remain mandatory. Attendance representatives reuse Phase 5 people/representatives; portal accounts do not automatically become meeting attendees.

Staff permissions are b2b.portal.users.view, invitations.manage, access.revoke, profiles.review, requests.manage and audit.view under the b2b.portal prefix. Global accounts.deactivate is separately protected for SuperAdmin. All normal staff operations enforce existing action, event and record scopes; global deactivation intentionally affects all organizations for the verified identity and is separately audited.

A portal request fails when membership is revoked, identity disabled, consent withdrawn, buyer verification withdrawn/redacted, or the exhibitor loses commercial eligibility. Standard Networking remains distinct from current curated qualification and Concierge. Concierge never bypasses qualification, consent, source eligibility, version or Rule 2 restrictions.

## Sessions and recovery

The website uses dedicated portal guard/provider/broker, portal_users, portal_sessions, portal_devices and portal_password_reset_tokens. The HttpOnly cookie green_life_participant_session is scoped to /api/portal, SameSite Strict, encrypted, and Secure outside local/testing. Participant sessions have a 60-minute maximum device expiry and never use localStorage tokens. CSRF is required for state-changing browser operations; the CSRF token is held in memory and refreshed after authentication changes.

Session IDs regenerate on login. Device rows bind the final session hash and authentication version. Password reset uses the framework's hashed, expiring, single-use recovery token under a user-row lock; it increments auth_version atomically. Revoke-all requires the current password and increments the version. Single-device revocation and logout mark the device revoked; replaying an old cookie cannot restore it. Session configuration and guard instances are restored after the participant request, preventing leakage into CMS sessions or long-lived workers.

ERP global identity status is checked on login/me, and ERP revalidates membership/source eligibility for every business operation. Identity deactivation is irreversible through participant APIs; organizer reconciliation is required. Historical records and private objects are preserved.

## Gateway protocol and contracts

The browser calls same-origin /api/portal/* using its own session and CSRF. Only the website backend signs ERP requests. No service key, APP_KEY or backend token is embedded in frontend code.

All ERP service calls are POST application/json to /api/internal/participant-portal/{contexts,identity-status,activation-preflight,activate,command}. Maximum raw body is 65,536 bytes, enforced before body transforms; Content-Length is mandatory and transfer encoding is rejected. The sender signs the exact serialized body, not a reserialized parsed object.

Headers: X-Space-Portal contains unpadded base64url JSON claims; X-Space-Portal-Signature contains lowercase hex HMAC-SHA256 of that encoded header, using an independent >=32-byte secret.

Claims: {version:1,purpose:"SPACE-PARTICIPANT-V1",issuer:"green-life-portal",audience:"space-participant-api",key_id:"primary"|"previous",method:"POST",target:exactRequestUri,issued_at:unixInteger,expires_at:unixInteger,nonce:uuid,body_sha256:hexSha256}. Validity is at most 30 seconds, future clock skew at most five seconds. Persistent unique nonce hashes reject replay; old accepted commands still require a fresh envelope. Staff/CMS/intake credentials are not accepted.

Request contracts:
- contexts: {identity_id:uuid} -> {items:[{id:membershipUuid,participant_id:int,exhibition_id:int,exhibition_name,kind,name_en,name_ar,role,capabilities}]}.
- identity-status: {identity_id:uuid} -> {active:boolean}; an unknown identity is inactive.
- activation-preflight: {email,token} -> {valid:true,identity_id:uuid|null}; test-only, exact invitation recipient.
- activate: {identity_id:uuid,email,token} -> {membership_id:uuid}; test-only, atomic recipient/source eligibility and single-use binding.
- command: {identity_id:uuid,membership_id:uuid,exhibition_id:int,operation,payload:object|[],page?:1..10000,command_id?:uuid,authentication?:{device_id:uuid,auth_version:positiveInteger}}. Writes require command_id and the website's authenticated session attestation. Root override fields are rejected.

Read operations: overview, profile, amendment, categories, matches, meetings, discover, team, activity, requests, media.authorize. All list pages are bounded to 25; contexts are capped at 100. Projection metadata includes authoritative_at, page, per_page and event timezone. Overview returns only safe counts/checklist/actual booth data; profile returns the organization's full editable profile and proposal statuses; amendment requires payload {id:uuid} and the same participant binding.

discover accepts only {search?:string<=100,country?:string<=100,sector?:string<=150,category?:int}. Only intentionally published current profile versions with current commercial/consent eligibility appear. Country is never inferred from product origin. Safe projection exposes bilingual company description, categories, approved display attributes and at most five visible products. Private capacity, consent/qualification evidence, procurement criteria, CRM ownership, balances and buyer sourcing are excluded. Public email/phone require explicit reviewed contact consent. Hidden products are omitted from images, public projection and search text.

Write payloads:
- profile.submit: {profile_version:int,profile:validatedProfile,intent?:"draft"|"submit",draft_id?:uuid,draft_version?:int} -> {id:amendmentUuid,status,version}.
- invitation.respond: {match_id:int,version:int,action:"accept"|"decline"} -> {id,status,version}; party is derived from the current member, never submitted.
- request.submit: {kind:"introduction"|"reschedule"|"cancellation"|"acknowledge"|"team_invite",target_id:int,note:string<=2000,email?:recipientEmail,role?:organizationRole} -> {id,status:"submitted"}.
- team.revoke: {membership_id:uuid}; same organization/event only.
- membership.leave: {}; only the current membership.
- participation.withdraw: {reason:string}; organization owner capability required; preserves existing meeting history and slots for staff coordination.

401 rejects an invalid signature/session, 403 rejects current authority, 404 conceals unavailable objects, 409 rejects nonce/idempotency/version conflicts, 413 enforces size, 422 validates business facts, 429 throttles, 502/503 indicate unavailable/invalid authority. Responses contain no stack traces. Transport requires HTTPS outside loopback local/testing, disables redirects and uses bounded timeouts. TLS, synchronized clocks and independent keys remain operational prerequisites.

## Delivery, idempotency and reconciliation

The website durably inserts an encrypted portal_outbox command before attempting a remote mutation. It freezes submitting device/auth_version and identity from the session, never client overrides. The source transaction atomically records the unique command UUID, membership/body hash, encrypted result and immutable actor audit. Same command/body returns the original result; UUID reuse with different actor/body fails. Profile content hashes additionally deduplicate semantically identical drafts for the same base version.

The outbox serializes user -> command -> device, rechecking current active account and unrevoked submitting session. A revoked/expired/version-stale actor requires organizer reconciliation, never silent delivery with a new actor. ERP mutations lock identity controls, canonical participants and membership, and invitation responses follow Phase 5 match -> ordered-participants -> invitation locking. Source mutations recheck locked eligibility rather than trusting a cached projection.

States: pending means durably queued without acknowledged ERP success; confirmed means ERP acknowledged this command, not a confirmed meeting; rejected means a first-attempt permanent rejection; review_required means a stale actor or an uncertain prior delivery needs reconciliation. Connectivity, 429 and 5xx failures remain pending. A later permanent rejection after an uncertain delivery becomes review_required, avoiding false rejection. Retry uses a new envelope/nonce and the same command UUID. Maximum eight attempts; exponential retry delay starts at 60 seconds and caps at one hour. No automatic participant confirmation or booking occurs.

Website CLI portal:deliver --limit=25 retries only due pending commands (maximum limit 100). No operational scheduler/worker was installed or activated. Organizer reconciliation must inspect both website outbox and ERP command receipt/audit under restricted backend access; metadata-only ERP audit does not claim to expose website-side undelivered commands. Do not manufacture a new command UUID to guess whether an uncertain decision was applied.

## Profiles, matchmaking and meetings

Approved profiles remain separate from private drafts. Draft revision requires the current base profile version and optimistic draft version. Submitted proposals are immutable; requested changes/rejections are retained and a new revision may be proposed. Participants cannot set verified capacity, verified certificates, organizer evidence, manager decisions or qualification. Existing approved private certification references are not disclosed to other organizations.

Staff approval calls the existing B2BProfiles update/version/review safeguards. Material edits invalidate curated qualification/current match facts; publication requires the current profile version. Historical invitations, direct decision evidence and booked/completed meetings remain. Notifications reflect real activity, invitations, publication-related amendment review, requests and schedules; no fabricated announcements or email delivery claims.

Matching Rule 2 is reused unchanged. Unknown remains distinct from explicitly Not Applicable; blank answers never earn compatibility points. Participant-facing explanations include safe factor states, compatibility and evidence coverage, not confidential counterparty evidence. Only staff-released introductions are visible. Acceptance requires the actor's own pending unexpired invitation, current match version, current Rule 2/profile versions, baseline and no hard blockers, plus both parties' current eligibility. Staff-created prior decisions are not misrepresented as participant-originated decisions.

Each direct decision records identity, membership, role, organization, exhibition, party, match/invitation/command versions, device/auth_version and timestamp. It is also preserved in immutable encrypted portal_activity so later staff reconsideration cannot erase participant evidence. One acceptance does not accept for the other party; both acceptances do not book a meeting. Declined matches cannot be reopened by replay.

Participants only submit meeting coordination requests. Actual schedule changes always use the original staff scheduler and its representative/person/location availability, breaks, slots, optimistic version, overlap and concurrent locking controls. Existing meetings remain visible with a clear review hold when facts become stale. Historical completed/cancelled/no-show records remain history. No portal route writes resource slots, financial or booth allocations.

## Private media and retention

Website participant_portal disk is outside public storage (configurable PARTICIPANT_PORTAL_MEDIA_ROOT). Uploads require a fresh ERP context with profile.submit, actual file MIME/content, <=2 MB input and UUID object paths. Images accept PNG/JPEG/WebP only, maximum 4096 per dimension and 12 megapixels, GD decode/reencode to PNG, <=8 MB output. SVG/executable content and path traversal are rejected. PDFs are private evidence downloads with attachment disposition, CSP sandbox, nosniff and no-store. Images are authorized inline responses, never unrestricted static evidence assets.

Media metadata binds the website identity and ERP membership/participant/event. Team colleagues require the same authoritative organization/event; evidence additionally requires evidence.read. Cross-company image access requires current explicit ERP publication and an exact approved image reference. Cross-company PDFs remain unavailable. Profile delivery validates every referenced file's canonical organization/event/kind. Soft archive prevents new claims while retaining approved/historical evidence; no physical purge or operational cleanup ran.

ERP staff review uses a second independent signed MEDIA purpose/key ring and a narrow /api/internal/participant-portal/media/read website endpoint. The ERP first verifies a file is referenced by a scoped amendment, then delegates a canonical participant/event/employee read. Separate nonce persistence prevents replay. No frontend backend credential or arbitrary destination URL is accepted.

No automatic retention deletion is enabled. Legal retention, encrypted backups, key custody, orphan-object review, storage quotas and malware scanning for private PDF intake require operational policy/provider review. Bounded nonce pruning commands remove only replay entries expired by more than five minutes, never business records or evidence. Dry-run is available.

## Safety, deployment and rollback

Both new flags default false: ERP PARTICIPANT_PORTAL_API_ENABLED and website PARTICIPANT_PORTAL_ENABLED. ERP also requires existing granular authorization and B2B flags. The website cannot bypass an unavailable ERP. No original public route, shared header/footer/CSS, ERP sidebar, financial service, receipt, commission, booth reservation or sales calculation was rewritten. Historical small booth allocations are preserved; new Green Life Expo preferences are described as minimum 3 x 4 m = 12 m², with no online allocation or sales.

Release prerequisites: independent review of both dependent PRs; verified deployed schema/base versions and backups; staging using synthetic data; operational verified-email adapter/security review; HTTPS/origin/cookie/proxy validation; independent secret manager keys and rotation; private storage permissions/GD/upload limits; shared persistent rate-limit cache (not array); clock synchronization; monitored outbox/nonce housekeeping; production volume/load testing; explicit authorization for any future activation.

Schema-first sequence for a future separately authorized release:
1. Snapshot both databases/private assets and verify restore in isolated infrastructure. Record exact old/new heads and existing Phase 1–5 migration state.
2. Keep all participant flags false; stop participant delivery workers, if any. Apply only each repository's additive Phase 6 migration to its own database after review. Never copy user/migration/session tables between applications.
3. Existing pre-Phase-6 binaries ignore the new tables and optional encrypted JSON fields; deploy compatible ERP API first, website second, flags still false. Do not change APP_KEY or invalidate unrelated employee/CMS sessions.
4. Configure independent service/media keys and previous-key rotation windows, TLS endpoints, private disk and shared throttling. Verify disabled routes, signed contracts, CSRF, device revocation and negative scopes in staging.
5. Configure and independently verify the missing email adapter/provider before proposing production onboarding. Run synthetic invitation/profile/acceptance/scheduler/retry tests. Obtain separate operational authorization before flags/workers are enabled.

Rollback: disable website flag and delivery worker first, disable ERP portal flag, restore prior application binaries while retaining additive schema, encrypted drafts/receipts/audits and private files. Do not run migrate:rollback after any portal writes: down() drops new portal history, identities and receipts. Restore backups only under an approved incident plan that accounts for subsequent operational transactions. Schema rollback is appropriate only for an unused isolated installation. Never restore an old whole ERP database over newer financial records.

## Verification and delivery evidence

Local testing uses disposable MySQL on loopback port 23307. Actual database guards verify space_crm_test and green_life_expo_test before destructive suites. The suites are sequential within each database; distinct repository databases can run independently. Browser services use separate new space_crm_phase6_ui_test and green_life_expo_phase6_ui_test databases with SYNTHETIC accounts/companies and non-operational future dates. No operational database was migrated/reset/seeded.

Website final local backend: **64 passed, 443 assertions**. Frontend: **14 passed**, TypeScript and production build passed. ERP full local backend: **199 passed, 2,604 assertions**; final focused portal verification: **20 passed, 122 assertions**. Final complete rerun after those corrections: **199 tests / 2,604 assertions, zero errors/failures/skips**, completed JUnit evidence in **690.16 seconds**; frontend **25 passed**, 38 navigation destinations passed, TypeScript/build passed. Existing large-bundle/Browserslist notices remain build warnings; no dependency upgrades were made.

Focused coverage includes real multi-process MySQL races for same-command acceptance, two identities redeeming one access invitation, and duplicate outbox workers. Existing Phase 5 resource concurrency suites remain in the full ERP regression. Real website cookies prove CMS/portal isolation, CSRF outside the testing bypass, logout/reset/revocation replay, pending activation recovery, invalid invitation email reservation prevention, revoked-device outbox rejection, private media MIME/IDOR/static path checks and signed media replay protection.

The 44 requested scenarios map to:
- 1–9: ParticipantOnboardingTest, ParticipantGatewayTest, PortalIdentityTest plus unchanged intake tests.
- 10–16: ParticipantPrivacyTest/GatewayTest, PortalIdentityTest, PortalMediaTest.
- 17–23: ParticipantPrivacyTest, existing B2B rule/qualification suites, portal-ui.test.mjs.
- 24–29: ParticipantGatewayTest/ConcurrencyTest, PortalIdentityTest/OutboxConcurrencyTest.
- 30–34: existing B2B scheduler/concurrency suites and ParticipantPrivacyTest; browser scheduler reschedule/history hold.
- 35–39: full existing intake/CMS/finance/auth suites and native public/ERP browser checks.
- 40–43: bilingual/mobile browser evidence plus byte-equivalence design regression tests.
- 44: read-only operational row/asset fingerprint comparison against saved pre-work baselines; 37 ERP tables/3 private files and 19 website tables/2 assets unchanged. Existing selected Phase 4 synthetic records also unchanged.

Browser evidence records synthetic buyer/exhibitor activation, direct independent acceptance, both-party state without auto-booking, actual organizer scheduling, participant reschedule request, original scheduler reschedule, private product draft/reload/submission/staff approval, current-version publication, buyer sourcing/discovery, Arabic/RTL/mobile and separate account/security views. Exact completed checks and any limitations are finalized in the delivery section; no runtime claim is inferred from merely writing a test.

GitHub Actions results are distinct from local tests. The workflows use pinned actions, disposable MySQL 8.4, generated test-only .env, synthetic fixtures, one sequential Laravel suite, read-only repository permissions and no deployment/operational credentials. Final-head run/job links and draft PR/head references are appended after publication; queued/running/cancelled jobs are never described as passed.


## Database ownership and field mapping

| ERP table | Ownership / relation |
| --- | --- |
| portal_identity_controls | Website identity UUID; global disabled_at/reason/reviewing employee; no employee account merge |
| portal_memberships | UUID membership -> integer b2b participant and exhibition; role/capabilities/status/approval evidence/reviewer/revocation |
| portal_access_invitations | UUID -> canonical participant; intended email, hashed token, role/evidence/inviter, expiry/revocation and consumed identity/membership |
| portal_gateway_nonces | SHA-256 issuer/key/nonce primary key, indexed expiry; replay control only |
| portal_commands | UUID command -> membership; operation/body hash, encrypted result, created_at |
| portal_activity | Integer append-only audit reference; UUID actor/member/command and integer exhibition; encrypted actor/organization/decision/session evidence |
| portal_amendments | UUID -> participant/member, approved profile base version, draft version, unique content hash, encrypted proposed profile, review/status/reviewer |
| portal_publications | Participant primary FK, current profile version, intentional visibility, reviewed safe search/filter projection and reviewer |
| portal_requests | UUID -> member/exhibition, typed target integer, encrypted proposal, status/optimistic version |

| Website table | Ownership / relation |
| --- | --- |
| portal_users | UUID external individual; unique email, hashed password, pending activation hash, verified/active/auth_version; no CMS user FK |
| portal_sessions | Independent encrypted session payload; nullable UUID user_id and indexed last_activity |
| portal_password_reset_tokens | Dedicated broker email and hashed recovery token; separate from CMS recovery |
| portal_devices | UUID device -> identity; unique session hash, auth_version, expiry, last activity/revocation |
| portal_outbox | UUID command/identity/member, integer foreign-authority event, actor device/auth_version, encrypted payload/result, delivery state/attempt/due timestamps |
| portal_media | UUID object/identity/member; integer canonical participant/event, kind/random path/MIME/size/archive timestamps |
| portal_notifications | SHA-256 stable identity/member/source-event key, foreign-authority exhibition and read timestamp |
| portal_media_nonces | Independent media nonce hashes and indexed expiry |

All tables are additive. ERP participant/event/employee FKs restrict deletion; external cross-database identifiers are deliberately not constrained against unrelated users tables. Existing B2B profiles gain optional validated display/media fields in their encrypted JSON; existing rows require no rewrite. Product images and private certificate media UUIDs are reviewed references, never paths or trusted qualification evidence. No data or asset migration/import/backfill is performed.

Discovery previews are bounded to an 8 KB budget per profile, with compact strings/market lists and fewer product previews when necessary, preserving full approved data. Full controlled own-organization editing remains separate. Lists and context counts have explicit limits; wildcard search operates only on a bounded, staff-reviewed event projection. Production query-plan/load testing remains required.

The website command-history endpoint GET /api/portal/commands?page=1 returns only the authenticated individual's 25 metadata rows (UUID, operation, state, attempts, due/creation timestamps). It does not expose raw payloads or other users' outboxes. Account & Security shows acknowledgment/retry states after navigation or reload. Business confirmation and transport acknowledgment have distinct bilingual labels.

## Completed browser verification

The isolated source fixture has one SYNTHETIC exhibition, two reviewed exhibitor/buyer pairs, four attendees and two locations. Two external accounts each explicitly selected between two separately approved organizations. Invitations were issued by the authorized staff controller in the guarded synthetic environment, not delivered by email. Both accounts activated in the browser. Final-code second memberships were linked through the authenticated portal.

Pair one: a product draft was saved, reopened, submitted and approved through the native ERP dialog. Approved profile version advanced independently of the proposal. Current-version publication was explicitly reviewed. A buyer sourcing draft preserved Unknown quantity versus explicit Not Applicable documentation and was submitted without replacing approved sourcing. Meeting #1 remains scheduled at 12:30 on the synthetic 2027-01-01 event and visibly on hold after material profile approval; neither history nor slots were silently deleted.

Pair two: match #4 was visible only to its authorized organizations. The buyer independently accepted, then the exhibitor independently accepted. The portal showed both parties accepted and explicitly separated scheduling. Staff used the unchanged scheduler to create meeting #2 at 13:00, the buyer requested 13:30 without changing the booking, and staff safely rescheduled it to 13:30–14:00 at synthetic table two. Both applications displayed the resulting schedule. Current participant decision receipts carry authenticated device/version evidence and are retained separately from later staff projections.

Published Herbs filtering, real activity records, durable command history across navigation, own security/device status and Arabic discovery were checked. Requested mobile viewport 390 x 844 was reported by this Windows browser at effective DOM 582 x 1259; measured document width 560 was below viewport width 582, with RTL direction and usable stacked forms. Temporary viewport overrides were reset. No actual 390 CSS-pixel measurement is claimed. Original Clients, public Home and Visitors were inspected; byte-equivalence tests protect the original shared design files.

With the participant session still active, CMS /admin redirected to its independent login. After signing the staff account out, ERP /finance redirected to staff login while the participant portal remained authenticated. Staff sign-in was restored. Direct unauthorized organization/event/action/document operations are additionally covered by server tests, not inferred from hidden navigation.

The one-hour participant session expired during the long verification run and correctly required reauthentication. No real recovery credential was changed, no live invitation sent, and no operational account or data was used. Evidence images are the actual browser captures, including native DPI padding; some are full-page captures.

Membership validity follows the existing canonical participation and explicit revocation states. Event dates alone do not automatically expire historical organization access or cancel bookings; organizers must revoke/withdraw relationships under the approved retention/access policy. Future time-limited grants require a separately reviewed expiry policy instead of inventing commercial expiry dates.

## Repository file inventory

- .github/workflows/erp-tests.yml
- backend/app/Console/Commands/PruneParticipantNonces.php
- backend/app/Http/Controllers/ParticipantAdministrationController.php
- backend/app/Http/Controllers/ParticipantGatewayController.php
- backend/app/Http/Middleware/AuthenticateParticipantGateway.php
- backend/app/Http/Middleware/LimitParticipantGatewayRequest.php
- backend/app/Services/B2BAccess.php
- backend/app/Services/B2BProfiles.php
- backend/app/Services/ParticipantAuthority.php
- backend/app/Services/ParticipantMedia.php
- backend/app/Services/PermissionPolicy.php
- backend/app/Services/PermissionRegistry.php
- backend/bootstrap/app.php
- backend/config/participant_portal.php
- backend/database/migrations/2026_11_06_000001_create_participant_portal_authority.php
- backend/routes/intake.php
- backend/routes/web.php
- backend/tests/Feature/ParticipantConcurrencyTest.php
- backend/tests/Feature/ParticipantGatewayTest.php
- backend/tests/Feature/ParticipantOnboardingTest.php
- backend/tests/Feature/ParticipantPrivacyTest.php
- backend/tests/Support/participant-worker.php
- docs/PHASE-6-PARTICIPANT-PORTAL-API.md
- docs/evidence/phase6/buyer-accepted.png
- docs/evidence/phase6/exhibitor-meeting-review-hold.png
- docs/evidence/phase6/original-clients-preserved.png
- docs/evidence/phase6/staff-portal-dialog.png
- docs/evidence/phase6/staff-rescheduled.png
- docs/evidence/phase6/staff-two-preserved-meetings.png
- src/b2b/PortalAdministration.tsx
- src/pages/B2BWorkspace.tsx

## Runtime configuration reference

ERP: PARTICIPANT_PORTAL_API_ENABLED=false; PARTICIPANT_PORTAL_SERVICE_KEY and PARTICIPANT_PORTAL_PREVIOUS_KEY receive-only rotation ring; PARTICIPANT_PORTAL_MEDIA_KEY / PARTICIPANT_PORTAL_MEDIA_KEY_ID sign reverse file delegation; PARTICIPANT_PORTAL_WEBSITE_URL is the fixed website backend HTTPS origin. Existing B2B_ENABLED and granular authorization are also required.

Website: PARTICIPANT_PORTAL_ENABLED=false; PARTICIPANT_PORTAL_ERP_URL is a fixed HTTPS origin; PARTICIPANT_PORTAL_SERVICE_KEY / PARTICIPANT_PORTAL_KEY_ID sign narrow requests; PARTICIPANT_PORTAL_MEDIA_KEY / PARTICIPANT_PORTAL_MEDIA_PREVIOUS_KEY validate reverse reads; PARTICIPANT_PORTAL_MEDIA_ROOT is a private disk root. PARTICIPANT_PORTAL_EMAIL_ENABLED controls framework password-recovery delivery only and does not remove the production invitation-adapter gate. APP_KEY remains independently managed in each application and is never rotated as part of rollback. No new secrets belong in VITE_* variables.

Local verification is complete. GitHub Actions verification and exact published draft/head references are recorded in the delivery section and PR metadata after publication. No CI success is inferred from these local results.

## Published delivery and independent CI verification

- [ERP draft PR #6](https://github.com/Omar-Fouad-Organization/Space-Crm-erp-system-NEW/pull/6), based on unmerged Phase 5 draft #5 at fbed64199c63ecdc937f281370b41d159548f690. Tested implementation head: **4fe8480bc77c4a06245d1ef0acd64c4a23b3f575**.
- [Website draft PR #4](https://github.com/Omar-Fouad-Organization/Premium-website/pull/4), based on unmerged Phase 4 draft #3 at 34086e3e177c0ca5f92afc66a61088aca0c287fb. Tested implementation head: **7b13a5863b50bf0c7c7959c098d792da67fe4382**.
- [ERP implementation-head Actions run 42085175584](https://github.com/Omar-Fouad-Organization/Space-Crm-erp-system-NEW/actions/runs/42085175584): **completed successfully**. Frontend job 127448207011 and Laravel job 127448207286 both completed/success. Actual Laravel log: **199 passed / 2,604 assertions**, 142.06 seconds.
- [Website implementation-head Actions run 42085180795](https://github.com/Omar-Fouad-Organization/Premium-website/actions/runs/42085180795): **completed successfully**. Frontend job 127448228274 and Laravel job 127448227879 both completed/success. Actual Laravel log: **64 passed / 443 assertions**, 4.53 seconds.

These are GitHub Actions results, distinct from local results above. The subsequent documentation-only commit records this evidence; its current delivery HEAD and final-head CI verification are maintained in the linked PR verification block. Application code does not change in that evidence commit. The published Git trees were verified equal to the locally tested committed trees, and both local branches track their matching remote branches.

**Recommendation: Ready for independent review as two dependent draft PRs. Not authorized for release.** Production invitation email transport remains deliberately unavailable, with raw test-token activation closed in production. Real deployed infrastructure, mail provider, private storage, rate limiting, retention/relationship-end policy and staged backup/restore verification remain release prerequisites. Both feature flags stay off operationally. Neither PR was merged; no deployment, operational migration/data reset, live invitation or Phase 7 work occurred.

Rollback detail: previous binaries can continue using the unchanged business schema and reading existing B2B names/products, but old B2B profile validators do not understand all new optional product/media/display fields. After portal writes, pause B2B profile editing during a binary rollback until a compatible forward version is restored; retain the new JSON metadata, additive tables, receipts/audits and private objects. Do not strip fields or roll back business data to make old editors accept them. Normal financial/CRM workflows and their schema were not changed.

The local isolated previews are ERP http://127.0.0.1:18881/ and website http://127.0.0.1:18891/. The saved synthetic data includes an approved exhibitor amendment, a submitted buyer proposal, independent participant decisions, reviewed publication, two meeting histories and a completed organizer reschedule. These are test records and dates, never operational Green Life Expo figures.

## Phase 6.1 — Production Onboarding and Security Hardening

This section supersedes Phase 6's development-only invitation and PDF readiness statements, not its ownership, authorization or business rules. No merge, deployment, operational activation, live mail, provider account, DNS change or Phase 7 work is authorized by this delivery.

### Authority and secure invitation delivery

ERP remains the sole invitation, source eligibility, exhibition and membership authority. The website owns external participant identities, passwords, devices and dedicated participant sessions. Integer participant/exhibition IDs remain ERP IDs; external identity, membership, invitation, delivery and activation-receipt references remain UUIDs. No user, business or migration tables are merged between applications.

ParticipantInvitations persists authorization and a delivery intent inside the authorized employee transaction. A dedicated Laravel job carries only a delivery UUID and is dispatched after commit. A bounded scheduled sweep recovers undispatched intents. ParticipantInvitationMailer uses a dedicated Laravel SMTP-over-implicit-TLS mailer with certificate validation and authentication; it is compatible with an approved provider's secure SMTP offering, including providers such as SES or Postmark when their approved SMTP endpoint is configured. No native provider API driver or provider SDK is added. A future API-specific adapter must implement the same narrow acceptance/failure contract and undergo separate verification.

Production issuance never returns a secret to staff or the admin API. Invitations contain a SHA-256 hash of a cryptographically generated 64-character secret, with substantially more than 256 bits of entropy. Encrypted, expiring delivery payloads use a separate managed 32-byte AES-256-CBC key with authenticated Laravel encryption. They are not invitation plaintext columns and never enter generic queue payloads. Separate ERP and website delivery keys are required; neither key is APP_KEY or an HMAC service key.

Mail includes only reviewed exhibition/organization names, recipient, role, explicit expiry in UTC, instructions and security guidance, in English or Arabic. A support contact is included only when explicitly configured. Templates escape dynamic content and load no external tracking image. Link tracking must be disabled and approved. SMTP acceptance is recorded as provider_accepted, never delivered. Sandbox acceptance is explicitly sandbox_accepted. No actual email service, domain identity, SPF, DKIM, DMARC or delivery callback is verified by fake mail tests.

Invitation authorization states are independent of delivery: issued, redeemed, expired (derived from expiry), revoked. Legacy consumed records are identified by redeemed_identity_id even when newly added status timestamps are null. Delivery states include pending, sending, provider_accepted, sandbox_accepted, failed, bounced, delivery_unknown and cancelled. Staff can issue, revoke, rotate/resend, reissue an expired unused invitation and reconcile a reported failure/bounce/unknown outcome. Reconciliation is scoped and audited; it cannot manufacture delivered evidence. No unauthenticated callback endpoint exists. Selecting a future provider webhook requires actual signature validation, timestamp/replay protection, idempotency and bounded event parsing before exposure.

Resend requires a current, unused, unrevoked, unexpired invitation and fresh reason, at least 60 seconds since its last change, and at most three delivery generations per hour. It rotates the hash, invalidates the old generation and erases its pending ciphertext. Reissue creates a fresh authorization record with supersedes_id and fresh staff evidence. Revoked invitations cannot be reopened. Initial issuance is also bounded to three per organization/recipient per hour. Delivery attempts are capped at five, with exponential backoff for explicitly known temporary failures. Permanent rejection is failed; ambiguous SMTP timeout or worker lease expiry is delivery_unknown and must not be blindly retried. An authorized resend rotates the proof after review. Provider exceptions and confidential debug transcripts are not persisted as status text.

Invitation events are append-only through application services. Record delivery attempts, rotations, revocation, redemption and rejected reuse separately from current-state rows. Restrict direct database mutation and apply approved retention controls; application-level append-only behavior is not a claim of cryptographic tamper-proof storage.

### Activation, linking, replay and revocation

Invitation links place the proof in the HashRouter fragment. The first frontend import captures it in module memory and immediately replaces navigation with the token-free route before application imports, analytics or error handlers. No localStorage, sessionStorage, server query, browser console or general-purpose telemetry is used for the proof. A reload after stripping requires reopening the original email link. Recovery links receive the same treatment. GET/link preview and invitation preflight do not redeem.

The website previews a valid invitation through the existing purpose-specific signed gateway. Account activation requires the explicit form action and strong password. ERP rechecks current commercial/buyer eligibility, recipient, role, expiry, revocation, proof generation and delivery-channel evidence, then atomically binds the authoritative membership to the intended UUID. Email verification is set locally only after a valid verified_email acknowledgment. The synthetic raw-token path now requires its explicit test flag, APP_ENV=testing, loopback MySQL, an exact allowlisted disposable database name, no DB_URL, and actual SELECT DATABASE() equality. An environment name alone cannot enable it or the non-network sandbox.

The lock order is identity control, participant, invitation, then membership. Current source rows are rechecked under the appropriate existing locks. Reuse by another identity is rejected and audited; same-identity acknowledgment is idempotent only while the membership remains authorized. Previously revoked membership cannot be revived by an old or merely pending invitation: a fresh staff regrant must name the revoked membership and bind its current revocation fingerprint. Global identity deactivation remains authoritative and cannot be undone through activation.

A local activation receipt reserves the same UUID and proof hash across an uncertain ERP outcome. A missing/malformed acknowledgment leaves an inactive, unverified reservation and reports failure. The explicit reconciliation action obtains fresh ERP proof and the original binding, then confirms the same membership without replacing its password or duplicating its identity. Existing verified accounts must sign in and link a valid invitation for their own email; submitted identity/email fields cannot choose another account. Existing memberships and passwords remain intact.

PortalTransport and ERP ParticipantMedia now assemble bounded response streams across partial reads, preserving TLS validation, fixed peer URLs, no redirects, purpose-specific HMAC signatures and hard byte limits. A real isolated browser activation exposed the old one-read/EOF assumption; chunked-stream tests protect its correction. Gateway authentication, timestamp, persistent nonce and actor-device/version checks, source revocation and command idempotency remain in force. No frontend service credential is introduced.

### Independent participant recovery

Participant recovery uses the existing portal_users password broker and reset table, never CMS users or ERP employees. Responses are generic for absent, inactive, unverified and eligible recipients and do not claim delivery. Existing route throttles remain. A custom Laravel notification channel persists an encrypted, short-lived recovery intent; its dedicated job contains only its delivery UUID. The worker verifies the current identity auth_version and current broker proof before delivery. Replaced/expired tokens and cancelled intents cannot be sent as valid recovery proofs. Unknown acceptance is not blindly retried; a new rate-limited recovery request supersedes the proof after broker throttling permits it.

A successful reset consumes the token once, applies the existing strong-password rules, increments auth_version and revokes all prior participant devices. Pending recovery payloads are cancelled/erased. Existing CMS and ERP password flows are untouched. Explicitly known temporary transport failures use bounded exponential backoff; permanent or ambiguous failures never produce a delivery confirmation. Expired encrypted invitation/recovery payloads can be erased with portal:purge-delivery-secrets even while sending is disabled. This command preserves authorization, account and audit rows. Schedule it and monitor its execution; expiry alone does not physically erase a database backup.

### Private evidence quarantine

Website PortalEvidence and PortalEvidenceScanner introduce a private TLS ClamAV INSTREAM boundary. No scanner account or real engine was connected. Isolated tests inject clean, infected and unavailable outcomes; these tests verify application enforcement, not actual malware detection efficacy. Upload requires separately enabled and approved scanning configuration. PDFs go to private quarantine, with type/size checks, hash, status, attempt count, lease, claim UUID and append-only scan outcome records. An old worker cannot overwrite a newer claim's result. Stream writes have a bounded deadline and TLS peer/name validation. No arbitrary client-provided scanner origin is accepted.

No pending, legacy-unscanned, infected, unavailable or changed-hash PDF is released to an owner, authorized reviewer, ERP delegated reader or a new amendment submission. Required scanner outage also blocks release of a previously clean PDF until the configured boundary is available again. Uploads and PDF release require a bounded certificate-verified TLS PING/PONG health check as well as approved configuration; a clean result and matching bytes are still required for release. Health checks do not rescan the file. The adapter uses the [ClamAV protocol](https://docs.clamav.net/manual/Usage/ClamdProtocol.html) behind an approved TLS endpoint. Private file contents and malware signature strings are not put in audit logs. Existing media IDs, storage paths and evidence relationships remain unchanged. Null legacy scan status means quarantine until a real approved scan; it never means clean. Images retain existing validated re-encoding and private access rules.

The bounded scan sweep retries unavailable scans up to three attempts. After infrastructure recovery, an authorized CLI operator can use portal:scan-evidence --retry=<FILE_UUID> --reason=<APPROVED_TICKET_REFERENCE> for an unavailable file only; a reason hash and retry history are retained. Infected files cannot be released by this retry path. Selection, update policy, engine signatures, TLS service isolation, real malware test fixtures and operational monitoring remain external release prerequisites.

### Exact configuration and infrastructure gates

Both backend/.env.example files list the exact new variables with empty secrets and disabled flags. Never copy a testing environment into production. Existing PARTICIPANT_PORTAL_API_ENABLED (ERP) and PARTICIPANT_PORTAL_ENABLED (website) remain false by default. New operational switches are independently false:

- PARTICIPANT_ONBOARDING_ENABLED, PARTICIPANT_ONBOARDING_LIVE_MAIL_AUTHORIZED, PARTICIPANT_ONBOARDING_SENDER_APPROVED and PARTICIPANT_ONBOARDING_TRACKING_DISABLED_APPROVED.
- Website PARTICIPANT_ONBOARDING_RECOVERY_ENABLED, PARTICIPANT_EVIDENCE_SCANNING_ENABLED and PARTICIPANT_EVIDENCE_SCANNER_VERIFIED.
- PARTICIPANT_ONBOARDING_TEST_INVITES, PARTICIPANT_ONBOARDING_SANDBOX and PARTICIPANT_EVIDENCE_SCANNING_SANDBOX must remain false outside explicit isolated synthetic testing.

Configure a fixed HTTPS PARTICIPANT_ONBOARDING_WEBSITE_ORIGIN without path/query/credentials/fragment. Configure approved PARTICIPANT_ONBOARDING_FROM_ADDRESS, FROM_NAME and SENDER_DOMAIN. ERP optionally supports SUPPORT_EMAIL, LOCALE=en|ar and EXPIRY_HOURS (clamped 1–24, default 24). Select the dedicated MAILER: participant_onboarding in ERP, participant_recovery on the website. Configure PARTICIPANT_ONBOARDING_SMTP_HOST, SMTP_PORT (default 465), SMTP_USERNAME and SMTP_PASSWORD through server-side secret management. Certificate verification is mandatory. PARTICIPANT_ONBOARDING_SMTP_SCHEME defaults to smtps (implicit TLS, normally port 465); smtp is supported only with require_tls=true and auto_tls=true (required STARTTLS, normally port 587). Plaintext SMTP is rejected. Installed Symfony Mailer 7.4.22 (ERP) and 8.1.10 (website) support this transport requirement; no dependency upgrade was needed. General CMS/system mailers remain independent. Placeholder example only: SMTP_HOST=<approved-provider-host>, FROM_ADDRESS=<approved-sender>, DELIVERY_KEY=<managed-base64-32-byte-key>; never a fabricated business mailbox.

PARTICIPANT_ONBOARDING_KEY_ID selects primary or previous; DELIVERY_KEY and PREVIOUS_DELIVERY_KEY populate those independent slots. Rotate into the inactive, fully drained slot, switch the selected key ID for new intents, retain the old slot until every payload referencing it is erased or safely re-encrypted under a separately authorized process, then retire it. Do not rename key aliases or replace a key still referenced by pending ciphertext. Preserve APP_KEY and HMAC rotation continuity independently, including all backup recovery keys. An unknown/unavailable delivery key must fail closed; do not fall back to plaintext or APP_KEY.

Website scanning variables are PARTICIPANT_EVIDENCE_SCANNER_HOST, SCANNER_PORT (3310), SCANNER_CA_FILE and the three independent scanning flags listed above. The endpoint is trusted operator configuration, uses certificate-verified TLS, and must be isolated from public clients. A flag alone is not evidence that an engine is healthy or approved.

Production mail guards require APP_DEBUG=false, shared cache (redis/database/memcached), durable queue (redis/database/sqs), required cryptographic keys, approved sender and explicit live-mail authorization. Do not treat adapter support as infrastructure provisioning. Run dedicated workers for participant-onboarding (ERP), participant-recovery and participant-evidence (website), with non-overlapping leases/timeouts and appropriate encrypted/private database access. Jobs have bounded claims; a crash/unknown SMTP outcome requires reconciliation. Run the Laravel scheduler on approved infrastructure with shared atomic locks; bounded recovery sweeps are registered and gated independently. Monitor pending age, failed/unknown mail, bounce evidence, scan age/failures, nonce growth, outbox reconciliation and key availability. Pause workers before restoring backups; do not replay all pending commands blindly.

The sender-domain owner must independently verify SPF, DKIM and DMARC alignment and policy, approved From/return-path identity, least-privilege send-only provider credentials, TLS, link tracking disabled, suppression/bounce handling, rate limits, sandbox allowlists, monitoring and credential rotation. Record actual provider message IDs and approved-recipient staging evidence. No DNS record or sender domain was configured or verified here.

Actual staging still requires authorized provisioning: HTTPS and certificate-chain validation on both origins; trusted reverse-proxy configuration; secure HttpOnly SameSite participant cookies and CSRF; separate employee/CMS/participant sessions; isolated MySQL; shared rate limiting/cache locks; durable jobs/scheduler; private storage and backup permissions; scanner transport isolation and signature updates; sanitized logging without request bodies/tokens; alerting; encrypted backups and key management; explicit privacy/retention, representative approval, support and bounce policies. Production topology, proxy trust and availability are not established by localhost tests.

### Schema-first deployment and rollback blueprint (not executed)

1. Obtain separate staging authorization and snapshot both databases, private object keys/files, configuration, queue/outbox state and required encryption/HMAC key versions. Verify backup access and a restore into new isolated targets. Keep all new flags off and workers stopped. Never restore over operational tables to test a backup.
2. Review additive 2026_11_07_000001 migrations in each repository against actual deployed Phase 6 schema and data. Apply schema first to the correct application database under a reviewed change window. UUID ownership stays unchanged; new invitation/media fields are nullable and legacy rows are not rewritten. Previous application code can ignore the extra columns/tables. Check MySQL DDL locking on representative staging data before production.
3. Deploy compatible ERP and website code together with flags still off. Retain original Phase 6 keys/media paths. Verify original employee/CMS/portal separation, business pages, financial invariants, receipts, commissions, reservations, meetings and existing command history before enabling onboarding.
4. Configure shared cache, dedicated durable queues, private storage, managed delivery keys and disabled scheduler/worker startup. Validate provider TLS/domain/suppression controls and real scanning in authorized staging using synthetic allowlisted recipients. Fake transport or a configured flag cannot satisfy real-provider acceptance.
5. Test A–P workflows, real two-process redemption/revocation races, real browser email-link handling, English/Arabic and measured small CSS widths. Exercise restore recovery with workers paused, reconcile previously provider-accepted/unknown messages before any resend, recheck actor-device/version and source permissions on pending portal commands, preserve accepted introductions and completed meeting history.
6. Obtain business/security/privacy and explicit release authorization before enabling independent flags or sending real invitations. Enable gradually with controlled recipients, monitoring and an approved stop condition. This PR does not grant that authorization.
7. To roll back behavior: stop mail/scan workers and affected scheduler entries, disable onboarding/recovery/scanning/portal flags as required, preserve all receipts, invitation/delivery events, nonce records, membership revocation and files, reconcile in-flight work, then roll back to the reviewed application version. The previous Phase 6 raw production path remains blocked. Keep PDF-dependent workflows disabled on an older version that lacks scan enforcement; old code must not become a bypass. Do not roll back key continuity or restore stale privileges.
8. Do not run migration down after real Phase 6.1 writes: it drops delivery, receipt and scan history/columns. Nullable/additive schema may remain while behavior rolls back. Destructive removal requires a separate data-preservation plan, verified backups and explicit authorization. No reset, fresh migration, seed or operational restore is part of this blueprint.

### Verification evidence and readiness

<!-- PHASE61_EVIDENCE_START -->
Final local verification (2026-11-07): website **86 tests / 573 assertions passed**; ERP **215 tests / 2,696 assertions passed** (1,000.21 seconds), with zero failures. ERP frontend **25 tests and all 38 navigation destinations** passed; website frontend **18 tests** passed. Both TypeScript checks and production builds passed. Additional hardening covers partial stream reads, actual two-process verified-email redemption, payload expiry, sandbox-proof provenance, SMTP 4xx/5xx/ambiguous rejection classification, and both implicit TLS and required STARTTLS with mocked transports. These are local results, not GitHub Actions results. Final-head Actions results will be linked in the draft PR after publication; a pending run is not a pass.

Sandbox mail is non-network array delivery only, confined to exact loopback disposable database names and actual SELECT DATABASE equality. It issues **verified_email_sandbox** proofs. Both applications reject those proofs outside that sandbox. Normal verified_email protocol tests use an injected fake approved SMTP transport; they establish code behavior, not sender approval or real deliverability. Raw legacy test tokens require a separate explicit isolated-test gate. Participant cookies may lose Secure only in this strict disposable environment, never merely because APP_ENV says local/testing.

Read-only operational fingerprints matched the unchanged local baseline: ERP **37 tables / 3 private files**, website **19 tables / 2 assets**. Original synthetic commercial rows also matched their saved baseline. The 2026-11-05 isolated restore exercise verified **73 ERP and 36 website table checksums** into newly named empty databases on port 23307. Encrypted configuration and a newly created synthetic backup-only PDF round-tripped byte-for-byte. That exercise predates the final scan-event reason_hash column and Nov7 synthetic account additions; it is snapshot restore evidence, not a final deployed-schema or operational-file disaster recovery certification. No operational database was migrated or restored.

Browser evidence is in the website draft's [sanitized evidence directory](https://github.com/Omar-Fouad-Organization/Premium-website/tree/codex/phase-6-buyer-exhibitor-portals/docs/phase61-evidence). **196 checks passed**: 14 screens × English/Arabic × seven actual CSS viewport sizes (320×700, 360×800, 375×812, 390×844, 414×896, 768×1024, 1280×900). Each measurement asserts actual route and a screen-specific DOM marker, innerWidth/innerHeight, root clientWidth/scrollWidth, viewport meta, direction and actual DPR. A same-origin test iframe with outer zoom 2 calibrated Windows DPI quantization; application window properties and styles were not spoofed. Root scrollWidth never exceeded clientWidth. Only existing portal row wrapping and catalogue fieldset intrinsic sizing were corrected; no branding, fields, dialogs, public layout or ERP business-screen design was replaced.

| Scenario | Local automated coverage | Actual browser evidence / limit |
| --- | --- | --- |
| A Exhibitor / B Buyer | Invitation, activation, eligibility and membership tests | Both activated through real isolated paired gateways and array mail |
| C Reuse / D Expiry / E Revocation | Replay, expiry, revocation and no unauthorized restoration | Automated fault cases; no live recipient |
| F Mail failure | 4xx retry, 5xx permanent failure, unknown outcome, bounded retry and secret purge | Injected transport only; real provider not verified |
| G Partial activation | Durable receipt, idempotent acknowledgement and reconciliation | Exercised acknowledgment recovery without a duplicate account |
| H Multiple organizations | Identity-bound linking and membership scoping | Existing buyer signed in and explicitly linked second context; password retained |
| I Cross-organization / J CMS and ERP escalation | Record/exhibition/role matrix and document boundaries | Staff Finance returned to sign-in; participant CMS read exposed no records; HTTP permission assertions are automated |
| K Recovery | Scoped broker, one-time reset, active verified user, version/device revocation | Backend tests; reset delivery used no external provider |
| L Revoked queued commands | Authority/version/device rechecks and old command regressions | Automated only |
| M Link scanners | Preview is non-consuming; fragment captured and stripped before render | Real GET preview left reader invitation unused; URL proof removed |
| N Concurrent redemption | Real two-process MySQL race, one membership and rejection audit | Backend process test, not two human browsers |
| O PDF evidence | Pending/legacy/infected/unavailable fail closed; clean hash and claim checks; scan history | Upload rejected with scanner unavailable and no media row created; real engine not verified |
| P Original Phase 6 | Existing suites retained, finance/reservations/commissions/permissions and outbox regressions | Held accepted introduction, scheduled meetings and multi-context history retained |

| Component | Implemented / local verified | Final-head CI | Staging verified | Required external configuration | Production approved |
| --- | --- | --- | --- | --- | --- |
| Verified-email lifecycle/outbox | Yes | See draft PR exact-head run | No | Sender, SMTP/TLS, managed keys, shared queue/cache, policy | No |
| Activation/link/reconciliation | Yes | See draft PR exact-head run | No | Paired HTTPS gateways and release authorization | No |
| Participant recovery | Yes | See draft PR exact-head run | No | Independent recovery mail transport and operations | No |
| PDF quarantine/scanning | Fail-closed boundary and injected outcomes verified | See draft PR exact-head run | No | Approved TLS scanner, signatures, availability and efficacy checks | No |
| Mobile/RTL | 196 measured browser checks, committed JSON and EN/AR screenshots | CI does not replace browser evidence | No | Repeat against authorized staging | No |
| Business/data/design preservation | Regressions and exact local fingerprints passed | See draft PR exact-head run | No | Verify real deployed data, backup and topology | No |

**Recommendation: ready for code review; blocked for operational release.** All new operational flags remain off by default. Real provider/domain/SPF/DKIM/DMARC, tracking suppression and bounce handling, TLS scanner efficacy, shared infrastructure, privacy/retention/support approval, deployed-data checks and authorized staging must be evidenced before a separately authorized rollout. No deployment, real mail, operational matchmaking activation, merge or Phase 7 work was performed.

For rollback to older Phase 6 code, explicitly disable **both applications' existing participant portal flags** as well as new onboarding/recovery/scanning flags before switching code. Older code cannot enforce the new quarantine contract. Keep additive schema, private files, immutable events, receipts and encryption keys; do not run migration down after real writes.
<!-- PHASE61_EVIDENCE_END -->


### Phase 6.1 file impact inventory

Exact paths below describe this incremental hardening scope; existing financial/business models and public website design components are not rewritten.

- `backend/app/Console/Commands/DeliverParticipantInvitations.php`
- `backend/app/Console/Commands/PurgeParticipantDeliverySecrets.php`
- `backend/app/Jobs/DeliverParticipantInvitation.php`
- `backend/app/Mail/ParticipantInvitationMail.php`
- `backend/app/Services/ParticipantDeliveryCipher.php`
- `backend/app/Services/ParticipantDeliveryFailure.php`
- `backend/app/Services/ParticipantInvitationDelivery.php`
- `backend/app/Services/ParticipantInvitationMailer.php`
- `backend/app/Services/ParticipantInvitations.php`
- `backend/app/Services/ParticipantOnboardingGate.php`
- `backend/config/participant_onboarding.php`
- `backend/database/migrations/2026_11_07_000001_add_participant_onboarding_delivery.php`
- `backend/resources/views/mail/participant-invitation-text.blade.php`
- `backend/resources/views/mail/participant-invitation.blade.php`
- `backend/tests/Feature/ParticipantInvitationMailerTest.php`
- `backend/tests/Feature/ParticipantMediaTest.php`
- `backend/tests/Feature/ParticipantVerifiedEmailTest.php`
- `backend/.env.example`
- `backend/app/Http/Controllers/ParticipantAdministrationController.php`
- `backend/app/Http/Controllers/ParticipantGatewayController.php`
- `backend/app/Services/ParticipantMedia.php`
- `backend/config/mail.php`
- `backend/routes/console.php`
- `backend/tests/Feature/ParticipantConcurrencyTest.php`
- `backend/tests/Feature/ParticipantOnboardingTest.php`
- `backend/tests/Support/participant-worker.php`
- `docs/PHASE-6-PARTICIPANT-PORTAL-API.md`
- `src/b2b/PortalAdministration.tsx`
