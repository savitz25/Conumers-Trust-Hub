# TH-SEARCH-R1-019A — final integration check (NOT a release receipt)

**Outcome: BLOCKED before release.** Integration with current `main` changes reviewed runtime
behavior for one class of input. Nothing was merged, deployed or marked ready.

## Candidate

| | |
|---|---|
| Reviewed correction head | `eb5b916d3a1fe5b7017515a5cc1cc8a35337995d` |
| `origin/main` merged in | `d24621883800d7ccbb79d68c0716ce3ff88fa6d5` |
| Integrated candidate (merge commit) | `11ae9e4b49f2ab40d1aedeb182ac5564391254f5` |
| Integrated tree (what every result below covers) | `5de49bd98769585cea2c24358d5c7d7549a7098a` |
| Merge type | normal `git merge --no-ff`, conflict-free, no rebase, no force push |
| Reviewed search source changed by the merge | none — of the files this branch touches only `package.json` differs (both sides' scripts kept) |

Later commits on this branch add evidence files under `docs/qa/` only; the runtime tree is unchanged.

## Gates on the integrated tree (2026-09-18)

`check:th-search-r1-019a` 39/39 + 136/136 (R1-018) · `check:th-search-r1-016` 149/149 ·
`check:th-arch-p0-001` 17/17 · `check:ath-obs-001` 32/32 · `check:ath-metrics-001c` 19/19 ·
newly merged `check:ath-oh-001` 15/15 and `check:th-homepage-sync-001` 3/3 · `npm test` 476 pass,
0 fail, 0 skipped · `tsc --noEmit` clean · ESLint 0 errors, 7 warnings, all inherited (6 files, none
touched by this branch; 3 arrived with `main`) · fresh optimized `next build` OK · 0 raw control
bytes in the 38 changed files · corrections present (`resolveAskNameState`,
`AMBIGUOUS_NO_CANDIDATES`, empty-page group rule, `coverage.ts`, word-boundary containment).
Mutation tooling was not repeated; the 7/7 receipt in `../mutation-report.json` stands.

**The gates did not catch the blocker below; the frozen holdout did.**

## BLOCKER — integration changed name classification for Ohio-city names

`main` published Ohio, so the planner now recognizes Ohio cities as geography. `decision.ts`
(unchanged) excludes planner geography from a name's distinctive tokens, so a name made of an Ohio
city plus category words and NO legal suffix is no longer a name search.

| Input | reviewed head `eb5b916` | integrated `11ae9e4` |
|---|---|---|
| `CINCINNATI ASSET MANAGEMENT` | NAME_CANDIDATES (PLANNER_ENTITY_NAME) | NOT_NAME_SEARCH (`CATEGORY_OR_GEOGRAPHY_WORDS_ONLY`) |
| `Columbus Asset Management` | NAME_CANDIDATES | NOT_NAME_SEARCH |
| `CINCINNATI ASSET MANAGEMENT, INC.` | NAME_CANDIDATES | NAME_CANDIDATES (basis changed to NAME_WITH_CATEGORY_WORD) |
| `Cleveland Movers LLC` | NAME_CANDIDATES | NAME_CANDIDATES (basis changed) |
| `Denver Asset Management` | NOT_NAME_SEARCH | NOT_NAME_SEARCH (same rule already applied to cities of earlier published states) |

Browser, integrated build, `/ask?q=Cincinnati+Asset+Management`: no name results; the page shows
"This question touches more than one specialist area…", "You asked: Cincinnati, Ohio", and offers
Contractor / Lender / Insurance / Move — Investor, which holds the record (CRD 104946), is not
offered. That is the hub-choice gate this milestone exists to remove, for a real SEC-registered firm.

The rule itself is pre-existing, reviewed behavior (see Denver); the merge widened its reach. Whether
"city + category words" should lead with name candidates, a cohort, or both is a product decision,
so no runtime patch was written or self-approved. Options for the reviewer:
1. Accept as a declared limitation (consistent with Denver today) and release.
2. Narrow repair in `decision.ts`: when the only non-generic tokens are planner geography and the
   text is organization-shaped, run the name search and offer the geography/category reading as the
   existing labeled alternate action. Needs review; touches reviewed logic.

## Frozen holdout — run 5 (single run, not repeated)

Unchanged sample (`holdout-frozen.json`), each request scoped to the record's own hub. Full rows:
`../holdout-results.run5.json`; comparison: `holdout-run5-report.json`. Runs 2–4 preserved.

| Hub | End-to-end (displayed) | When target source completed | Target-hub failures (all variants) | Unsupported | Irrelevant |
|---|---|---|---|---|---|
| Move | 20/20 | 20/20 | 0 | 0 | 0 |
| Investor | 20/20 | 20/20 | 0 | 0 | 0 |
| Insurance | 20/20 | 20/20 | 0 | 0 | 0 |
| Senior | 18/20 | 18/18 | 0 | 2 (dependency S1) | 0 |
| Lender | 5/20 | 5/20 | 0 | 0 | 0 (dependency L1) |

Changed classifications run 4 → run 5 (3 rows, all Investor):
- `ALPHA ASSET MANAGEMENT` and `alpha asset management`: irrelevant 1 → 0. CLEVERALPHA (CRD 301620)
  is no longer admitted; the intended record is still found (1 candidate each).
- `CINCINNATI ASSET MANAGEMENT` (presentation variant): found → not a name search. **This is the
  blocker above**, caused by the merge, not by the word-boundary change.

## Browser pass — optimized build of tree `5de49bd`, real Chrome, 2026-09-18 ~19:30–19:50 UTC

Fixtures are nonproduction (`NAME_CANDIDATES_FIXTURE`, refused when `VERCEL_ENV=production`). The
Lender/Investor/Insurance cases used the build's REAL adapters with their existing server-side
`*_SPECIALIST_EXECUTION_URL` settings pointed at a local controlled upstream; no source was changed.

- **Allied fixture** via the real form: 6 records (Allied Moving, Allied Van Lines, Allied Lending,
  Allied Lending Group, Allied Electrical, Allied Senior Care) in 4 hub groups, no distractors, no hub
  selector; Moving chip → the 2 Move records with the query kept; All TrustHubs → all 6.
- **Pure Moving Company**: genuine miss → COMPLETED_MISS, name kept, labeled alternate "has not been
  run", no gate; the legacy "What are you moving?" path appeared only after clicking it. Move failing →
  PARTIAL_MISS "in the 5 sources that completed", Move named as not searched, no gate, no cards. Target
  unsupported (real Contractor scope) → NOT_COMPLETED, "not a no-match result", Verify continuation.
- **Empty first page**: Move group rendered with 0 cards and "Check more of Move Trust Hub"; the real
  button loaded page two → "Borealis Van Lines"; Lender and Senior cards untouched (10 → 11 records).
- **Failed page two**: Lender kept 5 cards, state TECHNICAL_FAILURE, alert note, lead says "This is
  not every source… Lender Trust Hub"; "Try Lender Trust Hub again" re-requested page 2 (fixture
  keeps failing by design).
- **Delayed race** (Move page two held 6 s): superseding request → abort signalled; with the abort
  signal deliberately stripped the stale response arrived at 6.06 s carrying "Borealis Van Lines" and
  was discarded (revision 2 vs 3); Move kept its control. Hub-filter change and query change during
  the delay: new results only, no contamination.
- **Lender ambiguity, no rows**: NOT_COMPLETED, "more than one record shares this name… not a no
  match", link to LenderTrustHub; never claims zero. **With rows**: 3 separate cards — two distinct
  "Union Trust" (NMLS 9000001 / 9000002) not merged, plus "Heritage Home Lending" as a documented
  alias with no invented matched text.
- **ALPHA ASSET MANAGEMENT**: upstream returned CLEVERALPHA and the intended firm; only the intended
  firm is shown.
- **Insurance broken required identity parameter** (`selected=undefined`): that card gets NO link
  ("This source lists the record but does not publish a page for it") — no identity, class or region
  invented, no unscoped redirect; the sibling card keeps `q` + `selected` and drops only the
  `undefined` params. Limit: the no-link sentence does not say the hub's link was broken.
- 390 px (3 flows) and 320 px: no overflow, single column, no control under 44 px, all controls
  keyboard-focusable. No console errors.

## Live-source controls through the candidate (`live-controls.json`; real hubs, not the public deployment)

Allied → Allied Van Lines (USDOT 76235) + Insurance (source-capped) + 6 Investor firms; Cirta Moving
LLC (USDOT 4074980); Pure Moving Company (`move:profile:pure-moving-company`); 1-800-Pack-Rat (USDOT
1534531); Abbey Delray South (CCN 105411); Tate Asset Management (CRD 160657); Rocket Mortgage (NMLS
3030). All 7 found with the expected identity; Contractor reported unsupported each time.

## Open dependencies (unchanged — not completed functionality)

C1 Contractor operation + reviewed Ask adapter activation (R1-019B) · L1 Lender candidate breadth ·
S1 Senior structured name parameter · I1 Insurance link/cursor repair · P1 native parity for
Investor/Insurance/Lender. Move's canonical docket correction is separately pending.
