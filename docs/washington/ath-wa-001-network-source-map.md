# Washington six-hub source map (ATH-WA-001)

Ask research foundation (ATH-WA-001). Public `/washington` is published by ATH-WA-002. No specialist-repo edits in ATH-WA-001. State level only. No city or county routes.

Checked: **2026-09-04**.

Exact counts only. UNKNOWN means the number was not obtained. Missing ≠ zero. SEARCH_ONLY ≠ zero.

---

## Scope

- Washington **state** sources only.
- No Seattle, King County, Tacoma, Pierce County, Spokane, Snohomish, Bellevue, or municipal permits.
- No Trust Score, no paid ranking, no best/worst lists.
- No person-scale publishing decisions in Ask.

## What was acquired

| Source | Rows | Unique ID | Status |
| --- | --- | --- | --- |
| L&I General `m8qx-ubtq` | **160,923** | 160,923 ContractorLicenseNumber | ACQUIRED (gitignored CSV) |
| L&I Bond `bzff-4fmt` | **176,920** | 82,635 licenses | ACQUIRED |
| L&I Insurance `ciwg-agsx` | **77,005** | 70,953 licenses | ACQUIRED |
| DSHS GIS residential care (current) | **6,968** | DSHS LicenseNumber | COUNTED via official FeatureServer |
| UTC Active Household Goods directory | **285** (page total) | UTC ID | Documented; **not scraped** |

Raw CSVs live under `data/raw/wa_lni/` (gitignored). SHA-256 hashes are in `data/network/washington/acquisition-summary.json`.

## Hub map (short)

| Hub | Authoritative bulk? | Exact IDs | Contacts | Blockers |
| --- | --- | --- | --- | --- |
| **CONTRACTOR** | Yes — L&I general + bond + insurance | `WA-LNI:{ContractorLicenseNumber}`, UBI | Phone 160,850 / 160,923; no email/website | Debar/strike export not downloaded this ticket |
| **MOVE** | No CSV. Official HTML directory 285 Active HHG | UTC ID, UBI, USDOT | UNKNOWN on directory (not harvested) | Do not scrape search; STATE ≠ FMCSA |
| **INSURANCE** | No producer bulk | WAOIC / NPN / NAIC on lookup | Lookup only | **RCW 42.56 lists of individuals**; SEARCH_ONLY |
| **SENIOR** | Yes — GIS current AFH 6,179 / ALF 557 / ESF 16 | DSHS LicenseNumber | Facility phone + address | Do not scrape locators; DSHS ≠ CMS |
| **LENDER** | No company roster | NMLS when present on an order | UNKNOWN | Do not invent a live denominator; NMLS SEARCH_ONLY |
| **INVESTOR** | No state-RIA bulk | CRD on overlay (plan) | UNKNOWN | WA principal office ≠ state registration |

## Semantic guardrails (do not collapse)

CONTRACTOR REGISTRATION ≠ QUALITY · BOND ≠ ENDORSEMENT · INSURANCE RECORD ≠ SAFETY · EXPIRED POLICY ≠ DISCIPLINE · UBI ≠ PROFESSIONAL LICENSE · UTC STATE AUTHORITY ≠ FMCSA INTERSTATE AUTHORITY · USDOT ≠ INTERSTATE AUTHORITY BY ITSELF · OIC PRODUCER ≠ AGENCY · COMPLAINT ≠ VIOLATION · HMDA ≠ LICENSE ROSTER · WA PRINCIPAL OFFICE ≠ STATE IA REGISTRATION · CRD ≠ CURRENT WA AUTHORITY · DSHS ≠ CMS · MISSING ≠ ZERO · SEARCH_ONLY ≠ ZERO · NO TRUST SCORE · NO PAID RANKING

## Files

`data/network/washington/` — source-manifest, identity-source-map, contact-source-summary, cross-hub-source-map, six-hub-value-matrix, acquisition-summary, contractor-priority-source-map, hub subfolders, `lni-three-layer-join.json`.

Probe dumps `probe-*.json` are gitignored.
