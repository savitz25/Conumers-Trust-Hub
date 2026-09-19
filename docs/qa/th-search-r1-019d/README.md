# TH-SEARCH-R1-019D — Ask consumes Lender's released name-candidate operation

Status: **READY_FOR_ASTRA_REVIEW**. Draft PR. Not merged, not deployed. This is an ADAPTER
INTEGRATION over the already-released R1-019A architecture — no new search engine, no other hub
touched, no Contractor activation, no L1-P/source-permission change.

Base `origin/main` `4831532ac799077c6963c7ad54b1562ec5409167`, unchanged at the final build (no
reconciliation commit needed). Branch `th-search-r1-019d-lender-adapter`.

## 1. What changed

`lenderNameAdapter.search()` now calls the RELEASED Lender operation instead of the exact-only v2
identity call:

| | Before (this PR) | After |
|---|---|---|
| Endpoint | `POST /api/specialist-execution/v2`, `queryType: "identity"` | `POST/GET /api/specialist-execution/name-candidates/v1` |
| Contract | `trusthub-specialist-execution-v2` 2.1.0 | `lender-name-candidates-v1` 1.0.0, schema `09e9764c94ec…ae74d` |
| Matching | Exact public/historical name only | Normalized/historical/search-form, then word-prefix/distinctive-word |
| R1-019A holdout (Lender) | 5/20 displayed, 5/20 lowercase, 0/12 suffix-removed | unchanged by this PR (Lender-side; see §5) |

**Untouched, by design:**
- `trusthub-specialist-execution-v2` and `NAME_SPECIALIST_LOCKS.lender` (still exported, still the
  exact contract) — nothing else in `adapters.ts` used it for Lender name search, but the constant is
  asserted byte-identical (test 01) since other Ask code (`lib/guided-research/specialists.ts`, its
  own separate `ENDPOINTS` map) still calls Lender v2 for exact identifiers, complaints/evidence and
  HMDA cohorts, completely independent of this file.
- Investor/Insurance v2 identity dispatch (`v2Identity`), Move, Senior adapters, Contractor
  (still disabled).
- Ask's own bounds: `HUB_PAGE_SIZE` (10), `INITIAL_CARDS_PER_HUB` (5), `MAX_CARDS_PER_HUB` (50),
  per-hub/overall deadlines, retry policy. Lender's 200-candidate window is a hub-side constraint
  reported through the existing `truncatedWithoutCursor`/`hasMore` fields, not a new Ask limit.
- The five-Allied fixture, `decision.ts`, `coverage.ts`, `view.ts`, the stale-response revision guard
  in `components/name-candidate-results.tsx`.

**New, minimal:**
- `LENDER_NAME_CANDIDATES_LOCK` — a separately named contract/version/fingerprint lock, its own
  optional override env var (`LENDER_NAME_CANDIDATES_EXECUTION_URL`, unset by default; the existing
  `LENDER_SPECIALIST_EXECUTION_URL` is untouched and keeps pointing v2 traffic at v2).
- `LENDER_METHOD` — an honest mapping table for the 7 released match methods (§3).
- `lenderOfficialAction()` — validates a GLEIF action against both the allowlisted origin and the
  record's own LEI in the URL fragment.
- `collapseInitialisms()` — a small, GENERIC (all-hub) fix to the existing relevance guard's `fold()`:
  a run of consecutive single-letter tokens becomes one token on both sides of a comparison, so
  `VIP` and `V.I.P.` fold to the same form. Nothing hub-specific; the guard, dedup and coverage logic
  are otherwise unchanged.
- `search.gleif.org` added to `OFFICIAL_ORIGINS.lender` (alongside the existing, previously-unused
  `consumerfinance.gov` entry).

## 2. Outcome mapping (§5 of the assignment)

| Released `resultState` | Ask `HubOutcomeState` | Notes |
|---|---|---|
| `CANDIDATES` | `COMPLETED_WITH_CANDIDATES` | normal path |
| `AMBIGUOUS_EXACT_NAME` | `COMPLETED_WITH_CANDIDATES` | records shown separately, not merged (this contract always returns ≥2 rows for this state; a defensive `AMBIGUOUS_IDENTITIES`-shaped fallback in `finish()` still protects against a hypothetical future empty-row response) |
| `NO_MATCH` | `COMPLETED_NO_CANDIDATES` | a completed miss within the stated searched sources |
| `RESTRICTED_SCOPE` | `UNSUPPORTED_OPERATION` | never a completed miss; never evidence of a hidden match |
| `SOURCE_UNAVAILABLE` | `TECHNICAL_FAILURE` / `unavailable` | |
| `INVALID_REQUEST` / unrecognized state | `TECHNICAL_FAILURE` / `invalid_response` | Ask's own bug, never a miss |
| transport failure | `TECHNICAL_FAILURE` / `timeout` or `unavailable` | existing `call()` helper, unchanged |
| contract/version/fingerprint mismatch | `TECHNICAL_FAILURE` / `contract_mismatch` | |
| `predicateApplied !== true` or echo mismatch | `TECHNICAL_FAILURE` / `name_filter_not_proven` | |

Every mapped candidate still passes through the SHARED `rowRelatesToName` guard and stable-key
dedup in `finish()` — Lender rows are not exempted from relevance checks. A row that shares only a
generic word (e.g. "Mortgage") with the supplied name is dropped as padding and read as a genuine
miss, exactly like every other hub — this is pre-existing platform-wide behavior, not new.

## 3. Match method mapping

| Released method | Ask `MatchMethod` | Why |
|---|---|---|
| `EXACT_NORMALIZED_NAME` | `NORMALIZED_NAME` | normalized source-name match, not an identifier |
| `DOCUMENTED_HISTORICAL_NAME` | `DOCUMENTED_ALIAS` | the ACTUAL historical text is returned (`match.value`), shown verbatim as `matchedName` — unlike Move, whose source never returns the alias text |
| `LEGAL_SUFFIX_NORMALIZED` | `NORMALIZED_NAME` | search-form normalization |
| `ABBREVIATION_NORMALIZED` | `NORMALIZED_NAME` | a search-form rule (FCU), never `DOCUMENTED_ALIAS` |
| `DERIVED_SLUG_FORM` | `HUB_NAME_MATCH` | a profile-URL-derived form, never presented as an official/recorded alias |
| `WORD_PREFIX` | `PREFIX_OR_TOKEN` | |
| `DISTINCTIVE_TOKENS` | `PREFIX_OR_TOKEN` | |
| unrecognized | *(row dropped)* | never invented into a known method |

`matchedField` is always the hub's own `match.sourceLabel` (e.g. "historical name recorded on the
published profile"), never reconstructed.

## 4. GLEIF action validation

`lenderOfficialAction(raw, lei)`:
1. `safeHubUrl('lender', raw)` — https, no credentials, origin on the allowlist (now includes
   `search.gleif.org`).
2. `url.origin === 'https://search.gleif.org'` exactly.
3. `url.hash === '#/record/' + lei` — the record's OWN LEI, not any LEI on the row.

Any failure (wrong origin, wrong/missing fragment, credentials, non-https scheme) drops the action
to `null` — the record itself is kept, never erased, and no link is rewritten to a generic page.
Verified in the browser pass: `https://search.gleif.org/#/record/G5AHTAP80NWA3Q8RDC78` → HTTP 200,
matching the displayed LEI exactly.

## 5. Tests, mutations, regressions

- `npm run check:th-search-r1-019d` → **12 new tests** + the full existing `check:th-search-r1-019a`
  chain (44 + 136 = 180) = **192/192**. Covers dispatch-goes-to-v1, BMO/Alliant/Randolph-Brooks
  mapping, Frost's GLEIF link, VIP/V.I.P./FCU/legal-suffix/historical/derived forms, 10 negative
  controls (wrong echo, wrong fingerprint, category-only padding, an unrelated row falsely claiming
  `NORMALIZED_NAME`, a row missing its match block, a fabricated method, and 4 bad-GLEIF-link
  shapes), research-only/held-reporter cards with no borrowed identifiers, every distinct outcome
  state, Lender's window vs. Ask's own per-hub cap, verbatim name passthrough, the untouched
  five-Allied fixture, honest labels/counts, and a source-scan assertion that the adapter file never
  references Supabase/service-role/storage surfaces.
- The 4 pre-existing Lender-specific tests in `th-search-r1-019a-review1.test.ts` (R3a–d) were
  rewritten against the new contract shape — they still prove the SAME guarantees (ambiguity
  preserved, records not merged, malformed payloads are failures not misses, alias text never
  invented) — and now additionally assert `matchedName` is the actual returned historical text
  (Lender's engine always returns it) rather than `null` (Move's historical case, where the source
  never returns alias text — both remain correctly distinct).
- Mutations (`mutation-report.json`), **3/3 DETECTED**, each restored byte-identical (sha1), 51/0
  clean after: (A) dispatch reverted to the old v2 identity call, (B) the GLEIF fragment check
  dropped, (C) `SOURCE_UNAVAILABLE` misclassified as a completed miss.
- Regressions, all green: `check:th-search-r1-016` 149, `check:th-search-r1-018` 136,
  `check:ath-guided-001` 26, `check:ath-guided-003` 7, `check:ath-claim-governance-001` 21,
  `check:ath-claim-public-001` 7, `check:ath-claim-publish-001` 16, `check:ath-obs-001` 32,
  `check:ath-obs-002de` 54, `check:ath-rel-001a` 15, `check:ath-metrics-001c` 19,
  `check:ath-neon-001` 10.
- `tsc --noEmit` clean. ESLint 0 errors, 0 warnings in touched files. Optimized `next build` OK.
- No inherited baseline failures were found in any of the above.

## 6. Old-adapter differential (live, read-only)

Required proof that Ask itself — not just LenderTrustHub's own page — gains a real result.
`old-adapter-differential.json`: the SAME input, `"rocket mortgage llc"`, against production:

| Path | Endpoint | Result |
|---|---|---|
| Old (pre-PR) | `v2` `queryType:"identity"` | `NO_CONFIDENT_MATCH` — a completed miss |
| New (this PR) | `name-candidates/v1` | `CANDIDATES` — Rocket Mortgage, NMLS 3030, method `LEGAL_SUFFIX_NORMALIZED` |

BMO Bank is not used for this differential because it already matched exactly on the old path (no
difference to show); the suffix-removed name is the genuine improvement.

## 7. Browser evidence (`browser-playwright.json`)

Headless Playwright, fresh isolated context per viewport, `deviceScaleFactor: 1`, 1280/390/320,
**real typed input and a real trusted Enter keypress** (`keydown.isTrusted === true` recorded on
every submit) against the optimized local Ask build (`localhost:3231`), calling the LIVE, read-only
released Lender endpoint — clearly distinguished from the mocked-transport unit tests above.

- BMO Bank → 1 candidate; clicked the real profile link → `lendertrusthub.com/lender/bmo-bank`
  (HTTP 200, checked separately).
- Alliant Credit Union → found. Randolph-Brooks FCU → both records shown separately (not merged).
- Frost Bank → GLEIF action `https://search.gleif.org/#/record/G5AHTAP80NWA3Q8RDC78` (HTTP 200,
  fragment matches the displayed LEI exactly).
- VIP Mortgage Inc → found as `V.I.P. MORTGAGE, INC.` (confirms the initialism fix live, not just in
  mocked tests).
- First → View more clicked on the real button; a later Lender page rendered alongside Move,
  Insurance and Investor groups from the SAME cross-hub search — confirms this integration coexists
  with every other hub's live results.
- A genuine nonexistent name → name retained, `PARTIAL_MISS` (some hubs completed with no match,
  overall coverage stayed honest).
- Allied across hubs → Move, Insurance and Investor groups rendered; Lender correctly has no group
  (no live "Allied" institution exists there — a genuine per-hub miss, not an error) — confirms
  mixed-hub rendering is unaffected.
- Refresh and History Back both preserved the correct query/result state.
- An optional hub filter (`hub=move` via the "Moving" chip) scoped correctly.
- 320 px: no page overflow in 3 checked states.
- 2 console messages logged (404 on `/_vercel/insights/script.js`) — confirmed by direct URL capture
  to be Vercel Analytics' own script on a plain local `next start`, unrelated to this feature.

## 8. Small Lender-receipt correction (no platform action)

Lender PR #51 comment now carries a dated correction: the earlier claim that project
`lender-trust-hub-ask-search-009` "confirmed" the canonical-domain owner was insufficiently
supported — both connected Vercel projects (`lender-trust-hub` and `…-ask-search-009`) build and
deploy on every push to `main` and both reported success for the same merge SHA, so SHA-matching
alone cannot establish alias ownership. This session has no Vercel API/CLI access to query the
alias→deployment→project chain directly, so the discrepancy with the coordinator's
`get_deployment` result (project `lender-trust-hub`) is recorded, not resolved. No Vercel
project/domain/alias was changed.

## 9. Boundaries

No edit to any other specialist repository. No Contractor activation (still `enabled: false`, its
own dependency note untouched). No L1-P / source-permission change — Ask still cannot see Altura or
AnnieMac by name, exactly as Lender's own release documented. No auth/RLS/data/schema/billing/
environment change. No new dependency.

## 10. Astra review 1 corrections (CHANGES_REQUESTED on `5d1f31e6d3e0fb0a9963d264443f33817ad2fb35`)

Three defect families plus the neutral-label copy requirement, fixed on the same branch/PR. Live
evidence for R1 and R2 was independently reproduced against the real endpoint on 2026-09-19 before
any code change (matching curls, same responses the review cited), per the reviewer's instruction to
reproduce before editing.

**R1 -- initialism equivalence must survive OTHER name-form differences.** `fold()`'s whole-string
containment already collapsed "V.I.P." to "vip", but `rowRelatesToName`'s token-sharing FALLBACK
(used whenever containment fails for any reason, e.g. a differing legal suffix) recomputed raw,
uncollapsed `nameTokens()`. "VIP Mortgage LLC" vs "V.I.P. MORTGAGE, INC." (LLC vs INC) fell through to
that fallback and was rejected, then silently reclassified as category-word padding
(`COMPLETED_NO_CANDIDATES`) because it still shared the generic word "mortgage". Fixed by introducing
one `normalizedTokens()` helper (collapse-then-tokenize) used everywhere `rowRelatesToName` compares
two names, not only inside `fold()`. `collapseInitialisms` was also narrowed to single ASCII LETTERS
only (a lone digit token, e.g. from "3 M Company", is never folded into a run) after tracing the
numeric-leading-name requirement. New tests: `th-search-r1-019d-review1.test.ts` "R1-fix" (the exact
differing-suffix case, both directions, case, suffix-added/removed) and "R1-fix cross-hub regression"
(unrelated initialisms, mid-word containment, meaningful separated initials, numeric-leading names,
plus one real run through `investorNameAdapter` proving the shared helper is not Lender-scoped).

**R2 -- the hub-supplied continuation must survive Ask's own cap.** `lenderNameAdapter` set
`continuation = hasMore ? null : ...`, so once Lender had ANY further page the continuation was
discarded; if Ask's own 50-card cap was reached before Lender's `hasMore` ever went false (the normal
case for a common name), the customer had no way forward at all despite Lender reporting dozens more
records. Fixed by computing the continuation on every successful page unconditionally (Lender's
`operation.ts` always returns one). Added `lenderResearchAction()` so the continuation additionally
stays scoped to the searched name (its `q` param must echo the supplied name) rather than merely
landing on Lender's origin. New test "R2-fix" walks the REAL adapter across 5 real pages via
`mergeHubPage` to the exact 50-card Ask cap and asserts `hub.continuation` is non-null with the
correct scoped href -- not just that `moreStateOf === 'ASK_CAPPED'`.

**R3 -- complete validation for the v1 contract before coercion (representative fixes, not a new
framework).** All derived read-only from the released `operation.ts`/`engine.ts` (never guessed):
- A: transport status is now checked (`res.status !== 200` fails closed even behind a
  success-shaped body); `NO_MATCH` with nonempty `candidates`, and `CANDIDATES`/`AMBIGUOUS_EXACT_NAME`
  with zero real rows, are now contract failures (`invalid_response`), not silently accepted.
- B: `Array.isArray(p.candidates)` is checked BEFORE the existing `records()` filter can silently turn
  a non-array or array-of-primitives payload into an empty "completed miss"; `finish()`'s existing
  malformed-vs-miss distinction now receives the TRUE raw array length, not the post-filter count.
  Pagination is validated against the engine's own formulas (`reachable = min(total, window)`,
  `pageCount = max(1, ceil(reachable/limit))`, `hasMore`/`outOfRange` derived the same way) -- checking
  relationships, never a specific name's counts. A genuinely valid empty out-of-range page is still
  accepted.
- C: `stableKey` namespace is checked against the catalog's own three prefixes
  (`nmls-inst:`/`lei:`/`hmda-lei:`) -- a branch/person-shaped key can never come from this catalog and
  is now rejected rather than passed on `startsWith('lender:')` alone. `publicationState` is checked
  against the three states the engine actually emits; an unrecognized one is dropped, not displayed.
- D: each declared method is checked against the field it is allowed to have come from in
  `engine.ts matchOneName` (e.g. `DOCUMENTED_HISTORICAL_NAME` only from `historical_name`,
  `DERIVED_SLUG_FORM` only from `derived_slug_form`) -- an intact match block with an impossible
  method/field pairing is now caught, not just a block with the whole match object deleted. The method
  lookup is also `Object.hasOwn`-guarded against prototype-chain keys.
- E: a PROFILE-typed action whose URL actually resolves to `search.gleif.org` now ALWAYS takes the
  strict LEI-fragment-bound path (previously it could borrow the generic, weaker PROFILE check and
  bypass the binding entirely). The RESEARCH continuation is dropped, not merely left on the Lender
  origin, when its own `q` param does not echo the searched name.
- F: unchanged from the existing per-row `flatMap` drop + `finish()`'s "all-garbage -> failure,
  some-valid -> proceed" logic, now fed the correct raw row count (see B) so a single malformed row
  among otherwise-good rows still proceeds instead of failing the whole page.

Identifier syntax (`NMLS: \d{2,12}`, `LEI: [A-Z0-9]{20}`) and per-label de-duplication are enforced
without inventing new identifier shapes; a malformed identifier is dropped from that one field, never
erasing the card. New tests: "R3-fix A" through "R3-fix: identifier syntax and duplicates" in
`th-search-r1-019d-review1.test.ts`.

Several EXISTING fixtures in `th-search-r1-019d.test.ts` and `th-search-r1-019a-review1.test.ts`
predated this stricter validation and were themselves non-compliant with the real contract --
`stableKey` used the wrong namespace (`lender:nmls:…` instead of the catalog's actual
`lender:nmls-inst:…`), `DOCUMENTED_HISTORICAL_NAME`/`DERIVED_SLUG_FORM` rows omitted the one `field`
value those methods can actually carry, and the window-cap/out-of-range pagination tests requested
page 1 or page 4 while asserting numbers only a different page could produce. These are corrected to
the real contract's shapes (verified against `lib/name-candidates/{catalog,engine,operation}.ts`,
read-only); no test's asserted OUTCOME changed as a result, only the fixture's internal consistency.

**Small existing copy requirement.** `components/name-candidate-results.tsx` now renders a constant
`"Lending institution record"` as the Lender candidate card's lead-badge subtype instead of passing
`candidate.entityType` straight through (unverified upstream subtype provenance, per the original
assignment). `entityType` itself is untouched on the adapter/candidate object for every hub including
Lender -- only the ONE render site for this one hub's badge changed.

**Evidence for this pass:**
- `astra-review1-red-before.txt` / `astra-review1-green-after.txt` -- 12 of the 13 new
  `th-search-r1-019d-review1.test.ts` tests fail against the exact reviewed head
  (`5d1f31e6d3e0fb0a9963d264443f33817ad2fb35`, `adapters.ts` + the component swapped back byte-for-byte
  and restored afterward) and all 13 pass on the corrected build.
- `mutation-report.json` -- 8 mutations (the original 3 plus 5 new ones re-introducing each Astra
  review 1 defect individually), all DETECTED, all byte-identical restores.
- `holdout-through-adapter.json` -- the UNCHANGED frozen `docs/qa/th-search-r1-019a/holdout-frozen.json`
  Lender sample (sha256 `0336a217…`, 20 rows, order/keys untouched) run for the first time through the
  REAL `lenderNameAdapter` against the LIVE endpoint: 20/20 present. 5 of the 20 (JPMorgan Chase Bank,
  Space Coast Credit Union, Newrez, AmeriSave Mortgage, Lakeview Loan Servicing) are keyed by their
  published-profile `nmls-inst:` stable key rather than the sample's original `lei:` key -- a
  legitimate re-keying (the LEI still appears verbatim in that candidate's `identifiers`), disclosed
  honestly rather than hidden. The combined initialism+suffix family (VIP Mortgage LLC /
  V.I.P. Mortgage Inc) was run as a SEPARATE live case, confirming R1's fix end-to-end on production
  data, not just mocked fixtures.
- `astra-review1-browser.json` -- fresh headless Playwright, real typed input, against the corrected
  local build and the live endpoint: "VIP Mortgage LLC" now returns "V.I.P. MORTGAGE, INC." live;
  "First" walked through real "View more" clicks to Ask's exact 50-card cap with `moreState ===
  'ASK_CAPPED'` AND the native continuation link genuinely present and correctly scoped
  (`https://www.lendertrusthub.com/ask?q=First`); BMO/Frost/Randolph-Brooks profile and GLEIF links
  unaffected; a genuine miss stayed a genuine miss; refresh/back preserved query state; no page
  overflow at 320px; the only console error is the pre-existing, unrelated Vercel Analytics 404 on a
  plain local `next start`.
- Full regression: `npm run check:th-search-r1-019d` (now also runs the new review-1 file; 25 + 44 +
  136 tests, all pass), `check:ath-guided-001/003`, `check:ath-claim-governance-001`,
  `check:ath-obs-001`, `check:ath-metrics-r2-06`, `check:ath-neon-001` (all pass), `tsc --noEmit`
  (clean), `eslint` on every changed/new file (clean), `next build` (succeeds).

No parent-owned catalog/matcher, company exception, index, or paid service was added. No change to
source permissions, query budgets, the R1-019A architecture, or the L1-P boundary. `origin/main` did
not move during this pass (`4831532`); PR #182 stays draft, unmerged.

## 11. Astra review 2 corrections (CHANGES_REQUESTED on `7a63e00503d48fcd24ed8eab7dfc0ba6a8c2138c`)

One blocker: `LENDER_KEY_NAMESPACE` (`/^lender:(?:nmls-inst|lei|hmda-lei):[A-Za-z0-9]+$/`) was not the
released source's complete namespace contract. It guessed a bare `lei:` family that is not actually
produced by this operation, and it was missing `fdic-cert:` entirely -- rejecting already-approved
public-profile records outright.

**Source-key family inventory (derived read-only, not guessed):** an eligible PUBLIC PROFILE copies
`record.stable_key` verbatim into `institutionKey` (`lib/name-candidates/catalog.ts`). Across that
source's real data -- `lib/national-profile/cohort.ts`'s ten-row QA sample, which deliberately spans
every eligible shape (NMLS-keyed banks/credit unions, LEI-keyed nonbank servicers, an FDIC-cert-keyed
small bank with no NMLS/LEI coverage), plus two independently-reproduced live probes -- that key takes
exactly three forms: `nmls-inst:<NMLS id>` (digits, 2-12 per `lib/ask-lender/identity-lookup.ts`'s own
`record.nmls` contract check), `gleif-lei:<LEI>` (20-char ISO 17442, per that same file's `record.lei`
check and `lib/identity/namespaces.ts normalizeLeiValue`), and `fdic-cert:<FDIC cert id>` (digits;
confirmed live on "First State Bank" -- `fdic-cert:15663/12836/22971` -- and in `cohort.ts`'s
`fdic-cert:16243`). A standalone HMDA research row (no profile) is synthesized directly in
`catalog.ts`, never copied from a profile record: `hmda-lei:<LEI>` (same 20-char syntax).
`nmls-branch:`/`nmls-person:` are confirmed EXCLUDED (`lib/national-profile/disc-tests.ts` asserts
neither ever appears in the discovery feed the catalog reads). `lib/identity/namespaces.ts` lists
several more `IdentifierType`s (`NCUA_CHARTER`, `RSSD`, `FHA_ID`, `HUD_ID`, `SBA_ID`,
`STATE_LICENSE`, `OTHER_AUTHORITATIVE`) but none of them is ever used as a stable-key prefix anywhere
in the released source -- they belong to a separate internal identity-graph representation this
operation never exposes, so none was added here.

**Fix:** `LENDER_KEY_NAMESPACE` replaced with a table-driven `LENDER_KEY_FAMILY_SYNTAX` map (one regex
per family) and `validLenderStableKey()`, which parses `lender:<family>:<suffix>` and checks the
suffix against that family's own syntax. Unknown families, and the confirmed-excluded
`nmls-branch:`/`nmls-person:`/`nmls-mlo:`, are rejected outright -- not by guessing from the business
name, and without accepting any arbitrary `lender:` string. The supplied key is preserved exactly
everywhere else in the row mapping; nothing rewrites a profile's own key onto a different namespace or
merges records by a coincidental name/identifier match.

**Evidence:**
- `astra-review2-red-before.txt` / `astra-review2-green-after.txt` -- 3 new tests
  (`th-search-r1-019d-review2.test.ts`) fail against the exact reviewed head
  (`7a63e00503d48fcd24ed8eab7dfc0ba6a8c2138c`, `adapters.ts` swapped back byte-for-byte and restored
  afterward) and pass on the corrected build.
- `th-search-r1-019d-review2.test.ts`: a table-driven positive/negative matrix (all 4 real families
  admitted; `nmls-branch`/`nmls-person`/`nmls-mlo`/unknown families/malformed suffixes/missing prefix
  all rejected with zero substitute records manufactured) plus full-adapter reproductions of both live
  examples -- "First State Bank" (exact `fdic-cert:15663` target plus the other 4 real records, all
  distinct, in the source's own order) and "Select Portfolio Servicing" (retains its `gleif-lei` key,
  LEI identifier, matched name and profile action).
- `mutation-report.json` -- 9/9 mutations DETECTED (the 8 from review 1 plus one restoring the
  restrictive three-family regex), all byte-identical restores.
- `holdout-through-adapter-review2.json` -- the SAME frozen 20-row sample (sha256 `0336a217…`,
  confirmed unchanged from the review-1 run) re-run once against the review-2-corrected adapter: 20/20
  present, zero difference from the review-1 run. The sample itself only exercises `nmls-inst`/
  `hmda-lei` (drawn before this gap was found -- exactly why the live probes, not the frozen sample,
  caught it). Supplemented, not replaced, with a separate live namespace-family coverage check
  confirming `fdic-cert` (First State Bank) and `gleif-lei` (Select Portfolio Servicing) both now
  resolve correctly, and a re-run of the combined initialism+suffix family confirming no regression.
- `astra-review2-browser.json` -- fresh headless Playwright against the corrected local build and the
  live endpoint: "First State Bank" renders all 5 real records; "Select Portfolio Servicing" renders
  with its correct profile link; "VIP Mortgage LLC" still fixed (no review-1 regression); "First"
  reaches the exact 50-card Ask cap with the native continuation control present and correctly scoped,
  and the cap's card list now visibly includes the previously-rejected First State Bank family
  members; a genuine miss stays a genuine miss; "Allied" cross-hub control unaffected; no overflow at
  320px; only the pre-existing, unrelated Vercel Analytics 404 in console.
- Full regression: `npm run check:th-search-r1-019d` (28 + 44 + 136 tests, all pass, now also running
  the review-2 file), `check:ath-guided-001/003`, `check:ath-claim-governance-001`, `check:ath-obs-001`,
  `check:ath-metrics-r2-06`, `check:ath-neon-001`, `check:ask-lender-execute` (exact-ID/v2 regression,
  17 tests) all pass. `tsc --noEmit` clean. `eslint` clean on every changed/new file. `next build`
  succeeds.

Only ONE runtime file changed this round: `lib/network/name-candidates/adapters.ts` (the namespace
validator). `components/name-candidate-results.tsx` is untouched in review 2 -- across the whole PR,
exactly two runtime files have ever changed: that adapter and that one card component. No other
specialist engine, schema, publication permission, or index was touched. `origin/main` did not move
during this pass. PR #182 stays draft, unmerged.

## 12. Remaining scope (explicitly open, not claimed here)

- Separate exact-head coordinator/Astra review, then merge and deploy authorization.
- Post-deployment: verify the correct Ask deployment/alias, a small canonical browser smoke on
  production Ask, and confirm no fixture leakage — none of that is done in this pass.
- Contractor (R1-019B, Builder 2's), Senior/Insurance/Investor native-search parity, the 12
  disputed-LEI index rows, and the L1-P policy decision remain exactly where the Lender R1-019C
  receipt left them.
- This closes the Ask↔Lender integration only. It does not close all-six name discovery or the
  overall Search Reliability R1 milestone.
