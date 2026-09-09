-- ATH-ADMIN-005: business activity, campaign attribution and marketing suppression.
CREATE TABLE ath_business_activity_epochs (
  epoch_key TEXT PRIMARY KEY CHECK(epoch_key='MANAGED_PROFILE_OPEN_V1'),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO ath_business_activity_epochs(epoch_key) VALUES('MANAGED_PROFILE_OPEN_V1');

CREATE TABLE ath_business_activity_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK(event_type IN ('MANAGED_PROFILE_OPENED','BUSINESS_MONITORING_VIEWED','BUSINESS_INSIGHTS_VIEWED')),
  org_id UUID NOT NULL REFERENCES ath_organizations(id) ON DELETE RESTRICT,
  hub_profile_id UUID REFERENCES ath_hub_profiles(id) ON DELETE RESTRICT,
  actor_user_id UUID NOT NULL REFERENCES ath_users(id) ON DELETE RESTRICT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  idempotency_key TEXT UNIQUE,
  CHECK(length(idempotency_key)<=160)
);
CREATE INDEX ath_business_activity_org_time_idx ON ath_business_activity_events(org_id,occurred_at DESC);
CREATE INDEX ath_business_activity_profile_time_idx ON ath_business_activity_events(hub_profile_id,occurred_at DESC);

CREATE TABLE ath_growth_campaigns (
  campaign_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK(length(btrim(name)) BETWEEN 3 AND 160),
  channel TEXT NOT NULL CHECK(channel IN ('EMAIL','MANUAL_OUTREACH','PARTNER','OTHER')),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','ACTIVE','PAUSED','COMPLETED','ARCHIVED')),
  acquisition_source TEXT NOT NULL CHECK(acquisition_source IN ('ORGANIC','MANUAL_OUTREACH','EMAIL_CAMPAIGN','INTERNAL_TEST','UNKNOWN')),
  description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=1000),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by_staff UUID NOT NULL REFERENCES ath_admin_staff(staff_id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(ends_at IS NULL OR starts_at IS NULL OR ends_at>=starts_at)
);
CREATE INDEX ath_growth_campaign_status_idx ON ath_growth_campaigns(status,created_at DESC);

CREATE TABLE ath_growth_campaign_targets (
  target_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES ath_growth_campaigns(campaign_id) ON DELETE RESTRICT,
  hub_profile_id UUID REFERENCES ath_hub_profiles(id) ON DELETE RESTRICT,
  external_target_ref TEXT,
  contact_hash TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  claim_path TEXT NOT NULL CHECK(claim_path ~ '^/claim(/|$|\?)' AND claim_path !~ '[\r\n]'),
  status TEXT NOT NULL DEFAULT 'READY' CHECK(status IN ('READY','SUPPRESSED','ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK((hub_profile_id IS NOT NULL)::int+(external_target_ref IS NOT NULL)::int=1),
  CHECK(contact_hash IS NULL OR contact_hash ~ '^[a-f0-9]{64}$'),
  CHECK(external_target_ref IS NULL OR length(external_target_ref)<=160)
);
CREATE INDEX ath_growth_targets_campaign_idx ON ath_growth_campaign_targets(campaign_id,status);

CREATE TABLE ath_growth_campaign_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES ath_growth_campaigns(campaign_id) ON DELETE RESTRICT,
  target_id UUID REFERENCES ath_growth_campaign_targets(target_id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK(event_type IN ('TARGET_ADDED','LINK_CREATED','LINK_CLICKED','SENT','DELIVERED','BOUNCED','COMPLAINT','UNSUBSCRIBED','SUPPRESSED')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  idempotency_key TEXT UNIQUE,
  evidence_source TEXT NOT NULL CHECK(length(evidence_source)<=80)
);
CREATE INDEX ath_growth_events_campaign_time_idx ON ath_growth_campaign_events(campaign_id,occurred_at DESC);

CREATE TABLE ath_claim_attribution (
  claim_id UUID PRIMARY KEY REFERENCES ath_claims(id) ON DELETE RESTRICT,
  acquisition_source TEXT NOT NULL CHECK(acquisition_source IN ('ORGANIC','MANUAL_OUTREACH','EMAIL_CAMPAIGN','INTERNAL_TEST','UNKNOWN')),
  campaign_id UUID REFERENCES ath_growth_campaigns(campaign_id) ON DELETE RESTRICT,
  campaign_target_id UUID REFERENCES ath_growth_campaign_targets(target_id) ON DELETE RESTRICT,
  attributed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attribution_version TEXT NOT NULL DEFAULT 'claim_attribution.v1' CHECK(attribution_version='claim_attribution.v1'),
  CHECK((acquisition_source='EMAIL_CAMPAIGN')=(campaign_id IS NOT NULL))
);
CREATE INDEX ath_claim_attribution_campaign_idx ON ath_claim_attribution(campaign_id,attributed_at DESC);

CREATE TABLE ath_marketing_suppressions (
  suppression_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_hash TEXT NOT NULL CHECK(contact_hash ~ '^[a-f0-9]{64}$'),
  reason TEXT NOT NULL CHECK(reason IN ('UNSUBSCRIBED','BOUNCE','COMPLAINT','MANUAL_DO_NOT_CONTACT','INVALID_CONTACT')),
  source TEXT NOT NULL CHECK(length(source)<=80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(contact_hash)
);

CREATE TRIGGER ath_growth_campaigns_updated_at BEFORE UPDATE ON ath_growth_campaigns FOR EACH ROW EXECUTE FUNCTION ath_set_updated_at();
CREATE TRIGGER ath_business_activity_no_update BEFORE UPDATE ON ath_business_activity_events FOR EACH ROW EXECUTE FUNCTION ath_forbid_mutation();
CREATE TRIGGER ath_business_activity_no_delete BEFORE DELETE ON ath_business_activity_events FOR EACH ROW EXECUTE FUNCTION ath_forbid_mutation();
CREATE TRIGGER ath_growth_events_no_update BEFORE UPDATE ON ath_growth_campaign_events FOR EACH ROW EXECUTE FUNCTION ath_forbid_mutation();
CREATE TRIGGER ath_growth_events_no_delete BEFORE DELETE ON ath_growth_campaign_events FOR EACH ROW EXECUTE FUNCTION ath_forbid_mutation();

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['ath_business_activity_epochs','ath_business_activity_events','ath_growth_campaigns','ath_growth_campaign_targets','ath_growth_campaign_events','ath_claim_attribution','ath_marketing_suppressions'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY ath_server_all ON %I USING (ath_is_server()) WITH CHECK (ath_is_server())',t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC',t);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE format('REVOKE ALL ON TABLE %I FROM anon',t); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated',t); END IF;
  END LOOP;
END $$;
