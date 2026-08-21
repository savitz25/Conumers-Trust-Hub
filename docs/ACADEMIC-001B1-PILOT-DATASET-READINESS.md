# Academic 001B.1 — Pilot dataset readiness audit

**Status:** Read-only audit. No academic dataset published.  
**Date:** 2026-08-21  
**Ask HEAD at start:** `5601d7d` (Academic 001A)  
**Compatibility:** Stays inside Academic 001A contracts (`docs/ACADEMIC-RESEARCH-PROGRAM.md`, `docs/ACADEMIC-DATASET-RELEASE-STANDARD.md`, `docs/ACADEMIC-ENTITY-RESOLUTION-BENCHMARK.md`, Network V2). `/academic` is not redesigned.

**Guardrails this task:** production writes 0 · Google Places requests 0 · public downloads 0 · universities contacted 0.

Counts below that are **exact** are copied from specialist-repo documentation of independent read-only checks. They are **not** a live recount performed in 001B.1. Where a live warehouse could have moved, 001B.2 must re-count before freeze.

---

## A. Executive decision

| Flagship | Recommendation |
|----------|----------------|
| **Public policy / consumer protection** — SeniorTrustHub CMS nursing-facility regulatory snapshot | **GO WITH CONDITIONS** |
| **Data science / AI** — TrustHub Entity Resolution Benchmark (Move + Contractor) | **GO WITH CONDITIONS** |

**Why Senior first:** canonical CCN identity, official CMS monthly/quarterly files already ingested with provenance (`retrieved_at`, `source_modified_at`, ingest run, SHA-256 on source bytes), event-level inspections/deficiencies/penalties, ownership graph, chain membership, and documented limitations. This is the strongest research-grade warehouse in the network.

**Why ER is not “GO” unconditional:** Move and Contractor contain **excellent candidate pools** (USDOT/MC vs legal/DBA; multi-state licenses vs DBA/legal name) but **almost no hand-verified MATCH/NON_MATCH labels**. Auto-labeling from name similarity or `confidence` scores would violate the 001A ground-truth standard.

**001B.2 should not publish.** It should freeze a Senior extract specification, re-count live tables, draft dictionaries, assemble a counsel packet, and define a 250–500 case **review protocol** (not a 10k auto-label dump).

---

## B. Senior V1 readiness

Canonical identity: **CMS CCN** (six-character). Confirmed in schema (`provider_identifier` issuer `CMS`, type `CCN`) and public routes `/facility/cms/[ccn]/[slug]`. Slug is presentation only.

**Canonical facility count (documented exact):** **14,693** unique CMS CCNs / providers / current facility snapshots.

Source of that number: Care Trust Hub `docs/task-014a-environment-connectivity-validation.md` (independent read-only REST + sitemap) and restated through `docs/task-015c-state-regulatory-publication.md` and `docs/task-016-facility-history.md`. **Live 001B.1 warehouse recount: not performed.**

### Category classification

| Category | Classification | Notes |
|----------|----------------|-------|
| Facility identity (CCN, names, address, beds, participation) | **READY** | `facility_snapshot` + `provider_identifier`; CMS Provider Information `4pq5-n9py` |
| Facility location (CMS lat/long) | **READY** | CMS-published coordinates only |
| Ratings (CMS 1–5 stars) | **READY** | Current-release snapshot columns; **not** a TrustHub score |
| Health inspections | **READY** | `inspection_event`; CMS `svdt-c123` |
| Deficiencies | **READY** | `deficiency_finding`; CMS `r5ix-sfxw`; 30,374 findings with null inspection link (documented) |
| Penalties / enforcement | **READY** | `penalty_enforcement`; CMS `g6vv-u9sr` |
| Staffing / PBJ **daily** | **CONTROLLED_ONLY** / later | `pbj_staffing_day` is large employee-hour grain; exclude from open V1 |
| Staffing / PBJ **quarter summaries** | **READY_WITH_TRANSFORMATION** | `pbj_staffing_quarter_summary` (57,873 documented); HPRD is a documented ratio-of-sums, not a CMS star |
| Ownership relationships | **READY_WITH_TRANSFORMATION** | `provider_ownership_relationship` (674,063 documented); includes individual parties — counsel on named persons |
| Ownership changes (CHOW) | **READY_WITH_TRANSFORMATION** | `ownership_change_event`; row count **NOT VERIFIED** in 001B.1 (derived history has 5,173 ownership events) |
| Chains | **READY** | `cms_chain` + `cms_chain_provider` (10,231 memberships documented) |
| State license overlays (CA/NY/TX) | **CONTROLLED_ONLY** for V1 | VERIFIED field-level claims only; uneven states; not national |
| State inspection/enforcement overlays | **NOT_READY** for open V1 | Task 017 exists; do not treat as national |
| Facility history timeline | **READY_WITH_TRANSFORMATION** | Derived `facility_history_event` (147,396 documented); not a source table |
| Source provenance / timestamps | **READY** | `source_release`, `ingest_run`, `raw_object` SHA-256 |
| Google Places enrichment | **OUT_OF_SCOPE** | Explicitly excluded from first academic dataset |
| Assisted living | **OUT_OF_SCOPE** | Separate state adapters; not CMS CCN universe |
| Consumer family workspace / interviews | **OUT_OF_SCOPE** | Possible PII / user content |

### Longitudinal value (do not overclaim)

| Source | Event-level vs snapshot | Historical state | Retrieval / ingest timestamps | Academic implication |
|--------|-------------------------|------------------|-------------------------------|----------------------|
| Provider Information (`4pq5-n9py`) | **Current snapshot** of active homes | Overwritten by later CMS monthly file; TrustHub stores immutable **releases** if multiple loads exist. Task 016 notes **one snapshot release** → **0 rating-change events** | `source_modified_at`, `retrieved_at`, `ingest_completed_at` | Successive TrustHub snapshots become longitudinal **only after a second frozen release**. One extract is a cross-section. |
| Inspection dates | **Event history** (`survey_date`) | Event rows retained per release | Yes | True event panel **within the CMS file window**, plus release provenance |
| Deficiencies | **Event history** (`survey_date`) | Retained | Yes | Event panel; join to inspections is incomplete by design |
| Penalties | **Event history** (`penalty_date`) | Retained | Yes | Event panel |
| PBJ | Daily events + quarter summaries; CMS keeps **fixed quarterly versions from 2017 Q1** | Daily grain is historical; quarter file is a vintage | Yes | Strongest CMS-native longitudinal staffing series; too large/sensitive for open V1 daily |
| Ownership “current” file | CMS describes as **current** ownership | Disappearance in a later current file **does not** auto-end-date (Care docs) | Yes | Treat as current-as-of-release, not a complete owner history |
| CHOW | **Event** (`effective_date`, on/after 2016-01-01 per CMS) | Cumulative events | Yes | True event history for recorded CHOWs |
| Facility history view | **Derived** mix of occurred vs reported_in_release | Fingerprinted | Yes | Cite as derived (`facility-history-v1`), not CMS-native |

**Distinction:** an inspection `survey_date` of 2019 is event history. A single 2026 Provider Information load is **not** a longitudinal facility panel.

---

## C. Senior proposed table package (do not extract yet)

**Package name (proposed):** `trusthub-senior-regulatory-vYYYY.MM.DD`  
**Format:** CSV for all V1 tables. Optional Parquet twins for `facility_deficiencies` and `facility_ownership` if file size warrants.  
**Named facilities:** **yes** (public CMS facility names / CCN). Individual owner names: **hold for counsel** (see E).

| Table | PK | Grain | Documented row count | Source authority | Include in open V1? |
|-------|----|-------|----------------------|------------------|---------------------|
| `facilities.csv` | `ccn` | one current CMS-active nursing home | **14,693** | CMS `4pq5-n9py` | Yes |
| `facility_ratings.csv` | `ccn` + `source_release_id` | current-release stars | **14,693** | same | Yes (or columns on facilities) |
| `facility_inspections.csv` | `inspection_id` | one CMS survey event | **149,705** | CMS `svdt-c123` | Yes |
| `facility_deficiencies.csv` | `deficiency_id` | one citation row | **418,344** | CMS `r5ix-sfxw` | Yes |
| `facility_enforcement.csv` | `penalty_id` | one fine or payment denial | **16,166** | CMS `g6vv-u9sr` | Yes |
| `facility_ownership.csv` | `relationship_id` | one disclosed owner/manager row | **674,063** | CMS Ownership / All Owners | **Conditional** — org rows first; individuals until counsel |
| `facility_ownership_changes.csv` | `change_id` | one CHOW/acquisition/consolidation | **NOT VERIFIED** (derived ownership events = 5,173) | CMS CHOW | Yes if live count exists |
| `facility_chains.csv` | (`chain_id`,`ccn`,`source_release_id`) | current CMS chain membership | **10,231** memberships | CMS chain / enrollments | Yes |
| `facility_staffing_quarters.csv` | (`ccn`,`source_quarter`,`source_release_id`) | quarter summary | **57,873** | CMS PBJ (aggregated) | **Optional V1** / V1.1 |
| `sources.csv` | `source_release_id` | one immutable CMS file | small | CMS catalogs | Yes |
| `facility_history_derived.csv` | `event_id` | derived timeline | **147,396** | TrustHub derivation | **Controlled** or V1.1 — not source-native |

**FK:** all facility tables → `facilities.ccn`. Deficiencies optionally → `facility_inspections.inspection_id` (nullable). Ownership → `ccn`. Chains → `ccn`.

**Required provenance columns on every row:** `source_dataset_id`, `source_release_key`, `source_modified_at`, `retrieved_at`, `ingest_completed_at`, `transformation_version`, `source_record_locator`.

**Limitations to ship in README:** missing CMS values ≠ clean record; inspections≠complete history of harm; 30,374 deficiencies unlinked to an inspection event; ownership is CMS-published disclosure not independent beneficial-owner proof; Provider Information is active homes only; stars are CMS methodology, not TrustHub scores.

---

## D. Source / reuse review matrix

Not legal conclusions.

| Source | Public download? | TrustHub transform? | Classification | Reason |
|--------|------------------|---------------------|----------------|--------|
| CMS Provider Information `4pq5-n9py` | Yes — data.cms.gov | Normalize + CCN identity | **LIKELY_OPEN_PUBLIC_SOURCE** | U.S. government public dataset; still **counsel** on redistribution packaging and named facilities |
| CMS Inspection Dates `svdt-c123` | Yes | Deterministic event keys | **LIKELY_OPEN_PUBLIC_SOURCE** | Same |
| CMS Health Deficiencies `r5ix-sfxw` | Yes | Keys + scope/severity decode of official A–L | **LIKELY_OPEN_PUBLIC_SOURCE** | Same; resident-harm *codes* are official, not resident PII |
| CMS Penalties `g6vv-u9sr` | Yes | Typed fines / denials | **LIKELY_OPEN_PUBLIC_SOURCE** | Same |
| CMS Ownership / All Owners | Yes | Graph + party split | **REVIEW_REQUIRED** | Includes **individual** owner/manager names from PECOS self-report |
| CMS CHOW | Yes | Event extract | **REVIEW_REQUIRED** | Named buyer/seller orgs; successor language |
| CMS Chain performance / membership | Yes | No TrustHub recalculation of CMS metrics | **LIKELY_OPEN_PUBLIC_SOURCE** | Chain ID is CMS grouping, not TrustHub scoring |
| CMS PBJ daily | Yes | Daily store + HPRD | **REVIEW_REQUIRED** / **DO_NOT_RELEASE_YET** for open V1 | Size; employee/contract hour grain; census |
| State CA/NY/TX directories | State-specific | Resolver V2 claims | **REVIEW_REQUIRED** | State terms; VERIFIED subset only; not national |
| Google Places cache | Commercial ToS | Identity corroboration | **DO_NOT_RELEASE_YET** | Not government; 001B.1 forbids first open set |
| Assisted living state files | State-specific | Separate tables | **DO_NOT_RELEASE_YET** | Out of CCN flagship |

Every LIKELY_OPEN row still needs counsel on **bulk redistribution, attribution, and named-business analysis**.

---

## E. Excluded fields (open V1)

| Field / class | Why |
|---------------|-----|
| Consumer / resident PII | Program charter; none should be in CMS facility files, but do not join consumer complaints or family workspace |
| Employee-level PBJ Employee Detail | Not acquired; out of scope |
| `pbj_staffing_day` hours by role | Open V1 exclusion; staff-time grain |
| Google website/phone/place_id | Commercial enrichment |
| `REVIEW_REQUIRED` identity candidates | Not ground truth |
| Internal matcher confidence / resolver features | Attack surface |
| `raw_record` JSON blobs | Operational bulk; may duplicate unused fields |
| Storage keys, checksums of internal objects, DB UUIDs as public IDs | Use CCN + documented event keys |
| Secrets / credentials | Never |
| Personal owner SSN/NPI beyond CMS public columns | If present in raw, strip |
| Family interview / workspace content | User data |
| Telephone on facilities | CMS-published facility phone is public; still optional strip if counsel prefers |

**Default:** government/public CMS columns only.

---

## F. Move benchmark readiness

Inspected: `savitz25/Move-trust-Hub` identity-review artifacts (read-only JSON in `docs/`).

| Item | Documented exact | Meaning for labels |
|------|------------------|--------------------|
| Companies after federal HHG identity-review pilot (`task-008b-identity-review-pilot.json`) | **4,021** | Candidate identity records |
| Indexable | **3,985** | Product universe |
| `review_required` overlay rows in that run | **4,427** | **Candidates, not labels** |
| Pilot sample drawn | **200** | Stratified by state/role/name |
| `RESOLVED_DISTINCT` | **1** | Only this is close to a verified NON_MATCH-style outcome |
| `REMAIN_REVIEW_REQUIRED` | **188** | Unresolved |
| Other pilot outcomes (franchise, successor, legal conflict) | **11** combined | Not binary MATCH |

FMCSA L&I (`data.transportation.gov/6eyk-hxee`) supplies **USDOT, MC, legal name, DBA, city/state, carrier vs broker** — excellent **features** for cases.

**There is not a verified MATCH/NON_MATCH label file.** Name-similar USDOT pairs and van-line brands were queued for review, not confirmed. Google was **not** used in 008b (`google_places_requests: 0`).

**Classification:** candidate generation **READY**; ground-truth labels **NOT_READY**.

Older `task-001-provider-universe-audit.json` (468 companies) is a **prior** universe and must not be mixed with the 4,021 count.

---

## G. Contractor benchmark readiness

Inspected: `savitz25/contractor-trust-hub` schema + load docs.

**Identity structure (real):** `licenses` (board `external_key`, legal/DBA names, location) optionally linked to `contractors` shells and `entities` via `contractor_entities` (`match_method`, `confidence`). Discipline links only on exact license-number match.

**Documented license counts (production snapshots in repo docs — not a 001B.1 live SQL):**

| Source | Date in docs | Count | Exact? |
|--------|--------------|------:|--------|
| NJ DCA (`nj_dca`) | 2026-08-03 | **87,355** | Exact in `LOAD_PATH.md` / `NEW_JERSEY_VERIFY_V1.md` |
| CA CSLB | 2026-08-13 | **43,779** | Exact in load snapshot |
| AZ ROC Active | 2026-08-13 | **58,199** | Exact in load snapshot |
| NV | docs | **19,120** | Exact in `DATA_SOURCES_NV.md` |
| OK CIB roofing | 2026-08-14 | **5,415** | Exact |
| FL DBPR | loader “expected” | **~143,516** | **NOT VERIFIED** (labeled approximate) |
| Canonical `contractors` rows | — | **NOT VERIFIED** | One shell per license in several loaders — not independently counted here |
| Verified MATCH pairs | — | **NOT VERIFIED / none found** | `confidence >= 0.90` is a **linker rule**, not a benchmark label |

Network V2: do **not** claim identical coverage in every state.

**Classification:** multi-state license **features** READY; **labels NOT_READY**. Same license number across rows can be deterministic **same-credential** (trivial). Cross-state “same firm” needs official FEI/entity key or manual review — NJ loader already forbids name-only entity joins.

---

## H. Benchmark ground-truth model

**Schema (future file, not published):**

```
benchmark_case_id
vertical                  -- move | contractor
source_a_system
source_a_identifier
source_a_name
source_a_city
source_a_state
source_b_system
source_b_identifier
source_b_name
source_b_city
source_b_state
label                     -- MATCH | NON_MATCH | AMBIGUOUS
label_confidence          -- HIGH | MEDIUM  (reviewer agreement)
review_method
reviewer_count
evidence_types            -- identifier, official_dba, successor_filing, ...
difficulty                -- easy | hard
case_type
notes_public
snapshot_version
```

**Labels:** `MATCH` | `NON_MATCH` | `AMBIGUOUS`.  
**Case types:** `LEGAL_NAME_DBA` | `NAME_VARIATION` | `ADDRESS_CHANGE` | `SUCCESSOR_ENTITY` | `COMMON_NAME_COLLISION` | `MULTI_LICENSE_ENTITY` | `BROKER_CARRIER_RELATIONSHIP` | `CROSS_STATE_ENTITY` | `DUPLICATE_SOURCE_RECORD` | `FALSE_POSITIVE_TRAP`.

**Acceptable evidence for MATCH/NON_MATCH:**

- Shared regulator identifier (same USDOT; same board license key)
- Official filing linking names (published DBA on the same USDOT/MC row)
- Regulator successor/predecessor or CHOW-style official record
- Shared official entity key (e.g. FEI) **documented in source**, not inferred
- Dual independent human review of **authoritative** pages

**Not evidence:** name similarity, address similarity alone, Google similarity, TrustHub confidence scores, unresolved `REVIEW_REQUIRED`.

Keep `AMBIGUOUS` rather than forcing a binary label. **Do not publish reviewer names.**

---

## I. Proposed benchmark pilot size / sample

**400 cases** (inside 250–500). **Do not auto-label 10,000.**

| Stratum | n (approx.) | Source |
|---------|-------------|--------|
| Easy MATCH (same USDOT, legal vs DBA attribute pair **or** identical license key) | 80 | Move FMCSA rows with both legal+DBA; Contractor duplicate-safe keys |
| Hard MATCH (successor / multi-license / dual authority) | 60 | Only if official evidence exists; else skip |
| True NON_MATCH (same name, different USDOT **and** reviewer confirms distinct) | 100 | Move `SAME_NAME_DIFFERENT_LOCATION` queue + manual FMCSA check |
| Common-name collisions / franchise brands | 40 | Move van-line queue; treat most as AMBIGUOUS unless filings prove |
| Cross-state contractor candidates | 80 | Same FEI or identical license string **or** AMBIGUOUS |
| Ambiguous holdouts | 40 | Explicit AMBIGUOUS |

**Sampling:** stratified draw from existing **queues** (Move 4,427 review population; Contractor multi-key licenses), then **human protocol** against FMCSA SAFER / state board pages. Round-robin states as in Move 008b. Dual review on 20% overlap for agreement.

---

## J. Exact verified counts (and NOT VERIFIED)

### Senior (documented independent REST / task docs; not 001B.1 live SQL)

| Object | Count | Status |
|--------|------:|--------|
| Canonical providers / CMS CCNs / current snapshots | **14,693** | Exact in 014A / 015C / 016 |
| Inspections | **149,705** | Exact in 014A |
| Deficiencies | **418,344** | Exact in 014A |
| Penalties | **16,166** | Exact in 014A and 016 enforcement events |
| Staffing quarter summaries | **57,873** | Exact in 014A / 014B |
| Ownership relationships | **674,063** | Exact in 014A / 014B |
| Chain memberships | **10,231** | Exact in 014A |
| Unresolved ownership rows (014B) | **109,612** then **107,959** after CCN pad | Exact in 014B (internal link quality, not a release table) |
| Derived facility-history events | **147,396** | Exact in 016 |
| Derived rating-change events | **0** | Exact in 016 (single snapshot release) |
| CA / NY / TX published state license IDs | **1,158 / 515 / 1,134** facilities | Exact in 015C |
| `ownership_change_event` table | — | **NOT VERIFIED** |
| `pbj_staffing_day` | — | **NOT VERIFIED** (expected large) |
| Assisted living canonical providers | **15,047** in 021B | Out of scope for CCN flagship |

### Move

| Object | Count | Status |
|--------|------:|--------|
| Federal HHG companies (008b) | **4,021** | Exact in 008b JSON |
| Identity-review candidates | **4,427** | Exact |
| Hand-resolved distinct | **1** | Exact |
| Verified MATCH labels | **0** | None found |

### Contractor

| Object | Count | Status |
|--------|------:|--------|
| NJ licenses | **87,355** | Exact (2026-08-03 snapshot) |
| CA licenses | **43,779** | Exact (2026-08-13) |
| AZ licenses | **58,199** | Exact (2026-08-13) |
| NV licenses | **19,120** | Exact in data-sources doc |
| OK roofing | **5,415** | Exact (2026-08-14) |
| FL licenses | ~143,516 expected | **NOT VERIFIED** |
| Canonical contractors | — | **NOT VERIFIED** |
| Benchmark-ready verified pairs | — | **NOT VERIFIED** (none as labels) |

---

## K. Research questions enabled

### Senior Academic V1 (descriptive / associational — **not** causal unless a later design supports it)

1. How do CMS inspection and deficiency rates vary by state after normalizing by certified beds?
2. Do CMS-published chain affiliations correlate with penalty recurrence (association only)?
3. How concentrated is disclosed ownership (party counts, PAC reuse) across facilities?
4. What share of deficiencies cannot be joined to an inspection event, and does that vary by survey type?
5. How do CMS star dimensions co-move with contemporaneous deficiency severity (A–L), without treating stars as a TrustHub score?
6. What is the geography of payment-denial events versus fines?
7. How much of “current ownership” is PECOS self-report vs independently verified (documented limitation study)?
8. (If staffing quarters included) How do PBJ HPRD quarter summaries co-vary with health-inspection ratings **associationally**?
9. How does a single CMS monthly snapshot differ from event files spanning many survey years (cross-section vs event history)?
10. What information would be lost if only the live CMS website were used instead of a frozen extract?

### ER Benchmark (once labels exist)

1. Deterministic identifier baseline (same USDOT / same license key).
2. Fuzzy name baseline vs identifier baseline (precision/recall).
3. DBA handling: does using DBA raise recall without collapsing franchises?
4. Calibration of any model-produced confidence vs empirical match rate.
5. False-positive rate on common-name / van-line traps.
6. Cross-state contractor identity when FEI is present vs absent.
7. Carrier vs broker pairs: relationship ≠ identity MATCH.
8. Effect of address features with identifier held out (should remain weak).
9. Human-agreement rate on dual-reviewed subset.
10. Cost of forcing binary labels vs retaining AMBIGUOUS.

---

## L. Version / release architecture

| Asset | Version string |
|-------|----------------|
| Senior snapshot | `trusthub-senior-regulatory-vYYYY.MM.DD` (freeze = CMS `source_modified_at` date of Provider Information plus extract date) |
| ER benchmark | `trusthub-entity-resolution-benchmark-v1.0` |

Each future freeze includes: frozen files, SHA-256 checksums, manifest, schema, data dictionary, README, source register, limitations, license **status** (pending counsel until assigned), citation file (template until DOI), changelog.

**DOI:** none. Template remains: `TrustHub Research Data. [Title]. Version X. [Release date]. DOI: [when assigned].`

**Access recommendation:** Senior CMS core tables → aim **OPEN** after counsel. Ownership individual names and derived history → **CONTROLLED** until review. ER labels → **OPEN** (no secrets) after protocol; Move/Contractor **source dumps** stay out of the benchmark zip.

---

## M. Risks requiring counsel

- Bulk redistribution of CMS Provider Data and PBJ
- Named nursing facilities in an academic zip vs linking to data.cms.gov
- Individual owner/manager names in All Owners
- CHOW successor language (defamation / interference if over-claimed)
- State directory terms (CA/NY/TX) if later added
- FMCSA / state contractor bulk terms if ER sampling copies rows into a public file
- FCRA-adjacent misuse (not the primary risk here, but disclaimer)
- Review window in future university agreements (factual/legal ≠ veto)

No legal conclusions in this audit.

---

## N. Recommendation for Academic 001B.2

**Do not publish. Do not DOI. Do not outreach.**

Exact 001B.2 scope:

1. **Live read-only recount** of Senior tables listed in J (SQL `COUNT(*)` only; no mutation; no Google).
2. **Freeze spec** (field lists) for `facilities`, `inspections`, `deficiencies`, `enforcement`, `chains`, `sources` (+ ownership **org-only** draft).
3. **Counsel packet:** CMS URLs, dictionaries, proposed README limitations, named-facility question.
4. **ER protocol doc:** 400-case sampling frame, dual-review worksheet, evidence codes — **zero auto labels**.
5. Optionally add an Ask-only registry note that Senior + ER remain `PLANNED` / `DOCUMENTATION` (no `/academic` redesign required).

---

## Decision required (explicit)

**PUBLIC POLICY FLAGSHIP (Senior CMS CCN universe): GO WITH CONDITIONS**

Conditions: live recount; exclude Google, PBJ daily, assisted living, unresolved identity claims; ownership individuals gated; counsel before any public zip.

**DATA SCIENCE BENCHMARK (Move + Contractor): GO WITH CONDITIONS**

Conditions: treat existing queues as **sampling frames**; require new hand labels; 400-case ceiling; no Google features; no confidence-score labels; keep AMBIGUOUS.

**Open vs controlled:** CMS facility/inspection/deficiency/penalty/chain → likely open after counsel. Individual ownership, PBJ daily, state overlays, derived history → controlled or later. Benchmark labels → open when they exist; raw specialist DBs → not released as the benchmark.
