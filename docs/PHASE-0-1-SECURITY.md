# Phase 0 and Phase 1 security review

Scope: baseline verification and isolated ERP security corrections only. No CMS integration, website changes, database merger, portal, financial-rule redesign, deployment, or target-branch update.

## Verified baseline

- ERP started clean on `feat/laravel-mysql-original-ui`, commit `a5d054305c2c8c5b49b688ed4e89e17cd5c9c168`. The remote target still pointed to that commit when checked during this task.
- Website checkout started clean at `0b33b47262249fefcefb461d357d00e562ae36f0` on `codex/laravel-mysql-migration`. Its committed source tree is identical to audited `main` commit `080ea485b41f034d733f467981aa73ec17b8a6e9`. No website files were changed.
- Implementation is isolated on `codex/phase-1-erp-security`; the target branches were not edited.
- ERP development configuration: `APP_ENV=local`, MySQL on loopback port 3307, database `space_crm`, file sessions, synchronous queue, log mail. No credentials are included here.
- Disposable ERP test database: `space_crm_test` on the local MySQL instance. `tests/TestCase.php` refuses a non-testing environment, non-MySQL connection, or any other database name before refresh migrations run. The concurrency worker additionally requires loopback.
- PHPUnit config overrides sessions to array by default; the new browser tests explicitly exercise file, database, and cookie drivers. File-session fixtures use unique directories under `storage/framework/testing`, not operational session storage.
- ERP private documents: `backend/storage/app/private`; operational file sessions: `backend/storage/framework/sessions`; backup archives: `backend/storage/app/crm-backups`.
- Website configuration identifies a separate local MySQL database, `green_life_expo`, on loopback port 13307, database sessions, and public CMS storage at `backend/storage/app/public`. These configuration facts do not establish a running service or production ownership.
- No verified production host, deployed SHA, database, asset store, proxy policy, worker supervision, or backup retention was established. Production data was not accessed. Repository URLs and local configuration are not production evidence.

## Existing business protections retained

`CrmService`, `WorkflowService`, and `RecordAccess` enforce module permissions, record scopes, actual foreign keys, relationship consistency, transactional changes, decimal financial arithmetic, same-exhibition/currency relations, installment limits, receipt limits, protected approved records, and commission lifecycle rules. Private downloads require document access. Existing regression tests exercise client/deal cycles, booth release, installments, invoices, receipts, commission approval/payment, financial corrections, imports, scopes, and relationships.

The concurrency regression exposed an existing gap beyond the sequential double-booking test: under MySQL REPEATABLE READ, the occupancy query could retain a stale snapshot after waiting on the booth row lock. Two independent processes both returned success in an isolated pre-fix run. The occupancy query now uses a locking/current read. No pricing, allocation eligibility, receipt, or commission rule changed.

## Changes

### Attachment authorization

- `backend/app/Http/Controllers/CrmController.php`: deletion now checks access to the parent document after module authorization and attachment lookup, before database, audit, or filesystem mutation.
- `backend/tests/Feature/AttachmentAuthorizationTest.php`: own/team denial, allowed owner/team deletion, private upload/download, denied file preservation, missing-record behavior, and denied module access.
- Responses retain existing conventions: module denial 403; missing or out-of-scope document/attachment 404; successful deletion 204.

### Driver-independent revocation

- `backend/database/migrations/2026_11_02_000006_add_auth_version_to_users.php`: adds `users.auth_version` with default zero and a hashed, expiring `revoked_staff_sessions` denylist. Existing migrations are unchanged.
- `backend/app/Services/SessionRevocation.php`: centralizes locked, transactional authentication-version increments, remember-token rotation, optional database-session cleanup, retaining only a validated current session, and individual logout revocation. Logout tombstones also reject cookie replay and late recreation of a previously logged-out session; expired entries are removed on subsequent logout.
- `backend/app/Http/Middleware/ValidateStaffSession.php` and `backend/bootstrap/app.php`: validate active status, user identity, authentication version, and logout denylist on web requests, including `/api/session`. Security state is reloaded rather than trusting a cached user object. Legacy sessions without a version stamp fail closed.
- `backend/app/Http/Controllers/SessionController.php`: login validates password/status/MFA under a user-row lock and binds the issued session to that version. Logout invalidates only the current session, regenerates CSRF state, and records its revocation.
- `backend/app/Http/Controllers/SecurityController.php`: explicit other-session revocation, password reset, and MFA enable/disable use the central service. MFA mutations and revocation are transactional; the validated current browser survives MFA changes and explicit other-session revocation. Password reset revokes all browsers and preserves MFA. Non-database drivers list the current browser only and report `session_listing_complete=false`; no complete cross-driver session inventory is claimed. `revoked` remains the number of deleted database rows, while `revocation_enforced=true` indicates version enforcement.
- `backend/app/Http/Controllers/WorkspaceController.php`: scope/team changes and revocation share a transaction; restrictions are checked again on the locked target user.
- `backend/app/Services/CrmService.php`: password, role, status, and email changes revoke older sessions inside the user mutation transaction. Authentication versions are omitted from record presentation and audit payloads. The independent booth fix changes only the occupancy read's locking semantics.
- `backend/app/Models/User.php`: authentication version is integer-cast and excluded from JSON.
- `backend/tests/TestCase.php`: existing `actingAs` tests explicitly seed a valid authentication stamp. This is a test helper, not a production bypass.
- `backend/tests/Feature/SessionRevocationTest.php`: independent encrypted cookie jars, fresh guards/stores, real login, file/database/cookie sessions, account changes, reset, MFA, logout replay, unrelated accounts, legacy/forged stamps, failed-change rollback, and CSRF enforcement. The CSRF test explicitly enables validation normally bypassed by Laravel's testing environment.
- `backend/tests/Feature/WorkflowTest.php`: the existing reset test now verifies that its previously authenticated browser is rejected before testing reset-token reuse.
- `backend/tests/Feature/BoothConcurrencyTest.php` and `backend/tests/Support/reserve-booth.php`: two real PHP processes synchronize at a TCP barrier and compete for the same booth using separate MySQL connections. The same disposable test class verifies additive migration down/up preserves the original user record. It resets shared refresh-test state after its migration teardown.

No frontend source, navigation, styles, dependencies, or website source was changed.

## Test execution and safety

From `backend`, using the existing portable PHP executable:

```powershell
& '..\..\tools\php\php.exe' artisan test --compact
```

Run one suite at a time against `space_crm_test`; refresh/migration suites must not overlap. The two-process concurrency test coordinates its own workers within that single run.

Baseline: **46 tests passed, 972 assertions**. Focused attachment suite: **3 tests passed, 33 assertions**. Focused session suite: **33 tests passed, 329 assertions**. Final clean full suite: **84 tests passed, 1,350 assertions; zero failures or skips**.

Intermediate failures were investigated rather than hidden: the old password-reset test needed to assert new invalidation behavior; the independent-browser helper needed to clear Laravel's cached `auth.driver`; an accidentally overlapping pair of test runs caused invalid disposable-schema failures; and the isolated booth race exposed the actual stale-read defect described above. The overlapping runs did not target the operational database.

The existing Pint executable refused to write the selected files in this environment. No framework or formatter dependencies were installed or upgraded. PHP execution and the final regression suite provide syntax/runtime validation; `git diff --check` checks whitespace.

## Data preservation

A raw PDO, read-only transaction fingerprinted all 37 operational tables before implementation. The comparison uses sorted full-row hashes and emits no row values. All three private files were also fingerprinted, including relative-path and content integrity. A subsequent comparison found **zero changed tables and zero changed private files**. Evidence summaries are local ignored files under `logs/phase-1-*`; credentials and records are not committed.

No operational migrations, seeding, refreshes, resets, security mutations, or authenticated HTTP smoke tests were run against `space_crm`. The new migration was exercised only in `space_crm_test`. Accordingly, application deployment/use of the new authentication code requires applying that migration first; it is intentionally not a live operational cutover.

## Backup and release procedure

The existing `crm:backup` command creates a SQL/private-file ZIP and checksum manifest. Its `--verify` option restores into `space_crm_restore_check`, checks row counts and foreign keys, and verifies private files. This task inspected that procedure; it did not execute an operational backup or restore, and does not claim a newly proven recovery time or production restore.

For a later authorized release:

1. Confirm the actual deployment environment and session configuration; obtain a verified backup and isolated restore.
2. Apply the additive migration before exposing the new application code. The old application tolerates the added schema; the new login fails closed if the migration is missing.
3. Deploy both the request validator and revocation writers together across all application nodes. Mixed old/new workers would not uniformly enforce revocation.
4. Expect a one-time sign-in for old unstamped sessions. No session-driver migration is needed.
5. Verify real browser login, CSRF, MFA, logout, and two-browser revocation on the deployed driver with controlled synthetic accounts.
6. Retain the new schema during application recovery. Removing enforcement can resurrect older sessions; do not treat a downgrade as an ordinary reversible UI release. A security rollback requires controlled traffic handling and invalidation of previously issued sessions/remember credentials before an older non-enforcing application is made available. Migration `down()` is tested for isolated recovery, not authorization to drop live security state.

Revocation prevents subsequent authenticated requests; it cannot cancel a business transaction already authorized and running. Shared schema, clock synchronization, cookie configuration, and request-time database access remain deployment requirements. Redis/memcached/DynamoDB were not available for runtime driver tests; version enforcement is storage-independent, but their deployed adapters still require smoke verification. Full session enumeration is supported only for the database driver.

## Phase 2 boundary

This phase does not add action-level/exhibition-level grants or address website HTML/publication/intake concerns from the architecture audit. Those remain separate work. Phase 2 can be designed on these reviewed security foundations, but production readiness still requires the inventory, backup/restore, migration, deployment, and browser checks above. Do not begin Phase 2 without authorization.
