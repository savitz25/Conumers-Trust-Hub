# ATH-ADMIN-002C runtime database reconciliation

Status: **TRUE RUNTIME MIGRATED — SUPER ADMIN BOOTSTRAP PENDING**  
Recorded: 2026-09-09 UTC  
Starting/foundation SHA: `ee0a913f7f84e8ade435d6b0e31d403f62fd89ec`

This record contains no database URL, hostname, credential, token, magic link, staff identity, or customer PII.

## Conclusive runtime identity

A temporary canonical-session-protected diagnostic executed through the same `withAskTx()` path used by production authentication. It returned only safe database metadata and bounded counts. The endpoint was removed immediately after capture.

| Field | Verified value |
|---|---|
| Provider | Neon Postgres |
| Project | `asktrusthub-platform` (`hidden-glitter-26313488`) |
| Region | `aws-us-east-2` |
| Production/default branch | `production` (`br-square-frog-aeqbig90`) |
| Database | `neondb` |
| PostgreSQL | `18.6` |
| Pre-011 auth counts | users `10`; sessions `34` |
| Pre-011 Admin state | `ath_admin_staff` not present |

The live magic-link flow and these nonzero canonical auth counts establish this as the production Ask customer/runtime database. The expected migrations 001–010 customer schema is present, including auth challenges, users, sessions, organizations, memberships, claims, management grants, hub profiles, Layer B objects, monitoring, and review objects.

## Why ATH-ADMIN-002B targeted the wrong database

The earlier project `damp-silence-97233272` accepted a connection and contained a compatible but empty Ask schema. Production runtime proof later showed successful authentication while that database remained at zero users and sessions. It is therefore classified:

`NON_RUNTIME_NEON_PROJECT_REQUIRES_LATER_CLEANUP_REVIEW`

It was not modified during ATH-ADMIN-002C. Its existing snapshot and validation branch remain retained pending a separate ownership/cleanup decision.

## True-runtime recovery gate

- History retention: 21,600 seconds (6 hours).
- Manual pre-migration snapshot: `pre-ath-admin-011-true-runtime-2026-09-09` (`snap-proud-mud-aelowv17`).
- Snapshot source: true production branch `br-square-frog-aeqbig90`.
- Validation branch: `ath-admin-011-true-runtime-validation` (`br-curly-lab-ae4d08yb`).

Both recovery artifacts remain retained. The validation branch may be deleted only after production Admin proof and stabilization; snapshot retention requires an explicit later operator decision.

## Migration validation

Migration SHA-256: `3DF38C16B37B1772DD8E675358A2411474EE94FD385747A3A410BC22514308DB`  
Rollback SHA-256: `EC751CAC9CE609F323A86BF67FDBDB102EDEF93910E41D0ABE13C562564F7F77`

The exact checked-in migration was applied to the child validation branch in one transaction from `2026-09-09T13:37:18.797Z` to `2026-09-09T13:37:19.195Z`. Neon schema diff classified the result `CLEAN_EXPECTED_DIFF`: only the five Admin tables and their intended function, RLS policies, grants, constraints, indexes, and triggers were added.

Validation proved:

- all five Admin tables;
- RLS plus `FORCE ROW LEVEL SECURITY`;
- `ath_server_all` guarded by `ath_is_server()`;
- expected foreign keys and checks;
- command `idempotency_key` uniqueness;
- control flag `(flag_key, scope_key)` uniqueness;
- append-only audit UPDATE/DELETE triggers;
- staff `updated_at` trigger;
- no public/anonymous/authenticated grants.

## True production application

Immediately before migration, users remained `10`, sessions `34`, all required customer tables were present, all five Admin tables were absent, blocked locks were `0`, and long-running queries were `0`.

- Started: `2026-09-09T13:38:17.550Z`
- Finished: `2026-09-09T13:38:17.927Z`
- Result: `COMMITTED`
- Execution: exact validated SQL, direct non-pooled owner connection, single transaction with an advisory transaction lock.

Post-migration, users remained `10`, sessions remained `34`, and claims, grants, organizations, memberships, review records, Layer B records, and hub profiles retained their pre-migration counts. All five Admin tables exist with the validated structure and zero public grants. Database health remained clear with zero blocked locks and zero queries beyond five minutes.

## Remaining production proofs

The existing real Ask session must now complete `/admin/bootstrap` using the server-side legacy bootstrap proof. After bootstrap, verify exactly one active `SUPER_ADMIN`, replay closure, named Admin route access, one harmless `NOT_YET_CONNECTED` flag, one rejected/not-connected idempotent command, append-only audit mutation rejection, and public/search/claim regressions.

The temporary runtime diagnostic is no longer present in source and must not remain deployed after this reconciliation record reaches production.
