# V2-0: public-account founder decision packet (Builder 4)

Evidence cutoff: 2026-09-19 15:56 UTC. Documentation only; no activation authority.

| Verdict | Result |
| --- | --- |
| V2-0 DECISION PACKET | READY for a bounded founder decision, not launch certification |
| V2-1 INDEPENDENT QA | PENDING — PENDING_BUILD_3_PREVIEW |
| V2-2 IMPLEMENTATION AUTHORIZATION | PENDING FOUNDER DECISION |
| PUBLIC ACTIVATION | NOT PERFORMED |
| NETWORK-WIDE V2 | NOT YET CERTIFIED |

## 1. Decision and release boundary

**Proposed:** GO for a separately authorized V2-2 code-preparation PR and isolated QA; HOLD open public signup and production account changes. The founder must choose the release access mode: keep existing internal access, approve a bounded invitation pilot, or authorize public registration after the gates below. This packet does not select or activate that mode.

The agreed target is one parent identity, email/password creation with initial email verification, returning-user sign-in, persistent sessions, recovery, and optional magic link. Existing parent users retain their identity and research. Passkeys/social login are not release blockers. Guest research, optional Projects, cross-device continuation, verified legacy linking, real tool-state persistence, and separate capability-gated Watches remain Consumer V2 requirements, not claims of implementation.

| Release increment | What it enables | Immediate specialist effect |
| --- | --- | --- |
| Code preparation — proposed | Reviewed inactive account UI/actions, admission separation, continuation validation and tests | None |
| Approved internal/invitation access — proposed | Explicitly eligible users use the prepared account path; admission stays closed to everyone else | None unless a separately reviewed adapter is already connected |
| Existing-user sign-in — proposed | Eligible existing parent users sign in even while new registration is closed | Does not import specialist accounts or research |
| Open signup — proposed, separate production gate | New verified parent accounts on Ask after app and provider controls agree | Does not turn six hub Save buttons into parent Saves |
| Specialist Save integration — proposed V2-3 | Reviewed hub-specific identity bindings, explicit transfer/import and return to task | Each hub requires its own adapter and certification |

Ask routes in the proposed V2-2 scope: `/my`, `/my/sign-in`, `/auth/callback`, existing `/my/you`, `/my/saved` import handling, and new `/my/create-account`, `/my/recover`, `/my/reset-password` routes (final names subject to implementation review). `/my/projects` retains current authorization and optional assignment; `/my-trust-journey` remains a separate metadata/journey surface, not silently repurposed as signup. No specialist runtime changes in V2-2 under this packet.

## 2. Exact baseline and evidence discipline

**Verified configuration:** fetched Ask `origin/main` and independently rechecked GitHub main at `4831532ac799077c6963c7ad54b1562ec5409167`. Own clean worktree/branch: `mth-v2-0-account-gate-b4`, based on that SHA. No preexisting work overwritten.

**Verified configuration:** Vercel lookup of `asktrusthub.com` resolved production deployment `dpl_842RPnBA68E5yXZgDC2JNDcjbxjg`, READY, Git main SHA `4831532ac799077c6963c7ad54b1562ec5409167`; immutable deployment host `conumers-trust-pbutopyly-savitz25-s-projects.vercel.app`. Aliases include `www.asktrusthub.com`, `asktrusthub.com`, `consumerstrusthub.com`, and `www.consumerstrusthub.com`. GitHub deployment `6534982900`, created `2026-09-19T00:07:19Z`, also reports success for that revision. This is the actual active revision, not a September 10/17 snapshot.

Evidence labels used throughout:

- **Observed in deployed behavior:** unauthenticated HTTP GET only, no form submission or authenticated browser.
- **Verified in deployed-revision code:** source at the exact active SHA; proves implementation, not successful live end-to-end execution.
- **Verified configuration:** deployment metadata or explicitly identified read-only aggregate state; not inferred environment values.
- **Historical report only:** prior certification/user handoff, not rerun here.
- **Proposed:** required next work or recommended target, not performed.
- **NOT VERIFIED:** exact evidence still missing.

All source paths below refer to the [pinned deployed revision](https://github.com/savitz25/Conumers-Trust-Hub/tree/4831532ac799077c6963c7ad54b1562ec5409167), not a moving branch. No credentials, allowlist contents, private customer records, cookies, or authentication URLs were collected into this packet.

## 3. Current route, admission and authentication findings

| ID | Classification | Finding and exact source |
| --- | --- | --- |
| A01 | Observed in deployed behavior | GET `/my` returns 200 with sign-in; `/my/sign-in` returns 200 with approved-internal-canary/public-signup-disabled copy and Email me a sign-in link. GET `/my/saved` and `/my/projects` each ends at `/my/sign-in` (final 200). No login attempted. |
| A02 | Observed in deployed behavior | GET `/my-trust-journey` returns 200 as a metadata surface. No account-creation flow was exercised. |
| A03 | Verified in deployed-revision code | `lib/my-trusthub/feature-flags.ts`: all listed feature flags default false; subordinate flags require master. `canary-access.ts`: `MY_TRUSTHUB_CANARY_ONLY` defaults true unless explicitly false. Defaults are NOT verified production values. |
| A04 | Verified in deployed-revision code | Canary access requires trusted `app_metadata.my_trusthub_canary === true` AND an approved user ID or email; public mode removes this canary restriction. `canary-access.ts`, `production-adapter.ts:getUser`, `lib/supabase/middleware.ts`. Never migrate this entitlement into user-editable metadata. |
| A05 | Verified in deployed-revision code | `app/my/actions.ts:requestMagicLinkAction` rejects a non-allowlisted email in canary mode before provider submission. In public mode, `!MY_TRUSTHUB_SIGNUP_ENABLED` also returns before provider submission, so it suppresses existing-user login requests, not just signup. Canary email-request admission also differs from ID-or-email session admission: ID-only eligibility may still fail the email request gate. |
| A06 | Verified in deployed-revision code | Both blocked cases redirect with `sent=1`; `app/my/sign-in/page.tsx` unconditionally says Check your email for a secure sign-in link. No email was sent on those branches. Replace with accurate generic copy, e.g. “If this address is eligible, we'll email a sign-in link.” Do not expose whether an account exists. |
| A07 | Verified in deployed-revision code | Only magic-link request/sign-out and callback exchange are present in the inspected parent account routes/actions. No parent password signup, password login, password setup or recovery UI/action was found. Provider capability alone is not implementation. `app/my/sign-in/page.tsx`, `app/my/actions.ts`, `app/auth/callback/route.ts`. |
| A08 | Verified in deployed-revision code | Magic-link redirect origin uses `NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"` without production validation and hardcodes callback continuation to `/my`. This is a latent code fallback, NOT an observed production localhost redirect and NOT a diagnosis of Lender. |
| A09 | Verified in deployed-revision code | `proxy.ts` redirects `/my*` and `/auth/*` from noncanonical hosts to HTTPS `www.asktrusthub.com`, including preview/local hosts. `p13-runtime.ts` also pins this Ask origin. Production alias consistency exists in code, but isolated preview auth must not silently hop to production. Exact provider redirect allowlist remains NOT VERIFIED. |
| A10 | Verified in deployed-revision code | Callback `safeNext` only tests exact `/my` or `/my/` prefix. Local URL-semantics reproduction showed `/my/../../ask` and `/my/%2e%2e/ask` normalize to `/ask`; `//evil.example` falls back to `/my`. This is a within-origin destination-validation gap, not evidence of arbitrary external redirect. Normalize then allowlist route/destination, including encoded traversal and backslash cases. |
| A11 | Verified in deployed-revision code | `lib/supabase/server.ts` and middleware use SSR cookie get/set and `auth.getUser()`; callback exchanges code then validates user and entitlement. Middleware signs out ineligible sessions. Successful production persistence across reload, return visits and a second device, cookie attributes in practice and provider session lifetimes are NOT VERIFIED here. |
| A12 | Verified in deployed-revision code | `turnstile-field.tsx` renders only with a site key, writes a hidden `captchaToken`, clears it on expiry/error; magic-link action rejects missing token only when the public site key exists and passes token to Auth. Invalid token/provider enforcement, provider CAPTCHA setting, site hostname coverage and configured key presence are NOT VERIFIED. |
| A13 | Verified in deployed-revision code | Magic-link form emits `account_signup_started`; instrumentation explicitly calls it a pre-existing name for sign-in-link intent. Latest main adds bounded continuation/save outcomes and auth-URL privacy. Preserve that work; add separate signup/login intent and authenticated success semantics, not fabricated signup success. Sources: `components/analytics/analytics-form.tsx`, `ask-instrumentation.tsx`, `lib/analytics/my-trusthub-contract.ts`, `trusthub-events.ts`. |
| A14 | Verified in deployed-revision code | `page-data.ts` gates master and validates user for Saved/Projects. Projects are optional. Sign-out exists in `actions.ts`. No authenticated workspace operation was executed here. |

**NOT VERIFIED — bounded missing configuration evidence:** deployed server/public flag values by environment; actual `NEXT_PUBLIC_SITE_URL`; Auth Site URL and redirect allowlist; provider signup switch and confirmation policy; password policy; recovery/confirmation templates and PKCE compatibility; SMTP sender/delivery/rate-limit settings; CAPTCHA enabled/provider/hostname alignment (never secret values); session expiry/inactivity/refresh settings. Vercel project-detail connector rejected its argument mapping; deployment lookup worked, but did not expose these values. Available Supabase project/SQL access identified the parent project but did not expose Auth configuration. No environment files were dumped or alternative credentials hunted.

## 4. Watch/Alert discrepancy — do not toggle

**Historical report only:** September 19 handoff says OFF; earlier reporting describes limited founder monitoring. September 9 Stage 2/3 certifications record zero Watches then, and later-stage code exists now. Those statements are not interchangeable snapshots.

**Verified configuration (read-only persisted-state aggregate, not feature flags):** parent Supabase project identity matched the hostname pinned by `runtime-config.ts`. Exactly these SELECTs were executed; no IDs, owners, addresses or content were selected:

```sql
select status, count(*)::int as watch_count
from consumer.consumer_watches group by status order by status;
-- active: 1

select (select count(*)::int from consumer.consumer_alerts) as alert_count,
       (select count(*)::int from ops.consumer_alert_deliveries) as delivery_count;
-- alert_count: 0; delivery_count: 0
```

**NOT VERIFIED:** whether that stored active Watch is currently processed, or whether runtime Watch/Alerts/email/source-monitoring flags are enabled. Zero delivery rows does not prove every outbound transport is off. No poller, cron, handoff GET, worker or mutation endpoint was probed. No state or setting changed. Obtain current nonsecret controls from the authorized operator before any later release; retain Watch data and keep this discrepancy outside V2-2 remediation.

## 5. Minimum proposed V2-2 code delta

All rows are **proposed**, not implemented in this documentation branch.

| Required work | Minimum files/components/contracts | Acceptance boundary |
| --- | --- | --- |
| Account entry and password flow | `app/my/page.tsx`, `app/my/sign-in/page.tsx`, new create-account/recover/reset-password routes, `app/my/you/page.tsx`, `app/my/actions.ts` | Create account / Already have an account? Sign in; verified signup, password login, generic recovery, authenticated password setup. Retain optional magic link. No duplicate parent account. |
| Independent admission vs registration | `lib/my-trusthub/canary-access.ts`, `feature-flags.ts`, action gates and tests | Existing eligible users can request login when registration is closed (`shouldCreateUser:false` for optional magic link). Invitation eligibility is trusted server-side and consistent with session eligibility. Do not silently bypass canary with a single toggle. |
| Safe origin/callback/continuation | `runtime-config.ts`, `proxy.ts`, `app/auth/callback/route.ts`, actions, bounded continuation helper/tests | Production missing/invalid canonical origin fails closed, never localhost. Explicit approved nonproduction origin/backend pair; no production redirect during isolated QA. Normalize and allowlist return destinations. No tokens/research in return URLs. |
| Persistent authenticated session and recovery | Existing SSR `server.ts`/`middleware.ts` plus flow-specific tests; change only if validation finds a gap | Confirm getUser validation, refresh/cookie propagation, sign-out and recovery. Password reset requires verified session/recovery exchange, not merely a query flag. Existing parent user sets password via authenticated update of the same user; never call signup as a conversion step. |
| CAPTCHA and non-enumerating errors | `turnstile-field.tsx`, new/existing account actions and error copy | All applicable public Auth actions pass provider token, handle missing/invalid/expired challenge, reset after consumption/error. Internal bounded diagnostics distinguish admission block, rate limit, provider failure and acceptance without email/token/provider raw payloads. |
| Preserve selected guest research | `guest-restore.tsx`, `guest-session-restore.tsx`, import actions/receipt contract | Existing effect clears the entire origin-local bundle when a query-derived completion flag is true. Preserve unselected, invalid and failed items; retire only server-acknowledged selected items after successful durable import. A forged success URL cannot erase research. Retain idempotency across retries. No automatic import or Watch. |
| Accurate analytics | Existing analytics form/instrumentation/event contracts and their tests | Separate signup intent, login intent, verified auth completion and successful Save. Preserve current bounded metadata and auth-URL redaction; an intent is not a completed account or Save. |
| Regression coverage and operator procedure | Account/admission/origin/import tests and release docs | Matrix below, existing identity/RLS controls, reviewed immutable isolated preview; do not rewrite old assertions just to show green. |

Optional enhancement, **proposed:** account copy polish beyond the agreed flow, extra diagnostics dashboards, optional magic-link UX refinement. Not a new social/passkey requirement or broad authentication rewrite. No schema migration assumed necessary; if implementation discovers one, return for separate scoped approval. Six hub adapters, new calculator schemas and verified legacy migrations stay V2-3/later.

Provider APIs supporting the proposed flow are documented in [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords) and [Auth CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha). Use `signUp` only for genuinely new accounts, `signInWithPassword` for returning users, recovery followed by authenticated `updateUser` for password establishment on the same parent identity. Documentation is not proof of configured production behavior.

## 6. Proposed configuration delta and exact reversals

All targets are **proposed**. “NOT VERIFIED” means no direct current-setting evidence. Before an approved change, record exact current nonsecret values and environment/deployment IDs in an operator-controlled change record. Do not use stale backups as a configuration snapshot.

For Vercel environment changes, a new deployment is required for an existing deployment to use changed values; public build-time values must be rebuilt. No redeployment was performed. Auth management settings generally apply at the provider; exact propagation must be confirmed during authorized staging, not assumed to share the Vercel deployment boundary.

| System / variable or setting | Observed current state | Proposed target / purpose | Effect | Approval | Exact reversal |
| --- | --- | --- | --- | --- | --- |
| Vercel `MY_TRUSTHUB_ENABLED` | NOT VERIFIED value; `/my` is observed available | Preserve working access; reserve false for master emergency closure | New deployment; code gates workspace/callback, not global Auth outage | Separate production/emergency authorization | Restore recorded value on a reviewed compatible revision; do not delete accounts/research |
| Vercel `MY_TRUSTHUB_SIGNUP_ENABLED` | NOT VERIFIED value; UI says signup disabled | False through preparation/pilot as applicable; true only for approved registrations after login split | New deployment | Founder registration approval | False to stop new app registrations while revised existing-user login remains available |
| Vercel `MY_TRUSTHUB_CANARY_ONLY` | NOT VERIFIED value; canary copy observed | Preserve until access-mode decision; public mode only with reviewed entitlement transition | New deployment; middleware can sign out excluded users | Founder admission decision | Restore recorded pilot policy deliberately; warn that restricting access excludes nonpilot users, unlike signup shutdown |
| Vercel `MY_TRUSTHUB_CANARY_EMAILS`, `MY_TRUSTHUB_CANARY_USER_IDS`; Auth trusted canary claim | NOT VERIFIED membership/settings; contents intentionally not collected | Preserve existing eligible subjects; approved pilot enrollment requires trusted assignment, not user metadata | Env lists require deployment; claim timing/session behavior must be tested | Approved identities/operator only | Restore approved policy record, never bulk erase identities; revalidate eligible login |
| Vercel `NEXT_PUBLIC_SITE_URL` | NOT VERIFIED; code has localhost fallback | Production `https://www.asktrusthub.com`; separately approved isolated preview canonical origin | Rebuild/deployment | Release/config approval | Restore exact previously verified safe origin, never intentionally restore production localhost fallback |
| Vercel `NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL`, `NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_PUBLISHABLE_KEY` | NOT VERIFIED deployed values; code pins parent project hostname | Retain same production parent project; existing approved isolated environment needed for preview | Rebuild; current hostname pin needs explicit environment-aware validation to permit isolated QA | Release approval; no new service accounts/credentials under V2-0 | Restore recorded project binding/config on compatible code; never point production at a test DB |
| Supabase Auth Allow new users to sign up | NOT VERIFIED | Closed until explicit registration gate; existing sign-in remains supported | Provider setting; propagation NOT VERIFIED | Separate founder/authorized operator approval | Disable new signup, then verify returning-user login without creating a user |
| Supabase Auth email confirmation, email/password provider, password policy | NOT VERIFIED | Initial email verification required; agreed email/password flow; preserve same parent IDs | Provider setting/templates; staging verification needed | Auth settings authorization | Restore recorded secure settings; do not disable verification as rollback or recreate users |
| Supabase Auth Site URL / Redirect URLs / email templates | NOT VERIFIED | Exact canonical production callback/recovery destinations; narrowly approved isolated QA destinations; no broad wildcard/localhost in production | Provider setting; templates must match reviewed exchange flow | Auth settings authorization | Restore exact verified safe allowlist/template versions; close newly added QA destinations when retired |
| Supabase Auth CAPTCHA provider/enabled; Vercel `NEXT_PUBLIC_MY_TRUSTHUB_TURNSTILE_SITE_KEY`; approved widget hostnames | NOT VERIFIED | Matching provider and frontend configured and human-tested before public access; no secret values in packet | Provider + rebuilt frontend; not a one-flag release | Auth/config approval | Keep registration closed if challenge breaks; restore matched prior safe pair, not bypass protection |
| Supabase Auth SMTP/sender/rate limits and session lifetime/refresh controls | NOT VERIFIED | Verify existing approved transport/recovery delivery and persistent sessions; do not purchase/change transport by assumption | Provider behavior; propagation/session policy NOT VERIFIED | Separate operator approval if a change is needed | Restore recorded policy; preserve sessions unless deliberate emergency revocation authorized |
| Vercel `MY_TRUSTHUB_SAVED_ENABLED`, `MY_TRUSTHUB_PROJECTS_ENABLED`, `MY_TRUSTHUB_SESSIONS_ENABLED` | NOT VERIFIED values | Preserve approved existing workspace behavior; no new tool schemas | New deployment if changed | Separate scope approval for changes | Restore recorded values without deleting Saved/Project/session records |
| Vercel `MY_TRUSTHUB_SPECIALIST_HANDOFF_ENABLED` | NOT VERIFIED | No expansion under V2-2; V2-3 certifies each adapter | New deployment if approved later | Separate specialist integration gate | Restore recorded setting, retain local research and unfinished intents |
| Vercel `MY_TRUSTHUB_WATCH_ENABLED`, `MY_TRUSTHUB_ALERTS_ENABLED`, `MY_TRUSTHUB_EMAIL_ENABLED`, `MY_TRUSTHUB_SOURCE_MONITORING_ENABLED` | NOT VERIFIED; one persisted active Watch, zero Alerts/deliveries | No change under this ticket; reconcile nonsecret state with authorized owner | New deployment if changed later; worker/transport controls separate | Separate monitoring/emergency authorization | Restore exact recorded controls, preserve Watch history; stopping notifications is not signup shutdown |
| Vercel `MY_TRUSTHUB_EXPORT_ENABLED`, `MY_TRUSTHUB_DELETE_ENABLED` | NOT VERIFIED | Preserve current policy; no expansion in this packet | New deployment if changed later | Separate approval | Restore recorded flags; no export/delete invoked here |

## 7. Guest-to-parent continuation contract

**Proposed sequence:** specialist profile → specialist-origin local intent/research → allowed account entry → verified parent session → explicit selected import/Save → `/my/saved` or the validated originating task. Project assignment is optional and never creates a Watch.

| Segment | Evidence / current limitation | Ownership |
| --- | --- | --- |
| A. Guest starts on specialist profile | Historical report only: Lender/Senior Save passed specific local surfaces; Move has separate deferred Save defect. Not proof of parent Save. | Move fix V2-1; other hubs separately certified |
| B. Useful guest research retained | Verified in deployed-revision code: Ask restore reads `mytrusthub:guest-research:v1` and `mytrusthub:guest-sessions:v1` on Ask origin. No producer for the research key was found in inspected Ask app/lib/components. Specialist localStorage is a different origin and cannot be read directly by Ask. | Preserve existing local work; transfer producer/adapter V2-3 |
| C/D. New account verifies / returning account signs in | Verified in deployed-revision code: current optional-link infrastructure only; agreed password flow missing. Live completion NOT VERIFIED. | V2-2 |
| E. Existing users while signup paused | Verified in deployed-revision code: public-mode link gate conflates login and signup; must split. | V2-2 |
| F. Sessions/sign-out/recovery | Verified in deployed-revision code: SSR refresh/sign-out exist; recovery flow missing, persistence not live-certified here. | V2-2 |
| G. Safe return to task | Verified in deployed-revision code: action hardcodes `/my`; already-signed-in sign-in redirects `/my`; callback prefix check is insufficient. Contractor `handoff/prepare` consumes a start cookie before redirecting guest to `?continue=save`, which records a reason, not resumable originating record state. Do not run these GET routes as harmless probes: prepare/finish can write. | V2-2 validates parent continuation interface; actual specialist issuance/resume V2-3 |
| H. Explicit preview/import | Verified in deployed-revision code: preview/commit RPC adapters, item selection, optional Project, idempotency key and 256KiB research limit exist. Whole-bundle cleanup issue exists in both restore components. Live selected retry/data preservation NOT VERIFIED. | V2-2 parent safety fix; V2-3 cross-origin delivery |
| I. Existing parent password setup | Proposed authenticated password update on existing parent subject after verified ownership. No duplicate signup, no email-only identity merge; legacy subjects require controlled verified mappings. | V2-2 same-parent setup; legacy linking V2-3/later |
| J. Hub Save → parent Saved | Verified in deployed-revision code: P13 Contractor-only runtime paths and scoped broker contract exist; cross-hub contract declares service identity, hub scope, user assertion, short-lived one-use opaque handoff and binding identity. Not proof of live six-hub integration; Contractor incident is out of scope. | V2-3 per hub; no Contractor repair here |

Required continuation invariants, **proposed**, building on `cross-hub-contract.ts`, `cross-hub-security.mjs`, `p13-runtime.ts` and the [identity control-plane contract](../../my-trusthub-control-plane.md): preserve exact hub/entity binding; reject stale, replayed or wrong-audience intent; transfer through reviewed bounded body/server-side context, not raw research, notes, credentials or session tokens in URLs; retain local research until durable acknowledgment; explicitly preview selected imports; use parent subject ID, never email as authorization key. Returning to another device requires server-side verified continuation, not a claim that localStorage synchronizes. Business/specialist roles never confer consumer workspace ownership.

**Historical report only:** [Stage 2](../../my-trusthub-stage-2.md) reported private-workspace/RLS and duplicate import certification; [Stage 3](../../my-trusthub-stage-3.md) reported a narrow `move.inventory/v1` parent form and explicitly unavailable cross-hub resume. Neither certifies all live Move calculators, comparisons, planners, inventories, or six-hub cross-device persistence. The older [public launch runbook](../../my-trusthub-public-launch-runbook.md) is not an executable authorization: its coupled signup toggles predate this password/continuation gap analysis and its Watch/transport steps are outside this ticket.

## 8. Staged launch and rollback proposal

Every step is **proposed** and requires its applicable approval. No blind toggle/redeploy sequence.

1. Founder chooses access mode and authorizes bounded V2-2 implementation only. Record exact current code/config, trusted admission semantics and existing parent identity preservation before changes. Resolve missing configuration evidence through the authorized operator, not a credential hunt.
2. Implement and review behind closed registration. Tests must prove independent existing-user access, safe origins, verified password setup, CAPTCHA and import preservation. Keep Watch/Alert settings and specialist code unchanged.
3. Verify an existing isolated nonproduction backend and immutable preview revision before any Auth write. Current parent-project pin and canonical redirect must not route QA to production. If isolation is unavailable, finish local tests and HOLD live tests.
4. With approved identity/inbox and human CAPTCHA/email work, execute the matrix. Record exact access mode, code, deployment, backend class and failures. Validate returning users with signup paused before approving new registration.
5. Separate production authorization specifies exact release SHA, config delta, operator, pilot/public scope and rollback thresholds. Deploy approved code while registration remains closed; validate effective deployment/config. No invitation or public account activation is implied by merging code.
6. Only after approval and verified app/provider controls, enable the selected registration mode. Perform approved live tests and confirm existing-user login, verification, recovery, Saved isolation and no false cloud claims. Opening Ask does not open specialist Save integration.
7. Stop on origin mismatch, account duplication, private-data exposure, inaccurate admission messaging, CAPTCHA failure or lost research. Prefer shutting new registrations first while preserving eligible login. Do not revert to a known-broken admission implementation merely because it is an older deployment.

Distinct rollback controls:

- **Stop new registrations:** close app registration and provider new-user creation on the corrected implementation; retain eligible existing-user login and workspace. Test that distinction with approved users.
- **Restrict access to pilot:** separate deliberate entitlement restriction. May exclude newly registered nonpilot users and sign out sessions; founder must approve that impact. It is not a harmless signup rollback.
- **Stop outbound notifications:** separate notification flag/worker/transport operation by the authorized monitoring owner, not a V2-2 signup step. Preserve queues and Watch state; Auth verification/recovery mail is a separate transport/control concern.
- **Master emergency closure:** workspace master false on a reviewed deployment closes guarded workspace/callback. It is not a global Supabase Auth shutdown or guaranteed worker stop; emergency auth/worker actions require explicit separate authority. Preserve data and document recovery prerequisites.
- **Code rollback:** select a verified compatible revision/config pair preserving new account identity and data. Use reviewed revert/fix-forward and regression checks; no force reset, stale snapshot restore, schema/data rollback or deletion.

## 9. Next-account QA matrix (prepared, not live executed)

Labels classify the best current evidence, not a PASS. All live mutations require explicit approval. Historical evidence remains historical.

| Test | Classification | Required assertion / limitation |
| --- | --- | --- |
| Guest Save/Compare without account | EXISTING EVIDENCE | Historical Lender/Senior local reports only; Move pending; each first-wave surface must be independently tested |
| Local Save labeled local | LOCALLY TESTABLE | Stored device state and UI must not claim parent/cloud persistence |
| New non-canary account creates and verifies | NOT YET IMPLEMENTED | Prepared password signup + human email confirmation; then approved live test |
| Returning password account signs in | NOT YET IMPLEMENTED | Password path absent; optional current magic-link completion requires approved live test |
| Existing-user access with signup paused | LOCALLY TESTABLE | Reproduce gate bug now; require corrected gate unit tests and approved live no-new-user proof |
| Missing/invalid/expired CAPTCHA | LOCALLY TESTABLE | Component/action mocks plus approved live provider enforcement; no production token submission here |
| Verification/recovery errors useful, non-enumerating | NOT YET IMPLEMENTED | Recovery absent; generic public response, bounded internal categories, no existence disclosure |
| Production origin/callback never localhost | LOCALLY TESTABLE | Current fallback exists; test missing/invalid env, canonical aliases, preview isolation and allowed callback paths |
| Persistent session across reload/ordinary return | REQUIRES APPROVED LIVE TEST | SSR code exists; actual cookie/session behavior not executed |
| Allowed return-to-task | LOCALLY TESTABLE | Test encoded traversal, external targets, expiry/replay, task identity and default safe destination |
| Selected import idempotent/preserves research | LOCALLY TESTABLE | Test duplicate retry, partial selection, invalid item, failure and forged success URL; historical RPC proof is not current UI proof |
| Save/import/Project creates no Watch | EXISTING EVIDENCE | Historical Stage 2/3 and separate action code; rerun in approved isolated environment |
| Consumer B cannot read Consumer A | EXISTING EVIDENCE | Historical RLS certification only; require independent approved identities and current regression |
| Business/specialist permission gives no workspace access | EXISTING EVIDENCE | Historical authorization proof only; recheck current scoped behavior |
| Password/optional link same parent identity | NOT YET IMPLEMENTED | Setup/login must preserve existing subject ID and all research; no email-only legacy merge |
| 1440/390/320, keyboard/focus/mobile | REQUIRES APPROVED LIVE TEST | Historical workspace layout report; new account UI not built or independently tested |
| Analytics signup/login/successful Save distinct | LOCALLY TESTABLE | Preserve current privacy/outcomes; current sign-in intent misnamed signup; test no PII/auth URL leakage |
| Exact revision/access mode recorded | EXISTING EVIDENCE | Current deployment SHA recorded; direct env values NOT VERIFIED; every future test must record both |

### Checks actually executed in this ticket

- Unauthenticated HTTP GET observations: five routes in section 3, all successful final responses; Saved/Projects redirect to sign-in. No browser rendering, screenshots, keyboard or viewport certification claimed.
- Vercel/GitHub deployment and main metadata: successful exact revision verification.
- Two parent read-only aggregate SELECTs: successful; results in section 4. No stored function/mutation executed.
- Local Node URL-semantics check: executed successfully after correcting a PowerShell quoting error in the initial invocation; results in A10. It reproduces URL normalization, not a complete callback test.
- `npm run check:my-trusthub-stage-2`: **FAIL** at `Watch and Alerts stay out of navigation`. Main now has feature-gated Watch/Alerts navigation. Following prep command did not run due to `&&`.
- `npm run check:my-trusthub-stage-3`: **FAIL overall**. Stage 3 assertions **15/15 PASS**, P18 static contract **PASS**, then prep **FAIL** at `forbidden Stage 1 route present: app/my/watches`. These failures existed on the untouched deployed-revision source. No assertion was changed to make a gate green.
- Full application suite, build, authenticated tests, production forms/email/recovery, cross-device and independent Move browser QA: **NOT RUN**. This documentation-only packet does not claim them passed or initiate an automatic deployment.

## 10. Human dependencies (listed once)

1. Founder access-mode decision and separate V2-2 implementation / production activation authorizations.
2. Approved non-founder test identity and controlled inbox, with a second isolated identity for ownership-negative tests; no signup executed by this ticket.
3. Approved browser/device availability for 1440/390/320, keyboard and cross-device tests in verified nonproduction.
4. Human CAPTCHA completion and email verification/recovery ownership; never paste passwords, keys or magic links into chat.
5. Authorized operator access to the exact missing nonsecret configuration in section 3 and an existing safe nonproduction Auth environment; current connected read tools do not supply those settings. No new credentials, purchases or permission grants requested.

## 11. Builder 3 independent Move QA handoff

**PENDING_BUILD_3_PREVIEW.** Bounded published-open-PR checks, including a final V2-1 search, of `savitz25/Move-trust-Hub` found no V2-1 Builder 3 PR. Read-only status of existing `mth-v2-1-move-save-b3` worktree showed uncommitted Save implementation/tests based on `5018639dee0901bbc630cafdd633015421f86e00`; that base is NOT a reviewed patch head. Those files were not edited, staged, rebased or tested by Builder 4. No competing implementation created.

| Required handoff | Status |
| --- | --- |
| Builder 3 PR / exact patch head | NOT AVAILABLE at bounded check |
| Immutable preview URL / serving commit | NOT AVAILABLE |
| Backend classification | NOT VERIFIED; do not assume preview means isolated |
| Reproduction steps | NOT AVAILABLE as a published reviewed handoff |

| QA | Independent result |
| --- | --- |
| QA-01 fresh-context early Save before former deferral | NOT RUN — pending immutable preview |
| QA-02 exactly one local entry survives reload | NOT RUN |
| QA-03 rapid duplicate activation | NOT RUN |
| QA-04 delayed loading/no disabled or silent action | NOT RUN |
| QA-05 navigation retains exact record identity | NOT RUN |
| QA-06 keyboard/focus/status at 1440/390/320 | NOT RUN |
| QA-07 honest local persistence/no signup bypass/Watch/account creation | NOT RUN |
| QA-08 authenticated safe nonproduction behavior | NOT RUN — no verified safe environment |

No independently verified Move defect or PASS is claimed. Once published, obtain PR/head/immutable deployment/reproduction from Builder 3's PR, verify preview serves that commit and identify backend before testing. Safe guest-only local-storage writes are allowed; never exercise a cloud/account write on a production backend. Report defects as steps → expected → observed → environment → exact SHA to Builder 3, do not fix in their worktree; re-test an immutable corrected preview. Create `V2-1-independent-qa.md` only when QA is actually performed. No indefinite polling required to finish V2-0.

## 12. Handoff and smallest next authorization

**Proposed:** founder authorizes a V2-2 documentation-scoped implementation plan to become one bounded runtime PR implementing section 5, with approved nonproduction QA. This is distinct from permission to merge, configure Auth, deploy production or activate signup. Public activation remains HOLD until configuration evidence and the account matrix pass under the chosen admission mode.

The documentation PR changes only this packet and `artifacts/my-trusthub/v2/v2-0-readiness.json`. No runtime code, tests, migrations, datasets, settings, dependencies or other builders' files changed. No Lender/Contractor/search remediation or full-network reaudit. Vercel/Supabase guidance informed the separation of deployment/config evidence and identity/session test gates; it did not authorize mutations.

**Production mutations performed: NONE.** Source-control documentation commit/PR is the only intended external write. Any automatically created docs-branch CI/preview is not a production release or customer-journey certification. Rollback for this documentation change is a normal reviewed revert of the documentation commit; no reset, force push or data rollback.
