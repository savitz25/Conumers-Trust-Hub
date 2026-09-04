# Washington build sequence (ATH-WA-001)

Internal prioritization from **actual** 2026-09-04 evidence. Not a consumer ranking. No Trust Score.

Contractor, Move, Senior, and Insurance were evaluated as likely early priorities. The files **do not** support copying Texas (Insurance first because Texas has no statewide GC) or copying California blindly.

Contractor is **first**. Evidence confirms it; it does not merely assume it.

## Evaluation

| Hub | Bulk roster? | Exact IDs? | Contacts? | Ease |
| --- | --- | --- | --- | --- |
| **Contractor** | Yes — 160,923 L&I registrations; 75,823 ACTIVE; bond + insurance joined exactly | ContractorLicenseNumber, UBI | Phone 160,850; address complete; no email | **HIGH** |
| **Senior** | Yes — GIS current 6,179 AFH + 557 ALF + 16 ESF | DSHS LicenseNumber | Facility phone + address | **HIGH** (after contractor) |
| **Move** | No CSV. Official Active HHG directory **285** (HTML) | UTC ID, UBI, USDOT | UNKNOWN until a bounded harvest | **MEDIUM / LOW** this ticket |
| **Insurance** | No producer bulk. Company lookup SEARCH_ONLY. 2,924 is an annual-report aggregate | WAOIC/NPN/NAIC on lookup | Lookup only | **LOW** as an early specialist — OIC commercial-use bar |
| Lender | No bulk company roster | NMLS on some orders | UNKNOWN | LOW — do not invent a denominator |
| Investor | No state-RIA bulk | CRD on planned overlay | UNKNOWN | LOW until IARD overlay |

## Sequence

1. **WA-CON-001** (next specialist) — L&I general + bond + insurance three-layer join on ContractorTrustHub. Exact ID only. Publish business contacts from L&I phones/addresses. Suppress principals. Optionally add the official debar CSV. Do not scrape Verify. Do not rank contractors.
2. **WA-SEN-001** — DSHS GIS current AFH/ALF/ESF on SeniorTrustHub + CMS overlay **ownership only** (CCN↔state ID only with an official crosswalk). Do not scrape fortress locators. DSHS ≠ CMS.
3. Move is **not** an early CSV win: no bulk file; 285-row Active HHG table is bounded HTML. WA-MOVE-001 only if a deterministic bounded export is confirmed. STATE AUTHORITY ≠ FMCSA.
4. Insurance is **not** early Washington (unlike Texas TDI): producer lists are SOURCE_USE_RESTRICTED; do not bulk-ingest individuals.
5. Lender stays thin (DFI/NMLS search + bounded enforcement HTML + later HMDA overlay). HMDA ≠ license roster.
6. Investor stays search-only until SEC/IARD WA principal-office overlay. WA principal office ≠ state registration. CRD ≠ current WA authority.

Public Ask `/washington` is published by **ATH-WA-002** as the six-hub network gateway. ATH-WA-001 did not create `/washington`. No Washington city or county routes.

Do not start Arizona until this Washington foundation is merged.
