# ATH-ADMIN-008 Production Activation

Status: COMPLETE / PRODUCTION ACTIVATED on 2026-09-09.

## Release identity

- Starting Ask main: `17e15a565cf1b467b3a290fc97259ffee7c716c5`
- Feature commits: `6ef1db1`, `f3cbaba`
- Feature PR: #100
- Production merge/build: `17717e6da2131f95a2d58ded490738d989308830`
- Specialist repositories changed: none
- Audited specialist mains: Move `ba72d609a013ed9d432975276f62c85d3e237492`; Insurance `fca65060a9d8c27eae5ab70626ead0716a212dd5`; Lender `0530e3351072d35780e7bd9258372cecf02b24e7`

## Database and recovery

Canonical target was Neon project `hidden-glitter-26313488`, Production branch `br-square-frog-aeqbig90`, database `neondb`, PostgreSQL 18.6. The non-runtime project `damp-silence-97233272` was not accessed.

- Pre-018 recovery branch: `ath-admin-008-recovery-2026-09-09` (`br-green-pond-aemapr6v`)
- Validation branch: `ath-admin-008-validation` (`br-silent-water-aept7w9a`)
- Migration: `018_ath_identity_legacy_consolidation.sql`
- Migration SHA-256: `6A1AFE297F98525D051B50963C03BA6844D875555C41AFC408459D3A33937C82`
- Rollback SHA-256: `E3D95CD71479973A4BA6BFCDD4A318A6A8B55FCF71056D0A987C75B6AC16B47A`
- Validation result: `CLEAN_EXPECTED_DIFF`
- Production transaction: started `2026-09-09T21:30:40.094Z`; committed `2026-09-09T21:30:41.575Z`
- Preflight: 10 users, 34 sessions, zero blocked lock waits
- Postflight: 10 users, 34 sessions, zero identity reviews, zero legacy observations

The three expected tables exist with RLS, FORCE RLS, one `ath_server_all` policy each, no public/anon/authenticated grants, expected indexes, six foreign keys, 18 checks, and append-only protection on identity-review events and legacy observations. No customer or specialist table changed.

## Product activation

The deployed Control Plane provides `/admin/identity`, `/admin/identity/[reviewId]`, `/admin/legacy`, `/admin/operations/corrections`, and `/admin/operations/business-responses`. Legacy human review/list routes redirect to canonical named-staff Admin routes. Machine APIs and production-gated QA fixtures remain classified rather than being exposed as human Admin pages.

Identity detection is exact-grain only. Name, address, website, or email-domain similarity cannot create or resolve a review. Ask records review/recommendation state and never merges specialist Layer A identities. Move and Insurance legacy queues are represented by bounded, honest registry entries; no specialist secret or write authority is transferred to Ask. Because no scoped live adapter exists, their queue values remain `NOT_INSTRUMENTED`, never false zeroes.

## Validation and production proof

All ADMIN-001 through ADMIN-008 checks, `check:search-release`, the full test suite, typecheck, lint, production build, and `git diff --check` passed. Lint retained four pre-existing warnings and produced no errors.

Vercel preview and Production deployment checks passed. On exact serving build `17717e6da2131f95a2d58ded490738d989308830`:

- Search RELEASE: `READY`, 6/6 blocker canaries passed
- Search QUICK: `READY`, 5/5 passed
- Open Search incidents: 0
- Synthetic run rows: 16 before, 27 after
- Real `search_terminal_outcome` rows: 2 before and 2 after (telemetry isolation proven)

Public routes `/`, `/ask`, `/claim/continue`, `/manage`, `/methodology`, and `/trust` returned 200. Anonymous requests to all tested Admin routes, including Identity, Legacy, Corrections, and Business Responses, redirected to `/admin/login`.

## Recovery rotation

After this activation record merges and stabilization remains green, delete only the ADMIN-008 validation branch and the obsolete pre-016 recovery branch. Retain Production, baseline snapshot `snap-proud-mud-aelowv17`, pre-017 recovery `br-odd-paper-aeu676bf`, and pre-018 recovery `br-green-pond-aemapr6v`, yielding 3/10 branches.

No secrets, customer PII, raw specialist records, or database credentials are recorded here.
