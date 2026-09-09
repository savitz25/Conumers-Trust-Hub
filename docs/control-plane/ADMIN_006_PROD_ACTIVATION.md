# ATH-ADMIN-006 Production Activation

Status: Migration 016 active on Production; application release pending. No credentials or customer PII are recorded.

Canonical target: Neon `asktrusthub-platform` (`hidden-glitter-26313488`), Production `br-square-frog-aeqbig90`, database `neondb`, PostgreSQL 18.6. The non-runtime `damp-silence-97233272` project remains out of scope.

Branch capacity was 8/10. The exact two approved slots are retained as no-compute recovery `ath-admin-006-recovery-2026-09-09` (`br-fancy-flower-aev55ltw`, parent LSN `0/4A7CB18`) and validation `ath-admin-006-validation` (`br-old-forest-aeqj062u`). Capacity is now 10/10; ADMIN-007 requires an explicit cleanup decision.

Migration `016_ath_data_operations.sql` SHA-256 is `F4660C16DBE69FC484557090A6A4F3758E2743AD63380CC08415876DEE9887FB`; rollback SHA-256 is `A1A3F5B29C9D51453631D45E202E35FAA1E72740F3393735C686A081E3062EDA`. Validation was `CLEAN_EXPECTED_DIFF`. Production committed in one transaction from `2026-09-09T18:53:52.129Z` to `2026-09-09T18:53:52.440Z` with zero blocked locks. Users remained 10, sessions 34, and active monitoring subscriptions 0.

Post-proof: four tables, six foreign keys, expected indexes/checks, RLS and FORCE RLS, one `ath_server_all` policy per table, no public/anon/authenticated grants, and append-only observation/event triggers. No specialist data, Layer A evidence, claims, grants, ranking, or publication rule changed. Real capability observations begin only when collectors run; missing adapters remain UNKNOWN rather than receiving fabricated health rows.
