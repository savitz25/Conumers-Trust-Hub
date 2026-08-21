# Academic 001B.2A — Data dictionary draft

**Dataset (proposed):** TrustHub Senior Regulatory Research Dataset  
**Package id (proposed):** `trusthub-senior-regulatory-v2026.07.29`  
**Status:** Draft dictionary for a **future** extract. No files are published.  
**Canonical entity:** CMS-certified nursing facility  
**Canonical identifier:** CMS CCN (exactly six alphanumeric characters)  
**Live warehouse vintage:** recounted 2026-08-21 from SeniorTrustHub (SELECT-only)

Cite CMS as the source of the underlying records. Cite TrustHub only for organization, schema, and this documentation.

Official CMS nursing-home data dictionary (Provider Data Catalog):  
https://data.cms.gov/provider-data/sites/default/files/data_dictionaries/nursing_home/NH_Data_Dictionary.pdf

This draft maps **warehouse columns we would freeze**, not every CMS source column.

---

## Conventions

| Convention | Rule |
|------------|------|
| Null | CMS or join missingness. Never recode to 0, “N/A”, or a TrustHub score. |
| Boolean | `true` / `false` / empty. Empty means unknown, not false. |
| Dates | ISO `YYYY-MM-DD`. Timestamps ISO-8601 UTC. |
| Money | USD numeric with two decimals (`fine_amount`). |
| Ratings | Integer 1–5 or empty. CMS Five-Star, not TrustHub. |
| Scope/severity | Single letter `A`–`L` as CMS publishes. |
| Public keys | `ccn` plus source `*_key` strings. No database UUIDs. |
| Provenance | Repeated on every table (see §0). |
| Transformations | Named `transformation_version` strings. HPRD uses `pbj-quarter-ratio-of-sums-v1`. |

---

## 0. Provenance columns (every table)

| Field | Type | Meaning |
|-------|------|---------|
| `source_dataset_key` | text | TrustHub registry key (e.g. `nursing-home-provider-information`) |
| `cms_dataset_identifier` | text | CMS catalog id (e.g. `4pq5-n9py`) |
| `source_release_key` | text | Immutable vintage key stored on `source_release` |
| `source_modified_at` | timestamptz | CMS source-modified timestamp when known |
| `retrieved_at` | timestamptz | When TrustHub retrieved the file |
| `ingest_completed_at` | timestamptz | When the succeeded `ingest_run` finished |
| `transformation_version` | text | Loader contract version |
| `source_record_locator` | text | Row locator back to the source file |

Researchers should be able to re-fetch the same CMS product (not necessarily the identical bytes after CMS overwrites the “current” distribution).

---

## 1. `facilities.csv`

**Grain:** one currently active CMS-certified nursing home in Provider Information release `2026-07-29`.  
**Live rows:** 14,693. **PK:** `ccn`.  
**Source:** CMS Provider Information `4pq5-n9py`.  
**Warehouse:** current `facility_snapshot` joined to current CMS CCN.

This table is a **cross-section**. A later monthly CMS file would replace public “current” values; this freeze would not.

| Field | Type | Nullable | Definition |
|-------|------|----------|------------|
| `ccn` | char(6) | no | CMS Certification Number. Canonical research identity. |
| `provider_name` | text | no | CMS-published facility name. |
| `legal_business_name` | text | yes | Legal business name when CMS supplies it. |
| `address` | text | yes | Street address from CMS. |
| `city` | text | yes | City from CMS. |
| `state_code` | char(2) | no | USPS state code. |
| `zip_code` | text | yes | ZIP as published. |
| `county_name` | text | yes | County name as published. |
| `telephone` | text | yes | CMS-published facility phone. Counsel may require dropping this column. |
| `ownership_type` | text | yes | CMS ownership-type category (not the ownership graph). |
| `certified_beds` | integer | yes | Certified bed count. |
| `participates_medicare` | boolean | yes | Medicare participation flag. |
| `participates_medicaid` | boolean | yes | Medicaid participation flag. |
| `participation_type` | text | yes | CMS participation type text. |
| `source_latitude` | float | yes | CMS-published latitude. Not Google geocode. |
| `source_longitude` | float | yes | CMS-published longitude. Not Google geocode. |
| `overall_rating` | smallint 1–5 | yes | CMS overall Five-Star. Live: 14,561 present / 132 null. |
| `health_inspection_rating` | smallint 1–5 | yes | CMS health-inspection star. Live: 14,561 / 132. |
| `staffing_rating` | smallint 1–5 | yes | CMS staffing star. Live: 14,491 / 202. |
| `quality_measure_rating` | smallint 1–5 | yes | CMS quality-measure star. Live: 14,490 / 203. |

**Limitations:** active homes only; closed facilities drop out of later current files; stars are CMS methodology; null ≠ “no problems.”

---

## 2. `facility_inspections.csv`

**Grain:** one CMS inspection/survey event.  
**Live rows:** 149,705 covering all 14,693 CCNs. **PK:** `inspection_event_key`.  
**Source:** CMS Inspection Dates `svdt-c123`.  
**Date range in this vintage:** 2016-07-28 through 2026-06-26.

| Field | Type | Nullable | Definition |
|-------|------|----------|------------|
| `inspection_event_key` | text | no | Deterministic TrustHub event key for this source release (`inspection_event.event_key`). |
| `ccn` | char(6) | no | Facility CCN. FK to `facilities.ccn`. |
| `survey_date` | date | no | CMS survey date. Event time, not retrieval time. |
| `survey_type` | text | no | CMS survey type (health, fire safety, complaint, infection-control, etc., as published). |
| `survey_cycle` | integer | no | CMS inspection cycle number (≥ 0). |
| `processing_date` | date | yes | CMS processing date when present. |

**Limitations:** not a complete history of harm or of every survey ever conducted; window is whatever CMS published in this file.

---

## 3. `facility_deficiencies.csv`

**Grain:** one health-deficiency citation.  
**Live rows:** 418,344 on 14,629 facilities. **PK:** `deficiency_finding_key`.  
**Source:** CMS Health Deficiencies `r5ix-sfxw`.  
**Date range:** 2017-03-23 through 2026-06-22.

| Field | Type | Nullable | Definition |
|-------|------|----------|------------|
| `deficiency_finding_key` | text | no | Deterministic finding key (`finding_key`). |
| `ccn` | char(6) | no | Facility CCN. |
| `inspection_event_key` | text | **yes** | FK to inspections when join succeeded. Live: 387,970 linked; **30,374** unlinked. |
| `survey_date` | date | no | Citation survey date. |
| `survey_type` | text | yes | Survey type on the deficiency file. |
| `inspection_cycle` | integer | no | Cycle on the deficiency file. |
| `deficiency_prefix` | text | no | CMS prefix (e.g. F-tag family). |
| `deficiency_tag` | text | no | CMS tag code. |
| `deficiency_category` | text | yes | Category text when present. |
| `official_description` | text | yes | CMS official citation description. Not TrustHub narrative. |
| `scope_severity_code` | char(1) A–L | no | Official CMS scope/severity. Resident-harm **codes**, not resident PII. |
| `deficiency_corrected` | text | yes | Correction flag as published. |
| `correction_date` | date | yes | Correction date when present. |
| `standard_deficiency` | boolean | yes | CMS standard-deficiency flag. |
| `complaint_deficiency` | boolean | yes | CMS complaint-deficiency flag. |
| `infection_control_deficiency` | boolean | yes | Infection-control flag. |
| `citation_under_idr` | boolean | yes | Informal dispute resolution flag. |
| `citation_under_iidr` | boolean | yes | Independent IDR flag. |
| `processing_date` | date | yes | CMS processing date. |

**Limitations:** unlinked inspection keys are expected; 64 current CCNs have zero deficiency rows; do not treat absence as a clean bill of health.

---

## 4. `facility_enforcement.csv`

**Grain:** one CMS penalty row (fine **or** payment denial).  
**Live rows:** 16,166 (13,687 Fine + 2,479 Payment Denial) on 6,844 facilities. **PK:** `penalty_key`.  
**Source:** CMS Penalties `g6vv-u9sr`.  
**Date range in this vintage:** 2023-07-17 through 2026-06-11.

| Field | Type | Nullable | Definition |
|-------|------|----------|------------|
| `penalty_key` | text | no | Deterministic penalty key. |
| `ccn` | char(6) | no | Facility CCN. |
| `penalty_date` | date | no | CMS penalty date. |
| `penalty_type` | text | no | `Fine` or `Payment Denial` only. |
| `fine_id` | text | yes | CMS fine identifier when present. |
| `fine_amount` | numeric(14,2) | yes | Fine dollars. Required when type is Fine. Live Fine sum = **464,165,281.00**. |
| `payment_denial_start_date` | date | yes | Denial start when type is Payment Denial. |
| `payment_denial_days` | integer | yes | Denial length in days when published. |
| `processing_date` | date | yes | CMS processing date. |

**Limitations:** CMS publishes a rolling window, not all historical penalties. Do not annualize or inflate the Fine sum beyond this vintage. Payment denials have no dollar amount in this model.

---

## 5. `facility_chains.csv`

**Grain:** one CMS chain membership (enrollment) in the loaded enrollments vintage.  
**Live rows:** 10,231 memberships; 10,116 distinct facilities; 632 distinct chain ids on memberships; 671 `cms_chain` rows.  
**Sources:** SNF Enrollments `5f2c306f-3b1c-42cd-b037-187b2ce22126` (membership transform `cms-chain-membership-v1`) and chain performance `97ecfad1-d3f1-4d42-b774-d74661d830bc`.

| Field | Type | Nullable | Definition |
|-------|------|----------|------------|
| `cms_chain_id` | text | no | CMS Chain ID (`cms_chain.cms_chain_id`). |
| `chain_name` | text | no | CMS-published chain name on the membership row. |
| `ccn` | char(6) | no | Member facility CCN. |
| `enrollment_id` | text | no | CMS enrollment id (unique per source release). |

**Limitations:** CMS grouping, not a TrustHub-constructed “system score.” Facilities without a membership are not “independent” by proof; they are unmatched in this file. Chain performance JSON metrics are **not** in open V1.

---

## 6. `sources.csv`

**Grain:** one succeeded ingest of one CMS file vintage (and transformation version).

| Field | Type | Definition |
|-------|------|------------|
| `source_dataset_key` | text | Registry key |
| `cms_dataset_identifier` | text | CMS id |
| `official_name` | text | CMS product name |
| `official_landing_url` | text | CMS landing page |
| `source_release_key` | text | Vintage key |
| `source_release_date` | date | When stored |
| `source_modified_at` | timestamptz | CMS modified time |
| `retrieved_at` | timestamptz | TrustHub retrieval |
| `content_sha256` | char(64) | SHA-256 of retrieved source bytes |
| `transformation_version` | text | Loader version |
| `ingest_status` | text | Must be `succeeded` for academic freeze |
| `rows_read` | bigint | Loader count |
| `valid_rows` | bigint | Loader count |
| `rejected_rows` | bigint | Loader count |
| `ingest_completed_at` | timestamptz | Run end |

See the manifest spec for the live SHA-256 list from 2026-08-21.

---

## 7. `facility_ownership.csv` (org-only draft)

**Grain:** one CMS-disclosed owner/manager relationship.  
**Live total relationships:** 674,063 (220,673 organization / **453,390 individual**).  
**Open V1 proposal:** organization rows only.  
**Sources:** Ownership `y2hd-n93e`; All Owners `afe44b85-cc6d-40d7-b5df-00ae8910d1d2`.  
**Warehouse:** `provider_ownership_relationship` + `ownership_party`.

| Field | Type | Nullable | Definition |
|-------|------|----------|------------|
| `relationship_key` | text | no | Unique per source release. |
| `ccn` | char(6) | no | Facility CCN (`provider_identifier` / relationship CCN). |
| `party_kind` | text | no | Open V1: `organization` only. |
| `party_display_name` | text | no | CMS-published organization name. |
| `relationship_role_code` | text | yes | Role code when present. |
| `relationship_role_text` | text | no | Role text as published. |
| `association_date` | date | yes | Association date when present. |
| `ownership_percentage` | numeric(7,4) | yes | Percent 0–100 when published. |

**Limitations:** PECOS self-report / CMS disclosure, not independent ultimate-beneficial-owner verification. Disappearance in a later “current” file does not automatically end-date a prior relationship. 14,380 of 14,693 facilities have at least one ownership row. `organization_relationship` is empty (**0** rows) and is not a V1 table.

Individual `display_name` values (246,020 distinct parties) are **out of open V1** until counsel.

---

## 8. `facility_ownership_changes.csv`

**Grain:** one CMS change-of-ownership / acquisition / consolidation event.  
**Live rows:** 5,227. **Date range:** 2016-01-01 through 2026-02-01.  
**Source:** SNF CHOW `f557a6ed-95b3-4a22-8433-4175db2dec1c`.  
**Warehouse:** `ownership_change_event`.

| Field | Type | Nullable | Definition |
|-------|------|----------|------------|
| `event_key` | text | no | Unique per source release. |
| `ccn` | char(6) | no | Facility CCN. |
| `change_type_code` | text | no | CMS change type code. |
| `change_type_text` | text | no | CMS change type text. |
| `effective_date` | date | no | CMS effective date (on/after 2016-01-01 per CMS CHOW guidance). |

Buyer/seller organization names: **REVIEW_REQUIRED**. Do not describe a CHOW as proof of misconduct.

Owner-information file `a4358712-e910-4eaf-8f24-5e90ba3cf8d0` (119,419 source rows ingested) is not a separate open V1 table; it feeds party graph construction.

---

## 9. `facility_staffing_quarters.csv` (optional V1 / V1.1)

**Grain:** one CCN × CMS PBJ quarter summary.  
**Live rows:** 57,873; 14,665 CCNs; quarters **2025Q2–2026Q1** only.  
**Source:** PBJ Daily Nurse Staffing `7e0d53ba-8f02-4c66-98a5-14a1c997c50d`.  
**Warehouse:** `pbj_staffing_quarter_summary`.  
**Formula:** `pbj-quarter-ratio-of-sums-v1` = sum(included hours) / sum(positive MDS daily census). Days with missing or zero census stay in coverage counts but are excluded from HPRD numerator and denominator. This is **not** a CMS star and **not** daily microdata.

| Field | Type | Definition |
|-------|------|------------|
| `ccn` | char(6) | Facility CCN. |
| `source_quarter` | text `YYYYQN` | CMS quarter vintage. |
| `coverage_start` / `coverage_end` | date | Observed date span. |
| `days_represented` | int | Days in the summary. |
| `positive_census_days` / `zero_census_days` / `missing_census_days` | int | Partition of represented days. |
| `census_sum` | bigint | Sum of positive census used in HPRD. |
| `total_nurse_hours`, `rn_hours`, `lpn_hours`, `cna_hours` | numeric | Hour sums (see Care `STAFFING_INTELLIGENCE.md` for included roles). |
| `employee_nurse_hours`, `contract_nurse_hours` | numeric | Employee vs contract hour sums. |
| `total_nurse_hprd`, `rn_hprd`, `lpn_hprd`, `cna_hprd` | numeric | Ratio-of-sums HPRD. |
| `weekday_*` / `weekend_*` HPRD | numeric | Same formula restricted by weekday. |
| `contract_nurse_share` | numeric 0–1 | Contract / (employee+contract) across eight categories. |
| `zero_reported_rn_days` | int | Positive-census days with zero RN-family hours. |
| `formula_version` | text | `pbj-quarter-ratio-of-sums-v1` |

CNA HPRD **excludes** nurse aides in training and medication aides (documented Care rule). Daily table `pbj_staffing_day` (**5,280,805** live rows) is **not** in this dictionary’s open package.

---

## 10. Controlled / audit-only (dictionary stubs, not open V1)

### `facility_history_derived.csv`

Derived `facility_history_event`, version `facility-history-v1`. Live **156,797** rows. Families: inspection, enforcement, ownership, staffing, state; **zero** rating-change events (single snapshot). Date basis is `occurred` or `reported_in_release`. Not CMS-native.

### `facility_state_claims.csv`

View `published_state_claim`: VERIFIED CA/NY/TX license-style claims only. Live **13,633** rows. License-ID facilities: CA 1,158, NY 515, TX 1,134. `STATE_ADMINISTRATOR` (1,144) is a named-person field. State terms and uneven coverage apply.

---

## 11. Values researchers must not invent

- TrustHub scores, grades, or “risk indices”
- Filled-in stars or HPRD where source is null
- Google websites or geocodes
- MATCH/NON_MATCH identity labels from this warehouse
- Causal claims from a single cross-section plus event files
