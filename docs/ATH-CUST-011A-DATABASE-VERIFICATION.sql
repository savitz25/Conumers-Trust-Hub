SELECT conname,pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='ath_hub_profiles'::regclass ORDER BY conname;
SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname LIKE 'ath_%' ORDER BY relname;
SELECT hub_id,count(*) FROM ath_hub_profiles GROUP BY hub_id ORDER BY hub_id;
SELECT count(*) AS grants FROM ath_management_grants;
SELECT count(*) AS claims FROM ath_claims;
SELECT hub_id,native_profile_id,count(*) FROM ath_hub_profiles GROUP BY hub_id,native_profile_id HAVING count(*)>1;
