# TrustHub Senior Regulatory Research Dataset (Academic V1)

**Status:** Documentation freeze. **No public files. No DOI. License pending counsel.**  
**Proposed package id:** `trusthub-senior-regulatory-v2026.07.29`  
**Canonical entity:** CMS-certified nursing facility  
**Canonical identifier:** CMS CCN (six characters)  
**Warehouse vintage recounted:** 2026-08-21 (SELECT-only)

This README describes a **future** immutable research snapshot. It is not a download page.

---

## What this dataset is

An organized, versioned extract of **government CMS nursing-home files** already stored in SeniorTrustHub:

- currently active facilities (identity, location, participation, beds)
- CMS Five-Star ratings as CMS published them on that snapshot
- inspection events, health deficiencies, and penalties as event records
- CMS chain membership
- source vintages, retrieval times, and source-file checksums

Researchers can study public regulatory records without treating SeniorTrustHub as a placement service or a scoring bureau.

---

## What this dataset is not

- Not a live feed or a substitute for [data.cms.gov](https://data.cms.gov/)
- Not a longitudinal **facility-rating panel** (there is one Provider Information snapshot)
- Not a TrustHub quality score, ranking, or “risk index”
- Not a complete history of harm, closures, or every enforcement action ever taken
- Not independent proof of beneficial ownership
- Not assisted living
- Not state-regulator overlays (CA/NY/TX)
- Not Google or other commercial enrichment
- Not family-workspace or consumer PII
- Not daily Payroll-Based Journal microdata
- Not personal owner/manager name files

---

## Event history vs successive dataset snapshots

These are different clocks. Mixing them up will produce invalid papers.

**EVENT HISTORY**  
A date that CMS records as when something **occurred** (survey date, penalty date). Inspection, deficiency, and penalty tables are event history **within the window CMS published in that file**.

**SUCCESSIVE DATASET SNAPSHOTS**  
A date that records when CMS **published or modified a current-status file**, and when TrustHub retrieved it. Provider Information and its star ratings are a **single current snapshot** (release key `2026-07-29`). CMS overwrites “current” facilities and stars in later monthly files. TrustHub can keep successive snapshots later; this first freeze has **one**.

Therefore: inspection dates going back to 2016 do **not** make the first release a longitudinal ratings panel. Derived facility-history rating-change events in the warehouse are **0** for that reason.

---

## Research use cases (descriptive / associational)

1. How inspection and deficiency rates vary by state after normalizing by certified beds.
2. Whether CMS-published chain membership is associated with penalty recurrence (association only).
3. What share of deficiencies do not join to an inspection event, and whether that varies by survey type.
4. How CMS star dimensions co-move with contemporaneous deficiency severity codes (without treating stars as TrustHub scores).
5. Geography of payment denials versus fines inside the CMS penalty window.
6. What is lost if only the live CMS website is used instead of a frozen extract.

Causal designs need their own identification strategy. This package does not supply one.

---

## Files (Open V1, after counsel and extract)

| File | Grain | Live warehouse rows |
|------|-------|--------------------:|
| `data/facilities.csv` | one current CCN | 14,693 |
| `data/facility_ratings.csv` | one CCN × rating snapshot | 14,693 |
| `data/facility_inspections.csv` | one survey event | 149,705 |
| `data/facility_deficiencies.csv` | one citation | 418,344 |
| `data/facility_enforcement.csv` | one fine or payment denial | 16,166 |
| `data/facility_chains.csv` | one chain membership | 10,231 |
| `data/sources.csv` | one ingest vintage | small |

Optional later: `facility_staffing_quarters.csv` (HOLD). Ownership, CHOW, state overlays, assisted living, daily PBJ: out.

Normative columns: `FIELD-FREEZE.md`. Dictionary: `DATA-DICTIONARY.md`.

---

## How files join

```
facilities.ccn
    ← facility_ratings.ccn
    ← facility_inspections.ccn
    ← facility_deficiencies.ccn
    ← facility_enforcement.ccn
    ← facility_chains.ccn

facility_inspections.academic_inspection_id
    ← facility_deficiencies.academic_inspection_id  (nullable)
```

`sources` joins on `source_dataset_key` + `source_release_key` + `transformation_version`.

---

## Coverage

- Geography: U.S. CMS-certified nursing homes in the current Provider Information file (all states/territories CMS includes).
- Facilities: **14,693** CCNs; **0** duplicate current CCNs.
- Ratings missingness: overall 132 null; staffing 202 null; quality-measure 203 null.
- Inspections: every current CCN has ≥1 inspection row in this vintage; dates 2016-07-28–2026-06-26.
- Deficiencies: 14,629 facilities; 64 current CCNs have none; dates 2017-03-23–2026-06-22.
- Penalties: 6,844 facilities; dates 2023-07-17–2026-06-11 (CMS published window, not all-time).
- Chains: 10,116 facilities with a membership.

---

## Named-facility policy

Open V1 as drafted **names facilities** using CMS provider name, legal business name, and address, keyed by CCN. That is a **counsel question** (`COUNSEL-REVIEW.md` item D), not a publication decision. Telephone is **hold**. Individual persons are **out**.

No consumer, resident, family, or employee PII is in scope.

---

## Versioning

`trusthub-senior-regulatory-vYYYY.MM.DD` is tied to the Provider Information `source_modified_at` date. A later CMS month is a **new version**. Never overwrite `v2026.07.29` in place.

`release_date` / `extract_completed_at` are assigned only when files are actually cut. They are **unassigned** now.

---

## Citation (placeholder)

```
TrustHub Research Data. TrustHub Senior Regulatory Research Dataset. Version trusthub-senior-regulatory-v2026.07.29. [release date unassigned]. DOI: [when assigned].
```

Cite **CMS** as the source of the records. Cite TrustHub only for organization, schema, and this documentation. **DOI: not assigned.**

---

## License

**Pending counsel.** No CC BY 4.0 (or any other) license is selected.

---

## Companion documents

- `DATA-DICTIONARY.md`
- `FIELD-FREEZE.md`
- `SOURCES.md`
- `LIMITATIONS.md`
- `MANIFEST-SPEC.md`
- `COUNSEL-REVIEW.md`
- `docs/ACADEMIC-001B2A-SENIOR-SNAPSHOT-FREEZE.md` (live counts, comparison, release gate)
