DROP TABLE IF EXISTS ath_business_reply_events;
ALTER TABLE ath_business_replies DROP CONSTRAINT IF EXISTS ath_business_replies_active_revision_fk;
ALTER TABLE ath_business_replies DROP CONSTRAINT IF EXISTS ath_business_replies_published_revision_fk;
DROP TABLE IF EXISTS ath_business_reply_revisions;
DROP TABLE IF EXISTS ath_business_replies;
ALTER TABLE ath_review_queue DROP CONSTRAINT IF EXISTS ath_review_queue_work_type_check;
ALTER TABLE ath_review_queue ADD CONSTRAINT ath_review_queue_work_type_check CHECK (work_type IN ('claim_review','competing_claim','record_issue'));
