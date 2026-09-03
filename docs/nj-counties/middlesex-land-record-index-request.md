# Middlesex County land-record metadata index request

Ticket: ATH-NJ-COUNTY-001A  
Status: Draft only. Do not wait for a response on this ticket.  
Request type: metadata index, not deed images.

## To

Middlesex County Clerk  
Recording / Land Records  
75 Bayard Street, New Brunswick, NJ 08901  
P.O. Box 1110, New Brunswick, NJ 08903

## Why this is narrow

Statewide NJGIN already supplies parcel geometry and redacted MOD-IV. SearchNG is a public search portal, not a bulk API. We will not scrape it.

We need a **machine-readable instrument index** (type, municipality, block/lot, recording date) for county-level research.

## Requested fields (metadata only)

For each recorded instrument in a recent closed period (suggest last 24 calendar months):

- document type (deed, mortgage, assignment, release/discharge, lien, trade name, other)
- recording date
- municipality
- block
- lot
- book and page or instrument number
- consideration **only where already stored on the public index**

Do **not** send:

- images
- grantor/grantee name extracts for a public owner-search product
- borrower lists

## Preferred format

CSV, one row per instrument.

## Use and limits

Research/index use. Not a title search. Not an owner-name product. Daniel’s Law redactions remain in place.
