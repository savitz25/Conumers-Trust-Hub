# Senior Academic V1 — known limitations

These limitations must ship with any future public package. They are research constraints, not a claim that the warehouse is empty or unused.

---

## Missing evidence does not imply absence of problems

A null CMS star, a CCN with no deficiency row, a CCN with no penalty row, or an unmatched inspection link means **the published file did not contain that evidence**, not that the facility is clean, safe, or uninspected in unlisted ways. Researchers must not recode nulls to zero or to a TrustHub “pass.”

---

## Provider Information is snapshot-oriented

CMS Provider Information (`4pq5-n9py`) is one row per **currently active** nursing home. Later monthly files overwrite public “current” identity, beds, participation, coordinates, and stars. This freeze has **one** Provider Information release (`2026-07-29`). It is **not** a successive snapshot panel.

Closed facilities that dropped out of the current file are not in `facilities.csv`.

---

## Inspections, deficiencies, and penalties are event history

`survey_date` and `penalty_date` are event times **inside CMS’s published file windows**, not TrustHub’s retrieval time.

| File | Min date | Max date | Note |
|------|----------|----------|------|
| Inspections | 2016-07-28 | 2026-06-26 | Not a complete history of every survey ever conducted |
| Deficiencies | 2017-03-23 | 2026-06-22 | CMS citation window as published |
| Penalties | 2023-07-17 | 2026-06-11 | Short published window; not all-time U.S. penalties |

Do not treat these windows as comparable “all history since 2016.”

---

## Deficiency-to-inspection linking is not complete

Live vintage: **387,970** deficiencies linked; **30,374** with null inspection link. CMS does not publish a shared inspection identifier across files. SeniorTrustHub links only when CCN, survey date, cycle, and compatible survey type match uniquely. Ambiguous rows stay unmatched. That is a documented join limitation, not a load error to “fix” in the academic extract.

---

## Facility closure and history limitations

The Open V1 facility list is the current CMS-active set. It is not a closure registry, not a bed-history panel, and not the derived `facility_history_event` timeline (156,797 warehouse rows, **out** of Open V1). Rating-change derived events are **0** because only one snapshot exists.

---

## CMS ownership is disclosure, not beneficial-owner verification

CMS ownership / All Owners / PECOS self-report is **public disclosure**. It is not independent ultimate-beneficial-owner proof. Disappearance in a later current file does not automatically end-date a prior relationship. **Open V1 excludes the ownership graph** (674,063 relationships, including 453,390 individual-person rows).

---

## Chain membership semantics

`facility_chains.csv` is CMS Chain ID membership from enrollments. It is a CMS grouping, not a TrustHub-constructed system, not a quality score, and not proof that unaffiliated homes are independent operators. **671** chain records exist; **632** distinct chain IDs appear on memberships; **39** chain records have no membership in this vintage.

The enrollment / chain-membership universe is **not identical** to the current CMS-active Provider Information list. Of **10,231** chain rows, **1,361** CCNs are absent from `facilities.csv` (14,693 current homes). Those 1,361 rows were **not** deleted to force a foreign key. Researchers should `LEFT JOIN` chain memberships to facilities. Missing current-home attributes does not mean the chain record is invalid.

---

## CMS stars are CMS ratings, not TrustHub ratings

`overall_rating`, `health_inspection_rating`, `staffing_rating`, and `quality_measure_rating` are CMS Five-Star values (1–5 or null) copied from Provider Information. TrustHub does not recompute them. Staffing stars are not PBJ hours-per-resident-day.

---

## State evidence excluded from national V1

CA/NY/TX license claims and state history events are **uneven**, state-term-dependent, and not a national regulator overlay.

Live audit (out of Open V1):

| State | History events (`event_family='state'`) | Distinct facilities | Notes |
|-------|----------------------------------------:|--------------------:|-------|
| CA | **3,317** | 272 | Mostly `STATE_FINE` |
| NY | **6,084** | 514 | Complaints, inspections, fines |
| TX | **0** | 0 | License claims exist; no state history events in this vintage |

Published VERIFIED state **license-ID** facilities remain CA 1,158 / NY 515 / TX 1,134 — a different object than history events.

---

## Assisted living excluded

Live `assisted_living_provider` rows: **15,047** (CA 12,522 / NY 529 / TX 1,996). Separate identity; not the CMS CCN universe.

---

## Google / commercial enrichment excluded

Google Places websites, phones, place ids, identity candidates, and matcher confidence are out of Open V1.

---

## No consumer PII

Family workspace, interviews, trust-request submissions, resident identifiers, and employee-level PBJ detail are out. Daily PBJ (5,280,805 rows) is out of Open V1.

---

## Research conclusions belong to researchers

TrustHub organizes public records. Independent researchers own analysis, causal claims, and publication. Unfavorable findings are allowed. Factual correction of the dataset is allowed; suppression because findings are unfavorable is not.
