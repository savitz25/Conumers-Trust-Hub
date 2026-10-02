# Insurance V2-1 independent QA — V2-3C / Builder 4

Exact head `426ad49b91d0fdc65b54e4ce515c45c7732910a5`, PR #55. Date 2026-09-19. Verdict **FAIL B4-I1**. No Insurance files changed.

Read and ran exact-head `scripts/qa-v2-save.mjs` (127.0.0.1:4312), `test-v2-save-browser.mjs`, and `npm.cmd run check:v2-save`. Added independent Ask-side assertions (`scripts/qa-v2-3c-independent.mjs`), rather than relying on the builder report. Actual control/storage; Auth context and server actions mocked. No production URLs, forms, login emails, account/DB writes or environment changes.

| Check | Result | Evidence |
| --- | --- | --- |
| Immediate keyboard Save, actual write, exact slug, duplicate persistence effects | PASS | BROWSER real control/store |
| Auth loading | PASS for device contract | BROWSER + MOCKED context: local write is permitted explicitly regardless of unresolved auth; no guest assertion, cloud call or replay into later user |
| Focused storage/action regressions | PASS, 5 tests | LOCAL INTEGRATION; verified-owner server action MOCKED |
| Reload retains record | PASS | BROWSER |
| Reload retains device/local disclosure | **FAIL B4-I1** | BROWSER: only `In My Insurance` and `shortlisted`; no persistent device status/name |
| Cloud failure never claims success | PASS in fixture | MOCKED cloud fails, device row retained, error toast; no success mark event |
| Navigation/owner race | PASS in fixture | MOCKED delayed completion cannot mark replacement profile/account; original slug retained |
| Blocked storage and blocked sessionStorage recovery | PASS | BROWSER; no false success from failed local write |
| Notes/plans/tool snapshots preserved on second profile Save | PASS | Independent BROWSER synthetic seeded normalized state; original record found by slug, not array order |
| Keyboard/focus, 1440/390/320 before and after reload | PASS component scope | BROWSER; screenshots inspected; full application CSS NOT RUN |
| Parent Save/Project/Watch/Alert/signup effects | None observed in local path | Guest cloud spy empty; source review finds no such calls in exercised Save flow. Legacy provider auth-continuity is separate and not parent selected import. |
| Real Auth/provider/RLS and full provider lifecycle | NOT RUN | No verified isolated backend. Mocked context is not real admission/session proof. |

## Returned defect

[B4-I1 report](https://github.com/savitz25/Insurance-trust-hub/pull/55#issuecomment-5744273933).
Steps: fresh guest context → Save fixture provider → successful local write/device toast → reload. Expected: local meaning persists with Saved status and accessible disclosure. Observed: record remains under `ith:my-insurance:v1`, UI says `In My Insurance / shortlisted`, device explanation absent. Initial toast is ephemeral. Request narrow disclosure repair plus regression and new exact head; do not infer cloud state from local presence or use a global device banner on confirmed account Saves.

Independent script exits 1 for this expected unresolved defect; do not describe its whole run as PASS. First two fixture attempts were corrected for record ordering and normalizer-added plan IDs; final preservation checks compare the original item and normalized pre-action snapshot. These were fixture fixes, not relaxed application requirements.

Production mutations **NONE**. No automatic retest of moving branch; wait for a supplied corrected immutable revision.
