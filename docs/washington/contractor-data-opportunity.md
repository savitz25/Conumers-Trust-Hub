# Washington contractor data opportunity (ATH-WA-001)

State level only. Research/acquisition foundation. No public Washington pages.

Checked: **2026-09-04**.

Exact counts only. UNKNOWN means the number was not obtained. Do not treat UNKNOWN as zero.

No Trust Score, no paid ranking, no best/worst contractors.

---

## 1. What is the authoritative Washington contractor universe?

The **Department of Labor & Industries (L&I)** contractor registration file is the statewide universe (RCW 18.27 construction contractors, plus electrical / plumbing / elevator contractor types in the same general dataset).

This is **not** Texas. Washington has a statewide contractor registration. Do not invent a second “general contractor license” on top of L&I.

Preferred identity: **`WA-LNI:{ContractorLicenseNumber}`**.

Verify current status: <https://secure.lni.wa.gov/verify/> (search; do not scrape).

A public-works vendor / prime on an intent or affidavit is **not** a contractor license. UBI is **not** a professional license.

---

## 2. Can we bulk acquire it?

**Yes.** Official Socrata CSVs on data.wa.gov, PDDL / public domain, refreshed ~three times daily (7:30 a.m., 12:15 p.m., 5:15 p.m.).

| Dataset | ID | Download |
| --- | --- | --- |
| General | `m8qx-ubtq` | `https://data.wa.gov/api/views/m8qx-ubtq/rows.csv?accessType=DOWNLOAD` |
| Bond | `bzff-4fmt` | `https://data.wa.gov/api/views/bzff-4fmt/rows.csv?accessType=DOWNLOAD` |
| Insurance | `ciwg-agsx` | `https://data.wa.gov/api/views/ciwg-agsx/rows.csv?accessType=DOWNLOAD` |

This ticket streamed all three into `data/raw/wa_lni/` (gitignored).

---

## 3. How many records? How many active?

Live CSV ingest 2026-09-04 (not the Socrata metadata cache):

| | Count |
| --- | --- |
| General rows / unique license numbers | **160,923** |
| ACTIVE | **75,823** |
| EXPIRED | 61,083 |
| SUSPENDED | 9,731 |
| RE-LICENSED | 9,349 |
| OUT OF BUSINESS | 4,696 |
| CONSTRUCTION CONTRACTOR | 148,557 |
| ELECTRICAL CONTRACTOR | 9,186 |
| PLUMBING CONTRACTOR | 3,059 |
| ELEVATOR CONTRACTOR | 121 |
| SpecialtyCode1 `01` GENERAL | 117,378 |
| Unique UBI | 149,153 (active unique UBI 72,822) |

SHA-256 general: `818c7f8df6ecb857aea6375c2b6ec884ae278cc6a89999c0bf8ad49f87285b20` (35,382,044 bytes). Last-Modified `Fri, 04 Sep 2026 15:10:51 GMT`.

---

## 4. Exact IDs

| ID | Source | Grain |
| --- | --- | --- |
| ContractorLicenseNumber | General / bond / insurance | contractor registration |
| UBI | General (100% occupancy) | business identifier, **not** a license |
| BondAccountID | Bond | surety account |
| InsurancePolicyNo | Insurance | policy evidence |
| PrincipalName | Principal addendum `4xk5-x9j6` (250,349 rows) | **person** — unpublished |

Join enforcement and public-works rows to a contractor profile only on an **exact** ContractorLicenseNumber when the source publishes one. UBI is a candidate key only.

---

## 5. Bond layer

Bond file: **176,920** rows / **82,635** unique licenses. Multiple bonds per license are expected (56,777 licenses have more than one row; max 9). Typical amounts 12,000 / 30,000 / 6,000 / 15,000. BondImpaired=Y: **294**.

**BOND ≠ ENDORSEMENT.** Current registration ≠ current bond unless an uncancelled current-evidence row exists.

SHA-256: `127d8788bc09df8774b54a2d770e38fde70633f3a7c6577a2b20f0b8f5e6d6a7`.

---

## 6. Insurance layer

Insurance file: **77,005** rows / **70,953** unique licenses. Typical amount **1,000,000** (68,255 rows). Smaller than general because it is currently reported policy evidence, not a 1:1 roster copy.

**INSURANCE RECORD ≠ SAFETY. EXPIRED POLICY ≠ DISCIPLINE.**

`CreatedBy_WAOIC_ID` / `UpdatedBy_WAOIC_ID` are L&I submitter/staff IDs. They are **not** an OIC producer roster.

SHA-256: `69108d87fbb6ac2eef9a3f33b36fa25296c59c2f0bcff9dd81da674971f99c35`.

---

## 7. Three-layer join (exact ContractorLicenseNumber)

| Metric | Count |
| --- | --- |
| General ∩ any bond row | 82,635 |
| General ∩ any insurance row | 70,953 |
| General ∩ bond ∩ insurance | 70,622 |
| General without bond row | 78,288 |
| General without insurance row | 89,970 |
| Bond orphans not in general | **0** |
| Insurance orphans not in general | **0** |
| ACTIVE with current-bond evidence | 75,044 |
| ACTIVE with current-insurance evidence | 70,425 |
| ACTIVE with both current-evidence flags | **69,966** |
| ACTIVE without current-bond evidence | 779 |
| ACTIVE without current-insurance evidence | 5,398 |

Do not hide orphans (there were none vs general). Missing bond/insurance is **not** zero coverage and is **not** discipline. Do not mint insured-forever or recommended-contractor labels. Current-evidence flags are date/cancel heuristics on the published file.

---

## 8. Contacts

| Field | Occupancy |
| --- | --- |
| PhoneNumber | **160,850 / 160,923** |
| Address1 | 160,923 |
| Email | **0** (column does not exist) |
| Website | **0** (column does not exist) |
| PrimaryPrincipalName | 160,555 — person, REVIEW_ONLY |

Official regulator phones/addresses outrank SOS/DOR. Do not overwrite stronger contact provenance. No person-scale publishing in Ask.

---

## 9. Enforcement / public works

| Source | Access | Count |
| --- | --- | --- |
| Debarred contractors list | Official download control | **745** page total; file not downloaded this ticket |
| Strike list | Official download control | **18,969** page total; not downloaded |
| Public Works Project Details `qp8s-a5uf` | SODA | **347,082** counted, not dumped |
| Affidavit Project Details `9ncw-tqjn` | SODA | **1,192,380** giant; not ingested |
| Intent Project Details `t9je-9qwa` | SODA | **1,314,773** giant; not ingested |

VENDOR ≠ CONTRACTOR LICENSE. Debarment is public-works bid ineligibility, not a consumer quality score. Name-only attach is UNSAFE. Principal names on debar/strike lists are people.

---

## 10. What this is not

- Not a quality ranking.
- Not an endorsement.
- Not proof of current insurance for every ACTIVE row.
- Not a Seattle or King County product.
- Not a person directory.
