# TH-SEARCH-R1-016 — Exact-Identifier Completion, Specialist Task Continuity, and Parent/Specialist Agreement

Repository: `savitz25/Conumers-Trust-Hub` (Ask parent only). No specialist repository, schema, or
data was touched.

## Confirmed, fixed defects

### Bug #1 — Lender NMLS/LEI identifier lookup was a stale handoff, not a live lookup

`lib/network/identifiers.ts` still marked `nmls`/`lei` as `live: false`, routing labeled NMLS/LEI
queries to a `handoff` destination (`nmlsconsumeraccess.org`) instead of executing the live
`lender-ask-v1` identifier resolution that TH-SEARCH-R1-002 actually shipped. `capability-registry.ts`
carried the same stale note.

- Fix: `identifiers.ts` (`nmls`, `lei` → `live: true`, corrected `destinationHint`/`note`),
  `capability-registry.ts` (`lender.identifierLookup: 'partial' → 'live'`, corrected note).
- Verified live: `NMLS 3030` returns real "Rocket Mortgage" data via a genuine fetch
  (`capabilityStatus: 'execute'`, contract `lender-ask-v1`).

### Bug #2 — A genuine exact-identifier miss rendered as a false EXACT_IDENTITY hit

Across Lender, Insurance, Senior, and Investor (Move was already correct via its dedicated
`fetchMoveNetworkIdentity` resolution path), a real fetch that returned zero matching rows was
still labeled `resultClass: 'EXACT_IDENTITY'` because each hub's `apply*Payload` function never
recomputes `resultClass` after the fetch returns.

- Fix: a single post-loop correction in `assembleNetworkAnswerWithSpecialist`
  (`lib/network/ask-plan.ts`) that downgrades `EXACT_IDENTITY` → `NO_CONFIDENT_MATCH` only when
  the identifier payload genuinely arrived (real fetch succeeded) and returned zero rows —
  distinguishing a genuine miss from a fetch failure/timeout, which must not become a false
  "no match" claim.
- Verified live across all four hubs' hit and miss cases with no regressions.

### Bug #3 — Move company-name and journey queries were blanket-refused with zero specialist calls

`research-planner.ts`'s `explicitEntityName()` had no heuristic for a bare or sentence-embedded
multi-word proper-noun company name (e.g. "JK Moving Services"), so these queries fell through to
`ENTITY_LOOKUP_MISSING_IDENTITY` even though `ask-parse.ts`'s independent router correctly picked
`move` as the hub. Separately, `research-scope.ts` unconditionally blocked any `route`-shaped
geography (`ORIGIN_DESTINATION` meaning), even for a query that is really an entity identity
lookup and does not depend on route/service-territory capability at all.

- Fix 1 (`research-planner.ts`): `explicitEntityName()` now recognizes (a) a bare multi-word
  title-case company name as the whole query, and (b) a company name embedded alongside
  origin/destination route language — both excluding any run led by a known identifier-family
  label token (NAIC/CBC/CGC/CCC/CRD/NPN/NMLS/LEI/USDOT/DOT/MC/CCN), so a malformed identifier
  probe ("NAIC ABCD") or an adversarial "make up a license number for X" prompt is never
  reinterpreted as a real name.
- Fix 2 (`research-scope.ts`): a `route`-shaped geography no longer blocks execution when the
  plan's `executionMode` is `IDENTITY` — the specialist call executes the entity lookup, and the
  route/service-territory limitation is surfaced as a disclosure instead of silencing the whole
  query.
- A pure cohort/browse route query with **no** named company (e.g. "moving from Miami Florida to
  New York City") is intentionally still blocked with a disclosed `CAPABILITY_UNSUPPORTED` reason
  — Move's data model is recorded-headquarters, not service-territory, so a browse-by-route
  request genuinely cannot be answered from this source. This is a disclosed, expected safe
  limitation, not a defect.
- Fix 3 (`lib/guided-research/session.ts`) — found during live browser verification, not by static
  reading: the production `/ask` page does not render through `assembleNetworkAnswerWithSpecialist`
  at all; it renders through `components/guided-research.tsx` → `lib/guided-research/`, which
  carries its **own, third, independent** identity-name classifier
  (`parsed.queryClassification.type === 'IDENTITY_NAME' ? q : undefined`) instead of reading
  `research-planner.ts`'s `plan.entityName`, and unconditionally wiped any identity name whenever
  `/from .+ to/` route language was present (`session.identityName = undefined`). This reproduced
  the exact same defect class as Bug #3 in a separate implementation, and was invisible to the
  `ask-plan.ts`-level fix and its tests. `session.ts` now prefers `plan.entityName` when the
  planner has confirmed one, and only falls back to the legacy whole-question heuristic when it
  hasn't; the route-language wipe is skipped whenever `plan.entityName` is set. This is the change
  that actually fixes the live `/ask` page's rendered output for these queries — the `ask-plan.ts`
  fix alone was necessary but not sufficient.

## Investigated and ruled out (not defects)

Several items flagged in preliminary, unverified baseline exploration turned out — once checked
against the existing golden regression corpus (`ask-intel-v3-corpus.ts`) and R1-008 tests — to be
deliberate, already-tested, correct behavior. Recorded here so they are not re-litigated as bugs
in a future ticket:

- **"compare mortgage originations in Broward and Palm Beach"** — a first attempt to authorize
  `COMPARE` intent execution was implemented, then reverted after discovering
  `ask-intel-v3-corpus.ts:193` explicitly asserts `forbiddenBehaviors: ['SPECIALIST_EXECUTION']`
  for this exact query shape. The parent's geography scope is single-valued
  (`requestedGeography`/`executionGeography`), so it cannot correctly represent a two-county
  comparison; authorizing execution risks the UI presenting a "comparison" that is really only
  scoped to one county. Blocking is the correct, deliberate design.
- **Austin/Texas cohort queries across Insurance/Investor/Contractor** ("financial advisers in
  Austin Texas", "insurance agency in Austin Texas", etc.) — these hubs' geography capability is
  state-level only; Florida works because several hubs carry explicit published county-level data
  (Broward/Palm Beach) while Texas does not. City→state broadening requires user consent
  (`BROADENING_REQUIRES_CONSENT`), matching `ask-intel-v3-corpus.ts:70,93,169` exactly. This is a
  deliberate consent-gated privacy/scope discipline, not a routing asymmetry bug.
- **Multi-hub journey ("I'm buying a home in Broward County...")** — `MULTI_HUB_JOURNEY` intent is
  designed to hand off to an ordered research menu (`resultClass: 'HANDOFF'`), never to directly
  fan out to all specialists. `ask-intel-v3-corpus.ts:182-183` explicitly forbids
  `SPECIALIST_EXECUTION` for this shape. Working as designed.
- **"how do I verify a contractor license in Florida?"** — produces proper non-blank guidance
  (`contractor.verify`, `contractor.ask`, `contractor.home` destinations) via
  `buildAskResearchRoute`, matching the golden case at `ask-intel-v3-corpus.ts:136`. The earlier
  "blank refusal" note was based on reading only the live-specialist-execution response shape
  (`assembleNetworkAnswerWithSpecialist`), which is not the rendering path used for `HOW_TO`
  intent.

## Test coverage

New file: `lib/network/th-search-r1-016.test.ts` (13 tests) — covers Bug #1 (live identifier
registration and routing), Bug #2 (miss-downgrade and hit-preservation via mocked fetch, following
the existing `th-search-r1-008.test.ts` fetch-mock pattern), Bug #3 at both the `research-planner`/
`research-scope` level and the `guided-research/session.ts` level (Fix 3 above; all three named
queries plus the still-correctly-blocked pure-route case, on both layers), and explicit regression
guards for the malformed-identifier and prompt-injection cases that an earlier, broader version of
the Bug #3 heuristic incorrectly caught.

New script: `package.json` → `check:th-search-r1-016`, chaining the new file with
`th-search-r1-008.test.ts`, `prompt-2.test.ts`, `lender-execute.test.ts`, `move-execute.test.ts`,
`insurance-execute.test.ts`, `ath-search-002.test.ts`, `ath-search-001.test.ts`, and the guided-
research R1-008 suites. **145/145 pass.** Full output: `green-suite-output.txt` in this directory.

Two pre-existing tests were updated because they encoded the stale, pre-fix expectation that Bug
#1 corrects (NMLS `live: false`, handoff-only routing) — `prompt-2.test.ts` and
`lender-execute.test.ts`. This is a corrected assertion of intentionally-changed behavior, not a
weakened test.

## Mutation testing (red confirmed for each fix)

Four targeted mutations were applied, one at a time, confirmed to make the corresponding new test
fail, then reverted and confirmed green again:

1. Removed the identifier-label-token exclusion guard in `explicitEntityName()` →
   `R1-016 regression: malformed identifier-shaped input...` failed (NAIC ABCD/CBC ABC would have
   been misread as company names). **Caught.**
2. Removed the `executionMode === 'IDENTITY'` route bypass in `resolveResearchScope` →
   `R1-016 Bug #3: a company name embedded in a route/journey sentence...` failed. **Caught.**
3. Disabled the Bug #2 post-loop resultClass-downgrade block in `assembleNetworkAnswerWithSpecialist`
   → `R1-016 Bug #2: Lender NMLS miss downgrades EXACT_IDENTITY...` failed. **Caught.**
4. Removed the `!plan.entityName` guard on the route-language identity wipe in
   `guided-research/session.ts` → `R1-016 Bug #3 (guided session): a company name embedded in a
   route sentence...` failed. **Caught.**

An attempted fifth change — authorizing `COMPARE` intent execution to "fix" the Broward/Palm Beach
lender comparison query — was itself caught by the existing golden corpus
(`ask-intel-v3-corpus.ts:193`, `forbiddenBehaviors: ['SPECIALIST_EXECUTION']`) before being kept,
and was reverted. Recorded under "Investigated and ruled out" above.

## Regression / release gate

- `npm run check:th-search-r1-016` — 145/145 pass.
- `npm test` (full repository suite: R1-008/R1-016 gates, all state network routes NJ/CA/TX/WA/AZ/
  CO/VA/NY/IL, network metrics, guided research, visual/share assertions) — exit 0, 0 failures.
- `npm run typecheck` — clean.
- `npm run lint` — 0 errors (4 pre-existing warnings, unrelated files, not touched by this work).
- `git diff --check` — clean.
- `npm run build` — production build succeeds, exit 0.

## Browser acceptance

Verified live in a real Chrome browser (`claude-in-chrome`) against a local production build
(`npm run build` + `npm run start`), not a description of expected behavior:

- **1280×900 (desktop, default viewport)** — verified. "JK Moving Services" returns 34 real,
  live-fetched public records with "Exact company-name match" as the top hit (USDOT 1065394,
  Sterling, VA). "Can JK Moving handle my move from Virginia to Florida?" returns 70 real records
  with "JK Moving Services" (USDOT 1065394) top-ranked ("Company-name prefix"), with the
  route/service-territory disclosure shown as context, not as a blocking refusal. "moving from
  Miami Florida to New York City" (no named company) correctly shows a disclosed, non-blank
  clarification ("Requested scope is not executable" + real next actions: "Verify a USDOT or MC",
  "Research recorded headquarters"). No console errors on any of the three pages.
  - Note: an initial check against a stale, already-open browser tab showed the pre-fix broken
    behavior even after rebuilding — this was a leftover Windows `next start` process that an
    earlier `pkill` had failed to actually terminate (confirmed via `netstat`/`Stop-Process`), not
    a residual code defect. A fresh tab against the newly-started server showed the correct,
    fixed behavior. Recorded here because it is exactly the kind of false read the standing
    contract's evidence discipline exists to catch — verify against a definitely-fresh server and
    a definitely-fresh tab before trusting a browser result.
- **768×1024, 390×844, 320×…** — **NOT TESTED.** `resize_window` was called for all three and
  reported success, but the subsequent screenshot was pixel-identical (1512×801) to the 1280×900
  screenshot in every case — the viewport did not actually change. This reproduces the same
  `resize_window` limitation already documented for this environment in the prior ATH-METRICS-R2
  mobile-QA follow-up (confirmed there across two independent sessions and five requested sizes).
  Reported honestly as blocked/not tested rather than fabricated as passing, per the explicit
  instruction in the R1-016 spec against fake viewport certification.

## Scope discipline

Only `Conumers-Trust-Hub` files were edited: `lib/network/identifiers.ts`,
`lib/network/capability-registry.ts`, `lib/network/research-planner.ts`,
`lib/network/research-scope.ts`, `lib/network/ask-plan.ts` (Fix #2, already present on disk before
this session's continuation), `lib/network/prompt-2.test.ts`, `lib/network/lender-execute.test.ts`,
`package.json`, plus the new `lib/network/th-search-r1-016.test.ts` and this evidence directory. No
specialist repository, schema, or canonical data was touched. The explicitly-unauthorized Move
JK/MC canonical-data correction was not attempted.
