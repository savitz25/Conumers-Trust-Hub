# ATH-ADMIN-002A production activation record

Status: **CODE COMPLETE — PROD ACTIVATION BLOCKED**  
Recorded: 2026-09-09 UTC  
Operator: Codex, under the repository owner's authorized session  
Production application SHA observed at preflight: `d8a3415dbf8d3c589f15874ad28f23b463e2315a`

## Safe database identity

| Field | Verified value |
|---|---|
| Application | AskTrustHub customer platform |
| Vercel project | `savitz25-s-projects/consumers-trust-hub` |
| Runtime selector | `neon_tech_database` first; `ASK_DATABASE_URL` fallback |
| Provider | Ask-owned Neon/Postgres, as established by repository selection logic and the configured production variable name |
| Environment | Production |
| Exact Neon project/branch | **NOT VERIFIED** |
| Redacted hostname fingerprint | **NOT AVAILABLE** |
| Database name / region | **NOT AVAILABLE** |
| PostgreSQL version | **NOT AVAILABLE** |

The production `neon_tech_database` variable is marked Sensitive in Vercel. The authorized CLI confirms its presence but deliberately will not export its value. No alternative operator/API access was available to identify the exact Neon project/branch or establish a read-only database session. The Supabase integration project `qvvxvbcdmbjzrgvwjatw` was **not used** and is not accepted as the Ask customer database.

## Migration/schema gate

Repository migration runner: `applyCustomerMigrations` loads ordered `schema/migrations/NNN_*.sql` files; there is no formal migration ledger in the repository contract. The deterministic expected pre-011 inventory was reviewed from migrations 001–010 and includes canonical identity/session, organizations/memberships, hub-profile pointers, claims, management grants, review/audit, Layer B profile revisions/fields/items/hours, record issues, business replies, monitoring subscriptions/events/deliveries/cursors, and organization invitations.

Remote production verification of those objects and their shapes: **NOT PERFORMED** because a read-only production connection could not be obtained without extracting the Sensitive runtime credential. Therefore the drift classification is **UNVERIFIED**, not `MATCH`, and row counts are **NOT OBTAINED**. No customer data or PII was read.

## Recovery gate

Independent, project-specific evidence was not available for:

- latest successful backup/restore point;
- PITR availability or retention window;
- exact Neon branch/snapshot restore capability;
- responsible recovery operator;
- tested restore procedure or supportable recovery estimate.

No recovery assumption was made from provider reputation or plan level. No paid Neon branch or snapshot was created. This mandatory gate blocks permanent migration.

## Migration artifacts

| Artifact | SHA-256 |
|---|---|
| `011_ath_admin_security_foundation.sql` | `3DF38C16B37B1772DD8E675358A2411474EE94FD385747A3A410BC22514308DB` |
| `011_ath_admin_security_foundation.down.sql` | `EC751CAC9CE609F323A86BF67FDBDB102EDEF93910E41D0ABE13C562564F7F77` |

Migration 011 was reviewed as additive: it creates five Ask-owned control-plane tables, constraints, indexes, forced RLS/server policy, grant revocation, and audit mutation triggers. It does not alter Search, claims, publication, Layer A evidence, rankings, or specialist databases. Its rollback deletes the new control-plane tables and is suitable only after application rollback and preservation/export of required audit history.

Local PostgreSQL-compatible tests apply migrations 001–011 transactionally and prove the table model, forced RLS declarations, append-only trigger behavior, bootstrap invariants, RBAC, immediate staff disable, audit filtering, command idempotency, and `NOT_YET_CONNECTED` controls.

## Decision and effects

- Production Migration 011 applied: **NO**
- Production SQL executed: **NO**
- Production data changed: **NO**
- Super Admin bootstrapped: **NO**
- `ATH_OPERATOR_SECRET` rotated: **NO**
- Supabase project changed: **NO**
- Paid database resource created: **NO**

The stop condition was reached before Sections 9–17 of the activation procedure. Production authenticated Admin writes, staff revocation, audit immutability, command idempotency, and flag persistence were not claimed. Anonymous `/admin` continues to fail closed through canonical login; the data plane remains inactive.

## Exact unblock requirements

An authorized Neon/Vercel operator must provide, without sharing credentials in artifacts:

1. exact Neon project, production branch, redacted host fingerprint, database name, region, and PostgreSQL version corresponding to `neon_tech_database`;
2. read-only schema inventory proving canonical migrations 001–010 and a `MATCH` or reviewed `EXPECTED_COMPATIBLE_DRIFT` result;
3. current project-specific backup/PITR retention and latest recovery point evidence;
4. named recovery operator and rollback/restore procedure;
5. a safe database execution session through the established migration path;
6. the canonical Ask user who will authenticate and perform the one-time bootstrap, without recording their identity in this document.

After those facts are recorded, rerun the preflight, apply the exact checksummed Migration 011 once, and perform the ticket's post-migration and named-staff production proofs. ADMIN-003 must rebase on the final main SHA recorded by this follow-up and must independently observe the same production/recovery gate before applying any telemetry migration.
