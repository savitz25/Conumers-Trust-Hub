# MOVE-SEARCH-NET-001 bounded resolver requirement

Ask requires a source-owned Move resolver response before it can present company-name matches. `move-ask-v1` currently returns a carrier cohort for name-shaped questions and is insufficient.

The future response must include: `contract`, `normalizedQuery`, exactly one resolution class (`EXACT_CANONICAL_NAME`, `EXACT_PUBLIC_NAME`, `NORMALIZED_NAME`, `AMBIGUOUS_NAME`, `FUZZY_CANDIDATES`, `NO_CONFIDENT_MATCH`), and zero or more published identities. Each identity must carry legal name, public name where applicable, USDOT/MC, recorded headquarters, regulatory role, canonical Move URL, publication state, source family, and source clock. Ambiguous identities must be unranked. Fuzzy candidates must never be promoted to an identity claim. Publication eligibility must be evaluated by Move.

Until that contract is available, Ask discards cohort payloads returned for specific-name requests and reports `NO_CONFIDENT_MATCH` with a Move Search handoff.
