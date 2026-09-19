# V2-2R account hardening review

Date: 2026-09-19. Builder 4. PR #184 in `savitz25/Conumers-Trust-Hub`.

Reviewed starting head: `9ad26d54bc19b6bc84d11288575761d02cfd1326`. Fetched main: `4831532ac799077c6963c7ad54b1562ec5409167`; no concurrent source edits in this worktree or remote account branch at baseline. Existing branch retained; no rebase/reset, production merge or activation.

Corrected runtime/contract/test commit: `61ffa0ab0dcd15c5ddaa16cda1195eb59646db9d`. Delivery head may add evidence-only documentation; PR check/preview status belongs to the exact pushed head, not the prior green revision.

## Review method and verdict

Re-read action/callback/policy/UI/SDK cookie boundaries, import action/receipt reader/local storage, P12/P13 SQL ownership/idempotency and analytics as adversarial inputs, rather than relying on original PASS claims. Inspected current provider guidance and the installed SDK behavior. Tests use ordinary fixtures and no founder entitlement shortcut.

Verdict after corrections: **READY FOR ISOLATED PROVIDER QA**, not live-provider certification or release approval. Supabase/Next.js guidance led to explicit mutable-cookie failure handling; React/browser guidance informed state/accessible-status review. No credentials, production settings, DB queries/mutations, migration or dependency changes were needed.

## Findings and corrections

| Finding | Risk / exact correction | Regression evidence |
| --- | --- | --- |
| F1: shared localStorage retirement race | A second tab can write between read and whole-bundle setItem even without an await. V2-2R importer no longer rewrites or removes the legacy bundle after acknowledgment; it reports durable selected success and retains local copies. V2-3 requires atomic item revisions with all writers participating before retirement. | New source-boundary regression failed before fix; pure snapshot-selection tests retained, but their helper is no longer used to rewrite runtime storage |
| F2: configuration-dependent invitation disclosure | With signup enabled but security-ready false, eligible invitation emails received a configuration error while others received generic signup copy. Security readiness is now checked uniformly before email eligibility. | New deterministic service test failed before fix, now equal responses/no provider calls |
| F3: failed sign-out reported as completed | Password update ignored returned signOut error and redirected as complete. It now reports password changed but sign-out unconfirmed; ordinary sign-out action also handles returned/thrown failure without claiming switch readiness. | New mocked SDK test failed before fix; generic error contains no raw provider detail |
| F4: mutable session-cookie failures swallowed | Shared SSR helper allows read-only render cookie failures, but account actions/callbacks need write success. Added explicit strict mode for those mutable entry points; failure throws a bounded error and prevents completion reporting. Read-only Server Component behavior retained. | Pure cookie failure/success tests plus strict-caller assertions |
| F5: stale CAPTCHA completion status | Token reset could leave “complete” status visible. Reset now clears token/widget and restores fresh-check status. No CAPTCHA bypass introduced. | Existing token-lifecycle/source contracts and focused lint; real provider lifecycle remains a release test |
| F6: forged auth-completion telemetry | `auth=complete` was accepted as authentication evidence by browser analytics. Removed that inference; verified password action/PKCE callback emit bounded server completion events only after verified success. | Two analytics tests now reject forged/bookmarked completion markers; 54-test suite rerun |

F1 intentionally trades automatic local cleanup for data preservation; repeated import remains idempotent, and users can retain their local research. This supersedes the earlier V2-2 implementation document's description of automatic retirement. No tests were deleted or assertions weakened to hide a security failure. The three initially added F1/F2/F3 regressions produced **23 pass / 3 fail** against the starting implementation, then passed after corrections.

F6 is an event-definition cutover, not a claim of uninterrupted historical funnel comparability. Verified completion is now bounded **server log evidence**; forwarding that event into a production analytics sink is NOT VERIFIED and not configured here. No raw user/email/token/code/URL/password/cookie data is logged. Existing unrelated Project/Watch/legacy Save URL telemetry was not refactored by this account ticket and must not be mistaken for authorization/DB proof. No historical events or baselines deleted.

## Boundaries reviewed and retained

- Signup uses the existing parent `signUp` flow only for new registrations, requires confirmation policy attestation, and refuses an unexpected immediate session. Link login uses `shouldCreateUser:false`; password setup never calls signup. No email-only account merging.
- Existing password login remains available when registration is OFF, subject to verified-email admission. Invitation eligibility is trusted server configuration, not user_metadata/client flags/business role. Missing/unknown mode/config fails closed. Founder internal identity/research are not changed.
- Password mutation uses fresh verified user, expected subject and SDK-verified recent AMR. Recovery query hints are not authority. Invalid/expired/reused material is safely rejected in mocked callback tests; actual provider replay/expiry still needs isolated execution.
- Production canonical origin and parent backend binding remain exact. Nonproduction requires explicit approved origin/backend pair and rejects the parent production backend. No fallback URL or preview credential was introduced.
- Return path is decoded/normalized before the bounded allowlist. Tests reject external/protocol-relative, traversal/backslash/nested encoding, malformed input and recursive auth paths. The original demonstrated issue was a within-origin boundary escape, not proof of an external redirect vulnerability.
- Current-session checks stop ordinary silent switching and late callbacks. Import compares expected owner before the RPC; receipt selection remains under current-user RLS. Browser input is never owner authorization. In-flight HTTP/cookie ordering and genuine two-device/two-user behavior remain provider/browser integration gates, not proven by mocks.
- Import completion URL cannot delete research. Receipt failures, partial/unsupported/unselected items and edits remain safe; after F1, all legacy local copies remain regardless of cross-tab timing. Save/import/Project does not create Watch.
- Persistent cookies and refresh use the existing SSR adapter. Strict mutable writes prevent false completion on cookie-write errors; actual long-lived/reload/cross-device/revocation behavior is still NOT VERIFIED with a real provider.

## Password/security release requirements

**Leaked-password protection is a REQUIRED production gate before password accounts open. Enabled state is NOT VERIFIED. Do not activate password registration until the Auth owner verifies it; no setting was changed here.** If current plan/configuration does not support the required protection, report a release blocker—this ticket authorizes no purchase/upgrade.

Application new passwords currently use 12–128 characters, confirmation and password-manager autocomplete; existing login passwords are not subjected to the new minimum. Passphrases do not require arbitrary character classes, and tests accept lowercase phrases. Align UI/provider minimum and actual provider maximum/security policy before release; current production policy is NOT VERIFIED. Do not add composition UX absent an established provider requirement.

Returning password login, signup intent, optional link and recovery make one provider request per submitted action, with no automatic retry on 429. Public recovery/link messages are identical for blocked, unknown, rate-limited and provider-failed requests. Internal diagnostics remain bounded. Password changes require fresh authentication; provider reauthentication/current-password settings may impose additional requirements. Verify those actual settings and corresponding isolated flow, without disabling them to make tests pass.

Current official sources: [Supabase password security](https://supabase.com/docs/guides/auth/password-security), [signature-verifying getClaims](https://supabase.com/docs/reference/javascript/auth-getclaims). Password security documentation describes configurable minimum/reauthentication and leaked-password protection; the application does not assume their production values. Changelog index was retrieved; no relevant breaking change requiring a dependency upgrade was identified for these SDK calls.

Required pre-release verification: email confirmation enabled; leaked-password protection enabled; approved password/reauthentication/session settings; supported CAPTCHA configured on provider and frontend with correct hostnames; canonical callback allowlist/PKCE templates; registration shutdown independent from eligible login; approved mail sink/inbox. Never paste passwords, Auth links or secrets into chat.

## Tests and evidence interpretation

- Named account suite expanded to 29 cases (mocked SDK/pure helpers/source assertions).
- Shared V2-3 suite: 20 deterministic in-memory specification cases; no endpoints/DB tests.
- Analytics suite: 54 cases; the two auth completion expectations change only to reject forged browser evidence.
- P11–P19 chain retains ownership, RLS, handoff, feature and session contracts.
- Full repository tests, typecheck, focused lint, build and diff results are recorded in `artifacts/my-trusthub/v2/v2-2r-validation.json` at delivery. Do not infer an unrun command from the previous ticket.
- Historical Stage 2/3 old Watch/navigation inventory failures were recorded before the original implementation and remain outside this correction; scripts/security assertions were not edited. They are not claimed green.
- No real signup/login/recovery emails, CAPTCHA provider tokens, Auth users, DB imports or worker/cron endpoints exercised. Local Move tests do not certify parent accounts.

## Move and new handoffs

See `V2-1-move-independent-qa.md`: independent exact-head local browser/unit tests ran; one reload local-persistence disclosure defect returned to Builder 3. No Move code edits. Real authenticated Move Save NOT RUN.

Insurance PR #55 head `426ad49b91d0fdc65b54e4ce515c45c7732910a5` and Lender PR #52 head `315093be109796c9dd170e80a936ecd10e9cff7d` appeared during this bounded run. Published handoffs and file/check metadata reviewed; independent runtime QA remains PENDING. These replace “no handoff available” as the current state; neither is certified from Builder 3's results. Shared-contract matrix includes both exact revisions.

## Release and rollback

No merge, deploy/promotion, environment/Auth setting, account, database or notification change performed. Continue production HOLD. Smallest next action: review these hardening changes and run ordinary-user provider/RLS/session/CAPTCHA flows on an already-authorized isolated path; separately retest Builder 3's corrected Move revision and schedule new Insurance/Lender independent checks.

Roll back corrections only through a reviewed revert; do not reset concurrent work or delete identities/research. Reverting F1 restores a known storage race and is not recommended. Registration shutdown and access restriction remain separate. Watch/notification controls remain untouched. Full six-hub account/Save/tool continuity is not certified.
