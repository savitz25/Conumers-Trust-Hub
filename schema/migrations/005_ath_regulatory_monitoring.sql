-- ATH-CUST-008: private, free exact-profile regulatory monitoring.

CREATE TABLE IF NOT EXISTS ath_monitoring_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES ath_organizations(id) ON DELETE CASCADE,
  hub_profile_id UUID NOT NULL REFERENCES ath_hub_profiles(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  email_enabled BOOLEAN NOT NULL DEFAULT false,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  created_by_user_id UUID NOT NULL REFERENCES ath_users(id) ON DELETE RESTRICT,
  activated_at TIMESTAMPTZ,
  baseline_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, hub_profile_id)
);

CREATE TABLE IF NOT EXISTS ath_regulatory_change_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_sequence BIGINT NOT NULL UNIQUE,
  hub_profile_id UUID REFERENCES ath_hub_profiles(id) ON DELETE SET NULL,
  native_profile_id UUID NOT NULL,
  source_system TEXT NOT NULL,
  source_dataset TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  change_type TEXT NOT NULL,
  prior_state JSONB,
  current_state JSONB NOT NULL,
  source_effective_at TIMESTAMPTZ,
  detected_at TIMESTAMPTZ NOT NULL,
  fingerprint_sha256 TEXT NOT NULL UNIQUE,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fingerprint_sha256 ~ '^[0-9a-f]{64}$')
);

ALTER TABLE ath_notifications
  ADD COLUMN IF NOT EXISTS hub_profile_id UUID REFERENCES ath_hub_profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS monitoring_subscription_id UUID REFERENCES ath_monitoring_subscriptions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS monitoring_event_id UUID REFERENCES ath_regulatory_change_events(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS ath_notifications_monitoring_dedupe_idx
  ON ath_notifications(monitoring_subscription_id,monitoring_event_id)
  WHERE monitoring_subscription_id IS NOT NULL AND monitoring_event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ath_notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES ath_notifications(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email')),
  status TEXT NOT NULL CHECK (status IN ('PENDING','SENT','FAILED')),
  attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  provider_message_id TEXT,
  last_error_code TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(notification_id, channel)
);

CREATE TABLE IF NOT EXISTS ath_monitoring_sync_cursors (
  source_key TEXT PRIMARY KEY,
  last_sequence BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ath_monitoring_subscriptions_active_idx
  ON ath_monitoring_subscriptions(hub_profile_id) WHERE enabled;
CREATE INDEX IF NOT EXISTS ath_notifications_monitoring_org_idx
  ON ath_notifications(org_id, created_at DESC) WHERE monitoring_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ath_notifications_monitoring_unread_idx
  ON ath_notifications(org_id, read_at) WHERE monitoring_event_id IS NOT NULL AND read_at IS NULL;
CREATE INDEX IF NOT EXISTS ath_notification_deliveries_pending_idx
  ON ath_notification_deliveries(status, created_at) WHERE status IN ('PENDING','FAILED');

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ath_monitoring_subscriptions','ath_regulatory_change_events',
    'ath_notification_deliveries','ath_monitoring_sync_cursors'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS ath_server_all ON %I', t);
    EXECUTE format('CREATE POLICY ath_server_all ON %I USING (ath_is_server()) WITH CHECK (ath_is_server())', t);
  END LOOP;
END $$;

COMMENT ON TABLE ath_regulatory_change_events IS 'Private source changes that are never evidence or ranking input.';
COMMENT ON COLUMN ath_notifications.monitoring_event_id IS 'Optional private monitoring source event that is never a public alert or evidence row.';
