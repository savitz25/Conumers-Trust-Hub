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
