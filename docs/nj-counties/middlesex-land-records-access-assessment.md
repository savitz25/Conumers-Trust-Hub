# Middlesex County land-records access assessment

Ticket: ATH-NJ-COUNTY-001A  
County: Middlesex (FIPS 34023)  
Checked: 2026-09-03  
Access class: **OPEN_SEARCH_ONLY**

## Official system

- Search portal: https://mcrecords.co.middlesex.nj.us/recordssearch/
- Clerk land-records page: https://www.middlesexcountynj.gov/government/departments/department-of-community-services/office-of-county-clerk/recording-services/land-records
- Product: SearchNG (browser and desktop). Desktop notes a one-time Microsoft .NET Framework 2.0+ install.
- Hours: seven days, 5:00 a.m. to 11:00 p.m.; Clerk may restrict access for maintenance.

## Coverage stated by the Clerk

- Deeds recorded from 1 January 1929 to present
- Mortgages from 1 January 1950 to present
- All other documents from 1 January 1958 to present

Document families named on the Clerk land-records page:

- deeds
- mortgages
- maps
- liens
- releases
- easements
- powers of attorney
- trade names
- assignments
- medical licenses
- veteran peddler licenses

Deeds must indicate tax block, lot, and consideration at recording.

The Clerk **cannot perform title searches**. Staff will familiarize visitors with the computerized indexing system.

## API / bulk path

- No documented public API
- No supported bulk export found
- Session-based search client
- Do **not** scrape

## Semantics

- Public land record ≠ recommendation
- Mortgage recording ≠ current balance
- Construction lien ≠ contractor wrongdoing
- Lis pendens ≠ completed foreclosure
- Clerk search is not a title plant

## Decision

OPEN_SEARCH_ONLY. Documented. Not scraped.

A narrow metadata-index request is worthwhile for Lender / Contractor / Investor county spine work. See `middlesex-land-record-index-request.md`.
