# V2-2: parent account code preparation

Date: 2026-09-19. Owner: Builder 4. Production release/activation: HOLD.

Follow-up: `V2-2R-account-review.md` supersedes automatic legacy-bundle retirement (local copies now retained), mutable cookie/sign-out failure handling, invitation readiness responses and browser-derived auth-completion telemetry. Original test counts below describe the original V2-2 revision; see `v2-2r-validation.json` for the hardening run.

## Revision and authority

- Repository: `savitz25/Conumers-Trust-Hub`.
- Branch: `mth-v2-2-account-prep-b4`, created from fetched main `4831532ac799077c6963c7ad54b1562ec5409167`.
- Reviewed V2-0 packet: PR #183, exact revision `a5bef3e5692cb08139a9d64c45d69a5c8fb30165`; read without merging it.
- Tested runtime implementation commit: `49ea053b14807a7f4e3839286a04a72f0726a42d`. Subsequent documentation-only commits do not change that runtime.
- This is implementation/code-preparation authorization, not public-signup or production-release approval. No production mutations were performed.
- Current production configuration and active production revision were NOT reverified in this implementation run. Main revision is not a claim about the active deployment.

## What is implemented

The existing parent Supabase identity remains the identity. No new account database, migration, credential store, dependency, identity merge, or specialist account adapter was introduced.

| Area | Implemented behavior | Evidence level |
| --- | --- | --- |
| Registration | Email/password, confirmation instructions, password confirmation/show-hide/autocomplete; independent registration gate and provider-security release attestation; unexpected immediate signup session is rejected and locally signed out | Code + mocked SDK tests; real confirmation NOT RUN |
| Returning users | Password login and optional existing-user-only magic link (`shouldCreateUser: false`); registration OFF does not prohibit admitted existing-user login | Code + mocked SDK tests |
| Admission | Master workspace gate, explicit internal/invitation/public modes, confirmed email, trusted server eligibility; ordinary invitations do not require founder claim | Pure policy tests with ordinary-user fixture |
| Password setup/recovery | Same-subject `updateUser`, verified current user plus signature-verified recent AMR, expected owner, recovery callback exchange; no signup to add a password | Code + mocked SDK tests; provider flow NOT RUN |
| Sessions/switching | Existing SSR cookies/refresh retained; explicit local sign-out before switching; late email callback refuses to replace a current signed-in identity | Code + mocked tests; cross-device/long-lived session NOT RUN |
| Origins | Explicit canonical production origin and unchanged parent backend binding; explicit approved nonproduction origin/backend pair, never parent production backend | Pure tests + source review |
| Return task | Decode/normalize before bounded parent-route allowlist; successful account flow carries allowed task; unsafe/expired callback returns useful sign-in state | Pure tests; no assertion of an external open redirect in the old code |
| Guest import | Explicit review/selection/destination, authorized durable receipts, exact unchanged-item retirement, stable request key, owner check before commit | Pure tests + existing adapter/RLS review; real RPC integration NOT RUN |
| CAPTCHA | Supported SDK token options, unavailable/missing/expired/retry/reset UI; no test bypass | Mocked token/provider cases + missing-configuration browser UI |
| Analytics | Separate signup/login intent, authentication completion, receipt-backed durable Save; no query-derived import success | 54 analytics tests + named V2 suite |

New account pages are `/my/create-account`, `/my/email-link`, `/my/recover`, and `/my/reset-password`. `/my/sign-in`, `/auth/callback`, `/my`, `/my/you`, and `/my/saved` receive focused changes. `/my-trust-journey` is not converted into an account-creation flow.

Password policy in this preparation is 12–128 characters for a new password; existing login passwords are not subjected to the new-password minimum. Public recovery/link responses are generic and truthful even when admission blocks the send. Internal diagnostics contain only operation and bounded outcome (admission blocked, rate limited, provider failure, accepted, configuration missing), never provider messages or identifying/sensitive input.

`flow=password` is a routing hint, not authority. The password action separately verifies the current user, expected subject, and fresh signed authentication method. An arbitrary recovery query flag cannot authorize a password update. A user with an old session must reauthenticate or obtain fresh recovery material.

The supported SDK documents password/confirmation flows, CAPTCHA token options and same-user updates: [password authentication](https://supabase.com/docs/guides/auth/passwords), [CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha), [updateUser](https://supabase.com/docs/reference/javascript/auth-updateuser). Signature validation and authentication-method claims inform the recent-auth boundary: [getClaims](https://supabase.com/docs/reference/javascript/auth-getclaims), [JWT fields](https://supabase.com/docs/guides/auth/jwt-fields). Supabase/Next.js skill guidance informed supported SDK use, SSR cookies and action boundaries; React/browser guidance informed focused UI verification.

## Admission is not registration

1. `MY_TRUSTHUB_ENABLED` controls workspace access; false is the existing master workspace shutdown.
2. Missing `MY_TRUSTHUB_ACCESS_MODE` means restricted internal mode. Unknown values mean closed. The legacy canary toggle alone cannot open public admission.
3. Internal access retains the trusted canary app claim AND server eligibility list; invitation access instead uses server-controlled invited IDs/emails without requiring that founder claim.
4. `MY_TRUSTHUB_SIGNUP_ENABLED` controls new registration independently. Internal mode never registers. Invitation registration requires an approved email; public mode still requires explicit registration and security-ready gates.
5. Existing-user login validates admission after authentication regardless of registration setting. User metadata, query parameters, business roles and client booleans cannot confer admission.

ID-only eligibility cannot be resolved anonymously without an identity lookup. When such an ID list exists, an existing-user-only email request may be attempted; actual verified admission remains exact after exchange. This avoids anonymous membership lookup and never enables automatic signup. No invitation campaign/provisioning system is included.

## Continuation and local-research contract

`specialist local intent → [V2-3 producer/transfer gap] → bounded parent account task → verified parent session → explicit review/selected import → authorized durable receipt → /my/saved or supported originating parent task`

- Existing bounded handoff contracts are retained. This ticket supports allowed parent destinations, not arbitrary cross-domain return URLs or raw research in query strings.
- Ask reads only its own origin's storage. It cannot read Move/Insurance/Lender localStorage. Those producers, transfer/adapters, and all-six-hub persistence/resume are V2-3 or later integration work.
- Selected import shows the destination account. The server compares that expected subject to a fresh verified session before the existing commit RPC. Switching accounts requires a new review, not a silent import into the new owner.
- A query marker cannot erase a bundle or manufacture durable-save analytics. The server reads existing user-authorized item receipts after the commit.
- Only selected items with `imported` receipts and an exact unchanged submitted snapshot are retired. Unselected, invalid, unsupported, failed, new, edited, duplicate-ID, malformed and other-owner items remain. The storage envelope is preserved.
- `duplicate` receipts are deliberately retained locally: an existing saved session can contain older content. Replaying the same request uses the original durable receipt; deterministic owner/payload/selection/project request keys make retry stable.
- Lost response, failed receipt lookup, storage error or connection/session failure preserves local research. There is no distributed transactional guarantee across simultaneous browser tabs; the client rereads current storage immediately before snapshot comparison/retirement.
- No import, Save or Project action starts a Watch. Existing Watch/notification gates were not toggled.
- The existing hardcoded production Contractor handoff broker is additionally disabled outside Vercel production; a local/preview Ask account must not call that production broker. No Contractor runtime was edited.

## Files/contracts changed

- Policy/runtime: `account-policy.ts`, `canary-access.ts`, `runtime-config.ts`, `p13-runtime.ts`, `proxy.ts`.
- Auth actions/SDK boundary: `account-service.ts`, `account-callback.ts`, `app/my/account-actions.ts`, `app/auth/callback/route.ts`, legacy wrappers in `app/my/actions.ts`.
- Account UI: `account-entry.tsx`, `account-form.tsx`, `turnstile-field.tsx`, account route pages, `/my` and `/my/you` links, scoped `my.css`.
- Import: `guest-retirement.ts`, `guest-import.tsx`, restore wrappers, saved page, commit actions and existing production adapter receipt reader.
- Analytics: form/instrumentation, event constants/contract and two forged-completion expectation tests.
- Verification: `v2-2-account.test.ts`, package script, PR-only `my-trusthub-v2-2.yml` workflow, these documentation/evidence records.

No schema, regulatory dataset, search, dependency/lockfile, environment file or Builder 3 runtime changes.

## Configuration release manifest — proposals, not applied settings

All production settings below are **NOT VERIFIED in this run**. Code defaults are not production-value evidence. Existing credentials and eligibility lists must never be copied into this document.

| System / setting | Code/current evidence | Proposed reviewed target | Effect / approval / reversal |
| --- | --- | --- | --- |
| Ask `MY_TRUSTHUB_ENABLED` | Existing master gate; production NOT VERIFIED | Preserve approved current access until separately authorized | Server deploy required; master false closes workspace, not all Auth-provider/worker activity; restore verified prior value for rollback |
| Ask `MY_TRUSTHUB_ACCESS_MODE` | New; missing internal, invalid closed | Internal for first code release; invitation only by separate approval; public later | Server deploy; revert to verified prior internal mode/list, do not delete identities |
| Ask `MY_TRUSTHUB_CANARY_USER_IDS`, `MY_TRUSTHUB_CANARY_EMAILS` and trusted app claim | Existing restricted mechanism; contents not inspected/reported | Preserve founder eligibility/research | Server list deployment; restore exact approved prior configuration securely |
| Ask `MY_TRUSTHUB_INVITED_USER_IDS`, `MY_TRUSTHUB_INVITED_EMAILS` | New trusted server lists; production NOT VERIFIED | Empty/unset until separately approved pilot | Server deploy; remove new-registration eligibility separately from existing admitted user access; no bulk provisioning |
| Ask `MY_TRUSTHUB_SIGNUP_ENABLED` | Existing gate now independent of login | False through code-preparation release | Server deploy; false stops application signup without stopping eligible login; direct provider registration needs its own control |
| Ask `MY_TRUSTHUB_AUTH_SECURITY_READY` | New; missing false | False until provider confirmation/CAPTCHA/password settings verified | Server deploy; false withdraws application registration readiness, not login |
| Ask `NEXT_PUBLIC_SITE_URL` | No fallback; production must be exact approved parent origin | `https://www.asktrusthub.com` after owner verification | Build/deploy public configuration; invalid/missing fails closed; restore verified prior release/config |
| Ask `NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL` and existing public-key setting | Exact production parent binding retained; key not disclosed | Preserve established parent project, never a substitute project | Public build configuration; verify matching database/Auth; restore approved prior config, never replace identities |
| Nonprod `MY_TRUSTHUB_NONPRODUCTION_APPROVED`, `MY_TRUSTHUB_TEST_ORIGIN`, `MY_TRUSTHUB_TEST_SUPABASE_URL` | Missing/unapproved fails closed; UI fixture used loopback only | An already-authorized isolated origin/backend pair with safe database and inbox | Nonproduction only, no hosted provisioning; revoke approval/remap only through reviewed deployment |
| Ask `NEXT_PUBLIC_MY_TRUSTHUB_TURNSTILE_SITE_KEY`; Auth CAPTCHA settings | Missing site key disables entry; provider enforcement NOT VERIFIED | Matching approved hostnames/provider enforcement; existing secret remains secret | Public key build + separately approved provider setting; never disable CAPTCHA to pass tests |
| Auth Site URL / redirect allowlist / email templates | NOT VERIFIED | Exact canonical/approved isolated callback origins, supported PKCE code exchange and verification/recovery destinations | Provider-owner approval; restore recorded reviewed configuration, not a stale backup |
| Auth email confirmation / signup enablement | NOT VERIFIED | Confirmation required; provider registration closed until separately approved | Provider-level signup closure complements app gate; confirm existing login remains available |
| Auth minimum password / leaked-password protection / session lifetime / secure password change | NOT VERIFIED | Review against 12-character UI minimum, verification/re-auth requirements and agreed persistent sessions; preserve security protections | Auth owner approval; never weaken protection in this branch run |
| Auth SMTP / rate limits / CAPTCHA hostname / test inbox | NOT VERIFIED | Approved isolated mail sink or approved nonproduction inbox | Human/provider dependency; do not send production test messages |
| Watch/Alert/notification flags, schedules and worker controls | Not changed or re-audited | Preserve approved current settings | Separate scope/approval; signup shutdown does not mean notification shutdown |

Environment changes on Vercel generally require a new deployment to affect that deployment; `NEXT_PUBLIC_*` values may be build-inlined. Provider settings have their own effect timing, NOT established by this run. Verify the exact release's resolved configuration instead of blindly toggling/redeploying.

## Tests actually executed

| Command / check | Before implementation | Current result |
| --- | --- | --- |
| `check:my-trusthub-v2-2` | New | PASS, 23 deterministic tests |
| `check:my-trusthub-p11-p19` | Existing contract | PASS all chained sections |
| `check:ath-obs-002de` | Existing contract | PASS 54 tests |
| `npm test` | Existing repository chain | PASS, full command exit 0, repeated after final runtime edits |
| `check:ath-search-p0-001` | Existing | PASS 7 tests |
| `check:th-search-r1-008` | Existing | PASS 73 tests |
| `typecheck` | No reported baseline failure | PASS |
| `lint` | Existing unrelated warnings | PASS, 0 errors, 7 unrelated warnings; changed-file lint 0 warnings |
| `build` | Not certified from baseline | PASS final sequential run, exit 0 |
| `git diff --check` | Clean | PASS |
| `check:my-trusthub-stage-2` | FAIL: old Watch/Alerts navigation exclusion | Same failure; not changed or suppressed |
| `check:my-trusthub-stage-3` | Stage3 15 pass and P18 pass, then old Stage1 route inventory rejects `app/my/watches` | Same chained failure; do not call this command PASS |

The first build attempt overlapped local dev and failed on generated `.next/dev/types` syntax. Dev was stopped; only that worktree's generated dev directory was moved to a recoverable sibling inside `.next`; sequential build and the final repeat passed. No source reset or destructive cleanup occurred.

The historical stage commands were not rewritten. Two analytics expectations intentionally changed at this V2-2 cutover: `import=complete` URL markers no longer report a durable Save. This is the required receipt-authority correction, not removal of admission/RLS/security assertions. Historical analytics are not deleted and no new funnel baseline is claimed.

## Evidence / outstanding QA matrix

| Contract | Executed evidence | Remaining dependency |
| --- | --- | --- |
| Signup confirmation, existing-user password login, optional link same identity | Mocked supported SDK and ordinary-user policy tests | Isolated provider + approved inbox/human confirmation |
| Passwordless user password setup/recovery authority | Same-subject update test, signed-claim boundary/expiry and callback tests | Real verified recovery, expired/reused code, provider password-security behavior |
| Signup OFF allows existing eligible login; denied/unverified access denied | Deterministic policy/service tests | Real ordinary-user/noneligible-user execution |
| CAPTCHA missing/provider rejection/reset paths | Mocked cases; real UI disabled without site key | Approved real CAPTCHA hostname, invalid/expired token and retry |
| Session persistence/sign-out/switch | Existing SSR source assertions; current-user and late-callback switch denial tests | Real reload/ordinary return/cross-device/signout/provider-error path |
| Canonical origin/isolated preview/no production fallback | Pure policy tests and source review | Exact deploy configuration plus real isolated full path verification |
| Normalized returns/malicious paths/recoverable callback | Deterministic tests | Browser round-trip through real provider |
| Selected/partial/duplicate/failed/unsupported import and edits | Pure retirement/idempotency tests, receipt/owner action source assertions | Isolated DB RPC/RLS receipt test, reload and concurrent browser behavior |
| No automatic Watch | Source/contract assertions and unchanged existing chains | Isolated DB observation of Save/import/Project side effects |
| Consumer A/B and business separation | Retained RLS and owner checks reviewed/tested statically | Two ordinary isolated users plus separate business identity; not founder substitution |
| UI / password manager / keyboard / layouts | Actual Next UI at 1440, 390, 320; no horizontal overflow; labeled/autocomplete fields; keyboard show-password retains focus; unavailable-CAPTCHA blocks submit | Full screen-reader/focus/error-flow and authenticated import UI with safe fixtures |
| Analytics privacy/semantics | 54 analytics tests; named tests; no raw provider diagnostics | Real release event validation without founder/test funnel baseline |

Browser evidence used a local dev origin on port 3032 with an explicitly approved loopback backend URL pointing to **no running backend**, an inert noncredential public-key fixture and no CAPTCHA site key. No Auth form was submitted. This is UI/fail-closed evidence, not a working Auth environment or live journey. Empty-form screenshots were reviewed locally and are not committed; no browser profiles/authentication material are committed.

Unavailable dependencies, stated once: an already-authorized isolated Auth+application database+mail sink/inbox path; approved ordinary non-founder test identities; browser/device and human CAPTCHA/email-verification window; verified provider settings/redirect templates/security policy. No new credentials, hosted branches, services or production forms were used to bypass these dependencies.

## Independent Builder 3 QA

See `V2-1-independent-qa-move.md` for exact Move deployment/code evidence. Move PR #156 is available but its immutable preview redirects a fresh browser to Vercel Login. Save QA is PENDING, not PASS. Backend isolation is NOT VERIFIED.

Bounded open-PR searches found no available V2 Insurance or Lender handoffs/previews at the check time. Each remains PENDING. No Builder 3 worktree was modified, no teammate PASS report is substituted for independent testing, and no continuous polling was used. Working legacy local Save, when eventually verified, will still not mean parent workspace synchronization.

## Smallest future release / rollback package

1. Review this implementation PR and configuration manifest. Keep production access/registration unchanged. PR CI/preview is not production authorization.
2. Establish the existing authorized isolated origin → callback → Auth → application DB → safe inbox path. Run the outstanding ordinary-user/provider/RLS/import/session/CAPTCHA tests and record exact revisions. Do not treat a preview hostname as isolation proof.
3. Obtain separate founder approval for production code/config release, proposed initial **internal** access mode and registrations **OFF**. Verify provider settings, existing identity binding and eligible existing login without creating public accounts.
4. Pilot enrollment or public signup requires a later distinct approval, verified invitation/public policy and provider-level signup controls. Do not activate merely because tests pass.
5. Registration shutdown: close application registration and separately approved provider signup entry while preserving eligible existing password/link login. Access restriction: independently choose approved internal/invitation policy without deleting users/research. Notification shutdown: separate worker/provider controls under separate authorization. Emergency master closure: workspace gate, not a promise that all provider accounts or background jobs are disabled.
6. Roll back code with a reviewed revert/redeployment of the known release and its recorded configuration. Do not reset another builder's branch, rotate identity subjects, delete Auth users or private research, or assume a stale configuration backup is safe. New-password users may need the retained optional link/recovery entry on an older release; explicitly validate that fallback before rollback.

V2-2 CODE PREPARATION = READY FOR REVIEW (implementation delivered; no production approval).

V2-2 NONPRODUCTION QA = PARTIAL (deterministic, repository and safe UI evidence; real provider/database journey remains unexecuted).

V2-1 THREE-HUB INDEPENDENT QA = Move PENDING / Insurance PENDING / Lender PENDING.

PRODUCTION RELEASE = NOT AUTHORIZED / NOT PERFORMED. PUBLIC SIGNUP = NOT ACTIVATED. NETWORK-WIDE V2 = NOT YET CERTIFIED.
