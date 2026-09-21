# Hosted owner transfer: isolated-only correction

Target: `xkkiicsassizmakcvxml`; production `qvvxvbcdmbjzrgvwjatw` is prohibited.
Starting PR #185 head: `91ff29c5f01e62dd52536fac59d35e4508e56c07`.

Hosted PostgreSQL 17.6 confirmed `current_user=session_user=postgres`,
`rolsuper=false`, `rolcreaterole=true`, `createrole_self_grant=''`.
The original migration failed with 42501 at the first ALTER FUNCTION OWNER.
Complete rollback was verified; only baseline/P11/P12/P13 remained.

## Proven correction

A rollback-only hosted proof verified that the newly created NOLOGIN/NOINHERIT
role has a platform-granted ADMIN TRUE / SET FALSE / INHERIT FALSE membership.
The owner transfer requires both schema CREATE for the new owner and SET ability
for the executor. Temporarily grant CREATE and an explicitly self-granted
ADMIN FALSE / INHERIT FALSE / SET TRUE membership. Transfer all three wrappers,
then revoke CREATE and revoke ONLY the membership GRANTED BY CURRENT_USER.
The platform admin-only membership remains; effective SET and USAGE are false.
The proof role/schema/function were verified absent after ROLLBACK.

Only this transfer mechanism and its comments change in the migration. No
wrapper body, RLS policy, consumer permission, or runtime authority is broadened.
No service_role, LOGIN, BYPASSRLS or production mutation is introduced.

References: [PG17 GRANT](https://www.postgresql.org/docs/17/sql-grant.html),
[REVOKE](https://www.postgresql.org/docs/17/sql-revoke.html),
[ALTER FUNCTION](https://www.postgresql.org/docs/17/sql-alterfunction.html).

## Validation boundaries

`v23f-owner-transfer.test.mjs` locks the narrow SQL sequence and owners/ACLs.
`v23_hosted_security_assertions.sql` checks actual hosted ownership, all five
role attributes, effective SET/USAGE, absence of schema CREATE/self grants,
exact wrapper EXECUTE recipients, foundation-routine denial and forced RLS.
The existing PGlite suite remains LOCAL POSTGRES with fixture Auth; it is not
a real Auth/browser certification. Hosted SQL tests must use rollback-only
fixtures and must not grant SET into foundation for testing.

Apply only after the patched PR checks pass; run hosted assertions immediately.
Stop on any migration/security failure. Do not proceed to Auth configuration,
persistent Users A/B, Move binding or Builder 3 handoff in this ticket.

Local validation passed: three owner-transfer static tests; 39 rollback-only SQL
matrix assertions against embedded PostgreSQL; existing V2-3F adapter suite;
V2-3 contracts/runtime/browser tests; V2-2 account contracts; search P0-001 and
R1-008; repository `npm test`; typecheck; build; lint (seven baseline warnings,
zero errors); `git diff --check`. SQL fixtures do not send email or authenticate
browser users. Post-apply hosted outcomes are recorded separately in the handoff.
