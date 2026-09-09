# ATH-ADMIN-002B production activation record

Status: **MIGRATION ACTIVE — SUPER ADMIN BOOTSTRAP WAITING FOR OPERATOR SIGN-IN**  
Recorded: 2026-09-09 UTC  
Repository starting SHA: `de7338312ca9ea54cd0cd968ee6c42b97fd0aca0`  
Branch: `ath-admin-002b-prod-activation`

This record contains no connection string, credential, token, magic link, secret value, or customer PII.

## Verified production database

| Field | Verified value |
|---|---|
| Provider | Neon Postgres |
| Project | `neon-citrine-jacket` (`damp-silence-97233272`) |
| Region | `aws-us-east-1` |
| Production branch | `main` (`br-weathered-cherry-auiryp9j`) |
| Database | `neondb` |
| PostgreSQL | `18.6 (c5250a2)` |
| Direct-host fingerprint | `cc8a552bda1a6983` |

The Supabase integration `qvvxvbcdmbjzrgvwjatw` was not used or modified. Runtime selection and the inspected canonical tables establish Neon as the Ask customer/control-plane data plane.

## Recovery evidence retained

- Manual snapshot: `pre-ath-admin-011-2026-09-08` (`snap-snowy-block-audb9u69`), sourced from the production branch.
- Neon history retention: 21,600 seconds (6 hours).
- Validation branch: `ath-admin-011-validation` (`br-ancient-cell-aut6zvqd`), ready and retained.
- Restore path: use the retained manual snapshot for a new recovery branch or Neon restore procedure; use the checked-in down migration only when rollback is warranted and audit-history preservation has been addressed.

Neither the snapshot nor validation branch was deleted. Retain both through the immediate stabilization period; a later authorized operator may remove the validation branch after production proof is complete. The pre-migration snapshot should follow the organization's explicit retention decision.

## Pre-migration proof

The production database was reachable, the branch was ready, no blocked locks or queries running longer than five minutes were observed, and all required canonical Ask tables existed:

`ath_users`, `ath_sessions`, `ath_claims`, `ath_management_grants`, `ath_organizations`, `ath_memberships`, `ath_review_queue`, `ath_business_profile_fields`, `ath_record_issues`, `ath_business_replies`, `ath_regulatory_change_events`, `ath_monitoring_subscriptions`, `ath_organization_invitations`, and `ath_hub_profiles`.

All five ADMIN-002 tables were absent before application. The inspected canonical tables had zero rows at the activation instant. The schema was classified `EXPECTED_COMPATIBLE_DRIFT` against migrations 001–010: the required objects were present and no material/destructive conflict blocked additive Migration 011.

## Migration 011

| Artifact | SHA-256 |
|---|---|
| `011_ath_admin_security_foundation.sql` | `3DF38C16B37B1772DD8E675358A2411474EE94FD385747A3A410BC22514308DB` |
| `011_ath_admin_security_foundation.down.sql` | `EC751CAC9CE609F323A86BF67FDBDB102EDEF93910E41D0ABE13C562564F7F77` |

- Started: `2026-09-09T02:55:47.730Z`
- Finished: `2026-09-09T02:55:48.060Z`
- Execution: exact checked-in migration through a direct, non-pooled Neon connection in one transaction with an advisory transaction lock.
- Result: `COMMITTED`

No warning or partial failure occurred. No rollback was run.

## Post-migration structural and access proof

Production contains:

- `ath_admin_staff`
- `ath_admin_audit_log`
- `ath_admin_commands`
- `ath_control_flags`
- `ath_admin_break_glass_requests`

All five tables have RLS enabled and `FORCE ROW LEVEL SECURITY`. Each has the expected `ath_server_all` policy guarded by `ath_is_server()`. No `PUBLIC`, `anon`, or `authenticated` table grant was found. Expected primary keys, foreign keys, checks, and indexes are present, including unique command `idempotency_key` and unique control-flag `(flag_key, scope_key)`.

The following triggers are present:

- `ath_admin_audit_no_update`
- `ath_admin_audit_no_delete`
- `ath_admin_staff_updated_at`

The post-migration diff is classified `CLEAN_EXPECTED_DIFF`: the five tables and their supporting constraints, indexes, policies, functions, and triggers are the intended ADMIN-002 additions; canonical Ask tables remained present and database health stayed clear (zero blocked locks and zero queries beyond five minutes).

## Bootstrap and production proof status

At the latest check, `ath_users = 0` and `ath_sessions = 0`. A canonical user therefore does not yet exist. No database user or Super Admin was fabricated, and the bootstrap secret was not used or exposed.

The authorized operator must:

1. visit `https://www.asktrusthub.com/admin/login`;
2. complete the normal Ask magic-link authentication with their real canonical identity;
3. complete the one-time production bootstrap through the protected application flow.

After that step, verify exactly one active `SUPER_ADMIN`, one bootstrap audit row, replay denial, named access to `/admin`, `/admin/security`, `/admin/audit`, and `/admin/controls`, audit mutation rejection, harmless `NOT_YET_CONNECTED` flag persistence, harmless command idempotency, and the legacy-secret transition. A second real staff identity is optional; without one, production multi-staff revocation proof remains deferred while code/local proof stands.

## Production behavior and secret posture

- Search/ranking/claim policy/Layer A changes: **none**.
- Control flags connected to runtime behavior: **none**.
- Specialist databases or legacy admin surfaces changed: **none**.
- `ATH_OPERATOR_SECRET` rotated: **no**.
- Named staff ordinary Admin access proven: **pending canonical operator sign-in/bootstrap**.

The secret may be used only as server-side one-time bootstrap/recovery proof. It must not become ordinary Admin authentication. No other network secret is authorized for rotation by this activation.

## ADMIN-003 handoff

ADMIN-003 must rebase onto the final main SHA that contains this record, preserve `withAdminSecurity`, `ADMIN_VIEW`, RBAC, audit, commands, flags, and staff persistence, and number any later database migration after 011. It must independently use the same verified Neon production/recovery context before applying permanent telemetry schema.
