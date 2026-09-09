-- ATH-ADMIN-006: bounded capability health metadata and data incidents only.
CREATE TABLE ath_data_capabilities (
  capability_key TEXT PRIMARY KEY CHECK(capability_key ~ '^[A-Z0-9_]{3,100}$'),
  hub TEXT NOT NULL CHECK(hub IN('ask','contractor','move','lender','insurance','senior','investor')),
  category TEXT NOT NULL CHECK(category IN('IDENTITY','CREDENTIAL','DISCIPLINE','ENFORCEMENT','INSPECTION','COMPLAINT','OWNERSHIP','FINANCIAL','PUBLICATION','MONITORING','ALERT_PIPELINE')),
  source_system TEXT NOT NULL, source_dataset TEXT NOT NULL, jurisdiction TEXT CHECK(jurisdiction IS NULL OR jurisdiction ~ '^[A-Z]{2}$'), profile_class TEXT,
  criticality TEXT NOT NULL CHECK(criticality IN('CRITICAL','HIGH','STANDARD')), owner_name TEXT NOT NULL,
  expected_check_minutes INTEGER CHECK(expected_check_minutes>0), expected_freshness_minutes INTEGER CHECK(expected_freshness_minutes>0),
  publication_expected BOOLEAN NOT NULL, monitoring_expected BOOLEAN NOT NULL,
  health_adapter_type TEXT NOT NULL CHECK(health_adapter_type IN('ASK_DATABASE','SIGNED_CONTRACTOR_FEED','CHECKED_IN_ARTIFACT','NOT_INSTRUMENTED')),
  documentation_ref TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE ath_data_health_observations (
  observation_id TEXT PRIMARY KEY CHECK(length(observation_id) BETWEEN 1 AND 100), schema_version TEXT NOT NULL CHECK(schema_version='capability_health.v1'),
  capability_key TEXT NOT NULL REFERENCES ath_data_capabilities(capability_key) ON DELETE RESTRICT, hub TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN('CURRENT','DELAYED','DEGRADED','UNKNOWN')), reason_code TEXT NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL, last_success_at TIMESTAMPTZ, last_failure_at TIMESTAMPTZ,
  source_as_of TIMESTAMPTZ, retrieved_at TIMESTAMPTZ, snapshot_as_of TIMESTAMPTZ, accepted_at TIMESTAMPTZ, generated_at TIMESTAMPTZ, published_at TIMESTAMPTZ,
  records_observed BIGINT CHECK(records_observed>=0), previous_records_observed BIGINT CHECK(previous_records_observed>=0), build_id TEXT, contract_version TEXT,
  evidence_ref TEXT NOT NULL, observed_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(checked_at<=now()+interval '5 minutes'), CHECK(source_as_of IS NULL OR source_as_of<=now()+interval '5 minutes'), CHECK(retrieved_at IS NULL OR retrieved_at<=now()+interval '5 minutes'),
  CHECK(snapshot_as_of IS NULL OR snapshot_as_of<=now()+interval '5 minutes'), CHECK(accepted_at IS NULL OR accepted_at<=now()+interval '5 minutes'), CHECK(generated_at IS NULL OR generated_at<=now()+interval '5 minutes'), CHECK(published_at IS NULL OR published_at<=now()+interval '5 minutes')
);
CREATE TABLE ath_data_incidents (
  incident_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), capability_key TEXT NOT NULL REFERENCES ath_data_capabilities(capability_key) ON DELETE RESTRICT,
  incident_type TEXT NOT NULL CHECK(incident_type IN('SOURCE_HEALTH','PUBLICATION_HEALTH','MONITORING_HEALTH','ALERT_PIPELINE','SCHEMA_DRIFT')),
  severity TEXT NOT NULL CHECK(severity IN('P0','P1','P2','P3')), status TEXT NOT NULL CHECK(status IN('OPEN','ACKNOWLEDGED','RESOLVED')),
  reason_code TEXT NOT NULL, stable_key TEXT NOT NULL UNIQUE, first_seen TIMESTAMPTZ NOT NULL, last_seen TIMESTAMPTZ NOT NULL, occurrence_count INTEGER NOT NULL DEFAULT 1 CHECK(occurrence_count>0),
  acknowledged_at TIMESTAMPTZ, acknowledged_by UUID REFERENCES ath_admin_staff(staff_id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ, resolved_by UUID REFERENCES ath_admin_staff(staff_id) ON DELETE SET NULL, resolution_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE ath_data_incident_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), incident_id UUID NOT NULL REFERENCES ath_data_incidents(incident_id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK(event_type IN('OPENED','OBSERVED','ACKNOWLEDGED','RECHECK_REQUESTED','RESOLVED','REOPENED')),
  actor_staff_id UUID REFERENCES ath_admin_staff(staff_id) ON DELETE SET NULL, reason_code TEXT NOT NULL, occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ath_data_health_capability_time_idx ON ath_data_health_observations(capability_key,checked_at DESC);
CREATE INDEX ath_data_health_status_time_idx ON ath_data_health_observations(status,checked_at DESC);
CREATE INDEX ath_data_capabilities_hub_category_idx ON ath_data_capabilities(hub,category);
CREATE INDEX ath_data_incidents_status_severity_idx ON ath_data_incidents(status,severity,last_seen DESC);
CREATE INDEX ath_data_incident_events_incident_time_idx ON ath_data_incident_events(incident_id,occurred_at DESC);
CREATE TRIGGER ath_data_capabilities_updated_at BEFORE UPDATE ON ath_data_capabilities FOR EACH ROW EXECUTE FUNCTION ath_set_updated_at();
CREATE TRIGGER ath_data_incidents_updated_at BEFORE UPDATE ON ath_data_incidents FOR EACH ROW EXECUTE FUNCTION ath_set_updated_at();
CREATE TRIGGER ath_data_health_no_update BEFORE UPDATE ON ath_data_health_observations FOR EACH ROW EXECUTE FUNCTION ath_forbid_mutation();
CREATE TRIGGER ath_data_health_no_delete BEFORE DELETE ON ath_data_health_observations FOR EACH ROW EXECUTE FUNCTION ath_forbid_mutation();
CREATE TRIGGER ath_data_incident_events_no_update BEFORE UPDATE ON ath_data_incident_events FOR EACH ROW EXECUTE FUNCTION ath_forbid_mutation();
CREATE TRIGGER ath_data_incident_events_no_delete BEFORE DELETE ON ath_data_incident_events FOR EACH ROW EXECUTE FUNCTION ath_forbid_mutation();
DO $$ DECLARE t TEXT; BEGIN FOREACH t IN ARRAY ARRAY['ath_data_capabilities','ath_data_health_observations','ath_data_incidents','ath_data_incident_events'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t); EXECUTE format('CREATE POLICY ath_server_all ON %I USING (ath_is_server()) WITH CHECK (ath_is_server())',t); EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC',t);
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon')THEN EXECUTE format('REVOKE ALL ON TABLE %I FROM anon',t);END IF; IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated')THEN EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated',t);END IF;
 END LOOP; END $$;
COMMENT ON TABLE ath_data_health_observations IS 'Append-only health metadata; never specialist Layer A evidence or ranking input.';
COMMENT ON TABLE ath_data_incidents IS 'Deduplicated operational incidents; operator actions cannot overwrite derived health observations.';
