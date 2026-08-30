-- Reversal for ATH-CUST-002. Drops customer-plane tables only.
-- Never run against ContractorTrustHub evidence databases.

DROP TABLE IF EXISTS ath_rate_events;
DROP TABLE IF EXISTS ath_claim_intents;
DROP TABLE IF EXISTS ath_notifications;
DROP TABLE IF EXISTS ath_notification_preferences;
DROP TABLE IF EXISTS ath_entitlements;
DROP TABLE IF EXISTS ath_audit_events;
DROP TABLE IF EXISTS ath_review_queue;
DROP TABLE IF EXISTS ath_management_grants;
DROP TABLE IF EXISTS ath_claims;
DROP TABLE IF EXISTS ath_hub_profiles;
DROP TABLE IF EXISTS ath_memberships;
DROP TABLE IF EXISTS ath_organizations;
DROP TABLE IF EXISTS ath_sessions;
DROP TABLE IF EXISTS ath_auth_challenges;
DROP TABLE IF EXISTS ath_users;

DROP FUNCTION IF EXISTS ath_is_server();
DROP FUNCTION IF EXISTS ath_forbid_mutation();
DROP FUNCTION IF EXISTS ath_set_updated_at();
