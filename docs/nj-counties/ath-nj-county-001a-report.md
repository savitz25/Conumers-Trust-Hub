# ATH-NJ-COUNTY-001A — Monmouth and Middlesex quick-win county data

Date: 2026-09-03  
Repository: savitz25/Conumers-Trust-Hub  
Branch: `ath-nj-county-001a-monmouth-middlesex`  
Base: `2e0b303ab419c95590d5e51cfa708fad1e4ce041` (origin/main at start)

This ticket is acquisition / modeling / documentation only. No public county routes, no sitemap, no Vercel, no specialist-repo edits.

Somerset/Union files were not touched. No shared four-county manifest was created.

---

## A. Status

Complete for the bounded quick-win scope.

Easy structured data was acquired. Difficult portals were classified, optionally given one narrow request, and skipped.

## B. Repository / SHAs

- Isolated worktree: `C:\Users\Michael.Savitsky\ask-ath-nj-county-001a`
- Starting origin/main: `2e0b303ab419c95590d5e51cfa708fad1e4ce041`
- Builder 4 branch `ath-nj-county-001b-somerset-union` shares that SHA and was not edited

## C. Monmouth sources found

| Source | Access class | Grain | Fields | Hub value | Acquired | If skipped |
| --- | --- | --- | --- | --- | --- | --- |
| GeoHub / self-service open data | OPEN_BULK_DOWNLOAD | GIS layer | parcels (no owner), parks, roads, campus, building footprints advertised | LENDER/INVESTOR HIGH | Inventory only | Hub catalog API 400/500; no huge shapefiles |
| Property Viewer | OPEN_SEARCH_ONLY | parcel search | block/lot/municipality; MOD-IV through Jan 2023 | LENDER HIGH | Documented | No scrape |
| NJGIN parcels/MOD-IV (Monmouth filter) | OPEN_GIS_SERVICE | parcel + MOD-IV | PAMS_PIN, MUN_NAME, values, sale, deed refs; OWNER_NAME redacted | LENDER/INVESTOR HIGH | Count + schema only (249796) | Not reacquired |
| NJDEP building footprints | OPEN_GIS_SERVICE | building polygon | statewide | CONTRACTOR MEDIUM | Referenced | Not duplicated |
| NJTPA Zoning_Monmouth | SOURCE_USE_RESTRICTED | zoning polygon | MUN, ZON_ID, ZoneDesc | CONTRACTOR/INVESTOR HIGH if usable | No | HTTP 403 + no-redistribution license |
| OPRS Clerk + Tax Board | OPEN_SEARCH_ONLY | recorded instrument / MOD-IV / sales | deeds, mortgages, trade names, block/lot, consideration; Tax Board query export | LENDER/CONTRACTOR/INVESTOR HIGH | Audit only | No scraper |
| CivilView sheriff sales (countyId=8) | OPEN_SEARCH_ONLY | listing row | sheriff #, status, date, plaintiff, defendant, address | LENDER/INVESTOR HIGH | Status inventory (99) | No defendant/address dump |
| County sheriff page | OPEN_SEARCH_ONLY | schedule + disclaimer | sale calendar | LENDER MEDIUM | Documented | — |
| Consumer Affairs | OPEN_SEARCH_ONLY | business lookup | complaint history by phone/email | ASK/MOVE/CONTRACTOR HIGH | Request drafted | No bulk file |
| ADRC / senior centers | OPEN_BULK_DOWNLOAD | facility | name, address, phone, nutrition flag | SENIOR HIGH | Yes (12 + 3) | — |

## D. Monmouth easy-win data acquired

- Senior-center and ADRC directory (`fixtures/senior-centers.json`)
- Sheriff-sale **status** snapshot: 99 listings, 34 scheduled, 62 adjourned, 3 bankrupt, **0 completed** (`fixtures/sheriff-sales-status-snapshot.json`)
- NJGIN Monmouth parcel count and field inventory
- GIS endpoint inventory

## E. Middlesex sources found

| Source | Access class | Grain | Fields | Hub value | Acquired | If skipped |
| --- | --- | --- | --- | --- | --- | --- |
| County ArcGIS Server / open-data portal | FREE_ACCOUNT_REQUIRED | enterprise catalog | unknown until login | HIGH if open | No | Web Adaptor login; portal HTTP 500 |
| Middlesex County Zoning FeatureServer | OPEN_GIS_SERVICE | zoning polygon | MUNI, ZONENAME, Zone_code, Use_, Redevelopm (2794 / 25 munis) | CONTRACTOR/INVESTOR HIGH | Metadata + counts | No geometries in git |
| Site Specific Incentives Map | OPEN_GIS_SERVICE | overlay | 8 layers (portfields 6, SID 8, BDA 5, FTZ 5, UEZ 3, redevelopment 426, transit villages 4, Main Street 2) | CONTRACTOR/INVESTOR HIGH | Layer counts | Not a CRE database |
| NJGIN parcels/MOD-IV (Middlesex filter) | OPEN_GIS_SERVICE | parcel + MOD-IV | same statewide schema; 243019 features | LENDER/INVESTOR HIGH | Count + schema | Not reacquired |
| SearchNG land records | OPEN_SEARCH_ONLY | recorded instrument | deeds 1929+, mortgages 1950+, other 1958+; liens, assignments, trade names, block/lot | LENDER/CONTRACTOR/INVESTOR HIGH | Audit only | No scrape |
| CivilView sheriff sales (countyId=73) | OPEN_SEARCH_ONLY | listing row | sheriff #, status, date, plaintiff, defendant, address | LENDER/INVESTOR HIGH | Status inventory (175) | No defendant/address dump |
| Consumer Affairs | OPEN_SEARCH_ONLY | 3-year business lookup | phone/email | ASK/MOVE/CONTRACTOR HIGH | Request drafted | No bulk file |
| ADRC / senior centers / congregate meals | OPEN_BULK_DOWNLOAD | facility | 8 meal sites complete; 12 senior centers extracted | SENIOR HIGH | Partial HTML | Remaining munis from official page; no PDF deep-extract |
| Services Locator | OPEN_SEARCH_ONLY | zip search | program referral | SENIOR MEDIUM | Documented | Not a bulk API |

## F. Middlesex easy-win data acquired

- Zoning municipality counts and attribute schema
- Site-incentive layer inventory and counts
- Sheriff-sale **status** snapshot: 175 listings, 72 scheduled, 43 purchased-3rd-party, 53 adjourned, 5 redeemed, 2 bankruptcy-related
- 8 congregate meal sites + 12 senior centers + ADRC
- NJGIN Middlesex parcel count and field inventory

## G. Land-record access decision

Both counties: **OPEN_SEARCH_ONLY**. No scraper. No undocumented API claim.

- Monmouth OPRS: Clerk search + Tax Board computerized MOD-IV/sales with **per-query export**. Terms: as-is, not for title searches, traffic monitored.
- Middlesex SearchNG: browser/desktop session search, 5am–11pm. Clerk cannot do title searches.

Narrow metadata-index requests (no images, no owner-name product) are drafted. Do not wait on OPRA.

## H. Sheriff-sale access decision

Both counties publish a current CivilView HTML listing. That is a public table, not a bulk API.

Acquired: **status inventory only**.

Deliberately omitted from fixtures: defendant names, property addresses, plaintiff strings. This is not a foreclosure marketing list and not a borrower dossier.

Semantics preserved:

- Scheduled ≠ completed
- Adjourned ≠ completed
- Bankruptcy ≠ completed
- Redeemed ≠ completed sale
- Purchased - 3rd Party = completed-sale status on the Middlesex listing
- Monmouth snapshot had **zero** completed-sale rows

Monmouth sales: every other Monday, 1:00 p.m., 2500 Kozloski Road, Freehold.

## I. Consumer-affairs requests

Both counties offer staff-mediated business complaint-history lookup. No bulk file.

Drafted, not sent, not waited:

- `docs/nj-counties/monmouth-consumer-affairs-request.md`
- `docs/nj-counties/middlesex-consumer-affairs-request.md`

Business grain only. No complainant PII or narratives. Complaint ≠ violation.

## J. Senior / community sources

Monmouth: ADRC 732-431-7450; 12 senior centers + 3 other sites; Interfaith Neighbors and JFCS home-delivered meals.

Middlesex: ADRC 732-745-3295 / 1-877-222-3737; 8 congregate meal sites complete; 12 of the municipal senior-center listings extracted from the official page (remaining municipalities should be copied from the same page). Resource Directory PDF not deep-extracted. Services Locator is zip search only.

Not a senior household profile.

## K. GIS / open-data sources

Priority path that worked:

1. NJGIN FeatureServer `Parcels_Composite_NJ_WM` / layer 0 / item `533599bbfbaa4748bf39faf1375a8a9c` — paginated REST, OWNER_NAME redacted.
2. Middlesex zoning FeatureServer `be5d52d532cb4da281cd6849b9bdd223` — paginated REST, 2794 features, 25 municipalities.
3. Middlesex incentives FeatureServer `4e96db8e3621407c83cc3674364ddded` — 8 layers.

Reusable pagination (attribute-only):

```
GET {layer}/query?where=...&outFields=...&returnGeometry=false&resultRecordCount=2000&resultOffset={n}&f=json
```

Do not commit geometries.

Did not work / skipped:

- Monmouth GeoHub `data.json` HTTP 500; search API HTTP 400
- Middlesex `mcgisweb` REST catalog = Web Adaptor login
- Middlesex open-data portal HTTP 500
- NJTPA zoning FeatureServer HTTP 403 + restricted license

## L. Source-terms / privacy issues

- Daniel’s Law: do not restore OWNER_NAME from county search into public layers
- OPRS / SearchNG: not title plants; as-is disclaimers
- CivilView: summary listing, no warranty
- NJTPA zoning: redistribution prohibited
- No owner-name search product, borrower history, foreclosure marketing list, resident dossier, or senior household profile

## M. Data we deliberately skipped

- Bulk OPRS / SearchNG scrape
- CAPTCHA / session replay
- Deed images
- Defendant names and sheriff-sale address dumps
- Huge parcel/building shapefiles in git
- Statewide NJGIN/DCA/FEMA/NJDEP/ACS reacquisition
- Municipal-by-municipal crawl
- Restaurant-inspection extraction
- Full ADRC resource-directory PDF
- Commercial real-estate database from site-selection GIS
- Waiting on OPRA

## N. Recommended data to put on the four-county spine

1. County FIPS + municipality join keys on top of NJGIN parcels (already statewide)
2. Middlesex zoning attributes (MUNI, Zone_code, ZONENAME, Use_, Redevelopm)
3. Middlesex incentive-layer presence flags (UEZ, redevelopment, transit village, brownfield, SID)
4. Sheriff-sale **status counts** by county (not address lists)
5. ADRC + senior-center / congregate-meal facility rows
6. Consumer-affairs business-grain extracts **if/when** the drafted requests return
7. Land-record instrument-type monthly counts **if/when** metadata indexes return

Do not put owner names, defendants, or deed images on the spine.

## O. Hub value matrix (county roll-up)

| Hub | Monmouth | Middlesex |
| --- | --- | --- |
| ASK | HIGH | HIGH |
| MOVE | HIGH | HIGH |
| LENDER | HIGH | HIGH |
| INSURANCE | MEDIUM | MEDIUM |
| SENIOR | HIGH | HIGH |
| CONTRACTOR | HIGH | HIGH |
| INVESTOR | HIGH | HIGH |

Move HIGH is the **complaint-history capability**, not a mover roster. Statewide PMW remains the roster source.

## P. Next ticket recommendation

ATH-NJ-COUNTY-002 — four-county spine assembly **after** Builder 4 finishes Somerset/Union:

- Join keys: county_fips + municipality + PAMS_PIN
- Ingest Middlesex zoning attributes and incentive flags (no geometries in git)
- Publish senior-center / ADRC facility rows
- Keep sheriff sales as a status feed, not a list product
- Send (do not wait on) the four request letters if Legal/Ops approves
- Then California state-level, as directed: only four NJ counties before CA

No county SEO pages until a later publication ticket.
