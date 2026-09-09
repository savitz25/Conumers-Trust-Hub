# My TrustHub Phase 2 Prompt 20A handoff

Date: 2026-09-08

Permanent project: `Conumers-Trust-Hub` (`qvvxvbcdmbjzrgvwjatw`)

Status: **BLOCKED at the permanent migration precheck**

Production changes: **none**

## A. Status

P20A completed the read-only permanent-project preflight and prepared a closed internal-canary access contract. The permanent migration gate is **NO** because backup/restore evidence is unavailable, critical Auth settings are unverified and public Auth signup is currently enabled, and the Data API does not expose the `consumer` schema used by the production adapter.

P11-P19 were not applied. No Auth user, canary deployment, specialist write, Watch, Alert, source job, email, export, deletion, or legacy link was created.

## B. Backup / PITR / restore

| Requirement | Finding | Gate |
|---|---|---|
| Organization plan | The connected organization reports `pro`. This does not prove the project-specific backup state. | Informational |
| Current backup tier | Dashboard/Management API evidence was unavailable. | **BLOCKED** |
| Schedule | No project backup inventory was accessible. | **BLOCKED** |
| Latest successful backup | Not visible. | **BLOCKED** |
| Retention | Not visible for this project. | **BLOCKED** |
| PITR enabled/disabled | Not visible. No paid add-on was enabled. | **BLOCKED** |
| Restore targets | No daily-backup or PITR target inventory was visible. | **BLOCKED** |
| Restore procedure | Supabase documents Dashboard and Management API restore flows, with project downtime during restore. No project-specific restore rehearsal/evidence exists. | **BLOCKED** |
| Responsible operator | Not designated in repository/operator evidence. | **BLOCKED** |
| Estimated recovery path | Cannot be estimated without the available restore points, database size, and named operator. | **BLOCKED** |

Supabase documentation says Pro projects normally receive daily backups and can buy PITR, but P20A does not treat plan-level documentation as proof that this project's latest backup exists or that PITR is enabled. See [Database Backups](https://supabase.com/docs/guides/platform/backups).

## C. Auth configuration

The public Auth settings endpoint and read-only project APIs established the following facts without exposing keys:

| Setting | Finding | Gate |
|---|---|---|
| Email Auth | Enabled | Verified |
| Public account creation | `disable_signup=false`; public Auth signup is enabled | **FAIL** |
| Email confirmation | Required (`mailer_autoconfirm=false`) | Verified |
| Google OAuth | Disabled | Verified |
| Phone Auth | Disabled | Verified |
| Anonymous users | Disabled | Verified |
| SAML / passkeys | Disabled | Verified |
| Current Auth users | Zero | Verified |
| Site URL | Not exposed by available tooling | **BLOCKED** |
| Exact redirect allowlist | Not exposed by available tooling | **BLOCKED** |
| Magic-link template and PKCE compatibility | Application callback uses code exchange; hosted template/redirect behavior was not observable end to end | **BLOCKED** |
| Session duration / refresh policy | Not exposed | **BLOCKED** |
| Secure cookie behavior in deployed environment | SSR cookie integration exists; deployed flags/domain behavior has not been observed | **BLOCKED** |
| Auth rate controls / CAPTCHA | Not exposed | **BLOCKED** |
| SMTP / sender | Not exposed | **BLOCKED** |
| Localhost absent / no wildcard specialist redirects | Exact redirect inventory unavailable | **BLOCKED** |

The dashboard session available to browser automation was unauthenticated and then stopped at Cloudflare human verification. P20A did not bypass that control.

For the canary, Supabase Auth account creation must be disabled at the platform level and only pre-created approved accounts may request a link. The application also sends `shouldCreateUser=false` in canary mode. Supabase documents that `signInWithOtp` otherwise creates a user by default; see [Passwordless email sign-in](https://supabase.com/docs/guides/auth/auth-email-passwordless).

## D. Data API / custom schema

Direct publishable-key probes returned:

- `public`: schema accepted (the deliberately nonexistent table produced the expected table-not-found response)
- `consumer`: HTTP 406, schema not exposed
- `network`: HTTP 406, schema not exposed
- `ops`: HTTP 406, schema not exposed

The checked production adapter calls `client.schema("consumer")` for narrow RPCs and owned table reads. Therefore it cannot function against the current permanent Data API configuration after migration.

The preferred remediation is to expose only `consumer` for the current adapter, then apply P11-P19 and verify every explicit grant and forced-RLS policy with two authenticated users. `network` and `ops` must remain server-only/unexposed. If operators prefer not to expose `consumer`, the alternative is a reviewed public-schema proxy/API redesign followed by a fresh rehearsal. P20A does not weaken schema isolation.

Supabase treats schema exposure and table grants/RLS as separate controls; see [Securing your Data API](https://supabase.com/docs/guides/api/securing-your-api).

## E. Migration precheck

Read-only permanent evidence:

- project status: `ACTIVE_HEALTHY`
- region: `us-east-1`
- Postgres: `17.6.1.141`
- migration history: only `20260907170303 remote_schema`
- P11-P19 tables in `public`, `network`, `consumer`, `ops`: none
- development branches: only `main`
- Security Advisor: zero current findings
- Performance Advisor: one informational Auth connection-allocation finding; Auth is fixed at ten connections rather than percentage allocation

The P20 clean rehearsal remains recorded as 577/577. P20A did not edit any P11-P19 migration. Current SHA-256 values and byte sizes are frozen in `artifacts/p20a-migration-sha256.json` for the next approval comparison.

Precheck result:

- production connection: PASS
- permanent database still baseline-only: PASS
- exact chain inventory/hash recorded: PASS
- backup/restore: BLOCKED
- Auth: FAIL/BLOCKED
- Data API: FAIL

No permanent DDL was executed.

## F. Canary flag configuration

The exact non-secret configuration is prepared in `config/my-trusthub-parent-canary.env.example`:

- enabled: master product, Saved, Projects
- restricted: canary-only mode, public signup off
- disabled: Watch, Alerts, email, export, delete, specialist handoff, source monitoring

This configuration has not been applied to a deployment. The master kill switch remains server-enforced by every dependent feature flag.

## G. Internal access model

Canary admission now fails closed when `MY_TRUSTHUB_CANARY_ONLY` is absent or not explicitly `false`. An authenticated user must match one of:

- server-only normalized email allowlist
- server-only canonical Auth user-ID allowlist
- trusted `app_metadata.my_trusthub_canary=true`

User-editable `user_metadata` is never trusted. The production adapter applies the entitlement to pages and APIs. The PKCE callback verifies the resulting user and signs out an unentitled session. OTP initiation returns a generic response for a non-allowlisted address to avoid account enumeration and cannot create an Auth user in canary mode.

No real allowlist values are committed. No internal user was supplied or created. Platform-level signup disablement remains mandatory because application controls cannot close direct calls to the hosted Auth endpoint.

## H. Permanent migration gate

**READY FOR MIGRATION APPROVAL - NO**

The gate can be reconsidered after operator evidence proves a usable restore point and assigns a restore operator, Auth signup is disabled and all Auth settings are recorded, and the intended `consumer` Data API path is configured without exposing `network` or `ops`.

## I. Migration application

Not performed. The prompt requires a stop when Parts 1-4 fail and separate founder approval before application.

## J. Authenticated E2E

Not run against the permanent project or a canary deployment. The permanent schemas do not exist, Auth has zero users, and the migration gate is closed. Claiming a pass would be false.

After the gate clears, the required run remains: sign-in, empty Home, controlled entity Save, Saved Research, two Projects with one Saved row, one membership removal, private note, archive/restore, memory setting, selected guest restore, sign-out, and persistence after sign-in.

## K. Negative authorization E2E

Not run in the permanent environment. The 577-case rehearsal proved the database authorization contracts, but P20A still requires deployed two-user and dual-role browser/API evidence after migration. Required cases remain A-versus-B Saved/Project/note read and mutation denial, anonymous denial, and proof that a Business Manager role creates no bypass.

## L. Accessibility / mobile

The P20 unauthenticated viewport checks remain green. Authenticated 1440/390/320, keyboard, dialog, Escape, and focus-restoration testing was not possible because no canary exists. It remains a Stage 1 gate.

## M. Cache / SEO

Static controls remain present for `/my`, `/auth`, and `/v1/my`: private/no-store, noindex/nofollow/noarchive, no-referrer, nosniff, frame denial, and robots exclusions. Authenticated cross-session cache testing was not possible and remains a canary requirement.

## N. Kill switch

Static assertions prove all dependent gates require `MY_TRUSTHUB_ENABLED`; the canary manifest keeps high-risk features off. Runtime proof against a deployed canary was not possible. Turning the master flag off is expected to return the product route's not-found boundary without deleting data and must be demonstrated after deployment.

## O. Files changed

- `lib/my-trusthub/canary-access.ts`
- `lib/my-trusthub/production-adapter.ts`
- `lib/my-trusthub/http.ts`
- `app/auth/callback/route.ts`
- `app/my/actions.ts`
- `app/my/sign-in/page.tsx`
- `app/my/page.tsx`
- `.env.example`
- `config/my-trusthub-parent-canary.env.example`
- `scripts/assert-p20a-canary.mjs`
- `package.json`
- `artifacts/p20a-migration-sha256.json`
- `artifacts/p20a-permanent-preflight.json`
- `docs/my-trusthub-phase-2-prompt-20a.md`
- `docs/my-trusthub-production-cutover.md`

## P. Remaining gates

For Stage 0/permanent migration: backup inventory/latest success/restore operator, complete Auth configuration with hosted signup disabled, and consumer Data API path.

For Stage 1/internal parent canary: separately approved migration, pre-created approved accounts, deployment config, post-migration structure/advisors, authenticated positive and negative E2E, dual-role isolation, authenticated cache/SEO, accessibility/mobile, failure states, and runtime kill switches.

Before public Save/Projects: public signup policy and abuse controls, legal/privacy copy, support/observability, reviewed empty/failure states, and an explicit Stage 2 approval.

Before six-hub integration: per-hub BFF implementation/credentials, accepted entity-binding manifests, canonical link flow, context and resume round trips, and per-hub staging/security tests.

Before Watch/Alerts/email: certified source capabilities and baselines, production monitoring/schedulers, fanout observability, then separately authenticated transactional email infrastructure and controlled delivery testing.

## Q. Recommendation

1. **Backup/restore verified?** No.
2. **Production Auth verified?** No. A few public settings are known; public Auth signup is enabled and critical configuration is unavailable.
3. **Data API verified?** No. The current `consumer` adapter path is rejected by the permanent Data API.
4. **Safe to apply P11-P19 with feature flags off?** No, not until the three gates above are closed.
5. **Parent-only canary safe?** Not yet. The application admission contract is prepared, but no permanent schema/deployment/authenticated evidence exists.
6. **Any consumer isolation failure?** No database isolation failure occurred in rehearsal. Permanent authenticated E2E has not been run, so production isolation is not yet certified.
7. **Any P0 blocker to Stage 1 internal canary?** Yes: backup/restore, Auth, and Data API.
8. **What remains before public Save/Projects?** Complete Stage 0 and Stage 1 evidence, then satisfy public Auth/abuse, privacy/legal, support, and observability gates.
9. **What remains before six-hub integration?** Hub-specific BFFs, credentials, bindings, identity links, and authenticated round trips for each hub.
10. **What remains before Watch/Alerts/email?** Source-by-source certification and healthy baselines, monitored fanout, and a separately certified transactional email provider.

The recommendation is **NO-GO** for migration approval and **NO-GO** for Stage 1 today. The smallest remediation is operator-supplied backup/Auth evidence plus disabling hosted signup and exposing only the reviewed `consumer` Data API path. Then rerun this precheck and request explicit founder migration approval.
