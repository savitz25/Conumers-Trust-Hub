# ATH-ADMIN-004 Production Activation

Status: Migration 014 active; application release pending at the time this record was created.

## Database and recovery

- Provider: Neon Postgres
- Project: `asktrusthub-platform` (`hidden-glitter-26313488`)
- Production branch: `production` (`br-square-frog-aeqbig90`)
- Database: `neondb`
- PostgreSQL: 18.6
- Region: AWS us-east-2
- History retention: 21,600 seconds (6 hours)
- Snapshot attempt: rejected because the project snapshot limit was reached
- No-compute recovery branch: `ath-admin-004-recovery-2026-09-09` (`br-still-water-aequh26y`), parent LSN `0/4986CB8`
- Validation branch: `ath-admin-004-validation` (`br-dark-hat-ae3rcnk9`)

The unrelated `damp-silence-97233272` project was not read, migrated, or modified.

## Migration 014

- Source: `schema/migrations/014_ath_claim_operations.sql`
- SHA-256: `846953E8413A5F5FB0F298E2FB2D0D892D6D2F0380AAD735D991C12575F0FC95`
- Rollback SHA-256: `D25F3AE72816268F094AA084F865F3FEF680482C4A8A4D0EE38E971DD46566C2`
- Validation result: `CLEAN_EXPECTED_DIFF`
- Production result: committed in one transaction on 2026-09-09
- Pre/post authoritative counts: 10 users, 34 sessions, 5 claims, 3 management grants; unchanged

The expected additions are `ath_ops_cases`, `ath_ops_case_events`, and `ath_claim_policy_evaluations`. Each has RLS and FORCE RLS, an `ath_server_all` policy, no PUBLIC/anon/authenticated grant, and the expected keys/indexes. Events and policy evaluations have update/delete rejection triggers. Case-event idempotency is unique. Automatic approval is constrained false.

Migration 014 references authoritative claims and grants; it does not duplicate or mutate Layer A evidence, Search, ranking, claim policy status, or public profiles. Existing open review records are deterministically referenced as cases; no fake Production data was created.

Retain both recovery and validation branches through immediate post-release stabilization. Cleanup requires a later deliberate review.
