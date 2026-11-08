# Core functionality and integration verification — 2026-11-08

All existing data is demo data; neither application is publicly deployed (user-confirmed). This review uses separate synthetic MySQL databases on loopback port 23307. The saved demo databases and private files remain unchanged. No migration, dependency upgrade, production infrastructure, merge or deployment is part of this change.

## Verified working

- Existing ERP employee session and action/exhibition authorization already govern the signed CMS gateway. No replacement CMS or second employee login was needed. Existing editors cover content, SEO, settings, images, blogs, FAQs, translations, partners and packages; focused authorization/CMS tests exercise the contracts.
- Actual ERP editor saves changed the public home heading in English and Arabic, document title and meta description, contact email, and a newly uploaded synthetic image. The browser loaded that image successfully. SEO and home hero aliases already worked and were not rewritten.
- Active Exhibitors and Sponsors headings and the four Content/Sectors/Visitors/Contact page headings now reflect ERP-managed keys. A sponsor package edited in ERP appeared publicly; disabling it removed the card, and re-enabling restored it. Original public CSS classes/layouts are protected against the published baseline.
- A real authenticated HTTP cycle created a synthetic prospect/client, exhibition, booth deal and sponsorship deal. Booth reservation became sold on closed-won. USD1000 less 10% plus 14% tax produced USD1026; negotiated installments were USD123.45 and USD902.55. Two receipts settled the invoice. Commission USD75 was calculated on base USD1000 at 7.5%; approval before settlement was rejected, and later approval/payment succeeded. The sponsor deal retained zero commission. Linked-client deletion was rejected. All 145 relationship diagnostics reported zero orphans.
- Real website-to-ERP portal sessions loaded buyer/exhibitor contexts, overview, profiles, meetings and activity. A qualified buyer saw curated matches. The unqualified exhibitor correctly received 403 for curated matches; cross-identity access was also denied. This was an authorization success, not a defect.
- Four real public submissions reached the correct ERP queues exactly once: exhibitor/sponsor enquiries, Buyer Relations and Visitor Management. Repeated idempotency keys returned the same submission. Outbox ended at four delivered, zero failed; no client, deal or booth was automatically created from these unqualified submissions.

## Confirmed defects and minimal corrections

1. Several active public pages ignored existing CMS keys, and sponsor cards used a static package list. Bind those pages to existing bilingual content hooks and the existing published-package API. No sample copy curation or new CMS tables.
2. Deal detail displayed a fabricated booth, percentage-based installments, fake files, a fallback 5% commission and workspace currency instead of deal currency. It now reads existing authorized relations and actual booth metadata, preserves redaction/empty states and zero commission, uses actual deal currency, and ignores stale responses after navigation. Existing card/tab styles remain. Inactive actions now reach existing task creation, proposal/ticket modules and client details; document controls reach Contracts rather than promising downloads of nonexistent files.
3. Client detail contained placeholder relation tabs and invented activity. Reuse the existing authorized client relations, payment/schedule IDs and server activity timeline. Restore its existing client edit dialog and existing deal creation route. Currency totals are grouped by currency rather than adding different currencies together. No business calculations changed.
4. Both IntakeTransport implementations incorrectly treated a complete successful response as oversized when EOF was not set until the next read. A real paired run delivered only one of four acknowledgments although ERP accepted the submissions. A new regression test failed before correction. Both transports now drain a bounded stream, reject oversized/interrupted responses and retain TLS, timeouts, signatures and redirect restrictions. The three pending deliveries then succeeded idempotently, without duplicate records.

## Tests actually executed locally

| Scope | Result |
|---|---|
| ERP CMS, CRM, workflows, B2B, participant gateway, granular authorization | 92 passed; 1370 assertions |
| Website CMS gateway/API, portal identity/transport, public registrations | 60 passed; 416 assertions |
| ERP final stream + registration tests | 17 passed; 108 assertions |
| Website final stream + public registration tests | 17 passed; 115 assertions |
| ERP frontend | 31 passed |
| Website frontend | 21 passed |
| ERP navigation baseline | 38 passed |
| Both TypeScript checks and production builds | Passed (existing chunk-size warnings) |

The focused PHP groups overlap; counts must not be added as unique tests. No expensive full local suite was repeated without need. Existing CI commands include the new focused frontend tests; GitHub Actions results are recorded separately in the PR after publication.

## Evidence and review boundaries

Sanitized machine-readable results in core-integration-evidence record the financial cycle, paired portal gateway and submission delivery. New synthetic records remain in the isolated UI databases for inspection: exhibition 3, client 3, booth 5, deals 3/4, invoice 1 and commission 1. CMS uses the earlier synthetic event context 1. Credentials, HMAC keys, receipt secrets and session tokens are excluded.

Local previews: ERP http://127.0.0.1:19081/ and website http://127.0.0.1:19091/. CMS, portal and intake flags are enabled only in these synthetic preview processes. No worker, scheduler or external email service was activated; delivery used a bounded invocation of the existing command.

## Remaining limits

This is evidence for the named workflows and existing CMS contract, not a claim that every legacy button, every static marketing paragraph, every optional CMS resource and every browser/device combination was manually exercised. Static marketing fallback copy was intentionally left alone. Profile writes, full meeting rescheduling and private-document download were not repeated through the paired live portal during this pass; existing focused automated coverage remains the evidence for those paths. The synthetic document demonstration verifies a linked document record, not a newly uploaded private contract file. No public infrastructure/cutover claim is made or required at this stage. Both PRs must remain Draft and unmerged.
