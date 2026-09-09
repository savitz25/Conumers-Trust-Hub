-- ATH-ADMIN-007: bounded synthetic Search reliability history and incidents.
CREATE TABLE ath_search_canary_runs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), run_group_id UUID NOT NULL, canary_key TEXT NOT NULL CHECK(canary_key ~ '^[A-Z0-9_]{3,100}$'),
 suite_version TEXT NOT NULL, run_kind TEXT NOT NULL CHECK(run_kind IN('QUICK','FULL','RELEASE')), environment TEXT NOT NULL CHECK(environment IN('production','preview','ci')),
 build_id TEXT NOT NULL, surface TEXT NOT NULL CHECK(surface IN('ASK_SSR','GUIDED','CONCIERGE','JOURNEY')), hub TEXT CHECK(hub IS NULL OR hub IN('move','lender','insurance','senior','contractor','investor')),
 status TEXT NOT NULL CHECK(status IN('PASS','FAIL','ERROR','FLAKY','DEPENDENCY_BLOCKED')), terminal_outcome TEXT CHECK(terminal_outcome IS NULL OR terminal_outcome IN('RESULTS','CLARIFICATION','FAIL_CLOSED_WITH_ACTION','FAIL_CLOSED_DEAD_END','ERROR')),
 guided_result_state TEXT, result_count_bucket TEXT CHECK(result_count_bucket IS NULL OR result_count_bucket IN('0','1','2-5','6-20','21-100','101+')), latency_ms INTEGER NOT NULL CHECK(latency_ms>=0),
 assertion_failure_codes TEXT[] NOT NULL DEFAULT '{}', dependency_status TEXT NOT NULL CHECK(dependency_status IN('CURRENT','DELAYED','DEGRADED','UNKNOWN')),
 response_fingerprint_sha256 TEXT CHECK(response_fingerprint_sha256 IS NULL OR response_fingerprint_sha256 ~ '^[a-f0-9]{64}$'), started_at TIMESTAMPTZ NOT NULL, completed_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK(completed_at>=started_at)
);
CREATE TABLE ath_search_release_evaluations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), build_id TEXT NOT NULL, environment TEXT NOT NULL CHECK(environment IN('production','preview','ci')), suite_version TEXT NOT NULL,
 gate_state TEXT NOT NULL CHECK(gate_state IN('READY','WARN','BLOCKED','UNKNOWN')), reason_codes TEXT[] NOT NULL DEFAULT '{}', critical_total INTEGER NOT NULL CHECK(critical_total>=0), critical_passed INTEGER NOT NULL CHECK(critical_passed>=0), critical_failed INTEGER NOT NULL CHECK(critical_failed>=0), warning_failed INTEGER NOT NULL CHECK(warning_failed>=0), flaky_count INTEGER NOT NULL CHECK(flaky_count>=0), dependency_blocked_count INTEGER NOT NULL CHECK(dependency_blocked_count>=0),
 evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(), evidence_fresh_until TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE ath_search_incidents (
 incident_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), stable_key TEXT NOT NULL UNIQUE, canary_key TEXT NOT NULL, failure_code TEXT NOT NULL, severity TEXT NOT NULL CHECK(severity IN('P0','P1','P2','P3')), status TEXT NOT NULL CHECK(status IN('SUSPECT','OPEN','ACKNOWLEDGED','RECOVERABLE','RESOLVED')), occurrence_count INTEGER NOT NULL DEFAULT 1 CHECK(occurrence_count>0), consecutive_failures INTEGER NOT NULL DEFAULT 1 CHECK(consecutive_failures>=0), consecutive_passes INTEGER NOT NULL DEFAULT 0 CHECK(consecutive_passes>=0), first_seen TIMESTAMPTZ NOT NULL, last_seen TIMESTAMPTZ NOT NULL, acknowledged_by UUID REFERENCES ath_admin_staff(staff_id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE ath_search_incident_events (
 event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), incident_id UUID NOT NULL REFERENCES ath_search_incidents(incident_id) ON DELETE RESTRICT, event_type TEXT NOT NULL CHECK(event_type IN('SUSPECTED','OPENED','OBSERVED','ACKNOWLEDGED','RECHECK_REQUESTED','RECOVERABLE','RESOLVED')), actor_staff_id UUID REFERENCES ath_admin_staff(staff_id) ON DELETE SET NULL, reason_code TEXT NOT NULL, occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ath_search_canary_key_build_idx ON ath_search_canary_runs(canary_key,build_id,completed_at DESC);
CREATE INDEX ath_search_canary_group_idx ON ath_search_canary_runs(run_group_id);
CREATE INDEX ath_search_canary_status_time_idx ON ath_search_canary_runs(status,completed_at DESC);
CREATE INDEX ath_search_release_build_time_idx ON ath_search_release_evaluations(build_id,evaluated_at DESC);
CREATE INDEX ath_search_incidents_status_idx ON ath_search_incidents(status,severity,last_seen DESC);
CREATE INDEX ath_search_incident_events_incident_idx ON ath_search_incident_events(incident_id,occurred_at DESC);
DO $$ DECLARE t TEXT; BEGIN FOREACH t IN ARRAY ARRAY['ath_search_canary_runs','ath_search_release_evaluations','ath_search_incidents','ath_search_incident_events'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t); EXECUTE format('CREATE POLICY ath_server_all ON %I USING (ath_is_server()) WITH CHECK (ath_is_server())',t); EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC',t);
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon')THEN EXECUTE format('REVOKE ALL ON TABLE %I FROM anon',t);END IF; IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated')THEN EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated',t);END IF;
 END LOOP; END $$;
CREATE TRIGGER ath_search_canary_runs_no_update BEFORE UPDATE ON ath_search_canary_runs FOR EACH ROW EXECUTE FUNCTION ath_forbid_mutation();
CREATE TRIGGER ath_search_canary_runs_no_delete BEFORE DELETE ON ath_search_canary_runs FOR EACH ROW EXECUTE FUNCTION ath_forbid_mutation();
CREATE TRIGGER ath_search_release_evaluations_no_update BEFORE UPDATE ON ath_search_release_evaluations FOR EACH ROW EXECUTE FUNCTION ath_forbid_mutation();
CREATE TRIGGER ath_search_release_evaluations_no_delete BEFORE DELETE ON ath_search_release_evaluations FOR EACH ROW EXECUTE FUNCTION ath_forbid_mutation();
CREATE TRIGGER ath_search_incident_events_no_update BEFORE UPDATE ON ath_search_incident_events FOR EACH ROW EXECUTE FUNCTION ath_forbid_mutation();
CREATE TRIGGER ath_search_incident_events_no_delete BEFORE DELETE ON ath_search_incident_events FOR EACH ROW EXECUTE FUNCTION ath_forbid_mutation();
COMMENT ON TABLE ath_search_canary_runs IS 'Append-only bounded synthetic reliability metadata. Raw questions and responses are prohibited.';
COMMENT ON TABLE ath_search_release_evaluations IS 'Append-only build-specific Search release evidence; UNKNOWN is not READY.';
