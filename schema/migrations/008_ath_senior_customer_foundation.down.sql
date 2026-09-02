-- Refuse rollback while Senior customer pointers exist; never remap identities.
DO $$ BEGIN IF EXISTS(SELECT 1 FROM ath_hub_profiles WHERE hub_id='senior') THEN RAISE EXCEPTION 'Remove or archive Senior customer-plane rows before rollback'; END IF; END $$;
ALTER TABLE ath_hub_profiles DROP CONSTRAINT IF EXISTS ath_hub_profiles_hub_id_check;
ALTER TABLE ath_hub_profiles DROP CONSTRAINT IF EXISTS ath_hub_profiles_identifier_namespace_check;
ALTER TABLE ath_hub_profiles DROP CONSTRAINT IF EXISTS ath_hub_profiles_entity_class_check;
ALTER TABLE ath_hub_profiles ADD CONSTRAINT ath_hub_profiles_hub_id_check CHECK (hub_id IN ('contractor','move','lender'));
ALTER TABLE ath_hub_profiles ADD CONSTRAINT ath_hub_profiles_identifier_namespace_check CHECK (identifier_namespace IS NULL OR identifier_namespace IN ('credential','USDOT','NMLS'));
ALTER TABLE ath_hub_profiles ADD CONSTRAINT ath_hub_profiles_entity_class_check CHECK (entity_class IS NULL OR entity_class IN ('contractor','mover','institution'));
