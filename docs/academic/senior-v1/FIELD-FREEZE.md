# Senior Academic V1 — field-level freeze

**Normative column list for a future Open V1 extract.** No CSV is generated in this task.  
**Package (proposed):** `trusthub-senior-regulatory-v2026.07.29`  
**Grain reminder:** one CMS-active nursing home per CCN in Provider Information release `2026-07-29`.

Disposition values: **public** (Open V1) · **hold** (exists; counsel or later version) · **exclude** (must not ship).

Transformation values: `copy` (CMS value as stored) · `join` (lookup only) · `key_alias` (existing deterministic warehouse key, renamed for the academic file; no new hash in 001B.2A) · `none`.

Do not use `SELECT *`. Do not publish `provider.id` or other database UUIDs.

---

## Provenance block (repeat on every Open V1 fact table)

These columns exist in the warehouse via `source_dataset` → `source_release` → `ingest_run` plus the fact row. `source_dataset.id` is an internal UUID: **exclude** from public files; use `source_dataset_key` instead.

| public_field_name | source_table | source_column/expression | data_type | nullable | description | grain | source authority | transformation | public/hold/exclude | reason |
|-------------------|--------------|--------------------------|-----------|----------|-------------|-------|------------------|----------------|---------------------|--------|
| source_dataset_key | source_dataset | dataset_key | text | no | TrustHub registry key for the CMS product | row | TrustHub source registry (CMS product) | join | public | Human-stable; UUID `source_dataset.id` is not |
| source_release_key | source_release | release_key | text | no | Immutable vintage key of the retrieved file | row | CMS file vintage as stored | join | public | Required for reproducibility |
| source_modified_at | source_release | source_modified_at | timestamptz | yes | CMS source-modified timestamp when stored | row | CMS | join | public | Exists; may be date-truncated |
| retrieved_at | source_release | retrieved_at | timestamptz | no | When TrustHub retrieved the source file | row | TrustHub retrieval | join | public | Distinct from event dates |
| ingest_completed_at | ingest_run | completed_at | timestamptz | yes | When the succeeded ingest finished | row | TrustHub ingest | join | public | Exists on succeeded runs |
| transformation_version | fact table | transformation_version | text | no | Loader contract version | row | TrustHub | copy | public | Required |
| source_record_locator | fact table | source_record_locator | text | no | Locator back to the source row | row | TrustHub | copy | public | Exists on all V1 fact tables |

`source_dataset_id` (uuid): **exclude** — internal.  
Row-level provenance is appropriate for all Open V1 fact tables. `sources.csv` *is* the provenance register.

---

## `facilities.csv`

**Grain:** one current CMS-active nursing home. **PK:** `ccn`. **Live rows:** 14,693.  
**Source authority:** CMS Provider Information `4pq5-n9py`.  
**Warehouse:** current `facility_snapshot` + current CMS CCN (`valid_from IS NULL`).

| public_field_name | source_table | source_column/expression | data_type | nullable | description | grain | source authority | transformation | public/hold/exclude | reason |
|-------------------|--------------|--------------------------|-----------|----------|-------------|-------|------------------|----------------|---------------------|--------|
| ccn | provider_identifier | identifier_value WHERE issuer='CMS' AND identifier_type='CCN' AND valid_from IS NULL | char(6) | no | CMS Certification Number; canonical identity | facility | CMS | join | public | Stable public ID |
| provider_name | facility_snapshot | provider_name | text | no | CMS-published facility name | facility | CMS `4pq5-n9py` | copy | public | Named-facility policy; counsel Q D |
| legal_business_name | facility_snapshot | legal_business_name | text | yes | Legal business name when CMS supplies it | facility | CMS | copy | public | CMS column |
| address | facility_snapshot | address | text | yes | Street address | facility | CMS | copy | public | CMS column |
| city | facility_snapshot | city | text | yes | City | facility | CMS | copy | public | CMS column |
| state_code | facility_snapshot | state_code | char(2) | no | USPS state | facility | CMS | copy | public | CMS column |
| zip_code | facility_snapshot | zip_code | text | yes | ZIP as published | facility | CMS | copy | public | CMS column |
| county_name | facility_snapshot | county_name | text | yes | County name | facility | CMS | copy | public | CMS column |
| ownership_type | facility_snapshot | ownership_type | text | yes | CMS ownership-type category, not the owner graph | facility | CMS | copy | public | Category only |
| certified_beds | facility_snapshot | certified_beds | integer | yes | Certified beds | facility | CMS | copy | public | CMS column |
| participation_type | facility_snapshot | participation_type | text | yes | Participation type text | facility | CMS | copy | public | CMS column |
| participates_medicare | facility_snapshot | participates_medicare | boolean | yes | Medicare participation | facility | CMS | copy | public | CMS column |
| participates_medicaid | facility_snapshot | participates_medicaid | boolean | yes | Medicaid participation | facility | CMS | copy | public | CMS column |
| source_latitude | facility_snapshot | source_latitude | float | yes | CMS-published latitude | facility | CMS | copy | public | Not Google |
| source_longitude | facility_snapshot | source_longitude | float | yes | CMS-published longitude | facility | CMS | copy | public | Not Google |
| telephone | facility_snapshot | telephone | text | yes | CMS-published facility phone | facility | CMS | copy | hold | Counsel may require drop |
| overall_rating | facility_snapshot | overall_rating | smallint | yes | CMS overall star — lives on ratings file | facility | CMS | copy | exclude from this file | Split to `facility_ratings.csv` |
| provider_id | provider | id | uuid | no | Internal warehouse PK | facility | TrustHub | none | exclude | Unstable externally |
| attributes | facility_snapshot | attributes | jsonb | no | Residual blob | facility | mixed | none | exclude | SELECT * risk |
| raw_record | facility_snapshot | raw_record | jsonb | no | Full CMS row JSON | facility | CMS | none | exclude | Raw blob |
| location | facility_snapshot | location | geography | yes | PostGIS point | facility | CMS | none | exclude | Use lat/long columns |

Plus the provenance block (from Provider Information ingest).

---

## `facility_ratings.csv`

**Grain:** one current-release CMS Five-Star row per CCN. **PK:** (`ccn`, `source_release_key`). **Live rows:** 14,693.  
**Source authority:** CMS Provider Information `4pq5-n9py` (same snapshot as facilities).  
Stars are **CMS ratings**, not TrustHub scores. Null means CMS did not publish a star.

| public_field_name | source_table | source_column/expression | data_type | nullable | description | grain | source authority | transformation | public/hold/exclude | reason |
|-------------------|--------------|--------------------------|-----------|----------|-------------|-------|------------------|----------------|---------------------|--------|
| ccn | provider_identifier | identifier_value (CMS CCN current) | char(6) | no | Facility CCN | facility × release | CMS | join | public | FK to facilities |
| source_release_key | source_release | release_key | text | no | Provider Information vintage (`2026-07-29`) | facility × release | CMS | join | public | PK component; one vintage in V1 |
| overall_rating | facility_snapshot | overall_rating | smallint 1–5 | yes | CMS overall Five-Star. Live: 14,561 present / 132 null | facility × release | CMS | copy | public | Counsel Q F |
| health_inspection_rating | facility_snapshot | health_inspection_rating | smallint 1–5 | yes | CMS health-inspection star. Live: 14,561 / 132 | facility × release | CMS | copy | public | CMS methodology |
| staffing_rating | facility_snapshot | staffing_rating | smallint 1–5 | yes | CMS staffing star. Live: 14,491 / 202 | facility × release | CMS | copy | public | Not PBJ HPRD |
| quality_measure_rating | facility_snapshot | quality_measure_rating | smallint 1–5 | yes | CMS QM star. Live: 14,490 / 203 | facility × release | CMS | copy | public | CMS methodology |

Plus provenance block. Do not add TrustHub-derived score columns.

---

## `facility_inspections.csv`

**Grain:** one CMS survey/inspection event. **PK:** `academic_inspection_id`. **FK:** `ccn` → `facilities.ccn`. **Live rows:** 149,705.  
**Source authority:** CMS Inspection Dates `svdt-c123`.  
**Warehouse:** `inspection_event`.  
`academic_inspection_id` **aliases** existing `event_key` (SHA-256 of CCN + survey date + survey type + cycle, already stored). 001B.2A does **not** implement a new hash.

| public_field_name | source_table | source_column/expression | data_type | nullable | description | grain | source authority | transformation | public/hold/exclude | reason |
|-------------------|--------------|--------------------------|-----------|----------|-------------|-------|------------------|----------------|---------------------|--------|
| academic_inspection_id | inspection_event | event_key | char(64) | no | Deterministic inspection key already in warehouse | event | TrustHub key over CMS fields | key_alias | public | Existing key; unique per source_release |
| ccn | provider_identifier | via provider_id | char(6) | no | Facility CCN | event | CMS | join | public | FK |
| survey_date | inspection_event | survey_date | date | no | CMS survey date (event time) | event | CMS | copy | public | Event history |
| survey_type | inspection_event | survey_type | text | no | CMS type of survey | event | CMS | copy | public | CMS wording |
| survey_cycle | inspection_event | survey_cycle | integer | no | CMS survey cycle ≥ 0 | event | CMS | copy | public | CMS field |
| processing_date | inspection_event | processing_date | date | yes | CMS processing date | event | CMS | copy | public | Not identity |
| id | inspection_event | id | uuid | no | Warehouse UUID | event | TrustHub | none | exclude | Unstable |
| raw_record | inspection_event | raw_record | jsonb | no | Raw CMS row | event | CMS | none | exclude | Blob |

Plus provenance block (`transformation_version` = `inspection-dates-v1` in this vintage).

---

## `facility_deficiencies.csv`

**Grain:** one CMS health-deficiency citation. **PK:** `academic_deficiency_id`. **FK:** `ccn`; optional FK `academic_inspection_id`. **Live rows:** 418,344.  
**Source authority:** CMS Health Deficiencies `r5ix-sfxw`.  
**Warehouse:** `deficiency_finding`.  
`academic_deficiency_id` aliases existing `finding_key`. Optional inspection FK is null for **30,374** rows (documented incomplete join).

| public_field_name | source_table | source_column/expression | data_type | nullable | description | grain | source authority | transformation | public/hold/exclude | reason |
|-------------------|--------------|--------------------------|-----------|----------|-------------|-------|------------------|----------------|---------------------|--------|
| academic_deficiency_id | deficiency_finding | finding_key | char(64) | no | Deterministic finding key already stored | citation | TrustHub key over CMS fields | key_alias | public | Existing key |
| ccn | provider_identifier | via provider_id | char(6) | no | Facility CCN | citation | CMS | join | public | FK |
| academic_inspection_id | inspection_event | event_key WHERE deficiency_finding.inspection_event_id = inspection_event.id | char(64) | **yes** | Optional link to inspections | citation | TrustHub join on CMS fields | join | public | Null when unmatched |
| survey_date | deficiency_finding | survey_date | date | no | Citation survey date | citation | CMS | copy | public | Event history |
| survey_type | deficiency_finding | survey_type | text | yes | Survey type on deficiency file | citation | CMS | copy | public | CMS field |
| inspection_cycle | deficiency_finding | inspection_cycle | integer | no | Inspection cycle on deficiency file | citation | CMS | copy | public | CMS field |
| deficiency_prefix | deficiency_finding | deficiency_prefix | text | no | CMS deficiency prefix | citation | CMS | copy | public | CMS field |
| deficiency_tag | deficiency_finding | deficiency_tag | text | no | CMS tag number | citation | CMS | copy | public | CMS field |
| deficiency_category | deficiency_finding | deficiency_category | text | yes | Category text | citation | CMS | copy | public | CMS field |
| official_description | deficiency_finding | official_description | text | yes | Official CMS citation description | citation | CMS | copy | public | Not TrustHub narrative |
| scope_severity_code | deficiency_finding | scope_severity_code | char(1) A–L | no | Official CMS A–L code | citation | CMS | copy | public | Do not recode to a TrustHub scale |
| deficiency_corrected | deficiency_finding | deficiency_corrected | text | yes | Correction flag as published | citation | CMS | copy | public | CMS field |
| correction_date | deficiency_finding | correction_date | date | yes | Correction date | citation | CMS | copy | public | CMS field |
| standard_deficiency | deficiency_finding | standard_deficiency | boolean | yes | Standard deficiency flag | citation | CMS | copy | public | CMS field |
| complaint_deficiency | deficiency_finding | complaint_deficiency | boolean | yes | Complaint deficiency flag | citation | CMS | copy | public | CMS field |
| infection_control_deficiency | deficiency_finding | infection_control_deficiency | boolean | yes | Infection-control flag | citation | CMS | copy | public | CMS field |
| citation_under_idr | deficiency_finding | citation_under_idr | boolean | yes | Informal dispute resolution flag | citation | CMS | copy | public | CMS field |
| citation_under_iidr | deficiency_finding | citation_under_iidr | boolean | yes | Independent IDR flag | citation | CMS | copy | public | CMS field |
| processing_date | deficiency_finding | processing_date | date | yes | CMS processing date | citation | CMS | copy | public | CMS field |
| inspection_event_id | deficiency_finding | inspection_event_id | uuid | yes | Internal FK | citation | TrustHub | none | exclude | UUID; use academic_inspection_id |
| raw_record | deficiency_finding | raw_record | jsonb | no | Raw CMS row | citation | CMS | none | exclude | Blob |

Plus provenance (`health-deficiencies-v1`). Do **not** add derived Isolated/Pattern/Widespread columns; dictionary documents A–L using existing Care/CMS wording.

---

## `facility_enforcement.csv`

**Grain:** one CMS penalty (Fine or Payment Denial). **PK:** `academic_enforcement_id`. **FK:** `ccn`. **Live rows:** 16,166.  
**Source authority:** CMS Penalties `g6vv-u9sr`.  
**Warehouse:** `penalty_enforcement`.  
`academic_enforcement_id` aliases existing `penalty_key`.

| public_field_name | source_table | source_column/expression | data_type | nullable | description | grain | source authority | transformation | public/hold/exclude | reason |
|-------------------|--------------|--------------------------|-----------|----------|-------------|-------|------------------|----------------|---------------------|--------|
| academic_enforcement_id | penalty_enforcement | penalty_key | char(64) | no | Deterministic penalty key already stored | penalty | TrustHub key over CMS fields | key_alias | public | Existing key |
| ccn | provider_identifier | via provider_id | char(6) | no | Facility CCN | penalty | CMS | join | public | FK |
| penalty_date | penalty_enforcement | penalty_date | date | no | CMS penalty date | penalty | CMS | copy | public | Event history; vintage window 2023-07-17–2026-06-11 |
| penalty_type | penalty_enforcement | penalty_type | text | no | `Fine` or `Payment Denial` | penalty | CMS | copy | public | Same table |
| fine_id | penalty_enforcement | fine_id | text | yes | CMS fine identifier | penalty | CMS | copy | public | CMS field |
| fine_amount | penalty_enforcement | fine_amount | numeric(14,2) | yes | Fine dollars; required when type is Fine | penalty | CMS | copy | public | Not a TrustHub estimate |
| payment_denial_start_date | penalty_enforcement | payment_denial_start_date | date | yes | Denial start | penalty | CMS | copy | public | CMS field |
| payment_denial_days | penalty_enforcement | payment_denial_days | integer | yes | Denial length in days | penalty | CMS | copy | public | CMS field |
| processing_date | penalty_enforcement | processing_date | date | yes | CMS processing date | penalty | CMS | copy | public | CMS field |
| id | penalty_enforcement | id | uuid | no | Warehouse UUID | penalty | TrustHub | none | exclude | Unstable |
| raw_record | penalty_enforcement | raw_record | jsonb | no | Raw CMS row | penalty | CMS | none | exclude | Blob |

Plus provenance (`penalties-v1`).

---

## `facility_chains.csv`

**Grain:** one CMS chain membership. **PK:** (`chain_id`, `ccn`, `source_release_key`). **Live rows:** 10,231.  
**Source authority:** SNF Enrollments `5f2c306f-3b1c-42cd-b037-187b2ce22126` (transform `cms-chain-membership-v1`).  
**Warehouse:** `cms_chain` + `cms_chain_provider`.  
`chain_id` is CMS Chain ID text, not `cms_chain.id` uuid.

| public_field_name | source_table | source_column/expression | data_type | nullable | description | grain | source authority | transformation | public/hold/exclude | reason |
|-------------------|--------------|--------------------------|-----------|----------|-------------|-------|------------------|----------------|---------------------|--------|
| chain_id | cms_chain | cms_chain_id | text | no | Official CMS Chain ID | membership | CMS | copy | public | Public CMS identifier |
| ccn | cms_chain_provider | provider_identifier (normalized CCN) | char(6) | no | Member facility CCN (CMS enrollments). LEFT JOIN to facilities; not a strict FK | membership | CMS | copy | public | Identifier, not required FK |
| source_release_key | source_release | release_key | text | no | Enrollments vintage | membership | CMS | join | public | PK component |
| chain_name | cms_chain_provider | chain_name | text | no | CMS-published chain name on the membership row | membership | CMS | copy | public | CMS grouping name |
| enrollment_id | cms_chain_provider | enrollment_id | text | no | CMS enrollment id; unique per source release | membership | CMS | copy | public | CMS field |
| cms_chain.id | cms_chain | id | uuid | no | Warehouse UUID | chain | TrustHub | none | exclude | Unstable |
| metrics jsonb | cms_chain_performance_snapshot | metrics | jsonb | — | CMS chain aggregates | chain × month | CMS | none | exclude | Not a V1 table; not TrustHub scores |
| raw_record | cms_chain_provider | raw_record | jsonb | no | Raw row | membership | CMS | none | exclude | Blob |

Plus provenance.

---

## `sources.csv`

**Grain:** one succeeded ingest of one CMS file vintage and transformation version.  
**PK:** (`source_dataset_key`, `source_release_key`, `transformation_version`).  
`source_release_key` alone is **not** unique (PBJ has four vintages; enrollments has two transforms on one release).

| public_field_name | source_table | source_column/expression | data_type | nullable | description | grain | source authority | transformation | public/hold/exclude | reason |
|-------------------|--------------|--------------------------|-----------|----------|-------------|-------|------------------|----------------|---------------------|--------|
| source_dataset_key | source_dataset | dataset_key | text | no | Registry key | ingest | TrustHub | copy | public | PK |
| cms_dataset_identifier | (registry / official_url parse; not a DB column) | Care `cms_sources.json` cms_identifier | text | no | CMS catalog id | ingest | CMS | join from registry | public | Attribution |
| official_name | source_dataset | display_name | text | no | CMS product name | ingest | CMS | copy | public | Attribution |
| official_landing_url | source_release | official_source_url | text | yes | CMS landing URL stored on the release | ingest | CMS | copy | public | Attribution |
| source_release_key | source_release | release_key | text | no | Vintage key | ingest | CMS | copy | public | PK |
| source_release_date | source_release | source_release_date | date | yes | Stored release date | ingest | CMS | copy | public | May equal modified date |
| source_modified_at | source_release | source_modified_at | timestamptz | yes | CMS modified time | ingest | CMS | copy | public | Provenance |
| retrieved_at | source_release | retrieved_at | timestamptz | no | Retrieval time | ingest | TrustHub | copy | public | Provenance |
| content_sha256 | source_release | content_sha256 | char(64) | no | SHA-256 of retrieved source bytes | ingest | TrustHub | copy | public | Source-file integrity, not academic CSV hash |
| transformation_version | ingest_run | transformation_version | text | no | Loader version | ingest | TrustHub | copy | public | PK |
| ingest_status | ingest_run | status | text | no | Must be `succeeded` | ingest | TrustHub | copy | public | Filter |
| rows_read | ingest_run | rows_read | bigint | no | Loader count | ingest | TrustHub | copy | public | QA |
| valid_rows | ingest_run | valid_rows | bigint | no | Loader count | ingest | TrustHub | copy | public | QA |
| rejected_rows | ingest_run | rejected_rows | bigint | no | Loader count | ingest | TrustHub | copy | public | QA |
| ingest_completed_at | ingest_run | completed_at | timestamptz | yes | Run end | ingest | TrustHub | copy | public | Provenance |
| source_dataset.id | source_dataset | id | uuid | no | Internal | ingest | TrustHub | none | exclude | UUID |
| source_release.id | source_release | id | uuid | no | Internal | ingest | TrustHub | none | exclude | UUID |

---

## Optional / not Open V1 — evaluation only

### `facility_staffing_quarters.csv` — **HOLD (not in first Open V1 zip)**

Exists: 57,873 rows, 14,665 CCNs, quarters 2025Q2–2026Q1. Formula `pbj-quarter-ratio-of-sums-v1` is a TrustHub aggregation of CMS PBJ daily hours, **not** a CMS star. Eligible for V1.1 after counsel on PBJ redistribution. Daily `pbj_staffing_day` (5,280,805) remains **exclude**.

### Ownership, CHOW, history, state, AL, Google — **exclude from Open V1**

See freeze document section E. Individual owner names (453,390 rows / 246,020 parties) are a separate counsel question even if organization rows were later considered.

---

## Keys (frozen)

| Table | PK | FK |
|-------|----|----|
| facilities | `ccn` | — |
| facility_ratings | `ccn` + `source_release_key` | `ccn` → facilities |
| facility_inspections | `academic_inspection_id` | `ccn` → facilities |
| facility_deficiencies | `academic_deficiency_id` | `ccn` → facilities; optional `academic_inspection_id` → inspections |
| facility_enforcement | `academic_enforcement_id` | `ccn` → facilities |
| facility_chains | `chain_id` + `ccn` + `source_release_key` | `ccn` **LEFT JOIN** facilities (1,361 CCNs outside current snapshot; not a strict FK) |
| sources | `source_dataset_key` + `source_release_key` + `transformation_version` | — |

No new hash implementation in this task.
