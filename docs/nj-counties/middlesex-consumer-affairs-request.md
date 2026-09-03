# Middlesex County consumer-affairs non-PII request

Ticket: ATH-NJ-COUNTY-001A  
Status: Draft only. Do not wait for a response on this ticket.

## To

Middlesex County Office of Inspections — Consumer Affairs  
PO Box 7367, North Brunswick, NJ 08902  
Phone: 732-398-2300  
Email: consumer@co.middlesex.nj.us

## Current public capability

The office will search whether a business has had a complaint filed **within the last 3 years** by phone or email. There is no bulk download or API.

If Consumer Fraud Act violations are found, County Counsel may take the case to municipal court. That is a separate enforcement path.

Complaint ≠ violation. A filed complaint is not a finding of fraud.

## Why this is useful

Business-grain, non-PII history would add county evidence for MoveTrustHub, ContractorTrustHub, and AskTrustHub.

## Requested grain

One row per **business + year + complaint category**.

## Requested fields

- business name
- DBA
- business municipality
- business category
- complaint year
- complaint category
- open / closed
- disposition category
- enforcement referral (yes/no or municipal-court referral flag, not a case file)
- closed date (month/year is enough)

## Exclude

- complainant PII
- narratives
- supporting documents

## Preferred period and format

The office’s stated 3-year public-search window, as a CSV extract. Annual files are acceptable.

## Use

Public-interest research index. Not a ranking. Missing rows are unknown, not zero.
