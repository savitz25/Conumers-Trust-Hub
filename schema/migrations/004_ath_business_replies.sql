-- ATH-CUST-007: moderated Layer D business responses. Never authoritative evidence.
ALTER TABLE ath_review_queue DROP CONSTRAINT IF EXISTS ath_review_queue_work_type_check;
ALTER TABLE ath_review_queue ADD CONSTRAINT ath_review_queue_work_type_check CHECK (work_type IN ('claim_review','competing_claim','record_issue','business_reply'));

CREATE TABLE IF NOT EXISTS ath_business_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL REFERENCES ath_organizations(id) ON DELETE RESTRICT,
  hub_profile_id UUID NOT NULL REFERENCES ath_hub_profiles(id) ON DELETE RESTRICT, submitted_by_user_id UUID NOT NULL REFERENCES ath_users(id) ON DELETE RESTRICT,
  reply_type TEXT NOT NULL CHECK(reply_type IN ('CONTEXT','REMEDIATION','RESOLUTION_INFORMATION','OWNERSHIP_OR_MANAGEMENT_CHANGE','TIMELINE_CLARIFICATION','BUSINESS_POSITION','GENERAL_RESPONSE')),
  target_type TEXT NOT NULL CHECK(target_type IN ('DISCIPLINE_EVENT','LICENSE_STATUS','LICENSE_RECORD','QUALIFIER_RELATIONSHIP','OFFICIAL_ADDRESS','BUSINESS_IDENTITY','TRUSTHUB_INTELLIGENCE','PROFILE_GENERAL')),
  target_record_id TEXT, source TEXT NOT NULL DEFAULT 'BUSINESS_RESPONSE' CHECK(source='BUSINESS_RESPONSE'),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','NEEDS_INFORMATION','APPROVED','REJECTED','WITHDRAWN','ARCHIVED')),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), active_revision_id UUID, published_revision_id UUID,
  customer_note TEXT, internal_note TEXT, submitted_at TIMESTAMPTZ, reviewed_at TIMESTAMPTZ, published_at TIMESTAMPTZ, withdrawn_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(target_record_id IS NULL OR char_length(target_record_id) BETWEEN 1 AND 160)
);
CREATE TABLE IF NOT EXISTS ath_business_reply_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), reply_id UUID NOT NULL REFERENCES ath_business_replies(id) ON DELETE RESTRICT,
  revision_number INTEGER NOT NULL CHECK(revision_number>0), body TEXT NOT NULL CHECK(char_length(body) BETWEEN 40 AND 3000),
  created_by_user_id UUID NOT NULL REFERENCES ath_users(id) ON DELETE RESTRICT,
  moderation_status TEXT NOT NULL CHECK(moderation_status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','NEEDS_INFORMATION','APPROVED','REJECTED','WITHDRAWN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), submitted_at TIMESTAMPTZ, approved_at TIMESTAMPTZ,
  UNIQUE(reply_id,revision_number)
);
ALTER TABLE ath_business_replies DROP CONSTRAINT IF EXISTS ath_business_replies_active_revision_fk;
ALTER TABLE ath_business_replies ADD CONSTRAINT ath_business_replies_active_revision_fk FOREIGN KEY(active_revision_id) REFERENCES ath_business_reply_revisions(id) ON DELETE RESTRICT;
ALTER TABLE ath_business_replies DROP CONSTRAINT IF EXISTS ath_business_replies_published_revision_fk;
ALTER TABLE ath_business_replies ADD CONSTRAINT ath_business_replies_published_revision_fk FOREIGN KEY(published_revision_id) REFERENCES ath_business_reply_revisions(id) ON DELETE RESTRICT;
CREATE TABLE IF NOT EXISTS ath_business_reply_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), reply_id UUID NOT NULL REFERENCES ath_business_replies(id) ON DELETE RESTRICT,
  org_id UUID NOT NULL REFERENCES ath_organizations(id) ON DELETE RESTRICT, hub_profile_id UUID NOT NULL REFERENCES ath_hub_profiles(id) ON DELETE RESTRICT,
  actor_user_id UUID REFERENCES ath_users(id) ON DELETE SET NULL, actor_kind TEXT NOT NULL CHECK(actor_kind IN ('user','staff','system')),
  event_type TEXT NOT NULL CHECK(event_type IN ('business_reply_draft_created','business_reply_updated','business_reply_submitted','business_reply_changes_requested','business_reply_customer_response','business_reply_approved','business_reply_rejected','business_reply_revision_created','business_reply_withdrawn','business_reply_archived')),
  revision_id UUID REFERENCES ath_business_reply_revisions(id) ON DELETE RESTRICT, from_status TEXT, to_status TEXT NOT NULL,
  message TEXT, visibility TEXT NOT NULL DEFAULT 'CUSTOMER' CHECK(visibility IN ('CUSTOMER','INTERNAL')), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ath_business_replies_profile_idx ON ath_business_replies(org_id,hub_profile_id,created_at DESC);
CREATE INDEX IF NOT EXISTS ath_business_replies_review_idx ON ath_business_replies(status,created_at) WHERE status IN ('SUBMITTED','UNDER_REVIEW','NEEDS_INFORMATION');
CREATE INDEX IF NOT EXISTS ath_business_replies_public_idx ON ath_business_replies(hub_profile_id,published_at DESC) WHERE status='APPROVED' AND published_revision_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ath_business_replies_active_target_idx ON ath_business_replies(org_id,hub_profile_id,reply_type,target_type,COALESCE(target_record_id,'')) WHERE status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','NEEDS_INFORMATION');
CREATE INDEX IF NOT EXISTS ath_business_reply_events_reply_idx ON ath_business_reply_events(reply_id,created_at,id);
DROP TRIGGER IF EXISTS ath_business_replies_updated_at ON ath_business_replies;
CREATE TRIGGER ath_business_replies_updated_at BEFORE UPDATE ON ath_business_replies FOR EACH ROW EXECUTE FUNCTION ath_set_updated_at();
DROP TRIGGER IF EXISTS ath_business_reply_events_no_update ON ath_business_reply_events;
CREATE TRIGGER ath_business_reply_events_no_update BEFORE UPDATE ON ath_business_reply_events FOR EACH ROW EXECUTE FUNCTION ath_forbid_mutation();
DROP TRIGGER IF EXISTS ath_business_reply_events_no_delete ON ath_business_reply_events;
CREATE TRIGGER ath_business_reply_events_no_delete BEFORE DELETE ON ath_business_reply_events FOR EACH ROW EXECUTE FUNCTION ath_forbid_mutation();
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['ath_business_replies','ath_business_reply_revisions','ath_business_reply_events'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('DROP POLICY IF EXISTS ath_server_all ON %I',t); EXECUTE format('CREATE POLICY ath_server_all ON %I USING (ath_is_server()) WITH CHECK (ath_is_server())',t);
END LOOP; END $$;
COMMENT ON TABLE ath_business_replies IS 'Layer D moderated business responses that never become authoritative evidence or factual endorsement.';
