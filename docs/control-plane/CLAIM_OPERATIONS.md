# Claim / KYB Operations

ATH-ADMIN-004 adds the protected network queue at `/admin/operations/claims` and claim detail at `/admin/operations/claims/[claimId]`. `ADMIN_VIEW` protects reads; `CLAIM_OPS` protects approve, needs-information, reject, and revoke mutations. In V1, `SUPER_ADMIN` and `TRUST_OPS` hold `CLAIM_OPS`.

## Authority and truth

The existing `ath_claims`, `ath_management_grants`, organization membership, claim-decision history and revocation records remain authoritative. The Control Plane calls the existing transactional domain methods; it does not issue ad-hoc claim SQL. `ath_ops_cases` adds workflow state and references the authoritative claim. `ath_claim_policy_evaluations` records deterministic versioned evaluations, and `ath_ops_case_events` provides append-only operational history. Privileged decisions also produce bounded records in `ath_admin_audit_log`.

Layer A remains immutable. Claim authority binds one canonical Ask user through one organization to one exact hub profile. Claiming is not regulatory verification, endorsement, ownership of source evidence, or ranking preference.

## Workflow

Case workflow states are `OPEN`, `TRIAGE`, `WAITING_FOR_CLAIMANT`, `READY_FOR_REVIEW`, `ON_HOLD`, resolved approved/rejected/withdrawn, and `CLOSED`. These do not replace public claim statuses. Queue age bands are under 24 hours, 24–48, 48–72, and over 72. The 72-hour threshold is an internal operating target, not a public SLA.

Policy results are independent of claim status: GREEN means approval-eligible for human confirmation; AMBER requires step-up or human review; RED identifies a conflict/disqualifier; `NOT_YET_DEFINED` fails closed. Broad automatic approval is disabled.

Competing claims never transfer authority automatically. An active grant is an authorization constraint and defaults to manual resolution. Third-party representatives are neither treated as fraud nor automatically granted authority. Risk signals guide review and are not guilt findings.

Internal rationale is stored separately from the bounded claimant-facing message. Revocation ends management access but does not delete the claim, public evidence, regulator facts, or audit history.

## Privacy and legacy parity

Queue rows minimize claimant PII; detailed claimant information is confined to the protected detail view where operationally necessary. Tokens, magic links, sessions, private consumer research, and one claimant's private evidence are never exposed to another claimant or product telemetry.

`/internal/review` remains available as a legacy operational surface during parity stabilization. Its queue, detail, authority evidence, decisions, competing-claim visibility, memberships, grants, domain audit and revocation capabilities are reused by the new Admin module. Retirement or redirection is deferred to ATH-ADMIN-008.

## Later work

Policy editing remains code-reviewed rather than browser-editable. Secure document upload, mature step-up/MFA, jurisdiction-specific KYB cells, assignment workflows, and cross-system destructive commands remain deliberately unconnected.
