# ATH-CLAIM-V2-001 — Six-Hub Readiness Report

Source of truth: `lib/customer/claim-v2-readiness.ts` (`sixHubReadinessReport()`), asserted by
`lib/customer/ath-claim-v2-001.test.ts`. This is a **certification model**. It reads no env var and flips no
rollout mode. Levels: NOT_IMPLEMENTED < IMPLEMENTED < CERTIFIED < REAL_OWNER_CANARY_COMPLETE <
REVIEW_CAPACITY_MEASURED. "An adapter exists" is IMPLEMENTED, never READY.

## Gates

OFF → CANARY requires R1–R7 at CERTIFIED. CANARY → ALL additionally requires R8 (a real non-Founder,
non-QA organization completes the end-to-end flow) and R9 (review capacity measured on real external claims).

## Matrix

| Requirement | Contractor | Move | Lender | Senior | Insurance | Investor |
| --- | --- | --- | --- | --- | --- | --- |
| Implementation | V2 reference (POST start, 405 GET, bounded gate; Ask receipt/Continue) | GET mint; portal page before mint; no gate | GET mint; no gate | GET mint; locked v1 validation; no gate | GET mint after local validation; no gate | GET mint; no gate |
| R1 Public inventory | CERTIFIED | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED |
| R2 Exact identity | CERTIFIED | CERTIFIED | CERTIFIED | CERTIFIED | CERTIFIED | CERTIFIED |
| R3 Adverse evidence rules | CERTIFIED (discipline cohort unpublished; untouched) | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED |
| R4 Authority path | CERTIFIED | CERTIFIED | CERTIFIED | CERTIFIED | CERTIFIED | CERTIFIED |
| R5 Revocation certified | CERTIFIED | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED |
| R6 Publication + response contract | CERTIFIED | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED |
| R7 Abuse-resistant start | CERTIFIED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED |
| R8 Real-owner canary | **PENDING_FOUNDER_CANARY** (recorded as CERTIFIED-but-not-COMPLETE; blocks ALL) | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED |
| R9 Review capacity | IMPLEMENTED (instrumented; no real external claim measured) | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED |
| OFF → CANARY | **MET** | NOT_MET | NOT_MET | NOT_MET | NOT_MET | NOT_MET |
| CANARY → ALL | NOT_MET | NOT_MET | NOT_MET | NOT_MET | NOT_MET | NOT_MET |
| Recommended rollout state | **CANARY** | OFF | OFF | OFF | OFF | OFF |

Notes:

- Ask's receipt/Continue boundary protects every Hub's durable intent immediately on merge; it does not make the
  other five Hubs' GET mints acceptable — R7 is a specialist-side requirement.
- Move already places a human portal page before its mint; it is the cheapest next R7 port.
- Contractor R8 cannot be satisfied by this ticket by design: no fake owner was created or approved.
  Historical approvals were proof claims with revoked grants and do not count.
- Recommended rollout states are recommendations for the Founder. This ticket changed no production flag.

## R addendum (ATH-CLAIM-V2-001R, 2026-09-23)

`lib/customer/claim-v2-readiness.ts` now reports Contractor `R8_REAL_OWNER_CANARY` as **IMPLEMENTED**, not
CERTIFIED. The prior CERTIFIED label was aspirational — a real external owner has never approved a real claim
through the V2 funnel. IMPLEMENTED means the mechanism exists and was verified end-to-end this session against
a **synthetic, local-only** claim (staff review → evidence-gated approval → active grant → business-supplied
layer published → staff revoke → layer withheld, official evidence unchanged), not that a real business has
used it. `recommendedRolloutState` stays `CANARY`; `blocking` still lists `R8_REAL_OWNER_CANARY` and
`R9_REVIEW_CAPACITY`. Only a real external owner's canary claim, decided by staff through the normal queue,
may move R8 to `REAL_OWNER_CANARY_COMPLETE` — see the addendum to `ATH-CLAIM-V2-001-CANARY-RUNBOOK.md`.

A caching asymmetry worth the Founder's attention before that canary: Ask's public-read layer
(`lib/customer/public-read-layer.ts`) caches "this profile has no public business layer" for up to 6h
in-process once observed, and the underlying `unstable_cache` existence list uses stale-while-revalidate
(serves the old list on the request that follows `revalidateTag`, not the freshly revalidated one). A profile
becoming publicly visible for the **first time** after approval can therefore lag by up to that window on a
long-lived process, even though `invalidatePublicContractorRead` fires correctly on the write path. Revocation
does not share this failure mode — `publicBusinessProfile()`/`loadPublishedState()` read live on every request
for IDs the existence cache already knows about, so a revoked grant stops publishing immediately. Net effect is
fail-safe (under-disclosure, never over-disclosure) but the canary runbook should budget for "may take up to
6h (or a redeploy) to appear" rather than expecting instant visibility after the first-ever approval.
