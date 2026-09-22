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

Activation order after authorization: pin isolated host and reviewed base objects; apply private ports; create the restricted login and set its server-only password; freshly reverify PUBLISHABLE and separately create the exact approved binding; run assertions and the authorized hosted matrix; provision the two preview service key pairs and peer public keys; wire Builder 3 source nonce/store/callback/current-grant bridge; apply branch-scoped preview env; deploy only the reviewed preview branches; verify SHAs at the exact aliases; rerun the whole A/B journey from the beginning. Never merge #185/#157 or promote production as part of this packet.

Runtime returns unavailable if the exact config, login flags/memberships, raw-table denial, private-port readiness marker, isolated Auth service, source assertion/publication or approved binding cannot be verified. It has no SQLite, memory, legacy Auth or admin credential fallback.

Operational cleanup, after separate authorization, may use the existing nonlogin `myth_v23_cleanup` role to delete a bounded batch of expired `v23_private.preview_transport_records` older than one hour. Do not remove P12 Saved/Project rows or durable receipts. No job, cron, configuration or hosted cleanup was installed here. Teardown requires disabled ingress, drained connections and unchanged staging-origin preconditions; it preserves original research and restores the recorded staging origin arrays.
