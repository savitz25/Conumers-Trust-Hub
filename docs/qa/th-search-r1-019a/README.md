# TH-SEARCH-R1-019A — Results-First Name Discovery (first milestone)

Status: **READY_FOR_ASTRA_REVIEW**. Pre-merge evidence only. Not merged, not deployed, not a
production receipt, not ALL_SIX_COMPLETE, not SEARCH_RELIABILITY_R1_COMPLETE.

- Baseline: `origin/main` @ `4372073` (no prior R1-019 branch, worktree, PR or AGENTS.md existed).
- Branch: `th-search-r1-019a-name-candidates`.
- The "Ask Search Zero-Results Fix Plan" and R1-019 addenda were not present on the build machine;
  this work follows the coordinator's R1-019A specification text. Historical observations in it were
  treated as leads and re-reproduced against today's code and live hubs.
- The open R1-018 final certification (PR #150, head `2e22765`) predates this work and does not
  cover the unscoped name-discovery family. It was not modified.

## What changed

An unscoped business/provider name typed into Ask is searched across the network first — no hub
selection, identifier, title case, legal suffix or repeated name required.

| Piece | File |
|---|---|
| Common candidate + coverage contract | `lib/network/name-candidates/contract.ts` |
| ONE authoritative name decision (page, name API, guided API all consult it) | `lib/network/name-candidates/decision.ts` |
| Hub adapters over already-deployed structured name operations | `lib/network/name-candidates/adapters.ts` |
| Bounded fan-out, deadline, single transient retry, coverage, ordering | `lib/network/name-candidates/orchestrator.ts` |
| Pure view-model + results-first client component | `lib/network/name-candidates/view.ts`, `components/name-candidate-results.tsx` |
| Explicit-submit / View-more API (server re-derives the decision) | `app/api/name-candidates/route.ts` |
| Privacy-safe outcome telemetry (no names, identifiers or URLs) | `lib/network/name-candidates/telemetry.ts` |
| Hypothetical five-Allied fixture (never servable in production) | `lib/network/name-candidates/fixtures.ts` |

The existing planner was not rewritten. Identifiers, cohort discovery, definitions/how-to,
comparisons, journeys, care tasks and deictic missing subjects keep their existing paths (test 10).

## Six-hub adapter / source-permission matrix

| Hub | State | Operation actually called | Proof the name filter ran | Notes |
|---|---|---|---|---|
| Move | **Enabled** | `GET /api/network/identity-resolver` (`move-network-resolver-v1`, version + schema + contract fingerprints pinned) | hub echoes `normalizedQuery` | Same engine as the native search box (`searchMovers` → `matchCompanyIdentity`). Per-row hub `matchClass`. |
| Investor | **Enabled** | `POST /api/specialist-execution/v2` `queryType:"identity"` | `appliedFilters.identityName` | Hub matching is "name contains". Research-row-only firms link to the hub-supplied SEC/IARD URL. |
| Insurance | **Enabled** | same v2 `identity` | `queryInterpretation.interpretation["Requested name"]` | Organizations only — producer (person) rows are never admitted. Hub caps at 10 with no cursor → disclosed as `10+` with a hub continuation. |
| Lender | **Enabled (exact-name only)** | same v2 `identity` | `queryInterpretation.identityName` | Hub engine is `exact_public_or_historical_name` over a controlled public corpus. See dependency L1. |
| Senior | **Enabled (when the hub confirms name mode)** | `GET /api/ask` (`senior-ask-v1` JSON — the native engine) | `query.mode === "entity"` and echoed `identityQuery` | Free-text endpoint: if it reads the text as a care category it is reported UNSUPPORTED, never a miss. See dependency S1. |
| Contractor | **Statically disabled — dependency C1** | none (the adapter returns without a network call) | — | v2 declares `queryType:"identity"` but rejects every name field (`unsupported_field`). `contractorNameAdapter` is `enabled:false` in code. |

No publication policy was expanded. Every displayed field is one the hub's own public structured
contract already returns. No policy decision is outstanding for this milestone.

### Dependencies (owners: the respective specialist repos — not edited here)

- **C1 Contractor** — TWO things are required, and neither is done here: (1) a verified
  Contractor-owned name operation (for example a v2 wrapper exposing `identityName` over the
  `searchContractors()` engine behind `/verify`), AND (2) an explicit, reviewed activation of the Ask
  adapter. `contractorNameAdapter` is statically disabled (`enabled:false`, returns without a call),
  so a Contractor-side wrapper ALONE does not enable Contractor in Ask. *(Correction: an earlier
  version of this file implied the wrapper alone would suffice.)* Both belong to R1-019B. Until then
  Ask shows a Verify continuation and reports Contractor as unsupported, never as a miss — which is
  also why an all-network search with zero candidates is a PARTIAL miss, not a complete one.
- **L1 Lender** — identity op matches exact accepted names only; candidate (prefix/token) matching
  and legal-suffix tolerance are needed for parity with the other hubs.
- **S1 Senior** — a structured name parameter so provider names containing care/place words
  ("Deerbrook Skilled Nursing and Rehab Center", "FFIII Houston SNF Tenant LLC",
  "A Holly Patterson Extended Care Facility", one-word "Allied") are searched as names.
- **I1 Insurance** — hub `selectionUrl` values contain literal `state=undefined&loa=undefined`
  params that break the hub's own page. Ask drops only those params from the hub-supplied URL
  (verified to load the hub's "server-revalidated selected source identity" page).
- **Native parity gaps (preserved, open):** Move and Senior adapters call the same hub-owned
  operation as the native site. For **Investor, Insurance and Lender**, Ask calls the hub's v2
  `identity` operation; whether that returns the same records as each hub's own native search box
  was NOT verified and must not be read as established. These remain open dependencies.

## Evidence

Baseline (starting commit, `baseline-planner.json`): `Allied`, `allied`, `Cirta`, `1-800-Pack-Rat`,
`10 East Partners` → CLARIFICATION with no hub; `Allied Van Lines`, `Abbey Delray South`,
`Tate Asset Management` recognized as names but blocked because the hub was unknown;
`Allied Moving` silently Moving-only; `Pure Moving Company` and `A Holly Patterson Extended Care
Facility` forced into category questionnaires.

Live (real hubs, `live-smoke.json`): `Allied` → 17 candidates (Move 1, Insurance 10+, Investor 6)
in 1.9 s with 5 calls. Found: Allied Van Lines (USDOT 76235), Cirta Moving LLC, Pure Moving
Company, 1-800-Pack-Rat, Abbey Delray South (CCN 105411), Tate Asset Management (CRD 160657),
Rocket Mortgage (NMLS 3030). A nonexistent name is a completed miss, not an error.

Gate: `npm run check:th-search-r1-019a` → 39/39 (24 original + 15 review-1) + 136/136 existing R1-018 regressions.
Also green: `check:th-search-r1-016` 149/149, `check:th-arch-p0-001` 17/17, `check:ath-obs-001`,
`check:ath-metrics-001c`, `npm test`, `tsc --noEmit`, `next build`. ESLint: 0 errors (4 warnings in
files untouched by this branch).

Mutations (`mutation-report.json`): restored hub-required gate, dropped name-filter guard, and
silent omission of a responding hub are each DETECTED (plus four review-1 mutations, below).

Frozen holdout (`holdout-frozen.json`, 20 eligible records per enabled hub drawn at fixed
scope/page/row positions from each hub's own cohort operation before any matching was evaluated).
Diagnostic small sample — no statistical claim. Displayed-name recall on the candidate code:

| Hub | Displayed | Lowercase | Redundant clarifications | Notes |
|---|---|---|---|---|
| Move | 20/20 | 20/20 | 0 | one presentation variant (`C&L Movers`) is beyond the hub's first page → disclosed as partial |
| Investor | 20/20 | 20/20 | 0 | |
| Insurance | 20/20 (run 2); 17/20 (run 3); 20/20 (run 4) | same | 0 | run 3: 9 timed-out requests across all variants, 3 of them displayed-name rows, all at the target hub (see Review 1) |
| Senior | 18/20 | 18/20 | 0 | both misses are dependency S1 (hub reports UNSUPPORTED) |
| Lender | 5/20 (6/20 by name) | 5/20 | 0 | dependency L1; the only enumerable Lender operation (HMDA LEI cohort) is a different grain than the identity corpus |

The holdout found and drove fixes for: a false name-echo failure on apostrophe names, category-word
padding (`C&L Movers LLC` → "Call The Movers"), 11 redundant clarifications for organization-shaped
names the planner read as a journey/care task/place, and a false failure on padding-only pages.
Every remaining miss is listed in `holdout-results.run3.json` / `holdout-results.run4.json`.

Browser (optimized `next build` + `next start`, real Chrome): fixture `Allied` via the real form →
6 cards in 4 hub groups, no hub selection, no repeat-name field, distractors absent; Moving chip →
the 2 Move records with the query kept; Back → all 6. Live `allied` → 17 real records; View more
5→10. True 390 px and 320 px viewports: no horizontal overflow, single column, 44 px controls.
API: revision echoed, scoped search = 1 call, identifiers/cohorts/deictic refused (422),
user-supplied URL/SQL fields rejected (400), guided START defers bare names (409).
The in-flight stale "View more" race was later exercised in a browser with controlled fixtures — see Review 1.

## Review 1 corrections (reviewed head `0851240`, outcome CHANGES_REQUESTED)

Red-before on the reviewed head: `review-1/red-before-0851240.json` (all four findings REPRODUCED,
`scripts/r19a-review-red.mts`). Green-after: `review-1/green-after.json` (all four "not reproduced").
Tests: `lib/network/name-candidates/th-search-r1-019a-review1.test.ts` (R1a–R5), in the same gate.

| # | Finding | Correction (code) | Executed tests |
|---|---|---|---|
| 1 | Zero results dropped the name UI and re-entered the category questionnaire | `page-state.ts` `resolveAskNameState`: once NAME_CANDIDATES is the operation the page ALWAYS renders the name result (`app/ask/page.tsx` `showNameCandidates = Boolean(nameResults)`; guided flow and senior preview suppressed). The other reading is an explicit labeled link (`askCategoryHref`, `?interpret=category`) — never auto-dispatched. API and guided START use the same decision (`interpretAs`). | R1a relevant source fails/others miss, R1b all fail, R1c relevant unsupported, R1d genuine scoped miss, R1e positive control — each asserts mode, retained name, result kind and the adapter dispatch count (no second cohort retrieval) |
| 2 | Truncated-empty hub had no View-more control | `view.ts`: a hub is a group when it has cards OR `hasMore` OR (truncated-empty with a continuation). `MoreState` = COMPLETE / MORE_AVAILABLE / SOURCE_CAPPED / ASK_CAPPED; a cap never reads as exhaustion. `mergeHubPage` keeps prior cards and adopts a failed/unsupported/restricted next page's state without advancing the cursor. Relevance rules unchanged. | R2a empty page 1 → record on page 2 via the control's code path, R2b failed next page, R2c multi-page + caps + positive first page |
| 3 | Upstream AMBIGUOUS_IDENTITIES with no rows became a completed miss | `adapters.ts` `finish(…, upstream)`: new state `AMBIGUOUS_NO_CANDIDATES` with the hub continuation; supplied rows stay separate records; unmappable rows and EXACT/SUPPORTED-without-rows are `invalid_response` failures, not misses. Alias check: Move/Lender report DOCUMENTED_ALIAS with `matchedName: null` (no invented field) and `rowRelatesToName` admits it. | R3a full lender adapter ambiguity, R3b supplied rows separate, R3c malformed ≠ miss, R3d source-established alias kept |
| 4 | "No records named … were found" while a source failed | `coverage.ts` is the single interpretation read by heading, lead, view and telemetry. Kinds: CANDIDATES / COMPLETED_MISS (every in-scope hub completed) / PARTIAL_MISS ("No matches … in the N sources that completed") / NOT_COMPLETED. Incomplete, ambiguous, unsupported and restricted hubs are listed separately. | R4 (miss+failure, miss+unsupported, all failed, truncated-empty, true miss), R4b positives |
| 5 | Evidence/planning cleanup | this section | R5 (link hygiene never yields an unscoped redirect; date meaning carried). Raw control bytes: original gate test + a byte scan of all 38 changed files (0 found) |

Mutations (`mutation-report.json`, 7/7 DETECTED): the three original ones plus D zero-result legacy
fallback, E ambiguity→miss, F no control for an empty page, G unqualified miss headline. The script
restores each file from memory (never `git checkout`); sha1 of every mutated file was identical
before and after, and the gate is 39/0 after restore.

### Holdout — every run preserved, none re-run for a better sample

`holdout-summary.run2.json`, `holdout-results.run3.json`, `holdout-results.run4.json`; comparison in
`review-1/holdout-report.json`. Every holdout request was scoped to the record's OWN hub, so every
timeout below is a **target-hub** failure; no unrelated hub was called.

- **Insurance timeouts (corrected wording).** Run 3 had 9 timed-out *requests* across the three
  variants (displayed / lowercase / presentation); 3 of them were displayed-name rows. Run 3
  displayed-name recall: **17/20 end-to-end**, **17/17 when the target source completed**. Run 4:
  20/20 and 20/20. All timeouts surfaced as TECHNICAL_FAILURE, never as a miss.
- **Changed outcomes run 3 → run 4:** exactly those 9 Insurance rows (TECHNICAL_FAILURE →
  COMPLETED_WITH_CANDIDATES), listed individually in the report. No other row changed.
- **Investor irrelevant candidates (2, not counted as correct).** Both are the same firm under two
  variants of one input: input `ALPHA ASSET MANAGEMENT` / `alpha asset management` → candidate
  **CLEVERALPHA** (`investor:crd:301620`), method NAME_CONTAINS, matched field "SEC/IARD legal name",
  matched name `CLEVERALPHA ASSET MANAGEMENT, LLC` — a mid-word substring. Correction:
  `rowRelatesToName` now requires word-boundary containment. The holdout was NOT re-run after this
  change; the live control (`review-1/live-controls.json`) shows the input now returns 1 candidate
  (the intended firm, NORMALIZED_NAME) and CLEVERALPHA is rejected.
- Unchanged: Senior 18/20 (both UNSUPPORTED, dependency S1), Lender 5/20 (dependency L1),
  Move 20/20, Investor 20/20. Small diagnostic sample; no statistical claim.

### Insurance link sanitation — validated against real destinations

`review-1/insurance-link-validation.json` (6 live rows): the hub-supplied link never opens the
record; the sanitized link always opens the record with that NPN and the hub's re-validated
identity. Only `entity`, `state`, `loa` with the literal value `undefined` were dropped; `q` and
`selected` (identity) were kept. `safeHubUrl` returns null — and the card falls back to the hub's
own search continuation, never an unscoped record link — if a broken parameter is identity-selecting
(`selected`, `id`, `slug`, `crd`, `ccn`, `npn`, `naic`, `nmls`, `lei`, `usdot`, `mc`, `q`).

### Date labels keep their source meaning

Each card's date carries the hub's own meaning (`sourceDateLabel`), not a generic "updated":
Move "Last checked by MoveTrustHub"; Investor "Form ADV filing date" or "Source as-of date";
Insurance "Observed in source on"; Lender "Fetched from source on"; Senior "CMS source as-of date".

### Review-1 browser evidence (optimized `next build` + `next start`, real Chrome, controlled fixtures)

Fixtures are selected by `NAME_CANDIDATES_FIXTURE` and refused when `VERCEL_ENV=production`.

- **Empty-page continuation** (`paging-race`): Move page 1 has nothing admissible; the Move group
  still renders with "Check more of …"; clicking the REAL button loads page 2 and shows
  "Borealis Van Lines"; other hubs' cards are untouched.
- **Failed next page:** Lender keeps its 5 cards, state becomes TECHNICAL_FAILURE, the lead names
  it, an alert note and "Try … again" appear.
- **Delayed View-more race** (Move page 2 delayed 6 s): (1) start page 2, change the query — old
  request aborted, no contamination; (2) abort signal deliberately stripped — the stale response
  arrived at ~6.0 s carrying the record and was DISCARDED by the revision guard; (3) hub-filter
  change then query change — no contamination.
- **"Pure Moving Company":** genuine miss → COMPLETED_MISS + labeled alternate link, legacy path
  only after a click; with Move failing (`source-failure`) → PARTIAL_MISS, no "What are you
  moving?" gate, no guided widget, no cohort cards. 390 px and 320 px: no horizontal overflow.

### Dependency matrix (open work — NOT completed functionality)

| Id | Owner | Needed | Status | Effect today |
|---|---|---|---|---|
| C1 | Contractor repo + Ask (R1-019B) | verified name operation AND reviewed Ask adapter activation | open, not started | Contractor reported unsupported; all-network zero-result is a partial miss |
| L1 | Lender repo | candidate/prefix matching, legal-suffix tolerance | open | 5/20 holdout recall; exact names only |
| S1 | Senior repo | structured name parameter | open | names with care/place words reported unsupported (2/20) |
| I1 | Insurance repo | fix `undefined` params in `selectionUrl`; cursor beyond 10 | open | Ask sanitizes links; list disclosed as source-capped |
| P1 | Investor / Insurance / Lender | native search-box parity check | open, unverified | no parity claim made |

## Budgets

Explicit submit only. One call per in-scope enabled hub (max 5); at most one retry per hub, only for
transient read failures, only with ≥2.5 s of budget left. Per-hub 7 s, overall 9 s — chosen from
bounded smoke observations (0.1–3.5 s typical), not a p95.

## Rollback

Revert this branch's commits. No schema, data, publication or specialist-repo change exists to undo.
