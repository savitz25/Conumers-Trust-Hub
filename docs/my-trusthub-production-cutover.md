# My TrustHub production cutover plan

Date: 2026-09-10
Current recommendation: **STAGE 4 = CLOSED. READY FOR STAGE 5 = YES.** Production Contractor Save and daily exact-license DBPR v2 polling are certified. The founder explicitly accepted the source-contract change; one enabled v2 coverage row replaces v1 while retaining history. Two actual scheduler-path checks accepted Delinquent,Active with separate statuses and no manufactured official clock. Alerts and email remain OFF; canary-only remains ON and signup OFF. See [Stage 4 evidence](my-trusthub-stage-4.md) and ../artifacts/my-trusthub-stage-4.json.

Earlier checkpoints and prelaunch instructions below are historical records, superseded for completed stages by their recorded authorized cutovers. They do not reopen Stage 4 or authorize later feature activation.

## Stage 3 closeout - 2026-09-09

Stage 3 implementation merged as `0e9e0eb738d8cd45aeeb8abc94e043d2b40dd704`. Production registered only `move.inventory/v1`, based on the real Move inventory calculator's aggregate planning grain. The founder canary left two explainable private sessions: one directly saved/updated session and one device-local guest import; duplicate guest import created no extra session.

The live master gate was deployed OFF/ON without changing session rows. Cross-user/business-role isolation, sensitive and invalid payload rejection, P18 one-use handoff replay protection, 1440/390/320 layout, cache/SEO privacy, and public Ask regression checks passed. See `docs/my-trusthub-stage-3.md` and `artifacts/my-trusthub-stage-3.json`.

## Stage 2 closeout - 2026-09-09

Stage 2 code merged as `7674cb6207bb8e4eadd16bb2380bc66dd20174de` and was production-certified on the matching deployment lineage. The workspace now includes coherent Home, Projects, Saved, and You navigation; many-to-many Saved membership; Project rename/archive/restore; private notes; and explicit P12 guest-import preview/commit behavior.

The live founder canary completed duplicate-Save, multi-Project, membership removal/re-addition, archive/restore, private-note create/edit/delete, device-local guest restore, sign-out/sign-in, and 1440/390/320 responsive checks. The master gate was deployed OFF and returned `/my` as unavailable without changing any consumer row, then restored ON. `/`, `/ask`, and protected `/admin` remained healthy throughout.

Final controlled state is one confirmed canonical Auth user, one Profile, one Saved record, two Projects, two memberships, zero Notes, one sanitized guest-import receipt/item, and zero Watches, Alerts, deliveries, or source observations. Full evidence and remaining boundaries are in `docs/my-trusthub-stage-2.md` and `artifacts/my-trusthub-stage-2.json`.

## P20D final closeout - 2026-09-09

The exposed general Resend key was replaced with a minimum-permission
`sending_access` key after inventory confirmed the Ask server-side transactional
mailer as its only application consumer. A controlled transactional send passed,
Production `RESEND_API_KEY` was updated and redeployed, and Supabase Auth's
separate SMTP credential remained unchanged. The exposed key and two unused
intermediate rotation keys were then revoked; the stale local reference was
removed. No secret value was committed or logged.

The live master switch was set false and redeployed: `/my` returned 404 while
the homepage, Ask, and protected Admin remained healthy. The exact founder
profile, Saved, and Project identifiers and counts were unchanged, with Watches,
Alerts, and deliveries still zero. The switch was restored to true and deployed
as `dpl_6e9qXiSr6yYZZZF9raT6M9ZNC8ZQ`. The 1440/390/320 responsive and
accessibility closeout found no overflow, navigation obstruction, semantic,
focus, form-label, control, or sign-out defect. P20D is closed.

## P20D completion - 2026-09-09

Production merge `d90664b9de5ed22e31d9c3eae8aba9adbbf86c23` is live as
`dpl_GAB2MNWdX2rFk14GP1wQJwBF2Wqn`. The Auth blocker was the Supabase built-in
SMTP project-wide email rate limit (`over_email_send_rate_limit`, HTTP 429).
Supabase Auth was moved to the existing approved Resend transactional service
with a dedicated sending-only credential. The application now handles expected
delivery errors as generic inline form errors rather than route-level 500s.

The Production PKCE callback established the sole canonical founder session.
The controlled data canary contains one profile, one idempotent Saved record,
and one active restored Project. Membership remove/re-add and Project
archive/restore preserve the Saved record. Transaction-scoped cross-user,
anonymous, specialist-role, `network`, and `ops` browser-access checks all fail
closed. The backing canary entity is internal-only, has no public profile route,
and cannot affect ranking.

Final counts: Auth users 1; profiles 1; Saved 1; Projects 1; Watches 0; Alerts 0;
deliveries 0; delivery attempts 0; source observations 0. Private/no-store,
noindex, and no-referrer headers remain present. `/`, `/ask`, and protected
`/admin` passed regression checks. The founder-only feature state is restored;
public signup and all Stage 2 capabilities remain disabled.

## P20D resume - 2026-09-09

The P20D delta was rebased onto the live production base, passed repository tests, TypeScript, lint, optimized build, 66/66 P20D assertions, secret/fixture scans, and `git diff --check`, then deployed through the guarded `main` Git integration. Active production is `15edadbf4d32904f002a3ecf083dcc39b7a0e42e` / `dpl_6nVexyWQwcbUTnMAnxDPwanevhqU`, which contains the P20D deployment commit `b0a8383054269f3bbd5364a0044597c59eb307d0`.

Homepage, Ask, and protected Admin checks remained healthy. Anonymous Saved and Projects redirect to sign-in; Watch and Alert routes are absent; My TrustHub responses are private/no-store and noindex. A non-allowlisted email received generic copy and created no user. The approved founder request failed with `Unable to send the sign-in link`; current Supabase built-in SMTP restricts recipients to project-organization members unless custom SMTP is configured. Organization membership may be privileged/paid and custom SMTP requires new credentials/configuration, so neither was changed under P20D.

The hard stop preserved the safe database state: one entitled Auth user and zero profiles, Saved rows, Projects, Watches, Alerts, deliveries, or source observations. Resume only after the founder approves and completes an Auth delivery path, then request/open a fresh Magic Link in the same browser profile. Stage 2 remains blocked until PKCE, Save, Projects, authenticated authorization, kill-switch preservation, and authenticated desktop/mobile/accessibility checks pass.

## P20D-PREP clean production-main integration - 2026-09-09

The recovered tree was preserved on local snapshot branch
`my-trusthub-p20d-recovered-snapshot` at
`a5b569c9a53e6227891757cb4387ceab1587921d`. The deployable preparation lives on
`my-trusthub-p20d-canary-integration`, based on confirmed production-main commit
`f8a80a10535d37776b46ba85ee770495ffa5fa3e`. Vercel deployment
`dpl_8qqLF6QqVDD4pzy2t8o8zL7ddFFh` is READY at that same SHA.

The package contains only the Stage 1 Auth, Home, Saved, Project, and membership
runtime. Consumer Lab and later-stage My TrustHub routes/adapters are absent.
Server admission requires both the trusted canary claim and an approved identity;
the canary-only OTP flow cannot create users. The exact Vercel manifest and
founder-only supported Auth Admin procedure are documented in
`config/my-trusthub-p20d-vercel-env.md` and
`docs/my-trusthub-p20d-manual-activation.md`.

Local certification passed the current-main repository suite, TypeScript,
changed-file lint, optimized production build, P11-P19 static stack, P20D-PREP
57/57 assertions, diff/secret/fixture scans, and built route inventory. The
creation script was not run; no branch was pushed and no preview or production
deployment was created. The newer-than-P19 physical backup remains pending
founder Dashboard verification.

Resume only after the founder completes the two manual activation steps. Then
revalidate alignment and all stop gates, deploy this reviewed branch, execute the
one-user runtime canary, and stop before Stage 2.

## P20D hard stop before canary activation - 2026-09-09

The approved founder canary address was received, but P20D stopped before any production mutation. Live checks confirmed `auth.users=0`, public signup disabled, all product/canary tables empty, and `/my`, `/auth/callback`, and `/v1/my/health` still returning 404.

The connected Supabase interface has no canonical Auth Admin invite/create or app-metadata operation, and the connected Vercel interface has no environment-variable operation. Direct Auth-table insertion and committing the private founder address were rejected. The recovered local branch also predates current production `main` and includes Phase 1 fixture routes, so it must not be deployed wholesale.

P20D remains incomplete and **NOT READY FOR STAGE 2 APPROVAL**. Resume only when a supported privileged Auth/Vercel control-plane path is available; then integrate the reviewed My TrustHub source onto current production `main`, activate only Auth + Saved + Projects, create exactly one entitled founder user, and run the full runtime canary. See `docs/my-trusthub-phase-2-prompt-20d.md` and `artifacts/p20d-internal-canary.json`.

## P20C-RESUME permanent certification - 2026-09-09

Founder-approved P20C-RESUME replaced P15's validation-only absolute timestamps with deterministic offsets from one transaction timestamp. The production migration and two-hour freshness policy were not changed. P15 passed 64/64 against the already-installed schema, after which unchanged P16-P19 migrations were applied in sequence. P19 completed at `2026-09-09T14:28:44Z`.

The first cumulative final runner exposed a separate validation-harness boundary: P18 and P19 validation seeds contain their own `BEGIN/COMMIT`; P18's `COMMIT` committed earlier P14-P17 seed configuration. The exact deterministic fixture inventory was asserted and removed. Final matrices were then run phase-by-phase inside authoritative rollback transactions, omitting only the P18/P19 seed wrapper lines in memory. Checked-in seeds and migrations were not modified. Final result: P11 31/31, P12 56/56, P13 58/58, P14 62/62, P15 64/64, P16 67/67, P17 70/70, P18 72/72, and P19 97/97: **577/577**.

Permanent certification at `2026-09-09T14:43:42Z` found 58/58 tables with enabled and forced RLS, zero validation fixtures, zero consumer/runtime data, zero Auth users, no Edge Functions, and no cron installation/jobs. Data API probes returned consumer `404` for a nonexistent relation (schema exposed), network `406`, and ops `406`; anonymous consumer profile GET/POST both returned `401`. Auth returned `disable_signup=true`. Production `/v1/my/health` remains `404`.

Security Advisor has no ERROR/WARN findings; its 19 INFO findings are intentionally locked server-only tables with forced RLS and no browser exposure. Performance Advisor has 28 expected unused-index INFO findings on the empty schema plus the existing Auth connection-allocation INFO. No Advisor-driven production change was made.

The accepted pre-migration physical backup remains `2026-09-09T05:30:36Z`. Verify the next scheduled physical backup after the completed migration before broader activation. Do not create a canary user, deploy/enable My TrustHub, start workers, or send email until the separately approved P20D step.

## P20C partial permanent migration - 2026-09-09

Founder-approved P20C began against the permanent project with all product capabilities off. Final preflight passed, P11 was applied first, and P11 passed 31/31 before Data API configuration. Only `consumer` was added to the exposed schema list; live probes then returned `consumer=404` for a nonexistent relation while `network=406` and `ops=406`, proving the required interstitial boundary.

P12, P13, P14, and P15 DDL were then applied in order. P12 passed 56/56, P13 passed 58/58, and P14 passed 62/62 using its validation-only seed inside a rollback-only transaction. P15's correctly seeded matrix aborted because its fixed September 8 checkpoints exceeded the two-hour freshness window on September 9, yielding a null `event_v2` change-event identifier. P16-P19 were not applied.

The failed P15 transaction left no fixture rows. `auth.users` remains zero; capability, observation, checkpoint, Watch, and related test-data counts are zero. Production `/v1/my/health` remains 404 and public signup remains disabled. Do not create a canary user or activate any feature.

The smallest blocker is a reviewed test-only correction that makes P15 fixture times transaction-relative without weakening the production two-hour freshness contract. Founder approval is required before changing the test harness, rerunning P15, or resuming P16-P19. Do not execute destructive down migrations merely because validation stopped.

Full partial-cutover evidence is in `docs/my-trusthub-phase-2-prompt-20c.md`; machine-readable state is in `artifacts/p20c-permanent-migration.json`.

## P20B resumed permanent control-plane preflight - 2026-09-09

P20B is **GO for migration approval** within the narrow Stage 0 scope. No migration, DDL, user creation, canary activation, feature enablement, or unrelated production change was performed during the resumed preflight.

Founder-supplied permanent-project Dashboard evidence closes the backup/restore gate for the empty-database internal canary: scheduled physical daily backups are visible from September 2 through September 9, the latest visible successful backup is `2026-09-09T05:30:36Z`, every visible backup has a Restore action, and Founder / authorized Trust Hub operator owns recovery. PITR is not required for this initial empty-database canary. Restore drills, measured RTO, and stricter post-write recovery requirements remain later gates.

The public Auth settings endpoint independently confirms `disable_signup=true`, email enabled with confirmation required, and phone, Google, anonymous users, SAML, passkeys, and other unnecessary providers disabled. Founder evidence confirms the exact production Site URL and sole callback redirect, accepted rate/session settings, built-in email, and deferred CAPTCHA. These settings are sufficient for the closed allowlisted internal canary; custom SMTP and CAPTCHA remain public-launch gates.

The current `{{ .ConfirmationURL }}` Magic Link template is compatible with the AskTrustHub `@supabase/ssr` PKCE flow. The server action supplies the exact `/auth/callback?next=/my` redirect and the callback exchanges the returned Auth Code with `exchangeCodeForSession`. A direct `token_hash` template would require a coordinated callback change to `verifyOtp`; do not make that template-only change. End-to-end email/session behavior remains a controlled Stage 1 canary test.

Fresh read-only checks show the permanent database is healthy, has zero Auth users, only `remote_schema`, no `consumer`, `network`, or `ops` schemas/tables, and only `main`. Data API probes return `public=404`, `consumer=406`, `network=406`, and `ops=406`. Security Advisor is empty; Performance Advisor retains the informational fixed Auth connection-allocation finding. P11-P19 remain unapplied.

The approved Data API sequence remains mandatory during the future migration window:

1. keep all My TrustHub features off;
2. apply P11 first;
3. expose only `consumer`;
4. test `consumer` schema recognition;
5. verify `network` and `ops` remain unavailable/server-only;
6. continue P12-P19 only after those checks pass.

The production `/v1/my/health` endpoint still returns 404, so My TrustHub is effectively unavailable and no canary has started. Exact Vercel environment-variable values remain inaccessible through the connector and must be checked before deploying P20 application code; they do not block the database-only migration approval while the deployed application lacks My TrustHub routes.

Full evidence is in `docs/my-trusthub-phase-2-prompt-20b.md`; machine-readable results are in `artifacts/p20b-permanent-preflight.json`.

## Historical P20B partial checkpoint - 2026-09-08

P20B remains **NO-GO for migration approval**. Fresh read-only checks show the permanent database is healthy, has zero Auth users, only `remote_schema`, no P11-P19 tables, and no branch beyond `main`. Security Advisor is empty; Performance Advisor retains the informational fixed Auth connection-allocation finding.

The connected tooling cannot access project backup inventory or hosted Auth/Data API configuration. The recovery operator role is now assigned to **Founder / authorized Trust Hub operator**, but the exact authorized account and project-specific backup/restore evidence must be recorded privately in Supabase Dashboard.

Hosted public signup remains enabled from the latest verified public Auth settings. Before migration approval, the operator must disable it and record Site URL, exact redirects, Auth email sender, session policy, rate limits, and abuse controls. The exact production callback allowlist is `https://www.asktrusthub.com/auth/callback`; no localhost, wildcard, preview, alias, or specialist URL belongs in the production list.

Data API configuration has a necessary interstitial sequence. The `consumer` schema does not exist before P11, and Supabase warns that configuring a missing exposed schema can break PostgREST schema-cache loading. Do not create an untracked empty schema. During a separately approved Stage 0 window:

1. apply P11 with all product flags off;
2. add only `consumer` to Data API exposed schemas;
3. verify `consumer` is recognized and `network`/`ops` still return 406;
4. proceed with P12-P19 only after that check passes.

The live Ask deployment predates P20 and `/v1/my/health` returns 404, so My TrustHub traffic is absent. Before deploying P20 code, verify all production My TrustHub feature variables are absent/false. Full evidence and manual steps are in `docs/my-trusthub-phase-2-prompt-20b.md`; machine-readable results are in `artifacts/p20b-permanent-preflight.json`.

## P20A permanent preflight - 2026-09-08

The read-only permanent preflight remains **NO-GO**:

- project `qvvxvbcdmbjzrgvwjatw` is healthy in `us-east-1`, has zero Auth users, only the existing `20260907170303 remote_schema` migration, and no P11-P19 tables
- project-specific backup inventory, latest successful backup, PITR state, restore targets, restore operator, and recovery estimate could not be verified
- public Auth settings show email enabled, confirmation required, Google/phone disabled, and hosted public signup still enabled (`disable_signup=false`)
- Site URL, exact redirects, session settings, CAPTCHA/rate controls, SMTP/sender, and deployed PKCE behavior remain unverified
- Data API probes accept `public` but reject `consumer`, `network`, and `ops`; the current production adapter requires the `consumer` schema
- no permanent migration or production configuration change was made

Before requesting migration approval, disable hosted Auth signup, record the complete Auth configuration, prove a recoverable backup and assign its operator, and configure the reviewed Data API path. Expose only `consumer` for the current adapter; retain `network` and `ops` as server-only schemas. Compare the migration files with `artifacts/p20a-migration-sha256.json` before applying them.

The parent-only canary application contract is prepared in `config/my-trusthub-parent-canary.env.example`. It keeps signup, Watch, Alerts, email, export, deletion, specialist handoffs, and source monitoring off while allowing only server-entitled internal users to use Saved and Projects after a separately approved migration.

## Hard preconditions

Founder approval is required after a final GO report. Before that approval, do not apply P11–P19 to project `qvvxvbcdmbjzrgvwjatw`, enable consumer traffic/workers, send customer email, migrate legacy users, or activate specialist writes.

The operator must record evidence for:

- recent backup, PITR posture, restore procedure, and named restore operator
- Supabase Auth Site URL, exact redirect allowlist, providers, session settings, abuse/rate controls, SMTP/sender configuration
- `consumer`, `network`, and `ops` Data API schema exposure required by the chosen adapter path, with grants/RLS retested
- all 577 SQL cases on a clean rehearsal branch
- clean Security Advisor and reviewed Performance Advisor results
- server-side feature flags present and off
- private export bucket, authenticated download, seven-day expiry, cleanup, and hash verification
- deletion worker, seven-day grace/cancel, retry/resume, dual-role preservation
- hub-specific credentials/assertion issuer and per-hub staging round trips
- each enabled Watch grain's production source certification and healthy baseline
- transactional email authentication, webhook validation, bounce/complaint/suppression handling, and controlled test inbox evidence before email activation

## Migration rehearsal and permanent plan

1. Freeze the exact reviewed commit and migration hashes.
2. Confirm the permanent project still contains no P11–P19 objects and no consumer product writes.
3. Record backup/PITR evidence and restore owner.
4. Keep every My TrustHub flag off and stop all future workers/schedulers.
5. Apply forward migrations in timestamp order:
   - `20260907160000_my_trusthub_identity_foundation.sql`
   - `20260907190000_my_trusthub_saved_projects_guest_import.sql`
   - `20260907220000_my_trusthub_cross_hub_handoffs.sql`
   - `20260908122551_my_trusthub_watch_capabilities.sql`
   - `20260908134944_my_trusthub_source_observations.sql`
   - `20260908153000_my_trusthub_consumer_alerts.sql`
   - `20260908180000_my_trusthub_notification_delivery.sql`
   - `20260908190000_my_trusthub_saved_sessions.sql`
   - `20260908210000_my_trusthub_decisions_export_delete.sql`
6. Validate schemas, objects, forced RLS, explicit grants, service roles, and zero fixture rows.
7. Run all SQL matrices, static assertions, Security Advisor, and Performance Advisor.
8. Smoke test with controlled consumer-only and dual-role accounts while all public flags remain off.
9. Record the result and obtain activation approval for the first stage only.

Rollback scripts are rehearsal/emergency aids. If a migration fails before traffic and the failing migration is proven isolated, roll it back or repair it under operator review. After consumer writes begin, prefer an additive forward fix; never execute the full down chain blindly on a live database.

## Staged activation

| Stage | Enablement | Preconditions |
|---|---|---|
| 0 | Migrations only; all flags off | Backup/PITR and migration evidence complete |
| 1 | Internal founder/test users | Auth, RLS, cache, logs, and dual-role canary green |
| 2 | Account, Save, Projects | Signup/Save/Project flags; parent state only; selected hub BFFs may follow individually |
| 3 | Saved sessions and Continue | Per-hub schema/resume adapter certified |
| 4 | Watch | Only individually certified grains with current baseline/health |
| 5 | Alerts | Change detector and fanout monitoring proven |
| 6 | P0 email | Provider/domain/webhook/bounce controls and test inbox green |
| 7 | Public lander/broader availability | Support, legal/privacy copy, observability, and rollback review complete |

Each stage has its own rollback to feature flags off. Do not combine stage approvals.

## Canary

Prepare one synthetic/internal consumer-only account and one controlled dual-role account. The dual-role test must show that the same canonical auth subject can use its own consumer workspace while Business Manager authorization neither reads nor deletes consumer data, and consumer deletion preserves the company claim and auth identity.

## Smallest remediation for GO

1. Verify Auth and backup/PITR/restore settings through Supabase dashboard/operator evidence; the clean-branch 577-case rehearsal is complete.
2. Verify the custom-schema Data API configuration and run an authenticated parent canary.
3. Provision and stage the parent assertion issuer plus a hub-scoped BFF and binding manifest before enabling that hub.
4. Configure private export storage and the deletion worker before exposing those controls.
5. Keep Watch and email flags off until at least one source and the transactional provider separately pass certification.

This allows a narrower GO for Stage 0–2 while later stages remain off.
## Stage 4 runtime closeout — 2026-09-10

| Hub | Save handoff | Resume handoff | Watch capability | Source monitoring | Deferred gaps |
|---|---|---|---|---|---|
| Ask | Live receiver for exact certified Contractor profile | Parent move.inventory/v1 retained; cross-domain consumer deferred | Parent UX for contractor.fl.dbpr.license_status v2; disabled v1 history retained | Daily exact DBPR lookup; two accepted real scheduler-path observations | Other hub/profile classes |
| Contractor | Live: CCC1332036 / native 0001ac38-0c96-4e2f-8bf6-9ab243f7b79b only | Unsupported | contractor.fl.dbpr.license_status v2 through parent | Parent-owned daily exact license lookup | Additional profiles and other grains |
| Move | Deferred; CTA omitted | Deferred: itemized calculator cannot reconstruct inventory from aggregates | Deferred | No My TrustHub adapter | Scoped P13 integration and aggregate P18 receiving model |
| Lender | Deferred; CTA omitted | Unsupported | Deferred | No My TrustHub adapter | Hub/class-specific P13 and Watch certification |
| Insurance | Deferred; CTA omitted | Unsupported | Deferred | No My TrustHub adapter | Hub/class-specific P13 and Watch certification |
| Senior | Deferred; CTA omitted | Unsupported | Deferred | No My TrustHub adapter | Hub/class-specific P13 and Watch certification |
| Investor | Deferred; CTA omitted | Unsupported | Deferred | No My TrustHub adapter | Hub/class-specific P13 and Watch certification |

The v2 primary source is DBPR Verify a Licensee / exact Search by License Number. Bulk data is discovery only and absence never implies status. The real CCC1332036 lookup returns Delinquent,Active, retained as primary delinquent and secondary active. source_as_of is NULL because DBPR publishes no record-as-of timestamp. Retrieved/checked-at and observation time are separate.

At 15:02:49.138315 UTC the authorized founder canary explicitly submitted consent revision dbpr-exact-lookup-v2/2026-09-10. Registration had left v1 selected. The atomic operation disabled v1, enabled one v2 row and retained the same active Watch/history. Production scheduler invocations at 15:03:17.776 and 15:04:23.627 UTC accepted a baseline and unchanged check. Daily execution remains 12:41 UTC; its next future wall-clock run is September 11.

The scoped ingestor has only the four fixed v1/v2 target/poll functions, zero table grants, no broad consumer access and no Alert fanout. P13 remains live for the exact Contractor profile only. Issuer/audience/state/replay/expiry and private Watch authorization pass. Version consent, status-pair changes, idempotence, failure health, ordering/schema protections and mass-change quarantine pass isolated certification. No fake observations entered production.

The final master OFF/ON test preserved Watch row version 6 and one enabled v2 coverage; monitoring intentionally stops while master is OFF. All seven production homes and key routes passed. The 1440/390/320 consent and Watch UI checks passed after a mobile layout fix. Current health is complete/compatible/current. Counts at final Stage 5 verification are 1 Auth user, 1 profile, 2 Saved, 2 Projects, 2 research Sessions, 1 Watch, 1 enabled v2 coverage, 1 disabled v1 coverage, 5 observations, 6 checkpoints, 0 change events, 0 Alerts and 0 deliveries.

## Stage 6 production cutover — 2026-09-10

P17 notification delivery is live through the existing P17 tables and a dedicated `myth_notification_delivery` runtime. `MY_TRUSTHUB_EMAIL_ENABLED=true` is restored after a kill-switch test. P0 is immediate; P1 is batched into hourly due-local-time digests; P2 remains disabled by default. `/my/you` exposes global defaults, timezone/digest controls, and per-Watch inheritance/override controls. Resend credentials remain server-only.

The unchanged real DBPR Watch still has zero Alerts and zero consumer delivery rows. The worker ran successfully with no pending work. One labeled `test/canary` transport email to `hello@asktrusthub.com` was accepted by Resend and recorded in the separate transport-canary ledger without creating an Alert. Provider retries are bounded, delivery uniqueness is Alert/channel/policy/window based, and the email kill switch suppresses new outbound sends without changing Alerts, Watches, or source polling. Stage 7 owns additional channels and richer delivery history.

Alerts, email, export, deletion and signup remain OFF; master, Watch, certified source monitoring, the exact specialist handoff and canary-only remain ON. Move resume, other Save classes and additional Watch grains are explicitly nonblocking deferrals. **Stage 4 is closed; Stage 5 may begin as separate work.**

## Stage 5 production cutover — 2026-09-10

The existing P16 Alert foundation is live with the additive runtime and UI. `MY_TRUSTHUB_ALERTS_ENABLED=true` is enabled for production; `MY_TRUSTHUB_EMAIL_ENABLED=false` remains unchanged. The daily DBPR cron now polls through the existing scoped P15 runtime and drains only approved pending material events through the governed P16 fanout function. The runtime has no browser credential and no consumer table grant.

The founder canary remains pinned to enabled v2. The exact unchanged CCC1332036 record produced no material event and no consumer Alert. A rollback-only exact-v2 fixture produced one deterministic P2 Alert, duplicate fanout remained one, and no fixture Alert or change event remains in production. P16 pause, version, owner, source-failure, correction/retraction, read-state, and mass-change protections remain governed by the existing foundation matrix. `/my/alerts` is private and no-store with truthful empty/no-new-change states. Stage 6 is responsible for any email, push, SMS, or digest delivery.
## Stage 7 release gate (2026-09-10)

P19 export and deletion runtime is now additive and production-capable. Export jobs persist an owner-scoped `mytrusthub-export/v1` bundle with seven-day expiry and a private no-store download route. Deletion retains the P19 seven-day grace/cancel flow, checkpointed worker steps, and 30-day operational retention boundary. Both runtime workers use dedicated database roles and server-only Vercel URLs; no service credential is client-visible.

The verified closed prelaunch configuration is `MY_TRUSTHUB_ENABLED=true`, `MY_TRUSTHUB_CANARY_ONLY=true`, `MY_TRUSTHUB_SIGNUP_ENABLED=false`, `MY_TRUSTHUB_EXPORT_ENABLED=true`, and `MY_TRUSTHUB_DELETE_ENABLED=true`; Supabase public signup remains disabled. Public launch configuration and rollback are in `docs/my-trusthub-public-launch-runbook.md`. CAPTCHA provider/account provisioning remains the only public-signup launch switch dependency. The founder canary remains intact and no synthetic user or contractor change was created.
