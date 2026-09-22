# Isolated pg_net absence review

The former `REVOKE USAGE ON SCHEMA net FROM PUBLIC` design is superseded. Its
grant is platform-managed and extension lifecycle work can recreate it, so it is
not the V2-3 boundary. The isolated preview policy is now: extension `pg_net`,
schema `net`, its HTTP functions, queue and response table are all absent.
Production does not inherit this branch-specific policy.

No hosted change was made by this packet. Bot Team must independently pin
`xkkiicsassizmakcvxml`, run [pg-net-preflight.sql](pg-net-preflight.sql) read
only, stop on any dependency or queued request, and obtain separate authorization
before [pg-net-disable.sql](pg-net-disable.sql). The disable uses `DROP EXTENSION
pg_net` followed by `DROP SCHEMA net`, both without CASCADE. The postcondition is
machine checked by [pg-net-postcheck.sql](pg-net-postcheck.sql) and Phase 5
[assertions.sql](assertions.sql).

Disabling pg_net discards its transient response history and cannot preserve an
in-flight queue, which is why the queue must be empty. Re-enable is a separate
extension lifecycle operation in [pg-net-reenable.sql](pg-net-reenable.sql).
`CREATE EXTENSION pg_net` restores current platform defaults, not the V2-3
least-privilege state. Phase 5 is required to fail while it is re-enabled.

The repository audit found no application call to `net.http_get`,
`net.http_post`, `net.http_delete`, `pg_net`, or
`supabase_functions.http_request`. That does not establish hosted webhook,
trigger, cron, or dynamically constructed function safety. The hosted preflight
checks those database surfaces at execution time.
