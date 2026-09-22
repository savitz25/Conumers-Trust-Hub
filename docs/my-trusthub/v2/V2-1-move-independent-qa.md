# Move V2-1 independent QA — Builder 4

## V2-3C exact-head re-QA: PASS, QA-M9 CLOSED

Tested `35a83ca97f98fb5ee46bb849569808fd5e962a90` on 2026-09-19. Re-ran the committed 12-group browser matrix and new independent assertions in Ask `scripts/qa-v2-3c-independent.mjs`. Guest Save → local status → reload preserves exactly one correct slug and explicit device/unconfirmed-parent disclosure. Button `aria-describedby` points to populated status; icon accessible name says device. Owner-confirmed legacy account context (MOCKED) says Move account shortlist, not device-only and not parent My TrustHub.

Original failure below is historical, superseded by this re-QA. [Finding closure with exact-head evidence](https://github.com/savitz25/Move-trust-Hub/pull/156#issuecomment-5744273847). No Move runtime edits in V2-3C. Existing prior Builder 3 correction is the reviewed implementation, not proof on its own.

Evidence: **BROWSER** actual component/runtime/localStorage; **MOCKED** Auth/cloud/account-context fixtures. Matrix covers immediate/deferred Save, duplicates, delayed Auth/module, failed storage/retry, navigation/account change, failed cloud local retention, keyboard and 1440/390/320. Real authenticated provider/RLS and full deployed page layout remain **NOT RUN**. This PASS is local Save/reload scope, not parent synchronization.

## Historical V2-2R review

Date: 2026-09-19. Reviewed immutable head: `db6d640398ee622d0c3153e968ce14d621ec744a`, PR https://github.com/savitz25/Move-trust-Hub/pull/156.

Verdict: **FAIL QA-M9 (local-only disclosure lost on reload); other executed local checks pass.** Real authenticated Save and full deployed-profile layout remain NOT RUN. This supersedes the earlier protected-preview-only PENDING record for the local component scope, not for a real account journey.

## Isolation and reproducibility

Own detached review worktree: `C:/Users/Michael.Savitsky/mth-v2-2r-move-review-b4`. No Builder 3 source/worktree changes; final Git status clean. Installed the exact lockfile using `npm ci --ignore-scripts --no-audit --no-fund`. No environment files copied, secrets pulled, user accounts created or provider/database endpoints called.

Independently read and executed the committed `scripts/qa-v2-1-save.mjs` and `scripts/test-v2-1-browser.mjs`. The harness bundles the exact real `SaveMoverButton`, deferred context, on-demand runtime and local-storage implementation. Auth, server cloud action and analytics adapter are mocked. The dashboard provider deliberately never resolves. Server binds only `127.0.0.1:4311`, builds assets in memory, and uses no credentials/database. This is **BROWSER LOCAL + MOCKED adapters**, not a production profile or real Auth integration.

Builder 4 also independently activated Save by keyboard, inspected the actual stored slug and cloud-call array, reloaded, inspected the persisted UI/status and took/reviewed empty/private-data-free fixture screenshots at 1440/390/320. The additional reload-disclosure check found a defect absent from Builder 3's passing browser assertions. No teammate PASS summary is being substituted for execution.

## Matrix

| Check | Result | Evidence |
| --- | --- | --- |
| QA-M1 immediate guest Save before deferred provider | PASS | BROWSER LOCAL, real component/runtime, unresolved provider, keyboard activation; test measured 278 ms in this local fixture, not a production benchmark |
| QA-M2 one correct company slug | PASS | BROWSER LOCAL localStorage contains exactly `b3-test-mover`; zero mocked cloud calls for guest |
| QA-M3 same-browser reload persistence | PASS | BROWSER LOCAL, one stored entry and Saved state after reload |
| QA-M4 repeated rapid activation | PASS | BROWSER LOCAL, three activations while Auth resolution delayed; one local entry/analytics effect |
| QA-M5 delayed Auth/module resolution | PASS | BROWSER LOCAL + MOCKED Auth; delayed guest resolution preserves captured intent; 16-second module delay yields visible timeout and no late write |
| QA-M6 storage failure not successful Saved | PASS | BROWSER LOCAL Storage.setItem throws; no entry, visible retry error; retry succeeds after restoring storage |
| QA-M7 navigation/profile identity | PASS | BROWSER LOCAL + MOCKED Auth; replacing profile cancels old operation, no wrong-record write; mocked account-switch case rejects |
| QA-M8 accessibility/status/layout | PARTIAL | BROWSER LOCAL fixture: keyboard activation/focus, busy/pressed/status semantics and no horizontal overflow at 1440/390/320; full production CSS/profile layout NOT RUN; reload status issue below |
| QA-M9 truthful local copy | FAIL after reload | Initial success says saved on this device; reload displays only disabled Saved with empty role=status; no parent persistence confirmed |
| QA-M10 no account/parent/Project/Watch/Alert/ranking effect | PASS within isolated scope | Guest cloud spy remains empty; reviewed actual Save path has no parent/Project/Watch/Alert/ranking operation; no real backend used |

`npm run test:v2-1`: **13 PASS** (local UNIT and MOCKED server-action tests), independently run. Browser runner: all ten grouped assertions PASS. Additional Builder 4 QA-M9 assertion: FAIL. Authenticated cloud case in the runner is explicitly MOCKED; it is not a real authenticated Save PASS.

## Defect returned to Builder 3

[PR finding](https://github.com/savitz25/Move-trust-Hub/pull/156#issuecomment-5743783157).

Steps: fresh guest fixture → activate Save mover → observe device-local success → reload same browser.

Expected: persisted local success still states “Saved on this device,” including an accessible status/name; no implied parent sync.

Observed at exact reviewed head: button text `Saved`, disabled, `aria-pressed=true`, `aria-describedby` targets an empty status. Storage contains one correct slug; `cloud=[]`. Icon variant source also uses unqualified “saved to your shortlist.”

Environment: real Chromium, exact-head component fixture, real localStorage, Auth/cloud mocked, 1440/390/320. No runtime fix made by Builder 4. Retest a corrected immutable Builder 3 head when supplied; do not certify a branch alias without checking its revision.

## Remaining coverage

Protected Vercel preview previously matched this head but could not be reached anonymously. Full deployed page with actual CSS and a verified isolated backend remains unavailable/unverified. Real authenticated Save, session switching against provider, and parent synchronization are NOT RUN. Legacy local Save never implies parent My TrustHub synchronization.

Insurance PR #55 `426ad49b91d0fdc65b54e4ce515c45c7732910a5` and Lender PR #52 `315093be109796c9dd170e80a936ecd10e9cff7d` appeared during this run. Published handoffs/file inventories/CI were read; independent runtime QA is PENDING, not inferred from their reports. No patches to those repositories.

Production mutations: NONE. No merge or deploy performed.
