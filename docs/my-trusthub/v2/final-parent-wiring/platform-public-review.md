# V2-3 Supabase PUBLIC ACL hardening — prepared, not applied

Base Ask head: `3f9c4f5e9bd720b6c49beb180add71edf1a5bfc0`, PR #185. Scope: isolated preview `xkkiicsassizmakcvxml` only. Production `qvvxvbcdmbjzrgvwjatw`, PRs #185/#157, and hosted Phases 1–4 remain HOLD. No hosted mutation, credential access, runtime code change, or Move binding operation occurred in this patch.

## Read-only audit

Branch discovery matched parent `qvvxvbcdmbjzrgvwjatw`, branch ID `7858cacd-f30b-4d4e-94dc-e1223ddbd76b`, name `mth-v2-3-isolated-integration-qa`, project ref `xkkiicsassizmakcvxml`, ACTIVE_HEALTHY. Only the isolated branch received catalog SELECTs. No SQL packet was applied.

Catalog evidence timestamp: **2026-09-22T18:42:41.559478Z**. Database name: `postgres`. Installed `pg_net`: 0.20.4, owner `supabase_admin`. Both `net._http_response` and `net.http_request_queue` are tables owned by `supabase_admin`, with actual pg_extension membership in `pg_net`. The three reviewed HTTP functions also belong to that extension. Installed `pg_stat_statements`: 1.11, owner `postgres`; both statistics views are extension members.

Exact reviewed `net` schema owner: `supabase_admin`. Grantor for **every** ACL row: `supabase_admin`; every grant option is false.

| Grantee | Privilege |
| --- | --- |
| PUBLIC | USAGE |
| anon | USAGE |
| authenticated | USAGE |
| postgres | USAGE |
| service_role | USAGE |
| supabase_admin | CREATE |
| supabase_admin | USAGE |
| supabase_functions_admin | USAGE |

The runtime's observed schema USAGE is **true on net**, **false on extensions**. Hosted pg_net access therefore remains exposed until separately authorized hardening succeeds. No hosted remediation or hosted post-hardening PASS is claimed.

Exact-head source audit: `git grep -n -i -E 'net\.http_(get|post|delete)|pg_net|supabase_functions\.http_request' 3f9c4f5e9bd720b6c49beb180add71edf1a5bfc0 -- .` found no matches. The new packet/tests/documentation necessarily introduce references; they are not application consumers.

Hosted catalog audit examined all **24 non-internal row triggers**, their target routines, direct source references and platform event triggers. **Zero pg_net-dependent application triggers/webhooks** were found. The only non-extension routine outside net/webhook infrastructure referencing pg_net is the existing `extensions.grant_pg_net_access()` platform event-trigger function. Its `issue_pg_net_access` hook is restricted to `CREATE EXTENSION`; it preserves explicit platform grants. It is not an application dependency on PUBLIC USAGE and is unchanged. No app-facing pg_net dependency was found. This static/catalog audit is not proof about future or dynamically constructed calls; the dependency audit and guards must be repeated at apply time.

## Prepared change and checks

[platform-public-hardening.sql](platform-public-hardening.sql) performs exactly one persistent ACL change:

```sql
REVOKE USAGE ON SCHEMA net FROM PUBLIC;
```

The transaction requires independent host pinning outside SQL, database `postgres`, the exact project attestation, `v23.platform_public_hardening_authorized=true`, `v23.closeout_writers_drained=true`, and no active runtime connections. It checks exact owner, installed extension version/owner, both table owners and extension membership, the complete eight-row ACL, and absence of unreviewed application/trigger dependencies. It verifies the exact seven-row result, continued effective USAGE for all six explicit roles, and runtime USAGE false. Unknown owners/grants/grantors/grant options/extensions/dependencies fail closed. Run with ON_ERROR_STOP through an already authorized schema owner/privileged operator; missing managed-platform privileges are a STOP, never permission to broaden grants.

No pg_net table or function ACL, implementation, extension ownership, auth/storage object, public signup, SMTP, Watch, Alert, Vercel setting, secret, or application code is changed. No broad regrants are used.

[assertions.sql](assertions.sql) checks both schema USAGE and relation/column/sequence privilege for non-system schemas. It additionally preserves the stronger prohibition on latent object privileges in `auth`, `consumer`, `network`, `ops`, `v23_private`, and `public`. Direct runtime ACLs remain forbidden even where a schema masks access. pg_stat object SELECT alone is not reachability: if either statistics view exists, runtime extensions USAGE must be false, and a schema-qualified LIMIT 0 query under the runtime role must raise insufficient_privilege. The same qualified denial is required for both net tables. If any net schema/extension component exists, the complete hardened ACL and extension baseline is required. No pg_net allowlist exists. Exact runtime outgoing/reverse memberships and all existing identity/P13/P12/receipt checks remain enforced.

PostgreSQL documents that schema USAGE and object privileges are separate requirements: [schema privileges](https://www.postgresql.org/docs/17/ddl-schemas.html#DDL-SCHEMAS-PRIV). Drain existing sessions and reconnect after apply; do not rely on revocation to invalidate already resolved statements. Supabase's networking feature is documented at [pg_net](https://supabase.com/docs/guides/database/extensions/pg_net).

## Apply and closeout order (separate authorization required)

Do not rerun or teardown Phases 1–4. For the current paused activation, independently pin the branch, repeat the read-only dependency/ACL audit, obtain the separate hardening authorization, quiesce writers and drain runtime sessions, then apply the exact hardening file. Run [platform-runtime-probes.sql](platform-runtime-probes.sql) through a fresh direct TLS connection authenticated as `myth_v23_parent_preview`, with the isolated project attestation. Require `V23_PLATFORM_RUNTIME_PROBES_PASS`, then run `assertions.sql` through the existing authorized inspector and require its PASS before resuming Phase 5/certification. The inspector must not SET ROLE into the runtime: its platform-managed reverse membership deliberately has SET false. No new grants are required or permitted. The read-only probe checks schema-qualified statistics/table and HTTP-call denial, TrustHub raw privilege denial, authorizer/executor SET ROLE, authorizer readiness, and rejection of the unrelated cleanup role. It supplies no network endpoint. No preview activation follows merely from local PASS.

For a fresh activation, insert the same separately authorized hardening gate after `runtime-role-forward.sql` and before the restricted login/security tests and final assertions. All original Move freshness, identity, matrix and Journey QA gates remain mandatory.

Rollback is [platform-public-rollback.sql](platform-public-rollback.sql). It requires `v23.platform_public_rollback_authorized=true`, the same host/database/owner/drain guards, and the exact hardened seven-row ACL. It restores **only PUBLIC schema USAGE**, verifies the original eight rows, and refuses to proceed while `myth_v23_parent_preview` exists. It must not reopen the runtime's network privilege surface during activation.

Full separately authorized closeout in one operator session:

1. `teardown-preconditions.sql` captures research fingerprints and net object ACL/ownership evidence.
2. `move-binding-teardown.sql` performs the existing separately authorized lifecycle retirement.
3. `teardown.sql` removes the runtime and preview ports.
4. If pg_net is present, `platform-public-rollback.sql` restores only the reviewed PUBLIC USAGE state.
5. `teardown-assertions.sql` requires exact original net schema ACL, unchanged net table/function ACLs and owners, no residual preview roles/objects, and unchanged protected research/receipts.

For disposable databases with neither net nor pg_net, skip only step 4; the captured absence must still match afterward. Losing the same-session baseline or seeing unexpected state is a STOP. No consumer research is deleted by platform rollback.

## Disposable PostgreSQL evidence

Command: `npm run check:my-trusthub-v2-3-final-parent`. PostgreSQL 17.5 via PGlite; fresh local cluster reopened on database `postgres`. No hosted credentials, URLs or clients are used. The pg_net-style fixture is a local SQL extension with inert functions; it uses real CREATE EXTENSION/GRANT/REVOKE and real catalog dependencies, not pg_net's C networking worker. This tests PostgreSQL ACL semantics and packet guards, not hosted extension execution.

| Case | Result |
| --- | --- |
| A: pg_stat PUBLIC SELECT, no schema USAGE; qualified reads denied | PASS |
| B: statistics schema USAGE appears | assertion FAIL as required |
| C: net PUBLIC table/function privileges plus PUBLIC USAGE | assertion FAIL as required |
| D: PUBLIC net USAGE removed; six explicit platform grants preserved | PASS |
| E: direct runtime net USAGE | assertion FAIL as required |
| F: PUBLIC net USAGE restored during activation | assertion FAIL as required |
| G: each explicit platform role loses its reviewed USAGE row | assertion FAIL as required |
| H: TrustHub direct or PUBLIC raw relation grants | assertion FAIL as required |

The exact suite passed: 20 hardening precondition negatives, 15 activation negatives, 10 rollback guard negatives, premature rollback rejection, and two post-teardown platform drift cases. Schema-qualified SELECT/INSERT/UPDATE/DELETE on both net tables and calls to all three inert HTTP functions fail with SQLSTATE 42501 at the schema boundary, while their PUBLIC object ACLs remain unchanged. Runtime session authorization can SET ROLE only into the two reviewed roles; authorizer readiness succeeds, unrelated role and raw wrapper execution fail.

Existing reverse-membership (11 negatives), activation (46 negatives), lifecycle, A/B, replay, receipt, and post-teardown (11 negatives) suites also pass. Full closeout runs with and without the simulated platform extension. Saved research **1 → 1**, durable receipts **1 → 1**, Projects **2 → 2**, Project membership **1 → 1**, other consumer FK references **1 → 1**; protected fingerprints are unchanged. Local log: `C:\Users\Michael.Savitsky\.codex\tmp\v23-platform-acl-local.log`.

The parent-runtime CI workflow now runs this disposable packet suite on the pushed head. Hosted hardening still requires separate authorization; hosted mutations in this ticket are NONE.
