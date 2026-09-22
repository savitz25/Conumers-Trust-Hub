# Bot Team Gate 1 / Gate 2 handoff

Use exact PR #185 head after review. No command here targets production. Never
print environment variables or connection strings.

1. Independently pin preview branch `xkkiicsassizmakcvxml`, database `postgres`,
   and reject parent ref `qvvxvbcdmbjzrgvwjatw` outside SQL.
2. In one read-only inspector session set only
   `v23.approved_project=xkkiicsassizmakcvxml`; run `pg-net-preflight.sql` with
   `ON_ERROR_STOP=1`. Require `V23_PG_NET_PREFLIGHT_PASS`. Stop for any trigger,
   webhook, cron, application function, dependency, pending queue, missing object,
   or unexpected branch identity.
3. After separate hosted authorization, set
   `v23.pg_net_disable_authorized=true` in the same independently pinned operator
   session and run `pg-net-disable.sql`. It uses no CASCADE. Require
   `V23_PG_NET_DISABLE_PASS`, then run `pg-net-postcheck.sql` and require
   `V23_PG_NET_ABSENT_PASS`.
4. Phase 5 inputs remain `v23.approved_project`, `v23.binding_id`,
   `v23.network_entity_id`, and `v23.binding_provenance_ref`. Use retained exact
   Phase 4 outputs and require `V23_PARENT_PACKET_ASSERTIONS_PASS`. The assertion
   also proves no SET-capable identity-governor grant remains.

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
