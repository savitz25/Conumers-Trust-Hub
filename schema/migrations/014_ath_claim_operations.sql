-- ATH-ADMIN-004: operational case workflow referencing authoritative claims.
CREATE TABLE IF NOT EXISTS ath_ops_cases (
  case_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_version TEXT NOT NULL DEFAULT 'ops_case.v1' CHECK(schema_version='ops_case.v1'),
  case_type TEXT NOT NULL CHECK(case_type IN ('CLAIM_REVIEW','COMPETING_CLAIM')),
  hub TEXT NOT NULL CHECK(hub IN ('contractor','move','lender','senior','insurance','investor')),
  jurisdiction TEXT CHECK(jurisdiction IS NULL OR jurisdiction ~ '^[A-Z]{2}$'),
  severity TEXT NOT NULL CHECK(severity IN ('P0','P1','P2','P3')),
  status TEXT NOT NULL CHECK(status IN ('OPEN','IN_PROGRESS','WAITING','RESOLVED','CLOSED')),
  workflow_state TEXT NOT NULL CHECK(workflow_state IN ('OPEN','TRIAGE','WAITING_FOR_CLAIMANT','READY_FOR_REVIEW','ON_HOLD','RESOLVED_APPROVED','RESOLVED_REJECTED','RESOLVED_WITHDRAWN','CLOSED')),
  queue TEXT NOT NULL DEFAULT 'claim_operations',
  target_type TEXT NOT NULL DEFAULT 'claim' CHECK(target_type='claim'),
  target_ref UUID NOT NULL REFERENCES ath_claims(id) ON DELETE RESTRICT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  internal_target_due_at TIMESTAMPTZ,
  assigned_staff_id UUID REFERENCES ath_admin_staff(staff_id) ON DELETE SET NULL,
  reason_codes TEXT[] NOT NULL DEFAULT '{}',
  evidence_refs TEXT[] NOT NULL DEFAULT '{}',
  resolution TEXT,
  audit_refs TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(target_type,target_ref)
);

CREATE TABLE IF NOT EXISTS ath_claim_policy_evaluations (
  evaluation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES ath_ops_cases(case_id) ON DELETE RESTRICT,
  claim_id UUID NOT NULL REFERENCES ath_claims(id) ON DELETE RESTRICT,
  policy_version TEXT NOT NULL,
  result TEXT NOT NULL CHECK(result IN ('GREEN','AMBER','RED','NOT_YET_DEFINED')),
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  strong_signals TEXT[] NOT NULL DEFAULT '{}',
  missing_evidence TEXT[] NOT NULL DEFAULT '{}',
  step_up_reasons TEXT[] NOT NULL DEFAULT '{}',
  disqualifiers TEXT[] NOT NULL DEFAULT '{}',
  conflicts TEXT[] NOT NULL DEFAULT '{}',
  risk_signals TEXT[] NOT NULL DEFAULT '{}',
  existing_grant_state TEXT NOT NULL,
  competing_claim_state TEXT NOT NULL,
  identity_revalidated BOOLEAN NOT NULL,
  automatic_approval BOOLEAN NOT NULL DEFAULT false CHECK(automatic_approval=false)
);

CREATE TABLE IF NOT EXISTS ath_ops_case_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES ath_ops_cases(case_id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL,
  actor_staff_id UUID REFERENCES ath_admin_staff(staff_id) ON DELETE SET NULL,
  reason_code TEXT NOT NULL,
  from_state TEXT,
  to_state TEXT,
  domain_audit_ref UUID REFERENCES ath_audit_events(id) ON DELETE SET NULL,
  admin_audit_ref UUID REFERENCES ath_admin_audit_log(audit_id) ON DELETE SET NULL,
  idempotency_key TEXT UNIQUE,
  result JSONB NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ath_ops_cases_queue_idx ON ath_ops_cases(status,workflow_state,opened_at);
CREATE INDEX IF NOT EXISTS ath_ops_cases_hub_idx ON ath_ops_cases(hub,status,opened_at);
CREATE INDEX IF NOT EXISTS ath_claim_policy_evaluations_claim_idx ON ath_claim_policy_evaluations(claim_id,evaluated_at DESC);
CREATE INDEX IF NOT EXISTS ath_ops_case_events_case_idx ON ath_ops_case_events(case_id,occurred_at DESC);

CREATE TRIGGER ath_ops_cases_updated_at BEFORE UPDATE ON ath_ops_cases FOR EACH ROW EXECUTE FUNCTION ath_set_updated_at();
CREATE TRIGGER ath_ops_case_events_no_update BEFORE UPDATE ON ath_ops_case_events FOR EACH ROW EXECUTE FUNCTION ath_forbid_mutation();
CREATE TRIGGER ath_ops_case_events_no_delete BEFORE DELETE ON ath_ops_case_events FOR EACH ROW EXECUTE FUNCTION ath_forbid_mutation();
CREATE TRIGGER ath_claim_policy_evaluations_no_update BEFORE UPDATE ON ath_claim_policy_evaluations FOR EACH ROW EXECUTE FUNCTION ath_forbid_mutation();
CREATE TRIGGER ath_claim_policy_evaluations_no_delete BEFORE DELETE ON ath_claim_policy_evaluations FOR EACH ROW EXECUTE FUNCTION ath_forbid_mutation();

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['ath_ops_cases','ath_claim_policy_evaluations','ath_ops_case_events'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY ath_server_all ON %I USING (ath_is_server()) WITH CHECK (ath_is_server())',t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC',t);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE format('REVOKE ALL ON TABLE %I FROM anon',t); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated',t); END IF;
  END LOOP;
END $$;

INSERT INTO ath_ops_cases(case_type,hub,jurisdiction,severity,status,workflow_state,target_ref,opened_at,internal_target_due_at,reason_codes)
SELECT CASE WHEN q.work_type='competing_claim' THEN 'COMPETING_CLAIM' ELSE 'CLAIM_REVIEW' END,p.hub_id,NULLIF(p.home_state,'NA'),CASE WHEN q.risk_state IN('competing','elevated') THEN 'P1' ELSE 'P2' END,
       CASE WHEN c.status='needs_info' THEN 'WAITING' ELSE 'OPEN' END,CASE WHEN c.status='needs_info' THEN 'WAITING_FOR_CLAIMANT' ELSE 'READY_FOR_REVIEW' END,c.id,q.created_at,q.created_at+interval '72 hours',ARRAY['MIGRATED_EXISTING_REVIEW']
FROM ath_review_queue q JOIN ath_claims c ON c.id=q.object_id JOIN ath_hub_profiles p ON p.id=c.hub_profile_id
WHERE q.object_type='ath_claims' AND q.status IN('open','in_progress')
ON CONFLICT(target_type,target_ref) DO NOTHING;
