# ATH-CLAIM-V2-FLNJ-001 — Claim Biz V2 for FL + NJ Contractor profiles

Scope: claim availability on every published exact-credential **Florida** and **New Jersey** Contractor profile.
No other state. No cohort. Governance, publication, ranking, official evidence: unchanged.

## 1. NJ identity inventory (Contractor production, read-only, 2026-09-24)

Credential rows in `licenses` for NJ-linked profiles (`l.state='NJ' OR c.home_state='NJ'`):

| source_system | class | published non-thin contractors | with key | active |
| --- | --- | --- | --- | --- |
| `nj_dca` (HIC + ELE/PLB/HVAC/ALM/TEL/LCK/HRT) | **CLAIMABLE_CREDENTIAL** | 75,484 | 75,484 | 48,951 |
| `fl_dbpr` (FL licence, NJ address) | out-of-state credential → not NJ-claimable | 446 | 446 | 253 |
| `ct_dcp` 531 · `va_dpor` 212 · `wa_lni` 101 · `mn_dli` 79 · `tn_blc` 71 · `az_roc` 57 · `la_lslbc` 52 · `nv_nscb` 39 · `or_ccb` 30 · `id_dopl` 25 · `ms_sbc` 12 · `tx_tsbpe` 2 · `ok_cib` 1 | out-of-state credentials → not NJ-claimable | | | |
| `nj_sos`, `nj_enforcement`, permit / municipality silos | **NOT_CLAIMABLE_RESEARCH_ONLY** (entity / enforcement / permit evidence; not present in `licenses`) | — | — | — |

NJ profiles: 77,272 total · 295 thin (no credential row) · **75,484 claimable** · 1,493 published non-thin excluded
(hold only out-of-state credentials). FL claimable under the unchanged FL rule: **127,314**.

Exact-identity contract for NJ: published, real UUID, canonical slug, non-thin, `nj_dca` row with a non-empty
`external_key` (e.g. `NJ-HIC:13VH…`, `NJ-ELE:34EB…`), NJ home state or NJ credential address.

## 2. What changed

Contractor: `ClaimProfile` carries `homeState` (claim jurisdiction) + `sourceSystem`; eligibility is
source-allow-listed per state (`FL: fl_dbpr`, `NJ: nj_dca`), FL evaluated first and unchanged; the signed payload
uses the selected credential's real source/state/key; the rollout gate requires `ATH_CLAIM_CTA_MODE` **and**
`ATH_CLAIM_ENABLED_STATES` (absent → nothing enabled, even under `all`); analytics carry state/source instead
of hard-coded FL.

Ask: v2 completeness accepts only allow-listed (source, state) pairs; the adapter re-verifies UUID, slug,
credential, source, state, publication, non-thin and canonical URL against the Contractor row the handoff names
(cross-state/source substitution fails closed); staff claim detail shows a New Jersey **MANUAL AUTHORITY
REVIEW** callout; monitoring is UNAVAILABLE and cannot be enabled for non-FL-DBPR Contractor profiles.
No schema migration (the FL-only CHECKs were dropped in migration 007).

## 3. Release configuration (prepare only — not flipped by this ticket)

Contractor Production env:
```
ATH_CLAIM_CTA_MODE=all
ATH_CLAIM_ENABLED_STATES=FL,NJ
ATH_CLAIM_CANARY_PROFILE_IDS=            # cleared after rollout
```
Firewall `claim-start-canary-backstop` stays ACTIVE / DENY, 6 requests / 600 s / IP, POST `/api/claim/handoff/*`.
Existing active grant(s) untouched.

Rollback: `ATH_CLAIM_CTA_MODE=off`. State-specific rollback: remove `NJ` (or `FL`) from `ATH_CLAIM_ENABLED_STATES`
and redeploy — the CTA and the POST start both fail closed for that state immediately.

## 4. Monitoring honesty

Contractor monitoring is a Florida DBPR feed. NJ DCA profiles: My Trust Hub shows "Unavailable", the profile
workspace shows the monitoring-unavailable card, and `saveMonitoring` refuses (`forbidden`).

## R1 addendum — durable cross-isolate claim-start gate

- **Endpoint:** `POST /api/internal/claim/start-preflight` (Ask). Body signed by the Contractor specialist with
  `ATH_HANDOFF_SECRET` under the domain `ATH_CLAIM_START_PREFLIGHT_V1` (HMAC over the raw body, verified BEFORE parse,
  min secret 32 chars, body ≤ 1024 bytes, `ts` within ±60 s, `rid` replay window 2 min).
- **Privacy:** the specialist never sends an IP. It sends `bucket = HMAC(secret, "ATH_CLAIM_START_BUCKET_V1:" + abuseBucket)`
  (IPv4 full address, IPv6 /64) and Ask stores only `opaqueRateKey(...)` of that digest in `ath_rate_events`.
- **Policy (durable, shared by every isolate/region):** 5 / 15 min per bucket, 3 / 15 min per bucket+profile,
  20 / rolling 60 min per bucket. Evaluated under `pg_advisory_xact_lock(hashtext('ath_claim_start:'||digest))`, so
  concurrent starts cannot over-admit (proven on real PostgreSQL 16: 24 concurrent → exactly 5).
- **Client (`lib/claim/preflight-client.ts`):** fixed Production Ask origin, 2.5 s timeout, no retry, never throws.
  Anything other than `200 {allowed:true, reason:"ok"}` or `429 {allowed:false}` is `unavailable` → the specialist
  answers **503** and mints nothing (fail closed). `limited` → **429** + `Retry-After`.
- **Ordering in `runClaimStart`:** same-origin → local memory limiter → profile load/eligibility → rollout state →
  **durable preflight** → mint. The memory limiter stays as defense in depth; the Vercel firewall rule stays the outer backstop.
- **Readiness honesty:** `DURABLE_ABUSE_GATE = PASS` (code + tests). `ALL_ABUSE_GATE` stays **BLOCKED** until infra
  confirms the firewall rule is active in Production. R9 remains **NOT_MET** until that confirmation.

## R1 addendum — explicit Continue idempotency (double-intent P1)

**Observed:** a real-owner canary produced two `ath_claim_intents` ~0.7 s apart from one Continue. The nonce UNIQUE
already collapses a double post of the *same* token; two rows therefore mean the specialist minted **two tokens** for
one click (double form submit), each accepted with a fresh receipt id, and each Continue creating its own intent.

**Fix (DB / idempotency boundary, not UI-only):**
1. `confirmClaimIntent` takes `pg_advisory_xact_lock(hashtext('claim_continue:' || receipt_hash))` so every Continue
   for one browser receipt is serialized inside its transaction — concurrent requests cannot both insert.
2. Before inserting, it looks for an **open, unexpired, `explicit_continue`** intent for the **same hub + exact
   profile** that either carries the same `receipt_hash` or is the intent id the browser already holds (httpOnly
   intent cookie, passed by the confirm route). If found it is reused (`created:false`); the new token's nonce is
   **never recorded**, so token expiry and replay protection are unchanged.
3. The accept route keeps the **same receipt id** when a fresh handoff is for the same exact profile as the receipt
   already in the browser, and keeps an open same-profile intent cookie instead of clearing it. Different profile →
   new receipt id and the intent cookie is cleared, exactly as before.
4. Contractor `ManageProfileCta` adds a synchronous DOM double-submit guard (defense in depth only).

**Unchanged security contract:** same token from a *different* receipt → `reused_nonce`; different browser with its
own token → its own intent (competing-claim path); different profile in the same browser → separate intent; forged
`existingIntentId` cannot hijack (must match receipt or be the same-profile held id); passive receipt still creates 0
intents; consumed intents are never reused; expired tokens still fail with `expired`.

**Tests:** `lib/customer/ath-claim-v2-flnj-001r1-continue.test.ts` — sequential double-click, identical network retry,
6 concurrent Continues (PGlite), two-mint P1 shape → one intent → exactly one claim on submit, security-contract
matrix, wiring assertions, and a real-PostgreSQL proof (8 concurrent same-token and 8 concurrent *different-token*
Continues on separate connections → exactly one intent; different browsers not collapsed).
