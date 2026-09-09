-- ATH-ADMIN-003: privacy-safe, first-party product telemetry.

CREATE TABLE IF NOT EXISTS ath_product_events (
  event_id UUID PRIMARY KEY,
  schema_version TEXT NOT NULL CHECK (schema_version = 'product_event.v1'),
  event_name TEXT NOT NULL CHECK (char_length(event_name) BETWEEN 1 AND 80),
  occurred_at TIMESTAMPTZ NOT NULL,
  surface TEXT NOT NULL CHECK (char_length(surface) BETWEEN 1 AND 64),
  hub TEXT NOT NULL CHECK (hub IN ('ask','move','lender','insurance','contractor','senior','investor')),
  route_family TEXT CHECK (route_family IS NULL OR char_length(route_family) BETWEEN 1 AND 80),
  jurisdiction TEXT CHECK (jurisdiction IS NULL OR jurisdiction ~ '^[A-Z]{2}$'),
  profile_class TEXT CHECK (profile_class IS NULL OR char_length(profile_class) BETWEEN 1 AND 64),
  intent TEXT CHECK (intent IS NULL OR char_length(intent) BETWEEN 1 AND 64),
  terminal_outcome TEXT CHECK (terminal_outcome IS NULL OR terminal_outcome IN ('RESULTS','CLARIFICATION','FAIL_CLOSED_WITH_ACTION','FAIL_CLOSED_DEAD_END','ERROR')),
  failure_reason TEXT CHECK (failure_reason IS NULL OR char_length(failure_reason) BETWEEN 1 AND 80),
  next_action_type TEXT CHECK (next_action_type IS NULL OR char_length(next_action_type) BETWEEN 1 AND 64),
  auth_state TEXT CHECK (auth_state IS NULL OR auth_state IN ('ANONYMOUS','AUTHENTICATED','UNKNOWN')),
  acquisition_source TEXT CHECK (acquisition_source IS NULL OR acquisition_source IN ('ORGANIC','MANUAL_OUTREACH','EMAIL_CAMPAIGN','INTERNAL_TEST','UNKNOWN')),
  campaign_id TEXT CHECK (campaign_id IS NULL OR char_length(campaign_id) BETWEEN 1 AND 80),
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms BETWEEN 0 AND 300000),
  result_count_bucket TEXT CHECK (result_count_bucket IS NULL OR result_count_bucket IN ('0','1','2-10','11-25','26-100','101-500','501-1000','1001+')),
  build_id TEXT CHECK (build_id IS NULL OR char_length(build_id) BETWEEN 1 AND 80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ath_product_events_occurred_idx ON ath_product_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS ath_product_events_name_time_idx ON ath_product_events(event_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS ath_product_events_hub_time_idx ON ath_product_events(hub, occurred_at DESC);
CREATE INDEX IF NOT EXISTS ath_product_events_terminal_time_idx ON ath_product_events(terminal_outcome, occurred_at DESC) WHERE terminal_outcome IS NOT NULL;
CREATE INDEX IF NOT EXISTS ath_product_events_campaign_time_idx ON ath_product_events(campaign_id, occurred_at DESC) WHERE campaign_id IS NOT NULL;

ALTER TABLE ath_product_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ath_product_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ath_server_all ON ath_product_events;
CREATE POLICY ath_server_all ON ath_product_events USING (ath_is_server()) WITH CHECK (ath_is_server());
REVOKE ALL ON TABLE ath_product_events FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON TABLE ath_product_events FROM anon; END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON TABLE ath_product_events FROM authenticated; END IF;
END $$;

INSERT INTO ath_product_events(event_id,schema_version,event_name,occurred_at,surface,hub,route_family,build_id)
VALUES('00000000-0000-4000-8000-000000000012','product_event.v1','telemetry_store_activated',now(),'CONTROL_PLANE','ask','/admin','migration-012')
ON CONFLICT(event_id) DO NOTHING;

COMMENT ON TABLE ath_product_events IS 'Privacy-safe product_event.v1 observations. No raw queries, PII, tokens, private notes/decisions, or unrestricted metadata.';
