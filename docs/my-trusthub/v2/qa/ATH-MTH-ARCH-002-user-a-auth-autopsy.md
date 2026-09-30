# ATH-MTH-ARCH-002 — Isolated User A auth autopsy

Status: read-only diagnosis. No repair. Audited 2026-09-30.

ATH-MTH-ARCH-002R status: `HOLD`. The fresh human password grant proves the operational root cause. The supported Admin password update was not performed. The sections at the end of this file supersede the Phase A grant conclusion and the Phase A repair line.

ATH-MTH-ARCH-002R2 status: `RESET_COMPLETE_HUMAN_LOGIN_PENDING`. A temporary isolated admin credential was available. `auth.admin.updateUserById` changed only the USER_A password, and the canonical handoff was atomically rewritten. That section supersedes the 002R statement that the Admin update was not performed. No human login has been performed.

Governing decision, unchanged:

ONE IDENTITY. SPECIALIST TOOLS. PARENT SAVED/PROJECTS. SAVE ≠ WATCH.

This ticket does not reconsider that decision. It asks one question: what Supabase project the reviewed Ask preview password login actually uses, and whether the isolated QA identity called USER_A has a proven password-login blocker.

Phase A decision: `ROOT_CAUSE_NOT_PROVEN`.

Phase B was not entered. No password was reset. No preview variable was changed. No code was changed. P13 was not run. PR #185 and Move PR #169 were not changed.

## Ticket 1 close

ATH-MTH-ARCH-001 was merged before this diagnosis.

| Check | Result |
| --- | --- |
| PR | #225 |
| Certified head | `7272beab9e4392464530c34f76d1422e383ec652` |
| State before merge | Open, draft, unmerged, head exactly that SHA |
| Merge commit | `83dcc62dcfd7ea1e979999044f7e4e07637b4e59` |
| Parents | `057ac969f7e016b742fd3d42789e65b488e2c938` and `7272beab9e4392464530c34f76d1422e383ec652` |
| `origin/main` after fetch | `83dcc62dcfd7ea1e979999044f7e4e07637b4e59` |
| Merged at | 2026-09-30T16:49:25Z |

This Ticket 2 branch, `ath-mth-arch-002-user-a-auth-autopsy`, was created from that main. It was not created from PR #185, PR #169, or the architecture branch.

The docs merge caused the GitHub/Vercel integration to deploy that SHA. That deploy is the certified map. It is not an Auth, schema, or preview-runtime change.

## A1. Reviewed Ask preview

The stable alias still serves the reviewed runtime.

| Field | Value |
| --- | --- |
| Deployment | `dpl_3g13PFDAbKEN8tRoUDY4wb4eUifj` |
| Branch | `mth-v2-3-parent-runtime` |
| SHA | `b885a651d1b229f8c6acbc5888733af08f4a5e5d` |
| State | `READY` |
| Created | 2026-09-29T20:03:05Z |
| Stable alias | `https://conumers-trust-hub-git-mth-v2-3-pare-3127df-savitz25-s-projects.vercel.app` |
| Unique hostname | `conumers-trust-jx8y1lcfp-savitz25-s-projects.vercel.app` |

`origin/mth-v2-3-parent-runtime` was fetched during this audit and is still `b885a651d1b229f8c6acbc5888733af08f4a5e5d`. The deployment API `meta.githubCommitSha` is that SHA. The alias inspect resolves to this deployment.

`/my/sign-in` on the stable alias returned HTTP 200. The document contains the password form and the text "Sign in to My TrustHub". It does not contain "Account access is unavailable" or "Email me a sign-in link".

## A2. accountRuntime pair

`ACCOUNT LOGIN BACKEND = xkkiicsassizmakcvxml`

Effective origin for this deployment: the stable alias above.

Evidence is the deployment environment, not the alias name and not `isolatedConfig`.

On SHA `b885a651`, `accountRuntime` admits production only for `https://www.asktrusthub.com` plus `https://qvvxvbcdmbjzrgvwjatw.supabase.co`. Off production it admits `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL` only when `MY_TRUSTHUB_NONPRODUCTION_APPROVED` is true, the backend is not the production project, the origin hostname is not an Ask production hostname, and those two public values equal `MY_TRUSTHUB_TEST_ORIGIN` and `MY_TRUSTHUB_TEST_SUPABASE_URL`. The function does not hardcode `xkkiicsassizmakcvxml`.

`getMyTrustHubSupabaseUrl()` returns `accountRuntime(process.env)?.backend`. `createMyTrustHubSupabaseClient` uses that URL and `NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_PUBLISHABLE_KEY`. Login creates that one client.

Branch-scoped preview values for `mth-v2-3-parent-runtime`, each updated before this deployment was created:

| Variable | Safe reading |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | host of the stable alias |
| `MY_TRUSTHUB_TEST_ORIGIN` | same host |
| `MY_TRUSTHUB_V23_PARENT_ORIGIN` | same host |
| `NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL` | `xkkiicsassizmakcvxml.supabase.co` |
| `MY_TRUSTHUB_TEST_SUPABASE_URL` | same host |
| `MY_TRUSTHUB_V23_ISOLATED_PROJECT` | `xkkiicsassizmakcvxml` |
| `MY_TRUSTHUB_NONPRODUCTION_APPROVED` | `true` |
| `MY_TRUSTHUB_PREVIEW_ACCOUNT_ACCESS` | `true` |
| `MY_TRUSTHUB_ENABLED` | `true` |

The rendered password form shows `accountRuntime` is non-null on the running deployment. The branch publishable key, decrypted only in memory, was accepted by `https://xkkiicsassizmakcvxml.supabase.co/auth/v1/settings` with HTTP 200. The key is not a JWT. The project ref is the host that accepted it.

This is not `WRONG_BACKEND_PROJECT`. Password mutation was not authorized by a wrong backend.

## A3. Request origin

No live `Origin` header was captured. A browser POST from the stable alias has the same host as `NEXT_PUBLIC_SITE_URL` and `MY_TRUSTHUB_TEST_ORIGIN`. `accountAction` rejects the request before `signInWithPassword` when `origin !== runtime.origin`.

Classification for the reviewed stable alias: `EXPECTED`, from the env snapshot that predates the deployment plus the rendered form.

The unique deployment hostname is a different origin. A login POST from that hostname fails closed in `accountAction` and does not call GoTrue.

## A4. Password login path at b885a651

Traced from the reviewed SHA. This branch's tree is `main` and does not contain this path.

`AccountEntry` renders `AccountForm` for `login` and passes `NEXT_PUBLIC_MY_TRUSTHUB_TURNSTILE_SITE_KEY`.

`accountAction`:

1. Rejects an unknown operation.
2. Reads `accountRuntime(process.env)` and the request `Origin`.
3. Returns "Account access is unavailable in this environment." when the runtime is null or the origin differs.
4. Creates one `createMyTrustHubSupabaseClient(true)`.
5. Calls `runAccountOperation`.
6. On login completion, redirects to the safe return path with `auth=complete`.

`runAccountOperation` for login:

- Email is trimmed and lowercased. The password is not trimmed.
- `captchaToken` is the form field of that name.
- A missing site key returns "Security verification is unavailable" and does not call the provider.
- An empty or overlong token returns "Complete a fresh security check" and does not call the provider.
- Otherwise it calls `signInWithPassword({ email, password, options: { captchaToken } })` on that single client.
- A provider error, a follow-up `getUser` error, or `admitted()` returning false all become the same public string: "We could not sign you in. Check your details and access, or try password recovery."
- `classify` maps HTTP 429 to `rate_limited` and every other provider error to `provider_failure`. An admission failure after a grant is logged as `admission_blocked`, then the local session is signed out.
- The log line is `my_trusthub_account` with operation and outcome. It does not include the Auth error code.

The page therefore never shows `invalid_credentials` or `captcha_failed`. A prior report of `invalid_credentials` is an Auth API observation, not the page text.

The branch Turnstile site key is present, plain, length 24, and was updated before this deployment. The sign-in document contains `captchaToken` and "Retry security check". The widget script is added in the browser by `TurnstileField`; its absence from the raw HTML is expected.

No second Supabase client is created on this path.

## A5. USER_A on xkkiicsassizmakcvxml

Read-only SQL, `default_transaction_read_only = on`, TLS verified, role name checked for this project ref before any query. Forbidden production refs were rejected by the script before connect. Refreshed 2026-09-30 during this audit.

| Check | USER_A |
| --- | --- |
| Exists | yes, one case-exact email match |
| Confirmed | yes, including legacy `confirmed_at` |
| Banned now | no |
| Deleted | no |
| Anonymous | no |
| SSO | no |
| Provider | `email` only |
| Password credential | present, bcrypt, 60 characters |
| Phone | absent |
| Email change pending | no |
| `email_verified` metadata | string `true` |
| Created | 2026-09-21T20:46:32.894Z |
| Updated | 2026-09-29T22:18:46.764Z |
| Last sign-in | 2026-09-29T16:58:50.626Z |
| Confirmation, recovery, email-change, and invite send times | all null |

Email identity: created, updated, and identity `last_sign_in_at` are all 2026-09-21T20:46:32.900Z. The identity row did not move when the user row was updated on 2026-09-29.

Sessions for USER_A: 3, all `aal1`, created from 2026-09-27T16:42:16.991Z through 2026-09-28T01:30:38.509Z. `refreshed_at` and `not_after` are null. The user `last_sign_in_at` is later than every surviving session.

Project counts: 2 users, 2 identities, 3 sessions, 0 deleted users. The other user is confirmed, not banned, not deleted, and has 0 sessions. That other user was not written.

MFA factors: none. One-time tokens: none. `auth.audit_log_entries`: 0 rows.

Classification: `VALID`.

## A6. Previous password mutation

Classification: `UNKNOWN`.

The user row `updated_at` is 2026-09-29T22:18:46.764Z. There is no `recovery_sent_at`, no one-time token, and no identity-row update at that time. An empty audit table does not say which writer touched the row.

`scripts/create-my-trusthub-canary.mjs` calls `auth.admin.updateUserById` with email confirmation and canary app metadata. It does not pass a password. `scripts/assert-p20d-prep.mjs` only checks that the canary script contains that method name. Neither file is evidence that USER_A's password was changed.

A text search of session notes, the local secrets directory, and those script trees found no executed `UPDATE auth.users`, `crypt(`, `gen_salt(`, or `updateUserById` password call for this user. Mentions inside this ticket's own instructions were not treated as execution.

## A7. Handoff file

Canonical file: `~/.trusthub-secrets/mth_user_a_credential.txt`.

| Check | Result |
| --- | --- |
| Bytes | 98 |
| BOM | no |
| Fields | `email` and `password` only |
| Email | non-empty, no surrounding quotes, no edge whitespace, case-exact match to USER_A |
| Password | non-empty, no surrounding quotes, no edge whitespace, no embedded newline |
| File timestamp | 2026-09-29T21:52:01.988Z |
| Name matches under `.trusthub-secrets` | this one file |

A Desktop and Documents filename search printed only this same file and then exited 1. The log contained no error text, so that broader search is incomplete. No script in the reviewed trees points at a second copy.

A local bcrypt comparison of the handoff password against the stored credential matched. That comparison is not a Supabase password grant and is not proof that hosted login succeeds. It does show that the current handoff password is the current stored Auth password. A reset is not authorized on the ground that the handoff is stale or different from the stored credential.

## A8. Auth configuration

`GET /auth/v1/settings` on `xkkiicsassizmakcvxml` returned HTTP 200.

| Setting | Reading |
| --- | --- |
| Email provider | enabled |
| Listed SSO, phone, anonymous, and passkeys | disabled |
| Signup | disabled |
| Mailer autoconfirm | false |
| USER_A | already confirmed |

CAPTCHA enablement, Site URL, redirect URLs, and password policy are not in that response. No Supabase management token was available. Those four items are `UNKNOWN`.

The app has a Turnstile site key on this preview branch. Whether the Auth project requires the token is `UNKNOWN`. GoTrue uses `captcha_failed` and `invalid_credentials` as different codes. This app collapses both into one sentence.

## A9. Auth HTTP logs

`auth.audit_log_entries` has 0 rows. The prior hosted `invalid_credentials` event is not in the database.

Hosted Auth HTTP logs were not retrieved. No management token was present. The Vercel runtime-log integration returned 403 for this deployment. The Vercel CLI log command only streams new logs, and it was not left running. No login was submitted to create a new log line.

## A10. Last successful password login

No `grant_type=password` row exists in the audit table.

`last_sign_in_at` is 2026-09-29T16:58:50.626Z. That timestamp is before the credential file write and before the user-row update. It is not an HTTP log, and no surviving session has that timestamp. No sign-in is recorded after the 2026-09-29T22:18:46.764Z user-row update.

## A11. Safe timeline

| Time | Event |
| --- | --- |
| 2026-09-21T20:46:32.894Z | USER_A created, already confirmed. No confirmation send time. |
| 2026-09-21T20:46:32.900Z | Email identity created. It has not been updated since. |
| 2026-09-27T16:42:16.991Z through 2026-09-28T01:30:38.509Z | Three `aal1` sessions. None refreshed. |
| 2026-09-29T16:58:50.626Z | `last_sign_in_at`. No surviving session at this time. |
| 2026-09-29T20:03:05Z | Reviewed preview deployment created at SHA `b885a651`. |
| 2026-09-29T21:52:01.988Z | Canonical handoff file written. |
| 2026-09-29T22:18:46.764Z | USER_A row `updated_at`. Mechanism unknown. |
| After that update | No recovery send, no one-time token, no audit row, no later sign-in. |

Failed password grants are not observable in the current audit table.

## isolatedConfig

Login does not call `isolatedConfig`. Classification for this password incident: `NOT_REACHED`.

A static reading of the same pre-deployment branch env against the function at `b885a651` would not return null:

- Deployment target is preview.
- Profile-save, master, Saved, and specialist handoff are the string `true`.
- Signup, email, Watch, alerts, and source monitoring are the string `false`.
- Access mode is `invitation`. Session affinity is `dedicated`.
- Parent origin is the stable alias. Move origin is `move-trust-hub-git-mth-v2-3-move-cur-0a05f1-savitz25-s-projects.vercel.app`.
- Isolated project is `xkkiicsassizmakcvxml`.
- `MY_TRUSTHUB_INVITED_USER_IDS` is two distinct UUIDs. Both match the only two Auth users.
- `MY_TRUSTHUB_INVITED_EMAILS` is absent. The function treats an absent value as empty.

`admitted()` for invitation mode accepts an id in that list or an email in the email list. USER_A is one of the two users whose ids are the invited set. That check runs only after a password grant. It was not executed.

This static reading is not a profile-save execution, and it is not a reason to change preview configuration. The login backend and origin are already the reviewed pair.

## Root cause

`ROOT_CAUSE_NOT_PROVEN`.

What is proven:

- The reviewed deployment is SHA `b885a651` and its password login backend is `xkkiicsassizmakcvxml`.
- USER_A is a confirmed, unbanned, undeleted email identity with a stored password.
- The canonical handoff password matches that stored bcrypt credential.
- The prior `invalid_credentials` report is not in the current Auth audit log.
- The last recorded sign-in is before the credential file and before the unexplained user-row update.

What is not proven:

- That the current password is rejected by a password grant.
- How the 2026-09-29T22:18:46.764Z row update was made.
- Whether the Auth project would return `captcha_failed` for a browser token.
- The request `Origin` of the earlier hosted attempt.

The matching bcrypt result removes the authorized reasons for a supported password reset: the handoff is not a stale or different password, and there is no evidence of a direct SQL hash write that left a credential the handoff cannot satisfy. A local comparison still does not prove the grant. No repair class in this ticket is proven.

## Repair

`NONE`.

B1 was not performed. B2 was not performed. No user was recreated. CAPTCHA, signup, and email were not changed. RLS, schema, Save ownership, and P13 were not changed. Production Supabase and production Vercel settings were not changed by this diagnosis.

## Boundaries

| Item | Result |
| --- | --- |
| USER_A identity | preserved; read-only |
| User B | unchanged |
| Production Auth and runtime config | none changed by this ticket |
| Code | none |
| P13 | not executed |
| Human Turnstile login | not automated |
| `HUMAN_LOGIN_READY` | no |

The next human Chrome login, if the founder chooses to make one, belongs on the stable alias above. This autopsy does not certify that login.

## Fresh human reproduction

A human Chrome login on the stable Ask preview used the canonical handoff. Cloudflare Turnstile completed in that browser. P13 was not reached.

| Field | Value |
| --- | --- |
| Ask Vercel time | 2026-09-30T18:02:57Z |
| Deployment | `dpl_3g13PFDAbKEN8tRoUDY4wb4eUifj` |
| Branch | `mth-v2-3-parent-runtime` |
| SHA | `b885a651d1b229f8c6acbc5888733af08f4a5e5d` |
| Event | `my_trusthub_account` |
| Operation | `login` |
| Outcome | `provider_failure` |
| Supabase project | `xkkiicsassizmakcvxml` |
| Auth time | 2026-09-30T18:02:58Z |
| Request | `POST /token` |
| Grant | `grant_type=password` |
| HTTP | 400 |
| `error_code` | `invalid_credentials` |
| Turnstile | human success |
| P13 | not reached |

This is a fresh supported GoTrue password-grant rejection on the reviewed deployment. The app outcome is `provider_failure`. The failure is before P13. It is not an `admission_blocked` result, and it is not an `isolatedConfig` or profile-save failure. Login does not call `isolatedConfig`.

The Phase A statement that rejection of the current password by a password grant was unproven is superseded. The supported password grant is authoritative. A local bcrypt comparison of the canonical handoff against the stored credential does not establish that GoTrue will accept that password.

Operational root cause: the current USER_A password credential is not accepted by Supabase Auth. The historical writer remains unknown. This record does not assign that rejection to a SQL mutation, an Admin reset, a credential migration, hash semantics, or another writer.

## Authorized repair

`HOLD`. Repair method: `NONE`.

The authorized action was `supabase.auth.admin.updateUserById` on the existing USER_A in `xkkiicsassizmakcvxml`, changing only the password. That call was not made.

No service-role credential for `xkkiicsassizmakcvxml` was available:

- The local files for this project contain the session database URL and the canonical handoff. They do not contain a service-role key.
- The database login is not a superuser. Vault secret names are empty. `auth.instances` has no rows. The JWT secret setting is unset. Those facts were not used to mint a key or to write a password.
- The Vercel variable named `SUPABASE_SERVICE_ROLE_KEY` is a JWT for `qvvxvbcdmbjzrgvwjatw` with role `anon`. It was classified and not sent.
- No Supabase management access token was present.
- One local admin-shaped secret was presented only to `https://xkkiicsassizmakcvxml.supabase.co` and was rejected with HTTP 401. It was not used for an update, and it was not sent to any other project.

`auth.users` was not updated. `encrypted_password` was not written. SQL, `crypt()`, and `gen_salt()` were not used. USER_A was not recreated. Email, confirmation, and metadata were not changed. User B was not changed. The canonical handoff was not rewritten. It remains the file written at 2026-09-29T21:52:01.988Z.

A later read-only check on `xkkiicsassizmakcvxml` still shows the same USER_A identity:

| Check | Result |
| --- | --- |
| USER_A row | one case-exact email match |
| Confirmed | yes |
| Banned | no |
| Deleted | no |
| Provider | email |
| `updated_at` | `2026-09-29T22:18:46.764Z`, unchanged |
| User B | one other user; confirmed; not banned; not deleted; zero sessions |
| Handoff rewritten | no |
| Production mutation | none |
| Code mutation | none |
| P13 | not executed |
| Automated password login | not performed |
| `HUMAN_LOGIN_READY` | no |

The supported human Chrome login waits until an isolated service-role credential can perform `updateUserById` and the canonical handoff is rotated with it. This ticket does not certify a login.

## Supported password reset

ATH-MTH-ARCH-002R2. A temporary secret key named `mth_v2_3_user_a_reset_temp` was present at `~/.trusthub-secrets/xkkiics_admin_secret.txt` for project `xkkiicsassizmakcvxml`. It was loaded into process memory for this repair. It was not copied into Git, this receipt, Slack, or another file.

Admin preflight used `auth.admin.listUsers` and `auth.admin.getUserById` against `https://xkkiicsassizmakcvxml.supabase.co` only. The client disabled session persistence, token refresh, and session detection in the URL. The read matched the existing USER_A: confirmed, not banned, not deleted, and email provider. The project still had two users.

`auth.admin.updateUserById` was then called with the password attribute only. The call returned no error.

A second admin read showed the same USER_A identity: same user, same email identity, confirmed, not banned, not deleted, and email provider. `updated_at` changed. User B was unchanged: confirmed, not banned, and not deleted.

The canonical handoff `~/.trusthub-secrets/mth_user_a_credential.txt` was written to a temporary file, privately validated, and atomically replaced at 2026-09-30T19:13:05Z. The temporary handoff file and the replace backup were removed. The replacement has exactly the email and password fields, no BOM, no wrapping quotes, no edge whitespace, and no embedded newline in the password.

No SQL was used. `auth.users` and `encrypted_password` were not written directly. `crypt()` and `gen_salt()` were not used. USER_A was not recreated. Email, confirmation, and metadata were not intentionally changed. User B was not changed. Production projects were not contacted. Vercel was not changed. Code, schema, RLS, CAPTCHA, signup, and email settings were not changed. P13 was not executed. No password grant and no browser login were performed.

The temporary admin key remains in its private local file. It was not used again after this repair and was not revoked in this ticket.

| Check | Result |
| --- | --- |
| Admin preflight | pass |
| Target project | `xkkiicsassizmakcvxml` |
| Repair API | `auth.admin.updateUserById` |
| Admin reset | pass |
| Direct SQL password mutation | no |
| USER_A identity | preserved |
| USER_A confirmed | yes |
| USER_A banned or deleted | no |
| User B | unchanged |
| Canonical handoff | atomic rewrite pass |
| Temporary admin key exposed | no |
| Production mutation | none |
| Code mutation | none |
| P13 | not executed |
| Human password login | not performed |
| `HUMAN_LOGIN_READY` | yes |

`HUMAN_LOGIN_READY` means the founder can attempt the human Chrome login on the stable Ask preview after G-B2 reviews this repair. It does not mean that login has succeeded.
