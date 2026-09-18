# TH-SEARCH-R1-019A — geography-in-name correction (READY_FOR_ASTRA_REVIEW, not released)

Coordinator decision: option 2 (narrow general repair). PR #178 stays draft. Nothing merged or deployed.

## Identities

| | |
|---|---|
| Baseline (reviewed integrated candidate) | `11ae9e4b49f2ab40d1aedeb182ac5564391254f5`, tree `5de49bd98769585cea2c24358d5c7d7549a7098a` |
| Branch head before this pass | `f75822fe82411f6408ad47b97e774dd232e225ef` (docs only on top of the baseline) |
| `origin/main` | `d24621883800d7ccbb79d68c0716ce3ff88fa6d5` — unchanged, already merged in |
| **Final runtime candidate** | `b0b2c1295a87f4bd443bc2969f0cc9e6011789c3`, tree `71260090636fdf9729d81ee4f05495ccefd36869` |

Later commits add files under `docs/qa/` only. Every gate, build, browser and holdout result below is
for tree `7126009` unless it says otherwise.

## Runtime diff (one function; +16/−2 in `lib/network/name-candidates/decision.ts`)

`distinctiveTokens()` used to delete every planner-recognized place word from the supplied phrase.
Now recognized geography is context, not a disqualifier. It is discounted only when:

1. the phrase is nothing but the place (`Cincinnati`, `Cincinnati Ohio`), or
2. the planner itself resolved the text as a cohort (`intent === 'COHORT_BROWSE'`: `Denver movers`,
   `moving company Denver`, `moving from Cincinnati to Columbus`) — unless the text is written as an
   organization name: led by the place AND carrying an existing organization-form word or legal suffix
   (`Cincinnati Moving Company`, `Denver Insurance Agency`).

No city list, no new vocabulary, no regex per place, no identifier or URL in routing, no new service.
The full supplied name is sent; scope defaults to all hubs; the city never becomes a filter or an
unresolved condition; the place/category reading is the existing labeled `interpret=category` link.
The only other non-test change is `package.json` (the geo test file added to the gate).

## Red / green / invariant / mutation

- Red on the unpatched integrated runtime: `red-before.txt` — G1, G2, G4, G5 fail, G3 (contrasts) passes.
- Green: `th-search-r1-019a-geo.test.ts` 5/5.
  - G1 six required inputs (case / suffix variants) → name search, full name, scope all, alternate offered; explicit hub still scopes; API-shaped and page-shaped calls agree.
  - G2 METAMORPHIC: six organization phrases × three catalog states (known place / unknown token / that token after the catalog learns it, built from the planner's real plan) → same decision, name unchanged. Includes two phrases the planner reads as a cohort once the place is known.
  - G3 contrasts stay non-name: the eight required ones plus place-only, `Denver movers`, `movers Denver`, `Cleveland lenders`, `Denver roofers`, `Columbus nursing homes`, `moving company Denver`, `insurance agency Cincinnati`, `Cincinnati home health care`.
  - G4 page path: six dispatches, each with the complete name; expected record included; two similarly named records stay separate; no inferred location. Hub selection → one dispatch.
  - G5 zero / target failure / unsupported keep the name result (6 or 7 dispatches, never a cohort retrieval); only `interpretAs: 'category'` reaches the legacy path.
- Mutation `H_GEOGRAPHY_TOKEN_EXCLUSION` (old exclusion restored) → DETECTED (G1, G2, G4, G5 fail). All 8 mutations detected, sha1 of every mutated file identical after the in-memory restore, gate 44/0 after restore (`../mutation-report.json`). No live source is called by the mutation run.

## Gates on the final tree

`check:th-search-r1-019a` 44/44 + 136/136 R1-018 · `check:th-search-r1-016` 149/149 ·
`check:th-arch-p0-001` 17/17 · `check:ath-obs-001` 32/32 · `check:ath-metrics-001c` 19/19 ·
`check:ath-oh-001` 15/15 · `check:th-homepage-sync-001` 3/3 · `npm test` 476 pass / 0 fail / 0 skipped ·
`tsc --noEmit` clean · ESLint 0 errors, 7 inherited warnings (none in files this branch touches) ·
fresh optimized `next build` OK · 0 raw control bytes in the changed files.

## Browser — optimized build of tree `7126009`, real Chrome, 2026-09-18 ~20:32–20:40 UTC

- `Cincinnati Asset Management` → "1 record with a name like …": CINCINNATI ASSET MANAGEMENT INC, CRD 104946, matched on SEC/IARD legal name; the location shown is the source's own "Principal office — not client geography". No place selector, no guided widget. (Record verified first at the permitted Investor identity operation; nothing about it is in routing.)
- lowercase and UPPERCASE → same record. `…, INC.` → name search kept, honest PARTIAL_MISS: the Investor hub's own matcher returns NO_CONFIDENT_MATCH for the comma form (checked directly at the hub; hub-owned matching — see "New observation").
- `Columbus Asset Management`, `Denver Asset Management`, `Cincinnati Moving Company` → name kept, PARTIAL_MISS naming the 5 completed sources and Contractor as not searchable. `Denver Insurance Agency` → real Insurance/Investor candidates.
- Alternate link → `interpret=category` → the place path appears ONLY then; Back restores the name result. Editing the box to another name and submitting shows only the new results.
- Move outage fixture: `Cincinnati Asset Management`, `Cincinnati Moving Company`, `Pure Moving Company` → PARTIAL_MISS, name kept, "Could not be fully searched just now: Move Trust Hub", no gate, no cards.
- Contrasts render their existing paths: `investment advisers in Cincinnati Ohio` (Investor cohort, 426 firms — on the interim build, path unchanged since), `CRD 104946` (exact identity + official-source action — interim build), `Denver movers`, `moving company Denver`, `roofers in Broward County`, `Cincinnati`, `moving from Cincinnati to Columbus`.
- Allied fixture: 6 records; Moving filter → 2; All → 6 (chip targets followed by request on this build; clicked in the prior pass on the unchanged component).
- 390 px and 320 px (Allied and Cincinnati): no overflow, no control under 44 px, all focusable. Enter submits the form (real keypress). No console errors.
- Interim build `d03f07a` (first version of the fix, before the cohort refinement) was also exercised; results above are from the final build unless marked.
- NOT re-run on this tree (runtime paths untouched; evidence in `../final/README.md` is for tree `5de49bd`): paging continuation, failed page two, delayed race, Lender ambiguity/alias, word-boundary mock, Insurance link fallback.

## Live controls through the final build (`live-controls.json`; real hubs, not the public deployment)

Allied Van Lines, Cirta Moving LLC, Pure Moving Company, 1-800-Pack-Rat, Abbey Delray South (CCN 105411),
Tate Asset Management (CRD 160657), Rocket Mortgage (NMLS 3030), plus Cincinnati Asset Management
(CRD 104946): all found. Contractor reported unsupported each time.

## Frozen holdout (`holdout-run7-report.json`)

Unchanged sample, each request scoped to its own hub. Run 6 ran once on the interim fix; the runtime then
changed, so run 7 ran once on the final tree. Runs 6 and 7 are row-for-row identical. Runs 2–7 preserved.

Run 7 — end-to-end / when the target source completed:

| Hub | Displayed | Lowercase | Suffix-removed |
|---|---|---|---|
| Move | 20/20 · 20/20 | 20/20 · 20/20 | 8/9 · 8/9 |
| Investor | 20/20 · 20/20 | 20/20 · 20/20 | 14/14 · 14/14 |
| Insurance | 20/20 · 20/20 | 20/20 · 20/20 | 18/18 · 18/18 |
| Senior | 18/20 · 18/18 | 18/20 · 18/18 | 0/1 · 0/0 |
| Lender | 5/20 · 5/20 | 5/20 · 5/20 | 0/12 · 0/12 |

Target-source technical failures: 0. Inputs not treated as a name search: 0. Irrelevant candidates: 0.
Only change since run 5: `CINCINNATI ASSET MANAGEMENT` (suffix-removed) blocked → found at rank 1.
Since run 4: only the two CLEVERALPHA rows (irrelevant 1 → 0, intended record still found).
Suffix-removed failures are all previously recorded, unchanged since run 4, and NOT cleared:
Move `C&L Movers` (beyond the hub's first page → PARTIAL_TRUNCATED with continuation), Senior
`FFIII Houston SNF Tenant` (UNSUPPORTED, dependency S1), Lender 0/12 (exact-name-only, dependency L1).

## Disclosed consequences and limits of the rule

- `Denver roofing` / `roofing Denver` (planner intent: entity lookup with missing identity, not a cohort) are now name-first with the labeled alternative — the same treatment `Boise roofing` already had for an unpublished place.
- Remaining catalog-dependent cases, by design: `<known place> + plural provider class` (`Denver Movers` without a suffix) stays the planner's cohort, and planner care-task protection (`Cincinnati Home Health Care`) stays protected; with an unknown leading token those are names. `Cleveland Movers LLC` is a name via its suffix.
- The alternate link's wording says "as a category" although for these inputs the other reading is a place; label left unchanged to keep the diff narrow.

## New observation (not a decision defect, not fixed)

Investor's identity operation does not match `CINCINNATI ASSET MANAGEMENT, INC` (comma before the suffix) although it matches the same name without the comma. Hub-owned matching; Ask sends the supplied name unaltered and reports the miss honestly. Belongs with the Investor native-parity dependency (P1).

## Open dependencies (unchanged — not completed functionality)

C1 Contractor operation + reviewed Ask adapter activation (R1-019B) · L1 Lender candidate breadth ·
S1 Senior structured name parameter · I1 Insurance link/cursor repair · P1 native parity for
Investor/Insurance/Lender. Move's canonical docket correction is separately pending.
