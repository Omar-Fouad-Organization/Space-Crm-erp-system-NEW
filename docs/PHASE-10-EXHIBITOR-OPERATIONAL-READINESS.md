# Phase 10 exhibitor operational readiness

## Scope

The confirmed booth deal and sold booth remain the commercial authority. The participant profile checklist covers profile completeness. The ERP readiness checklist records operational requirements and decisions. Physical handover is an independent employee record.

The starting commits were ERP `a000772d94dea43e6f7f6e70f79642deae98a411` and website `90af7f79c8f1c9efffe43772cc13b22b9594414f`. Both draft PR heads matched before implementation.

## ERP workflow

The exhibition detail page includes Operational readiness. Staff can configure bilingual titles and descriptions, information requests, document requirements and organizer approvals. Requirements have an optional due date, display order, required designation and active state. Once a result exists, the terms are fixed. An organizer can archive the requirement and add a replacement. Staff can inspect archived decisions.

The view uses eligible closed-won booth deals with sold booths in the same exhibition. It shows applicable, approved, pending and review counts. Staff can filter by exhibitor or booth, readiness, requirement state and due date. No active requirements produces “Operational requirements not configured.” Readiness requires approval of all applicable required items. Explicitly inapplicable items are excluded and a checklist with no applicable items is reported as such. Optional items can remain open without blocking readiness.

The additive tables store requirements by exhibition, one result per requirement and deal, an append-only result history and one physical handover per deal and booth. Results bind the original client and booth. If the allocation changes, the organizer must reconcile the historical record before writing another result against that same requirement and deal. Each decision stores the actor, timestamp, transition and version. Responses, private reasons, feedback and handover notes are encrypted at rest. Handover stores the exhibition, deal, client, booth, employee and time and requires a separate confirmation. It does not write any commercial record.

## Authority and transport

Existing B2B permissions and explicit exhibition membership gate the ERP view. Configuration, review and handover have separate permissions and require readiness view access. Deal, booth and client visibility gate participant records. Portal access checks the live exhibitor membership, exhibition and current booth deal. Sending a response reuses the existing profile submission capability. Only staff can record a decision. Only separately entered feedback is sent to the exhibitor.

The bilingual Exhibitor Portal adds a readiness section through the existing signed gateway. Submissions use the encrypted website outbox, ERP command receipts and existing retry behavior. ERP holds the results and history. Deal and requirement locks, versions and database uniqueness prevent duplicate results. A repeated handover for the same allocation returns the original record.

## Verification

The paired synthetic HTTP cycle ran the real Laravel applications against fresh loopback MySQL databases. An authenticated exhibitor loaded requirements, submitted, replayed the same command, received a change request and resubmitted. An organizer approved both requirements. Parallel requests through two ERP processes returned one successful review and one HTTP 409. Parallel handover requests returned one record ID. A second parallel check used a record-scoped employee and held the deal lock while both requests began. Both received the same handover receipt. The duplicate lookup uses a locking read to see the latest committed record. The booth remained sold and the information requirement had five history entries.

The ERP focused test passed 67 assertions, including staff and participant scope, signed review, sponsor and unconfirmed deal exclusion, document restrictions and preserved commercial and participant snapshots. The website focused test passed 12 assertions, including rejection of a false outbox acknowledgment. Browser checks showed the approved readiness and booth in English and Arabic, plus the separate handover and review history in the ERP exhibition tab. Local frontend suites passed 42 ERP and 25 website tests, with 38 ERP navigation checks and successful TypeScript checks. Final commit SHAs, GitHub Actions results and links are recorded in the draft PR descriptions to avoid a documentation-only CI run.

- [ERP draft PR #6](https://github.com/Omar-Fouad-Organization/Space-Crm-erp-system-NEW/pull/6)
- [Website draft PR #4](https://github.com/Omar-Fouad-Organization/Premium-website/pull/4)

## Release and policy limits

`EXHIBITOR_READINESS_ENABLED` defaults to false. Apply the additive schema first for a future authorized release. Retain populated tables and encryption keys on rollback. The ERP and website were exercised locally with synthetic records only.

Document-based completion requires an approved private file association and authorized review path for readiness, backed by healthy certificate-verified scanning, clean file and hash verification, and approved private delivery. Existing profile evidence scanning controls do not establish that readiness workflow. Document items remain visible and cannot be completed through an upload or approval shortcut. Organizers own the actual requirements, deadlines, any handover correction policy and activation decision. Phase 10 supplies no event-specific defaults or payment prerequisites.
