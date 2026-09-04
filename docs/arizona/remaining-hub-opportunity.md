# Arizona remaining-hub opportunity (ATH-AZ-001)

Not a consumer ranking. No Trust Score.

## Lender — intelligence, not entities

Existing canonical HMDA 2025 Arizona partition (Lender-Trust-Hub slice, not re-ingested):

- 15 of 15 counties
- 308,338 applications / 183,374 originations / 49,721 denials (county-sum)
- Ask fallback clock: 307,379 / 183,374 / 49,376
- Purpose (apps): purchase 133,513 · refinance 105,498 · other 69,327
- Loan type (apps): conventional 224,912 · FHA 52,160 · VA 30,364 · USDA/other 902
- 953 LEI state rows · 123 high-confidence LEI maps

HMDA ≠ license roster. DIFI mortgage classes run through NMLS. Thentia is licensee login. No bulk company CSV found.

## Investor — only remaining entity-growth path

Regulator verified: **Arizona Corporation Commission Securities Division** (not DIFI).

Public search: BrokerCheck + IAPD. Do not scrape.

Bulk: ACC list-request PDF offers CSV for dealer firms, IA licensed in AZ, and IA notice-filed in AZ, with CRD. SOURCE_AVAILABLE_BY_REQUEST. Not filed.

Existing overlay: 213 Arizona principal-office firms in the Investor census. That is **not** Arizona state registration.

Enforcement: ACC Actions HTML with CRD and docket PDFs. Name-only = UNSAFE.

## Insurance — paid or search-only

DIFI + NAIC SBS. Lookup is search-only. Report generator is paid. Enforcement HTML prints NPN/NAIC/SBS numbers. Surplus-lines PDFs are company eligibility lists, not Arizona agencies.

## Move — deregulated at state grain

Official AG: Arizona has no registration law or professional licensing requirement for movers.

DPS HHG page: interstate = FMCSA; in-state verify = ACC Entity Search (business registration, not a mover license). Hostage-load statute A.R.S. §§ 44-1611–1616. ROC R-22 is contractor structure-moving.

No state HHG identity to add.

## ACC business identity (cross-hub)

eCorp Entity Search is OPEN_SEARCH_ONLY. No free bulk/API found. Arizona entity ID could theoretically key Move / Insurance / Lender / Investor / Contractor, but this ticket **stops** at search-only. Do not crawl Entity Search.
