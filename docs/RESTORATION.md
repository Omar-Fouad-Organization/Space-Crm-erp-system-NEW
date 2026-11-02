Current additions and superseding limitations are documented in [AUDIT-IMPLEMENTATION.md](AUDIT-IMPLEMENTATION.md). The restoration results below describe the earlier restoration milestone.

# Original interface restoration

The frontend is restored from `bc25301`, with Laravel/MySQL replacing the old data services. `node scripts/verify-original-design.mjs` compares the original JSX class attributes and Input, Textarea, Select, Dialog, Tabs, and FormField counts across 105 files. It reports no differences. This checks source structure, not pixel equivalence at every viewport. The existing layouts can still overflow narrow screens.

Canonical foreign keys, financial values, permissions, allocation, and receipt rules are validated by Laravel. Ancillary original form values use JSON attributes; protected relationship/security keys cannot be supplied through those attributes. New nullable pricing columns preserve base price, discount percentage, and tax percentage. Laravel validates the gross total and calculates commission from base price, matching the original form. Existing deals without base pricing retain their previous calculation.

The compatibility imports named `supabase` and `supabaseService` call Laravel only. No Supabase client dependency, remote session, or remote database is used. The original generic replacement screens have been removed.

## Verification

- TypeScript, ESLint (with inherited type/hook warnings), Vite production build, and PHP tests pass.
- Laravel: 31 tests, 743 assertions, using only the separate `space_crm_test` database.
- Original form adapter: 53 retained live checks through `scripts/original-ui-cycle.mjs`.
- Browser: original client create dialog, deal create/edit dialogs, closing a deal, marking its installment paid, commission approval and payment. Reload confirmed persistence. Original exhibition and management pages were smoke-tested for rendering.
- Production npm dependency audit: zero reported vulnerabilities at the time of verification.

The adapter cycle requires `CRM_ADMIN_PASSWORD`, creates clearly fictional records, and refuses to duplicate its existing review deal. It never resets the review database, sends email, signs agreements, or moves money. The original dummy records are retained. Local database files, uploaded attachments, credentials, and session data are excluded from Git.

## Retained review records

| Cycle | Deal ID | Gross amount (EGP) | Commission (EGP) | Final state |
| --- | ---: | ---: | ---: | --- |
| Original Nile Technology | 1 | 100,000 | 5,000 | Won, fully received, commission paid |
| DUMMY RESTORED adapter cycle | 3 | 10,260 | 500 | Won, fully received, commission paid |
| DUMMY UI Delta browser cycle | 5 | 72,960 | 3,200 | Won, fully received, commission paid |

Sponsorship deals 2 and 4 remain in proposal stage for further manual review. Supporting tasks, meetings, proposals, documents/attachments, tickets, channels, and messages remain linked to the completed cycles.

## Remaining original limitations

The missing sidebar pages and proposal controls were subsequently repaired. See [SIDEBAR-REPAIR.md](SIDEBAR-REPAIR.md) for current coverage, retained QA data, and verification results.

Email/SMS reminders, verified e-signatures, client-portal access, refund/accounting reversals, commission disputes, payroll processing, and external payment execution are not implemented. Invalid financial status changes are rejected: receipts cannot be reversed by changing a badge, paid commissions cannot be undone here, and booth allocation follows its deal. These safeguards preserve MySQL consistency even where the original interface offers conflicting controls.

Original sales-manager/executive roles map to the backend sales role; finance-manager/officer roles map to finance. The original labels are retained, but these pairs do not provide different backend permission levels. Review finer role scopes before production.

Large-dataset pagination, concurrent-user load testing, responsive layout improvements, and bundle splitting remain future work. The production JavaScript bundle is approximately 1.86 MB before compression. TypeScript retains the original relaxed compiler settings and dynamic record boundary; passing compilation does not mean all original type debt was eliminated.

