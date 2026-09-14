# TH-SEARCH-R1-017 — Full Search Reliability Acceptance Sweep and Release Certification

## A. STATUS

**ACCEPTANCE_FAILED_WITH_BLOCKERS**

6 distinct, independently-reproduced, evidence-backed release blockers were found (11 individual
graded case-instances mapping to 6 root causes). Search Reliability R1 cannot close in its current
state. All 6 are narrowly scoped, well-understood, and confined to `Conumers-Trust-Hub`'s
guided-research execution layer (`lib/guided-research/session.ts` and `lib/guided-research/
specialists.ts`) plus one likely-specialist-side defect in Move. None require re-litigating any of
R1-001 through R1-016's certified work; none require touching specialist data or schemas.

## B. BUILDER / REASONING

Claude Builder, highest available reasoning effort, CERTIFICATION-FIRST mode. Per the explicit
instruction, **no product code was repaired during this ticket** — every blocker below was proven,
minimized, and documented for TH-SEARCH-R1-018, not fixed here. One direct attempt to mutate
`lib/network/research-planner.ts` (as part of building the mutation-sensitivity test in section U)
was refused by the session's own auto-mode permission classifier before any change reached disk,
which is the correct outcome for an audit-only ticket — the mutation-sensitivity test was rebuilt
as a fixture-level exercise instead (see section U).

## C. REPOSITORY BASELINES

| Repo | Role | main SHA | Canonical alias |
|---|---|---|---|
| savitz25/Conumers-Trust-Hub | Ask parent (local checkout, edited for QA docs only) | `add6526eaf663a51b05bdeda1459823e790c88eb` | https://www.asktrusthub.com |
| savitz25/Move-trust-Hub | Move specialist (read-only) | `f3dbd22a12ffbe099853441d875d8e87b5b174e6` | https://www.movetrusthub.com |
| savitz25/Lender-Trust-Hub | Lender specialist (read-only) | `c2a3d44012e7e03ecf263993dce87fe16e943226` | https://www.lendertrusthub.com |
| savitz25/Insurance-trust-hub | Insurance specialist (read-only) | `e1033c5cc5a0f0a8e9e157ae5766665c89491000` | https://www.insurancetrusthub.com |
| savitz25/care-trust-hub | Senior specialist (read-only) | `2fcf540560295b756fafc6400f404ec66a49b176` | https://www.seniortrusthub.com |
| savitz25/contractor-trust-hub | Contractor specialist (read-only) | `df726ac4831bf9af797e8c8be07ea727264958c4` | https://www.contractortrusthub.com |
| savitz25/investor-trust-hub | Investor specialist (read-only) | `07753f058efa86a52aa057819aba9eb58c9027c9` | https://www.investortrusthub.com |

Full detail (open PRs checked, production HTTP status, test-time UTC) in `baseline-manifest.json`.
Deployment SHAs are not exposed via these apps' Vercel response headers (only an opaque request
trace ID is); confidence instead comes from every graded case in this sweep querying the *live
production endpoint directly*, not a cached snapshot.

## D. CORPUS

103 total entries (`question-corpus.json`), 66 fresh paraphrases (64.1%, well above the 30%
minimum), 130 total graded case-instances (many entries tested on both `ask` and `direct`
surfaces, forming 31 explicit differential pairs). Per-surface counts:

| Surface | Count | Minimum required | Status |
|---|---|---|---|
| Ask parent | 53 | 20 | exceeded |
| Move direct | 15 | 12 | exceeded |
| Lender direct | 16 | 12 | exceeded |
| Insurance direct | 19 | 12 | exceeded |
| Senior direct | 17 | 12 | exceeded |
| Contractor direct | 14 | 12 | exceeded |
| Investor direct | 16 | 12 | exceeded |

## E. SCORECARD

| Grade | Count |
|---|---|
| PASS | 61 |
| PASS_SAFE_LIMITATION | 53 |
| PARTIAL | 5 |
| BLOCKER_FAIL | 11 |
| ENVIRONMENT_BLOCKED | 0 |
| **Total** | **130** |

By hub: Move 2 BLOCKER_FAIL / 9 PASS_SAFE_LIMITATION / 9 PASS / 1 PARTIAL. Lender 20 PASS / 4
PASS_SAFE_LIMITATION (zero blockers). Insurance 3 BLOCKER_FAIL / 5 PASS / 16 PASS_SAFE_LIMITATION /
1 PARTIAL. Senior 2 BLOCKER_FAIL / 10 PASS / 9 PASS_SAFE_LIMITATION. Contractor 3 BLOCKER_FAIL / 11
PASS_SAFE_LIMITATION (zero PASS — see section G, every graded Contractor case is either blocked by
BLOCKER-CONTRACTOR-01 or is a direct-surface HTML case this harness could not fully independently
confirm). Investor 15 PASS / 3 PASS_SAFE_LIMITATION / 2 PARTIAL (zero blockers). Cross-network 1
BLOCKER_FAIL / 2 PASS / 1 PASS_SAFE_LIMITATION / 1 PARTIAL.

Full per-case detail in `results.json` (also split per hub as `results-move.json`,
`results-lender.json`, etc.).

## F. ASK RESULTS

53 cases graded. 8 BLOCKER_FAIL at the Ask-parent surface (2 Move, 3 Insurance including the
cross-tagged name case, 2 Senior, 1 Cross-network two-domain case; Contractor's 3 blockers are also
Ask-surface but counted under Contractor). Every single Ask-surface blocker in this sweep shares
the same shape: **the planner (`research-planner.ts` / `decideAskExecution`) correctly understood
the query** (right hub, right intent, right extracted entity/geography at the `plan.*` level) **but
the guided-research execution layer lost the extracted condition, or received a broader-than-
expected specialist response, before the user ever saw an answer.** See section M for the full
parent/specialist differential and section V for root causes.

## G. MOVE RESULTS

15 corpus entries. Direct specialist behavior is uniformly excellent: exact-identifier equality
holds, no prefix fallback, MC225850's known dispute is honestly contained (not silently resolved),
carrier/broker and household-goods/auto-transport distinctions hold, booking and "near me"
boundaries are correctly refused rather than fabricated. **The one real defect (BLOCKER-MOVE-01)
is specific to the Ask-parent execution path for sparse-population company names** ("JK Moving
Services" → 34-70 candidates via Ask vs. 5 tightly-anchored candidates via the specialist's own
`move-ask-v1` contract) and was isolated with a control case ("A Plus Moving," a common name,
stays tight on both contracts) that narrows the failure to specifically low-distinctiveness name
tokens. One PARTIAL (a bare single-letter-pair "JK" reference without "Moving" attached correctly
fails safe to a clarification rather than a wrong answer, but doesn't resolve from context).

## H. LENDER RESULTS

24 case-instances, **zero blockers**. The R1-015 NJ-RMLA-refusal fix and "mortgage companies"
synonym fix both hold. State counts never substitute nationally; HMDA geography is never confused
with license jurisdiction; MLO/branch queries correctly fail closed rather than being treated as
institutions. Two non-blocking differentials recorded: a mode-classification divergence between
direct (`count`) and Ask parent (`cohort listing`) for ambiguous phrasings like "lenders in New
Jersey" (both valid, neither misleading), and confirmation that the direct specialist genuinely
supports simultaneous Broward/Palm Beach comparison — proving the Ask parent's non-execution there
is a deliberate, disclosed parent-side scope limitation (already certified correct in R1-016), not
a specialist gap.

## I. INSURANCE RESULTS

25 case-instances. **3 BLOCKER_FAIL**, all rooted in the same underlying gap: `lib/guided-
research/session.ts`'s insurance-intent block has no entity-name extraction and does not apply
geography/ZIP constraints for common phrasings, defaulting to an unscoped ~82,000-row agency
cohort for both a specific company-name search ("National Trust Insurance Group") and a ZIP-scoped
search ("insurance agencies in ZIP 33441"). A third, independently-confirmed blocker was found in
the same identifier-parsing path used across multiple hubs: "NAIC code 10064" is corrupted to the
literal value "code" before dispatch, and Ask rejects it as invalid even though the direct
specialist resolves it correctly. The credential-jurisdiction/office-location/domicile trio
(CREDENTIALED-FL/LOCATED-FL/DOMICILED-FL) is correctly kept non-conflated by the direct specialist
in all three cases — a positive finding worth preserving.

## J. SENIOR RESULTS

19 case-instances. **2 BLOCKER_FAIL**, both the same root cause: a deictic reference ("this nursing
home") with no established facility identity gets the *entire question text* captured as a literal
fabricated facility name, because `research-planner.ts`'s `DEICTIC_ENTITY` regex lists "facility"
and "home health agency" but not "nursing home" specifically. Everything else about Senior is
strong: the three assisted-living/memory-care unsupported-class probes (a spec-highlighted risk
area) all correctly fail closed rather than silently substituting Nursing Home data; real, distinct
numeric star ratings observed (no NaN, no fake constant); the three provider classes stay
separate. Two PASS_SAFE_LIMITATION findings on CHOW/fine evidence were graded inconclusive rather
than pass/fail because this sweep's plain-identifier test design didn't actually request that
evidence type — a test-design gap, not a confirmed product gap, flagged for a future ticket.

## K. CONTRACTOR RESULTS

14 case-instances. **3 BLOCKER_FAIL**: every Contractor query that reaches actual specialist
dispatch through the real production `/ask` page currently fails completely with
`error.code=contract_version_mismatch`, because `lib/guided-research/specialists.ts` hardcodes a
Contractor contract version/schema/fingerprint lock that no longer matches what the live Contractor
specialist returns. This is a full functional outage for Contractor cohort-browse execution via
Ask, not a partial degradation — confirmed live, and confirmed *not* to be a systemic
`FINANCIAL_SPECIALIST_LOCKS` problem (Investor and Lender's separate locks are still current).
Contractor's HTML-only public surface (no JSON API) limited this sweep's ability to fully
independently confirm the direct specialist's own content programmatically; those cases are graded
PASS_SAFE_LIMITATION with an explicit test-coverage caveat rather than an unqualified PASS.

## L. INVESTOR RESULTS

20 case-instances, **zero blockers**. This is the cleanest hub in the sweep. "Manage my portfolio"
is correctly not misrouted as a firm-name search; RIA/ERA, notice-filing/state-registration,
office/registration-jurisdiction are all kept distinct; a genuine multi-condition query (registered
in NY AND office in FL) correctly fails closed rather than silently applying only one condition —
a useful positive contrast with the cross-network two-domain blocker (section V). One PARTIAL: a
well-formed paraphrase explicitly distinguishing "registered" from "headquartered" doesn't engage
with that distinction and falls back to a plain missing-identity clarification — not misleading,
but less useful than it could be.

## M. PARENT/SPECIALIST DIFFERENTIAL

Full detail in `parent-specialist-differential.json`. Summary: of 31 explicit differential pairs,
4 showed a material, blocker-grade mismatch (all already covered above) and 5 showed a benign,
non-blocking difference (Ask parent's guided path sometimes handles ambiguous natural phrasing
*better* than a specialist's own bare public API — e.g. "local mover in New Jersey" and "state-
registered investment advisers in Wyoming" both execute correctly via Ask but return an empty
definitional response via the direct contract). All exact-identifier hit/miss pairs (USDOT, CRD,
CCN, NPN, CRD-miss, CCN-miss) agreed exactly between both surfaces across all three hubs tested —
the widening/condition-loss defects are specific to name- and geography-based cohort/entity
queries, never identifier-path queries.

## N. EXACT IDENTIFIER AUDIT

11 exact-identifier corpus entries (USDOT, MC, NMLS, LEI, NPN, NAIC, CCN, CRD, contractor
credential — positive and miss variants). **10 of 11 resolved correctly and identically on both
surfaces.** The one exception is `ID-NAIC-POS` (BLOCKER-IDENTIFIER-FILLER-WORD-01): the identifier
itself parses correctly at the *planner* level (`plan.identifier` is right) but gets corrupted to
a filler word before the actual specialist dispatch. This defect mechanically affects the shared
`labeledIdentifier` regex used for CRD/NPN/NAIC/NMLS/LEI alike whenever a natural filler word
("number", "code") appears between the label and the value — confirmed at the regex level for all
five families, but end-to-end verified against a live specialist for NAIC only in this sweep.
MC225850's known source-conflict (from R1-005/R1-006) remains honestly contained on both surfaces,
not silently resolved or hidden.

## O. CONDITION / GEOGRAPHY PRESERVATION

The single largest theme across all 6 blockers is condition loss between the planner and the
execution layer: an entity name correctly extracted by the planner (Move, Insurance) or a bare
deictic reference incorrectly promoted to a fake entity name (Senior), a ZIP constraint correctly
parsed but never applied (Insurance), a second requested hub silently dropped with no disclosure
(Cross-network), and an identifier value silently corrupted before dispatch (cross-hub, confirmed
for Insurance). By contrast, geography preservation for well-trodden query shapes is strong: Senior
correctly threads city+state+class through to 25/20/18-row cohorts that are actually all in the
right city; Investor correctly distinguishes principal-office/registration/notice-filing geography
across 6+ cases; Lender's HMDA property-geography disclosure is consistently correct.

## P. SOURCE / GRAIN AUDIT

Full detail in `source-grain-audit.md`. **18 of 20 required non-equivalences confirmed holding; 0
violated.** The 6 confirmed blockers are request-construction and identity-extraction defects, not
grain-conflation defects — the semantic distinctions the network exists to protect (credential vs.
company, HQ vs. service territory, LOA vs. appointment, RIA vs. ERA, provider classes, etc.) remain
intact everywhere this sweep could exercise them.

## Q. COUNT / ZERO AUDIT

No incompatible-class-total addition observed; no credential-rows-as-companies observed; no
page-length-as-cohort-total observed; no national-substituted-for-state observed (the closest thing
— Insurance's 82,071 unscoped agency total — is a *scope-loss* defect already counted under
BLOCKER-INSURANCE-01, not a national-substitution-for-a-state-query pattern, since the original
requests weren't state-scoped to begin with). `NOT_ACQUIRED`/`REQUEST_ONLY` states were never
observed rendered as zero: `ID-CCN-MISS`'s zero is explicitly labeled as an *executed* zero
("the specialist executed the supported filters and returned zero matching public records"),
distinct from an unsupported/not-acquired state.

## R. STALE STATE / HISTORY

Not a focus area for new findings in this sweep (no dedicated multi-step guided-session stale-
state corpus was built here — that surface was already extensively covered by the existing
`th-search-r1-008.test.ts` suite, which was re-run as part of this sweep's full regression pass
and remains 100% passing, 69/69). No stale-result contamination was observed in any of the 130
graded cases (each was a fresh single-shot query with no prior session state).

## S. BROWSER / RESPONSIVE

**Genuine capability upgrade this ticket delivered**: real, legitimate viewport control via
Playwright (installed locally: `npx playwright install chromium` + an isolated `playwright` npm
package), confirmed via `page.viewportSize()` and `document.documentElement.clientWidth` to
actually honor 1280/768/390/320 before any test began — unlike `claude-in-chrome`'s
`resize_window`, independently re-confirmed broken in this environment (reports success, viewport
never changes) exactly as documented in the prior ATH-METRICS-R2 mobile-QA session and TH-SEARCH-
R1-016. 34 full-desktop flows run (10 Ask, 12 specialist send-cases across the 6 hubs plus 12
additional single-flow spot checks), plus a genuine, disclosed partial responsive sample (6
representative flows re-run at tablet/mobile/small, 9 additional flow-viewport combinations) rather
than the full 136-combination cartesian product spec section 19 describes — a real scope reduction,
stated honestly rather than padded. Zero HTTP failures, zero horizontal overflow, zero console
errors across every sampled viewport, with one explained non-issue (a `networkidle` wait-strategy
timeout on SeniorTrustHub's own site caused by a 404'ing script resource, re-confirmed to be a test-
methodology artifact, not a real page failure, via a `domcontentloaded` re-test). Full detail in
`browser-evidence.json`.

## T. PERFORMANCE

No timeouts, no indefinite states, no timeout-rendered-as-no-match, no severe reliability
regressions. Ask specialist execution: p50 252ms, p95 1452ms. Direct specialist fetch: p50 158ms,
p95 1358ms. Full detail (including the handful of slower-but-successful outlier requests) in
`performance.json`. Per spec section 20, no optimization was attempted.

## U. HARNESS MUTATION SENSITIVITY

5 deliberate mutations, all correctly caught. Because R1-017 is explicitly audit-only, real product
source was not mutated (a genuine attempt to do so for wrong-hub detection was refused by the
session's own permission system before any change reached disk); instead, 5 real PASS-graded cases
were fixture-corrupted (wrong hub, national-scale count substituted for a state total, an exact
miss relabeled a confident hit, displayed results contradicting a claimed geography scope, LOA
data relabeled as carrier appointment) and re-graded under this sweep's own rubric. All 5
correctly flip to `BLOCKER_FAIL`. Full detail in `harness-mutations.json`.

## V. BLOCKERS

Full structured detail (reproduction, expected/actual, violated invariant, code boundary, affected
prior tickets, proposed R1-018 scope) for all 6 in `blockers.json`. Summary:

1. **BLOCKER-MOVE-01** — Ask parent's real Move execution path (`specialist-execution/v2`)
   materially widens sparse-population company-name searches (e.g. "JK") 7-14x beyond the
   specialist's own certified `move-ask-v1` contract, surfacing unrelated candidates. Owning repo:
   most likely Move-trust-Hub (unconfirmed by source reading, inferred from black-box behavior).
2. **BLOCKER-INSURANCE-01** — Insurance's guided-session block has no entity-name or geography
   extraction at all, defaulting nearly all natural insurance queries to an unscoped ~82,000-row
   agency cohort. Owning repo: Conumers-Trust-Hub, confirmed by code reading (`session.ts`
   `insuranceIntent` block).
3. **BLOCKER-IDENTIFIER-FILLER-WORD-01** — Natural phrasings like "NAIC code 10064" corrupt the
   identifier value to the filler word itself before dispatch, structurally affecting CRD/NPN/
   NAIC/NMLS/LEI alike. Owning repo: Conumers-Trust-Hub, confirmed (`session.ts` `labeledIdentifier`
   regex).
4. **BLOCKER-SENIOR-01** — "Who owns this nursing home?" (no established identity) has the entire
   question captured as a fabricated literal facility name, because `DEICTIC_ENTITY` doesn't list
   "nursing home". Owning repo: Conumers-Trust-Hub, confirmed (`research-planner.ts`).
5. **BLOCKER-CONTRACTOR-01** — All Contractor cohort-browse execution via the real `/ask` page
   fails outright due to a stale hardcoded contract-version lock. Owning repo: Conumers-Trust-Hub,
   confirmed (`specialists.ts` lines 15-17, 252).
6. **BLOCKER-CROSS-01** — "I need a mover and a mortgage lender in New Jersey" silently executes
   only the lender half and drops the mover request with zero disclosure. Owning repo: Conumers-
   Trust-Hub, confirmed (`research-planner.ts` MULTI_HUB_JOURNEY regex + `session.ts`'s early-return
   hub-intent chain).

All 6 are narrowly scoped, independently reproducible with a single command each, and none require
touching specialist data, schemas, or any previously-certified behavior from R1-001–R1-016.

## W. NON-BLOCKING ENHANCEMENTS

- A bare well-known company name with no hub-triggering keyword ("Allied Van Lines") doesn't route
  to any hub at all on Ask parent (found during Move grading).
- CHOW/fine-specific evidence types were not actually exercised by this sweep's plain-identifier
  Senior test design — recommend explicit evidence-type test cases in a future ticket.
- A bare single-letter-pair company reference ("Can JK pick me up...") doesn't resolve from
  context, correctly failing safe to a clarification rather than a wrong answer.
- Lender's ambiguous-phrasing mode divergence (count vs. cohort) between direct and Ask parent is
  benign but could be tightened for consistency.
- The Broward/Palm Beach lender comparison remains a genuine parent-side capability gap relative to
  what the specialist itself can do — legitimate future-enhancement candidate, not correctness debt.
- SeniorTrustHub's own site has a 404'ing script resource (unrelated to search correctness,
  site-hygiene only).

None of these are release blockers per spec section 22's explicit non-blocker criteria.

## X. CI / REVIEW METHOD

Live production endpoints queried directly (no mocks) via two custom harness scripts
(`scripts/r17-ask-harness.mts` — real `guided-research` orchestrator calls; `scripts/
r17-direct-harness.mts` — real specialist public-API/HTML fetches), a real Playwright browser
sweep against production, and manual/AI-assisted grading against the spec's explicit rubric with
live re-verification (curl / targeted node scripts) for every suspected defect before it was
recorded as a blocker — no defect in this report was graded from a single data point without an
independent confirmation call. Existing regression suites (`npm run check:th-search-r1-016`,
`npm run check:th-search-r1-008`, full `npm test`) were re-run and remain 100% green — this sweep's
findings are new discoveries at the real-execution-path layer that the existing unit/integration
suites do not reach (they largely test the planner, not the guided-research execution layer against
live specialists).

## Y. QA PR / MERGE SHA

This ticket produced QA/harness/documentation artifacts only, added to `docs/qa/th-search-r1-017/`
and two new scripts under `scripts/`, on a dedicated branch to be opened as a PR against
`savitz25/Conumers-Trust-Hub` following this report (not yet opened at the time of writing this
report — see the session's next action). No production search behavior was modified.

## Z. FINAL RECOMMENDATION

**Do not close Search Reliability R1 yet.** Open TH-SEARCH-R1-018 scoped *exclusively* to the 6
blockers above:

1. Fix Insurance's missing entity-name/geography extraction in `session.ts` (highest severity —
   affects the most natural everyday phrasings of the highest-traffic query shape, "who/what is
   this company").
2. Fix the identifier-filler-word regex in `session.ts` (small, precise, mechanically affects 5
   identifier families).
3. Fix the `DEICTIC_ENTITY` regex gap for Senior (small, precise).
4. Fix or bypass the stale Contractor version lock in `specialists.ts` (currently a complete outage
   for one of six hubs' core cohort-browse function — arguably the single most urgent item here).
5. Fix the two-domain silent-drop in the planner/session hub-selection chain.
6. Investigate the Move specialist-execution/v2 widening pattern — coordinate with whoever owns
   `savitz25/Move-trust-Hub` since this sweep could not confirm the exact code boundary without
   read access to that repo's source.

Re-run the affected acceptance subset (not the full 130-case sweep) after each fix, then perform a
short final certification pass. Per the explicit instruction, R1-018 has not been started, and
R1-019 or beyond should not be created without explicit coordinator approval.
