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

## 10. Remaining scope (explicitly open, not claimed here)

- Separate exact-head coordinator/Astra review, then merge and deploy authorization.
- Post-deployment: verify the correct Ask deployment/alias, a small canonical browser smoke on
  production Ask, and confirm no fixture leakage — none of that is done in this pass.
- Contractor (R1-019B, Builder 2's), Senior/Insurance/Investor native-search parity, the 12
  disputed-LEI index rows, and the L1-P policy decision remain exactly where the Lender R1-019C
  receipt left them.
- This closes the Ask↔Lender integration only. It does not close all-six name discovery or the
  overall Search Reliability R1 milestone.
