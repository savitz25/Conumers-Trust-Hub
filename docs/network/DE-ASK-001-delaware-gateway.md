# DE-ASK-001 — Delaware state gateway

Reviewed 2026-10-12 after production verification of all six Delaware specialist routes. The source-native summaries, clocks, source URLs, SHA identifiers, and acquisition gaps are recorded in `data/network/delaware-publication-manifest.json`.

## Publication contract

- State scope only; no county or local routes.
- Six specialist routes link to their production pages and retain each source's distinct classes, entity grain, and clock.
- NOT_ACQUIRED and NOT_RECONCILED remain explicit; neither means zero or inactive.
- Cross-hub totals are rejected. No ratings, Trust Score, ranking, or recommendation is established.
- HMDA activity is not licensing; complaints and inspections are not enforcement findings; appointments are relationships, not licensees; state and federal motor-carrier authority remain separate.
- Delaware's provider record classes are not written into Ask's graph.

## Specialist production routes

| Hub | Route | Production SHA |
| --- | --- | --- |
| MoveTrustHub | https://www.movetrusthub.com/moving-to/delaware | `ac640794a214049b2344e962845b8b779bb5ea99` |
| ContractorTrustHub | https://www.contractortrusthub.com/delaware | `21c72f24d95a18dc0f72cfbae39a97687e3e896a` |
| LenderTrustHub | https://www.lendertrusthub.com/delaware | `66c4a9c3ad9f2e3ea97e5d1f5de670f615060ce3` |
| InsuranceTrustHub | https://www.insurancetrusthub.com/delaware | `dadb0c1b2a119e09f60454384d15e2a51176e29b` |
| SeniorTrustHub | https://www.seniortrusthub.com/delaware | `2aae4a5c564545c488b7646cd23108ae428c62c3` |
| InvestorTrustHub | https://www.investortrusthub.com/delaware | `98f77ad4668c0dfd90061f5e18fc6d614474c3fc` |

All six routes returned HTTP 200, matched their intended route, and exposed self-canonical plus `index, follow` metadata on 2026-10-12. Existing Delaware HMDA and destination-market data were reused by their respective specialists; no local licensing work or false combined denominator was added.
