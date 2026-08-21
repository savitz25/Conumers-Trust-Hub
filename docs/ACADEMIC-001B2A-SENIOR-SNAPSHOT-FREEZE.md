# Academic 001B.2A — Senior snapshot live recount and schema freeze

**Status:** Preparation only. No academic dataset published.  
**Date:** 2026-08-21  
**Ask starting SHA:** `0654a7c` (Academic 001B.1)  
**Warehouse:** `savitz25/care-trust-hub` SeniorTrustHub CMS store  
**Canonical identity:** CMS CCN  
**Proposed package:** `trusthub-senior-regulatory-v2026.07.29`

Documentation set: `docs/academic/senior-v1/` (`README.md`, `DATA-DICTIONARY.md`, `FIELD-FREEZE.md`, `SOURCES.md`, `LIMITATIONS.md`, `MANIFEST-SPEC.md`, `COUNSEL-REVIEW.md`).

**Not done:** CSV extract, download links, DOI, university contact, Google Places, production writes, SeniorTrustHub page changes.

---

## Connection safety

| Check | Result |
|-------|--------|
| database reachable | **YES** |
| SSL | **YES** (`require` on managed session pooler) |
| query mode | **SELECT ONLY** inside `SET TRANSACTION READ ONLY` (`transaction_read_only=on`) |
| counted_at (core) | `2026-08-21T01:39:39.942Z` |
| counted_at (state/AL follow-up) | `2026-08-21T01:51:02.805Z` |
| production writes | **0** |
| Google Places | **0** |

Runner: `scripts/academic-001b2a-senior-recount.mjs`. If the database had been unreachable, live recount would have been **BLOCKED**. It was not.

---

## A. Exact live counts

### Canonical identity

| Measure | Live |
|--------:|------|
| `provider` rows (`nursing_home` only) | **14,693** |
| CMS CCN identifier rows | **14,693** |
| Distinct CMS CCNs | **14,693** |
| `facility_snapshot` rows | **14,693** |
| Current Provider Information `release_key` | **2026-07-29** |
| Current `source_modified_at` | 2026-07-29T00:00:00.000Z |
| Current `retrieved_at` | 2026-08-14T16:37:37.046Z |
| Current-release snapshots (CCN `valid_from IS NULL`) | **14,693** |
| Distinct current CCNs | **14,693** |
| Duplicate current CCN groups | **0** |

### Ratings (current snapshots)

| Measure | Present | Null |
|---------|--------:|-----:|
| overall | 14,561 | **132** |
| health inspection | 14,561 | **132** |
| staffing | 14,491 | **202** |
| quality measure | 14,490 | **203** |

### Inspections / deficiencies / enforcement

| Measure | Live |
|--------:|------|
| `inspection_event` | **149,705** |
| Inspection distinct facilities | **14,693** |
| Inspection min / max `survey_date` | 2016-07-28 / 2026-06-26 |
| `deficiency_finding` | **418,344** |
| Deficiency distinct facilities | **14,629** |
| Deficiencies linked / unlinked to inspection | 387,970 / **30,374** |
| Deficiency min / max `survey_date` | 2017-03-23 / 2026-06-22 |
| `penalty_enforcement` | **16,166** |
| Fine / payment-denial rows | 13,687 / 2,479 |
| Penalty distinct facilities | **6,844** |
| `SUM(fine_amount)` Fines only | **464165281.00** |
| Penalty min / max date | 2023-07-17 / 2026-06-11 |

### Staffing

| Measure | Live |
|--------:|------|
| `pbj_staffing_quarter_summary` | **57,873** |
| Distinct CCNs / quarters | 14,665 / 4 |
| Earliest / latest quarter | 2025Q2 / 2026Q1 |
| `pbj_staffing_day` (audit only) | **5,280,805** |

### Ownership / chains / CHOW

| Measure | Live |
|--------:|------|
| `provider_ownership_relationship` | **674,063** |
| Organization / individual relationship rows | 220,673 / **453,390** |
| Distinct facilities with ownership | 14,380 |
| Distinct org / individual parties | 110,859 / **246,020** |
| `organization_relationship` | **0** |
| `ownership_change_event` | **5,227** |
| CHOW min / max effective | 2016-01-01 / 2026-02-01 |
| `cms_chain` / memberships | 671 / **10,231** |
| Distinct facilities with chain / distinct chain ids on memberships | 10,116 / 632 |

### Provenance (succeeded ingest runs)

Provider Information, inspections, deficiencies, penalties, ownership, All Owners, CHOW, CHOW owners: **1** release each. PBJ: **4**. Chain performance: **6**. Enrollments: **1** release, **2** succeeded transforms (`cms-ownership-v1`, `cms-chain-membership-v1`). SHA-256 values: `docs/academic/senior-v1/SOURCES.md`.

### State / derived / assisted living — OUT of Open V1

| Measure | Live |
|--------:|------|
| `facility_history_event` | **156,797** |
| History distinct facilities | 14,693 |
| History family rating / staffing / inspection / enforcement / ownership / state | 0 / 20,265 / 105,792 / 16,166 / 5,173 / **9,401** |
| **CA state events** | **3,317** (272 facilities; 3,238 `STATE_FINE`, 79 `STATE_ENFORCEMENT_ACTION`) |
| **NY state events** | **6,084** (514 facilities; 4,239 complaint inspections, 1,053 inspections, 792 fines) |
| **TX state events** | **0** |
| `published_state_claim` rows | 13,633 |
| CA / NY / TX `STATE_LICENSE_ID` facilities | 1,158 / 515 / 1,134 |
| **`assisted_living_provider` rows** | **15,047** (CA 12,522 / NY 529 / TX 1,996) |

---

## B. Comparison to Academic 001B.1

001B.1 documented Task 014A/015C/016 figures and **did not live-count**. 001B.2A live-counted. Old figures are not silently replaced.

| Object | 001B.1 documented | Live 001B.2A | Class | Note |
|--------|------------------:|-------------:|-------|------|
| Facilities / current CCNs | 14,693 | 14,693 | **UNCHANGED** | |
| Inspections | 149,705 | 149,705 | **UNCHANGED** | |
| Deficiencies | 418,344 | 418,344 | **UNCHANGED** | Unlinked 30,374 also unchanged |
| Penalties | 16,166 | 16,166 | **UNCHANGED** | |
| Staffing-quarter summaries | 57,873 | 57,873 | **UNCHANGED** | |
| Ownership relationships | 674,063 | 674,063 | **UNCHANGED** | |
| Chain memberships | 10,231 | 10,231 | **UNCHANGED** | |
| Derived `facility_history_event` | 147,396 | 156,797 | **INCREASED** | +9,401 = CA+NY state-family events |
| `ownership_change_event` | NOT VERIFIED | 5,227 | **NOT COMPARABLE** | 001B.1 had no table count (derived ownership events 5,173) |
| CA / NY / TX **state events** | not separately counted | 3,317 / 6,084 / 0 | **NOT COMPARABLE** | 001B.1 counted license-ID facilities, not history events |
| Assisted living providers | 15,047 in 021B | 15,047 | **UNCHANGED** vs 021B; **NOT COMPARABLE** to the seven core 001B.1 flagship counts | Out of CCN V1 |
| Duplicate current CCNs | implied 0 | 0 | **UNCHANGED** | Confirmed live |
| PBJ daily | NOT VERIFIED | 5,280,805 | **NOT COMPARABLE** | First live count; excluded |

**Material differences:** none among the seven flagship identity counts. History grew by state overlays. CHOW is now an exact table count. TX has license claims but **zero** state history events.

---

## C. Final recommended Open V1 tables

**Include**

- `facilities.csv`
- `facility_ratings.csv`
- `facility_inspections.csv`
- `facility_deficiencies.csv`
- `facility_enforcement.csv`
- `facility_chains.csv`
- `sources.csv`

**Optional / HOLD (not in the first open zip)**

- `facility_staffing_quarters.csv` — real 57,873-row aggregate; TrustHub HPRD is ratio-of-sums, not a CMS star; only four quarters; PBJ redistribution is a counsel item. Eligible for V1.1, not V1.0.

**Keep ownership out of Open V1.** Individual names are 453,390 rows. Organization rows still need counsel (questions G–I). No compelling research need overrides that gate for the **first** national flagship zip; CMS stars, inspections, deficiencies, and penalties already support the public-policy use cases.

---

## D. Field freeze summary

Normative list: `docs/academic/senior-v1/FIELD-FREEZE.md`.

Keys:

| Table | PK | FK |
|-------|----|----|
| facilities | `ccn` | |
| facility_ratings | `ccn` + `source_release_key` | `ccn` |
| facility_inspections | `academic_inspection_id` (= existing `event_key`) | `ccn` |
| facility_deficiencies | `academic_deficiency_id` (= existing `finding_key`) | `ccn`; optional `academic_inspection_id` |
| facility_enforcement | `academic_enforcement_id` (= existing `penalty_key`) | `ccn` |
| facility_chains | `chain_id` (CMS) + `ccn` + `source_release_key` | `ccn` |
| sources | `source_dataset_key` + `source_release_key` + `transformation_version` | |

No new hash implementation. Telephone **hold**. No `SELECT *`. No public UUIDs.

---

## E. Exclusions (Open V1)

- PBJ daily (`pbj_staffing_day`)
- Personal owner records and the full ownership graph
- CHOW buyer/seller identities
- Google enrichment / identity candidates
- Assisted living (`assisted_living_provider` 15,047)
- State overlays and CA/NY/TX state history events
- Family workspace / interviews / trust-request user content
- `REVIEW_REQUIRED` identity claims and matcher confidence
- `raw_record` / `attributes` jsonb / `raw_object` storage keys
- Derived TrustHub rankings, scores, or facility-history timeline
- MDS `djen-97ju` (not ingested)

---

## F. Provenance model

Row-level on every Open V1 fact table, using columns that **exist**:

`source_dataset_key` · `source_release_key` · `source_modified_at` · `retrieved_at` · `ingest_completed_at` · `transformation_version` · `source_record_locator`

`source_dataset_id` (UUID) is **not** required publicly and must not be shipped. `sources.csv` is the table-level register (and is the right grain for CMS file hashes). Event dates are **not** provenance dates.

---

## G. Release gate

No Senior Academic V1 may become **PUBLIC** until all of:

- [x] live counts frozen (this document)
- [x] field lists frozen (`FIELD-FREEZE.md`)
- [x] data dictionary complete (draft: `DATA-DICTIONARY.md`)
- [ ] checksums implemented (extract-time `checksums.sha256`)
- [x] source manifest specified (`SOURCES.md`, `MANIFEST-SPEC.md`)
- [ ] reproducibility run passes
- [ ] counsel review complete (`COUNSEL-REVIEW.md` A–O unanswered)
- [ ] final license selected
- [ ] PII scan passes
- [ ] excluded-field scan passes
- [ ] Google-derived field scan passes
- [ ] sample QA passes
- [ ] academic registry updated **deliberately** to PUBLIC (not this task)
- [ ] DOI decision made deliberately (remain null until assigned)

Registry now: **DOCUMENTATION** only. `downloadHref` null. `doi` null. `snapshotDate` null.

---

## H. Counsel blockers

Fifteen unresolved publication questions (A–O) in `docs/academic/senior-v1/COUNSEL-REVIEW.md`: redistribution, attribution, license, named facilities, enforcement/deficiency presentation, CMS stars, org ownership, individual ownership, CHOW identities, academic vs commercial use, disclaimers, limitation of liability, CC BY 4.0 vs alternative, citation, archival/DOI terms.

Do not answer them here.

---

## I. Recommendation for Academic 001B.2B / 001C

**001B.2B (exact scope):** internal, non-public **reproducibility extract dry-run** of the seven Open V1 tables against this field freeze: gitignored CSV (or equivalent), `checksums.sha256`, row-count reconciliation, excluded-field / Google / PII scans, sample QA. Still **no** publication, **no** DOI, **no** `/academic` download, **no** university contact, **no** production writes, **no** Google API, **no** ownership/AL/state in the dry-run zip.

**Out of 001B.2B:** ER benchmark review (explicitly not begun), counsel legal answers (human track), staffing-quarters unless dry-run is explicitly extended.

**001C:** only after counsel A–F (at least) and a passing 001B.2B dry-run — publication mechanics, not a surprise extract.

STOP. Do not publish.
