# Monmouth County land-record metadata index request

Ticket: ATH-NJ-COUNTY-001A  
Status: Draft only. Do not wait for a response on this ticket.  
Request type: metadata index, not deed images.

## To

Monmouth County Clerk  
Office of Records Management / OPRS  
Hall of Records, Freehold, NJ

Copy: Monmouth County Board of Taxation (for MOD-IV / sales-data questions)

## Why this is narrow

We already have statewide NJGIN parcels / MOD-IV (OWNER_NAME redacted). We do **not** need images, owner dossiers, or a title plant.

We need a **machine-readable document-index extract** so Ask / Lender / Contractor / Investor hubs can count recorded instrument types by municipality and month without scraping OPRS.

## Requested fields (metadata only)

For each recorded instrument in a recent closed period (suggest last 24 calendar months):

- instrument type / document class (deed, mortgage, assignment, discharge/release, construction/mechanics lien if indexed, lis pendens if indexed, trade name, other)
- recording date
- municipality
- block
- lot
- qualification code if present
- book and page or instrument number
- consideration / sale price **only where the public index already stores it**
- document class code used by the Clerk

Do **not** send:

- deed or mortgage images
- grantor/grantee name files for a public product
- borrower or homeowner lists
- narratives

## Preferred format

CSV or TSV, one row per instrument. Monthly files are acceptable.

## Use and limits

Research/index use for Trust Hub county intelligence. Not a title search. Not an owner-name search product. Not a foreclosure marketing list.

## Legal notes we will honor

- Public land record ≠ recommendation
- Mortgage recording ≠ current balance
- Daniel’s Law redactions remain in place
- OPRS terms: as-is, not for title searches
