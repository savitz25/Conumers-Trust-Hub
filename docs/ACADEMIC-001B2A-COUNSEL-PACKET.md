# Academic 001B.2A — Counsel-review packet

**Not legal advice. Not a request to publish.**  
**Date:** 2026-08-21  
**Purpose:** Give qualified counsel a bounded packet for a **future** academic redistribution of SeniorTrustHub’s CMS nursing-facility warehouse.

Ask Trust Hub documents the program; Care Trust Hub / SeniorTrustHub holds the warehouse. This packet does not attach CSV extracts, consumer lists, family-workspace data, or Google Places data.

Related internals: `docs/ACADEMIC-001B2A-SENIOR-SNAPSHOT-FREEZE.md`, `docs/ACADEMIC-001B2A-DATA-DICTIONARY.md`, `docs/ACADEMIC-001B2A-RELEASE-MANIFEST.md`, `docs/ACADEMIC-DATASET-RELEASE-STANDARD.md`.

---

## A. Decision sought (later — not this week)

Counsel is asked, **before any public zip**:

1. Whether TrustHub may **bulk-redistribute** CMS Provider Data Catalog and CMS Data API extracts that CMS already posts for public download, with attribution and a frozen schema.
2. Whether **named nursing facilities** (CMS names + CCN + address) may appear in an academic research file, or whether the first release should be de-identified.
3. Whether **individual owner/manager names** from CMS All Owners / Ownership / CHOW owner-information may appear in an **open** file, a **controlled** file, or neither.
4. What license text (if any) to put on the package (`LICENSE` is currently `PENDING_COUNSEL`).
5. What disclaimer language is required so the file is not used as a consumer screening, placement, or FCRA-style eligibility product.
6. Whether a limited factual/legal review window in future university agreements is acceptable if it is **not** a veto of unfavorable findings (program charter).

No university outreach, DOI, or public download should proceed until those items are answered.

---

## B. What we propose to ship (open V1, after counsel)

**Working title:** TrustHub Senior Regulatory Research Dataset  
**Proposed version:** `trusthub-senior-regulatory-v2026.07.29`  
**Universe:** 14,693 currently CMS-active nursing homes (CCN is the key).  
**Live warehouse recount:** 2026-08-21, SELECT-only, no production writes.

| Table | Named facilities? | Named persons? | Live rows |
|-------|-------------------|----------------|----------:|
| Facilities + CMS star ratings | Yes (CMS names) | No | 14,693 |
| Inspections | Via CCN | No | 149,705 |
| Deficiencies (A–L codes, official descriptions) | Via CCN | No | 418,344 |
| Penalties (fines and payment denials) | Via CCN | No | 16,166 |
| CMS chain membership | Via CCN + CMS chain name | No | 10,231 |
| Sources / checksums | N/A | No | small |
| Ownership — **organizations only** | Via CCN | Org names only | 220,673 of 674,063 |
| CHOW events | Via CCN | Buyer/seller names gated | 5,227 |

Staffing **quarter** summaries (57,873) are optional. Daily PBJ (5,280,805 hour-level rows) would **not** ship in open V1.

---

## C. What we will not ship in open V1 (already excluded)

| Excluded | Why it is in the packet |
|----------|-------------------------|
| Google Places cache, websites, place ids | Commercial terms; not a government source |
| Family workspace / interviews / consumer submissions | Possible consumer PII; program charter forbids consumer PII |
| Assisted living registries | Separate product; not the CMS CCN flagship |
| Daily PBJ employee-hour microdata | Granular staff-time; size; later/controlled |
| Derived facility-history timeline | TrustHub derivation, not CMS-native |
| CA/NY/TX state license overlays | State-specific terms; not national; includes **1,144 STATE_ADMINISTRATOR** name claims |
| Individual ownership display names | **246,020** distinct persons; **453,390** relationship rows |
| Internal matcher confidence / review queues | Not official findings |
| Database credentials, raw JSON blobs | Operational |

---

## D. Source / reuse matrix (still not legal conclusions)

CMS files in this warehouse are **public download** products. TrustHub stores immutable vintages (retrieval time, source-modified time, SHA-256 of retrieved bytes) and normalizes keys. It does not scrape non-public CMS systems for this flagship.

| CMS product | Identifier | Public landing page | TrustHub transform | Working classification |
|-------------|------------|---------------------|--------------------|------------------------|
| Provider Information | `4pq5-n9py` | https://data.cms.gov/provider-data/dataset/4pq5-n9py | CCN identity, current snapshot | LIKELY_OPEN_PUBLIC_SOURCE — still review bulk reuse + named facilities |
| Inspection Dates | `svdt-c123` | https://data.cms.gov/provider-data/dataset/svdt-c123 | Event keys | same |
| Health Deficiencies | `r5ix-sfxw` | https://data.cms.gov/provider-data/dataset/r5ix-sfxw | Event keys; keep official A–L | same; harm **codes** are official, not resident identifiers |
| Penalties | `g6vv-u9sr` | https://data.cms.gov/provider-data/dataset/g6vv-u9sr | Typed Fine vs Payment Denial | same; Fine sum in vintage = $464,165,281.00 (CMS dollars, ~3-year window) |
| Ownership | `y2hd-n93e` | https://data.cms.gov/provider-data/dataset/y2hd-n93e | Graph | REVIEW_REQUIRED (individuals) |
| All Owners | `afe44b85-cc6d-40d7-b5df-00ae8910d1d2` | https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/skilled-nursing-facility-all-owners | PECOS self-report | REVIEW_REQUIRED |
| Enrollments / chains | `5f2c306f-3b1c-42cd-b037-187b2ce22126` | https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/skilled-nursing-facility-enrollments | Membership | LIKELY_OPEN for membership; do not republish as TrustHub chain scores |
| CHOW | `f557a6ed-95b3-4a22-8433-4175db2dec1c` | https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/skilled-nursing-facility-change-of-ownership | Events 2016-01-01–2026-02-01 | REVIEW_REQUIRED (successor language) |
| PBJ | `7e0d53ba-8f02-4c66-98a5-14a1c997c50d` | https://data.cms.gov/quality-of-care/payroll-based-journal-daily-nurse-staffing | Daily store + quarter HPRD | Daily DO_NOT_RELEASE_YET; quarters optional |

CMS nursing-home data dictionary PDF:  
https://data.cms.gov/provider-data/sites/default/files/data_dictionaries/nursing_home/NH_Data_Dictionary.pdf

U.S. government works are often treated as public-domain at the federal level, but **CMS website terms, API terms, and bulk-redistribution practice still need counsel**. This packet does not conclude that redistribution is automatically permitted.

---

## E. Named-facility question

Open V1 as drafted **names facilities** exactly as CMS does: provider name, legal business name, address, CCN.

Arguments to put in front of counsel:

- The same identifiers are already on data.cms.gov and on SeniorTrustHub facility pages.
- Academic use is descriptive/associational research, not a referral marketplace.
- Risk remains: packaging inspections, deficiencies, and fines **together** in a convenient research zip can look like an accusation product if README language is weak.

If counsel requires de-identification, the freeze can drop names/address/phone and keep CCN plus state — researchers can still join back to CMS. That would be a **different** package, not a silent field drop after publication.

Telephone is CMS-public and marked OPTIONAL in the freeze.

---

## F. Named-person question

CMS All Owners / PECOS disclosures include **individual** owners and managers.

Live warehouse:

- 453,390 individual-person relationship rows
- 246,020 distinct individual parties
- 220,673 organization relationship rows
- 110,859 distinct organization parties

**Recommendation in this packet:** open V1 = organization rows only. Individuals = controlled or omitted. CHOW buyer/seller person names follow the same gate.

State overlay `STATE_ADMINISTRATOR` (1,144 VERIFIED claims in CA/NY/TX publication view) is also a named-person class and is **already out** of open V1.

Do not add TrustHub language that an owner “caused” a deficiency. Ownership is disclosure, not proven control of every operational outcome.

---

## G. Misuse and consumer-protection posture

The independence charter (`lib/academic/charter.ts`) already says:

- unfavorable findings are allowed;
- no consumer PII;
- original regulators remain the source;
- factual correction ≠ suppression.

README / license should additionally state, subject to counsel:

- Not a consumer ranking or placement list.
- Not for tenant/resident screening, employment, or credit eligibility.
- Not an FCRA consumer report.
- Not a complete record of quality or of every enforcement action ever taken.
- Users must re-check CMS (and the facility) for current status; this is a **dated snapshot**.

Fine totals and star ratings must not be described as TrustHub scores.

---

## H. Review window (future agreements only)

If a later university or archive agreement includes a factual/legal review period:

- It may correct factual errors about the dataset or source limitations.
- It must **not** be a right to block release because findings are unfavorable to operators, chains, or TrustHub.

No such agreement is being sent now.

---

## I. What counsel does **not** need to review in this round

- Entity-resolution benchmark labels (separate 001B.2B+/001C track; **zero** MATCH labels exist).
- Move / Contractor / Lender extracts.
- Production SeniorTrustHub UX copy (this task does not change it).
- Google enrichment (excluded).

---

## J. Ask questions (explicit)

Please return, when engaged:

1. Open redistribution of CMS core tables (facilities, inspections, deficiencies, penalties, chains, sources): **yes / yes-with-conditions / no**.
2. Named facilities: **keep CMS names / CCN-only de-id**.
3. Individual owners: **open / controlled / omit**.
4. Org-only ownership + CHOW events without person names: **yes / no**.
5. PBJ quarter summaries: **open / later / never in TrustHub packaging**.
6. Preferred license (e.g. CC0, CC BY, custom government-source notice).
7. Any required disclaimer paragraphs beyond section G.

Until then: **do not publish, do not DOI, do not add `/academic` downloads, do not contact universities.**
