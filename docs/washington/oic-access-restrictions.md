# Washington OIC access / commercial-use restrictions (ATH-WA-001)

Checked: 2026-09-04.

## Classification

| Source | Use class |
| --- | --- |
| OIC Agent and Company Lookup | **SEARCH_ONLY** |
| OIC lists of individuals (PRA) | **SOURCE_USE_RESTRICTED** |
| OIC Orders search | **SEARCH_ONLY** |
| SERFF Filing Access | **SEARCH_ONLY** |
| OIC 2025 annual report entity counts | **PUBLIC_BULK_OK** as an aggregate only (2,924 is not a roster) |
| L&I insurance `CreatedBy_WAOIC_ID` | **Not an OIC producer list** |

## Why producer bulk is blocked

OIC: “You must fill out a commercial use declaration if you are requesting a list of individuals.”

The Public Records Act **prohibits** state agencies from providing “lists of individuals requested for commercial purposes” (RCW 42.56). OIC examples of commercial purpose include recruiting agents and offering products to agents.

Do **not**:

- Bulk-ingest individual producers from the lookup tool
- Scrape the agent/company lookup
- Treat L&I `CreatedBy_WAOIC_ID` as a producer roster
- Collapse OIC producer with OIC agency
- Treat name-only matches as EXACT

Company / agency / rate / order opportunity remains:

- Lookup verification by WAOIC / NPN / NAIC
- SERFF filings by NAIC (search)
- Orders search (search; attach only on exact IDs)
- Annual-report **aggregates** and later a true company bulk **if** OIC publishes one without a commercial-use bar

Missing company bulk ≠ zero authorized insurers.
