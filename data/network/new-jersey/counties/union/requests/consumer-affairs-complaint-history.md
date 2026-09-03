# Narrow non-PII request — Union County Consumer Affairs complaint history

**Status:** Draft only. Not submitted from this ticket.  
**Access class:** SOURCE_AVAILABLE_BY_REQUEST  
**Office:** Union County Office of Consumer Affairs  
**Public page:** https://ucnj.org/public-safety/office-of-consumer-affairs/  
**Phone (existing lookup):** 908-654-9840  
**OPRA channel:** https://ucnj.org/departments/clerk-of-the-board/opra/

## Why this is high value

The office already tells consumers it will check whether complaints are on file against a Union County business. A structured, non-PII extract would give Contractor, Move, and Ask a county complaint-history layer that statewide NJDCA does not replace.

## Requested fields (no complainant PII, no narratives)

| Field | Notes |
| --- | --- |
| business legal name | as recorded |
| DBA | if maintained |
| business municipality | Union County municipality |
| business category | as classified by the office |
| complaint year | year opened |
| complaint category | office taxonomy |
| status | open / closed / referred, as maintained |
| disposition | as recorded |
| enforcement referral | yes/no or destination agency if recorded |
| closed date | if closed |

## Explicit exclusions

- complainant name, address, phone, email
- narrative complaint text
- settlement amounts tied to a person
- any field that would reconstruct a consumer identity

## Semantic constraints for any later use

- COUNTY COMPLAINT != VIOLATION
- absence of a row != zero complaints and != clean history
- not a ranking, Trust Score, or “verified vendor” list
