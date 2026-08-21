# Senior Academic V1 — source register

Government source attribution remains with **CMS**. TrustHub stores immutable vintages and normalizes keys. Landing URLs are official CMS pages, not TrustHub mirrors.

Live `source_release` / `ingest_run` facts below were read SELECT-only on **2026-08-21**. SHA-256 values are of **retrieved CMS bytes**, not of unpublished academic CSVs.

---

## 1. Provider Information

| | |
|--|--|
| Agency | Centers for Medicare & Medicaid Services (CMS) |
| Dataset name | Provider Information |
| CMS dataset ID | `4pq5-n9py` |
| Official URL | https://data.cms.gov/provider-data/dataset/4pq5-n9py |
| Dictionary | https://data.cms.gov/provider-data/sites/default/files/data_dictionaries/nursing_home/NH_Data_Dictionary.pdf |
| Supports V1 tables | `facilities.csv`, `facility_ratings.csv` |
| TrustHub dataset_key | `nursing-home-provider-information` |
| release_key | `2026-07-29` |
| source_modified_at | 2026-07-29 |
| retrieved_at | 2026-08-14 16:37:37 UTC |
| transformation_version | `provider-information-v2` |
| content_sha256 | `dd15b5c31a632e46f9f28260ed9ad89486e48bba5d0589b3ccaa68214e8b9ef1` |
| Limitations | One row per currently active home; monthly overwrite; one snapshot in this warehouse |

---

## 2. Inspection Dates

| | |
|--|--|
| Agency | CMS |
| Dataset name | Inspection Dates |
| CMS dataset ID | `svdt-c123` |
| Official URL | https://data.cms.gov/provider-data/dataset/svdt-c123 |
| Supports V1 tables | `facility_inspections.csv` |
| TrustHub dataset_key | `nursing-home-inspection-dates` |
| release_key | `2026-07-01` |
| source_modified_at | 2026-07-01 |
| retrieved_at | 2026-08-14 23:02:49 UTC |
| transformation_version | `inspection-dates-v1` |
| content_sha256 | `d1163032b116a73e828ba43a68550fad36eec794f7d046d5ffc9ff6df705f942` |
| Limitations | Event history inside the published file; not every survey ever conducted |

---

## 3. Health Deficiencies

| | |
|--|--|
| Agency | CMS |
| Dataset name | Health Deficiencies |
| CMS dataset ID | `r5ix-sfxw` |
| Official URL | https://data.cms.gov/provider-data/dataset/r5ix-sfxw |
| Supports V1 tables | `facility_deficiencies.csv` |
| TrustHub dataset_key | `nursing-home-health-deficiencies` |
| release_key | `2026-07-01` |
| source_modified_at | 2026-07-01 |
| retrieved_at | 2026-08-14 23:02:59 UTC |
| transformation_version | `health-deficiencies-v1` |
| content_sha256 | `cba84cc4809cfa6baaecd10cb68305769e87d1120a77c4aa3cec465df4487c7f` |
| Limitations | 30,374 citations unmatched to an inspection event; A–L codes are official, not resident PII |

---

## 4. Penalties

| | |
|--|--|
| Agency | CMS |
| Dataset name | Penalties |
| CMS dataset ID | `g6vv-u9sr` |
| Official URL | https://data.cms.gov/provider-data/dataset/g6vv-u9sr |
| Supports V1 tables | `facility_enforcement.csv` |
| TrustHub dataset_key | `nursing-home-penalties` |
| release_key | `2026-07-01` |
| source_modified_at | 2026-07-01 |
| retrieved_at | 2026-08-14 23:03:02 UTC |
| transformation_version | `penalties-v1` |
| content_sha256 | `beeadfdb2ad5a1c8324548e260929419960bfe3948b5fec3b4febce99b28cb5f` |
| Limitations | Published window 2023-07-17–2026-06-11; Fine vs Payment Denial; Fine sum is vintage arithmetic, not all-time |

---

## 5. Skilled Nursing Facility Enrollments (chain membership)

| | |
|--|--|
| Agency | CMS |
| Dataset name | Skilled Nursing Facility Enrollments |
| CMS dataset ID | `5f2c306f-3b1c-42cd-b037-187b2ce22126` |
| Official URL | https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/skilled-nursing-facility-enrollments |
| Supports V1 tables | `facility_chains.csv` |
| TrustHub dataset_key | `skilled-nursing-facility-enrollments` |
| release_key | `2026-07-27` |
| source_modified_at | 2026-07-27 |
| retrieved_at | 2026-08-15 22:02:19 UTC |
| transformation_version (V1 chains) | `cms-chain-membership-v1` |
| content_sha256 | `6ad13e7f19a839a6927d04db625f86f9dcbd6b5343e80f2ffae9314e94f4a841` |
| Limitations | Same bytes also ingested as `cms-ownership-v1` (not an Open V1 table); membership ≠ TrustHub chain score |

Chain performance measures (`97ecfad1-d3f1-4d42-b774-d74661d830bc`, six monthly vintages March–August 2026) support warehouse chain names/metrics. Open V1 does **not** ship chain performance JSON.

---

## 6. Sources that support warehouse tables **excluded** from Open V1

| Agency | Dataset | CMS ID | Official URL | Warehouse use | Why out of Open V1 |
|--------|---------|--------|--------------|---------------|--------------------|
| CMS | Ownership | `y2hd-n93e` | https://data.cms.gov/provider-data/dataset/y2hd-n93e | ownership graph | Personal and org owners; counsel |
| CMS | SNF All Owners | `afe44b85-cc6d-40d7-b5df-00ae8910d1d2` | https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/skilled-nursing-facility-all-owners | ownership graph | PECOS individuals |
| CMS | SNF CHOW | `f557a6ed-95b3-4a22-8433-4175db2dec1c` | https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/skilled-nursing-facility-change-of-ownership | `ownership_change_event` (5,227) | Buyer/seller identities |
| CMS | CHOW owner information | `a4358712-e910-4eaf-8f24-5e90ba3cf8d0` | https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/skilled-nursing-facility-change-of-ownership-owner-information | party graph | Named persons/orgs |
| CMS | PBJ Daily Nurse Staffing | `7e0d53ba-8f02-4c66-98a5-14a1c997c50d` | https://data.cms.gov/quality-of-care/payroll-based-journal-daily-nurse-staffing | daily 5,280,805; quarters 57,873 | Daily excluded; quarters HOLD |
| CA / NY / TX regulators | State directories / enforcement | (state-specific) | (state sites; not national CMS) | `published_state_claim`; `facility_history_event` family `state` | Uneven; terms; named administrators |
| Commercial | Google Places | n/a | n/a | enrichment cache | ToS; excluded |

MDS Quality Measures `djen-97ju` is in the CMS registry but **not ingested**.

---

## 7. `sources.csv` role

Every Open V1 fact row should carry `source_dataset_key`, `source_release_key`, `source_modified_at`, `retrieved_at`, `ingest_completed_at`, `transformation_version`, and `source_record_locator` so a researcher can find the matching `sources.csv` row and the official CMS product page.
