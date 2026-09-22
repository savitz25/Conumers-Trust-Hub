# Exact isolated preview environment packet — NOT APPLIED

Scope changes to the reviewed Ask V2-3 preview branch only. No Production or all-preview default edits. Verify the alias points to the reviewed Ask commit before JQA. Do not use a rotating immutable deployment URL as the account origin.

```dotenv
NEXT_PUBLIC_SITE_URL=https://conumers-trust-hub-git-mth-v2-3-pare-3127df-savitz25-s-projects.vercel.app
NEXT_PUBLIC_MOVE_ORIGIN=https://move-trust-hub-git-mth-v2-3-move-par-71a0b3-savitz25-s-projects.vercel.app
MY_TRUSTHUB_TEST_ORIGIN=https://conumers-trust-hub-git-mth-v2-3-pare-3127df-savitz25-s-projects.vercel.app
NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL=https://xkkiicsassizmakcvxml.supabase.co
MY_TRUSTHUB_TEST_SUPABASE_URL=https://xkkiicsassizmakcvxml.supabase.co
MY_TRUSTHUB_NONPRODUCTION_APPROVED=true
MY_TRUSTHUB_ENABLED=true
MY_TRUSTHUB_SAVED_ENABLED=true
MY_TRUSTHUB_SPECIALIST_HANDOFF_ENABLED=true
MY_TRUSTHUB_V23_PROFILE_SAVE_ENABLED=true
MY_TRUSTHUB_V23_ISOLATED_PROJECT=xkkiicsassizmakcvxml
MY_TRUSTHUB_V23_PARENT_ORIGIN=https://conumers-trust-hub-git-mth-v2-3-pare-3127df-savitz25-s-projects.vercel.app
MY_TRUSTHUB_V23_MOVE_ORIGIN=https://move-trust-hub-git-mth-v2-3-move-par-71a0b3-savitz25-s-projects.vercel.app
MY_TRUSTHUB_V23_SESSION_AFFINITY=dedicated
MY_TRUSTHUB_ACCESS_MODE=invitation
MY_TRUSTHUB_SIGNUP_ENABLED=false
MY_TRUSTHUB_EMAIL_ENABLED=false
MY_TRUSTHUB_WATCH_ENABLED=false
MY_TRUSTHUB_ALERTS_ENABLED=false
MY_TRUSTHUB_SOURCE_MONITORING_ENABLED=false
MY_TRUSTHUB_PROJECTS_ENABLED=false
MY_TRUSTHUB_SESSIONS_ENABLED=false
MY_TRUSTHUB_EXPORT_ENABLED=false
MY_TRUSTHUB_DELETE_ENABLED=false
MY_TRUSTHUB_AUTH_SECURITY_READY=false
```

`VERCEL_ENV` must be Vercel's actual `preview`; do not override it. The only invited IDs must be the existing isolated QA A/B UUIDs, loaded locally into server-only `MY_TRUSTHUB_INVITED_USER_IDS` through the approved credential/config channel. Clear `MY_TRUSTHUB_INVITED_EMAILS`: email matching must not broaden admission. No user IDs, emails or passwords are included here. The secure file is never changed or copied. Existing optional Projects may be listed and assigned during consent; this packet does not open the Projects creation workspace.

Keep the existing isolated `NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_PUBLISHABLE_KEY` and approved `NEXT_PUBLIC_MY_TRUSTHUB_TURNSTILE_SITE_KEY`. Verify the latter works at the stable Ask alias. Missing CAPTCHA still blocks password login; do not bypass or change Supabase CAPTCHA settings to produce a test PASS. Do not set an anon public field to service_role or a secret API key. No SMTP, email provider secret, signup or Auth user creation is authorized.

Server-only connection variable `MY_TRUSTHUB_V23_PARENT_DATABASE_URL` must use login `myth_v23_parent_preview`, direct host `db.xkkiicsassizmakcvxml.supabase.co`, explicit port `5432`, database `postgres`, and a separately provisioned password. The database **name** is postgres; the database **user** must never be postgres. No connection URL parameters, pooling endpoint or production-host fallback is accepted. `MY_TRUSTHUB_V23_DATABASE_CA_PEM` enables strict certificate and hostname verification. A dedicated/session-affine connection is required for durable confirmation locking. Login connection limit and application pool maximum are six.

The role creation SQL starts with `PASSWORD NULL`, so it is not usable until an authorized operator provisions its password through a local secure channel such as interactive `psql \password`. Do not put password/URL/private key/bypass values into SQL, CLI output, screenshots, Git, Slack, GitHub or reports. [Builder 3 handoff](BUILDER-3-HANDOFF.md) gives all key IDs and secret variable names.

Activation is strictly ordered, after separate founder authorization. Every failed or missing gate stops activation; partial success is **BLOCKED**, never READY.

1. Independently pin project `xkkiicsassizmakcvxml` and its actual TLS database host outside SQL.
2. Verify clean preconditions: reviewed P11/P12/P13/V2-3 certified objects, exactly two Ask/Move registry rows, no prior preview login/reader/wrappers/tables or preview-only grants, and the approved isolated operator. The guards at the start of `ports-forward.sql` enforce the catalog portion; a GUC does not authenticate the host.
3. Apply `ports-forward.sql`. It retains the original registry arrays and a private, non-secret ACL/role baseline before changing preview grants.
4. Create `myth_v23_parent_preview` with `runtime-role-forward.sql`.
5. Securely provision its password locally; keep all password/connection material server-only and out of SQL/output/reports.
6. Freshly reverify the exact Move identity is PUBLISHABLE within two minutes of binding apply.
7. Apply `move-binding-forward.sql`. Retain its returned `binding_id`, `network_entity_id`, and `provenance_ref` in the approved operator record.
8. Set `v23.binding_id`, `v23.network_entity_id`, and `v23.binding_provenance_ref` from that exact forward result, then run fail-closed `assertions.sql` with stop-on-error. Require `V23_PARENT_PACKET_ASSERTIONS_PASS`; inspect nothing into a PASS manually.
9. Run the separately authorized hosted V2-3 matrix. Preserve its exact evidence and cleanup boundaries.
10. Only after all prior gates pass, configure branch-scoped preview secrets/env and deploy the reviewed previews. No Production/all-preview defaults.
11. Complete Builder 3 final composition and verify both reviewed SHAs at the exact stable aliases.
12. Run the full Journey QA from the beginning, including real A/B login, consent, Save, receipt, isolation and zero Watch.

Never merge #185/#157 or promote production under this packet. Local test success does not certify hosted privileges or the browser journey.

Runtime returns unavailable if the exact config, login flags/memberships, raw-table denial, private-port readiness marker, isolated Auth service, source assertion/publication or approved binding cannot be verified. It has no SQLite, memory, legacy Auth or admin credential fallback.

Operational cleanup, after separate authorization, may use the existing nonlogin `myth_v23_cleanup` role to delete a bounded batch of expired `v23_private.preview_transport_records` older than one hour. Do not remove P12 Saved/Project rows or durable receipts. No job, cron, configuration or hosted cleanup was installed here.

Full closeout is a separate steward-approved operation. Independently pin the isolated host, disable ingress and other writers/cleanup jobs, and drain the runtime connections. Use one operator session with stop-on-error throughout: `teardown-preconditions.sql` -> `move-binding-teardown.sql` -> `teardown.sql` -> `teardown-assertions.sql`. Require `v23.binding_retirement_authorized=true`, `v23.parent_teardown_authorized=true`, `v23.closeout_writers_drained=true`, the approved project GUC, and exact retained forward IDs/provenance. No script supplies authorization on the operator's behalf.

The first script privately captures original permissions/origins, exact identity, and row-count/SHA-256 fingerprints of research and receipt tables in session-local tables. The binding script closes the existing accepted lifetime with `valid_to` and marks the same entity `retired`. It does not delete, supersede into a successor, redirect, or merge anything. The parent teardown removes only preview ports/roles/tables/grants and restores original origin arrays. The final script requires exact baseline equality and the authorized historical lifecycle before emitting `V23_PARENT_PACKET_TEARDOWN_ASSERTIONS_PASS`.

Keep all writers quiescent until verification completes. The independently authorized operator must already have the owner/lock privileges needed for SHARE locks on redirects and protected research; SELECT-only access is insufficient. Missing privileges stop this packet, without any new grants. Baseline locks end with their transaction; concurrent edits cause the final comparison to fail. Do not recapture baselines after a failure or delete research to make assertions pass. A lost operator session loses its temporary preservation proof: stop for steward review. Reopening a retired lifetime requires a separate reviewed operation with fresh collision/lifecycle checks; there is no automatic undo/merge fallback.
