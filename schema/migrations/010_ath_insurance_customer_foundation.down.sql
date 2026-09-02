-- Roll back only the ATH-CUST-014A capability expansion.
-- Run only after proving there are no Insurance customer-plane rows.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM ath_hub_profiles WHERE hub_id = 'insurance') THEN
    RAISE EXCEPTION 'Cannot roll back migration 010 while Insurance profiles exist';
  END IF;
END $$;
ALTER TABLE ath_hub_profiles DROP CONSTRAINT IF EXISTS ath_hub_profiles_hub_id_check;
ALTER TABLE ath_hub_profiles DROP CONSTRAINT IF EXISTS ath_hub_profiles_identifier_namespace_check;
ALTER TABLE ath_hub_profiles DROP CONSTRAINT IF EXISTS ath_hub_profiles_entity_class_check;
ALTER TABLE ath_hub_profiles ADD CONSTRAINT ath_hub_profiles_hub_id_check CHECK (hub_id IN ('contractor','move','lender','senior','investor'));
ALTER TABLE ath_hub_profiles ADD CONSTRAINT ath_hub_profiles_identifier_namespace_check CHECK (identifier_namespace IS NULL OR identifier_namespace IN ('credential','USDOT','NMLS','CMS_CCN','CRD'));
ALTER TABLE ath_hub_profiles ADD CONSTRAINT ath_hub_profiles_entity_class_check CHECK (entity_class IS NULL OR entity_class IN ('contractor','mover','institution','nursing_home','home_health','hospice','firm'));
ALTER TABLE ath_hub_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ath_hub_profiles FORCE ROW LEVEL SECURITY;
