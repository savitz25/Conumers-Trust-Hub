# ATH-ADMIN-005 Production Activation

Status: Production data plane activated; application release pending final CI/merge.

Canonical target: Neon project `hidden-glitter-26313488`, branch `br-square-frog-aeqbig90`, database `neondb`, PostgreSQL 18.6. Migration: `015_ath_business_growth.sql`.

Recovery point: no-compute branch `ath-admin-005-recovery-2026-09-09` (`br-twilight-mode-ae3o1izc`) from Production LSN `0/49FDCF0`. Validation branch: `ath-admin-005-validation` (`br-fancy-sunset-aecki3a3`). Branch budget before creation was 6/10; both required slots were available without deleting retained assets.

Migration SHA-256: `9DA32E341881EB459AFBEB567BD09E53AD7222B588EA83C24FB7AE61DEE7B596`. Rollback SHA-256: `87F29C0F8AD211901EF23E731E3F7ADE7B290E9651BB2D91B73F740EA4610CD1`.

Validation and Production both reported PostgreSQL 18.6 and `CLEAN_EXPECTED_DIFF`: seven ADMIN-005 tables, forced RLS, `ath_server_all`, exact foreign keys, bounded checks, unique event/attribution keys, append-only activity/campaign-event triggers, and no public/anon/authenticated grants. Production applied in one transaction on 2026-09-09 UTC. Authoritative counts stayed 10 users, 34 sessions, 5 claims, 3 grants, and 5 organizations. No campaigns, targets, claims, grants, or business activity were fabricated.

The `MANAGED_PROFILE_OPEN_V1` instrumentation epoch begins at Migration 015 activation. Earlier missing opens remain a data gap rather than a zero. No sender is connected and no outreach was sent.

The non-runtime project `damp-silence-97233272` remains out of scope and untouched.
