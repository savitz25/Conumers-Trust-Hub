# ATH-CLAIM-V2-001 — Production Baseline (READ ONLY)

Status: **BLOCKED — not recomputed by Builder 2.** No production row was read, written, or contacted.

## Why it is blocked

- Every Ask `.env.local` available to this builder (fourteen sibling worktrees plus the original checkout)
  carries Vercel's `[SENSITIVE]` redaction for the Ask customer database URL (`neon_tech_database`), which the
  repository's own env loader (`scripts/load-env.mjs`) explicitly skips. The file the coordinator named does not
  exist; the closest siblings are byte-identical stubs containing only `VERCEL_OIDC_TOKEN`.
- Further discovery of a usable credential was denied by the environment's permission classifier
  ("Credential Exploration"). Per the standing rule it was not retried or routed around.
- Vercel CLI is not installed locally, so `vercel env pull` was not attempted.

## What is ready for the Founder to run

`npm run baseline:claim-v2` (script: `scripts/claim-v2-production-baseline.ts`) with a real `.env.local`.

Guarantees built into the script:

- single `pg` client, `BEGIN READ ONLY`, `SET LOCAL statement_timeout = 20s`, every query inside a
  SAVEPOINT, unconditional `ROLLBACK`; zero writes, zero DDL;
- prints counts, dates and classifications only — never an email, legal/organization name, public profile
  name, IP, user agent, token or connection string;
- per open claim it prints the opaque claim id (for `/admin/operations/claims/<id>`), status, submitted date,
  age, hub, class, state, relationship, free-email flag, email-confirmed flag, account age, attested/attributed
  source, competing flag, other-claim counts, prior grants for the same claimant, distinct IP count, whether an
  IP is shared with staff audit events, org record-issue / supplied-field counts, the audit action trail, and a
  classification with reasons;
- classification is one of `INTERNAL_TEST_CONFIRMED` (staff/QA operator account, explicit `internal_test`
  label, or synthetic fixture marker), `LIKELY_INTERNAL_TEST` (prior proof-cohort grant, IP shared with staff,
  qa/test/proof address tag), `POTENTIAL_REAL_CLAIM`, `UNKNOWN`. `REAL_CLAIM_CONFIRMED` is never produced by
  code. Email domain alone is never a classifier.
- `founder_action_required` is set for `POTENTIAL_REAL_CLAIM` and `UNKNOWN`.

## Prior audit numbers (STALE — not recomputed, reproduced for reference only)

| Metric | Prior audit |
| --- | --- |
| Claims (all Contractor) | 5 |
| Approved historical proof claims | 3 (all associated grants deliberately revoked for QA hygiene) |
| Submitted claims still open | 2 |
| Active management grants | 0 |
| Business responses | 0 |
| Monitoring subscriptions | 0 |
| Historical claim intents | 5,997 (overwhelmingly Contractor) |
| Consumed intents | 4 |

Users, organizations, business profiles with supplied fields, review-queue count, and open-claim
classifications: **UNKNOWN until the script is run.**

## Recommended Founder actions (exact)

1. Run `npm run baseline:claim-v2` from a checkout with a real Ask `.env.local`; paste the JSON into this
   document's "Recomputed" section (it contains no PII by construction).
2. For each open claim classified `POTENTIAL_REAL_CLAIM` or `UNKNOWN`: open
   `/admin/operations/claims/<claim_id>`, start the review timer with the evidence-ready answer, and decide
   through the normal governance form. Do not approve without an independent authority signal plus a control
   signal. Do not email the claimant merely because this migration surfaced the claim.
3. For each open claim classified `INTERNAL_TEST_CONFIRMED` / `LIKELY_INTERNAL_TEST`: confirm from the audit
   trail, then close it with `reject` + `OTHER_POLICY_REASON` and a rationale that names it synthetic. (The
   V2 column `acquisition_source` cannot be back-filled for historical claims; the decision rationale is the
   record.)
4. Do not delete or alter the 5,997 historical intents. Migration 019 leaves them as `legacy_passive`.
5. Apply migration 019 to Production only after PR review (`schema/migrations/019_ath_claim_v2_foundation.sql`,
   additive, idempotent; reversal in `.down.sql`). Until it is applied, the V2 code paths that read the new
   columns will fail at runtime — the PR must not deploy ahead of the migration.

## Recomputed (to be pasted by the Founder)

_pending_

## Production mutations by this ticket

customer rows changed = 0 · claims changed = 0 · grants changed = 0 · rollout flags changed = 0 ·
production schema changed = 0 · real emails sent = 0 · production reads performed = 0 (blocked).
