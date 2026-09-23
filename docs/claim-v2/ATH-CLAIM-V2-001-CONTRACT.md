# ATH-CLAIM-V2-001 — Claim Biz V2 Shared Contract

Program: Claim Biz V2 ("Claim your business — free"). This document freezes the portable claim contract every
Hub must satisfy. ContractorTrustHub is the reference implementation (branch `ath-claim-v2-001-contractor`);
AskTrustHub owns the shared validation, intent, review, grant and publication layers (branch
`ath-claim-v2-001-foundation`).

Wire protocol: **unchanged.** The specialist → Ask signed handoff keeps its existing `v: 2` payload and
HMAC-SHA256 signature (`lib/customer/handoff.ts`). No `v: 3`. The V2 changes sit on either side of the
signature: how the specialist decides to mint, and what Ask does after it verifies.

## 1. The chain

```
PUBLIC EXACT PROFILE            specialist public page, indexable, source-derived evidence only
  → HUMAN-INITIATED CLAIM START  explicit same-origin POST (form button); GET never mints
  → ABUSE-RESISTANT HANDOFF      origin check → bounded abuse gate → rollout gate → exact eligibility → ONE signed token (15 min, random nonce)
  → ASK VALIDATION               GET /api/customer/claim/accept: verify signature/audience/expiry, reject used nonce, revalidate exact profile
  → PASSIVE RECEIPT (no state)   httpOnly receipt cookie {token, receiptId, source}; page shows identity + what claiming means
  → EXPLICIT CONTINUE            POST /api/customer/claim/confirm (same-origin): the ONLY path that inserts ath_claim_intents
  → AUTH                         magic link; `next=/claim/continue`; the intent cookie survives the round trip
  → CLAIM SUBMISSION             ath_claims (+ ath_review_queue, ath_ops_cases); acquisition_source carried from the intent
  → HUMAN AUTHORITY REVIEW       reviewer timer + evidence-ready flag; governance unchanged; automatic approval impossible
  → ACTIVE MANAGEMENT GRANT      one active grant per hub profile; gates every owner tool
  → BUSINESS-SUPPLIED PUBLICATION labelled, allow-listed, projected only under an active grant
  → BUSINESS RESPONSE / CORRECTION moderated response; corrections available with or without a claim
  → REVOCATION                   grant revoked → projection query returns nothing → business layer withdrawn
  → OFFICIAL EVIDENCE NEVER CHANGES
```

## 2. Old flow vs new flow

| | Before (starting main) | After (this ticket) |
| --- | --- | --- |
| Specialist mint | `GET /api/claim/handoff/[id]` → mint → 302 | `GET` → 405 (0 mints). `POST` (same-origin form) → gate → mint → 303 |
| CTA | `<a href="/api/claim/handoff/…">` (crawlable) | `<form method="post" action="/api/claim/handoff/…">` + button |
| Ask receipt | `acceptHandoff()` inserted `ath_claim_intents` immediately | `receiveHandoff()` verifies + revalidates; writes nothing but the durable per-IP rate event |
| Durable intent | created by any page view | created only by `confirmClaimIntent()` from an explicit Continue |
| Refresh / bot / crawler | +1 intent per view | 0 intents |
| Double-click Continue | n/a | one intent (idempotent for the same receipt) |
| Source | hard-coded `organic` in a log line | allow-listed value carried out-of-band, stored on the intent and the claim |

## 3. Exact durable-intent boundary

`ath_claim_intents` gains `intent_origin` (`legacy_passive` for every historical row, `explicit_continue` for
V2), `acquisition_source`, `confirmed_at`, `receipt_hash`. A row is inserted **only** by
`CustomerPlatform.confirmClaimIntent()`, which requires:

1. a same-origin POST (`lib/customer/request-origin.ts`),
2. a receipt cookie whose signed token still verifies (expiry aware),
3. the profile to revalidate exactly (hub, id, slug, identifier, class, canonical URL),
4. the durable limiter (`claim_continue_ip`, 10 / 15 min),
5. `INSERT … ON CONFLICT (nonce) DO NOTHING` — the UNIQUE nonce makes the boundary single-use.

`acceptHandoff()` remains as the composition `receiveHandoff` → `confirmClaimIntent` for existing gates and
proof scripts. Public routes never call it.

## 4. Replay semantics

| Event | Result |
| --- | --- |
| Same token received again before Continue (refresh, second tab, link preview) | Identity page again. No state. |
| Same token received after Continue | `reused_nonce` → `HANDOFF_REPLAYED` recovery. |
| Continue twice with the same receipt (double-click, retry) | Same `intentId`, `created:false`. One row. |
| Continue with a different receipt (someone else holding the raw token) | `reused_nonce`. |
| Continue after the intent was consumed by a submission | `reused_nonce`. |
| Token expired (15 min) | `expired` → `HANDOFF_EXPIRED`. |
| Signature/audience/shape wrong | `tampered` / `wrong_audience` / `malformed` → `HANDOFF_INVALID`. |

## 5. Token properties (unchanged, re-certified)

Server minted · 24-byte random nonce · 15-minute TTL · HMAC-SHA256 with `ATH_HANDOFF_SECRET` (≥ 32 chars) ·
verified with constant-time comparison · never logged (Ask `customerLog` redacts `token`/`handoff`;
Contractor logs event names only) · `no-store` + `noindex, nofollow` on every claim route · exact profile
identity (hub, native id, slug, identifier, class, canonical URL) · replay resistant at the durable boundary.

## 6. Acquisition source

Allow-list: `organic`, `manual_outreach`, `email_campaign`, `internal_test`, `unknown`. Specialists may declare
`organic | manual_outreach | internal_test` in the POST body; Ask reads it from the redirect query string
(unsigned, allow-listed, defaults to `unknown` when absent). `email_campaign` is set only by Ask campaign
attribution (`ath_claim_attribution`). The value is stored on the intent, copied to `ath_claims.acquisition_source`
and `attestation.acquisition_source`, shown in `/admin/operations/claims`, and `internal_test` is excluded from
every external capacity metric. Historical claims keep `unknown`; nothing is inferred.

## 7. Governance, publication, revocation (unchanged and re-certified)

- Approval needs ≥ 2 corroborating signals incl. an independent authority signal and a control/contact signal;
  company-domain email alone and credential knowledge alone are insufficient; conflicts and competing claims
  block; free email is step-up, not rejection; `automatic_approval` is CHECK-constrained false.
- Business-supplied fields/items/hours and approved responses are projected only while an active grant, an
  active organization and an active owner/manager/staff membership exist. Revocation therefore withdraws the
  layer; the rows are retained; official evidence is untouched.
- Public copy uses "Profile managed by an authorized representative". "Verified owner" is prohibited.

## 8. Review capacity (new)

- `review_started_at`, `review_decided_at`, `evidence_ready_at_first_review`, `human_review_active_seconds`
  on `ath_claims`; `ath_claim_review_sessions` is the explicit reviewer timer (capped at 45 min per session,
  idle-expired at 4 h, closed automatically by a decision).
- SLA: 48 business hours (Mon–Fri, UTC), states WITHIN / APPROACHING / OVER / RESOLVED. Internal trial target.
- Metrics (`computeReviewCapacity`): evidence-ready rate, median human review minutes, needs-info rate,
  approval rate, median elapsed submission→decision, first-useful-action rate, wrong-grant incidents,
  unresolved / over-SLA counts. No Trust Score, no business quality score.

## 9. Frozen funnel

See `lib/customer/claim-v2-funnel.ts` (`CLAIM_V2_FUNNEL`). AUTHORITATIVE = durable first-party records.
BEHAVIORAL = privacy-safe browser/product telemetry with allow-listed low-cardinality dimensions. Forbidden in
browser analytics: profile UUID, licence number, claimant name, company name, email, claim/org/grant id, magic
link, signed token, free text, raw URLs containing any of these.

## 10. Portability checklist for the next Hub

1. Replace the GET mint with a POST start using `handleClaimStart`-equivalent logic (origin, gate, rollout,
   exact eligibility, one mint, 303 with `source`).
2. Make the CTA a POST form.
3. Nothing changes on Ask: the receipt/Continue boundary already applies to every Hub.
4. Certify with the readiness contract (`lib/customer/claim-v2-readiness.ts`), not with an adapter's existence.
