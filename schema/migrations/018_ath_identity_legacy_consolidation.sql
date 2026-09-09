-- ATH-ADMIN-008: exact-grain identity review and bounded legacy adapter observations.
CREATE TABLE ath_identity_reviews (
  review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_key TEXT NOT NULL UNIQUE CHECK(review_key ~ '^[A-Za-z0-9:_-]{8,240}$'),
  review_type TEXT NOT NULL CHECK(review_type IN ('POSSIBLE_DUPLICATE','IDENTIFIER_REUSED','REVIEW_REQUIRED_BINDING','PROFILE_REDIRECT','MERGE_CANDIDATE','SPLIT_CANDIDATE','HUB_PROFILE_ORPHAN','ORGANIZATION_PROFILE_RELATIONSHIP_REVIEW')),
  hub TEXT NOT NULL CHECK(hub IN ('contractor','move','lender','senior','insurance','investor')),
  primary_hub_profile_id UUID REFERENCES ath_hub_profiles(id) ON DELETE RESTRICT,
  secondary_hub_profile_id UUID REFERENCES ath_hub_profiles(id) ON DELETE RESTRICT,
  organization_id UUID REFERENCES ath_organizations(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','WAITING','RESOLVED','CLOSED')),
  severity TEXT NOT NULL DEFAULT 'P2' CHECK(severity IN ('P0','P1','P2','P3')),
  reason_codes TEXT[] NOT NULL CHECK(cardinality(reason_codes)>0),
  match_basis TEXT[] NOT NULL CHECK(cardinality(match_basis)>0),
  dependency_status TEXT CHECK(dependency_status IN ('CURRENT','DELAYED','DEGRADED','UNKNOWN')),
  assigned_staff_id UUID REFERENCES ath_admin_staff(staff_id) ON DELETE SET NULL,
  resolution TEXT CHECK(resolution IS NULL OR resolution IN ('CONFIRM_DISTINCT','CONFIRM_REPLACEMENT_RELATIONSHIP','REQUEST_SPECIALIST_REVIEW','WAIT_FOR_SOURCE_RECOVERY','MARK_BINDING_REVIEWED','CLOSE_NO_ACTION')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(primary_hub_profile_id IS NULL OR secondary_hub_profile_id IS NULL OR primary_hub_profile_id<>secondary_hub_profile_id)
);

CREATE TABLE ath_identity_review_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES ath_identity_reviews(review_id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK(event_type IN ('OPENED','DECISION_RECORDED','REOPENED','NOTE_ADDED')),
  actor_staff_id UUID REFERENCES ath_admin_staff(staff_id) ON DELETE SET NULL,
  reason_code TEXT NOT NULL CHECK(length(reason_code) BETWEEN 3 AND 120),
  from_status TEXT,
  to_status TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ath_legacy_adapter_observations (
  observation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_version TEXT NOT NULL DEFAULT 'legacy_admin_adapter.v1' CHECK(schema_version='legacy_admin_adapter.v1'),
  hub TEXT NOT NULL CHECK(hub IN ('move','insurance','lender')),
  adapter_version TEXT NOT NULL,
  surface_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  capability TEXT NOT NULL,
  queue_count INTEGER CHECK(queue_count IS NULL OR queue_count>=0),
  oldest_item_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK(status IN ('LIVE','NOT_INSTRUMENTED','UNAVAILABLE','DEGRADED')),
  migration_status TEXT NOT NULL CHECK(migration_status IN ('MIGRATED','FEDERATED','RETAINED_LEGACY','QA_ONLY','MACHINE_ONLY','SAFE_TO_RETIRE','BLOCKED')),
  destination_path TEXT CHECK(destination_path IS NULL OR destination_path ~ '^https://(www\.)?(movetrusthub|insurancetrusthub|lendertrusthub)\.com/'),
  checked_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(hub,surface_key,checked_at)
);

CREATE INDEX ath_identity_reviews_queue_idx ON ath_identity_reviews(status,severity,opened_at);
CREATE INDEX ath_identity_reviews_hub_type_idx ON ath_identity_reviews(hub,review_type,status);
CREATE INDEX ath_identity_review_events_review_idx ON ath_identity_review_events(review_id,occurred_at DESC);
CREATE INDEX ath_legacy_adapter_observations_latest_idx ON ath_legacy_adapter_observations(hub,surface_key,checked_at DESC);

CREATE TRIGGER ath_identity_reviews_updated_at BEFORE UPDATE ON ath_identity_reviews FOR EACH ROW EXECUTE FUNCTION ath_set_updated_at();
CREATE TRIGGER ath_identity_review_events_no_update BEFORE UPDATE ON ath_identity_review_events FOR EACH ROW EXECUTE FUNCTION ath_forbid_mutation();
CREATE TRIGGER ath_identity_review_events_no_delete BEFORE DELETE ON ath_identity_review_events FOR EACH ROW EXECUTE FUNCTION ath_forbid_mutation();
CREATE TRIGGER ath_legacy_adapter_observations_no_update BEFORE UPDATE ON ath_legacy_adapter_observations FOR EACH ROW EXECUTE FUNCTION ath_forbid_mutation();
CREATE TRIGGER ath_legacy_adapter_observations_no_delete BEFORE DELETE ON ath_legacy_adapter_observations FOR EACH ROW EXECUTE FUNCTION ath_forbid_mutation();

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['ath_identity_reviews','ath_identity_review_events','ath_legacy_adapter_observations'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY ath_server_all ON %I USING (ath_is_server()) WITH CHECK (ath_is_server())',t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC',t);
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE format('REVOKE ALL ON TABLE %I FROM anon',t); END IF;
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated',t); END IF;
  END LOOP;
END $$;
