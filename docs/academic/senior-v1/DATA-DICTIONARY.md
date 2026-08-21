# Senior Academic V1 — data dictionary (draft)

**Dataset:** TrustHub Senior Regulatory Research Dataset  
**Package (proposed):** `trusthub-senior-regulatory-v2026.07.29`  
**Status:** Draft for a future extract. No files published.  
**Normative column list:** `FIELD-FREEZE.md` (every public/hold/exclude column). This dictionary is the researcher-facing explanation.

Official CMS nursing-home data dictionary (do not reinterpret beyond CMS and existing SeniorTrustHub docs):  
https://data.cms.gov/provider-data/sites/default/files/data_dictionaries/nursing_home/NH_Data_Dictionary.pdf

Inspection join and A–L wording follow Care `docs/INSPECTION_INTELLIGENCE.md`.

---

## 1. Dataset overview

An organized freeze of CMS nursing-facility **identity**, **CMS Five-Star ratings**, **inspection events**, **health deficiencies**, **penalties**, **chain membership**, and **source provenance**.

Canonical identity: **CMS CCN** (exactly six alphanumeric characters). Internal warehouse UUIDs are not public identifiers.

Live warehouse recount (SELECT-only, 2026-08-21): 14,693 current CCNs in Provider Information release `2026-07-29` (retrieved 2026-08-14). Duplicate current CCN groups: **0**.

---

## 2. File list and grain

| File | Grain | PK | Live rows | Source |
|------|-------|----|----------:|--------|
| facilities.csv | one current CMS-active home | `ccn` | 14,693 | `4pq5-n9py` |
| facility_ratings.csv | one CCN × snapshot | `ccn` + `source_release_key` | 14,693 | `4pq5-n9py` |
| facility_inspections.csv | one survey event | `academic_inspection_id` | 149,705 | `svdt-c123` |
| facility_deficiencies.csv | one citation | `academic_deficiency_id` | 418,344 | `r5ix-sfxw` |
| facility_enforcement.csv | one penalty | `academic_enforcement_id` | 16,166 | `g6vv-u9sr` |
| facility_chains.csv | one membership | `chain_id` + `ccn` + `source_release_key` | 10,231 | enrollments |
| sources.csv | one ingest vintage | `source_dataset_key` + `source_release_key` + `transformation_version` | small | warehouse register |

---

## 3. Keys and joins

```
facilities.ccn
  ← facility_ratings.ccn
  ← facility_inspections.ccn
  ← facility_deficiencies.ccn
  ← facility_enforcement.ccn
  ← facility_chains.ccn

facility_inspections.academic_inspection_id
  ← facility_deficiencies.academic_inspection_id   -- nullable
```

`academic_*_id` values **alias existing warehouse keys** (`event_key`, `finding_key`, `penalty_key`). They are SHA-256 hex strings already stored; 001B.2A does not generate new hashes. Uniqueness is per `source_release` (Open V1 ships one vintage per CMS product).

`chain_id` is CMS Chain ID text (`cms_chain.cms_chain_id`), not a UUID.

---

## 4. Null semantics

| Situation | Meaning |
|-----------|---------|
| Null CMS star | CMS did not publish a 1–5 star on that snapshot |
| Null deficiency inspection id | Join did not uniquely match; citation is still a real CMS row |
| Null fine_amount on Payment Denial | Denials are not dollar fines in this model |
| Null lat/long | CMS did not publish a coordinate pair |
| CCN absent from deficiencies or penalties | Not in that CMS file window; **not** a clean record |
| Empty boolean | Unknown, not false |

Never recode null to 0.

---

## 5. Time semantics

**Event history:** `survey_date`, `penalty_date`, `correction_date`, `payment_denial_start_date`.  
**Snapshot / retrieval:** `source_modified_at`, `retrieved_at`, `ingest_completed_at`, `source_release_key`.

One Provider Information snapshot ≠ a ratings panel. See README.

| Table | Event-date min | Event-date max |
|-------|----------------|----------------|
| inspections | 2016-07-28 | 2026-06-26 |
| deficiencies | 2017-03-23 | 2026-06-22 |
| enforcement | 2023-07-17 | 2026-06-11 |

---

## 6. Provenance

Every fact row carries: `source_dataset_key`, `source_release_key`, `source_modified_at`, `retrieved_at`, `ingest_completed_at`, `transformation_version`, `source_record_locator`.

`source_dataset_id` (UUID) is **not** public. See `FIELD-FREEZE.md` provenance block and `SOURCES.md`.

---

## 7. Fields by table

Full public/hold/exclude matrix: `FIELD-FREEZE.md`. Researcher fields:

### facilities.csv

`ccn`, `provider_name`, `legal_business_name`, `address`, `city`, `state_code`, `zip_code`, `county_name`, `ownership_type` (CMS category, not the owner graph), `certified_beds`, `participation_type`, `participates_medicare`, `participates_medicaid`, `source_latitude`, `source_longitude`, plus provenance.  
`telephone`: hold. Ratings: not on this file.

### facility_ratings.csv

`ccn`, `source_release_key`, `overall_rating`, `health_inspection_rating`, `staffing_rating`, `quality_measure_rating`, plus provenance.

**CMS rating explanation (existing meaning):** integers 1–5 are CMS Five-Star ratings from Provider Information. TrustHub does not recompute them. Null is CMS missingness. Staffing stars are not PBJ HPRD.

Live missingness: overall 132; health inspection 132; staffing 202; quality measure 203 (of 14,693).

### facility_inspections.csv

`academic_inspection_id`, `ccn`, `survey_date`, `survey_type`, `survey_cycle`, `processing_date`, plus provenance.

**Inspection terminology (existing Care/CMS meaning):** CMS publishes dates and types of surveys (health, fire safety, complaint, infection-control, and other types as labeled in the file). Processing date is metadata, not identity. Presence of a survey is not a TrustHub finding that the facility “failed.”

### facility_deficiencies.csv

`academic_deficiency_id`, `ccn`, `academic_inspection_id` (nullable), `survey_date`, `survey_type`, `inspection_cycle`, `deficiency_prefix`, `deficiency_tag`, `deficiency_category`, `official_description`, `scope_severity_code`, `deficiency_corrected`, `correction_date`, `standard_deficiency`, `complaint_deficiency`, `infection_control_deficiency`, `citation_under_idr`, `citation_under_iidr`, `processing_date`, plus provenance.

**Scope/severity (official CMS A–L matrix, already documented in Care `INSPECTION_INTELLIGENCE.md`):**

- A–C: no actual harm with potential for minimal harm; isolated, pattern, widespread
- D–F: no actual harm with potential for more than minimal harm that is not immediate jeopardy; isolated, pattern, widespread
- G–I: actual harm that is not immediate jeopardy; isolated, pattern, widespread
- J–L: immediate jeopardy to resident health or safety; isolated, pattern, widespread

Open V1 ships the **letter code only**. Do not add proprietary low/medium/high labels. Harm **codes** are not resident identifiers.

### facility_enforcement.csv

`academic_enforcement_id`, `ccn`, `penalty_date`, `penalty_type` (`Fine` or `Payment Denial`), `fine_id`, `fine_amount`, `payment_denial_start_date`, `payment_denial_days`, `processing_date`, plus provenance.

**Enforcement terminology:** CMS Penalties file rows are either a Fine (dollar amount required) or a Payment Denial (start date / days). Live Fine sum **$464,165,281.00** is the sum of published Fine amounts in this vintage, not an all-time national total and not a TrustHub estimate of “true” penalties. 13,687 fines; 2,479 payment denials; 6,844 facilities.

### facility_chains.csv

`chain_id` (CMS Chain ID), `ccn`, `source_release_key`, `chain_name`, `enrollment_id`, plus provenance. CMS grouping, not a TrustHub score.

### sources.csv

Dataset key, CMS identifier, official name/URL, release key, dates, `content_sha256` of **CMS source bytes**, transformation version, ingest counts, ingest completed_at.

---

## 8. Source authorities

See `SOURCES.md`. Underlying records: CMS. Organization/schema: TrustHub.

---

## 9. Known limitations (summary)

Missing evidence ≠ clean record. Snapshot vs event clocks differ. 30,374 deficiencies unlinked. Ownership and state overlays out. Assisted living out. Google out. No consumer PII. Full text: `LIMITATIONS.md`.
