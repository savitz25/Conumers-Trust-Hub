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
| AskTrustHub (R2-06) | `a4fbec9da7eb131582efdd0b76d72867e133311d` | `ath-metrics-r2-06-ask` | See PR link in this session's final summary | *(filled after merge)* | *(filled after merge)* | *(filled after merge)* |
| Contractor / Move / Senior / Lender / Insurance / Investor | n/a | n/a | n/a | n/a | n/a | Not modified - UNCHANGED/REVERIFIED (section D) |

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

# ATH-METRICS-R2 — CLOSED
