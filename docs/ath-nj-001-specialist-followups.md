# ATH-NJ-001 specialist followups

AskTrustHub does not patch specialist repositories from this ticket.

## Release gate

All six specialist `/new-jersey` pages returned HTTP 200 as intended state intelligence pages (self-canonical, index,follow) before Ask `/new-jersey` was made indexable.

## Remaining specialist coverage (not Ask defects)

These are source/coverage gaps owned by specialist hubs. Missing evidence is unknown, not zero.

- **Move:** complete NJ PM/PW/PC roster request. State mover authority is not FMCSA interstate authority.
- **Lender:** RMLA/servicer roster. HMDA is not a license roster.
- **Insurance:** SERFF blocked; CRIB republication restricted. Complaint ≠ violation; exam ≠ enforcement.
- **Senior:** CCRC/service-area crosswalk. Facility office ≠ service area.
- **Contractor:** PWCR roster; contractor attribution on statewide construction rows. Source records ≠ permits/projects.
- **Investor:** complete state-RIA roster. SEC/IARD NJ firms ≠ state-RIA universe.

## Texas reuse (ATH-NJ-001 blueprint)

Reusable without copying NJ facts:

- state hub manifest (`data/network/<state>-publication-manifest.json`)
- six-hub gateway page + cards
- state intent routing overlay
- release verification script requiring six HTTP 200 intended intelligence pages
- semantic guardrails (missing ≠ zero; no Trust Score; no paid ranking; source-grain caveats)
- cross-hub QA (Florida regression, federated Ask, Concierge, customer/claim, sitemap)

Do not clone NJ county names, roster counts, or source-specific caveats into Texas.
