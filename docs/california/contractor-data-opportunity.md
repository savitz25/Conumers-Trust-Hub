# California contractor data opportunity (ATH-CA-001)

State level only. Research/acquisition foundation. No public California pages.

Checked: 2026-09-03.

Exact counts only. UNKNOWN means the number was not obtained. Do not treat UNKNOWN as zero.

---

## 1. What is the authoritative California contractor universe?

The Contractors State License Board (CSLB), a Department of Consumer Affairs board, is the license universe for California contractors.

The **free Public Data Portal master list** is the first bulk universe:

- URL: <https://www.cslb.ca.gov/onlineservices/dataportal/ContractorList>
- Includes licenses that are **currently renewed** or **expired but renewable** (renewable within five years of expiration, BPC 7141).
- Omits cancelled, revoked, and expired-non-renewable licenses.
- Updated as of **9/2/2026** on the portal label.

The **paid License Master Full File** ($235 per file) is the historical universe: current, expired, cancelled, and revoked, including licenses expired more than 10 years. Official page: 830,000+ records.

A DGS/Cal eProcure vendor row is **not** a CSLB license. A DIR PWCR number is **not** a CSLB license. A DIR electrician certificate is a **person**, not a contractor business.

---

## 2. Can we bulk acquire it?

**Yes**, the free master, personnel, and workers’ compensation files are OPEN_BULK_DOWNLOAD.

Method: official ASP.NET form postback on the Public Data Portal (dropdown values `M` / `P` / `W`, then `ctl00$MainContent$lbMasterCSV` or the Excel twin). No fee. CSV or XLS. Not a search scrape. Not a CAPTCHA bypass.

This ticket’s master CSV postback **started** (27,890,218 bytes transferred) then the HTTP body truncated (`IncompleteRead`). Row count from that file is therefore **UNKNOWN**. Retry with streaming next ticket. Do not wait on the paid file.

SOAP `GetDataByClassification` WSDL is live at <https://www.cslb.ca.gov/onlineservices/DataPortalAPI/GetbyClassification.asmx?WSDL>. An empty-token C-10 call returned HTTP 200 with `errorMessage: Missing Classification or Token`. That is **not** an open anonymous API.

DCA Box licensee dumps **exclude CSLB** and point back to the Data Portal.

---

## 3. How many records?

| Universe | Count | Basis |
| --- | --- | --- |
| Free License Master rows | **UNKNOWN** | File not fully acquired |
| Free Personnel rows | **UNKNOWN** | Not downloaded |
| Free Workers’ Comp rows | **UNKNOWN** | Not downloaded |
| Paid License Master Full File | **830,000+** | Official forms page wording, not a counted extract |
| Paid Business Principle Full File | **1.3+ million** | Official forms page wording; personnel history, not businesses |

Do not use CSLB homepage snapshots as file row counts.

---

## 4. How many active/current?

**UNKNOWN** in the free master file (file not fully acquired).

Official definition of the free file: currently renewed **or** expired-but-renewable. Active vs inactive is a license-status field inside the file. Instant License Check is the current-status verify path for one license.

Paid Full File includes cancelled/revoked/expired and is not an “active” universe.

---

## 5. What exact IDs exist?

| ID | Source | Grain |
| --- | --- | --- |
| CSLB license number | CSLB master | contractor license |
| Classification code(s) | CSLB master / taxonomy | trade authority on a license |
| Personnel name + title on a license | CSLB personnel | currently associated person (free file) |
| HIS registration number | separate HIS credential | salesperson, **not** a contractor license |
| DIR PWCR number | DIR public works | public-works registration |
| DIR electrician CERTIFICATE_NUMBER | DIR ECU CKAN | person |
| SOS entity number | BizFile | business entity, not a license |

Join enforcement and public-works rows to a contractor profile only on an **exact** CSLB license number when the source publishes one.

---

## 6. What license/classification fields exist?

Official classification page <https://www.cslb.ca.gov/About_Us/Library/Licensing_Classifications/>:

- Branches: **A** General Engineering, **B** General Building, **B-2** Residential Remodeling, **C** Specialty.
- **43** published C-codes (C-2 through C-61 as listed), fixture at `data/network/california/contractor/fixtures/cslb-classifications.json` (46 titles including A / B / B-2).
- Certifications: **ASB**, **HAZ**.
- **C-61 Limited Specialty** has additional D-subclasses. Those D-codes were not enumerated this ticket.

Paid public-sales layout allows up to 30 class slots per license. Free master “classification(s)” is described as a field; layout of the free CSV is **UNKNOWN** until the file lands.

Business types on the custom-order form: Sole Owner, Partnership, Corporation, Joint Venture, LLC, Tribal Corp, Tribal LLC.

---

## 7. What public contact fields exist?

Free **License Master** (official description):

- license number
- business name
- address
- telephone number
- license status
- issue / expiration dates
- classification(s)
- bond information
- workers’ compensation information

**Email addresses are not provided** (BPC 27).

Website is **not** in the official field list.

Free **Personnel**: license number, personnel names, titles, classification(s), bond. No email. Disassociated personnel omitted.

Free **Workers’ Comp**: license number, coverage type, company, policy number, policy dates.

---

## 8. How many rows have phones?

**UNKNOWN** (master file not fully acquired). The telephone field exists.

---

## 9. How many have public email?

**0** in CSLB bulk files. Official: “NOTE: Email addresses are not provided” (BPC 27).

Do not scrape Instant License Check for email. Do not infer personal email from personnel names.

---

## 10. How many have websites?

**0** as a published CSLB bulk field. Occupancy of any unofficial website field is not a CSLB fact.

---

## 11. What qualifying-agent/business relationships exist?

- Free personnel file: people **currently associated** with a renewed or expired-but-renewable license (names, titles, classifications, bond).
- Disassociated personnel are omitted from the free file.
- Paid Business Principle Full File: full history of associated **and** disassociated personnel (no DOB/SSN/residential address).
- Qualifier titles in CSLB process: RME, RMO, RMM, RMG, qualifying partner, owner.
- Qualifiers are limited in how many firms they may qualify.
- Home Improvement Salesperson (HIS) is a **separate registration**. A contractor must notify CSLB of HIS employment and cessation. HIS list is a $245 paid extract and is **not** a contractor-business universe.
- Joint venture licenses exist as their own license type.

Personnel names are official associations, not a personal-contact harvest.

---

## 12. What enforcement is available?

| Source | Access | Identity | Notes |
| --- | --- | --- | --- |
| Instant License Check | OPEN_SEARCH_ONLY | EXACT license | Current disclosure path. Do not scrape. Possible captcha token in page HTML. |
| FY 2024/25 Enforcement Report PDF | OPEN_BULK_DOWNLOAD | UNSAFE for profile attach | Aggregates only. Report date 9/15/2025: 19,257 complaints received; 591 licenses revoked; 455 licenses suspended. |
| `cslb.ca.gov/RevokedLicenses` | OPEN_SEARCH_ONLY | EXACT when a license number is listed | Newsletter pointer. `Disciplinary_Actions.aspx` returned a Page Not Found title on 2026-09-03. |
| Paid Complaint Disclosure Legal Action File | SOURCE_AVAILABLE_BY_REQUEST | EXACT | $235 Full/Update family. |
| Accusations as PDFs | OPEN_SEARCH_ONLY | EXACT | Accusation ≠ finding. |

Complaint ≠ violation. Missing enforcement source ≠ zero complaints.

---

## 13. What public works data is available?

- **PWCR** (Public Works Contractor Registration) is required to bid or work on covered public works. Portal: <https://www.dir.ca.gov/public-works/contractor-registration.html> and <https://services.dir.ca.gov/pw>.
- No PWCR bulk CSV on data.ca.gov this ticket. Legacy Salesforce search returned HTTP **503**. `services.dir.ca.gov/pw` returned HTTP **200** (HTML portal). Public local-debarment Excel/PDF download may require captcha for anonymous users (DIR Local Debarment Guide). **Do not bypass captcha.**
- **DLSE debarment** HTML table is live: <https://www.dir.ca.gov/dlse/debar.html>. Distinct from DIR **local** debarment. Distinct from federal SAM/EPLS.
- Parser saw 62 HTML data rows / 67 period strings. Currently-in-force count is **UNKNOWN** (two-digit years such as `4/1/44` are ambiguous). Sample fixture: `data/network/california/contractor/fixtures/dir-debarment-sample.json`.
- DIR electrician CKAN: **36,983** certified and **19,661** trainees (2026-09-03). Person + zip + certificate. Not a contractor-business universe.

PWCR ≠ CSLB. Debarment ≠ CSLB license status.

---

## 14. What procurement/vendor data is available?

- Cal eProcure <https://caleprocure.ca.gov/pages/index.aspx> returned **HTTP 403** from this environment. SOURCE_ACCESS_BLOCKED here. Do not scrape around it.
- DGS `purchase-order-data` exists on data.ca.gov (package_search hit). Not acquired this ticket. Row count **UNKNOWN**.
- Vendor ≠ licensed contractor. A PO vendor may be unlicensed, out of class, or a supplier.

---

## 15. What could add net-new contractor businesses beyond the license roster?

Possible **net-new businesses** (not already a CSLB license in the free master):

- Entities in the **paid Full File** that are cancelled/revoked/expired-non-renewable (historical, not a current universe).
- DIR **PWCR** registrants in trades that do not require a CSLB license. Count **UNKNOWN**. Identity REVIEW REQUIRED unless a CSLB number is on the PWCR record.
- DGS / Cal eProcure vendors that are not CSLB licensees. Count **UNKNOWN**.

Not net-new contractor businesses:

- HIS registrants.
- DIR certified electricians / trainees (persons).
- Owner-builders.
- Unlicensed activity (no roster).
- C-61 specialists already inside CSLB.

---

## 16. Which sources can enrich existing contractor profiles?

| Source | Join | What it adds |
| --- | --- | --- |
| CSLB personnel | EXACT license number | qualifier / officer / RME associations |
| CSLB workers’ comp | EXACT license number | WC coverage type / company / policy dates |
| DIR DLSE debarment | EXACT CSLB number when published | public-works debarment period + decision |
| DIR PWCR | EXACT PWCR or exact CSLB if returned | public-works registration |
| DIR electrician list | REVIEW REQUIRED (person → C-10) | trade certification; do not auto-attach |
| DGS purchase orders | REVIEW REQUIRED (name) | state vendor activity; not a license |
| SOS BizFile | HIGH CONFIDENCE only on exact legal name + exact official address | entity status; never overwrite CSLB contacts |
| CalHFA / CDI / BHGS | only if the same legal entity is independently identified | other-hub facts; do not collapse hubs |

Never overwrite CSLB regulator contacts with SOS, vendor, or program contacts.

---

## 17. Which sources are easy wins versus rabbit holes?

**Easy wins**

1. Retry CSLB master/personnel/WC streaming download (portal is live; transfer is the only failure).
2. DIR DLSE debarment HTML table.
3. CSLB classification taxonomy (already fixtured).
4. FY enforcement report as **aggregate** coverage, not profile discipline.

**Worth a later pass, not this ticket**

- Paid Full File ($235) if cancelled/revoked history is required.
- DGS purchase-order-data after the license universe lands.
- PWCR if DIR publishes a bulk extract.

**Rabbit holes — skip**

- Municipal building permits (58 counties, hundreds of cities).
- Salesforce PWCR scrape / captcha local-debarment Excel.
- SOAP without a real token.
- DCA Box scraping.
- C-61 D-subclass page crawl.
- Instant License Check automation.
- Inferring email or personal phones from personnel names.
- Waiting on PRA.

---

## Publication rules for later California contractor pages

- Liberal inclusion of source-level evidence.
- Conservative attribution to a named business.
- Transparent coverage: missing source ≠ zero.
- No Trust Score, no paid ranking, no best/worst contractors.
- No public California routes in this ticket.
