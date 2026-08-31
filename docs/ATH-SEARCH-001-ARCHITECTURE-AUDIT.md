# ATH-SEARCH-001 architecture audit

Audit date: 2026-08-31. Baseline: `0afcd1b02317ada996f88dc9f3384da95cdde35e` (`origin/main`). Production checks were read-only.

## Current request path

`/ask` and the homepage `NetworkAskInput` submit natural language to `parseNetworkAsk`, then `buildNetworkAskPlan` selects only capability-declared hubs. `assembleNetworkAnswerWithSpecialist` calls the selected public specialist contract (`move-ask-v1`, lender, insurance, senior, investor, or Contractor HTML), normalizes it in `ask-plan.ts`/`consumer-ask.ts`, and `NetworkAskResult` renders options plus trace/provenance. Specialist publication URLs are preserved by `entity-destination.ts`.

The parser and planner are `lib/network/ask-parse.ts` and `ask-plan.ts`. Capability metadata is `capability-registry.ts`; identifier metadata is `identifiers.ts`. Hub adapters are `move-ask.ts`, `lender-ask.ts`, `insurance-ask.ts`, `senior-ask.ts`, and `investor-ask.ts`. Normalization and presentation policy are split between `ask-plan.ts`, `consumer-ask.ts`, `entity-destination.ts`, and `components/network-ask-result.tsx`. Provenance is assembled by `tracesForPlan`. Fallback behavior is in `hubPlan`, `applyConsumerPresentation`, and each `apply*Payload` function.

## Reproduced root causes

### Sunshine State Movers

Production Move `GET /api/ask?q=Is%20Sunshine...Florida` interpreted the request as an entity cohort (`role=carrier`, `state=FL`) and returned 269 Florida-headquartered carrier identities. The specialist payload contained no name-resolution assertion. Ask accepted any `entity` payload and rendered its rows. There was no firewall comparing a specific-identity request with the specialist response grain. This is a contract mismatch, not a missing UI label.

### two men and a truck

The phrase contains none of Ask's mover keywords, so the parent parser can classify it as a definition with no selected hub. When sent directly to production Move `api/ask`, that endpoint also discards the name and returns the unfiltered 4,321-row carrier cohort. Move's homepage Search V1 has a separate public-name resolver, but `move-ask-v1` exposes no canonical name-resolution result or duplicate-name cohort. Ask therefore cannot truthfully reproduce the specialist resolver today.

### `924 as a recommendation`

This is not array-index corruption. The literal sentence is authored in the Broward roofing preview in `ask-plan.ts`: `Ask does not rewrite 924 as a recommendation.` The count was intentionally interpolated into consumer limitation copy. It must be replaced with semantic copy; numeric values belong in the result metric, not the explanation template.

## Required boundary

Ask must classify every answer, detect specific identity intent before geography/cohort fallback, and reject a cohort-shaped payload for that intent. Move must eventually return a bounded canonical resolver response containing resolution class, normalized query, exact/ambiguous published identities, canonical URLs, identifiers, location/role, publication state, and source clock. Until that exists, Ask must return `NO_CONFIDENT_MATCH`/`HANDOFF`, never simulate resolution with fuzzy parent heuristics.

## Safety invariants

- One top-level result class per response.
- A specific-company request cannot consume a market/cohort payload.
- Fuzzy candidates cannot become identity claims.
- Publication state and canonical specialist destinations are source-owned.
- Geography remains source-specific and never implies service territory.
- Cross-hub evidence remains separate; no score, paid order, or recommendation order.
