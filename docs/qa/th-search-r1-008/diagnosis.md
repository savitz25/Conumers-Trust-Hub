# TH-SEARCH-R1-008 diagnosis

Baseline: `e7be3e540fd905a3e3e8b0fe0e347adb2dfbd6e0`; origin `savitz25/Conumers-Trust-Hub`. Production baseline deployment: `dpl_8ozyxjXttN4wqoSjpFxB8Qz3Bfp6`. Fresh isolated `th-search-r1-008` worktree; no overlapping visible assignment. Unrelated PR #5 was left untouched. NY PR #134 and subsequent #135/#136 are preserved. Model/effort: GPT-6 Astra / High, USER-CONFIRMED, not independently verified.

## Reproduction and cause

The actual baseline route classified ?senior homes in Austin Texas? as needing an organization identity. It created no guided session. The page nevertheless rendered the legacy network executor solely because the session was absent. Instrumenting that actual executor recorded Insurance, Move, Lender and Contractor calls despite `canExecute=false` (`baseline.json`). The current live before screenshot showed a four-system cohort area under an identity-needed route. It did not reproduce the historical ten Move cards in this observation window; those counts are not asserted.

The route planner, guided initialization and legacy dispatcher applied separate policies. Generic place inference displaced the care task. The existing Senior adapter omitted state from city requests and treated a display-location string as structured fields. The client did not cancel/ignore superseded requests. Static initial route headings could remain above a later guided result. Non-link retry actions were not rendered.

## Repair boundary

`care-task.ts` supplies a narrow task-aware care interpretation using existing state metadata. Generic care needs a setting; explicit CMS classes preserve compound recorded city/state. City-only scope requires a jurisdiction rather than inferring uniqueness from provider records. Relocation of belongings remains Move; care plus relocation retains distinct selectable steps. No new taxonomy, dataset, geocoder or LLM.

`decideAskExecution` is the common server permission decision. The page, route summary and legacy network assembler honor it before retrieval. A missing guided session cannot authorize fan-out. Guided transitions rebuild the effective care plan from original wording plus validated choices; direct dispatch independently validates hub/class/location/evidence permission. Unsupported settings are completed limitations, not nursing-home substitutes. Place-lens coverage remains a separate static overview.

The Senior adapter uses the released structured v2 endpoint with class and compound geography; validates envelope hub/contract, class, row city/state, CCN, profile class/CCN/origin, count and pagination bounds. Returned source-native evidence, source-as-of and retrieval clocks remain distinct. A bounded dispatch receipt records the actual public endpoint/class/location sent; no raw care-question analytics were added. Existing successful API shapes are preserved with additive metadata.

Guided session version v5 prevents stale older sessions being reused. Client cancellation/revision checks and query-keyed state prevent old results being shown under new questions. Retry/edit actions are usable; result focus is restored. Recovery links retain original question plus Senior's allowlisted class/state overrides. State-specific unsupported care settings retain their identity and jurisdiction limitation.

## Upstream/source oracle

Senior read-only reference: `1d0e33deb30ac0e7ca07c7b9b4056553c0a8681d`, R1-007. See `senior-contract-reference.json` for independently queried structured source responses, provider identities and clocks. Native GET allows q/page/class/state/evidence/stars/broaden; the parent structured POST sends only supported body fields. Nursing Home, Home Health and Hospice are separate populations.

Observed NH Austin/TX count 25 and HHA Houston/TX count 260 describe this source window, not constants. The preview displays at most 20 records; counts come from the source, not the page. Nursing-home source release is 2026-08-01; HHA 2026-05-27. Fingerprints and retrieval times are recorded in browser receipts. Recorded provider/office location is not service territory or availability.

## Deliberate expectation changes

The older Boca Raton city-only fixture silently supplied Florida. It now asks for a state; explicit Boca Raton Florida remains a positive. ?Senior care close to Phoenix? now requests a care setting, not an organization identity. Old Senior transport fixtures were updated to R1-007's `recordedLocationFields`, hub/class/geography envelope and canonical CMS profile path; the Boca Raton request now includes state FL. Assisted living is an additional source-aware choice. Journey destination tests explicitly validate Ask-owned care refinements and ensure they leave the combined journey rather than looping; specialist allowlists remain enforced.

## Review and operating boundaries

Separate self-review plus automated tests, not independent human review. Review found and fixed forged city-value versus city-field divergence, direct-dispatch permission tampering, class/CCN profile-link mismatches, missing retry controls, lost jurisdiction in handoffs and journey loops. No production records, accounts, migrations, environment settings or specialist repositories changed. Local browser tests ran without operational credentials; expected local telemetry persistence errors are not evidence of a Production outage.

Rollback must be an Ask-only reviewed revert/deployment retaining the no-wrong-hub guard. Do not restore the known unsafe unrestricted dispatch path, revert prior specialist work, or perform a database rollback. Remaining unrelated identifiers, geography, AI Concierge, care ownership workflows and Move's pending canonical correction remain outside this closure.


## Final local review additions

The browser outage test exposed missing non-link Retry rendering. The history test then found an edited question restored above the prior result; the controlled form now restores from the current URL on pageshow/popstate. A forged history snapshot cannot replace the immutable original question/session envelope. Generic selected care handoffs are reconstructed from the effective class, recorded location and current supported rating, while original wording remains in Ask. Combined rating refinements remain inline when the native URL cannot faithfully represent them. No silent filter relaxation occurs.

Final local code candidate: `b384651ce650b7faa52848efc454c6779a9e73e4`. Deterministic focused gate: 69/69. Broader routing/guided gates: 170/170. Root regressions: 266/266. Claims: 21/21 on both base and candidate. Typecheck/build pass; lint has the same four warnings as base. P11-P19 contracts pass. Local complete browser and controlled fixture/browser suites pass; source profile action and Senior native handoff were checked.

Preview build for b384651 is READY. Anonymous preview navigation redirects to Vercel login; no bypass or protection change was attempted. Local optimized-build browser evidence is complete; canonical Production browser proof is required after the reviewed merge.

## Production release

PR #137 merged normally at `01e45ce28c8da8c02f04046da862ffbe22123309` after green CI, Vercel build and automated Vercel review. The review identified raw timeout-abort copy; `c51529a67b1aeecb45ee0db4110997591f98bc1e` fixes it with a same-request retry. The browser reproduced the old failure and verified the repair. No independent human review is claimed.

Canonical `www.asktrusthub.com` resolved to `dpl_5n2dc88v2UfrMRLwjvsPhkRFhbqx`, SHA `01e45ce28c8da8c02f04046da862ffbe22123309`. Full production browser, live API, published profile, in-flight response, Back/Forward, 390/1280/320 layout and first-Enter checks pass. Austin selection completed in 690 ms (183 ms specialist); direct Austin 580 ms; Houston 454 ms; Houston state choice 259 ms. Source totals remain independently checked 25 and 260 for this release window, with 20 displayed rows. Generic care and city-only API requests record zero specialist calls before clarification.

Two error-level runtime entries were PostgreSQL connection-mode warnings on successful requests; the same warning was confirmed on the baseline deployment. No new application failure was observed. Public search may emit existing approved telemetry; no regulatory/account/schema/configuration writes were performed. Preview interactive access remained protected, so preview HTML was not counted as browser proof. These receipts describe the actual runtime merge; the later QA-only merge identifier is reported after it exists.
