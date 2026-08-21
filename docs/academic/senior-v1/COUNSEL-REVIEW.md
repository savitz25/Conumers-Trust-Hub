# Senior Academic V1 — counsel review packet

**This is a question packet, not legal advice and not a publication decision.**  
TrustHub staff must not treat the working classifications in other 001B documents as legal conclusions.

No university agreement, DOI, license text, or public zip should proceed until the questions below are answered by qualified counsel.

---

## How to use this packet

For each item, counsel is asked for a decision that can be recorded as: **permit / permit with conditions / deny / needs more facts**.  
“Affected Open V1 tables” lists files in the **proposed** freeze. Excluded warehouse tables are listed when the question would change that exclusion.

---

## A. Redistribution of transformed CMS bulk data

**Question:** May TrustHub redistribute CMS Provider Data Catalog / CMS Data API extracts after deterministic normalization (CCN joins, documented keys, provenance columns), as a dated academic zip, with CMS named as the source of the records?

**Affected tables:** all Open V1 files (`facilities`, `facility_ratings`, `facility_inspections`, `facility_deficiencies`, `facility_enforcement`, `facility_chains`, `sources`).

---

## B. Attribution requirements

**Question:** What attribution language, links, and trademark handling are required for CMS (and for TrustHub as organizer)? Must every file header name CMS? Must README quote specific CMS notices?

**Affected tables:** all Open V1 files; `sources.csv`; README.

---

## C. Dataset license choice

**Question:** What license, if any, may be attached? Options to evaluate include a custom government-source notice, CC0, and CC BY 4.0 (see also M). `LICENSE` is currently **pending counsel**.

**Affected tables:** package-level; all files.

---

## D. Named facility publication

**Question:** May Open V1 include CMS-published facility name, legal business name, and street address keyed by CCN? Alternatively, must the first zip be CCN + state only (researchers join back to CMS)?

**Affected tables:** `facilities.csv` (and names that flow through to human-readable README examples). Telephone is already **hold**.

---

## E. Historical enforcement / deficiency presentation

**Question:** May TrustHub ship event-level inspection, deficiency (including official descriptions and A–L codes), and penalty rows in a convenient research table, with limitations stating that this is not a complete history of harm and not an accusation product?

**Affected tables:** `facility_inspections.csv`, `facility_deficiencies.csv`, `facility_enforcement.csv`.

---

## F. Use of CMS star ratings

**Question:** May TrustHub copy CMS Five-Star integers (including nulls) into `facility_ratings.csv` if they are labeled as CMS methodology and not TrustHub scores?

**Affected tables:** `facility_ratings.csv`.

---

## G. Organization ownership records

**Question:** May a **later** version include CMS-disclosed **organization** owner/manager rows (220,673 relationships; 110,859 distinct org parties)? Open V1 currently **excludes** all ownership.

**Affected tables:** none in Open V1; would affect a future `facility_ownership.csv` (org-only).

---

## H. Individual ownership records — separately

**Question:** May TrustHub ever publish CMS All Owners / PECOS **individual** owner or manager names (453,390 relationship rows; 246,020 distinct individual parties) in open, controlled, or no academic file?

**Affected tables:** none in Open V1; would affect a future ownership file. Do not fold this into G.

---

## I. CHOW buyer/seller identities

**Question:** May TrustHub publish CMS change-of-ownership events (`ownership_change_event`, live **5,227** rows, 2016-01-01–2026-02-01) with buyer/seller organization names? With person names from the CHOW owner-information file? Open V1 excludes CHOW.

**Affected tables:** none in Open V1; future `facility_ownership_changes.csv`.

---

## J. Academic use versus commercial use

**Question:** If redistribution is allowed for academic research, is commercial reuse of the TrustHub-organized zip allowed, forbidden, or allowed only under a different license? How should classroom vs company use be described?

**Affected tables:** package-level; all Open V1 files.

---

## K. Disclaimer language

**Question:** What required disclaimers (not a ranking, not a screening/FCRA product, not placement advice, missing evidence ≠ clean record, re-check CMS for current status, researchers own conclusions)?

**Affected tables:** README / LIMITATIONS; all tables by implication.

---

## L. Limitation-of-liability language if appropriate

**Question:** Should the package include limitation-of-liability or “as-is” language, and in what form, given that underlying records are government-published?

**Affected tables:** package-level LICENSE/README.

---

## M. CC BY 4.0 suitability or alternative

**Question:** Is Creative Commons Attribution 4.0 appropriate for a transformed U.S. government extract, or is a different instrument required (including “no license / public domain notice only”)?

**Affected tables:** package-level; all files.

---

## N. Citation requirements

**Question:** Required citation of CMS vs TrustHub vs both? Compatibility with the placeholder: `TrustHub Research Data. TrustHub Senior Regulatory Research Dataset. Version [X]. [date]. DOI: [when assigned].`

**Affected tables:** CITATION metadata; README; `sources.csv`.

---

## O. Permanent archival / DOI repository terms

**Question:** May this package later be deposited in Zenodo, Harvard Dataverse, or another archive, and do those repositories’ terms conflict with CMS terms or named-facility policy? **DOI is not assigned** and must not be invented.

**Affected tables:** package-level; all files if deposited.

---

## Explicitly out of this round

- Entity-resolution benchmark labels (separate track; zero MATCH labels exist).
- Move / Contractor / Lender extracts.
- Google enrichment (already excluded).
- Family workspace (already excluded).
- Production SeniorTrustHub page copy (this freeze does not change it).

---

## Record of answers

| ID | Decision | Date | Counsel / notes |
|----|----------|------|-----------------|
| A–O | **unresolved** | — | No answers in 001B.2A |
