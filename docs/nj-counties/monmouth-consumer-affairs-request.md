# Monmouth County consumer-affairs non-PII request

Ticket: ATH-NJ-COUNTY-001A  
Status: Draft only. Do not wait for a response on this ticket.

## To

Monmouth County Division of Consumer Affairs  
Hall of Records Annex, 1 E. Main Street  
P.O. Box 1255, Freehold, NJ 07728-1255  
Phone: 732-431-7900  
Email: consumeraffairs@co.monmouth.nj.us

## Current public capability

The Division states that the public can obtain a **complaint history on a business** before doing business with that company. That lookup is staff-mediated. There is no bulk download or API.

Complaint ≠ violation. Mediation ≠ enforcement. Referral ≠ finding.

## Why this is useful

Business-grain, non-PII complaint counts would add county evidence for:

- MoveTrustHub (movers / household-goods complaints where categorized)
- ContractorTrustHub (home-improvement and related categories)
- AskTrustHub (general business complaint history)

## Requested grain

One row per **business + year + complaint category**, not per complainant.

## Requested fields

- business name
- DBA
- business municipality
- business category
- complaint year
- complaint category
- open / closed
- disposition category
- enforcement referral (yes/no or agency name, not a case file)
- closed date (month/year is enough)

## Exclude

- complainant name, address, phone, email
- narratives / complaint text
- copies of contracts, checks, or receipts
- any other consumer PII

## Preferred period and format

Calendar years 2023, 2024, 2025 (and 2026 year-to-date if easy). CSV.

## Use

Public-interest research index. Not a ranking. Not a “worst businesses” list. Missing rows are unknown, not zero.
