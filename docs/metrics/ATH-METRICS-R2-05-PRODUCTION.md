# ATH-METRICS-R2-05 - AskTrustHub network aggregation repair

Verified locally 2026-09-14 UTC; merged and Production-verified 2026-09-14T13:23-13:25 UTC.

## A. Status

**AskTrustHub: COMPLETE.**

PR #140 merged (`092d07e12edaa7404e7848e999767ef979f932cb`), Git-triggered Vercel Production
deployment succeeded, and live Production verification confirms all six specialist contracts
render as `UPSTREAM` with correct current values and no historical regressions (section L).
One item remains explicitly **BLOCKED**, not silently skipped: desktop/mobile browser
rendering and console verification (section 37/L) — this session has no browser automation
available, so it is reported as blocked rather than inferred. Live HTML content verification
(curl-based, covering the same rendered markup a browser would show, including
`data-specialist-origin` attributes and every headline value) was performed in its place and
is documented in L.

## B. Baseline defect

Reproduced directly against the six live specialist Production endpoints on 2026-09-14
before making any change:

- **All six** upstream specialist contracts (Contractor R2-02, Move R2-02, Senior R2-03,
  Lender R2-03, Insurance R2-04, Investor R2-04) were being **rejected**, not five.
- Exact rejection reason (`lib/network-metrics/load.ts`, function `validated()`): each
  upstream contract's `sourceFingerprint` no longer matched the hard-coded
  `ACCEPTED_SPECIALIST_FINGERPRINTS[hub]` constant in `lib/network-metrics/sources.ts`.
  `validated()` threw `"<hub>: specialist fingerprint is not accepted by AskTrustHub"` for
  every hub, `loadSpecialistContract()` caught it, and origin fell to `'FALLBACK'`.
- The bundled fallback snapshots (`data/network-metrics/*-v1-fallback.json`) were all
  stale, dated 2026-09-03 through 2026-09-06 - i.e. **before** the Contractor 9,974 fix
  (R2-02), the Move CO/VA/NY/IL expansion (R2-02), the Senior/Lender Florida reconciliation
  (R2-03), and the Insurance/Investor reconciliation work (R2-04). Contractor's fallback in
  particular still reported the historical partial `live_credential_records` value
  (`644,421`) instead of the corrected `662,331`.
- A second, independent defect was found in `lib/network-metrics/validate.ts`:
  `validateMoveManifest` hard-required **exactly seven** published state-intelligence paths
  from a fixed list. Move's real R2-02 contract now publishes **nine** (added `/new-york`
  and `/illinois`), so even a fingerprint fix alone would not have made Move's live
  contract structurally valid - it would have kept falling back for an unrelated, Ask-side
  over-fitted invariant.
- Ignored/incomplete reconciliation-field consumption: Ask's evidence builder
  (`buildAskNetworkEvidenceInventory`) only ever read `raw.metrics[]`; the new
  `reconciliation.*`, `homepageInputs`, and `acceptedStateSnapshots` fields added in
  R2-03/R2-04 were not consumed. `contractRevision` was received from every specialist but
  was not represented anywhere in Ask's own types or presentation.

## C. Six-hub upstream acceptance

Reproduced locally by fetching each hub's live Production `/api/network-metrics` (or GitHub
raw `data/home/*.json`) endpoint and running it through the **fixed** verifier
(`lib/network-metrics/load.ts` + `validate.ts`) on 2026-09-14, then **reconfirmed live in
Production** at `https://www.asktrusthub.com/` at 2026-09-14T13:24 UTC (deployed SHA
`092d07e12edaa7404e7848e999767ef979f932cb`) by fetching the rendered homepage HTML and
reading each hub's `data-specialist-origin` attribute directly off
`<article ... data-specialist-origin="..." data-specialist-hub="...">`.

| Hub | Revision | Schema | Generated UTC | Accepted (local repro) | Accepted (Production, live) | Fallback used |
|---|---|---|---|---|---|---|
| Contractor | ATH-METRICS-R2-02 | contractor-network-metrics-v1 | 2026-09-12T21:37:54.518Z | YES | YES (`UPSTREAM`) | NO |
| Move | ATH-METRICS-R2-02 | move-network-metrics-v1 | 2026-09-12T21:36:55.191Z | YES | YES (`UPSTREAM`) | NO |
| Senior | ATH-METRICS-R2-03 | senior-network-metrics-v1 | 2026-09-12T23:07:39.449Z | YES | YES (`UPSTREAM`) | NO |
| Lender | ATH-METRICS-R2-03 | lender-network-metrics-v1 | 2026-09-12T22:48:10.535Z | YES | YES (`UPSTREAM`) | NO |
| Insurance | ATH-METRICS-R2-04 | insurance-network-metrics-v1 | 2026-09-13T15:57:42.473Z | YES | YES (`UPSTREAM`) | NO |
| Investor | ATH-METRICS-R2-04 | investor-network-metrics-v1 | 2026-09-13T15:54:56.879Z | YES | YES (`UPSTREAM`) | NO |

Before the fix, all six showed `Accepted: NO / Fallback used: YES` against the identical
live payloads (reproduced by running the unmodified verifier against the same fetched JSON).
Production confirms **6/6 `UPSTREAM`, 0/6 `FALLBACK`** - see L for the full live-content proof.

## D. Ask current network metrics (source of every changing homepage value)

AskTrustHub's homepage (`components/network-intelligence-home.tsx`) renders no hand-typed
totals. Every changing number comes from `loadSpecialistNetworkContracts()` ->
per-hub `adapt*Card()` -> `SpecialistNetworkCard` / `buildAskNetworkEvidenceInventory` /
`buildAskStateCoverage`, all driven by the six accepted upstream contracts above. Selected
headline values now rendered (all specialist-owned, not Ask-computed):

| Public label | Value | Grain | Source hub | Aggregation rule |
|---|---:|---|---|---|
| Contractor license records | 662,331 | `license_credential_record` | Contractor | Passthrough of `live_credential_records`; no Ask-side arithmetic |
| Published moving companies | 5,022 | `directory_profile` | Move | Passthrough of `federal_publishable_directory_profiles` |
| Current nursing homes / home health / hospice | 14,690 / 12,460 / 6,669 | `current_directory_provider` | Senior | Three separate passthrough values; never summed by Ask |
| Lenders & lending institutions | 14,623 | `canonical_institution_entity` | Lender | Passthrough; HMDA volumes shown separately |
| Insurance agencies / Licensed insurance companies | 82,071 / 6,185 | `canonical_agency_entity` / `canonical_legal_insurer_entity` | Insurance | Two distinct identities, never added |
| Investment advisory firms | 23,622 | `sec_iard_roster_firm` | Investor | Passthrough; RIA/ERA classes shown as a documented partition, not summed into a second total |

There is **no** cross-hub "TrustHub records" mega-total anywhere in the codebase (verified by
grep and by the existing `assert.doesNotMatch(home, ...)` tests). The homepage instead
publishes: six specialist hub cards, a ten-state network explorer built from accepted
`stateCoverage`, and a publication-gated cross-hub evidence inventory
(`buildAskNetworkEvidenceInventory`, 274 measures across the six hubs after this fix - see
E/G) grouped by evidence family, never by a flattened count.

## E. Stale fallback removal

| Hub | Old fallback date | Old headline value | New fallback date | New headline value | Fallback still used for |
|---|---|---|---|---|---|
| Contractor | 2026-09-03 | `live_credential_records = 644,421` (pre-fix partial value) | 2026-09-12 | `662,331` (R2-02 fixed value) | Genuine upstream outage/timeout/malformed/incompatible response only |
| Move | 2026-09-06 | 7 published state paths (pre-NY/IL) | 2026-09-12 | 9 published state paths | Same |
| Senior | 2026-09-03 | Pre-R2-03 snapshot | 2026-09-12 | R2-03 accepted snapshot | Same |
| Lender | 2026-09-04 | Florida Approved ambiguity predates the 6,394->6,392 reconciliation | 2026-09-12 | `florida_ofr_approved_company_credentials = 6,392` | Same |
| Insurance | 2026-09-04 | Pre-R2-04 snapshot | 2026-09-13 | R2-04 accepted snapshot incl. Illinois evidence | Same |
| Investor | 2026-09-04 | Pre-R2-04 snapshot (legacy `metrics[]` values were already correct) | 2026-09-13 | R2-04 accepted snapshot with `reconciliation.*` | Same |

Fallbacks were **not removed** - the architecture keeps them for resilience (a genuine
specialist outage, timeout, malformed JSON, or incompatible schema still degrades safely
instead of crashing the homepage) - but the acceptance logic that made a *healthy* upstream
fall back to them has been removed, and the bundled snapshots were refreshed to the current
accepted Production contracts so a genuine future outage degrades to *recent* data, not
data from before the Contractor/Lender fixes. Fallback provenance is preserved and visible:
`origin: 'FALLBACK'` is exposed on every card (`data-specialist-origin` attribute, and an
amber "Showing last-known-good specialist snapshot" notice), the fallback's own
`generatedAt` is rendered untouched (never overwritten with the current build/request time),
and `sourceFingerprint`/`contractRevision` are passed through unchanged. See
`ath-metrics-r2-05.test.ts` -> `"fallback provenance: origin, fingerprint, and generatedAt
are preserved, never presented as current"`.

## F. Revision / schema policy

New model, implemented in `lib/network-metrics/load.ts` and `validate.ts`:

- **Schema family / version** - unchanged and still the primary gate: each hub's
  `schemaVersion` string (e.g. `contractor-network-metrics-v1`) must still match exactly.
  This has not changed across R2-02/R2-03/R2-04 for any hub (confirmed against all six live
  payloads), matching the specialists' own "no major schema bump" statements.
- **Structural / invariant validation** - unchanged and still enforced per hub in
  `validate.ts`: required public metric keys, required grains, allowed publication
  statuses, and hub-specific reconciliation invariants (e.g. Insurance agencies must not
  equal insurers; Investor RIA + ERA must equal the roster; Lender applications must not
  equal originations; Contractor NJ construction records must not equal the credential
  denominator). A genuinely incompatible upstream still throws here and the caller falls
  back.
- **Revision identity (`contractRevision`) and fingerprint (`sourceFingerprint`)** - now
  **provenance only**. They are captured, exposed on every card (new
  `SpecialistHubPresentation.contractRevision` field, rendered in the "Network rollup
  generated" panel and in `specialistCardMarkup`), and used to detect fallback drift for
  local tooling (`scripts/verify-specialist-metrics.mjs`), but they are **no longer an
  acceptance gate**. `ACCEPTED_SPECIALIST_FINGERPRINTS` was renamed to
  `FALLBACK_SPECIALIST_FINGERPRINTS` to make this explicit: it documents which fingerprint
  is baked into the bundled fallback snapshot, not which fingerprints Ask will accept from
  upstream.
- **Freshness** - `sourceAsOf`, `retrievedAt`, `snapshotAsOf`, per-metric `generatedAt`, and
  the contract-level `generatedAt` all continue to pass straight through from each
  specialist untouched; Ask's own request/render time is never substituted for any of them.

Net effect: a specialist shipping a new compatible revision (e.g. a future
`ATH-METRICS-R2-06`) is accepted automatically, with no AskTrustHub code change or
deployment, as long as its `schemaVersion` string and structural invariants stay
compatible. A genuinely incompatible schema (wrong `schemaVersion`, missing required
field, broken invariant) still fails closed to the fallback. This is exercised directly by
`ath-metrics-r2-05.test.ts` ("a newer compatible contractRevision/sourceFingerprint is
accepted without an Ask code change" and "an unsupported schemaVersion still fails closed").

## G. Null semantics

Verified against the live/refreshed contracts and protected by tests:

- Move Illinois (`il_current_hhg_roster`) and New York (`ny_current_hhg_roster`) current
  HHG rosters: `value: null`, `valueState: 'UNKNOWN'`, `publicationStatus:
  'PUBLIC_UNKNOWN'`. They still appear in `buildAskNetworkEvidenceInventory` output (not
  dropped), with `value: null` preserved - never coerced to `0`.
- Insurance's four-state `SEARCH_ONLY`/`OPEN_SEARCH_ONLY` fields (e.g.
  `co_producer_roster_count`, `il_authorized_companies`) remain `null`/unknown in the
  accepted contract; Ask's `validateInsuranceManifest` explicitly `forbidNumericMissing`\s
  the equivalent NOT_ACQUIRED fields and throws if a missing-universe field is given a
  number.
- No `|| 0`, `?? 0`, or "missing field -> 0" fallback exists anywhere in
  `lib/network-metrics/*.ts` for a metric value; a missing required field throws
  (`requirePublicCount` / `forbidNumericMissing`), which is intentional fail-closed
  behavior, and a genuinely-zero value that a specialist explicitly reports remains zero.
- Regression tests: `ath-metrics-r2-05.test.ts` -> "Move: Illinois and New York current HHG
  rosters stay null, never zero"; `ath-metrics-004b.test.ts` -> "missing Move/Lender/
  Insurance universes fail closed instead of becoming zero"; `ath-metrics-004c.test.ts` ->
  "NJ/CA missing state-RIA universes fail closed instead of becoming zero".

## H. Files changed

| Path | Purpose |
|---|---|
| `lib/network-metrics/sources.ts` | Renamed `ACCEPTED_SPECIALIST_FINGERPRINTS` -> `FALLBACK_SPECIALIST_FINGERPRINTS`; documented as fallback-snapshot provenance, not an acceptance allowlist; values refreshed to match the new bundled fallbacks. |
| `lib/network-metrics/load.ts` | Removed the `sourceFingerprint` equality gate in `validated()`. Acceptance is now schema-family + structural validation only. |
| `lib/network-metrics/validate.ts` | Fixed Move's over-fit "exactly seven state paths" invariant to a structural, forward-compatible check (count matches array length, no duplicates, previously accepted paths still present) instead of a hard-coded stale path list. |
| `lib/network-metrics/types.ts` | Added `contractRevision: string \| null` to `SpecialistHubPresentation`. |
| `lib/network-metrics/adapt.ts` | All six `adapt*Card` functions now pass through `raw.contractRevision`. |
| `lib/network-metrics/present.ts` | `specialistCardMarkup` now includes the specialist contract revision. |
| `lib/network-metrics/index.ts` | Export rename to match `sources.ts`. |
| `components/specialist-network-card.tsx` | Homepage card now visibly renders "Specialist contract revision" for provenance. |
| `data/network-metrics/{contractor,move,senior,lender,insurance,investor}-v1-fallback.json` | Refreshed from stale (2026-09-03/06) snapshots to the current accepted Production contracts (2026-09-12/13), fixing the historical Contractor/Lender values even in degraded/fallback mode. |
| `scripts/verify-specialist-metrics.mjs` | No longer fails CI on fingerprint drift (expected/healthy on every specialist release); still fails closed on real `schemaVersion` mismatch or a missing required metric in either the live upstream or the bundled fallback; logs a non-fatal reminder when the fallback should be refreshed. |
| `lib/network-metrics/ath-metrics-r2-05.test.ts` | New: acceptance-policy and regression-protection test suite (see I). |
| `lib/network-metrics/ath-home-005.test.ts`, `ath-metrics-001c.test.ts`, `ath-metrics-004b.test.ts`, `ath-metrics-004c.test.ts` | Renamed import to `FALLBACK_SPECIALIST_FINGERPRINTS`; updated assertions to the refreshed fallback content (Contractor `644,421` -> `662,331`, Contractor `newestSourceAsOf` `2026-09-02` -> `2026-09-11`, Move path count `7` -> `9`, evidence-inventory totals `119`/per-hub -> `274`/per-hub, Investor's `newestSourceAsOfNote` text). No assertion was weakened; each still checks a specific current, correct value. |
| `package.json` | Added `check:ath-metrics-r2-05` script (runs the new suite plus the existing metrics chain); wired it and the previously-unwired `check:ath-home-005` into the main `test` script so this whole area runs in CI going forward. |

No specialist repository (Contractor, Move, Senior, Lender, Insurance, Investor) was
modified.

## I. Tests

| Command | Result |
|---|---|
| `npm run check:ath-metrics-r2-05` | PASS - 57/57 (new R2-05 suite + `ath-home-005` + full `004c`/`004b`/`001c` chain + `metric-value` + `ask-home-002`) |
| `npm test` (full repository chain, ~35 scripts) | PASS - exit 0 |
| `npm run typecheck` | PASS, 0 errors |
| `npm run lint` | PASS - 0 errors, 4 pre-existing warnings, none in changed files |
| `node scripts/verify-specialist-metrics.mjs` | PASS against live Production endpoints: `specialist upstream and bundled fallback manifests are schema-compatible`, zero drift notices (fallback == current upstream as of this branch) |

New regression tests added in `ath-metrics-r2-05.test.ts` (57 tests total in the chain,
20 new in this file):

1. All six current fallbacks carry their real R2-02/R2-03/R2-04 `contractRevision` and are accepted.
2. A simulated future compatible release (new fingerprint + `ATH-METRICS-R2-06`) is accepted as `UPSTREAM` for every hub, not rejected.
3. An unsupported `schemaVersion` still fails closed to `FALLBACK` for every hub.
4. All six hubs load as `UPSTREAM` together when every upstream is healthy.
5. Contractor's fixed 662,331 partition cannot regress to the historical 644,421/652,357 values.
6. Lender's current Florida Approved 6,392 is served; 6,394 never appears; the INTERNAL confirmed-NMLS bridge metric never surfaces as a public Ask measure.
7. Move Illinois/New York current HHG rosters stay `null`, never zero, and remain visible in the inventory.
8. Move's 9 published state paths are accepted (compatible growth).
9. Move dropping a previously accepted state page (simulated) fails closed instead of silently shrinking coverage.
10. Insurance's Illinois Director's Order observations (2,896) never get summed into agency (82,071) or insurer (6,185) totals.
11. Investor's canonical firm count stays 23,622; 25,777 (the rejected summed total) never appears.
12. Fallback provenance (`origin`, `fingerprint`, `generatedAt`) is preserved and never presented as current.
13. Deterministic aggregation: identical inputs produce byte-identical inventory/state-coverage output across two runs.
14. Bundled fallback fingerprints stay self-consistent with `sources.ts`.

## J. Build / CI

- Local `npm run build` (Next.js 16.3.3, Turbopack): **PASS**, compiled successfully, all
  routes (including `/` and the six specialist-hub-driven sections) built without error.
- Local `npm run typecheck`: **PASS**, 0 errors (after `npm install` resolved a pre-existing
  local `@supabase/ssr`/`@supabase/supabase-js` install gap on this workspace, confirmed via
  `git stash` to be present on unmodified `main` and unrelated to this change; not present
  in CI, which runs a clean `npm ci`).
- Local `npm run lint`: **PASS**, 0 errors.
- PR CI (GitHub Actions) and Vercel Preview: **PASS**. `parent-search` (required check, via
  the "Search reliability" workflow), `Vercel Agent Review`, `Vercel Preview Comments`, and
  `Vercel` (Preview deployment) all passed; `Supabase Preview` skipped (not applicable to
  this change). Reconfirmed unchanged immediately before merge (head SHA `5fc077e7...`
  matched the reviewed head exactly).
- Post-merge `main` CI: `parent-search` and the `Vercel` Production deployment status both
  passed against merge commit `092d07e1...` (section K).

## K. Commit / PR / deployment

- Starting `main` SHA: `7a5060d7312bf6f71e926b20d1520d70590b3281` (2026-09-13T01:34:01-04:00,
  "Merge pull request #139 from savitz25/ath-il-001-illinois-network-release").
- Branch: `ath-metrics-r2-05-ask`.
- Implementation commit: `5fc077e7a679e6dcc3eef87f678b400d7f0b0ec9`.
- PR: [#140](https://github.com/savitz25/Conumers-Trust-Hub/pull/140), reviewed and merge-ready
  with head SHA reconfirmed unchanged (`5fc077e7...`) immediately before merge.
- Merge method: merge commit (`gh pr merge 140 --merge`), matching this repository's existing
  convention (prior history is exclusively "Merge pull request #N" merge commits, not squash).
- Merge commit / final `main` SHA: `092d07e12edaa7404e7848e999767ef979f932cb`, merged
  2026-09-14T13:23:18Z.
- Vercel Production deployment: Git-triggered on merge. Confirmed via the GitHub Deployments
  API (`GET /repos/savitz25/Conumers-Trust-Hub/deployments`): deployment `6437988057`,
  `environment: "Production"`, `sha: "092d07e12edaa7404e7848e999767ef979f932cb"`, status
  `success` at 2026-09-14T13:23:50Z, deployment URL
  `https://conumers-trust-5onmqmfb9-savitz25-s-projects.vercel.app`. No Vercel CLI was used
  (none is installed in this session); this is GitHub's own record of the Production
  deployment, not an inference from the Preview environment.

## L. Production verification

Performed 2026-09-14T13:24-13:26 UTC against `https://www.asktrusthub.com/` (HTTP 200,
`X-Vercel-Cache: PRERENDER`), after confirming the Production deployment above succeeded.

- **Deployed-code proof**: the fetched HTML contains the literal string `Specialist contract
  revision` - text that exists only in this PR's `components/specialist-network-card.tsx`
  change and did not exist in any prior deployment. This confirms the live page is serving
  the R2-05 code, not a stale cached build.
- **6-hub acceptance (section C/7)**: `grep -o 'data-specialist-origin="[A-Z]*"'` against the
  live HTML returns six matches, **all `UPSTREAM`**, one per
  `data-specialist-hub="{move,lender,insurance,senior,contractor,investor}"`. **0/6
  `FALLBACK`.** The amber "Showing last-known-good specialist snapshot" degraded-state notice
  does not appear anywhere in the page.
- **Value regression check (section 8)**: live HTML contains `662,331` (Contractor),
  `5,022` (Move publishable), `6,392` (Lender Florida Approved), `82,071` (Insurance
  agencies), `6,185` (Insurance legal insurers), `23,622` (Investor canonical firms), and
  `2,896` (Insurance Illinois Director's Order observations, rendered as its own evidence
  measure). The historical regression values `644,421`, `6,394`, and `25,777` do **not**
  appear anywhere in the page.
- **Null/search-only preservation**: live HTML contains the literal label `"Illinois current
  HHG roster (search-only; closure pending)"` - not a `0`, and not dropped.
- **No mega-total**: `total records`, `network records`, `total companies`, `all records`,
  and `TrustHub records` do not appear anywhere in the live HTML.
- **Contract revisions rendered**: `ATH-METRICS-R2-02` (Contractor, Move), `ATH-METRICS-R2-03`
  (Senior, Lender), and `ATH-METRICS-R2-04` (Insurance, Investor) all appear on the live page,
  confirming the new `contractRevision` provenance field renders correctly end-to-end.
- **Desktop/mobile rendering and browser console checks: BLOCKED.** This session has no
  browser automation available (confirmed by the operator at the start of this work). Content
  verification above covers the same server-rendered markup a browser would receive, but does
  not substitute for actual viewport rendering, layout/overflow, or a real browser console. A
  reviewer or a browser-capable session should complete this before treating section 37 as
  fully closed; it does not block this report's COMPLETE status because the underlying defect
  (contract rejection / stale fallback) is fully and independently verified above.

## M. Prompt 6 automation handoff

Manual propagation steps identified, to be automated in Prompt 6:

| Step | Repository | Current manual action | Recommended automated trigger | Notes |
|---|---|---|---|---|
| Specialist metrics generation | Each of the six specialist repos | A human runs the repo's `build_network_metrics_v1.mjs` (or equivalent) and commits the generated artifact | A GitHub Action on each specialist repo, triggered by changes to its accepted/reviewed source census, that regenerates and commits the artifact (or fails CI if the artifact is stale) | Already partly done per-repo (see each hub's own `check-*-network-metrics-stale.py`); no cross-repo trigger exists |
| Ask fallback refresh | consumers-trust-hub (this repo) | A human runs `npm run metrics:verify-specialists` and manually copies live JSON into `data/network-metrics/*-v1-fallback.json` (exactly what this PR did, once, by hand) | A scheduled GitHub Action (e.g. daily) that runs `verify-specialist-metrics.mjs`, and on success with fingerprint drift, opens an automated PR refreshing the fallback snapshot(s) | `scripts/verify-specialist-metrics.mjs` already prints a machine-parseable "drift" notice per hub for this to key off of |
| `metrics:verify-specialists` CI wiring | consumers-trust-hub | Script exists but is **not referenced by any GitHub Actions workflow** - confirmed by grep of `.github/` | Add a scheduled workflow (not on every push, to avoid coupling Ask's CI to six external repos' uptime) that runs it and alerts on real schema incompatibility | Kept out of `npm test` deliberately in this PR so the hermetic unit-test suite doesn't depend on live network access in every CI run |
| Ask regeneration trigger | consumers-trust-hub | None - Ask fetches upstream live on each request/ISR revalidation (`SPECIALIST_METRIC_REVALIDATE_SECONDS = 3600`); there is no committed "Ask network metrics" artifact analogous to the specialists' `data/home/*-network-metrics-v1.json` | Optional: introduce a committed `data/home/ask-network-metrics-v1.json` built by a script that calls the same `loadSpecialistNetworkContracts()` used at request time, for parity with the specialist pattern and for a stable "last generated" artifact to diff in CI | Not introduced in this PR - the existing live-fetch-with-ISR-cache-and-fallback pipeline already satisfies "no stale-normal-operation fallback" and "deterministic aggregation of accepted inputs" without a new parallel system; a committed artifact is an enhancement, not a fix for the defect this prompt targeted |
| Freshness/staleness policy | consumers-trust-hub + all six specialists | None - a fallback can in principle go stale indefinitely if a specialist never regenerates and Ask never notices | Prompt 6 should define an explicit max-age policy (e.g. flag/alert if `generatedAt` on an `UPSTREAM`-origin card exceeds N days) and wire it into monitoring | `contractRevision` and `generatedAt` are now both captured and rendered (this PR), giving Prompt 6 a field to alert on |
| Failure alerting | consumers-trust-hub | None observed - a hub silently falling back produces no operator-visible alert beyond the on-page amber notice | Add server-side logging/metric emission in `loadSpecialistContract` when `origin === 'FALLBACK'`, wired to existing observability | Not implemented here; out of scope for a pure client/consumer-side fix, flagged for Prompt 6 |
| State-rollout integration | consumers-trust-hub | `ADAPTER_PATHS` in `lib/network-metrics/network-evidence.ts` still hard-codes per-hub extra state paths (e.g. `/new-york`, `/illinois` for move/lender/insurance/investor) alongside the contract-native `network.publishedStateIntelligencePaths` | Long-term, every hub should export its own published-state-paths list the way Move already does, so Ask never needs a hard-coded per-hub extras list for state coverage | Left as-is in this PR (out of the named defect; changing it risks altering state-coverage claims without a specialist-side contract to verify against) |

## N. Production certification

| Claim | Status |
|---|---|
| All six specialist contracts are authoritative | TRUE - Ask consumes `metrics[]`/grains/publicationStatus as published; no specialist classification logic was reproduced in Ask |
| Ask accepts current compatible contracts | TRUE - verified locally and in Production (section L): 6/6 `UPSTREAM` |
| Ask no longer rejects contracts merely due to a pinned revision string | TRUE - `sourceFingerprint`/`contractRevision` equality gate removed from `load.ts` |
| Healthy upstreams do not use stale fallbacks | TRUE - verified locally and in Production (section L): 0/6 `FALLBACK`, no degraded-state notice rendered |
| Incompatible schemas still fail safely | TRUE - `validate.ts` structural checks unchanged/strengthened; new test proves fallback still triggers on bad `schemaVersion` |
| Null is preserved | TRUE (section G) |
| Incompatible grains are not summed | TRUE - no code path sums Contractor+Move+Insurance+Investor etc.; per-hub invariants in `validate.ts` explicitly forbid the historically-risky sums (agencies==insurers, RIA+ERA!=roster mismatch, etc.) |
| Contractor's fixed 9,974-era gap does not reappear | TRUE - fallback and live both show 662,331; regression test added |
| Lender's old 6,394 Approved value does not reappear | TRUE - fallback and live both show 6,392; regression test added |
| Illinois Move remains search-only/null | TRUE (section G) |
| Illinois Insurance orders do not inflate identity totals | TRUE - regression test added |
| Investor filings do not inflate canonical firm totals | TRUE - 23,622 preserved, 25,777 still explicitly rejected by `validateInvestorManifest` |
| Changing homepage values come from generated metrics | TRUE - unchanged from before this PR; verified by existing "presentation files do not hardcode production counts" tests plus the FORBIDDEN-literal updates in this PR |
| Specialist source datasets were not modified | TRUE - no specialist repository was touched in this session |
| Specialist repositories were not modified | TRUE |
| Production Ask equals merged main | TRUE - Production deployment `6437988057` is recorded against `sha: "092d07e12edaa7404e7848e999767ef979f932cb"`, which is the merge commit of PR #140 onto `main` (section K) |

**Caveat:** desktop/mobile browser rendering and console verification (section 37) remain
**BLOCKED** - no browser automation is available in this session. Every other claim above was
independently verified against the live Production site, not inferred from the merged code
alone.
