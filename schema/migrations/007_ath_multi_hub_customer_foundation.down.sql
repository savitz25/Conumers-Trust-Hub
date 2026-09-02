-- Rollback is safe only after removing all move/lender customer rows.
-- Refuse destructive implicit remapping.
DO $$ BEGIN IF EXISTS(SELECT 1 FROM ath_hub_profiles WHERE hub_id<>'contractor') THEN RAISE EXCEPTION 'Remove or archive non-contractor customer-plane rows before rollback'; END IF; END $$;
ALTER TABLE ath_hub_profiles DROP CONSTRAINT IF EXISTS ath_hub_profiles_hub_id_check;
ALTER TABLE ath_hub_profiles DROP CONSTRAINT IF EXISTS ath_hub_profiles_identifier_namespace_check;
ALTER TABLE ath_hub_profiles DROP CONSTRAINT IF EXISTS ath_hub_profiles_entity_class_check;
ALTER TABLE ath_hub_profiles ADD CONSTRAINT ath_hub_profiles_hub_id_check CHECK (hub_id='contractor');
ALTER TABLE ath_hub_profiles ADD CONSTRAINT ath_hub_profiles_native_source_system_check CHECK (native_source_system='fl_dbpr');
ALTER TABLE ath_hub_profiles ADD CONSTRAINT ath_hub_profiles_home_state_check CHECK (home_state='FL');
ALTER TABLE ath_hub_profiles DROP COLUMN IF EXISTS publication_state;
ALTER TABLE ath_hub_profiles DROP COLUMN IF EXISTS canonical_url;
ALTER TABLE ath_hub_profiles DROP COLUMN IF EXISTS entity_class;
ALTER TABLE ath_hub_profiles DROP COLUMN IF EXISTS identifier_namespace;
