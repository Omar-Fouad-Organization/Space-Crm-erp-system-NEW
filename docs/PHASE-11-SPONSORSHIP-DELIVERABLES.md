# Phase 11 — Sponsorship deliverables

## Gap and scope

ERP Draft PR #6 started at `080bd542cab2e79bd4b8decf576de99760df95d1`. Website Draft PR #4 was verified at `c4a21d166c5db72972561b5554eefc165dff1d58`. Existing CMS packages describe public offers, ERP packages describe commercial options, deals confirm participation, documents store internal contract records, and CRM Tasks track employee work. None records the approved obligations for an individual deal or an organizer's verification of delivery. The Phase 10 checklist serves confirmed booth exhibitors and is independent of sponsorship fulfillment.

The existing Sponsorship page opens a permission-gated register with deal, exhibition, sponsor, status, employee and due-date filters. The register uses the actual `closed_won` deal, linked client and exhibition for both `sponsor` and `sector_sponsor`. A package is shown where available. A booth is optional and is never assigned by this workflow. Deal values, payments, invoices, commissions, booths, participant memberships, tasks and CMS publication are outside its write paths.

## Commitments and fulfillment

- An authorized drafter records the terms, responsible employee, required or optional designation and due date. An organizer explicitly approves the draft. An optional contract reference must resolve to a visible approved or signed document for the same deal, client and exhibition. Contract metadata is a reference to an internal record.
- The assigned employee starts work, records progress and submits a claim with a note. A reviewer verifies completion or requests changes. The assigned employee can resubmit. An authorized organizer can cancel with a reason. An explicit approved amendment replaces the current terms, returns the deliverable to pending and retains every prior approved snapshot.
- Deal summaries exclude drafts from approved counts. Cancelled commitments are counted separately and excluded from outstanding and overdue counts. Required and optional obligations are shown separately on each deliverable. The register distinguishes an empty register, an unapproved draft, outstanding work and verified fulfillment.
- Existing staff sessions, action permissions, exhibition membership and deal/client record scope govern every endpoint. Only an active employee with access to the deal and progress permission can be assigned. No task, notification or new portal account is generated. Notes and term snapshots are encrypted in append-only history with actor, timestamp and version.
- Changes lock the authoritative deal and current item, check the expected version and record a unique request receipt. Retrying identical content returns the recorded receipt. Conflicting versions or reuse of a receipt for changed content returns a conflict. Foreign keys protect the references and approved history against deletion.

## Verification

The isolated MySQL feature suite exercises both sponsorship types, draft and empty summaries, explicit approval, assignee-only progress, changes and resubmission, verification, amendment, cancellation, existing contract scope, due-date filtering, request replay and preservation of commercial records. Independent PHP workers contend for the same approval and check the authoritative row and event count. GitHub Actions runs the full ERP suite with synthetic fixtures, plus frontend tests, navigation, TypeScript, build and dependency audits. [Draft PR #6 records the final run and totals](https://github.com/Omar-Fouad-Organization/Space-Crm-erp-system-NEW/pull/6).

## Release and limitations

The register defaults off via `SPONSOR_DELIVERY_ENABLED` and requires granular ERP authorization. Future release order is to back up and verify restore, apply the additive schema with the feature off, deploy with the flag off, confirm the new tables and permissions in staging, and approve activation separately. For application rollback, disable the flag and retain the schema and history. The migration down removes both new tables and is only suitable before use or after separately approved archival and recovery planning.

Evidence is a descriptive employee claim and an organizer verification note. Private file uploads, independent verification of external publication and automated CMS updates are unavailable. Website publication continues through the existing CMS. If a deal ceases to be eligible or changes client or exhibition, the register hides the prior obligations from the current deal view and retains their original scope and history. An organizer should agree a commercial correction and audit access policy before activating this workflow. No operational database migration, enrollment, deployment or activation is part of Phase 11.
