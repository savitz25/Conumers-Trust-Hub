-- ATH-CUST-006: Layer D record-issue workflow. Never authoritative evidence.
CREATE TABLE IF NOT EXISTS ath_record_issues (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES ath_organizations(id) ON DELETE RESTRICT,
  hub_profile_id        UUID NOT NULL REFERENCES ath_hub_profiles(id) ON DELETE RESTRICT,
  submitted_by_user_id  UUID NOT NULL REFERENCES ath_users(id) ON DELETE RESTRICT,
  issue_type            TEXT NOT NULL CHECK (issue_type IN ('WRONG_BUSINESS','WRONG_LICENSE','WRONG_LICENSE_STATUS','WRONG_ADDRESS','WRONG_CONTACT_INFORMATION','WRONG_QUALIFIER_RELATIONSHIP','WRONG_DISCIPLINE_LINK','DUPLICATE_PROFILE','BUSINESS_CLOSED_OR_CHANGED','OUTDATED_INFORMATION','OTHER_RECORD_ISSUE')),
  target_layer          TEXT NOT NULL CHECK (target_layer IN ('AUTHORITATIVE_EVIDENCE','TRUSTHUB_INTELLIGENCE')),
  target_record_type    TEXT NOT NULL CHECK (target_record_type IN ('PROFILE','BUSINESS_IDENTITY','DBPR_CREDENTIAL','OFFICIAL_ADDRESS','QUALIFIER_RELATIONSHIP','DISCIPLINE_EVENT','TRUSTHUB_INTELLIGENCE')),
  target_record_id      TEXT,
  explanation           TEXT NOT NULL CHECK (char_length(explanation) BETWEEN 20 AND 2000),
  source                TEXT NOT NULL DEFAULT 'BUSINESS_REPORTED' CHECK (source='BUSINESS_REPORTED'),
  status                TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','UNDER_REVIEW','NEEDS_INFORMATION','RESOLVED_CORRECTED','RESOLVED_NO_CHANGE','RESOLVED_SOURCE_PENDING','REJECTED','WITHDRAWN')),
  version               INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  customer_resolution_note TEXT,
  internal_resolution_note TEXT,
  resolved_at           TIMESTAMPTZ,
  resolved_by           UUID REFERENCES ath_users(id) ON DELETE SET NULL,
  resolution_code       TEXT CHECK (resolution_code IN ('CORRECTED','NO_CHANGE','SOURCE_PENDING','INVALID','WITHDRAWN')),
  submission_fingerprint TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (target_record_id IS NULL OR char_length(target_record_id) BETWEEN 1 AND 160)
);

CREATE TABLE IF NOT EXISTS ath_record_issue_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id        UUID NOT NULL REFERENCES ath_record_issues(id) ON DELETE RESTRICT,
  org_id          UUID NOT NULL REFERENCES ath_organizations(id) ON DELETE RESTRICT,
  hub_profile_id  UUID NOT NULL REFERENCES ath_hub_profiles(id) ON DELETE RESTRICT,
  actor_user_id   UUID REFERENCES ath_users(id) ON DELETE SET NULL,
  actor_kind      TEXT NOT NULL CHECK (actor_kind IN ('user','staff','system')),
  event_type      TEXT NOT NULL CHECK (event_type IN ('record_issue_created','record_issue_under_review','record_issue_more_info_requested','record_issue_customer_response','record_issue_resolved_corrected','record_issue_resolved_no_change','record_issue_source_pending','record_issue_rejected','record_issue_withdrawn')),
  from_status     TEXT,
  to_status       TEXT NOT NULL,
  message         TEXT,
  visibility      TEXT NOT NULL DEFAULT 'CUSTOMER' CHECK (visibility IN ('CUSTOMER','INTERNAL')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ath_record_issue_remediation_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES ath_record_issues(id) ON DELETE RESTRICT,
  action_type TEXT NOT NULL DEFAULT 'AUTHORITATIVE_RECONCILIATION' CHECK (action_type='AUTHORITATIVE_RECONCILIATION'),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','COMPLETED','CANCELLED')),
  created_by UUID NOT NULL REFERENCES ath_users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(issue_id,action_type)
);

CREATE INDEX IF NOT EXISTS ath_record_issues_profile_idx ON ath_record_issues(org_id,hub_profile_id,created_at DESC);
CREATE INDEX IF NOT EXISTS ath_record_issues_review_idx ON ath_record_issues(status,issue_type,created_at) WHERE status IN ('OPEN','UNDER_REVIEW','NEEDS_INFORMATION');
CREATE UNIQUE INDEX IF NOT EXISTS ath_record_issues_open_duplicate_idx ON ath_record_issues(org_id,hub_profile_id,submission_fingerprint) WHERE status IN ('OPEN','UNDER_REVIEW','NEEDS_INFORMATION');
CREATE INDEX IF NOT EXISTS ath_record_issue_events_issue_idx ON ath_record_issue_events(issue_id,created_at,id);
CREATE INDEX IF NOT EXISTS ath_record_issue_remediation_open_idx ON ath_record_issue_remediation_tasks(status,created_at) WHERE status IN ('OPEN','IN_PROGRESS');

CREATE OR REPLACE FUNCTION ath_record_issue_protect_submission() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.org_id IS DISTINCT FROM OLD.org_id OR NEW.hub_profile_id IS DISTINCT FROM OLD.hub_profile_id
     OR NEW.submitted_by_user_id IS DISTINCT FROM OLD.submitted_by_user_id OR NEW.issue_type IS DISTINCT FROM OLD.issue_type
     OR NEW.target_layer IS DISTINCT FROM OLD.target_layer OR NEW.target_record_type IS DISTINCT FROM OLD.target_record_type
     OR NEW.target_record_id IS DISTINCT FROM OLD.target_record_id OR NEW.explanation IS DISTINCT FROM OLD.explanation
     OR NEW.source IS DISTINCT FROM OLD.source OR NEW.submission_fingerprint IS DISTINCT FROM OLD.submission_fingerprint
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'record issue submission is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ath_record_issues_updated_at ON ath_record_issues;
CREATE TRIGGER ath_record_issues_updated_at BEFORE UPDATE ON ath_record_issues FOR EACH ROW EXECUTE FUNCTION ath_set_updated_at();
DROP TRIGGER IF EXISTS ath_record_issue_remediation_updated_at ON ath_record_issue_remediation_tasks;
CREATE TRIGGER ath_record_issue_remediation_updated_at BEFORE UPDATE ON ath_record_issue_remediation_tasks FOR EACH ROW EXECUTE FUNCTION ath_set_updated_at();
DROP TRIGGER IF EXISTS ath_record_issues_protect_submission ON ath_record_issues;
CREATE TRIGGER ath_record_issues_protect_submission BEFORE UPDATE ON ath_record_issues FOR EACH ROW EXECUTE FUNCTION ath_record_issue_protect_submission();
DROP TRIGGER IF EXISTS ath_record_issue_events_no_update ON ath_record_issue_events;
CREATE TRIGGER ath_record_issue_events_no_update BEFORE UPDATE ON ath_record_issue_events FOR EACH ROW EXECUTE FUNCTION ath_forbid_mutation();
DROP TRIGGER IF EXISTS ath_record_issue_events_no_delete ON ath_record_issue_events;
CREATE TRIGGER ath_record_issue_events_no_delete BEFORE DELETE ON ath_record_issue_events FOR EACH ROW EXECUTE FUNCTION ath_forbid_mutation();

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['ath_record_issues','ath_record_issue_events','ath_record_issue_remediation_tasks'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('DROP POLICY IF EXISTS ath_server_all ON %I',t);
    EXECUTE format('CREATE POLICY ath_server_all ON %I USING (ath_is_server()) WITH CHECK (ath_is_server())',t);
  END LOOP;
END $$;

COMMENT ON TABLE ath_record_issues IS 'Layer D business-reported possible record issues. Filing and resolution never mutate authoritative evidence.';
COMMENT ON COLUMN ath_record_issues.internal_resolution_note IS 'Staff-only. Never returned to claimant APIs.';
