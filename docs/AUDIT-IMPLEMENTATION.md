# Audit fixes and workflow additions

The React interface, original fields, dialogs, navigation, and existing review data are retained. New tools use the same cards, buttons, forms, and tables. The former empty Finance chart/report areas and meeting calendar now contain working features. Additional links open the workflow workspace; no replacement frontend was introduced.

## Audit concerns addressed

| Concern | Result |
| --- | --- |
| Finance date filters and exports | Cash movements and won sales use the selected period. Current balances are explicitly distinguished from period movements. Summary, installment, commission, and meeting CSV exports work. |
| Sales value confused with cash | Won deal value, net cash, credits, outstanding balances, and commission recoveries have separate calculations. Refunds and reversals feed Finance, Dashboard, and Analytics through dated cash movements. |
| Record ownership | Administrators can configure organization, own, or team visibility. Module permissions continue to apply. Existing accounts retain their previous organization visibility. Scope changes revoke the affected account's sessions. Management gets a minimal account directory, not HR or account-management privileges. |
| Financial corrections | Original receipts are immutable. Requests for refunds, full remaining receipt reversals, installment-allocated credit notes, and paid-commission recovery require a different administrator/manager to review them. Amount limits and source relationships are revalidated transactionally. |
| Backup/recovery | Private SQL/file ZIP backups, SHA-256 manifests, daily scheduling, status/heartbeat display, and an admin backup action. Recovery verification imports only into the fixed `space_crm_restore_check` database, validates counts/foreign keys, and restores/verifies private files. The application database account is not granted recovery-administrator privileges. |
| Unfinished Finance/Meetings controls | Actual Finance charts and reports; meeting CSV export; month navigation and meeting details from the calendar. Existing reminder actions lead to reminder scheduling. |
| Unbounded record lists | API pagination (maximum 100 rows), filters, bounded global search, batched labels and financial balances. Clients and Deals use 50-row server pages and server filters. Client-related data is fetched for displayed clients. Other legacy modules and form pickers still use the compatibility loader, which traverses API pages. |
| Account recovery/security | Email-token recovery, optional encrypted authenticator TOTP, replay protection, and revocation of other sessions. Password and MFA changes are tested in the isolated test database; review-account credentials and MFA settings were not changed. Raw session IDs, password hashes, and MFA secrets are excluded from ordinary API/audit output. Rate limits are isolated by operation. |

## New workflows and where to find them

Use **Advanced Features** for the workflow links, or the relevant module's link.

| Tool | Behavior |
| --- | --- |
| Activity timeline | Client/deal details combine accessible linked deals, installments, receipts, commissions, tasks, meetings, proposals, documents, support, chat, correction requests, and collection notes. |
| Collections | Won-deal installment balances, aging, collector assignment, follow-up dates, notes/history, and CSV export. Approved credits are allocated to a specific installment. |
| Approvals & Corrections | Requests, independent approval/rejection, reasons, actor history, and immutable correction records. Commercial exceptions cover discounts above 20%, commission rates above 10%, and installment terms beyond 30 days after an exhibition. Applying approved changes still respects existing installment and financial locks. |
| Booth Floor Plan | Saved positions on a 1000 × 600 logical canvas, clickable booth details, current availability, and reservation-expiry scheduling. Only unpaid open booth deals can expire; won deals are retained. |
| Exhibition Profitability | Recorded expenses, net won sales, collections, commissions on won sales, and contribution, separately for each currency. This is an operational contribution report, not a statutory accounting ledger. |
| Reminders | Scheduled in-app/email reminders, delivery history, up to three failed-delivery attempts, cancellation, and administrator run-due action. Active reminders protect their source record against deletion until cancelled. |
| Client Import | CSV preview, required-field validation, existing/batch duplicate detection, and atomic import of up to 500 rows. Preview and commit both validate the submitted contents. |
| Audit History | Search by resource, actor, or record, with paginated before/after history. Sensitive authentication values are redacted. |
| Teams & Access | Team creation and administrator-controlled record visibility, layered on the existing role matrix. |
| Account Security | Authenticator setup/confirmation/disable and other-session revocation. Recovery links open the existing React app. |

## Retained dummy data for review

The `space_crm` database was upgraded with additive migrations. It was never reset or reseeded.

| Record | Review result |
| --- | --- |
| Original deals 1, 3, 5 | Remain closed won, fully received, with paid commissions. |
| Client 5 / Exhibition 3 | `DUMMY AUDIT — Workflow Client` / `DUMMY AUDIT — Workflow Expo`. |
| Deal 6 | Corrected booth cycle: gross value EGP 10,000; credit EGP 1,500; net receipts EGP 8,500; zero outstanding. Original receipts remain, including the reversed receipt. Paid commission EGP 500 with EGP 100 recovered. |
| Deal 7 | Sponsor proposal with approved 25% discount, 12% commission rate, and extended installment terms. Value EGP 7,500. |
| Deal 8 / Booth 5 | Reservation expired; deal cancelled and booth released to Available. |
| Deal 9 | Collection-review example: EGP 2,000 won value; EGP 200 received; EGP 1,800 overdue, with collector notes. |
| Requests 1–7 | Approved by an actor different from the requester. |
| Request 8 | Rejected through the browser, with a saved review reason. |
| Exhibition 3 expenses | EGP 1,000 API venue expense and EGP 100 browser marketing expense. Contribution is EGP 9,000 across its won deals. |
| Booth positions | Booth 4 at (50,50), Booth 5 at (350,50), both 180 × 120. |
| Additional review records | Imported dummy client, an unassigned dummy team, collection notes, one API reminder and one browser reminder delivered exactly once. Existing account scopes remain `all`. |

## Validation

Final validation passed: 46 Laravel tests with 972 assertions; 79 retained new-workflow verification checks; 63 original-cycle checks; all 26 sidebar destinations; and 68 foreign keys with zero broken relationships. Recovery verification passed for 37 tables and three private files. TypeScript, ESLint (with inherited warnings), and the production build passed. The original-design comparison checked 105 files: original field counts were retained; the two class-list differences are the intentional replacement of empty Finance chart/report and meeting-calendar placeholders. The supplied review artifacts contain the detailed results. Automated checks use only the separate `space_crm_test` database. Live review scripts authenticate with passwords supplied through environment variables; no credentials or database backups are committed.

- Original module CRUD/permission matrix and sales/receipt/commission cycle regression tests.
- Correction limits, cross-deal reference rejection, double-review rejection, independent approval, credit allocation, recollection after reversal, and historical financial preservation.
- Ownership/team scoping on lists, direct details, related links, search, and timelines.
- Pagination beyond the first 100 rows and a query budget for batched financial lists, followed by a fresh-write balance check.
- Invalid/duplicate CSV preview, atomic commit, expense/profitability/currency reconciliation, reservation expiry, and collector relationships.
- Reminder delivery, retry limits, cancellation/deletion constraints, RFC TOTP vector, login replay rejection, enrollment/disable, session privacy/revocation, password reset validity/reuse, and isolated backup throttling.
- Browser checks for all 26 sidebar destinations and all new workflow screens; actual save/reload, exports, review rejection, import, calendar detail, search, and timeline interactions.
- Live foreign-key checks and isolated recovery verification of the current private backup.

## Running and operating the additions

For an existing installation run `php artisan migrate`; do not reset or reseed the database. Restart local services with `node scripts/start-local.mjs`. The local launcher starts a scheduler when no recent scheduler heartbeat exists. A scheduler is running for the local review.

On deployment, run Laravel's scheduler continuously using the platform's service manager, or invoke `php artisan schedule:run` every minute. In-app reminders, reservation expiry, and a heartbeat run every minute; private backups run at 02:00 UTC. The System page displays the last heartbeat and backup timestamp. This does not configure a production host's service manager.

Set `MYSQLDUMP_BINARY` and `MYSQL_BINARY` to vendor MySQL tools if they are not on PATH. Run `php artisan crm:backup` to create a private archive under `backend/storage/app/crm-backups`. Keep that directory outside public web hosting and Git. To verify an archive, supply a separate recovery operator through `CRM_RESTORE_USERNAME` / `CRM_RESTORE_PASSWORD` in the command environment and run `php artisan crm:backup --verify=<private-archive-path>`. Verification never imports into the review database. Keep the application encryption key separately and securely for disaster recovery.

Real SMTP delivery is not configured in this local review. Recovery email and email reminders require your transport settings; the default log/array mailers are not reported as delivered email. In-app reminders are operational and tested. Private off-site backup storage/retention and production scheduler supervision still require deployment configuration. External bank execution, verified e-signatures, payroll, tax-compliant invoice issuance, WebSocket chat, and external AI were not part of these additions. No money was transferred and no external reminder emails were sent.

Large concurrent production-load testing and full server-side conversion of the remaining legacy pickers/lists remain deployment work. Passing the tests is not a claim that every secondary legacy control or external integration is implemented.
