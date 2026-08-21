# Academic 001B.2B — Senior Open V1 reproducibility and release integrity

**Status:** Internal dry-run **PASS**. Not published.  
**Date:** 2026-08-21  
**Starting Ask SHA:** `4ada13da40c4f059dfcd941a51094d2adba60c75`  
**001B.2A:** complete and frozen. Seven-table Open V1 scope **unchanged**.

Local artifacts (gitignored, not a research release): `data/academic-internal/001b2b/run-a/` and `run-b/`.  
Runner: `scripts/academic-001b2b-open-v1-extract.py` (SELECT-only, `COPY … TO STDOUT`, READ ONLY transaction).

---

## Guardrails

| Check | Result |
|-------|--------|
| Production writes | **0** |
| Google Places API | **0** |
| Public CSV / downloadHref | **none** |
| DOI | **null** |
| Universities contacted | **0** |
| Registry status | remains **DOCUMENTATION** |
| snapshotDate | **null** |

---

## Dual extract

Generated twice from independent READ ONLY transactions. Same columns, same `ORDER BY` keys, same row counts, same bytes, same SHA-256.

| File | Rows | Bytes | SHA-256 (both runs) | Match |
|------|-----:|------:|---------------------|-------|
| facilities.csv | 14,693 | 5,488,193 | `0f80bd6de62d730564ef0752093d0aa0eb5cce50b893a3479cbbe24618c29500` | yes |
| facility_ratings.csv | 14,693 | 2,824,196 | `ce478ffb65e9c79a20386c44dff8d56000dd8ebdc78054e59bad8a35fa6adeae` | yes |
| facility_inspections.csv | 149,705 | 42,543,148 | `6dde19dc14340243fcb6e47a6a73cff39a938a3f760042b85c3e4ee834ab1e9d` | yes |
| facility_deficiencies.csv | 418,344 | 247,497,849 | `8508973f96c41675b7d3cef9b3d0ae15a06d9c10777fc9cbe3ab33fa9bdc6518` | yes |
| facility_enforcement.csv | 16,166 | 4,409,674 | `6dc59645b0f3dc7cd5002ff02914bedbccf33625f12e68a9b3d536ac152cbab1` | yes |
| facility_chains.csv | 10,231 | 2,226,916 | `3ff7813392d4b5c5bd663a6355b25aae8e2ad853820337b870079c76a005b0ac` | yes |
| sources.csv | 5 | 2,003 | `c6cbac583515977df54d9972fac631f04e3a6a463003deb7fac9b08c56e2fc35` | yes |

`sources.csv` contains only vintages that back the six fact tables (Provider Information, Inspection Dates, Health Deficiencies, Penalties, Enrollments/`cms-chain-membership-v1`). PBJ/ownership/state/AL source rows are not in Open V1.

---

## Integrity

| Gate | Result |
|------|--------|
| Duplicate primary keys | **0** |
| Unexplained foreign keys | **0** |
| Excluded-header / leak scan | **0** (no telephone, raw_record, Google, confidence, UUIDs) |
| Critical PII scan (SSN / email / Google place or URL) | **0 / 0 / 0** |
| Row counts vs 001B.2A freeze | **exact match** |

### Explained (not failures)

| Finding | Count | Why it is not a freeze defect |
|---------|------:|-------------------------------|
| Deficiencies with null `academic_inspection_id` | **30,374** | Documented incomplete CMS join; freeze expected this number |
| Chain membership CCNs not in current `facilities.csv` | **1,361** | SNF enrollments universe is not identical to the current CMS-active Provider Information list. Filtering would change the frozen **10,231** row count. Left in place. |

Telephone remains **hold** (not extracted). Ownership, daily PBJ, assisted living, state overlays, and Google fields were not extracted.

---

## Registry

`senior-cms-facility` stays **DOCUMENTATION**. `downloadHref` null. `doi` null. `snapshotDate` null. Internal hashes are **not** a public snapshot date.

---

## Next (not this task)

Counsel A–O remains unresolved. Do not publish. Do not begin ER benchmark review. A later 001C publication task would reuse this extract contract after counsel and license selection.
