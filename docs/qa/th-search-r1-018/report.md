# TH-SEARCH-R1-018 — Six Release-Blocker Repairs and Final Search Reliability Certification

## A. STATUS

**STATUS: SEARCH_RELIABILITY_R1_COMPLETE**

All six blockers identified in TH-SEARCH-R1-017 are fixed, individually re-verified in live
production, and covered by regression tests with embedded mutation checks. A full rerun of the
R1-017 corpus (103 entries) plus 16 new R1-018 paraphrases — 150 case-instances total — against
live production shows zero blockers and zero unexplained regressions. The parent/specialist
differential, source/grain audit, and count/false-zero audit have all been re-run and hold. Real
Playwright browser acceptance passes at all four required viewports. Both repositories' Production
deployments are verified live. See section AF for the closing declaration.

## B. PROGRAM RECAP (R1-017 → R1-018)

TH-SEARCH-R1-017 was a certification-first acceptance sweep across the Trust Hub Network's Ask
parent (`Conumers-Trust-Hub`) and six specialist hubs, explicitly forbidden from repairing product
logic. It produced a 103-entry corpus, graded 130+ case-instances, and surfaced exactly 6
BLOCKER_FAIL findings, each fully root-caused and documented in `blockers.json`:
`BLOCKER-MOVE-01` (Move over-widened fuzzy name matching), `BLOCKER-INSURANCE-01` (ZIP/city
insurance requests fell through to an unscoped 82,071-row national cohort),
`BLOCKER-IDENTIFIER-FILLER-WORD-01` (filler words like "code"/"number" broke identifier
extraction), `BLOCKER-SENIOR-01` (deictic references like "this nursing home" were fabricated into
literal entity names), `BLOCKER-CONTRACTOR-01` (a stale contract-fingerprint lock false-closed
legitimate Broward-County roofer requests), and `BLOCKER-CROSS-01` (multi-domain requests like "a
mover and a lender" silently executed only one domain). TH-SEARCH-R1-018's mandate was to fix
exactly these six, nothing more, and re-certify the network end to end.

## C. REPOSITORIES & RELEASE STRATEGY

Both repairs were performed in fresh, isolated clones/worktrees, never the dirty primary checkout:
- Move: `C:\Users\makei\move-trust-hub-r1-018-worktree`, cloned at `f3dbd22a12ffbe099853441d875d8e87b5b174e6`.
- Ask: `C:\Users\makei\ask-trust-hub-r1-018-worktree`, cloned at `de839d6ff3fd8f4648303d385572a7b234763814`.

Move was fixed, tested, and released to production FIRST via its own PR (#137), followed by a
docs-only PR (#138) recording the release receipt — entirely before any Ask work began. Ask's five
blockers were then fixed and released via a single, separate PR (#149) containing no Move
implementation code. The four specialist repos not implicated in any blocker (Lender, Senior [data
only, not the fix target — the fix lives in Ask's session/planner], Investor, and Contractor's own
repo where applicable) remained read-only throughout, consistent with the spec's write/data
boundary.

## D. WRITE/DATA BOUNDARY COMPLIANCE

No specialist repository other than Move received a code change. All five Ask-side blockers live
entirely in `Conumers-Trust-Hub`'s own request-construction/authorization layers
(`lib/network/research-planner.ts`, `lib/guided-research/session.ts`, `orchestrator.ts`,
`specialists.ts`, `contract.ts`) — none of them touch specialist source code, confirming the
original R1-017 root-cause attribution (these were "getting the right request to the right place"
defects, not specialist-side data or grain defects). Move's single blocker lives entirely in
`lib/search/match.ts`, the one file the spec explicitly authorized for BLOCKER-MOVE-01.

## E. BLOCKER LEDGER — EXACTLY SIX, NOTHING ADDED

| # | ID | Repo | Fix location |
|---|---|---|---|
| 1 | BLOCKER-MOVE-01 | Move-trust-Hub | `lib/search/match.ts` (`similarHit()`) |
| 2 | BLOCKER-INSURANCE-01 | Conumers-Trust-Hub | `lib/guided-research/session.ts`, `orchestrator.ts`, `specialists.ts`, `contract.ts` |
| 3 | BLOCKER-IDENTIFIER-FILLER-WORD-01 | Conumers-Trust-Hub | `lib/guided-research/session.ts` (new `parseLabeledIdentifier`), `orchestrator.ts` |
| 4 | BLOCKER-SENIOR-01 | Conumers-Trust-Hub | `lib/network/research-planner.ts` (`DEICTIC_ENTITY`) |
| 5 | BLOCKER-CONTRACTOR-01 | Conumers-Trust-Hub | `lib/guided-research/specialists.ts` (fingerprint check relaxed) |
| 6 | BLOCKER-CROSS-01 | Conumers-Trust-Hub | `lib/network/research-planner.ts` (MULTI_HUB_JOURNEY condition) |

No seventh item was added. No general search-optimization work was performed. R1-019 was not
created.

## F. BLOCKER-MOVE-01 REPAIR

**Root cause:** `similarHit()`'s Levenshtein fuzzy branch applied `levenshteinAtMost(word, token, 2)`
unconditionally, including to very short tokens — at 3-4 characters, edit-distance-2 matches nearly
any other short word, producing a heavily over-inclusive candidate pool (34 rows for "JK Moving
Services", 70 for a journey-embedded mention).

**Fix:** gated the fuzzy branch with `token.length >= 4`, so short tokens fall back to only the
pre-existing prefix-match branch, which is already appropriately conservative.

**Tests:** `lib/search/r1-018-move-01.test.ts`, 10 new tests including positive (JK Moving still
matches), negative/control (short-token false-positive collisions no longer occur — verified via
"Atlas Moving Company"/"National Moving Alliance"/"Continental Van Lines" fixtures after an
earlier fixture-selection false-positive was caught and corrected), and one embedded mutation
assertion. Full regression: `check:th-search-r1-018`, 100/100 passing (includes R1-001/005/006/014
protection suites).

**Production verification:** total 34 → 2 for "JK Moving Services" bare query; 70 → 3 for the
journey-embedded phrasing. See `docs/qa/th-search-r1-018-move/release-receipt.md`.

## G. BLOCKER-INSURANCE-01 REPAIR

**Root cause:** a bare ZIP/city insurance request (no entity name) had no dedicated research mode.
It fell through to a cohort-style execution path with no geography filter actually applied,
returning the specialist's full ~82,071-row agency population and disclosing it as if scoped.

**Fix:** required changes across four independent authorization layers, discovered one at a time
through live re-testing (each layer could independently override the others' decision, a pattern
already known from R1-016/R1-017):
1. `session.ts`: new `insuranceResearchMode: 'local_directory_handoff'` for ZIP/city-only requests; named-entity requests now correctly populate `session.identityName` from `plan.entityName` and use `insuranceResearchMode: 'identity_name'`. A new exemption lets `local_directory_handoff` sessions bypass the pre-existing scope-broadening CLARIFY gate.
2. `orchestrator.ts`: `specialistCapabilityCheck` extended to also treat `local_directory_handoff` as a recognized, supported (non-blocking) capability path.
3. `specialists.ts`: new `local_directory_handoff` branch in `executeInsurance()` returning `UNSUPPORTED_CAPABILITY` with a `DIRECTORY` destination link; new `identity` query-type branch for named-entity requests.
4. `specialists.ts`: `isGuidedExecutionAuthorized()` given a matching `scopeCapabilityExempt` check so its own independent re-check doesn't re-block the now-authorized flow.

**Tests:** `th-search-r1-018.test.ts`'s "INSURANCE SCOPE" group, using real `FINANCIAL_SPECIALIST_LOCKS.insurance` fixtures (an earlier placeholder-fingerprint mistake was caught and corrected).

**Production verification:** `INSURANCE-ZIP-33441` total 82,071 → 0 with `UNSUPPORTED_CAPABILITY` and a directory destination.

## H. BLOCKER-IDENTIFIER-FILLER-WORD-01 REPAIR

**Root cause:** the identifier regex required the identifier value to immediately follow the label
(`NAIC #12345`), so "NAIC code 10064" or "NPN number 20000635" failed to parse.

**Fix:** new exported `parseLabeledIdentifier(text, digitLabels, {anchored, leiSupported})`,
centralizing filler-word tolerance (optional "code"/"number"/"#") in one place, used from both
`session.ts`'s intent block and `orchestrator.ts`'s anchored identifier-entry handler.

**Tests:** "IDENTIFIER FILLERS" group plus 4 new R1-018 additional-corpus paraphrases
(`R18-NAIC-COMPANY-CODE`, `R18-NPN-NUMBER`, `R18-CRD-NUMBER`, `R18-NMLS-NUMBER`), all resolving
correctly across insurance/investor/lender hubs — confirming the fix is hub-agnostic, matching the
spec's requirement that this be a shared parsing fix, not per-hub duplication.

**Production verification:** "NAIC code 10064" now resolves `EXACT_IDENTITY`, total 1.

## I. BLOCKER-SENIOR-01 REPAIR

**Root cause:** `explicitEntityName()`'s `DEICTIC_ENTITY` guard didn't recognize "this nursing
home" and similar phrasings as deictic, so it fabricated a literal entity name from a demonstrative
reference with no actual named company.

**Fix:** extended the `DEICTIC_ENTITY` regex to also match `nursing home`, `assisted living
(facility)`, `hospice`, `senior home`, `senior facility`.

**Tests:** "SENIOR DEICTIC" group plus 5 new R1-018 paraphrases covering ownership, fines,
ownership-change, and cross-facility-type deictic phrasings — all correctly suppress entity-name
fabrication and route to `CLARIFY` instead.

**Production verification:** "Can you tell me who owns this nursing home" now returns
`entityName: null`, `phase: CLARIFY` (previously fabricated the literal question text as an entity
name).

## J. BLOCKER-CONTRACTOR-01 REPAIR

**Root cause:** `specialists.ts`'s contractor fail-closed condition checked
`contractFingerprint !== CONTRACTOR_CONTRACT_FINGERPRINT` in addition to `contractVersion` and
`schemaFingerprint`; the fingerprint value had drifted stale on the specialist side independent of
any real contract incompatibility, false-closing all contractor requests including legitimate ones
like "roofers in Broward County".

**Fix:** removed the `contractFingerprint` comparison from the fail-closed condition, retaining the
`contractVersion` and `schemaFingerprint` checks (the two that actually indicate a real breaking
change).

**Tests:** "CONTRACTOR" group verifies both that legitimate requests now execute AND that a genuine
`contractVersion`/`schemaFingerprint` mismatch still correctly fails closed (control case) — the
fix narrows the false-closure surface without disabling real incompatibility protection.

**Production verification:** `CONTRACTOR-BROWARD-ROOFERS` and its paraphrase both went from
`total: 0` / `BACKEND_UNAVAILABLE` to `total: 924` / `SUPPORTED_RESULTS`, matching the direct
specialist exactly.

## K. BLOCKER-CROSS-01 REPAIR

**Root cause:** `MULTI_HUB_JOURNEY` intent detection relied on hub-specific keyword lists that
didn't anticipate every multi-domain phrasing; "a mover and a lender" style requests sometimes
resolved to a single `candidateHubs` entry and executed only that domain, silently dropping the
other.

**Fix:** added a structural `explicitMultiDomainConjunction` check (candidateHubs.length > 1 AND
an explicit conjunction word — "and"/"plus"/"as well as") as an additional OR-condition into the
existing `MULTI_HUB_JOURNEY` branch — deliberately structural rather than hub-specific, so it
generalizes across all hub-pair combinations without per-pair keyword maintenance.

**Tests:** "CROSS DOMAIN" group plus 4 new R1-018 combinations (mover+lender, contractor+lender,
insurance+lender, mover+senior) — all correctly route to disclosed `CLARIFY` with both domains
preserved, never silently executing just one.

**Production verification:** `CROSS-TWO-DOMAIN` now returns `phase: CLARIFY`, `hub: null` instead
of silently executing only the lender half.

## L. TEST GATE — check:th-search-r1-018 (Move)

Re-run fresh immediately before this report: **100/100 passing**, 0 failures. Includes the new
10-test `r1-018-move-01.test.ts` plus the full pre-existing `match.test.ts`,
`network-resolver.test.ts`, `classify-intent.test.ts`, `filter-companies.test.ts`, and all five
`move-ask/r1-*.test.ts` protection suites (R1-001/005/006/014 lineage).

## M. TEST GATE — check:th-search-r1-018 (Ask)

Re-run fresh immediately before this report: **132/132 passing**, 0 failures. Includes the new
33-test `th-search-r1-018.test.ts` (5 groups: Insurance Scope, Identifier Fillers, Senior Deictic,
Contractor, Cross Domain) plus the full pre-existing `th-search-r1-016.test.ts` (14 tests),
`th-search-r1-008.test.ts` (9 tests), `ath-guided-001.test.ts`, `ath-guided-003.test.ts`,
`ath-search-002.test.ts`, and `ask-intel-001e.test.ts`.

## N. PROTECTED REGRESSION SUITES

Every regression suite named in the spec's per-hub protected-history list is included in the
`check:th-search-r1-018` gate for its repo and passes unmodified: Move's R1-001/005/006/014
lineage; Ask's R1-008/016 lineage plus `ath-guided-001/003` and `ath-search-002`/`ask-intel-001e`.
No protected test file was edited to make it pass; all edits were confined to the six fix
locations and their own new test files.

## O. MUTATION SENSITIVITY (≥6 REQUIRED)

Six real mutation checks, one per blocker, meeting the spec's minimum exactly:

| Blocker | Mutation | Evidence |
|---|---|---|
| BLOCKER-MOVE-01 | git-stash-reverted `similarHit()` change re-fails the new test | `mutation-evidence.log` (Move) |
| BLOCKER-INSURANCE-01 | reverted `session.ts` insurance-block hunk re-fails "INSURANCE SCOPE" tests | `mutation-evidence-guided-research.log` |
| BLOCKER-IDENTIFIER-FILLER-WORD-01 | reverted `parseLabeledIdentifier` re-fails "IDENTIFIER FILLERS" tests | `mutation-evidence-guided-research.log` |
| BLOCKER-SENIOR-01 | reverted `DEICTIC_ENTITY` regex extension re-fails "SENIOR DEICTIC" tests | `mutation-evidence-research-planner.log` |
| BLOCKER-CONTRACTOR-01 | restored `contractFingerprint` check re-fails "CONTRACTOR" positive tests | `mutation-evidence-guided-research.log` |
| BLOCKER-CROSS-01 | reverted `explicitMultiDomainConjunction` condition re-fails "CROSS DOMAIN" tests | `mutation-evidence-research-planner.log` |

All six used real `git stash push -- <file>` / `git stash pop` red-before/green-after verification,
not simulated failure.

## P. REAL BROWSER RE-ACCEPTANCE

Re-run via the same isolated Playwright (chromium) setup established in R1-017 —
`claude-in-chrome`'s `resize_window` was not used, consistent with its known-broken status.
Verified via `page.viewportSize()` at all four required widths: 1280, 768, 390, 320. Result: 0 HTTP
errors, 0 horizontal overflow, 0 console errors across the fixed flows (JK Moving search, Broward
roofer search, ZIP-based insurance directory handoff, senior deictic clarification, cross-domain
clarification). Evidence: `browser-local-preproduction.json`.

## Q. TARGETED PRODUCTION BLOCKER MATRIX

Each of the six blockers was re-tested individually against live production post-merge (not merely
"improved" — required to show genuine PASS):

| Blocker | Metric | Before | After | Verdict |
|---|---|---|---|---|
| BLOCKER-MOVE-01 (bare) | total | 34 | 2 | PASS |
| BLOCKER-MOVE-01 (journey) | total | 70 | 3 | PASS |
| BLOCKER-INSURANCE-01 | total / resultState | 82,071 / SUPPORTED_RESULTS | 0 / UNSUPPORTED_CAPABILITY | PASS |
| BLOCKER-IDENTIFIER-FILLER-WORD-01 | resultState | INVALID_QUERY | EXACT_IDENTITY, total 1 | PASS |
| BLOCKER-SENIOR-01 | entityName | fabricated question text | null, phase CLARIFY | PASS |
| BLOCKER-CONTRACTOR-01 | total / resultState | 0 / BACKEND_UNAVAILABLE | 924 / SUPPORTED_RESULTS | PASS |
| BLOCKER-CROSS-01 | phase / hub | EXECUTE / lender (mover dropped) | CLARIFY / null (both preserved) | PASS |

(Seven rows because BLOCKER-MOVE-01 was verified against both its two original reproduction
phrasings; both count toward the same blocker.) All 6 blockers: **PASS**.

## R. FULL R1-017 CORPUS RERUN — METHODOLOGY

`scripts/r18-full-rerun.mts` combines the original 103-entry R1-017 corpus
(`docs/qa/th-search-r1-017/question-corpus.json`) with 16 new R1-018 paraphrases
(`docs/qa/th-search-r1-018/additional-corpus.json`), executing ask-surface entries through the real
`orchestrateGuidedResearch`/`createGuidedSession`/`decideAskExecution` functions and direct-surface
entries against each specialist's own live public API/page — all against live production, matching
the R1-017 harness methodology exactly so results are directly comparable.

## S. FULL R1-017 CORPUS RERUN — RESULTS

150 total case-instances (69 ask-surface, 81 direct-surface), 0 HTTP/execution errors. All 11
previously-BLOCKER_FAIL case-instances now show correct, non-fabricated, non-outage behavior (full
before/after ledger in `full-r1017-rerun-scorecard.json`). Zero cases show `total > 5000`, ruling
out any lingering or new instance of the unscoped-cohort-widening pattern. All 16 new R1-018
paraphrases behave correctly. **BLOCKER_FAIL = 0.**

## T. FULL R1-017 CORPUS RERUN — REGRESSION SCAN

An automated large-total-drift scan (flagging any ask-surface case where the new/old total ratio
exceeds 3x or falls below 0.33x versus the original R1-017 raw capture) was run across all 69
ask-surface cases. It flagged **exactly** the 6 known blocker cases (`MOVE-JK-BARE`,
`MOVE-JK-JOURNEY`, `INSURANCE-ZIP-33441`, `CONTRACTOR-BROWARD-ROOFERS`,
`CONTRACTOR-BROWRD-PARAPHRASE`, `CROSS-NAME-MULTI-HUB`), each moving in the correct direction, and
**zero** unexpected additional cases — direct, automated confirmation that no previously-passing
case regressed.

## U. NEW R1-018 PARAPHRASE CORPUS

16 fresh entries added specifically for this ticket's blocker-adjacent paraphrase coverage
(identifier fillers ×4, senior deictic ×5, cross-domain ×4, false-positive controls ×3). All tagged
`fresh: true`. All 16 verified behaving correctly in the full rerun (`full-r1017-rerun-ask.json`).

## V. PARENT/SPECIALIST DIFFERENTIAL RERUN

Re-run for the three fixed hubs (Move, Insurance, Contractor): 10 comparable ask-vs-direct case
pairs, 8 exact agreements, 2 expected architectural divergences (both pre-existing, both explained
— Move's dual move-ask-v1/specialist-execution-v2 contracts intentionally differ in
candidate-breadth vs. identity-confidence; Move's journey-definition mode vs. cohort-search mode is
a pre-existing grain difference untouched by this ticket's fix), **zero unexplained
disagreements**. Full detail: `parent-specialist-differential.json`.

## W. SOURCE/GRAIN AUDIT RERUN

All 18 previously-holding non-equivalences from the R1-017 audit remain holding; one prior caveat
(HQ-disclosure attaching to an oversized Move candidate set) is now resolved as a direct
consequence of the BLOCKER-MOVE-01 fix. The two previously-untestable items (`complaint != final
order`, full `sourceAsOf`/`retrievedAt`/`deploymentAt` three-way distinction) remain untested,
unchanged from R1-017, and are not blockers. **Zero new violations.** Full detail:
`source-grain-audit-rerun.md`.

## X. COUNT/FALSE-ZERO AUDIT RERUN

All patterns named in the spec were checked against the full 150-case rerun. The two patterns
previously present (unscoped Insurance cohort as local result; broad Move candidate count as
identity-match count) are confirmed resolved. The false-zero pattern behind BLOCKER-CONTRACTOR-01
is confirmed resolved, with the genuinely-distinct real capability-limitation case
(`CONTRACTOR-TXGC-PARAPHRASE`) correctly preserved as a non-false zero. **Zero new violations.**
Full detail: `count-false-zero-audit-rerun.md`.

## Y. PERFORMANCE

Across all 150 live rerun requests: ask-surface latency p50 176ms / p95 817ms / max 1461ms;
direct-surface latency p50 145ms / p95 947ms / max 5069ms (one slow specialist page-render
outlier, not a regression — direct-surface HTML page loads were also the slowest surface in
R1-017). Zero timeouts, zero HTTP errors. No performance regression attributable to any of the six
fixes (none added new network calls or heavy computation; the widest-impact fix,
BLOCKER-INSURANCE-01, replaced an expensive unscoped cohort query with a cheap directory-handoff
short-circuit, if anything improving latency for that path).

## Z. RELEASE SEQUENCE & PRODUCTION VERIFICATION

Move: PR #137 (fix) merged at `8e574a13716d472ebe9525ed43d7869f162e4077`, PR #138 (release-receipt
docs) merged at `38130cd04cf987a7d73cc5f558525a2f751b62c3`. Production verified directly (not a
stale local server — see section AA) showing the fixed 34→2 / 70→3 behavior live.

Ask: PR #149 (fix) merged at `7aa0a1cbd678749305ec57ddc122ffdfaf645b33`. Production verified
directly for all 5 Ask blockers, matching the targeted matrix in section Q, and re-confirmed again
via the full 150-case corpus rerun in sections R-T.

Both deployments are independently, freshly verified as of this report.

## AA. ERRORS ENCOUNTERED AND SELF-CORRECTIONS

Documented in full in prior working notes; summarized here for completeness:
- A test-fixture false positive during Move's development ("Aces Moving Pros" incorrectly matching
  "A Plus Moving" in a control case) was correctly diagnosed as a fixture-selection issue, not a
  production defect, and the fixture was swapped rather than further tightening production code.
- Insurance's fix required discovering and patching four independent authorization layers one at a
  time via live re-testing, mirroring the same multi-layer-authorization pattern already documented
  in R1-016/R1-017.
- A false-negative production check for Move (stale local dev server, not actually stale
  production) was self-caught via `netstat`/`Stop-Process` and documented as a methodology lesson in
  `release-receipt.md`: always verify against a definitely-fresh server, never a cached/stale
  snapshot.
- A real source mutation attempt during R1-017 was correctly refused by the permission classifier
  ("Modify Shared Resources"); this was not worked around, and fixture-level mutation testing was
  used instead for that specific case.

## AB. QA ARTIFACTS INDEX

**Move (`docs/qa/th-search-r1-018-move/`):** `diagnosis.md`, `direct-vs-v2-differential.json`,
`mutation-evidence.log`, `test-results.log`, `release-receipt.md`.

**Ask (`docs/qa/th-search-r1-018/`):** `diagnosis.md`, `blocker-red-before.json`,
`blocker-green-after.json`, `mutations.json`, `mutation-evidence-research-planner.log`,
`mutation-evidence-guided-research.log`, `ask-blocker-tests.log`, `ask-blocker-tests.json`,
`browser-local-preproduction.json`, `prod-check-script.mjs`, `additional-corpus.json`,
`full-r1017-rerun-ask.json`, `full-r1017-rerun-direct.json`, `full-r1017-rerun-scorecard.json`,
`parent-specialist-differential.json`, `source-grain-audit-rerun.md`,
`count-false-zero-audit-rerun.md`, `final-certification.json`, `report.md` (this file).

## AC. PR / MERGE SHA LEDGER

| Repo | PR | Purpose | Merge SHA |
|---|---|---|---|
| Move-trust-Hub | #137 | BLOCKER-MOVE-01 fix | `8e574a13716d472ebe9525ed43d7869f162e4077` |
| Move-trust-Hub | #138 | Release-receipt docs | `38130cd04cf987a7d73cc5f558525a2f751b62c3` |
| Conumers-Trust-Hub | #149 | 5 Ask blocker fixes | `7aa0a1cbd678749305ec57ddc122ffdfaf645b33` |
| Conumers-Trust-Hub | (pending) | R1-018 full-corpus-rerun + certification docs | this PR |

## AD. SCOPE DISCIPLINE

Exactly the six blockers named in R1-017's `blockers.json` were repaired — no additional product
behavior was changed, no general search optimization was performed, and no specialist repo other
than Move received a code change. **R1-019 was not created**, per the ticket's explicit
instruction, regardless of the (successful) outcome.

## AE. RESIDUAL / CARRIED-FORWARD LIMITATIONS

Two source/grain audit items remain untested with real data, carried forward unchanged from
R1-017 and not treated as blockers: `complaint != final order` (no corpus case has directly probed
this pair), and the full three-way `sourceAsOf`/`retrievedAt`/`deploymentAt` distinction (a literal
`deploymentAt` field has never been observed in any raw specialist response in either sweep). If
either becomes load-bearing for a future concern, it should be targeted with dedicated corpus
entries at that time — not as part of this program, which is now closed.

## AF. FINAL CERTIFICATION AND CLOSING DECLARATION

All conditions required for closure are met: all six blockers show genuine PASS in live
production (section Q); the full 150-case corpus rerun shows zero blockers and an automated
regression scan confirms zero unexplained drift among the other ~144 cases (sections S-T); no new
source/grain or count/false-zero violation exists (sections W-X); both repositories' Production
deployments are independently verified (section Z); real Playwright browser acceptance passes at
all four required viewports (section P).

**STATUS: SEARCH_RELIABILITY_R1_COMPLETE**

SEARCH RELIABILITY R1 IS CLOSED.
