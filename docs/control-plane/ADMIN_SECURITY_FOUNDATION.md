# ATH-ADMIN-002 security foundation

Status: code complete; permanent data-plane activation is gated on independently verifying the target database, migration history, recovery readiness, schema drift, and Auth state.

## Identity and authorization

The Control Plane reuses Ask's canonical `ath_users` identity and hashed `ath_sessions` cookie session. Staff authority is a separate `ath_admin_staff` record and is never inferred from consumer status, organization membership, a management grant, or a claim. Every page and mutation reloads the session and staff row from the database. Disabling staff therefore blocks the next Admin request without revoking their ordinary consumer/business identity.

Roles are `SUPER_ADMIN`, `TRUST_OPS`, `DATA_OPS`, `GROWTH`, and `READ_ONLY`. Code authorizes capabilities defined in `lib/control-plane/rbac.ts`, not route-specific role comparisons. The last active Super Admin cannot be disabled or demoted.

Ask currently uses passwordless email authentication and has no independently verified AAL/MFA facility. It is not described as MFA. External/destructive command execution remains `NOT_YET_CONNECTED`; a future connection requiring step-up must fail closed until a mature provider-backed mechanism exists.

## Bootstrap

Bootstrap requires an already authenticated Ask user, zero active staff rows, and server-side proof of the legacy operator secret. The proof is timing-safe compared; it is never sent to browser code or persisted. The transaction creates one named Super Admin and one audit event. Once an active staff row exists, replay fails closed. After production proof, the legacy operator secret is only a recovery/bootstrap dependency and must not remain normal Admin authentication.

## Persistence and isolation

Migration `011_ath_admin_security_foundation.sql` creates staff, append-only audit, commands, flags, and break-glass request tables. All tables use forced RLS with only the established server application role policy; public/anonymous/authenticated access is revoked. The audit table has a database trigger rejecting update and delete. Payload sanitization rejects secret/token/private-note/private-decision keys.

Commands validate the frozen `admin_command.v1` input. Persistence adds lifecycle states (`PENDING`, `EXECUTING`, `SUCCEEDED`, `FAILED`, `ROLLED_BACK`, `REJECTED`) without changing that input contract. A unique idempotency key prevents double execution. In ATH-ADMIN-002 every submitted command is durably rejected as `NOT_YET_CONNECTED`; no specialist action is invoked.

Flags support network, hub, profile-class, jurisdiction, capability, campaign, and feature scopes. They are authoritative audited records, but all are currently `NOT_YET_CONNECTED`. The UI says so explicitly.

Break-glass persistence defines purpose, reason, target, expiry, actor, and audit references. There is no named-consumer browser or support-access UI.

## ADMIN-003 interface

ADMIN-003 may mount read-only Founder Control Center routes inside `app/admin` and use `withAdminSecurity` plus `AdminSecurityService.require(token, 'ADMIN_VIEW')`. It must not change `rbac.ts`, staff/audit/command/flag migrations, or write product-event aggregation through these security tables. Client components must never import `lib/control-plane/server.ts` or `security.ts`.

## Production activation gate

No permanent migration is authorized until an operator records: exact database project/branch, applied migration history through 010, backup/PITR or restore evidence, drift check, current authentication behavior, and a tested rollback. Then apply 011 through the established migration runner, smoke bootstrap once, test disable-on-next-request, audit immutability, command idempotency, and control flags, and retain rollback evidence. Do not bootstrap until the migration and recovery checks succeed.
