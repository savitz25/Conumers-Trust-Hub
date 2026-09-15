# TH-SEARCH-R1-018 — Ask-owned five-blocker diagnosis and repair

Full detail per blocker (exact reproduction, root cause, fix, verification) is in the code
comments at each fix site and in `docs/qa/th-search-r1-017/blockers.json`'s original findings.
This document records what changed and why, concisely, per blocker.

## BLOCKER-INSURANCE-01

**Files**: `lib/guided-research/session.ts`, `lib/guided-research/specialists.ts`,
`lib/guided-research/orchestrator.ts`, `lib/guided-research/contract.ts`.

Insurance's guided-session block had no entity-name extraction and no ZIP/city geography
handling, defaulting nearly all natural insurance queries to an unscoped ~82,000-row agency
cohort. Fixed by:
1. Using `plan.entityName` (the research planner's already-correct extraction) as the identity
   candidate when present, sending a real `queryType:'identity'` request (confirmed live to be
   supported and correctly scoped by the specialist) instead of `queryType:'cohort'`.
2. Detecting a ZIP code or bare city in the query and, since specialist-execution/v2 was
   confirmed live to silently ignore ZIP/city geography fields and return the entire
   unscoped population, handing off to InsuranceTrustHub's own certified ZIP-directory `/ask`
   flow (`insurance-ask-v1`) instead of executing that unscoped cohort.
3. This required threading the new `local_directory_handoff` mode through THREE separate,
   independent authorization layers that each independently gate execution based on geography
   scope (`createGuidedSession`'s broadening-consent check, `orchestrateGuidedResearch`'s
   execution-time re-check, and `isGuidedExecutionAuthorized`) -- each needed its own matching
   exemption, mirroring the existing pattern already used for Contractor's `SERVICE_TERRITORY`
   case. This redundancy across four decision points is a pre-existing architectural pattern in
   this codebase (not introduced by this fix) and is noted as an observation, not fixed further,
   per this ticket's explicit scope discipline.

**Known, intentionally out-of-scope observation**: a specific named agency combined with a city
in the same phrasing (e.g. "State Farm agency in Boca Raton") does not yet resolve to an entity
name, because `research-planner.ts`'s entity-name heuristics don't extract a name when a `city`-
kind geography is also present (only `route`-kind geography has this handling, added in
R1-016). This was not part of R1-017's confirmed BLOCKER-INSURANCE-01 evidence (it was untested
on the ask surface there) and extending the heuristic carries real regression risk (R1-016 had to
narrow an over-broad version of exactly this kind of heuristic after it caught malformed-identifier
and prompt-injection strings). Left as a documented, non-blocking gap rather than risking a rushed
fix this late in the program.

## BLOCKER-IDENTIFIER-FILLER-WORD-01

**File**: `lib/guided-research/session.ts` (new exported `parseLabeledIdentifier` helper),
`lib/guided-research/orchestrator.ts` (now uses the same helper for its anchored direct-entry
path). Centralized as required -- one shared parser, not five per-hub patches.

## BLOCKER-SENIOR-01

**File**: `lib/network/research-planner.ts`. Added `nursing home`, `assisted living (facility)?`,
`hospice`, `senior home`, `senior facility` to the `DEICTIC_ENTITY` regex's noun list, alongside
the pre-existing `facility` and `home health agency`.

## BLOCKER-CONTRACTOR-01

**File**: `lib/guided-research/specialists.ts`. Confirmed live (see
`direct-vs-v2-differential` equivalent probes below) that ContractorTrustHub currently returns
the SAME `contractVersion` ('2.1.0') and the SAME `schemaFingerprint` as the hardcoded lock, but a
DIFFERENT `contractFingerprint` -- a compatible build-specific revision, not an incompatible
schema change. The fail-closed check now requires `contractVersion` and `schemaFingerprint` to
match exactly (the guarantees Ask's row-mapping code actually depends on) but no longer requires
`contractFingerprint` to match. `contract` (family name) and `resultState` (enum) validation,
already present, are unchanged. This is the single most severe blocker of the five: it was a
complete functional outage for all Contractor cohort/identifier dispatch through the real
production `/ask` page, not a partial degradation.

## BLOCKER-CROSS-01

**File**: `lib/network/research-planner.ts`. Added a structural trigger for `MULTI_HUB_JOURNEY`:
`candidateHubs.length > 1` combined with an explicit conjunction word ("and"/"plus"/"as well
as"), independent of the pre-existing verb-shaped phrasings (buying/moving/renting/etc.), which
never matched noun-only requests like "a mover and a mortgage lender". Per the spec's explicit
instruction, this does not special-case the word "mover" -- it generalizes to any 2+-hub
combination the planner's own `inferHubs()` already detects (contractor+lender, insurance+lender,
move+senior, etc.), while leaving single-hub company names and phrasings (verified against
"Rocket Mortgage", "Senior Moving Services LLC", "State Farm insurance company",
"lenders in New Jersey") completely unaffected, since those never produce `candidateHubs.length >
1` in the first place.

## Verification summary

- New `lib/guided-research/th-search-r1-018.test.ts`: 33 tests, all passing, covering all 5
  blockers' required positive/negative/control cases plus 5 embedded mutation checks.
- `npm run check:th-search-r1-018` (new gate, chains the above with R1-016/R1-008/guided-research/
  ask-intel regression suites): 132/132.
- Full `npm test`: exit 0, 0 failures.
- `npm run typecheck`: clean.
- `npm run lint`: 0 errors (4 pre-existing, unrelated warnings).
- `npm run build`: succeeds.
- 60 real Playwright browser flows (15 flows x 1280/768/390/320px) against a local production
  build: 0 HTTP failures, 0 horizontal overflow; 7 key flows separately re-verified with a full
  network-idle wait and visually confirmed correct, real, settled content.
- 2 real source-file mutations (git stash push/pop) + 4 fixture-level historical-behavior
  comparisons, all correctly caught. Full detail in `mutations.json`.

None of the six original blockers required touching Lender, Investor, Senior, Insurance, or
Contractor specialist source (all changes are in `Conumers-Trust-Hub`'s guided-research execution
layer and shared planner, exactly as R1-017 diagnosed).
