-- ATH-LAUNCH-001C: auditable, transition-keyed transactional email delivery.
CREATE TABLE IF NOT EXISTS ath_customer_mail_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  recipient_user_id UUID REFERENCES ath_users(id) ON DELETE SET NULL,
  object_type TEXT NOT NULL,
  object_id UUID NOT NULL,
  state_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING','SENT','FAILED','SUPPRESSED')),
  attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 10),
  last_error_code TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_type,object_type,object_id,state_version)
);
CREATE INDEX IF NOT EXISTS ath_customer_mail_events_retry_idx ON ath_customer_mail_events(status,created_at) WHERE status='FAILED';
ALTER TABLE ath_customer_mail_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ath_customer_mail_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ath_server_all ON ath_customer_mail_events;
CREATE POLICY ath_server_all ON ath_customer_mail_events USING (ath_is_server()) WITH CHECK (ath_is_server());
COMMENT ON TABLE ath_customer_mail_events IS 'Low-content lifecycle delivery ledger; bodies, addresses, tokens and public identifiers are never stored.';
