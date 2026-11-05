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
