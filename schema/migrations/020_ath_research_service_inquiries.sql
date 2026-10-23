-- Research Services sample requests. Ask-owned customer Postgres only.
-- Forward-only and idempotent. Do not apply to production until this change is approved.
-- Reversal: schema/migrations/020_ath_research_service_inquiries.down.sql
--
-- The table stores the inquiry the visitor typed. Browser roles have no privileges.
-- Notification state is separate from the saved inquiry.

CREATE TABLE IF NOT EXISTS ath_research_service_inquiries (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key          TEXT NOT NULL,
  content_fingerprint      TEXT NOT NULL,
  name                     TEXT NOT NULL,
  email                    TEXT NOT NULL,
  email_normalized         TEXT NOT NULL,
  organization             TEXT NOT NULL,
  role                     TEXT NOT NULL,
  vendor_count             TEXT NOT NULL,
  message                  TEXT NOT NULL DEFAULT '',
  notification_status      TEXT NOT NULL DEFAULT 'pending',
  notification_attempted_at TIMESTAMPTZ,
  notification_sent_at     TIMESTAMPTZ,
  notification_error_code  TEXT,
  provider_message_ref     TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ath_research_service_inquiries_idempotency_key UNIQUE (idempotency_key),
  CONSTRAINT ath_research_service_inquiries_name_len CHECK (char_length(name) BETWEEN 2 AND 80),
  CONSTRAINT ath_research_service_inquiries_email_len CHECK (char_length(email) BETWEEN 3 AND 120),
  CONSTRAINT ath_research_service_inquiries_organization_len CHECK (char_length(organization) BETWEEN 2 AND 120),
  CONSTRAINT ath_research_service_inquiries_message_len CHECK (char_length(message) <= 1000),
  CONSTRAINT ath_research_service_inquiries_fingerprint_len CHECK (char_length(content_fingerprint) = 64),
  CONSTRAINT ath_research_service_inquiries_idempotency_len CHECK (char_length(idempotency_key) BETWEEN 36 AND 36),
  CONSTRAINT ath_research_service_inquiries_role_check CHECK (
    role IN ('Property manager', 'Association manager', 'Board member', 'Other')
  ),
  CONSTRAINT ath_research_service_inquiries_vendor_count_check CHECK (
    vendor_count IN ('1–10', '11–25', '26–50', '51–100', 'More than 100')
  ),
  CONSTRAINT ath_research_service_inquiries_notification_status_check CHECK (
    notification_status IN ('pending', 'sending', 'sent', 'failed')
  ),
  CONSTRAINT ath_research_service_inquiries_notification_error_check CHECK (
    notification_error_code IS NULL
    OR notification_error_code IN ('unconfigured', 'provider_rejected', 'network')
  ),
  CONSTRAINT ath_research_service_inquiries_provider_ref_len CHECK (
    provider_message_ref IS NULL OR char_length(provider_message_ref) <= 120
  ),
  CONSTRAINT ath_research_service_inquiries_sent_timestamp_check CHECK (
    (notification_status = 'sent' AND notification_sent_at IS NOT NULL)
    OR (notification_status <> 'sent' AND notification_sent_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS ath_research_service_inquiries_fingerprint_idx
  ON ath_research_service_inquiries (content_fingerprint, created_at DESC);

CREATE INDEX IF NOT EXISTS ath_research_service_inquiries_notification_idx
  ON ath_research_service_inquiries (notification_status, created_at)
  WHERE notification_status IN ('pending', 'sending', 'failed');

DROP TRIGGER IF EXISTS ath_research_service_inquiries_updated_at ON ath_research_service_inquiries;
CREATE TRIGGER ath_research_service_inquiries_updated_at
  BEFORE UPDATE ON ath_research_service_inquiries
  FOR EACH ROW EXECUTE FUNCTION ath_set_updated_at();

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ath_research_service_inquiries ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE ath_research_service_inquiries FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS ath_server_all ON ath_research_service_inquiries';
  EXECUTE 'CREATE POLICY ath_server_all ON ath_research_service_inquiries USING (ath_is_server()) WITH CHECK (ath_is_server())';
  EXECUTE 'REVOKE ALL ON TABLE ath_research_service_inquiries FROM PUBLIC';
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE ath_research_service_inquiries FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE ath_research_service_inquiries FROM authenticated';
  END IF;
END $$;

COMMENT ON TABLE ath_research_service_inquiries IS
  'Research Services sample requests. Server role only. No browser read or list policy.';
