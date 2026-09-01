# ATH-SEARCH-002 golden-query report

Contract under test: `move-network-resolver-v1`. Move identity rows are source-owned; other hubs use their declared structured capability only. `HANDOFF` is correct where a requested grain cannot be safely executed.

| # | Query | Intent / hubs | Result class | Identity confidence | Consumer outcome | Status |
|---:|---|---|---|---|---|---|
| 1 | Find USDOT 3244649 | identifier / Move | EXACT_IDENTITY | EXACT_IDENTIFIER | SHIFL INC; USDOT and MC shown | PASS |
| 2 | Find MC 1019808 | identifier / Move | EXACT_IDENTITY | EXACT_IDENTIFIER | SHIFL INC; source-owned identity | PASS |
| 3 | SHIFL | company / Move | AMBIGUOUS_IDENTITIES | FUZZY_CANDIDATES | Possible published identities | PASS |
| 4 | two men and a truck | company / Move | AMBIGUOUS_IDENTITIES | AMBIGUOUS_NAME | 8 displayed; live full census 100; no ranking | PASS |
| 5 | College Hunks | company / Move | AMBIGUOUS_IDENTITIES | FUZZY_CANDIDATES | Possible published identities | PASS |
| 6 | Colleg Hunks | company / Move | AMBIGUOUS_IDENTITIES | FUZZY_CANDIDATES | Possible published identities | PASS |
| 7 | Unknown Mover XYZ | company / Move | NO_CONFIDENT_MATCH | NO_CONFIDENT_MATCH | Zero results and corrective actions | PASS |
| 8 | Is Sunshine State Movers a legitimate licensed mover in Florida? | company / Move | NO_CONFIDENT_MATCH | NO_CONFIDENT_MATCH | Zero results; no Florida cohort | PASS |
| 9 | Find CRD 166089 | identifier / Investor | EXACT_IDENTITY | EXACT_IDENTIFIER | SEC/IARD-owned research | PASS |
| 10 | Find NPN 10391484 | identifier / Insurance | EXACT_IDENTITY | EXACT_IDENTIFIER | State DOI/NIPR-owned research | PASS |
| 11 | Find CMS CCN 105502 | identifier / Senior | EXACT_IDENTITY | EXACT_IDENTIFIER | CMS-owned research | PASS |
| 12 | Show active roofing contractors in Broward County | structured / Contractor | RESEARCH_COHORT | — | Active roofing credential cohort; county is recorded record geography | PASS |
| 13 | Roofing contractors in Broward | structured / Contractor | RESEARCH_COHORT | — | Neutral cohort, not ranking | PASS |
| 14 | Show Florida RIAs reporting between $1B and $10B RAUM | structured / Investor | RESEARCH_COHORT | — | RAUM is regulatory reporting, not performance | PASS |
| 15 | What does TrustHub know about Broward? | place / relevant hubs | MARKET_OR_PLACE_RESEARCH | — | Source-specific geography retained | PASS |
| 16 | What does TrustHub know about Florida? | place / relevant hubs | MARKET_OR_PLACE_RESEARCH | — | No coverage-parity claim | PASS |
| 17 | I'm buying a home in Broward County. What should I research? | journey / multiple hubs | HANDOFF | — | Independent Move/Lender/Insurance/Contractor pathways | PASS |
| 18 | I'm moving to Florida and buying a house | journey / multiple hubs | HANDOFF | — | Evidence remains separate | PASS |
| 19 | best movers in Miami | ranking bait / Move | RESEARCH_COHORT | — | Ranking stripped; neutral source order | PASS |
| 20 | best cheap movers near me | ranking bait / Move | HANDOFF | — | No best/cheap recommendation | PASS |
| 21 | is this insurance company good? | judgment / Insurance | HANDOFF | — | No endorsement claim | PASS |
| 22 | compare a mover, a lender, and a contractor in one score | universal score | UNSUPPORTED_QUERY | — | Universal score rejected | PASS |
| 23 | USDOT ABC | malformed identifier / Move | UNSUPPORTED_QUERY | — | Structured input correction; not no-match | PASS |
| 24 | Intentionally Unknown Business QZX-991 | unknown business | NO_CONFIDENT_MATCH | NO_CONFIDENT_MATCH | No unrelated filler | PASS |

Geography meaning and provenance are retained per hub in Trace. Move identity responses name `move-network-resolver-v1`, `move-search-v1`/FMCSA source provenance, recorded-HQ semantics, source clock, and canonical specialist destinations.

## Acceptance metrics

- Golden queries: 24
- Passed: 24
- `FALSE_CONFIDENT_ANSWERS = 0`
- `UNEXPLAINED_EMPTY_STATES = 0`
- `RAW_TEMPLATE_LEAKS = 0`
- `MARKET_FALLBACKS_FROM_IDENTITY_FAILURE = 0`
- `UNSUPPORTED_CONFIDENCE_UPGRADES = 0`
- `UNIVERSAL_SCORES_GENERATED = 0`
- `PAID_ORDERING_SIGNALS = 0`
