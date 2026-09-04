# Arizona insurance: SBS Lookup is free; Report Generator is paid

ATH-AZ-001. Do not buy reports. Do not scrape Lookup.

## Official split

Arizona DIFI license search uses NAIC **State Based Systems**.

| Path | Access | Use |
| --- | --- | --- |
| **Lookup** | Free named-producer / agency / company search | Consumer verify. SEARCH_ONLY. Do not scrape. |
| **Generate a Report** | Paid CSV | OPEN_REPORT_GENERATOR_PAID. **Not purchased.** |

## Exact cost (official SBS Support Center)

Source: https://www.statebasedsystems.com/solar/support.html (checked 2026-09-04).

- **$0.03 per row**
- **$30.00 minimum** per report
- CSV
- Preview of row count and cost before payment
- Fees non-refundable

Sample field list (official how-to PDF): license number, license type, license status, CE compliance, full business address, email, line of authority.

## Grain (do not collapse)

- License **row** ≠ unique **company**
- **Producer** (person, NPN) ≠ **agency** (business entity) ≠ **insurer** (NAIC company)
- Person NPN is not a business profile
- Ask `credentialsByJurisdiction` has **no Arizona key** (FL/TX are listed). Missing ≠ zero Arizona agencies.

## This ticket

`acquisition_status`: `NOT_ACQUIRED_PAID`

AZ-INS-001 stays a thin search + enforcement-identity page. Enforcement HTML is paginated — do not scrape. Attach adverse evidence only on exact NPN or NAIC.

DIFI pages returned HTTP 403 Cloudflare on 2026-09-04 probes. 403 ≠ proof the official URLs are gone.
