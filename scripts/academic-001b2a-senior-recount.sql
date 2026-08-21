-- Academic 001B.2A — SELECT-only Senior warehouse recount
-- Must be run inside: BEGIN; SET TRANSACTION READ ONLY;
-- Do not INSERT/UPDATE/DELETE/ALTER.

SELECT current_setting('transaction_read_only') AS transaction_read_only;

-- A. Canonical identity
SELECT
  (SELECT COUNT(*) FROM provider) AS provider_rows,
  (SELECT COUNT(*) FROM provider WHERE provider_type = 'nursing_home') AS nursing_home_provider_rows,
  (SELECT COUNT(*) FROM provider_identifier WHERE issuer = 'CMS' AND identifier_type = 'CCN') AS cms_ccn_identifier_rows,
  (SELECT COUNT(DISTINCT identifier_value) FROM provider_identifier WHERE issuer = 'CMS' AND identifier_type = 'CCN') AS distinct_cms_ccns_all,
  (SELECT COUNT(*) FROM facility_snapshot) AS facility_snapshot_rows;

WITH current_ingest AS (
  SELECT ir.id AS ingest_run_id, sr.id AS source_release_id, sr.release_key,
         sr.source_modified_at, sr.source_release_date, sr.retrieved_at, ir.completed_at,
         ir.transformation_version
  FROM source_dataset sd
  JOIN source_release sr ON sr.source_dataset_id = sd.id
  JOIN ingest_run ir ON ir.source_release_id = sr.id AND ir.status = 'succeeded'
  WHERE sd.dataset_key = 'nursing-home-provider-information'
  ORDER BY sr.source_modified_at DESC NULLS LAST,
           sr.source_release_date DESC NULLS LAST, sr.release_key DESC,
           ir.completed_at DESC, ir.transformation_version DESC, ir.id DESC
  LIMIT 1
),
current_snapshots AS (
  SELECT fs.*, pi.identifier_value AS ccn
  FROM current_ingest ci
  JOIN facility_snapshot fs
    ON fs.source_release_id = ci.source_release_id AND fs.ingest_run_id = ci.ingest_run_id
  JOIN provider_identifier pi
    ON pi.provider_id = fs.provider_id
   AND pi.issuer = 'CMS' AND pi.identifier_type = 'CCN' AND pi.valid_from IS NULL
)
SELECT
  (SELECT COUNT(*) FROM current_ingest) AS current_release_rows,
  (SELECT release_key FROM current_ingest) AS current_release_key,
  (SELECT source_modified_at FROM current_ingest) AS current_source_modified_at,
  (SELECT retrieved_at FROM current_ingest) AS current_retrieved_at,
  (SELECT COUNT(*) FROM current_snapshots) AS current_snapshot_rows,
  (SELECT COUNT(DISTINCT ccn) FROM current_snapshots) AS distinct_current_ccns,
  (SELECT COUNT(*) FROM (
     SELECT ccn FROM current_snapshots GROUP BY ccn HAVING COUNT(*) > 1
   ) d) AS duplicate_current_ccn_groups;

-- B. Ratings on current snapshots
WITH current_ingest AS (
  SELECT ir.id AS ingest_run_id, sr.id AS source_release_id
  FROM source_dataset sd
  JOIN source_release sr ON sr.source_dataset_id = sd.id
  JOIN ingest_run ir ON ir.source_release_id = sr.id AND ir.status = 'succeeded'
  WHERE sd.dataset_key = 'nursing-home-provider-information'
  ORDER BY sr.source_modified_at DESC NULLS LAST,
           sr.source_release_date DESC NULLS LAST, sr.release_key DESC,
           ir.completed_at DESC, ir.transformation_version DESC, ir.id DESC
  LIMIT 1
),
cs AS (
  SELECT fs.*
  FROM current_ingest ci
  JOIN facility_snapshot fs
    ON fs.source_release_id = ci.source_release_id AND fs.ingest_run_id = ci.ingest_run_id
)
SELECT
  COUNT(*) FILTER (WHERE overall_rating IS NOT NULL) AS overall_present,
  COUNT(*) FILTER (WHERE overall_rating IS NULL) AS overall_null,
  COUNT(*) FILTER (WHERE health_inspection_rating IS NOT NULL) AS health_present,
  COUNT(*) FILTER (WHERE health_inspection_rating IS NULL) AS health_null,
  COUNT(*) FILTER (WHERE staffing_rating IS NOT NULL) AS staffing_present,
  COUNT(*) FILTER (WHERE staffing_rating IS NULL) AS staffing_null,
  COUNT(*) FILTER (WHERE quality_measure_rating IS NOT NULL) AS qm_present,
  COUNT(*) FILTER (WHERE quality_measure_rating IS NULL) AS qm_null
FROM cs;

-- C. Inspections
SELECT COUNT(*) AS inspection_event_rows,
       COUNT(DISTINCT provider_id) AS inspection_distinct_providers,
       MIN(survey_date) AS inspection_min_survey_date,
       MAX(survey_date) AS inspection_max_survey_date
FROM inspection_event;

-- D. Deficiencies
SELECT COUNT(*) AS deficiency_rows,
       COUNT(DISTINCT provider_id) AS deficiency_distinct_providers,
       COUNT(*) FILTER (WHERE inspection_event_id IS NOT NULL) AS deficiency_linked_inspection,
       COUNT(*) FILTER (WHERE inspection_event_id IS NULL) AS deficiency_unlinked_inspection,
       MIN(survey_date) AS deficiency_min_survey_date,
       MAX(survey_date) AS deficiency_max_survey_date
FROM deficiency_finding;

-- E. Enforcement
SELECT COUNT(*) AS penalty_rows,
       COUNT(*) FILTER (WHERE penalty_type = 'Fine') AS penalty_fine_rows,
       COUNT(*) FILTER (WHERE penalty_type = 'Payment Denial') AS penalty_payment_denial_rows,
       COUNT(DISTINCT provider_id) AS penalty_distinct_providers,
       SUM(fine_amount) FILTER (WHERE penalty_type = 'Fine') AS sum_fine_amount,
       MIN(penalty_date) AS penalty_min_date,
       MAX(penalty_date) AS penalty_max_date
FROM penalty_enforcement;

-- F. Staffing quarters (not daily)
SELECT COUNT(*) AS pbj_quarter_rows,
       COUNT(DISTINCT ccn) AS pbj_distinct_ccns,
       COUNT(DISTINCT source_quarter) AS pbj_distinct_quarters,
       MIN(source_quarter) AS pbj_earliest_quarter,
       MAX(source_quarter) AS pbj_latest_quarter
FROM pbj_staffing_quarter_summary;

SELECT COUNT(*) AS pbj_daily_rows_audit_only FROM pbj_staffing_day;

-- G. Ownership
SELECT COUNT(*) AS ownership_relationship_rows,
       COUNT(*) FILTER (WHERE op.party_kind = 'organization') AS ownership_org_party_rows,
       COUNT(*) FILTER (WHERE op.party_kind = 'individual') AS ownership_individual_party_rows,
       COUNT(DISTINCT por.provider_id) AS ownership_distinct_providers,
       COUNT(DISTINCT por.ownership_party_id) FILTER (WHERE op.party_kind = 'organization') AS distinct_org_parties_used,
       COUNT(DISTINCT por.ownership_party_id) FILTER (WHERE op.party_kind = 'individual') AS distinct_individual_parties_used
FROM provider_ownership_relationship por
LEFT JOIN ownership_party op ON op.id = por.ownership_party_id;

SELECT COUNT(*) AS organization_relationship_rows FROM organization_relationship;
SELECT COUNT(*) AS ownership_party_org FROM ownership_party WHERE party_kind = 'organization';
SELECT COUNT(*) AS ownership_party_individual FROM ownership_party WHERE party_kind = 'individual';
SELECT COUNT(*) AS ownership_change_event_rows,
       MIN(effective_date) AS chow_min_effective,
       MAX(effective_date) AS chow_max_effective
FROM ownership_change_event;

-- H. Chains
SELECT COUNT(*) AS cms_chain_rows FROM cms_chain;
SELECT COUNT(*) AS cms_chain_provider_rows,
       COUNT(DISTINCT provider_id) FILTER (WHERE provider_id IS NOT NULL) AS chain_distinct_providers,
       COUNT(DISTINCT chain_id) AS chain_distinct_ids
FROM cms_chain_provider;

-- I. Provenance
SELECT sd.dataset_key, COUNT(sr.*) AS source_release_rows,
       COUNT(ir.*) FILTER (WHERE ir.status = 'succeeded') AS succeeded_ingest_runs
FROM source_dataset sd
LEFT JOIN source_release sr ON sr.source_dataset_id = sd.id
LEFT JOIN ingest_run ir ON ir.source_release_id = sr.id
GROUP BY sd.dataset_key
ORDER BY sd.dataset_key;

-- J. Derived / state audit only
SELECT COUNT(*) AS facility_history_event_rows,
       COUNT(DISTINCT provider_id) AS history_distinct_providers
FROM facility_history_event;

SELECT event_family, COUNT(*) AS n
FROM facility_history_event
GROUP BY event_family
ORDER BY event_family;

-- CA/NY/TX published state claims if view exists
SELECT COUNT(*) AS published_state_claim_rows FROM published_state_claim;

SELECT
  CASE
    WHEN resolver_reference LIKE '%:ca-%' THEN 'CA'
    WHEN resolver_reference LIKE '%:ny-%' THEN 'NY'
    WHEN resolver_reference LIKE '%:tx-%' THEN 'TX'
    ELSE 'OTHER'
  END AS state_code,
  COUNT(*) AS claim_rows,
  COUNT(DISTINCT provider_id) AS facilities
FROM published_state_claim
GROUP BY 1
ORDER BY 1;

SELECT
  CASE
    WHEN resolver_reference LIKE '%:ca-%' THEN 'CA'
    WHEN resolver_reference LIKE '%:ny-%' THEN 'NY'
    WHEN resolver_reference LIKE '%:tx-%' THEN 'TX'
    ELSE 'OTHER'
  END AS state_code,
  COUNT(*) AS claim_rows,
  COUNT(DISTINCT provider_id) AS facilities
FROM published_state_claim
WHERE claim_type = 'STATE_LICENSE_ID'
GROUP BY 1
ORDER BY 1;
