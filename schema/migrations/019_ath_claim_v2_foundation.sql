-- ATH-CLAIM-V2-001 — Claim Biz V2 foundation (Ask-owned customer Postgres only).
-- Forward-only, additive, idempotent. NOT applied to Production by the ticket that introduced it.
-- Reversal: schema/migrations/019_ath_claim_v2_foundation.down.sql
--
-- What this adds:
--  * ath_claim_intents: explicit-Continue provenance and acquisition source. Historical rows are untouched;
--    they default to intent_origin='legacy_passive' (created by the pre-V2 accept-on-GET path).
--  * ath_claims: deterministic acquisition source + review-capacity timestamps (Section 6 / 7).
--  * ath_claim_review_sessions: bounded explicit reviewer timer (human handling time is measured from
--    reviewer-declared sessions, never from wall-clock claim age).
--  * ath_claim_intents.receipt_hash: binds an intent to the browser receipt that confirmed it so a
--    double-click is idempotent while a third party holding only the raw token is rejected.

ALTER TABLE ath_claim_intents ADD COLUMN IF NOT EXISTS intent_origin TEXT NOT NULL DEFAULT 'legacy_passive';
ALTER TABLE ath_claim_intents ADD COLUMN IF NOT EXISTS acquisition_source TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE ath_claim_intents ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE ath_claim_intents ADD COLUMN IF NOT EXISTS receipt_hash TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ath_claim_intents_origin_check') THEN
    ALTER TABLE ath_claim_intents ADD CONSTRAINT ath_claim_intents_origin_check
      CHECK (intent_origin IN ('legacy_passive','explicit_continue'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ath_claim_intents_source_check') THEN
    ALTER TABLE ath_claim_intents ADD CONSTRAINT ath_claim_intents_source_check
      CHECK (acquisition_source IN ('organic','manual_outreach','email_campaign','internal_test','unknown'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ath_claim_intents_origin_created_idx ON ath_claim_intents (intent_origin, created_at DESC);

ALTER TABLE ath_claims ADD COLUMN IF NOT EXISTS acquisition_source TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE ath_claims ADD COLUMN IF NOT EXISTS review_started_at TIMESTAMPTZ;
ALTER TABLE ath_claims ADD COLUMN IF NOT EXISTS review_decided_at TIMESTAMPTZ;
ALTER TABLE ath_claims ADD COLUMN IF NOT EXISTS evidence_ready_at_first_review BOOLEAN;
ALTER TABLE ath_claims ADD COLUMN IF NOT EXISTS human_review_active_seconds INTEGER NOT NULL DEFAULT 0;
-- ATH-CLAIM-V2-001R2 (Q5) — the internal review-target clock pauses while responsibility sits with the
-- claimant (status=needs_info). needs_info_entered_at is set while the pause is open and cleared when
-- responsibility returns to staff; needs_info_paused_business_hours accumulates every CLOSED pause so the
-- target clock (lib/customer/review-sla.ts) can subtract total time spent waiting on the claimant.
ALTER TABLE ath_claims ADD COLUMN IF NOT EXISTS needs_info_entered_at TIMESTAMPTZ;
ALTER TABLE ath_claims ADD COLUMN IF NOT EXISTS needs_info_paused_business_hours NUMERIC NOT NULL DEFAULT 0;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ath_claims_acquisition_source_check') THEN
    ALTER TABLE ath_claims ADD CONSTRAINT ath_claims_acquisition_source_check
      CHECK (acquisition_source IN ('organic','manual_outreach','email_campaign','internal_test','unknown'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ath_claims_human_review_seconds_check') THEN
    ALTER TABLE ath_claims ADD CONSTRAINT ath_claims_human_review_seconds_check
      CHECK (human_review_active_seconds >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ath_claims_needs_info_paused_check') THEN
    ALTER TABLE ath_claims ADD CONSTRAINT ath_claims_needs_info_paused_check
      CHECK (needs_info_paused_business_hours >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ath_claims_open_source_idx ON ath_claims (status, acquisition_source, created_at)
  WHERE status IN ('submitted','needs_info','in_review');

CREATE TABLE IF NOT EXISTS ath_claim_review_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id          UUID NOT NULL REFERENCES ath_claims (id) ON DELETE RESTRICT,
  reviewer_user_id  UUID NOT NULL REFERENCES ath_users (id) ON DELETE RESTRICT,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at          TIMESTAMPTZ,
  active_seconds    INTEGER NOT NULL DEFAULT 0 CHECK (active_seconds >= 0),
  end_reason        TEXT CHECK (end_reason IS NULL OR end_reason IN ('decision','manual_stop','expired','superseded')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ath_claim_review_sessions_claim_idx ON ath_claim_review_sessions (claim_id, started_at DESC);
-- ATH-CLAIM-V2-001R2 (Q7): the invariant is ONE open session TOTAL per claim, not one per (claim, reviewer).
-- Migration 019 was still unapplied when this was found, so the constraint is fixed here rather than patched
-- by a follow-on migration. If an older index name from a prior draft exists, drop it first (idempotent).
DROP INDEX IF EXISTS ath_claim_review_sessions_one_open_per_reviewer;
CREATE UNIQUE INDEX IF NOT EXISTS ath_claim_review_sessions_one_open_per_claim
  ON ath_claim_review_sessions (claim_id) WHERE ended_at IS NULL;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ath_claim_review_sessions ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE ath_claim_review_sessions FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS ath_server_all ON ath_claim_review_sessions';
  EXECUTE 'CREATE POLICY ath_server_all ON ath_claim_review_sessions USING (ath_is_server()) WITH CHECK (ath_is_server())';
  EXECUTE 'REVOKE ALL ON TABLE ath_claim_review_sessions FROM PUBLIC';
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE 'REVOKE ALL ON TABLE ath_claim_review_sessions FROM anon'; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE 'REVOKE ALL ON TABLE ath_claim_review_sessions FROM authenticated'; END IF;
END $$;

COMMENT ON COLUMN ath_claim_intents.intent_origin IS 'legacy_passive = created by the pre-V2 accept-on-GET path. explicit_continue = created by an explicit human Continue action (V2).';
COMMENT ON COLUMN ath_claims.human_review_active_seconds IS 'Sum of reviewer-declared review sessions. Never wall-clock claim age.';
COMMENT ON TABLE ath_claim_review_sessions IS 'Bounded explicit reviewer timer. ONE open session per claim (not per reviewer) — see ath_claim_review_sessions_one_open_per_claim. Sessions are capped when closed.';
