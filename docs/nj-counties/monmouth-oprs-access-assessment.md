# Monmouth OPRS access assessment

Ticket: ATH-NJ-COUNTY-001A  
County: Monmouth (FIPS 34025)  
Checked: 2026-09-03  
Access class: **OPEN_SEARCH_ONLY**

## Official system

- Home: https://oprs.co.monmouth.nj.us/Oprs/Index.aspx
- Terms: https://oprs.co.monmouth.nj.us/oprs/TermsOfUse.aspx
- Clerk help: https://oprs.co.monmouth.nj.us/oprs/clerk/help.htm
- Operator: Office of Records Management, a division of the Monmouth County Clerk

## What the public search covers

Clerk / property records:

- Deeds (digitized current search described from 1970)
- Mortgages (described from 1976)
- Other recorded documents from 1996
- IRS liens from 2010 (county communications; confirm in-system)
- Trade names
- Subdivision maps
- Property identification by municipality, block, lot, and address
- Consideration / sale price on deed records where present

Tax Board:

- Tax list image archive (address, owner, block/lot indexes)
- Computerized **MOD-IV** (property information)
- Computerized **Sales Data** from 1995 to current (grantor, grantee, price, date, deed book/page)
- Tax maps (scanned municipal maps)
- Tax appeal judgments and tax rate certifications

The Tax Board “Computerized Data” help text states that search results are **exportable**. That is a per-query export of search results, not a documented bulk API or nightly dump.

## What is not confirmed as a current bulk index

- Construction / mechanics liens as a live Clerk document class (Archives holds historical mechanics liens 1845–1930)
- Lis pendens as a dedicated indexed class
- Document images as a redistribution dataset

Absence of a dedicated class in this assessment is **unknown, not zero**.

## API / bulk path

- No documented public API
- No Clerk bulk image dump
- Tax Board query export exists for MOD-IV and sales searches
- Free public search is **not** authorization to bulk scrape
- Terms: as-is / as-available; no warranty of accuracy, currentness, or fitness; traffic is monitored under Title 18 language

## Semantics (must travel with any later use)

- Public land record ≠ recommendation
- Mortgage recording ≠ current balance
- Lis pendens ≠ completed foreclosure
- Construction lien ≠ contractor wrongdoing
- OPRS is **not for title searches**
- OWNER_NAME on the statewide NJGIN web service is redacted under Daniel’s Law; do not restore owner names from OPRS into public network products

## Decision

Do **not** build a scraper.

If a structured county index is needed, request **metadata only** (no deed images, no owner-name product). See `monmouth-land-record-index-request.md`.
