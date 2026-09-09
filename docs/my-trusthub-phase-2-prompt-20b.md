# My TrustHub Phase 2 Prompt 20B handoff

## Resumed final handoff - 2026-09-09

Permanent project: `Conumers-Trust-Hub` (`qvvxvbcdmbjzrgvwjatw`)

Status: **P20B CONTROL-PLANE REMEDIATION COMPLETE FOR MIGRATION APPROVAL**

Recommendation: **READY FOR MIGRATION APPROVAL - YES**, limited to P11-P19 with all My TrustHub features effectively off and the approved P11-to-Data-API interstitial gate.

### A. Status

P20B resumed from the completed 2026-09-08 audit without repeating it. Founder-supplied Dashboard observations close the backup/restore and Auth configuration gaps that the connected tools could not see. Read-only tooling revalidated every available permanent-project fact.

No migration, DDL, user creation, canary activation, feature enablement, or unrelated production change was performed.

### B. Backup / restore gate

Gate result: **PASS for Stage 0 and the initial empty-database internal canary**.

Founder-supplied permanent-project evidence records scheduled physical daily backups, with the latest visible successful backup at `2026-09-09T05:30:36Z`, daily backups visible from September 2 through September 9, and a Restore action on every visible backup. The responsible recovery operator is Founder / authorized Trust Hub operator.

PITR is not required for the initial empty-database internal canary. A restore drill, measured RTO, and any stricter post-write RPO/PITR requirement remain later public-launch or production-traffic gates; they do not block the empty-database migration window.

### C. Auth gate

Gate result: **PASS for the closed internal canary**.

The public Auth settings endpoint independently revalidated:

- `disable_signup=true`
- Email enabled and confirmation required (`mailer_autoconfirm=false`)
- Phone, Google, anonymous users, SAML, passkeys, and all other unnecessary public providers disabled
- Auth user count remains zero

Founder-supplied Dashboard evidence records:

- Site URL exactly `https://www.asktrusthub.com`
- Only redirect URL `https://www.asktrusthub.com/auth/callback`
- Manual linking off
- Supabase built-in email service and an existing Magic Link/OTP template
- Accepted internal-canary session settings: 3600-second access tokens, compromised refresh-token detection on, 10-second reuse interval, and no single-session, time-box, or inactivity limit
- Accepted internal-canary rates: email 2/hour; refresh 150/5 minutes/IP; verification 30/5 minutes/IP; sign-up/sign-in 30/5 minutes/IP; anonymous 30/hour while anonymous sign-in is disabled; IP forwarding off
- CAPTCHA and leaked-password protection off

CAPTCHA and custom SMTP remain public-launch gates. Leaked-password protection is not a blocker for this passwordless email-first canary.

#### Magic Link / PKCE compatibility

The existing `{{ .ConfirmationURL }}` template is compatible with the current application flow and does not require a change for this internal canary:

1. `requestMagicLinkAction` calls `signInWithOtp` using the `@supabase/ssr` server client, `emailRedirectTo=https://www.asktrusthub.com/auth/callback?next=/my`, and `shouldCreateUser=false` in canary mode.
2. `@supabase/ssr` uses PKCE by default and stores the verifier in cookies.
3. The Confirmation URL verifies the one-time email token through Supabase Auth and returns an Auth Code to the configured callback.
4. `/auth/callback` reads `code`, calls `exchangeCodeForSession(code)`, validates the resulting user with `getUser()`, enforces trusted canary entitlement, and signs out an unentitled identity.

Supabase also documents a direct `token_hash` plus `verifyOtp` SSR pattern. That is an alternative design, not a template-only change: changing the template to a direct token-hash link would require updating the callback to accept `token_hash` and call `verifyOtp`. Do not change the template independently of that coordinated application change.

An actual email click, cookie flags, refresh, expiry, and sign-out lifecycle test remains a Stage 1 controlled-canary validation because no users may be created during P20B.

### D. Data API gate

Gate result: **APPROVED INTERSTITIAL MIGRATION SEQUENCE; intentionally pending P11**.

The connector revalidated that `consumer`, `network`, and `ops` do not exist and that no tables exist in those or `public`. Fresh Data API probes returned `public=404`, `consumer=406`, `network=406`, and `ops=406`. The production adapter requires `.schema("consumer")`.

During the future approved migration window:

1. Keep all My TrustHub features off.
2. Apply P11 first.
3. Expose only `consumer` through Data API.
4. Test `consumer` schema recognition.
5. Verify `network` and `ops` remain unavailable/server-only.
6. Continue P12-P19 only if those checks pass.

Do not create an out-of-band empty schema and do not expose `network` or `ops`.

### E. Feature flags

The current production deployment still returns 404 for `/v1/my/health`, so My TrustHub remains effectively unavailable and the canary has not started. The Vercel connector confirms the production deployment and canonical domain but does not expose environment-variable values; exact production variable inventory must still be checked before a future P20 code deployment.

This does not block database-only migration approval because the deployed application does not contain the My TrustHub routes. No flag or canary allowlist was changed in this resumed P20B work.

### F. Permanent database

Fresh read-only connector results:

- Project status `ACTIVE_HEALTHY`, region `us-east-1`, PostgreSQL `17.6.1.141`
- Only migration `20260907170303 remote_schema`
- Only branch `main`
- `consumer`, `network`, and `ops` do not exist
- No tables returned for `public`, `consumer`, `network`, or `ops`
- P11-P19 remain unapplied

### G. Auth users

`auth.users` contains zero rows. No user was created.

### H. Security Advisor

Fresh result: **zero findings**. This is the pre-migration baseline, not post-migration certification.

### I. Performance Advisor

The single informational `auth_db_connections_absolute` finding remains. Auth is configured for at most ten database connections. No change was made; review it before compute scaling.

### J. Files / configuration changed

Updated P20B evidence only:

- `artifacts/p20b-permanent-preflight.json`
- `docs/my-trusthub-phase-2-prompt-20b.md`
- `docs/my-trusthub-production-cutover.md`

Permanent Supabase changes made by this resumed run: none. Permanent Vercel changes: none. P11-P19 remain unapplied, feature admission remains off, Auth users remain zero, and the canary remains stopped.

### K. Remaining gates

There is no remaining blocker to the narrowly scoped P11-P19 migration approval while My TrustHub remains unavailable and the approved Data API sequence is enforced.

Before deploying P20 application code, verify the exact Vercel production feature-variable inventory. Before Stage 1, run the controlled authenticated email/PKCE/session canary. CAPTCHA, custom SMTP, restore drills/measured RTO, hub credentials, export storage, deletion workers, production source adapters, Watch, Alerts, and email delivery remain later activation/public-launch gates.

### L. Migration readiness

1. **Is project-specific backup/restore readiness verified?** Yes, for Stage 0 and the initial empty-database internal canary.
2. **Is a responsible recovery operator identified?** Yes: Founder / authorized Trust Hub operator.
3. **Is uncontrolled public signup disabled?** Yes; tooling revalidated `disable_signup=true`.
4. **Are production Site URL and redirects verified?** Yes, from founder-supplied Dashboard evidence.
5. **Is Auth email/OTP configuration safe enough for internal canary?** Yes. Built-in email is accepted only for the controlled internal canary.
6. **Are session/PKCE behaviors verified?** Configuration and code/template compatibility are verified. End-to-end runtime behavior remains a Stage 1 controlled-canary test.
7. **Are abuse controls sufficient for internal canary?** Yes, for the closed allowlisted canary. CAPTCHA remains a public-launch gate.
8. **Is consumer Data API available?** No; intentionally pending P11 and the approved interstitial exposure step.
9. **Are network and ops still server-only?** Yes; neither schema exists or is exposed.
10. **Are all My TrustHub product flags still off?** My TrustHub is effectively off because the deployed application lacks its routes. Exact Vercel variable values remain unavailable through the connector and must be checked before P20 code deployment.
11. **Is the permanent schema still unapplied?** Yes.
12. **Is there any P0 blocker to applying P11-P19 with flags off?** No, provided the approved P11 -> expose only `consumer` -> verify `network`/`ops` unavailable -> continue sequence is enforced.
13. **READY FOR MIGRATION APPROVAL:** **YES**.

## Historical 2026-09-08 checkpoint

Date: 2026-09-08

Permanent project: `Conumers-Trust-Hub` (`qvvxvbcdmbjzrgvwjatw`)

Status: **PARTIAL - permanent database unchanged; three configuration gates remain manual**

Recommendation: **READY FOR MIGRATION APPROVAL - NO**

## A. Status

P20B re-ran the permanent preflight and attempted to close only backup/restore, Auth, and Data API readiness. The connected Supabase tools can query the database, branches, advisors, and project health, but do not expose hosted backup inventory, Auth configuration mutation, or Data API settings. The available Vercel connector verifies the production project, deployment, and aliases but does not expose environment-variable inventory.

No permanent configuration or database change was made. P11-P19 remain unapplied; Auth users remain zero; My TrustHub traffic remains absent.

## B. Backup / restore gate

Gate result: **BLOCKED - project-specific dashboard evidence required**

| Evidence | Result |
|---|---|
| Backup capability | Organization is Pro, but project backup inventory is unavailable through the connected tools. Not counted as verified. |
| Latest successful backup | Unverified |
| Retention / available restore window | Unverified |
| PITR | Status and restore window unverified; no paid add-on was enabled |
| Restore targets | Unverified |
| Primary recovery operator | **Founder / authorized Trust Hub operator** |
| Exact operator account | Must be recorded privately as a Supabase organization member with sufficient restore permission |
| Recovery time | Unverified until an actual restore target, database size, and Supabase restore estimate are recorded |

### Exact manual verification

The recovery operator must perform these steps in the permanent project and attach dated evidence to the launch record:

1. Open Supabase Dashboard for project `qvvxvbcdmbjzrgvwjatw`.
2. Open **Database -> Backups -> Scheduled**.
3. Record backup type, newest successful backup timestamp/status, oldest and newest available restore points, and retention period.
4. Open **Database -> Backups -> Point in Time**.
5. Record whether PITR is disabled or enabled. If enabled, record earliest/latest recovery points and retention. Do not enable it if it creates a paid add-on without separate founder approval.
6. Open the restore action far enough to confirm available targets and the platform's estimated downtime; cancel before confirmation.
7. Record the exact authorized Supabase account that will act as recovery operator in the private launch record. The repository records the operational role only.
8. Confirm the operator has organization/project permission to start restore and access the Management API or Dashboard during an incident.

Supabase documents daily/PITR restore behavior and notes that the project is unavailable during restore. The actual project backup inventory is the required evidence, not the plan default. See [Database Backups](https://supabase.com/docs/guides/platform/backups).

### Recovery procedure A - before consumer traffic

1. Keep every My TrustHub feature flag off and verify zero consumer users/writes.
2. Capture migration history, schema anchors, advisors, and the pre-cutover backup/restore point.
3. If migration application fails, stop the chain at the failing migration and preserve logs.
4. If no traffic or consumer write occurred, choose under operator review between an additive repair, the validated phase-specific rollback for the isolated failing migration, or restoring the captured pre-cutover point.
5. Reconfirm the `remote_schema` baseline, Auth user count, grants, and advisors before retrying.

Because the application has no consumer state today, recreating the empty application schema from the reviewed migration chain is possible. It is still an operator decision; the full down chain must not run automatically.

### Recovery procedure B - after consumer writes begin

1. Disable product admission and all workers using independent kill switches.
2. Preserve incident logs and identify the last known-good database time.
3. Do not run destructive down migrations against live consumer state.
4. Prefer an additive forward repair when integrity permits. If restore is required, use the verified daily/PITR target under the named recovery operator and plan project downtime.
5. Reconcile any writes after the selected recovery point, then run Auth/RLS/grant, worker, and application smoke tests before reopening traffic.

The post-launch RPO/RTO remains unapproved until the dashboard evidence and an observed or Supabase-provided restore estimate are recorded.

### What is protected before P11

The current backup, if verified, protects the existing database baseline and `remote_schema` state. It does not prove protection of future P11-P19 objects, Vercel settings, Auth SMTP configuration, external email, specialist databases, or future export artifacts. Those require their own configuration backups/runbooks.

## C. Auth gate

Gate result: **BLOCKED - hosted public signup remains enabled and dashboard settings are unavailable**

### Verified facts

- Canonical production origin: `https://www.asktrusthub.com`, confirmed by the Vercel production alias and repository configuration.
- Email Auth: enabled.
- Email confirmation: required (`mailer_autoconfirm=false`).
- Hosted account creation: enabled (`disable_signup=false`) and unsafe for internal canary.
- Google, phone, anonymous users, SAML, and passkeys: disabled.
- Auth users: zero.
- Application canary enforcement remains closed by default and uses only server allowlists or trusted `app_metadata`.
- OTP initiation uses `shouldCreateUser=false` in canary mode, responds generically for a non-allowlisted address, and the callback signs out an unentitled account.

### Required manual Auth remediation

1. Open **Authentication -> Providers -> Email** (or the current Auth general/provider settings location).
2. Disable **Allow new users to sign up** / enable the hosted `disable_signup` control. Keep Email enabled and email confirmation required.
3. Keep Google, phone, anonymous users, SAML, and passkeys disabled for the internal canary.
4. Open **Authentication -> URL Configuration**.
5. Set Site URL to `https://www.asktrusthub.com`.
6. Set the production redirect allowlist to only `https://www.asktrusthub.com/auth/callback`. Remove localhost, wildcards, preview hosts, noncanonical aliases, specialist origins, and unused paths. Staging values belong only in the staging project.
7. Open **Authentication -> Email Templates** and confirm the Magic Link template implements the code/PKCE flow expected by `/auth/callback`; do not place application tokens or user IDs into redirect URLs.
8. Open **Authentication -> SMTP Settings** and record whether the built-in sender or custom SMTP is active, sender address/name, and applicable rate limitations without copying credentials.
9. For an internal canary using the built-in sender, confirm every intended recipient is an authorized organization-team address. Supabase's default sender is intended for non-production/testing and restricts recipients; it is not sufficient evidence for public launch.
10. Open **Authentication -> Sessions** and record JWT expiry, time-box/inactivity controls, single-session policy, and refresh-token reuse protection. Preserve refresh-token reuse detection.
11. Open **Authentication -> Rate Limits** and record OTP/email and verification limits.
12. Open **Authentication -> Bot and Abuse Protection** and record CAPTCHA status. CAPTCHA may be deferred only for the allowlisted internal canary with hosted signup disabled; it remains a public-launch gate.
13. Re-query `/auth/v1/settings` and verify `disable_signup=true` without exposing the publishable key.

No paid SMTP/provider was purchased or configured. See [Passwordless email sign-in](https://supabase.com/docs/guides/auth/auth-email-passwordless), [User sessions](https://supabase.com/docs/guides/auth/sessions), and [Auth SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

### Session and callback contract

The Ask application uses `@supabase/ssr`, server-readable host-scoped cookies, middleware session refresh, `getUser()` validation, code exchange at `/auth/callback`, relative `/my` return validation, and explicit sign-out. Static structure is verified. Actual cookie flags, PKCE email link, refresh behavior, session expiry, and invalidation remain unverified until the hosted settings are recorded and a controlled authenticated canary test runs after migration.

## D. Data API gate

Gate result: **BLOCKED until P11 creates `consumer`**

| Schema | Current browser Data API posture | Required posture |
|---|---|---|
| `consumer` | Not recognized; last probe HTTP 406 | Exposed after schema creation, with P11-P19 grants and forced RLS |
| `network` | Not recognized; HTTP 406 | Remain unexposed/server-only |
| `ops` | Not recognized; HTTP 406 | Remain unexposed/server-only |

The production adapter explicitly calls `.schema("consumer")`. It does not rely on `public`. Browser code contains no parent service-role credential, and `network`/`ops` access remains through narrow server operations.

### Safe configuration sequence

Supabase PostgREST requires every configured exposed schema to exist; adding a missing schema can prevent schema-cache construction. P20B therefore did not add nonexistent `consumer` to the permanent exposed-schema list and did not create an out-of-band empty schema.

The smallest safe Stage 0 sequence is:

1. Obtain explicit approval for the permanent migration window.
2. Verify the pre-cutover backup and keep product flags off.
3. Apply P11, which creates `consumer`, `network`, and `ops` using the reviewed migration.
4. In **Project Settings / Integrations -> Data API -> Exposed Schemas**, retain existing required schemas and add `consumer` only. Do not add `network` or `ops`.
5. Save/reload PostgREST configuration.
6. Probe a nonexistent relation with `Accept-Profile: consumer`; schema recognition should change from 406 to a relation-not-found response.
7. Confirm `network` and `ops` still return 406.
8. Continue P12-P19 only after the schema-recognition check passes.
9. After the full chain, execute authenticated allow/deny tests and verify explicit grants plus forced RLS.

Manual `ALTER ROLE authenticator SET pgrst.db_schemas` is not recommended because it removes Dashboard ownership of exposed-schema configuration. See [Using custom schemas](https://supabase.com/docs/guides/api/using-custom-schemas) and [PostgREST schema-cache troubleshooting](https://supabase.com/docs/guides/troubleshooting/postgrest-error-pgrst002-could-not-query-the-database-for-the-schema-cache-c396e9).

## E. Feature flags

The production Vercel project is `conumers-trust-hub`; `www.asktrusthub.com` is a production alias. The latest production deployment is ready but predates the P20/P20A integration, and `https://www.asktrusthub.com/v1/my/health` returns 404. My TrustHub is therefore effectively unavailable and no product traffic is enabled.

The Vercel connector cannot enumerate environment-variable values, so the exact production variable inventory is unverified. Before any P20 code deployment, open **Vercel Project -> Settings -> Environment Variables -> Production** and ensure all eleven `MY_TRUSTHUB_*_ENABLED` flags are absent or exactly `false`. Verify canary allowlists are server-only and blank until approved users are chosen. The checked feature helper treats missing values as false.

The repository contracts the Supabase URL, publishable key, server-only feature flags, and canary allowlists. No `NEXT_PUBLIC_*` service-role/secret variable exists in the contract. Production Supabase variable values and any server credential remain unverified because the connector does not expose environment inventory.

## F. Permanent database

Fresh read-only verification:

- status: `ACTIVE_HEALTHY`
- region: `us-east-1`
- PostgreSQL: `17.6.1.141`
- migration history: only `20260907170303 remote_schema`
- P11-P19 tables in `public`, `network`, `consumer`, and `ops`: zero
- branches: only `main`
- P11-P19 migration files still match the P20A SHA-256 inventory

No migration, schema, table, function, seed, or consumer row was created.

## G. Auth users

`auth.users` contains zero rows. No canary identity was needed or created.

## H. Security Advisor

Fresh permanent Security Advisor result: **zero findings**. This is the current baseline before P11-P19, not a post-migration certification.

## I. Performance Advisor

One informational finding remains: `auth_db_connections_absolute`. Auth is configured for at most ten connections rather than a percentage allocation. It does not justify changing an unrelated production setting during P20B and must be reviewed before compute scaling. [Production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)

## J. Files / configuration changed

Repository audit artifacts and documentation:

- `artifacts/p20b-permanent-preflight.json`
- `docs/my-trusthub-phase-2-prompt-20b.md`
- `docs/my-trusthub-production-cutover.md`

Permanent Supabase configuration changes: none.

Permanent Vercel changes: none.

The historical P20A artifact was preserved unchanged.

## K. Remaining gates

1. Record project-specific backup/PITR/restore evidence and the exact authorized operator account.
2. Disable hosted public signup and verify Site URL, exact redirects, Auth sender, sessions, rates, and abuse controls in Supabase Dashboard.
3. Add `consumer` to exposed schemas immediately after approved P11 creates it; verify `network` and `ops` remain unavailable before continuing P12-P19.
4. Verify the production Vercel environment inventory before deploying P20 code; keep every feature flag off.

No other P20 launch gate is in scope for this recommendation.

## L. Migration readiness

1. **Is project-specific backup/restore readiness now verified?** No.
2. **Is a responsible recovery operator identified?** The operational role is identified as Founder / authorized Trust Hub operator; the exact authorized Supabase account still must be recorded privately.
3. **Is uncontrolled public signup disabled?** No; the latest verified hosted setting remains enabled.
4. **Are production Site URL and redirects verified?** Canonical hostname is verified; hosted Site URL and redirect inventory are not.
5. **Is Auth email/OTP safe enough for internal canary?** Application controls are prepared, but hosted sender/rate configuration is unverified and signup remains open. No.
6. **Are session/PKCE behaviors verified?** Application structure is verified; hosted configuration and authenticated behavior are not. No.
7. **Are abuse controls sufficient for internal canary?** Not yet verified.
8. **Is consumer Data API available?** No. It cannot be safely configured until P11 creates the schema.
9. **Are network and ops still server-only?** Yes; both remain unavailable through the browser Data API.
10. **Are all My TrustHub product flags still off?** My TrustHub is effectively unavailable in the current production deployment. Exact Vercel variable values remain unverified and must be checked before deploying P20 code.
11. **Is permanent schema still unapplied?** Yes. Only `remote_schema` exists in migration history and no P11-P19 tables exist.
12. **Is there any P0 blocker to applying P11-P19 with flags off?** Yes: recovery evidence and hosted Auth hardening remain incomplete. Data API also requires an approved P11-to-configuration sequencing step.
13. **Recommendation?** **READY FOR MIGRATION APPROVAL - NO**.

The smallest remaining remediation is one operator session in Supabase Dashboard: capture the backup/restore evidence, disable public signup and record the Auth settings, then approve a Stage 0 sequence that applies P11, exposes only `consumer`, verifies Data API recognition, and proceeds to P12-P19 only if that check passes.
