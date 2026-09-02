-- ATH-CUST-014A: admit exact, public-current Insurance legal-insurer profile pointers.
-- Ask customer database only; this migration never touches Insurance evidence.
ALTER TABLE ath_hub_profiles DROP CONSTRAINT IF EXISTS ath_hub_profiles_hub_id_check;
ALTER TABLE ath_hub_profiles DROP CONSTRAINT IF EXISTS ath_hub_profiles_identifier_namespace_check;
ALTER TABLE ath_hub_profiles DROP CONSTRAINT IF EXISTS ath_hub_profiles_entity_class_check;
ALTER TABLE ath_hub_profiles ADD CONSTRAINT ath_hub_profiles_hub_id_check CHECK (hub_id IN ('contractor','move','lender','senior','investor','insurance'));
ALTER TABLE ath_hub_profiles ADD CONSTRAINT ath_hub_profiles_identifier_namespace_check CHECK (identifier_namespace IS NULL OR identifier_namespace IN ('credential','USDOT','NMLS','CMS_CCN','CRD','NAIC'));
ALTER TABLE ath_hub_profiles ADD CONSTRAINT ath_hub_profiles_entity_class_check CHECK (entity_class IS NULL OR entity_class IN ('contractor','mover','institution','nursing_home','home_health','hospice','firm','legal_insurer'));
ALTER TABLE ath_hub_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ath_hub_profiles FORCE ROW LEVEL SECURITY;
