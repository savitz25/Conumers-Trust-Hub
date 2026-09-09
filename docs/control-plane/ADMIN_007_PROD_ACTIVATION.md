# ATH-ADMIN-007 Production Activation

Status: COMPLETE — PROD ACTIVATED on 2026-09-09.

## Database and recovery

The only database changed was Neon project `asktrusthub-platform` (`hidden-glitter-26313488`), Production branch `production` (`br-square-frog-aeqbig90`), database `neondb`, PostgreSQL 18.6. The non-runtime project `damp-silence-97233272` was not used or modified.

Pre-ticket branch usage was 3/10. Recovery branch `ath-admin-007-recovery-2026-09-09` (`br-odd-paper-aeu676bf`) and validation branch `ath-admin-007-validation` (`br-late-bird-ae1yq8mw`) were created from Production. Baseline snapshot `pre-ath-admin-011-true-runtime-2026-09-09` (`snap-proud-mud-aelowv17`) and pre-016 recovery branch `br-fancy-flower-aev55ltw` remain retained.

Migration `017_ath_search_reliability.sql` SHA-256 is `2B98E445D9596AE105D360668CFEE8108C5F1B508CF0CAB37E699155B5BEDD81`; rollback SHA-256 is `117EF46A9322CBF90D01BD26D56B48BA7FCF2997BDE232876E3710218AF0C732`. Validation produced `CLEAN_EXPECTED_DIFF`. Production execution began at 2026-09-09T20:12:03.275Z and committed at 2026-09-09T20:12:03.729Z in one transaction. Customer user/session counts remained 10/34 and blocked locks were zero.

The four new tables are `ath_search_canary_runs`, `ath_search_release_evaluations`, `ath_search_incidents`, and `ath_search_incident_events`. All have RLS, FORCE RLS, one `ath_server_all` policy, and no PUBLIC/anon/authenticated grants. Run, evaluation, and incident-event history is append-only. Validation proved 26 checks, 3 foreign keys, expected indexes, and append-only triggers. No customer schema or Search data was changed.

## Production release proof

PR #97 introduced the Search Reliability Control Plane. PR #98 corrected cross-host timestamp skew by deriving persisted run timestamps from the database clock; the failed pre-fix proof transaction rolled back without rows. Production deployment `dpl_5spYmSqz4XCpAm4tV13QFcrDFqmP` was READY and bound to merge SHA `66c117b95f72d79384ad3d93e30a8576402182f4` before proof.

The build-specific RELEASE and QUICK suites created two run groups: 6 RELEASE runs and 5 QUICK runs. All 11 passed. Two release evaluations were persisted; the latest gate was `READY`, with zero open Search incidents. No `search_terminal_outcome` product event was created during the synthetic proof window, proving synthetic traffic did not enter the real-user denominator.

Raw canary questions and response bodies are not persisted. Stored evidence is limited to checked-in canary keys and bounded contract metadata/fingerprints. Browser presentation canaries remain `NOT_INSTRUMENTED`; API/data-contract coverage is not represented as browser coverage. Search control flags and automatic rollback remain unconnected.

## Validation and regression

`npm ci`, ADMIN checks 001–007, `npm test`, typecheck, lint, build, release fixture checks, and `git diff --check` passed. Lint retained four unrelated pre-existing warnings and no errors. Public routes `/`, `/ask`, `/claim/continue`, `/manage`, `/methodology`, and `/trust` returned 200. Anonymous requests to all Admin routes, including `/admin/search`, redirected to `/admin/login`. Runtime inspection found no Search-reliability execution error; the existing PostgreSQL SSL-mode deprecation warning remains informational.

Following merge and stabilization, `ath-admin-007-validation` and the older pre-015 recovery branch are approved for deletion under `RECOVERY_RETENTION.md`. Production, the baseline snapshot, pre-016 recovery, and pre-017 recovery remain retained. Automatic deletion is not performed by application code.
