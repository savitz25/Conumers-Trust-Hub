# Bot Team Gate 1 / Gate 2 handoff

Use exact PR #185 head after review. No command here targets production. Never
print environment variables or connection strings.

1. Independently pin preview branch `xkkiicsassizmakcvxml`, database `postgres`,
   and reject parent ref `qvvxvbcdmbjzrgvwjatw` outside SQL.
2. The pg_net portion of Gate 1 is exactly one of these paths. No other
   marker combination is valid. Production does not inherit this rule.

   Path A, installed. In one read-only inspector session set only
   `v23.approved_project=xkkiicsassizmakcvxml`; run `pg-net-preflight.sql` with
   `ON_ERROR_STOP=1`. Require `V23_PG_NET_PREFLIGHT_PASS`. Stop for any trigger,
   webhook, cron, application function, dependency, pending queue, missing object,
   or unexpected branch identity. After separate hosted authorization, set
   `v23.pg_net_disable_authorized=true` in the same independently pinned operator
   session and run `pg-net-disable.sql`. It uses no CASCADE. Require
   `V23_PG_NET_DISABLE_PASS`, then run `pg-net-postcheck.sql` and require
   `V23_PG_NET_ABSENT_PASS`.

   Path B, already absent. Do not install pg_net in order to remove it. In one
   read-only inspector session set only `v23.approved_project=xkkiicsassizmakcvxml`
   and run `pg-net-already-absent.sql` with `ON_ERROR_STOP=1`. Require
   `V23_PG_NET_ALREADY_ABSENT_PASS`. Then run `pg-net-postcheck.sql` and require
   `V23_PG_NET_ABSENT_PASS`. Do not record `V23_PG_NET_DISABLE_PASS` or
   `V23_PG_NET_PREFLIGHT_PASS` for this path. Stop if the extension is present,
   schema `net` exists, an HTTP routine or queue/response relation remains, a
   trigger, webhook, cron job, or application function still depends on pg_net,
   or the project attestation is wrong.
3. After the chosen pg_net path, Phase 5 uses two separate authenticated contexts. Markers 1–3 below are
   already earned on the hosted preview and must not be rerun. Markers 4 and 5
   are both required before Gate 1 is complete. The operator must not
   `SET ROLE myth_v23_authorizer` and must not receive runtime-role privileges.

   Phase 5A, operator/inspector. Connect as `postgres.xkkiicsassizmakcvxml`.
   Set `v23.approved_project`, `v23.binding_id`, `v23.network_entity_id`, and
   `v23.binding_provenance_ref` from the retained exact Phase 4 outputs. Run
   `assertions.sql` with `ON_ERROR_STOP=1`. Require
   `V23_PARENT_PACKET_ASSERTIONS_PASS`. That marker certifies the
   inspector/catalog packet only, including that no SET-capable
   identity-governor grant remains. It does not certify runtime SET ROLE.

   Phase 5B, runtime login. Open a fresh connection whose `session_user` and
   `current_user` are exactly `myth_v23_parent_preview`. Set
   `v23.approved_project`, `v23.binding_id`, and `v23.network_entity_id` from
   the same retained Phase 4 outputs. Run `platform-runtime-probes.sql` with
   `ON_ERROR_STOP=1`. Require `V23_PLATFORM_RUNTIME_PROBES_PASS`.

   Gate 1 pg_net is satisfied by exactly one of:

   A) `V23_PG_NET_PREFLIGHT_PASS` + `V23_PG_NET_DISABLE_PASS` +
   `V23_PG_NET_ABSENT_PASS`

   or

   B) `V23_PG_NET_ALREADY_ABSENT_PASS` + `V23_PG_NET_ABSENT_PASS`

   Gate 1 is complete only when that combination is joined by
   `V23_PARENT_PACKET_ASSERTIONS_PASS` and
   `V23_PLATFORM_RUNTIME_PROBES_PASS`.

Phase 4 authority accounting is exact. Supabase's durable bookkeeping row is
member `postgres`, role `myth_identity_governor`, grantor `supabase_admin`, ADMIN
true, INHERIT false, SET false. It remains. Immediately before binding creation,
`postgres` issues `GRANT myth_identity_governor TO postgres WITH ADMIN FALSE,
INHERIT FALSE, SET TRUE GRANTED BY postgres;`. Immediately after COMMIT it issues
`REVOKE myth_identity_governor FROM postgres GRANTED BY postgres;`. The grant is
for the operator, never the runtime login. The same bracket applies only to a
separately authorized retirement. Every later assertion rejects a lingering SET
row or altered bookkeeping.
5. Gate 2 uses Supavisor **session mode** only. Secure variable names are
   `V23_SUPAVISOR_SESSION_DATABASE_URL`, `V23_SUPAVISOR_SESSION_CA_PEM`, and
   `V23_EXPECTED_SUPAVISOR_SESSION_HOST`. Run:
   `node --experimental-strip-types scripts/qa/v23-supavisor-session-parity.mjs`.
   Require `V23_SUPAVISOR_SESSION_PARITY_PASS` before setting application mode
   `MY_TRUSTHUB_V23_DATABASE_CONNECTION_MODE=SUPAVISOR_SESSION`.

Stop if TLS hostname validation is not authorized, the endpoint is port 6543,
the URL user is not `myth_v23_parent_preview.xkkiicsassizmakcvxml`, project or
database identity differs, backend/session behavior differs, role/GUC state
leaks, the role connection limit is not six, or any SQL gate lacks its exact
marker. Direct mode remains unsuitable for Vercel until an approved IPv4 route
exists. Do not use the re-enable script during activation; it exists only for a
separately authorized recovery and deliberately makes Phase 5 fail.

The runtime needs one stable backend only while a connection is checked out:
SET/RESET ROLE, transaction-local roles/GUCs, SERIALIZABLE, savepoints/rollback,
xact advisory locks, stable `pg_backend_pid`, and the confirmation's session
advisory lock across short transactions plus Auth/source calls. No state may
survive release. A failed unlock destroys that pool connection. The probe checks
two concurrent sessions, clean release/reacquire, role/GUC reset, role timeouts,
and pool max two below the role connection limit six.
