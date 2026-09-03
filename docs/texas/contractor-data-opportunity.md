# Texas contractor data opportunity (ATH-TX-001)

State level only. Research/acquisition foundation. No public Texas pages.

Checked: 2026-09-03.

Exact counts only. UNKNOWN means the number was not obtained. Do not treat UNKNOWN as zero.

No Trust Score, no paid ranking, no best/worst contractors.

---

## 1. What is the authoritative Texas contractor universe?

**There is no CSLB equivalent.** Texas does **not** have a statewide general-contractor license. Roofing and general building are not a TDLR statewide class.

The state-level contractor universe is a **union of trade regulators plus vendor/project overlays**:

| Piece | Regulator | What it is | What it is not |
| --- | --- | --- | --- |
| Electrical Contractor | TDLR | Business credential | Not a master/journeyman person license |
| A/C Contractor | TDLR | Business credential | Not an A/C Technician person license |
| Elevator / appliance / water well / mold / solar | TDLR | Trade or company files | Not a GC license |
| Responsible Master Plumber | TSBPE | Person credential that may contract with the public | Not a company charter |
| Engineering firm | TBPELS | Firm registration F-xxxxx | Not a TDLR trade |
| Landscape irrigator | TCEQ | Search-only this ticket | Not TDLR |
| CMBL vendor | Comptroller | Paid bidder list | **Vendor ≠ licensed contractor** |
| TxDOT bid tabs | TxDOT | Project bids | Not a license; bid ≠ award |

A DGS/CMBL vendor row is **not** a contractor license. A TxDOT low bid is **not** a TDLR license. A master electrician is a **person**, not an electrical contractor business.

---

## 2. Can we bulk acquire it?

**Yes, for trades.** Official daily CSVs at <https://www.tdlr.texas.gov/dbproduction2/>.

| File | Bytes | Clock | Rows this ticket |
| --- | --- | --- | --- |
| All Licenses `ltlicfile.csv` | 187,404,606 | 9/3/2026 6:20:35 AM | UNKNOWN (not ingested) |
| Airconditioning Contractors `ltairref.csv` | 3,654,963 | 9/3/2026 6:18:14 AM | **20,427** |
| Electrical Contractors `Lteecele.csv` | 3,793,622 | 9/3/2026 6:18:34 AM | **14,036** |
| Tow Truck Companies `TowCompanies.csv` | 1,074,594 | 9/3/2026 6:15:09 AM | **3,797** (move-adjacent) |

SODA `7358-krk7` is a **lagging** copy: 983,494 rows, last updated ~2026-07-16. Prefer dbproduction2.

TSBPE official CSVs (page says updated daily):

| File | Bytes | Rows | Notes |
| --- | --- | --- | --- |
| RMP.csv | 1,982,197 | **9,360** (Current 8,570) | Insurance company 9,347; insurance expiry 9,348; phone 4,778 |
| MP.csv | 437,186 | **4,325** | Master plumber, not the public-contracting RMP |

SODA `qced-zkby` (old plumbing dataset) returned **HTTP 404**. Do not use it.

TBPELS firm roster is advertised as daily ZIP/CSV. Exact URL not pinned (guessed paths 404). Do not scrape the 2,000-row search.

TCEQ irrigators are **OPEN_SEARCH_ONLY**.

TDLR enforcement search `cimsfo/fosearch.asp` is **OPEN_SEARCH_ONLY**. Do not scrape.

---

## 3. TDLR opportunity (not a CSLB clone)

SODA type mix on the 983,494-row extract (lagging):

- Person-heavy: Apprentice Electrician 253,611; Cosmetology Operator 197,266; A/C Technician 59,405; Journeyman Electrician 44,623
- Contractor-relevant business types: A/C Contractor 20,323; Electrical Contractor 13,917; Appliance Installation Contractor 835; Electrical Sign Contractor 654; Elevator Contractor 365; Water Well Driller/Pump Installer 1,740

**Contact is uneven:**

- Electrical Contractor official CSV: BUSINESS PHONE 14,031 / 14,036; address 14,017
- A/C Contractor official CSV **and** SODA: BUSINESS PHONE **0**, BUSINESS ADDRESS **0**
- All-licenses SODA: phone nonempty only 99,720 / 983,494

TDLR identity: `TX-TDLR:{LICENSE TYPE}:{LICENSE NUMBER}`.

TDLR All Licenses is mixed person/business. Do not publish person-named rows as business profiles this ticket.

---

## 4. Vendor / procurement opportunity

Comptroller CMBL official bulk, refreshed nightly, public domain:

| File | Bytes | Rows | Contacts |
| --- | --- | --- | --- |
| `web_name.csv` active CMBL/VetHUB | 4,069,729 | **12,000** | phone 12,000; email 11,998 |
| `vnr_clas.csv` class/VID | 8,420,975 | **49,245** | none |
| `hub_name.csv` | 531,823 | UNKNOWN | — |
| `web_all_name.csv` active+inactive | 16,995,588 | UNKNOWN | — |

Exact ID: `WEB_VID` / `WEB_VENDOR_NO`.

DIR cooperative contracts SODA `vipt-h4ye`: **5,174** rows with vendor contact email. IT contracts, not construction licenses.

**Vendor ≠ licensed contractor.** CMBL email must not overwrite TDLR/TSBPE phones.

---

## 5. TxDOT opportunity

SODA live 2026-09-03:

- Bid Tabulations `de7b-7dna`: **1,057,488** rows (24-month bid items). Bid totals ≠ award.
- Project Information `drau-zphx`: **8,605** rows
- Plan Holders `jd6h-b87p`: **664** rows

Grain is **project**, not contractor license. Name match to TDLR/TSBPE is REVIEW_REQUIRED. Tableau dashboards are unofficial vs ESBD / Electronic Bidding System.

---

## 6. Insurance-on-license (where the source actually proves it)

License existence ≠ current insurance unless the source says so.

| Source | Proves current insurance filing? |
| --- | --- |
| TDLR A/C / Electrical contractor CSV | No |
| TSBPE RMP CSV | **Yes** — `INSURANCE_COMPANY` + `INS_EXPIRY_DTE` (9,348 / 9,360) |
| TDLR TowCompanies.csv | **Yes** — `TDI_NBR`, `INSURANCE_COMPANY_NAME`, `POLICY_TYPE` (Form E = 10) |
| TxDMV household goods | Search UI (Form E / Form H&I). No bulk file |

---

## 7. Recommended contractor specialist ticket

`TX-CON-001`: ingest official electrical + A/C + elevator + appliance contractor CSVs, TSBPE RMP (suppress person names on public profiles until a people policy exists), CMBL construction class overlay as vendor evidence, TxDOT project overlay as market activity. Do not invent a general-contractor roster. Do not scrape TCEQ or TDLR enforcement search.
