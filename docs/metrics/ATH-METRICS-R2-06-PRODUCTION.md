# ATH-METRICS-R2-06 - Network metrics automation hardening + final QA

Verified 2026-09-14 UTC. Closes the ATH-METRICS-R2 project.

## A. Final status

**ATH-METRICS-R2: COMPLETE.**

| Repository | Status |
|---|---|
| ContractorTrustHub | UNCHANGED / REVERIFIED |
| MoveTrustHub | UNCHANGED / REVERIFIED |
| SeniorTrustHub | UNCHANGED / REVERIFIED |
| LenderTrustHub | UNCHANGED / REVERIFIED |
| InsuranceTrustHub | UNCHANGED / REVERIFIED |
| InvestorTrustHub | UNCHANGED / REVERIFIED |
| AskTrustHub | COMPLETE (R2-05 merged + Production-verified; R2-06 automation merged + Production-verified) |

No specialist repository required a code change for R2-06. Each already had (confirmed live
against GitHub, section D) a canonical metrics-generation command, a CI workflow that runs a
stale-artifact/reconciliation check on every `push`/`pull_request`, and a homepage that
consumes the generated contract rather than a hand-typed constant. R2-06's job for those six
repositories was verification, not construction, and the R2-01 through R2-04 work already
built the pieces R2-06 needed. All R2-06 code changes are in AskTrustHub only.

## B. R2-05 final certification

- PR [#140](https://github.com/savitz25/Conumers-Trust-Hub/pull/140) merged as
  `092d07e12edaa7404e7848e999767ef979f932cb` (2026-09-14T13:23:18Z), after reconfirming the
  head SHA (`5fc077e7a679e6dcc3eef87f678b400d7f0b0ec9`) was unchanged from the reviewed state.
- Git-triggered Vercel Production deployment confirmed via the GitHub Deployments API:
  deployment `6437988057`, `environment: Production`, `sha: 092d07e1...`, status `success`.
- Live Production verification against `https://www.asktrusthub.com/`: **6/6 specialist cards
  render `data-specialist-origin="UPSTREAM"`, 0/6 `FALLBACK`.** All current headline values
  present (662,331 / 5,022 / 6,392 / 82,071 / 6,185 / 23,622); none of the historical
  regressions (644,421 / 6,394 / 25,777) present. Illinois Move renders as
  `"Illinois current HHG roster (search-only; closure pending)"`, not zero. No cross-hub
  mega-total in the rendered HTML.
- A documentation follow-up, PR [#141](https://github.com/savitz25/Conumers-Trust-Hub/pull/141)
  (merge commit `a4fbec9da7eb131582efdd0b76d72867e133311d`), updated
  `docs/metrics/ATH-METRICS-R2-05-PRODUCTION.md` from PARTIAL to COMPLETE with the above
  evidence.
- **Desktop/mobile browser rendering and console QA: BLOCKED.** No browser automation is
  available in this session (confirmed by the operator). Live HTML content verification
  (equivalent to what a browser would receive from the server) was performed in its place;
  actual viewport/layout/console verification still needs a browser-capable session or a
  human reviewer. This does not block R2-05/R2-06 closure because the defect this project
  targets (contract rejection / stale fallback) is independently and conclusively verified
  above; it is called out here, not silently skipped.

R2-05 status: **COMPLETE**, per the Stage 1 hard gate in the R2-06 prompt (6/6 upstream, 0
fallback, Production == merged SHA, critical values correct, null semantics preserved, no
new blocking issue).

## C. Automation before vs. after

| Stage | Before R2-06 | After R2-06 |
|---|---|---|
| Accepted state data -> specialist metrics | Human runs each specialist's generator (`build_network_metrics_v1.mjs` / `build-senior-network-metrics.mts`) after reviewing/accepting source data | Unchanged - this human review step is intentionally never automated (section 15) |
| Specialist generator invocation | Manual, per specialist, on a feature branch | Unchanged; already reproducible via one canonical `npm run build:network-metrics` / `home:metrics` command per hub (confirmed present in all six, section D) |
| Stale artifact detection | Per-specialist CI already ran a `--check`/stale-manifest job on every push/PR (confirmed present in all six) | Unchanged - already satisfied the requirement; verified, not rebuilt |
| Specialist homepage propagation | Generated contract -> typed homepage projection, already enforced by each hub's own homepage-contract tests | Unchanged - already satisfied |
| Specialist contract publication | Committed JSON artifact + public `/api/network-metrics` route, already live for all six | Unchanged - already satisfied |
| Ask contract acceptance | **Broken**: hard-coded `sourceFingerprint` equality gate rejected every compatible revision (R2-05 defect) | **Fixed in R2-05**: schema-family + structural validation only; a new compatible `contractRevision` needs no Ask code change (R2-06 adds a direct regression test simulating this, section F) |
| Ask fallback behavior | Fallback silently substituted for a healthy upstream (the R2-05 bug); bundled snapshots could go stale indefinitely with no visibility | **Fixed in R2-05** (healthy upstream never falls back) + **hardened in R2-06**: a scheduled health check now reports fallback drift visibly instead of leaving it to be discovered by a future incident |
| Ask homepage propagation | Already generated-contract-driven (no hand-typed totals) before R2-05 | Unchanged - already satisfied; R2-06 adds a permanent mega-total regression guard (section F) |
| Fallback refresh | Fully manual, no tooling, no detection - this is exactly how the fallbacks went stale in the first place | **New in R2-06**: `npm run metrics:check-fallback-drift` (detection, never fails CI) + `npm run metrics:refresh-fallbacks` (one-command refresh) + a scheduled workflow that runs the check daily and on demand |
| Failure observability | A hub silently falling back produced no operator-visible signal beyond the on-page amber notice | **New in R2-06**: `.github/workflows/specialist-network-health.yml` runs `metrics:verify-specialists` daily and on `workflow_dispatch`; a genuine incompatibility fails the job (visible in Actions, and GitHub emails watchers on scheduled-workflow failure by default) |

## D. Per-hub automation (specialist repositories)

Confirmed live against each repository's default branch on GitHub (`gh api
repos/<owner>/<repo>/contents/...`) on 2026-09-14, without cloning or modifying any of them.

| Hub | Canonical generation command | CI guard | Stale-artifact behavior | Homepage coupling | Remaining manual step |
|---|---|---|---|---|---|
| Contractor | `npm run home:metrics` (`build_network_metrics_v1.mjs`); `--check` via `npm run check:metrics-r2` | `.github/workflows/contractor-network-metrics.yml` on `push`/`pull_request`: `assert_network_metrics_v1.mjs`, `assert_homepage_intel.mjs`, grain-safety unit tests, `check:metrics-r2` | `--check` mode fails non-zero on drift between accepted inputs and the committed artifact | Homepage consumes `data/home/contractor-network-metrics-v1.json` via typed loader, not literals | Human still runs the generator after reviewing new accepted source data (by design, section 15) |
| Move | `npm run home:metrics`; `--check` via `check:metrics-r2` | `.github/workflows/move-network-metrics.yml` (plus `network-production-smoke.yml`) | Same pattern as Contractor | Same pattern | Same |
| Senior | `npm run build:network-metrics` (`build-senior-network-metrics.mts`); `--check` via `check:metrics-r2-03` | `.github/workflows/ci.yml` runs the domain/web metrics test suites; separate `cms-refresh.yml` has a pre-existing unrelated validation error (R2-03 report section L, still outside this project's scope) | Same pattern | Same pattern | Same; CMS-refresh workflow YAML fix remains outside ATH-METRICS-R2 scope |
| Lender | `npm run build:network-metrics`; `--check` via `check:metrics-r2-03` | `.github/workflows/lender-network-metrics.yml` | Same pattern | Same pattern | Same |
| Insurance | `npm run home:metrics`; `--check` via `check:metrics` | `.github/workflows/search-reliability.yml` includes `npm run check:metrics` alongside the hub's other required checks | Same pattern | Same pattern | Same; a pre-existing repository-wide lint debt in unrelated files is documented in the R2-04 report and remains outside this project's scope |
| Investor | `npm run build:network-metrics`; `--check` via `check:metrics` | `.github/workflows/investor-network-metrics.yml` + `ci.yml` | Same pattern | Same pattern | Same |

None of these six repositories were modified in R2-06. Confirming this pattern already existed
across all six (rather than assuming it from the R2-02/03/04 reports alone) was itself the
Stage 2 section-14 deliverable for the specialist side of the project.

## E. Ask automation

- **Fetch/revalidation behavior**: `app/page.tsx` declares `export const revalidate = 3600`;
  every specialist `fetch()` in `lib/network-metrics/load.ts` passes
  `next: { revalidate: SPECIALIST_METRIC_REVALIDATE_SECONDS }` (also `3600`). A new
  regression test (`ath-metrics-r2-06.test.ts`) pins these two together so they cannot
  silently drift apart. **Documented freshness SLA**: a compatible specialist update becomes
  visible on the Ask homepage within Next.js's ISR revalidation window - up to 60 minutes,
  typically sooner on the next real visitor request after that window elapses. This is
  Next.js/Vercel ISR behavior actually configured in this repository, not an invented promise.
- **Compatibility policy** (unchanged from R2-05, reconfirmed): schema family/version +
  structural/invariant validation in `validate.ts`; `sourceFingerprint`/`contractRevision`
  are provenance, never an acceptance gate.
- **Fallback behavior** (unchanged from R2-05): resilience-only, never the normal path;
  origin/fingerprint/`generatedAt` are preserved and rendered, never masked as current.
- **Refresh SLA / tooling (new in R2-06)**: `npm run metrics:check-fallback-drift` (read-only,
  never fails CI - drift is expected/healthy, not an error) and `npm run
  metrics:refresh-fallbacks` (writes the refreshed upstream JSON verbatim into
  `data/network-metrics/<hub>-v1-fallback.json` after validating it through the same
  structural validator the request-time loader uses). Deliberately does **not** auto-commit
  or auto-open a PR - see F for why, and the explicitly named follow-up.
- **Health verifier (new in R2-06)**: `.github/workflows/specialist-network-health.yml`,
  triggered on a daily `schedule` and `workflow_dispatch`, runs `metrics:verify-specialists`
  (fails the job on real incompatibility/unreachability/missing required field) and
  `metrics:check-fallback-drift` (informational only). Requires no new secrets - every
  specialist endpoint is public.
- **Remaining manual steps**: (1) a human must still run `metrics:refresh-fallbacks` and open
  a normal PR when the scheduled health check reports drift - this was a deliberate choice
  over unattended auto-commits (see F); (2) `lib/network-metrics/network-evidence.ts`'s
  `ADAPTER_PATHS` still hard-codes a few per-hub extra state paths (e.g. `/new-york`,
  `/illinois` for move/lender/insurance/investor) alongside each contract's own
  `network.publishedStateIntelligencePaths` - flagged in the R2-05 report and left as-is
  here; the durable fix is each hub eventually exporting its own complete published-path
  list the way Move already does, which is a specialist-side change out of this session's
  "do not modify the six specialist hubs" boundary.

## F. Why fallback refresh does not auto-commit (design decision)

The R2-06 prompt explicitly allows either "detection + notice + one-command refresh +
validation" as a minimum, or a bot-opened PR as the preferred pattern, and explicitly
forbids an unreviewed direct commit to `main`. This session chose the minimum (detection +
notice + one-command local refresh + the existing test suite as validation) rather than
wiring an automated PR-opening bot, for two concrete reasons specific to this repository:

1. It requires no new GitHub Action dependency (e.g. `peter-evans/create-pull-request`) or
   elevated `GITHUB_TOKEN` permissions beyond the read-only `contents: read` this workflow
   already uses, keeping the new automation surface minimal and auditable in one review.
2. A refreshed fallback snapshot also changes several hard-coded regression-test assertions
   (as happened in R2-05 itself - Contractor's `644,421` -> `662,331`, evidence-inventory
   counts, etc.). An automated bot PR would need to either also patch those assertions
   automatically (risking silently rewriting a test's intent) or leave the PR red pending a
   human anyway. A human-run `npm run metrics:refresh-fallbacks` followed by `npm test` and
   a normal PR keeps that judgment call with a person, as this whole project's lesson
   otherwise argues for.

**Named follow-up** (not implemented here): if the team wants a fully automated PR, the
concrete next step is a second workflow, triggered by `workflow_dispatch` or weekly
`schedule`, that runs `metrics:refresh-fallbacks`, and if `git status` shows changes, opens a
PR via `peter-evans/create-pull-request` (or equivalent) using the default `GITHUB_TOKEN`
with `contents: write` / `pull-requests: write` permissions scoped to that one workflow. This
is a reasonable Stage 3 candidate, not a gap in R2-06's stated "at minimum" bar.

## G. Null / capability certification

| Hub | Field | State | Rendered as |
|---|---|---|---|
| Move | `il_current_hhg_roster` | `null` / `UNKNOWN`, `PUBLIC_UNKNOWN` | `"Illinois current HHG roster (search-only; closure pending)"` - live-verified on Production, not `0` |
| Move | `ny_current_hhg_roster` | `null` / `UNKNOWN` | Present in evidence inventory with `value: null`, never coerced |
| Insurance | `co_producer_roster_count`, `il_authorized_companies`, etc. | `null` (`OPEN_SEARCH_ONLY` family) | `forbidNumericMissing` throws if any of these NOT_ACQUIRED-class fields is ever given a number |
| Insurance | `il_directors_order_observations` | Known value `2,896` | Evidence, rendered separately; live-verified never summed into agencies (`82,071`) or insurers (`6,185`) |
| Senior | `co.assistedLiving.count`, `co.homeCare.hcaCount` | `null` / unknown, `SEARCH_ONLY` | Preserved per the R2-03 contract; Ask never recomputes these |
| Insurance | `insurance_agencies` | Known value `82,071` | Rendered as-is; known zero would render as-is too if the specialist ever reported it, per `requirePublicCount`'s explicit `value < 0` (not `<= 0`) check |

`|| 0` / `?? 0` on a metric value does not exist anywhere in `lib/network-metrics/*.ts`; a
missing required field throws (fail closed to fallback) rather than silently becoming zero.

## H. Files changed (this session, R2-06 only)

All changes are in `consumers-trust-hub` (AskTrustHub). No specialist repository was touched.

| Path | Purpose |
|---|---|
| `.github/workflows/specialist-network-health.yml` | New: daily + on-demand six-hub schema/health check; fails loudly on genuine incompatibility, never on fingerprint drift |
| `scripts/refresh-specialist-fallbacks.mjs` | New: one-command bundled-fallback refresh tool with a pure, unit-tested `planRefresh()` decision function; validates through the same structural validators the request-time loader uses; never auto-commits |
| `lib/network-metrics/ath-metrics-r2-06.test.ts` | New: future-flow simulation (new state path + new evidence metric + new contractRevision, all accepted with zero Ask changes), `planRefresh` unit tests, permanent mega-total regression guard, freshness-SLA pin, health-workflow shape assertions |
| `package.json` | Added `metrics:check-fallback-drift`, `metrics:refresh-fallbacks`, `check:ath-metrics-r2-06` scripts; wired the new suite into `npm test` (replacing the `check:ath-metrics-r2-05` tail, which the new suite still runs internally) |
| `docs/metrics/ATH-METRICS-R2-06-PRODUCTION.md` | This report |

## I. Workflows / automation added

| Workflow | Trigger | Commands | Failure behavior | Visibility | Secrets |
|---|---|---|---|---|---|
| `specialist-network-health.yml` | `schedule` (`17 13 * * *`, daily) + `workflow_dispatch` | `npm run metrics:verify-specialists` then `npm run metrics:check-fallback-drift` | First command fails the job (exit non-zero) on unreachable upstream, schema mismatch, or a missing required metric in either the live upstream or the bundled fallback. Second command never fails the job - drift is expected/healthy and only printed. | Failing scheduled workflow is visible in the Actions tab; GitHub's default behavior emails repository watchers on a scheduled-workflow failure. No custom notification integration was added. | None - all six specialist endpoints are public JSON/GitHub raw URLs |

## J. Tests

| Command | Result |
|---|---|
| `npm run check:ath-metrics-r2-06` | PASS - 65/65 (new R2-06 suite + full R2-05/004c/004b/001c/home-005 chain + `metric-value` + `ask-home-002`) |
| `npm test` (full repository chain) | PASS - exit 0 |
| `npm run typecheck` | PASS, 0 errors |
| `npm run lint` | PASS - 0 errors, 4 pre-existing warnings, none in changed files |
| `npm run build` | PASS - compiles successfully |
| `npm run metrics:check-fallback-drift` (live, against Production specialist endpoints) | PASS - all six report `noop: bundled fallback already matches upstream` |

New tests added in `ath-metrics-r2-06.test.ts` (8 tests):

1. Future-flow simulation: a new state path (`/nevada`), a new PUBLIC evidence metric key,
   and a new `contractRevision` (`ATH-METRICS-R2-07`) in a single simulated Move release are
   all accepted and correctly rendered with zero AskTrustHub code changes - this is the R2-06
   "final network automation test" (prompt section 38).
2. An incompatible `schemaVersion` in that same simulated future release still fails closed.
3. `planRefresh()` proposes a refresh only for a valid, newer, schema-compatible upstream;
   rejects malformed JSON, an incompatible schema, and a missing required field.
4. No cross-grain mega-total phrase exists in the rendered homepage or card component
   (permanent regression guard for the finding manually confirmed in Production in section B).
5. The homepage's `revalidate` and the specialist fetch `revalidate` stay pinned together.
6. The health workflow has both a `schedule` and `workflow_dispatch` trigger, runs both new
   npm scripts, and requires no `secrets.*`.
7. All six hubs remain independently namespaced (`schemaVersion` starts with the hub id) -
   guards against an accidental shared/merged schema in the future.
8. `adaptContractorCard`/`adaptMoveCard` still work standalone after the R2-06 additions.

## K. PRs / commits / deployments

| Repository | Starting SHA | Branch | PR | Merge commit | Final main SHA | Production deployment |
|---|---|---|---|---|---|---|
| AskTrustHub (R2-05) | `7a5060d7312bf6f71e926b20d1520d70590b3281` | `ath-metrics-r2-05-ask` | [#140](https://github.com/savitz25/Conumers-Trust-Hub/pull/140) | `092d07e12edaa7404e7848e999767ef979f932cb` | `092d07e1...` | Deployment `6437988057`, success |
| AskTrustHub (R2-05 report finalize) | `092d07e12edaa7404e7848e999767ef979f932cb` | `ath-metrics-r2-05-finalize` | [#141](https://github.com/savitz25/Conumers-Trust-Hub/pull/141) | `a4fbec9da7eb131582efdd0b76d72867e133311d` | `a4fbec9d...` | Docs-only; no application code changed |
| AskTrustHub (R2-06) | `a4fbec9da7eb131582efdd0b76d72867e133311d` | `ath-metrics-r2-06-ask` | [#142](https://github.com/savitz25/Conumers-Trust-Hub/pull/142) | `0b482269e5e439f0c9aed94e3741388ee95f2ae2` | `0b482269...` | Deployment `6438354292`, success |
| Contractor / Move / Senior / Lender / Insurance / Investor | n/a | n/a | n/a | n/a | n/a | Not modified - UNCHANGED/REVERIFIED (section D) |

**Automation dry run**: immediately after merge, the new workflow was manually triggered via
`gh workflow run "Specialist network health"` to prove it works end-to-end rather than only
locally. Run [34850967638](https://github.com/savitz25/Conumers-Trust-Hub/actions/runs/34850967638)
completed `success` in ~23 seconds: `metrics:verify-specialists` printed `specialist upstream
and bundled fallback manifests are schema-compatible`, and `metrics:check-fallback-drift`
printed `noop: bundled fallback already matches upstream` for all six hubs and `No bundled
fallback snapshots are behind their live upstream contract.` `gh workflow list` confirms the
workflow is registered and `active` alongside the pre-existing `Search reliability` workflow.

## L. Live network QA

Performed 2026-09-14 via `curl` against each production domain's homepage (HTTP status
only; full page-weight/asset verification was out of scope for this pass).

| Domain | Reachable | Notes |
|---|---|---|
| asktrusthub.com | YES (HTTP 200) | Full content verification in section B; 6/6 UPSTREAM |
| contractortrusthub.com | YES (HTTP 200) | Not modified this session; R2-02 report already Production-certified it |
| movetrusthub.com | YES (HTTP 200) | Not modified this session; R2-02 report already Production-certified it |
| seniortrusthub.com | YES (HTTP 200) | Not modified this session; R2-03 report already Production-certified it |
| lendertrusthub.com | YES (HTTP 200) | Not modified this session; R2-03 report already Production-certified it |
| insurancetrusthub.com | YES (HTTP 200) | Not modified this session; R2-04 report already Production-certified it |
| investortrusthub.com | YES (HTTP 200) | Not modified this session; R2-04 report already Production-certified it |

Desktop/mobile rendering and browser console checks across all seven domains: **BLOCKED**, no
browser automation available in this session (same caveat as section B). Ask's own metrics
consumption is independently verified via live HTML content (section B); the six specialist
homepages' own metrics correctness was already Production-certified in their respective R2-02
through R2-04 reports and was not re-litigated here since none of those six repositories were
touched in this session.

## M. Remaining technical debt (outside ATH-METRICS-R2 scope)

- Move repository-wide TypeScript diagnostics (532 pre-existing, zero in changed files) -
  noted in the R2-02 report, unchanged, **outside ATH-METRICS-R2 scope**.
- Move County SEO Compliance failure (Tier-1 counties over threshold) - pre-existing before
  R2-02, unrelated to network-metrics data/logic, **outside ATH-METRICS-R2 scope**.
- Senior's `cms-refresh.yml` workflow has a pre-existing YAML validation error
  (`runner.temp` at line 44) unrelated to the metrics workflow - noted in the R2-03 report,
  **outside ATH-METRICS-R2 scope**.
- Insurance repository-wide lint debt (15 pre-existing errors in untouched files) - noted in
  the R2-04 report, **outside ATH-METRICS-R2 scope**.
- `lib/network-metrics/network-evidence.ts`'s `ADAPTER_PATHS` still hard-codes a few per-hub
  extra state paths rather than every hub exporting its own complete list (section E) - a
  real but small piece of remaining manual coupling, explicitly named rather than fixed here
  since fixing it requires a specialist-side contract change, which this session's operating
  mode does not permit without a proven specialist defect.
- Automated PR-opening for fallback refresh (section F) was deliberately not built; named as
  a specific, scoped Stage 3 candidate rather than left as an unlabeled gap.

None of the above is a metrics-correctness defect; all were true before this session and
remain true after it, correctly attributed to their origin rather than implied as new.

## N. Final Production certification

| Claim | True? |
|---|---|
| All six specialist contracts are authoritative | TRUE |
| Ask consumes all six healthy upstream contracts | TRUE - 6/6 `UPSTREAM` verified live in Production |
| Healthy compatible specialist revisions require no Ask code change | TRUE - verified by both the R2-05 regression suite and the new R2-06 future-flow simulation (new state + new metric + new revision, zero code changes) |
| Incompatible schemas fail closed | TRUE - verified for all six hubs, plus the new simulated-future-release variant |
| Fallback is resilience only | TRUE - 0/6 `FALLBACK` in healthy Production; fallback path is exercised only in tests via simulated outages |
| Stale fallback cannot silently masquerade as healthy upstream | TRUE - the R2-05 defect (the actual historical failure of this exact claim) is fixed and regression-tested; R2-06 adds ongoing visibility via the scheduled health check |
| Changing homepage totals come from generated contracts | TRUE - unchanged architecture, now with a permanent mega-total regression guard |
| Accepted dataset changes cannot silently bypass stale-artifact validation | TRUE for all six specialists - each has an existing `--check`-mode CI guard (section D) |
| Null is never treated as zero without source evidence | TRUE (section G) |
| Cross-grain fake totals are absent | TRUE - verified live in Production and now permanently guarded by a test |
| Critical historic count regressions are protected | TRUE - 662,331 / 6,392 / 23,622 all verified live; 644,421 / 6,394 / 25,777 all verified absent |
| Source clocks remain distinct from generated clocks | TRUE - unchanged from R2-05; `sourceAsOf`/`retrievedAt`/`snapshotAsOf`/`generatedAt` all pass through untouched |
| Canonical source data was not mutated | TRUE - no specialist repository was touched; Ask's own database/source data does not exist for this metrics path (it consumes published JSON only) |
| Future state expansion has a validated automatic metrics propagation path | TRUE - demonstrated directly by the R2-06 future-flow simulation test, not merely asserted |

All fourteen claims are true.

## O. Browser / Mobile Production QA

Performed 2026-09-14T13:5x UTC using real Chrome browser automation (`claude-in-chrome`),
which was not available in the sessions that produced sections A-N above. This closes the
one item those sections left BLOCKED, with one narrower exception noted below.

**Production URL**: `https://www.asktrusthub.com/`. **Deployed SHA**: `0b482269e5e439f0c9aed94e3741388ee95f2ae2` (PR #142/#143, per section K) - unchanged during this QA pass, no code was modified.

### Desktop (1440x900) - COMPLETE, no defects

- Page loaded successfully: no blank state, no error screen, no redirect loop. React
  hydrated cleanly (see console result below).
- All six specialist cards render, confirmed via the DOM (not just visually): a script
  reading every `[data-specialist-origin]` element returned **`UPSTREAM` for all six**
  (`move`, `lender`, `insurance`, `senior`, `contractor`, `investor`) - **6/6 UPSTREAM, 0/6
  FALLBACK**, matching section B. No "Showing last-known-good specialist snapshot" text
  present anywhere on the page.
- Visually confirmed on-screen: Contractor **662,331** / **507,933**; Move **5,022**
  publishable / **4,715** current authority; Lender **14,623** institutions plus HMDA/
  complaint/enforcement figures (Florida's **6,392** is a specialist-state-page figure, not
  a homepage card headline - not surfaced here, consistent with the component's design);
  Insurance **82,071** agencies / **6,185** legal insurers / **622,019** appointments;
  Investor **23,622** advisory firms / **17,018** RIA / **6,604** ERA; Senior **14,690** /
  **12,460** / **6,669** current nursing homes/home health/hospice plus the full evidence
  set (200,327 fire citations, 149,978 inspections, 15,694 enforcement, etc.) - all matching
  the authoritative R2-02/R2-03/R2-04 contracts exactly.
- A DOM-level scan for forbidden literals (`644,421`, `6,394`, `25,777`, `total records`,
  `network records`, `total companies`, `all records`, `TrustHub records`) found **zero**
  matches anywhere on the rendered page.
- Provenance panels render correctly and legibly on every card: e.g. Lender shows "Network
  rollup generated 2026-09-12", "Newest documented specialist source date 2026-09-09",
  "Specialist contract revision ATH-METRICS-R2-03"; Insurance shows "...ATH-METRICS-R2-04";
  Move/Contractor show "...ATH-METRICS-R2-02". No overflow, no overlapping elements, no
  `undefined`, no `[object Object]`, no empty labels.
- Network evidence inventory section reads "**274** publication-eligible specialist
  measures" and "No fake grand total" - matching the R2-06 test's expected count exactly.
- Ten-state network explorer: all ten states (Florida, New Jersey, California, Texas,
  Washington, Arizona, Colorado, Virginia, New York, Illinois) render exactly once each (a
  DOM count of every `<h3>` heading found no duplicates). Illinois's card shows "Specialist
  state intelligence" for all six hubs - a qualitative capability label, never a `0` or a
  bulk count, consistent with Illinois Move's null/search-only state.
- Interaction: all six specialist hub links resolve to their correct canonical domains
  (verified via DOM `href` inspection); physically clicked through to
  `contractortrusthub.com` (landed correctly, showing its own "Newest documented source date
  2026-09-11 / Network rollup generated 2026-09-12" - consistent with the Contractor
  contract) and used browser back navigation to return to `asktrusthub.com` successfully.
- Keyboard accessibility sanity check: `Tab` moves focus through real interactive elements
  (confirmed via `document.activeElement`, e.g. landed on the "USDOT 3244649" example chip
  button), and those elements carry a `focus-visible:ring-2` Tailwind focus style - no
  keyboard trap observed.
- Console: zero page-origin errors, zero React/hydration/warning messages matching
  `hydrat|React|Warning|fetch|CORS|404|failed|Uncaught` on a clean reload. The only messages
  present originated from `chrome-extension://...next-content.js` (the browser extension
  itself) and are unrelated to the page.
- Network: two requests returned HTTP 503 in the browser's network panel -
  `/.well-known/vercel/jwe` (a Vercel platform-internal skew-protection endpoint, not
  application code) and a bare `HEAD /`. Both were **not reproducible via direct HTTP**
  (`curl -I https://www.asktrusthub.com/` returned 200; `curl
  https://www.asktrusthub.com/.well-known/vercel/jwe` returned 204) even immediately after
  observing them in the browser. This points to a browser-automation/platform-edge
  interaction (e.g. a bot-protection heuristic responding differently to the automated
  browser's request signature than to `curl`, or the extension's own network-tracking
  reporting an aborted/cancelled request as its last known status) rather than an
  application defect: neither path is called by AskTrustHub's own code (no
  `fetch('/.well-known/vercel/jwe')` or bare `HEAD /` exists anywhere in
  `lib/network-metrics/` or the homepage component), the visible page content was correct
  and complete on every load, and specialist-metrics fetching happens server-side (Next.js
  ISR), so it is never visible as a browser network request regardless. Reported here for
  visibility, not treated as a defect requiring a code change.

### Mobile (390px, 320px) - BLOCKED (narrower reason than before)

Real browser automation is connected in this session (a genuine change from the sessions
that produced sections A-N), but this specific session's `resize_window` tool does not
apply the requested dimensions: repeated attempts to resize to 390x844, 430x900, 320px-class
widths, and even 900x700 and 2000x1200 all left `window.innerWidth` clamped in the
1600-1778px range regardless of the requested size (tried on both the original tab and a
freshly created tab, before and after navigation). Chrome's native DevTools responsive
design toggle (`Ctrl+Shift+M`) was also attempted via synthesized keyboard input and did not
open a device toolbar. No tool in this session's toolset provides a device-metrics/viewport
override independent of the native window size.

This is a different, more specific limitation than the one closed above: browser automation
itself now works (desktop verification above is real, not curl-based), but this session's
particular browser environment cannot be resized to a genuine mobile viewport. No mobile
screenshot or rendered-layout claim is made, and none should be inferred from the desktop
result - responsive CSS behavior at small widths was not independently verified by rendering
in this pass. A session with working viewport/device emulation (or a physical device) is
still needed to close this specific sub-item.

**Independently reconfirmed in a follow-up session** (same day, fresh tab group, fresh
Chrome connection, no prior tab/window state reused): `resize_window({width:390,
height:844})` against a brand-new tab reported success, but `window.innerWidth` after
navigating to Production still read `1600` (equal to `screen.width`), not `390`. This is the
same clamp-to-screen-width behavior observed above, now confirmed across two independent
sessions and multiple distinct requested sizes (390, 430, 900x700, 2000x1200, 390 again),
which rules out a one-off fluke and points to a fixed-size virtual display underlying this
Chrome instance rather than a resizable OS window. No tool available in either session
exposes a CDP-level device-metrics override (the mechanism Chrome DevTools' own responsive
design mode relies on) independent of the OS window's actual bounds, so this sub-item
remains genuinely un-closable with the tools this environment currently provides. It is not
a retry-until-it-works situation; it is a capability gap, reported precisely as such.

### Fallback UI state (not simulated against Production, per instruction)

Per the task's own guidance not to interfere with live Production services, the fallback
warning state was not triggered against `asktrusthub.com`. It is exercised instead by the
existing automated test suite (`lib/network-metrics/ath-metrics-001c.test.ts` and
`ath-metrics-004b.test.ts`), which asserts the exact rendered markup
`assert.match(html, /last-known-good specialist snapshot/i)` and
`assert.match(html, /Showing last-known-good specialist snapshot/i)` for every hub under a
simulated timeout/500/malformed-JSON/wrong-schema condition, run again as part of this
session's `npm test` (see below) - all passing, unchanged.

### Verification commands re-run this session

`npm test` and `node scripts/verify-specialist-metrics.mjs` were re-run against current
Production to confirm nothing had drifted since section N: both passed (full suite green;
`specialist upstream and bundled fallback manifests are schema-compatible`, zero drift).

### G. Console (consolidated)

- **Errors**: none, page-origin.
- **Warnings**: none, page-origin.
- **Extension noise** (not page-related): `chrome-extension://.../next-content.js` info logs; an "asynchronous response" messaging error attributable to an installed extension's own `chrome.runtime` messaging, reproduced identically on a clean reload and not tied to any user action on the page.

### Files changed (this QA pass)

Only this report. No application code, test, or configuration file was changed - the
browser QA found no Production defect to fix.

## Final certification

The previously blocked desktop browser and console verification is now complete, with zero
defects found: 6/6 specialist contracts render `UPSTREAM`, all critical metrics match their
authoritative contracts exactly, provenance renders correctly, no mega-total exists, links
and keyboard navigation work, and the console is clean of application errors. Mobile-specific
viewport rendering (390px/320px) remains unverified by real rendering, blocked by this
session's browser-automation environment not honoring viewport-resize requests - a narrower
and more specific gap than the original "no browser automation" limitation, and one that
does not indicate any known or suspected defect (the underlying CSS uses standard Tailwind
responsive utilities throughout, per the source already reviewed in earlier sessions, but
that is source inspection, not a substitute for rendering, and is not relied upon here as
proof). ATH-METRICS-R2's metrics-correctness scope - the actual subject of this whole
project - has no remaining verification gap and remains CLOSED; a final, narrow
mobile-rendering check is recommended before considering *browser* QA itself fully closed.

# ATH-METRICS-R2 — CLOSED
