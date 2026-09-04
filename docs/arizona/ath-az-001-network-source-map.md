# Arizona six-hub source map (ATH-AZ-001)

Ask research foundation (ATH-AZ-001). Public `/arizona` is **not** published this ticket. No specialist-repo edits. State level only. No city or county routes.

Checked: **2026-09-04**.

Exact counts only. UNKNOWN means the number was not obtained. Missing ≠ zero. SEARCH_ONLY ≠ zero. License row ≠ unique company. Data row ≠ entity growth.

---

## Scope

- Arizona **state** sources only.
- No Phoenix, Tucson, Mesa, Scottsdale, Maricopa County, or Pima County work.
- No Trust Score, no paid ranking, no best/worst lists.
- No person-scale publishing decisions in Ask.
- Do not duplicate ROC (AZ-CON-001). Do not redo Senior (AZ-SEN-001).

## What this ticket actually acquired

**Nothing bulk.** No free official roster for Move, Insurance, Lender, or Investor was ingestible under the stop rules.

Counted, not dumped:

| Source | Number | Grain | Status |
| --- | --- | --- | --- |
| FMCSA MCMIS `az4n-8mr2` phy_state=AZ | **60,519** / active **31,875** | all motor carriers, **not** HHG | COUNTED, not ingested |
| HMDA Arizona (already in Ask) | **307,379** applications / **183,374** originations / **49,376** denials | mortgage applications, **not** lenders | ALREADY_ACQUIRED |
| Ask `az_roc` license rows | **58,408** | contractor licenses, **not** unique companies | OWNED_BY_AZ_CON_001 |
| Senior CMS Arizona | NH **140** / HH **177** / hospice **237** | CMS facilities | ALREADY_PUBLISHED |
| AZ-SEN-001 accepted ledger | canonical **0** / state identities **2,776** / enriched **544** / evidence **2,779** | closed | DO_NOT_REDO |

## Where actual companies can be added

| Hub | Free bulk that adds companies? | What would add companies? | This ticket |
| --- | --- | --- | --- |
| **Contractor** | Yes — ROC (in flight) | AZ-CON-001 | Do not duplicate |
| **Senior** | Already shipped | AZ-SEN-001 (0 net-new canonical; 2,776 state identities) | Do not redo |
| **Move** | **No.** Arizona has no mover license | Nothing at state level. FMCSA overlay enriches existing 5,022 | Documented |
| **Insurance** | **No** free bulk | Paid SBS Report Generator only ($0.03/row, $30 min, CSV) | Not purchased |
| **Lender** | **No** free bulk | NMLS is search-only. HMDA is not companies | Not scraped |
| **Investor** | **No** free bulk | IARD overlay = existing 25,777 firms. ACC lists by PRA only | PRA not filed |
| **ACC eCorp** | **No** free bulk | Public-records request of all AZ entities (wrong universe for hubs) | PRA not filed |

## Hub map (short)

| Hub | Authoritative bulk? | Exact IDs | Contacts | Blockers |
| --- | --- | --- | --- | --- |
| **CONTRACTOR** | ROC — Builder 3 | ROC license | UNKNOWN this ticket | Do not duplicate AZ-CON-001 |
| **MOVE** | **No statewide HHG roster** | USDOT on federal overlay only | UNKNOWN | AG 2025-07-07: no registration/licensing law |
| **INSURANCE** | Lookup free; report paid | NPN / NAIC on lookup | email+address in **paid** CSV | **$0.03/row, $30 min** — do not buy |
| **SENIOR** | Already live | CMS CCN + AZ state identity | already published | Do not redo |
| **LENDER** | No company roster | NMLS on verify | UNKNOWN | Do not scrape NMLS; do not invent a denominator |
| **INVESTOR** | No state-RIA bulk | CRD on IARD overlay | UNKNOWN | ACC lists SOURCE_AVAILABLE_BY_REQUEST; AZ principal office ≠ state registration |

## Semantic guardrails (do not collapse)

ARIZONA HAS NO STATEWIDE MOVER LICENSE · HOSTAGE-LOAD STATUTE ≠ ROSTER · ACC ECORP ≠ PROFESSIONAL LICENSE · ROC R-22 ≠ HOUSEHOLD GOODS · USDOT ≠ INTERSTATE AUTHORITY BY ITSELF · FMCSA AZ PHYSICAL CENSUS ≠ MOVERS · HQ ≠ SERVICE TERRITORY · PRODUCER ≠ AGENCY ≠ INSURER · LICENSE ROW ≠ UNIQUE COMPANY · DATA ROW ≠ ENTITY GROWTH · NPN PERSON ≠ BUSINESS PROFILE · SBS LOOKUP IS FREE · SBS REPORT GENERATOR IS PAID · NMLS ≠ HMDA · HMDA APPLICATIONS ≠ LENDER COMPANIES · LOAN ORIGINATOR IS A PERSON · AZ PRINCIPAL OFFICE ≠ ACC STATE IA REGISTRATION · CRD ≠ CURRENT AZ AUTHORITY · CMS ≠ ARIZONA STATE FACILITY IDENTITY · SEARCH_ONLY ≠ ZERO · UNKNOWN ≠ ZERO · MISSING ≠ ZERO · NO TRUST SCORE · NO PAID RANKING · NO ASK /ARIZONA THIS TICKET

## Files

`data/network/arizona/` — source-manifest, identity-source-map, expansion-ledger-blueprint, value-per-hour-matrix, build-order, acquisition-summary, contact-source-summary, cross-hub-source-map, hub subfolders.

Probe dumps `data/raw/arizona/probe-*.json` are gitignored.
