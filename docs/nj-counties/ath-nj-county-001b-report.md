# ATH-NJ-COUNTY-001B — Somerset and Union quick-win county data

Ask-side acquisition and source-access audit only. No public pages, routes, sitemap, Vercel, or specialist-repo edits. Paths limited to Somerset and Union county directories so this does not collide with Builder 3 (Monmouth / Middlesex).

Checked: 2026-09-03.

## A. STATUS

COMPLETE for this ticket’s scope: easy high-value sources inventoried; Somerset senior-housing GIS acquired as a small fixture; Union program semantics acquired; rabbit holes documented and skipped; no production deploy.

## B. REPOSITORY / SHAS

- Repo: `savitz25/Conumers-Trust-Hub`
- Parent `origin/main` at start: `2e0b303ab419c95590d5e51cfa708fad1e4ce041`
- Isolated worktree: `C:\Users\Michael.Savitsky\ask-ath-nj-county-001b`
- Branch: `ath-nj-county-001b-somerset-union`

## C. SOMERSET SOURCES FOUND

Open Data Hub (DCAT-US, 75 datasets) plus:

| Family | Access |
| --- | --- |
| Housing Options FeatureServer | OPEN_GIS_SERVICE |
| Nursing Homes geocode | OPEN_GIS_SERVICE |
| Tax Parcel Viewer + 200-ft widget | OPEN_SEARCH_ONLY |
| County Parcels FeatureServer (NJGIN overlap) | OPEN_GIS_SERVICE, skip bulk |
| AcclaimWeb land records | FREE_ACCOUNT_REQUIRED |
| Sheriff sales HTML | OPEN_SEARCH_ONLY |
| SFHA / hydro / LULC | county-hosted statewide extracts |
| Sewer, roads, parklands, ROSI | OPEN_GIS_SERVICE |
| Office on Aging / ADRC | OPEN_SEARCH_ONLY |

## D. SOMERSET EASY-WIN DATA ACQUIRED

- Hub catalog metadata
- Housing Options: 200 records; **58 senior-related** fixture (`fixtures/senior-housing-inventory.json`, ~35 KB)
- Nursing homes: 14-record fixture
- Layer inventory with service URLs, field lists, geometry, counts (`fixtures/gis-layer-inventory.json`)

No raw shapefiles, no parcel dump, no owner names.

## E. SOMERSET SENIOR-HOUSING RESULT

The official Planning Board map/list is the Housing Options FeatureServer (`44741becfc49453890487e2e0df4d29a` / layer 0), also used by Housing Navigator (58 senior developments on the senior page).

Fields acquired: facility, category, living type, address, municipality, phone, program, tenure, age/income restriction, unit counts, project id.

**Not** NJDOH or CMS licensure. Source as-of is **May 2023** point-in-time. Categories preserved: Senior Residence, Assisted Living Facility, CCRC, Active Adult Community.

## F. SOMERSET GIS RESULT

This is the high-value county GIS. Documented REST + Hub downloads. Differentiated layers: housing, sewer service areas (48), county-maintained roads (2,171), parklands/ROSI. Parcels exist (132,911) but duplicate NJGIN — not re-acquired. Terms: GIS Digital Product Sharing Policy; as-is; not for legal/financial commitments.

## G. SOMERSET LAND-RECORD DECISION

**Skip automation.** AcclaimWeb requires a free account (email activation). Search covers name, book/page, instrument, legal description, document type, consideration, record date. No bulk API. Clerk will not run a title search.

## H. UNION SOURCES FOUND

| Family | Access |
| --- | --- |
| Clerk UCPA land records | OPEN_SEARCH_ONLY (paid full images) |
| Consumer Affairs | SOURCE_AVAILABLE_BY_REQUEST |
| Home Improvement Program | OPEN_SEARCH_ONLY (rules); list by request |
| Senior Home Improvement Grant | OPEN_SEARCH_ONLY (rules) |
| GIS HTML5 viewer | OPEN_SEARCH_ONLY (thin) |
| Sheriff sales | OPEN_SEARCH_ONLY |
| Division on Aging / ADRC | OPEN_BULK_DOWNLOAD (PDFs cited, not copied) |

## I. UNION EASY-WIN DATA ACQUIRED

Program semantics fixture: HIP + senior grant (municipalities, benefit type, administrator, dated amounts). ADRC contacts and current PDF citations. Clerk and Sheriff capability notes. Two request drafts.

## J. UNION CONSUMER-AFFAIRS RESULT

Office is live (908-654-9840, Westfield). It will check whether complaints are on file against a Union County business. **No public structured history.** Non-PII OPRA/request artifact drafted. Complaint ≠ violation.

## K. UNION HOME-IMPROVEMENT-PROGRAM SEMANTICS

CDBG deferred loan for owner-occupied 1–2 family homes in 15 participating municipalities. Independent rehab in Elizabeth, Linden, Plainfield, Rahway, Union. Staff write-up, bid review, inspections. **Not a Union County contractor license.** Preferred class: `UNION_COUNTY_HOME_IMPROVEMENT_PROGRAM_PARTICIPANT`.

## L. UNION PARTICIPANT DATA AVAILABILITY

**Not published.** Contractor application is emailed to Development Directions LLC. Request drafted for name/DBA/address/HIC-if-stored/status/dates. Ticket did not wait on a response.

## M. LAND-RECORD / SHERIFF-SALE DECISIONS

**Somerset land records:** FREE_ACCOUNT_REQUIRED, skip.  
**Union land records:** name index 1977-06-01–2026-01-21; pre-1986 images incomplete (not a zero index); $600/year for full online images; no scrape.  
**Somerset sheriff:** HTML list with status vocabulary; do not scrape buyers; scheduled ≠ completed.  
**Union sheriff:** 2026 Wednesday schedule is public; current lot list is not a clean table; skip aggregators.

## N. DATA DELIBERATELY SKIPPED

Statewide NJGIN parcels, FEMA, NJDEP hydro/LULC, building footprints, Acclaim sessions, Clerk search scraping, Union viewer reverse-engineering, sheriff buyer names, ADRC PDF binaries, waiting on OPRA.

## O. TERMS / PRIVACY ISSUES

Daniel’s Law owner redaction on Somerset parcel products. Union GIS disclaimer: internal product, no warranty, not a survey. No person/owner lookup product. No complainant PII. No reconstruction of 200-ft “legal notice” lists.

## P. HUB VALUE MATRIX

See county `hub-value-matrix.json`. Highest differentiated value:

- Somerset Housing Options → Senior, Ask
- Somerset sewer/roads GIS → Contractor, Ask
- Union Consumer Affairs (if released) → Contractor, Move, Ask
- Union HIP/Senior grant → Contractor, Senior, Ask
- Union ADRC → Senior, Ask
- Land records / sheriff → Lender, but search-only for now

## Q. DATA RECOMMENDED FOR FOUR-COUNTY SPINE

1. Somerset Housing Options senior subset (live FeatureServer, source categories, May 2023 clock)
2. Somerset GIS Hub catalog pattern (do not copy NJGIN/FEMA/NJDEP)
3. Somerset sewer service areas (query live)
4. Union HIP / senior grant program cards with dated amounts
5. Union Consumer Affairs as a request-backed complaint-history source (not live rows yet)
6. Union ADRC directory citation

Do **not** put county parcels, Acclaim, or sheriff HTML into the spine until a no-PII structured extract exists.

## R. NEXT TICKET RECOMMENDATION

**ATH-NJ-COUNTY-002** (Ask publish, after 001A/001B merge): Somerset senior-housing discovery cards on a *non-indexable* internal or staged county brief — still no public county routes unless a later publication ticket says so.

**ATH-NJ-COUNTY-REQ-001:** Submit Union Consumer Affairs and HIP participant requests.

Do not start Union GIS mining. Do not scrape land records.
