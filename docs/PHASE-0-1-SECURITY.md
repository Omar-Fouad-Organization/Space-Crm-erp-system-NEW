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

## Final independent verification of draft PR #1

Reviewed starting head: `c61ad9e6390293461a1988c75fd9492dd6487c6f`, against audited base `a5d054305c2c8c5b49b688ed4e89e17cd5c9c168`. All original 17 changed files were examined. The review concerns code behavior, not a claim of production execution or third-party sign-off.

| Original file | Review conclusion |
| --- | --- |
| `backend/app/Http/Controllers/CrmController.php` | Parent-document authorization precedes attachment deletion, audit, and private-file mutation; existing 403/404/204 conventions retained. |
| `backend/app/Http/Controllers/SecurityController.php` | Revocation/reset/MFA changes only; reset token consumption needed the additional concurrency correction below. |
| `backend/app/Http/Controllers/SessionController.php` | Locked password/status/MFA validation, explicit stamp issuance, and current-session logout only. |
| `backend/app/Http/Controllers/WorkspaceController.php` | Only atomic access-setting mutations and revocation; existing administrator restrictions retained. |
| `backend/app/Http/Middleware/ValidateStaffSession.php` | Active status, fresh identity/version, legacy-session rejection, and logout denylist checked server-side. |
| `backend/app/Models/User.php` | Only hidden authentication metadata and integer cast. |
| `backend/app/Services/CrmService.php` | User-security revocation/redaction and booth locking read only; financial formulas and eligibility conditions unchanged. |
| `backend/app/Services/SessionRevocation.php` | Locked version increments prevent lost updates and reject stale keep-current requests; logout insertion needed an atomic upsert. |
| `backend/bootstrap/app.php` | Registers the validator after session middleware in the web group, including the public session endpoint. |
| `backend/database/migrations/2026_11_02_000006_add_auth_version_to_users.php` | Additive schema with zero-default version and separate expiring hash table; previous migration history unchanged. |
| `backend/tests/Feature/AttachmentAuthorizationTest.php` | Own/team/module denials preserve file and row; authorized private attachment operations succeed. |
| `backend/tests/Feature/BoothConcurrencyTest.php` | Separate committed synthetic fixtures and real competing connections; disposable migration reversal does not erase the original user. |
| `backend/tests/Feature/SessionRevocationTest.php` | Real browser-cookie jars for file/database/cookie drivers; CSRF, MFA, reset, unrelated accounts, and replay. Review adds persisted legacy-session cases. |
| `backend/tests/Feature/WorkflowTest.php` | Only an added assertion that reset invalidates the existing browser. Existing workflow assertions retained. |
| `backend/tests/Support/reserve-booth.php` | Test-only worker with explicit loopback/testing/database guard and synchronized start. |
| `backend/tests/TestCase.php` | Explicit test-only stamps for actingAs; database guard executes before refresh hooks. |
| `docs/PHASE-0-1-SECURITY.md` | Baseline, limitations, safety evidence, and release runbook only. |

### Necessary review corrections and new tests

1. The initial reset implementation locked the password write, but Laravel's broker checked the reset token before that transaction and consumed it afterward. The user-row lock now covers broker validation, password write, version increment, and token deletion in one transaction. A competing reset must observe the consumed token and cannot change the password a second time.
2. Logout's read-then-insert operation is now a single database upsert, preventing duplicate-key failures for simultaneous logout of the same session.
3. `SecurityConcurrencyTest.php` / `security-race.php` synchronize two independent processes for keep-current revocation, revoke-all, same-session logout, and same-token reset. Expected results are respectively one winner/one stale request, two serialized increments, two successful logouts/one tombstone, and one reset/one invalid token.
4. `ReleaseCompatibilityTest.php` / `previous-application.php` archive the actual audited application from Git, load its original application classes with unchanged installed framework dependencies, and run it against the expanded disposable schema. They verify old-code login, client creation, new-user zero defaults, and preservation of the existing synthetic user's columns. They do not run the old migrations or touch operational data. Full Git history and the existing ZIP extension are required.
5. Persisted legacy-session tests reproduce the old unstamped issuance path using a test-only route across file/database/cookie drivers. Such sessions are rejected and cannot silently acquire a current stamp; fresh normal login succeeds.

No unrelated application functionality, frontend source, frontend dependencies, commercial eligibility, financial calculations, receipts, or commission rules were changed during review. The original single-allocation booth invariant remains enforced by the current-read fix. Existing operational rows and private files remain subject to before/after read-only fingerprint verification.

### CI isolation and results

The reviewed branch initially contained no GitHub Actions workflow and no PR workflow runs. `.github/workflows/erp-tests.yml` now runs PHP 8.4 and locked Composer dependencies with a MySQL 8.4 service on a GitHub-hosted Ubuntu runner. Each job receives its own disposable `space_crm_test` instance, a database-scoped synthetic account, and a test-only encryption key. No repository secrets, operational `.env`, production credentials, self-hosted runner, deployment command, or operational database endpoint is referenced. Actions are pinned to verified commit SHAs with read-only contents permission and checkout credentials disabled.

There is one sequential suite per job, without a matrix or `--parallel`. PR and push jobs may overlap on separate runners, but never share a MySQL service. Local suites are also run sequentially. Child race workers share only the current test's committed synthetic fixtures and do not execute schema refreshes.

Initial workflow attempt `41505463139` failed before creating any job because the service-port expression used the unavailable job context at job-env level. The port is now resolved in a supported step context and exported through `GITHUB_ENV`. This was workflow configuration failure, not a Laravel test result. Context restrictions: https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#context-availability.

The next CI attempt successfully installed dependencies and verified the disposable database, then PHPUnit refused discovery because `phpunit.xml` declared `tests/Unit` but the empty directory was absent from a clean checkout. A tracked `.gitignore` now preserves that directory. No Laravel test ran in that failed attempt. This is a clean-checkout portability correction; no placeholder test or test-suite exclusion was added.

Final local review suite: **92 passed, 1,418 assertions, zero failures/skips**, using the existing PHP 8.4 installation and isolated MySQL database (196.99 seconds). The focused process-level security suite passed 4 tests / 43 assertions; the historical-application compatibility test passed 1 test / 7 assertions. Local JUnit evidence is in ignored `logs/phase-1-review-results.xml`.

After the final local suite, read-only fingerprints again confirmed **zero changes across all 37 operational tables and all three private files**. The authentication migration remains unapplied to the operational database. `src`, `public`, frontend manifests/build configuration, and Composer manifests/lockfile have zero diff from the audited base. GitHub Actions results are recorded separately after completion; local results do not substitute for CI or deployment smoke testing.

### Exact schema-first release sequence (documentation only; not executed)

1. Obtain separate production authorization and identify the real hosts, database, storage, session configuration, deployed SHA, and schema. Confirm the previous migrations are applied. Verify a backup by restoring it to a distinct recovery environment. Record operational relationship and financial baselines without publishing records.
2. Prepare the reviewed release separately using its lockfiles. Keep the current application version available. Hold staff/API authentication and security mutations at the gateway, drain existing staff requests, and stop/restart any workers capable of changing users or authentication. This prevents old nodes from issuing unstamped sessions or changing credentials during cutover. Do not change the website or session driver.
3. From the new release's `backend` directory, using the explicitly verified target environment, execute only `php artisan migrate --path=database/migrations/2026_11_02_000006_add_auth_version_to_users.php --force`. This is a future operator instruction, not permission for this task to run it. Validate the new unsigned BIGINT default-zero column, hash primary key, expiry index, and migration entry before exposing new code. No business-table copy, reseed, or per-user data backfill is required.
4. MySQL DDL is not an all-or-nothing transaction. If either schema statement fails, retain the traffic gate, inspect the actual partial schema and migration history, and use an approved repair plan. Do not repeatedly rerun a partially applied migration or use rollback/reset against the operational database.
5. Switch all web nodes to the reviewed code together; restart old workers and rebuild release-specific caches through the normal deployment procedure. Preserve existing application key, cookie settings, database, and private storage. New code on missing schema is not a supported operating state; legacy sessions deliberately require a fresh sign-in.
6. Before reopening staff traffic, verify synthetic account login/CSRF, MFA, logout replay, two-browser revocation, scope denial, and private-file access on the actual session driver. Reconcile operational financial/relationship baselines and watch authentication errors. This task did not execute these deployment checks.

The previous application was **runtime-tested for schema compatibility**, not approved as a secure mixed-version participant: it ignores authentication versions and cannot enforce the new revocation guarantee. Keep the staff gate until every node enforces the new behavior.

### Rollback precautions

Prefer a forward correction retaining the validator and new schema. Do not run `migrate:rollback`, drop the denylist, restore the whole ERP database, or remove version enforcement as a routine application rollback. Those actions can revive previously revoked credentials or erase unrelated business transactions.

If an older non-enforcing application must be restored, keep staff traffic blocked, reconcile in-flight writes, and perform an explicitly authorized security rollback: invalidate this application's server-side sessions, invalidate remember credentials, and change to a fresh application session-cookie namespace before reopening. Cookie-backed sessions require the namespace change because a server cannot erase previously issued browser cookies. Do not flush shared Redis, rotate the encryption key casually (MFA secrets depend on it), or delete unrelated applications' sessions. Retain additive schema and security evidence for the subsequent fixed release. This is environment-specific operational work, not something performed by this PR.
