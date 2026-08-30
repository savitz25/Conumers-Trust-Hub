-- ATH-CUST-004 — Ask-owned Layer C business-supplied profile information.
-- No table in the ContractorTrustHub evidence plane is referenced or mutated.

CREATE TABLE IF NOT EXISTS ath_business_profile_revisions (
  org_id              UUID NOT NULL REFERENCES ath_organizations (id) ON DELETE RESTRICT,
  hub_profile_id      UUID NOT NULL REFERENCES ath_hub_profiles (id) ON DELETE RESTRICT,
  version             INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, hub_profile_id)
);

CREATE TABLE IF NOT EXISTS ath_business_profile_fields (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES ath_organizations (id) ON DELETE RESTRICT,
  hub_profile_id      UUID NOT NULL REFERENCES ath_hub_profiles (id) ON DELETE RESTRICT,
  field_key           TEXT NOT NULL CHECK (field_key IN (
    'description', 'website', 'public_phone', 'public_email', 'founded_year',
    'emergency_service', 'contact_context'
  )),
  value_text          TEXT NOT NULL,
  source              TEXT NOT NULL DEFAULT 'BUSINESS_SUPPLIED' CHECK (source = 'BUSINESS_SUPPLIED'),
  supplied_by_user_id UUID NOT NULL REFERENCES ath_users (id) ON DELETE RESTRICT,
  first_supplied_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_confirmed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  version             INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (org_id, hub_profile_id, field_key)
);

CREATE TABLE IF NOT EXISTS ath_business_profile_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES ath_organizations (id) ON DELETE RESTRICT,
  hub_profile_id      UUID NOT NULL REFERENCES ath_hub_profiles (id) ON DELETE RESTRICT,
  category            TEXT NOT NULL CHECK (category IN ('service', 'service_area', 'language')),
  value_text          TEXT NOT NULL,
  position            INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  source              TEXT NOT NULL DEFAULT 'BUSINESS_SUPPLIED' CHECK (source = 'BUSINESS_SUPPLIED'),
  supplied_by_user_id UUID NOT NULL REFERENCES ath_users (id) ON DELETE RESTRICT,
  first_supplied_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_confirmed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  version             INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (org_id, hub_profile_id, category, value_text)
);

CREATE TABLE IF NOT EXISTS ath_business_profile_hours (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES ath_organizations (id) ON DELETE RESTRICT,
  hub_profile_id      UUID NOT NULL REFERENCES ath_hub_profiles (id) ON DELETE RESTRICT,
  weekday             SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  is_closed           BOOLEAN NOT NULL DEFAULT false,
  opens_at            TIME,
  closes_at           TIME,
  source              TEXT NOT NULL DEFAULT 'BUSINESS_SUPPLIED' CHECK (source = 'BUSINESS_SUPPLIED'),
  supplied_by_user_id UUID NOT NULL REFERENCES ath_users (id) ON DELETE RESTRICT,
  first_supplied_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_confirmed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  version             INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  CHECK ((is_closed AND opens_at IS NULL AND closes_at IS NULL) OR
         (NOT is_closed AND opens_at IS NOT NULL AND closes_at IS NOT NULL AND opens_at < closes_at)),
  UNIQUE (org_id, hub_profile_id, weekday)
);

CREATE INDEX IF NOT EXISTS ath_business_profile_fields_profile_idx
  ON ath_business_profile_fields (hub_profile_id, org_id);
CREATE INDEX IF NOT EXISTS ath_business_profile_items_profile_idx
  ON ath_business_profile_items (hub_profile_id, org_id, category, position);
CREATE INDEX IF NOT EXISTS ath_business_profile_hours_profile_idx
  ON ath_business_profile_hours (hub_profile_id, org_id, weekday);

DROP TRIGGER IF EXISTS ath_business_profile_fields_updated_at ON ath_business_profile_fields;
CREATE TRIGGER ath_business_profile_fields_updated_at BEFORE UPDATE ON ath_business_profile_fields
  FOR EACH ROW EXECUTE FUNCTION ath_set_updated_at();
DROP TRIGGER IF EXISTS ath_business_profile_items_updated_at ON ath_business_profile_items;
CREATE TRIGGER ath_business_profile_items_updated_at BEFORE UPDATE ON ath_business_profile_items
  FOR EACH ROW EXECUTE FUNCTION ath_set_updated_at();
DROP TRIGGER IF EXISTS ath_business_profile_hours_updated_at ON ath_business_profile_hours;
CREATE TRIGGER ath_business_profile_hours_updated_at BEFORE UPDATE ON ath_business_profile_hours
  FOR EACH ROW EXECUTE FUNCTION ath_set_updated_at();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ath_business_profile_revisions', 'ath_business_profile_fields', 'ath_business_profile_items', 'ath_business_profile_hours'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS ath_server_all ON %I', t);
    EXECUTE format('CREATE POLICY ath_server_all ON %I USING (ath_is_server()) WITH CHECK (ath_is_server())', t);
  END LOOP;
END;
$$;

COMMENT ON TABLE ath_business_profile_fields IS 'Layer C scalar fields supplied by an authorized business manager and never authoritative evidence.';
COMMENT ON TABLE ath_business_profile_items IS 'Layer C repeating services, service areas, and languages with field-level provenance.';
COMMENT ON TABLE ath_business_profile_hours IS 'Layer C business hours with field-level provenance.';
