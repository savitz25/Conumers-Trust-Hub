# Lender V2-1 independent QA — V2-3C / Builder 4

Exact head `315093be109796c9dd170e80a936ecd10e9cff7d`, PR #52. Date 2026-09-19. Verdict **FAIL B4-L1 / B4-L2**. No Lender files changed; separate localhost-auth incident not investigated.

Read and ran exact-head `qa-v2-save.mjs` on 4313 and `--provider` on 4314, both committed browser runners and 3 focused tests. The provider fixture uses real provider/control/storage/sync, with Supabase Auth/pull/upsert mocked. New independent Ask scripts additionally test seeded research, reload disclosure, queued push on sign-out, and actual sync-module completion after an owner switch. All servers are loopback-only; no production forms/DB calls.

| Check | Result | Evidence |
| --- | --- | --- |
| Immediate guest Save, duplicate write/effects and reload record | PASS | BROWSER local storage |
| Pending Auth/workspace | PASS | BROWSER + MOCKED: retained intent waits for resolved owner and workspace pull; unresolved Auth does not silently become guest; timed-out intent does not later replay |
| Guest versus authenticated namespace | PASS | LOCAL INTEGRATION/MOCKED; resolved owner writes only matching user namespace; guest copy remains |
| Stale initial Auth and sign-out during pull | PASS | Real provider + MOCKED Supabase; stale getUser/pull cannot restore prior owner or write guest state |
| Queued push after sign-out, before 800ms debounce | PASS | Independent real provider/storage with MOCKED Supabase; zero upsert calls after transition |
| In-flight push completes after owner changes | **FAIL B4-L2** | Actual `sync.ts` bundled with isolated mocks: returns `ok`, not skipped/stale; missing post-await owner check |
| Navigation/owner-sensitive pending Save | PASS | BROWSER/MOCKED: cancellation and synchronous namespace guard prevent wrong-profile/owner replay |
| Storage failure/null active plan and retry | PASS | Focused tests + BROWSER; fresh blocked storage returns recoverable failure, no success; retry succeeds |
| Notes/plan/calculator/comparison retention | PASS | Independent BROWSER: original record and normalized synthetic snapshot survive second profile Save |
| Reload device disclosure | **FAIL B4-L1** | BROWSER: only `In My Lending / Status / Remove`, no device/local meaning |
| Keyboard/focus/layout 1440/390/320 | PASS component scope | BROWSER before and after reload, screenshot inspected; full application CSS NOT RUN |
| Parent sync/Project/Watch/signup | None observed | Guest cloud spy empty; exercised path contains no parent/Project/Watch/signup operation. Existing FinancePlan is not a parent Project. |
| Real authenticated cloud failure/RLS/identity journey | NOT RUN | No verified isolated backend; do not equate mock outcomes with real provider coverage |

## Returned defects

[B4-L1 / B4-L2 report](https://github.com/savitz25/Lender-Trust-Hub/pull/52#issuecomment-5744274016).

L1: fresh guest → Save fixture lender → reload → retained record but no persistent local disclosure. Repair must distinguish local/user-cache/actual legacy account confirmation and never claim parent My TrustHub.

L2: actual `pushMyLendingWorkspace('owner-a')` dispatches upsert; hold mocked response; set active storage owner to B; resolve original response successfully. Expected skipped/stale result; observed `ok`. Original write remains `user_id=owner-a`; this is **not demonstrated cross-owner database access**, but stale completion must not be consumed as current-owner sync confirmation. Reproduction: set `LENDER_REVIEW_ROOT` to this immutable checkout and run Ask `node --test scripts/qa-v2-3c-lender-sync.test.mjs`. It intentionally fails at this head and is not in Ask's normal contract CI.

Code review also notes provider registration labels scheduled pushes `synced` before durable completion. This is not independent proof of a production cloud-success UI claim; Builder 3 should preserve truthful acknowledgment while repairing L2. No new runtime fix is made here.

Production mutations **NONE**. Await narrow repairs/new immutable head for re-QA; no indefinite polling.
