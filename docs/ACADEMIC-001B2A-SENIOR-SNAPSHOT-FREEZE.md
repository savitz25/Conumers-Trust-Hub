# Academic 001B.2A — SeniorTrustHub snapshot live recount and schema freeze

**Status:** Preparation only. No academic dataset published.  
**Date:** 2026-08-21  
**Ask HEAD at start:** `0654a7c` (Academic 001B.1)  
**Data warehouse:** `savitz25/care-trust-hub` SeniorTrustHub CMS nursing-facility store  
**Canonical identity:** CMS CCN (six-character)  
**Proposed package name:** `trusthub-senior-regulatory-v2026.07.29`  
**Public catalog name:** TrustHub Senior Regulatory Research Dataset

Sibling documents:

- Data dictionary draft: `docs/ACADEMIC-001B2A-DATA-DICTIONARY.md`
- Release manifest specification: `docs/ACADEMIC-001B2A-RELEASE-MANIFEST.md`
- Counsel-review packet: `docs/ACADEMIC-001B2A-COUNSEL-PACKET.md`

**This task does not:** extract CSV files, add download links, register a DOI, contact universities, call Google Places, mutate production, refresh CMS sources, or change SeniorTrustHub pages.

Guardrails held: production database writes **0** · Google Places requests **0** · public downloads **0**.

---

## 0. Connection safety (before any SELECT)

SeniorTrustHub already uses server-only `CARE_DATABASE_URL` (see Care `docs/DATABASE_OPERATIONS.md` and `apps/web/src/server/care/database-config.ts`). SSL mode in the loaded local environment was `require` (encrypted managed pooler). The recount runner:

1. loaded ignored local env files privately and never printed the URL;
2. did not run migrations, ingest, or any `INSERT`/`UPDATE`/`DELETE`/`ALTER`;
3. opened `BEGIN` then `SET TRANSACTION READ ONLY`;
4. confirmed `current_setting('transaction_read_only') = on`;
5. ran named `SELECT` statements only;
6. `ROLLBACK` then disconnected.

| Check | Result |
|-------|--------|
| database reachable | **YES** |
| SSL | **YES** (`require`, `rejectUnauthorized: false` on the managed pooler) |
| query mode | **SELECT ONLY** inside an explicit **READ ONLY** transaction |
| endpoint | Supabase **session** pooler (not transaction pooler 6543) |
| statement timeout | 180s local |
| counted_at | `2026-08-21T01:39:39.942Z` UTC |
| Google Places | **0** |
| production writes | **0** |

If this connection had failed, the live recount would have been reported **BLOCKED**. It was not blocked. Counts below are live warehouse `COUNT(*)` / `COUNT(DISTINCT)` / `MIN` / `MAX` / `SUM` from that session. They are **not** recycled 014A documentation.

Recount SQL: `scripts/academic-001b2a-senior-recount.sql`  
Runner: `scripts/academic-001b2a-senior-recount.mjs`

---

## 1. Live exact recount

All `provider` rows are `provider_type = nursing_home` (**14,693**). Assisted living is a separate schema and was not counted into the CCN flagship.

### A. Canonical identity

| Measure | Live count |
|--------:|----------|
| `provider` rows | **14,693** |
| CMS CCN identifier rows (`issuer='CMS'`, `identifier_type='CCN'`) | **14,693** |
| Distinct CMS CCNs (all identifier rows) | **14,693** |
| `facility_snapshot` rows (all releases) | **14,693** |
| Current Provider Information release key | **2026-07-29** |
| Current `source_modified_at` | **2026-07-29T00:00:00.000Z** |
| Current `retrieved_at` | **2026-08-14T16:37:37.046Z** |
| Current-release snapshot rows (joined to current CCN, `valid_from IS NULL`) | **14,693** |
| Distinct current CCNs | **14,693** |
| Duplicate current CCN groups | **0** |

Current-release rule matches production (`repository.ts`): latest **succeeded** `ingest_run` for `source_dataset.dataset_key = 'nursing-home-provider-information'`. There is **one** Provider Information `source_release`. Ratings therefore remain a **cross-section**, not a longitudinal panel.

### B. Ratings (current snapshots)

| Measure | Live count |
|--------:|----------|
| Overall rating present | **14,561** |
| Overall rating null | **132** |
| Health inspection rating present | **14,561** |
| Health inspection rating null | **132** |
| Staffing rating present | **14,491** |
| Staffing rating null | **202** |
| Quality-measure rating present | **14,490** |
| Quality-measure rating null | **203** |

Null CMS stars are **missing CMS values**, not a TrustHub “clean record” finding.

### C. Inspections

| Measure | Live count |
|--------:|----------|
| `inspection_event` rows | **149,705** |
| Distinct facilities (`provider_id`) | **14,693** |
| Min `survey_date` | **2016-07-28** |
| Max `survey_date` | **2026-06-26** |

Every current CCN has at least one inspection row in this vintage. The file is still **not** a complete history of harm.

### D. Deficiencies

| Measure | Live count |
|--------:|----------|
| `deficiency_finding` rows | **418,344** |
| Distinct facilities | **14,629** |
| Linked to `inspection_event_id` | **387,970** |
| Null / unresolved inspection link | **30,374** |
| Min `survey_date` | **2017-03-23** |
| Max `survey_date` | **2026-06-22** |

**64** current facilities have no deficiency row in this vintage. Unlinked findings are a documented CMS/join limitation, not a load error to “fix” in the academic extract.

### E. Enforcement

| Measure | Live count |
|--------:|----------|
| `penalty_enforcement` rows | **16,166** |
| Fine rows (`penalty_type = 'Fine'`) | **13,687** |
| Payment-denial rows (`penalty_type = 'Payment Denial'`) | **2,479** |
| Distinct facilities | **6,844** |
| `SUM(fine_amount)` where type is Fine | **464,165,281.00** |
| Min `penalty_date` | **2023-07-17** |
| Max `penalty_date` | **2026-06-11** |

Payment denials are modeled on the **same table**, not a separate relation. The dollar sum is the arithmetic total of CMS-published Fine amounts in this vintage. It is **not** an all-time national penalty total: the CMS penalties file is a short published window (~three years here). Do not cite the sum as TrustHub’s estimate of “true” fines.

### F. Staffing

| Measure | Live count |
|--------:|----------|
| `pbj_staffing_quarter_summary` rows | **57,873** |
| Distinct CCNs | **14,665** |
| Distinct quarters | **4** |
| Earliest quarter | **2025Q2** |
| Latest quarter | **2026Q1** |
| `pbj_staffing_day` rows (audit only; **exclude open V1**) | **5,280,805** |

Open V1 may include quarter summaries as **optional**. Daily PBJ is out of the first academic package.

### G. Ownership

| Measure | Live count |
|--------:|----------|
| `provider_ownership_relationship` rows | **674,063** |
| Organization-party relationships | **220,673** |
| Individual-person relationships | **453,390** |
| Distinct facilities with any ownership row | **14,380** |
| Distinct organization parties used | **110,859** |
| Distinct individual parties used | **246,020** |
| `ownership_party` organization rows | **110,859** |
| `ownership_party` individual rows | **246,020** |
| `organization_relationship` rows | **0** |
| `ownership_change_event` (CHOW) rows | **5,227** |
| CHOW min `effective_date` | **2016-01-01** |
| CHOW max `effective_date` | **2026-02-01** |

001B.1 left CHOW **NOT VERIFIED**. It is now live. Individual owner/manager names are **majority grain** and remain gated for counsel. Empty `organization_relationship` is not a V1 table.

### H. Chains

| Measure | Live count |
|--------:|----------|
| `cms_chain` rows | **671** |
| `cms_chain_provider` memberships | **10,231** |
| Distinct facilities with a chain membership (`provider_id` not null) | **10,116** |
| Distinct `chain_id` values on memberships | **632** |

**39** chain records have no membership row in this vintage. CMS Chain ID is a CMS grouping, not a TrustHub score.

### I. Provenance — source releases and succeeded ingest runs

| `dataset_key` | source_release rows | succeeded ingest runs |
|---------------|--------------------:|----------------------:|
| nursing-home-chain-performance-measures | 6 | 6 |
| nursing-home-health-deficiencies | 1 | 1 |
| nursing-home-inspection-dates | 1 | 1 |
| nursing-home-ownership | 1 | 1 |
| nursing-home-penalties | 1 | 1 |
| nursing-home-provider-information | 1 | 1 |
| payroll-based-journal-daily-nurse-staffing | 4 | 4 |
| skilled-nursing-facility-all-owners | 1 | 1 |
| skilled-nursing-facility-change-of-ownership | 1 | 1 |
| skilled-nursing-facility-change-of-ownership-owner-information | 1 | 1 |
| skilled-nursing-facility-enrollments | 1 | **2** |

Enrollments has two succeeded transformation versions on the same release: `cms-ownership-v1` (14,405 rows read) and `cms-chain-membership-v1` (10,231 rows read). Chain membership is the academic chain table source.

Immutable source-file SHA-256 values for each release are listed in the manifest spec (source bytes, not secrets).

### J. State / derived — audit only (not open V1)

| Measure | Live count |
|--------:|----------|
| `facility_history_event` rows | **156,797** |
| Distinct facilities in history | **14,693** |
| History family: enforcement | 16,166 |
| History family: inspection | 105,792 |
| History family: ownership | 5,173 |
| History family: staffing | 20,265 |
| History family: rating | **0** |
| History family: state | 9,401 |
| `published_state_claim` rows (view) | **13,633** |

Published VERIFIED CA/NY/TX claims by resolver state:

| State | Claim rows | Distinct facilities | `STATE_LICENSE_ID` facilities |
|-------|----------:|--------------------:|------------------------------:|
| CA | 6,889 | **1,158** | **1,158** |
| NY | 2,151 | **515** | **515** |
| TX | 4,593 | **1,134** | **1,134** |

`STATE_ADMINISTRATOR` claims: **1,144** facilities — named-person overlay; exclude from open V1.

Facility history is **derived** (`facility-history-v1`). Rating-change events are **0** because only one Provider Information release exists. The 001B.1 documented history total **147,396** plus live state-family **9,401** equals this live **156,797**.

---

## 2. Comparison to Academic 001B.1 documented counts

001B.1 copied Task 014A / 015C / 016 documentation and did **not** live-count. This task did.

| Object | 001B.1 documented | Live 001B.2A | Delta |
|--------|------------------:|-------------:|------:|
| Current CCNs / snapshots | 14,693 | **14,693** | 0 |
| Inspections | 149,705 | **149,705** | 0 |
| Deficiencies | 418,344 | **418,344** | 0 |
| Unlinked deficiencies | 30,374 | **30,374** | 0 |
| Penalties | 16,166 | **16,166** | 0 |
| PBJ quarter summaries | 57,873 | **57,873** | 0 |
| Ownership relationships | 674,063 | **674,063** | 0 |
| Chain memberships | 10,231 | **10,231** | 0 |
| CA / NY / TX license-ID facilities | 1,158 / 515 / 1,134 | **1,158 / 515 / 1,134** | 0 |
| `ownership_change_event` | NOT VERIFIED (derived ownership events 5,173) | **5,227** table; 5,173 derived | table now live |
| `facility_history_event` | 147,396 | **156,797** | +9,401 state family |
| `pbj_staffing_day` | NOT VERIFIED | **5,280,805** | first live count |
| Duplicate current CCNs | (implied 0) | **0** | confirmed |

Warehouse identity counts are unchanged since 014A. Derived history grew by state overlays. CHOW is now an exact table count.

---

## 3. Field-level freeze specification

**Package:** `trusthub-senior-regulatory-v2026.07.29`  
**Universe:** CMS-active nursing homes in Provider Information release `2026-07-29` (14,693 CCNs).  
**Join key:** `ccn` (CMS six-character). Do not publish internal UUIDs as public identifiers.  
**Format (when later extracted, not now):** CSV UTF-8 with header; optional Parquet twins only if a table exceeds practical CSV size.  
**Named facilities:** yes, using CMS-published facility names (counsel still required).  
**Individual persons:** hold.

### 3.1 Include in proposed open V1 (after counsel)

| File | Grain | PK | Live rows | Source |
|------|-------|----|----------:|--------|
| `facilities.csv` | one current CMS-active home | `ccn` | 14,693 | `4pq5-n9py` / `facility_snapshot` current release |
| `facility_inspections.csv` | one CMS survey event | `inspection_event_key` | 149,705 | `svdt-c123` / `inspection_event` |
| `facility_deficiencies.csv` | one citation | `deficiency_finding_key` | 418,344 | `r5ix-sfxw` / `deficiency_finding` |
| `facility_enforcement.csv` | one fine or payment denial | `penalty_key` | 16,166 | `g6vv-u9sr` / `penalty_enforcement` |
| `facility_chains.csv` | one CMS chain membership | (`cms_chain_id`,`ccn`,`source_release_key`) | 10,231 | enrollments + chain performance / `cms_chain_provider` |
| `sources.csv` | one immutable CMS file vintage | (`source_dataset_key`,`source_release_key`,`transformation_version`) | small | `source_release` + `ingest_run` |

Ratings freeze **on** `facilities.csv` (not a second file) because there is only one snapshot release.

### 3.2 Conditional / later

| File | Grain | Live rows | Open V1? |
|------|-------|----------:|----------|
| `facility_ownership.csv` | one disclosed relationship | 674,063 total; **220,673** org | **Org-only draft** until counsel; individuals **CONTROLLED** |
| `facility_ownership_changes.csv` | one CHOW event | **5,227** | Include events; buyer/seller **names** gated |
| `facility_staffing_quarters.csv` | one CCN × quarter | 57,873 | **Optional V1 / V1.1** — TrustHub HPRD is ratio-of-sums, not a CMS star |
| `facility_history_derived.csv` | one derived timeline event | 156,797 | **CONTROLLED** — not CMS-native |
| `facility_state_claims.csv` | one VERIFIED CA/NY/TX claim | 13,633 | **CONTROLLED** — not national; state terms |

### 3.3 Frozen column lists (open V1)

Common provenance on every row of every table:

`source_dataset_key`, `cms_dataset_identifier`, `source_release_key`, `source_modified_at`, `retrieved_at`, `ingest_completed_at`, `transformation_version`, `source_record_locator`

**`facilities.csv`**

| Column | Warehouse origin | Include |
|--------|------------------|---------|
| `ccn` | `provider_identifier.identifier_value` | YES — PK |
| `provider_name` | `facility_snapshot.provider_name` | YES |
| `legal_business_name` | `facility_snapshot.legal_business_name` | YES |
| `address` | `facility_snapshot.address` | YES |
| `city` | `facility_snapshot.city` | YES |
| `state_code` | `facility_snapshot.state_code` | YES |
| `zip_code` | `facility_snapshot.zip_code` | YES |
| `county_name` | `facility_snapshot.county_name` | YES |
| `telephone` | `facility_snapshot.telephone` | OPTIONAL — CMS-public; strip if counsel prefers |
| `ownership_type` | `facility_snapshot.ownership_type` | YES |
| `certified_beds` | `facility_snapshot.certified_beds` | YES |
| `participates_medicare` | `facility_snapshot.participates_medicare` | YES |
| `participates_medicaid` | `facility_snapshot.participates_medicaid` | YES |
| `participation_type` | `facility_snapshot.participation_type` | YES |
| `source_latitude` | `facility_snapshot.source_latitude` | YES — CMS coordinates only |
| `source_longitude` | `facility_snapshot.source_longitude` | YES — CMS coordinates only |
| `overall_rating` | `facility_snapshot.overall_rating` | YES — CMS 1–5, nullable |
| `health_inspection_rating` | `facility_snapshot.health_inspection_rating` | YES |
| `staffing_rating` | `facility_snapshot.staffing_rating` | YES |
| `quality_measure_rating` | `facility_snapshot.quality_measure_rating` | YES |
| `attributes` jsonb | `facility_snapshot.attributes` | **NO** — residual blob |
| `raw_record` | `facility_snapshot.raw_record` | **NO** |
| `location` geography | `facility_snapshot.location` | **NO** — use lat/long columns |
| `provider_id` uuid | `provider.id` | **NO** as public ID |

**`facility_inspections.csv`:** `inspection_event_key` ← `event_key`; `ccn`; `survey_date`; `survey_type`; `survey_cycle`; `processing_date`; provenance. Exclude `raw_record`, UUIDs.

**`facility_deficiencies.csv`:** `deficiency_finding_key` ← `finding_key`; `ccn`; `inspection_event_key` (nullable FK); `survey_date`; `survey_type`; `inspection_cycle`; `deficiency_prefix`; `deficiency_tag`; `deficiency_category`; `official_description`; `scope_severity_code`; `deficiency_corrected`; `correction_date`; `standard_deficiency`; `complaint_deficiency`; `infection_control_deficiency`; `citation_under_idr`; `citation_under_iidr`; `processing_date`; provenance. Exclude `raw_record`.

**`facility_enforcement.csv`:** `penalty_key`; `ccn`; `penalty_date`; `penalty_type`; `fine_id`; `fine_amount`; `payment_denial_start_date`; `payment_denial_days`; `processing_date`; provenance. Exclude `raw_record`.

**`facility_chains.csv`:** `cms_chain_id` (CMS text id, not uuid); `chain_name`; `ccn`; `enrollment_id`; provenance. Do **not** recompute CMS chain performance metrics as TrustHub scores. `cms_chain_performance_snapshot.metrics` jsonb stays out of open V1.

**`facility_ownership.csv` (org-only draft):** `relationship_key`; `ccn`; `party_kind` (must equal `organization`); `party_display_name`; `relationship_role_code`; `relationship_role_text`; `association_date`; `ownership_percentage`; provenance. Exclude `raw_record`, individual rows, SSN/NPI beyond CMS public columns if present in raw.

**`facility_ownership_changes.csv`:** `event_key`; `ccn`; `change_type_code`; `change_type_text`; `effective_date`; provenance. Buyer/seller **organization names** are REVIEW_REQUIRED. Do not add TrustHub “successor guilt” language.

**`facility_staffing_quarters.csv` (optional):** `ccn`; `source_quarter`; `coverage_start`; `coverage_end`; `days_represented`; `positive_census_days`; `zero_census_days`; `missing_census_days`; `census_sum`; hour sums; HPRD measures; `contract_nurse_share`; `zero_reported_rn_days`; `formula_version` (`pbj-quarter-ratio-of-sums-v1`); provenance. **Not** daily hours.

**`sources.csv`:** dataset key, CMS identifier, official name, official landing URL, `release_key`, dates, `content_sha256`, transformation version, `rows_read` / `valid_rows` / `rejected_rows`, ingest completed_at.

### 3.4 Explicitly out of the first academic package

| Class | Reason |
|-------|--------|
| Google Places / website / place_id / identity candidates | Commercial ToS; 001B.1 OUT_OF_SCOPE |
| Family workspace, interviews, trust-request user content | Possible consumer PII |
| Assisted living tables | Not the CMS CCN universe |
| `pbj_staffing_day` | Employee-hour grain; 5.28M rows; CONTROLLED_ONLY |
| `facility_history_event` | Derived, not source-native |
| `published_state_claim` and state enforcement overlays | Uneven CA/NY/TX; state terms; named administrators |
| `facility_claim.confidence`, matcher features, review queues | Not ground truth; attack surface |
| `raw_record` / `raw_object` storage keys | Operational bulk |
| Internal UUIDs as public PKs | Use CCN + source event keys |
| Secrets / credentials | Never |
| MDS quality-measure file `djen-97ju` | Not ingested |

---

## 4. Freeze decision (still not a publication)

| Question | Decision |
|----------|----------|
| Flagship dataset | TrustHub Senior Regulatory Research Dataset |
| Canonical ID | CMS CCN |
| Snapshot vintage | Provider Information **2026-07-29** (retrieved 2026-08-14) |
| Publish now? | **NO** |
| DOI now? | **NO** |
| `/academic` download? | **NO** (`downloadHref` remains null) |
| Open V1 core | facilities (with stars) + inspections + deficiencies + enforcement + chains + sources |
| Ownership | org-only draft; 246,020 named individuals held |
| Staffing quarters | optional; daily excluded |
| State / history / Google / AL / workspace | excluded from open V1 |

001B.2B (not this task) would be extract engineering after counsel — not authorized here.

---

## 5. Network V2 / evidence rules respected

- CMS stars are CMS methodology, not a TrustHub score.
- Missing CMS values stay null.
- Inspections and deficiencies are government event files with join gaps.
- Ownership is PECOS / CMS disclosure, not independent beneficial-owner proof.
- Provider Information is **currently active** homes only.
- One snapshot release ≠ longitudinal ratings.
- State overlays are not national.
- Original regulator remains the source of the records.
