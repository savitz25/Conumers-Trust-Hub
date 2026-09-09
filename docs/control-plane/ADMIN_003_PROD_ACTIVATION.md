# ATH-ADMIN-003 Production activation

Recorded: 2026-09-09 UTC. No credentials, hostnames, customer identifiers, raw questions, sessions, or staff identity are recorded here.

## True runtime target

- Neon project: `asktrusthub-platform` (`hidden-glitter-26313488`)
- Production branch: `production` (`br-square-frog-aeqbig90`)
- Database: `neondb`
- Region: `aws-us-east-2`
- PostgreSQL: `18.6`
- Preflight: users `10`, sessions `34`, active staff `1`, Migration 011 present, `ath_product_events` absent, blocked locks `0`.

The non-runtime project `damp-silence-97233272` was not accessed or modified.

## Recovery and validation

Neon rejected a second manual snapshot with `snapshots limit exceeded`; the existing retained pre-011 snapshot was not deleted. A no-compute branch was therefore created from the current Production head before DDL as an exact pre-012 recovery point:

- recovery branch: `pre-ath-admin-003-012-recovery-2026-09-09` (`br-patient-grass-aecc5nbv`)
- validation branch: `ath-admin-003-012-validation` (`br-hidden-term-aejippw8`)
- retained history window: 21,600 seconds / 6 hours

Neither branch is automatically removed by this ticket.

Migration `012_ath_product_events.sql` SHA-256: `979D6BBA293EEC3D9622BED3857C427CD27EE3F4E802668CA2113DED2B551704`.
Rollback SHA-256: `F8F19B9F01B2F11E7EE26E45B280969ADA9A0CC0979813F80DCB6F5E6AC7D6BD`.

The exact migration committed on the validation branch at `2026-09-09T15:51:40.517Z`. Neon schema diff was `CLEAN_EXPECTED_DIFF`: one typed telemetry table, its constraints, five query indexes, primary key, forced RLS, and `ath_server_all`. No consumer/business/Admin security table changed. The core seven-day Search aggregate used `ath_product_events_name_time_idx`.

## Production migration

- start: `2026-09-09T15:53:00.169Z`
- finish: `2026-09-09T15:53:00.461Z`
- result: `COMMITTED`
- execution: direct connection, one transaction, advisory transaction lock

Post-proof: RLS enabled, FORCE RLS enabled, `ath_server_all` present, public/anon/authenticated grants `0`, all five indexes present, activation epoch rows `1`, users `10`, sessions `34`, active staff `1`, blocked locks `0`.

`FIRST_PARTY_SEARCH_TELEMETRY_STARTED_AT` is the database timestamp of the single `telemetry_store_activated` marker inserted by Migration 012. No Vercel Analytics history is backfilled.

## Contract compatibility migration

Migration 013 aligns `event_id` persistence with the frozen V1 contract's bounded string identifier. The additive correction changes UUID to `TEXT` with a 1-80 character check while preserving uniqueness and the activation marker.

- migration SHA-256: `A461C1DE8613B9F556EB6536A41BEB693AA86A37B6C637AA70D180561783FA54`
- rollback SHA-256: `523EB2EC3F5310EAE9335B755D369E389F26C151275ED5C4BB1C308C139C2763`
- validation committed: `2026-09-09T15:59:18.826Z`
- Production start: `2026-09-09T16:00:31.166Z`
- Production finish: `2026-09-09T16:00:31.436Z`
- result: `COMMITTED`

The validation-to-Production schema diff was `CLEAN_EXPECTED_DIFF`: only the `event_id` type and bounded-string constraint differed. Production retained forced RLS, `ath_server_all`, zero public/anonymous/authenticated grants, the primary key, and all query indexes. A bounded string event ID was inserted inside a transaction and rolled back successfully. Post-migration health remained users `10`, sessions `34`, active staff `1`, blocked locks `0`.
