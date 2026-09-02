-- ATH-CUST-011A: additive hub-neutral customer profile pointers.
-- Ask customer database only. Never apply to a specialist evidence database.
ALTER TABLE ath_hub_profiles DROP CONSTRAINT IF EXISTS ath_hub_profiles_hub_id_check;
ALTER TABLE ath_hub_profiles DROP CONSTRAINT IF EXISTS ath_hub_profiles_native_source_system_check;
ALTER TABLE ath_hub_profiles DROP CONSTRAINT IF EXISTS ath_hub_profiles_home_state_check;
ALTER TABLE ath_hub_profiles ADD CONSTRAINT ath_hub_profiles_hub_id_check CHECK (hub_id IN ('contractor','move','lender'));
ALTER TABLE ath_hub_profiles ADD COLUMN IF NOT EXISTS identifier_namespace TEXT;
ALTER TABLE ath_hub_profiles ADD COLUMN IF NOT EXISTS entity_class TEXT;
ALTER TABLE ath_hub_profiles ADD COLUMN IF NOT EXISTS canonical_url TEXT;
ALTER TABLE ath_hub_profiles ADD COLUMN IF NOT EXISTS publication_state TEXT NOT NULL DEFAULT 'public';
UPDATE ath_hub_profiles SET identifier_namespace='credential',entity_class='contractor',canonical_url='https://www.contractortrusthub.com/contractors/'||native_slug WHERE hub_id='contractor' AND identifier_namespace IS NULL;
ALTER TABLE ath_hub_profiles DROP CONSTRAINT IF EXISTS ath_hub_profiles_identifier_namespace_check;
ALTER TABLE ath_hub_profiles DROP CONSTRAINT IF EXISTS ath_hub_profiles_entity_class_check;
ALTER TABLE ath_hub_profiles ADD CONSTRAINT ath_hub_profiles_identifier_namespace_check CHECK (identifier_namespace IS NULL OR identifier_namespace IN ('credential','USDOT','NMLS'));
ALTER TABLE ath_hub_profiles ADD CONSTRAINT ath_hub_profiles_entity_class_check CHECK (entity_class IS NULL OR entity_class IN ('contractor','mover','institution'));

-- Reassert the existing server-only RLS boundary after the alteration.
ALTER TABLE ath_hub_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ath_hub_profiles FORCE ROW LEVEL SECURITY;

COMMENT ON TABLE ath_hub_profiles IS 'Exact pointer to an already-public specialist profile. Identity is hub_id plus native_profile_id and names never merge profiles.';
