# Stage B.2 — Ask Orchestration (“What’s Happening?”)

## Goal

AskTrustHub accepts a simple situation and generates an **ordered multi-hub research path** into Move / Lender / Insurance with Stage A′ journey params — without duplicating specialist tools or collecting PII.

## Surfaces

| Surface | Role |
|---------|------|
| Homepage `#whats-happening` | Live path generator + visited-step progress |
| Concierge | Free-form questions (AI); chips point at common situations |
| `/journeys/*` | Editorial long-form paths |
| Specialist hubs | Deep research tools and directories |

## Situation routing

| Situation | Ordered path |
|-----------|--------------|
| Moving + buying | Move → Lender → Insurance |
| Moving + renting | Move → Insurance |
| Buying locally | Lender → Insurance |
| Refinance | Lender only |
| Coverage after move | Insurance primary; Move secondary |
| Pure mover search | Move only |
| Unknown | Move + Insurance optional; **no forced mortgage** |

## Stage A′ deep-link contract

All public handoffs use absolute crawlable URLs with:

- `src=ask`
- `journey` = `relocate` | `purchase` | `refi` | `coverage` when known
- `state` = 2-letter when known
- `county` = slug when known
- `intent` = `buy` | `rent` | `refi` when known

### Examples

**Moving + buying (Miami-Dade):**

```text
https://www.movetrusthub.com/moving-to/miami?src=ask&journey=relocate&state=FL&county=miami-dade&intent=buy
https://www.lendertrusthub.com/local-lenders/florida/miami-dade?src=ask&journey=relocate&state=FL&county=miami-dade&intent=buy
https://www.insurancetrusthub.com/destinations/florida?src=ask&journey=relocate&state=FL&county=miami-dade&intent=buy
```

**Moving + renting (Texas):**

```text
https://www.movetrusthub.com/local-movers/texas?src=ask&journey=relocate&state=TX&intent=rent
https://www.insurancetrusthub.com/destinations/texas?src=ask&journey=relocate&state=TX&intent=rent
```

**Local purchase (no county):**

```text
https://www.lendertrusthub.com/local-lenders/florida?src=ask&journey=purchase&state=FL&intent=buy
https://www.insurancetrusthub.com/destinations/florida?src=ask&journey=coverage&state=FL&intent=buy
```

**Refinance:**

```text
https://www.lendertrusthub.com/local-lenders/florida?src=ask&journey=refi&state=FL&intent=refi
```

## Fail soft

- County optional — land on state or national research surface
- Insurance destination guides only for published slugs; others use `/destinations?state=` soft-land
- Move city hubs only for known published cities; else state mover hub or site root with params

## Progress (Ask origin only)

- Key: `ath:ask-journey-progress:v1`
- Marks steps visited when the user clicks through
- Shows “X of N visited” — no login, no cross-domain sync

## Code map

| File | Responsibility |
|------|----------------|
| `lib/orchestration/journey-links.ts` | Stage A′ URL builders |
| `lib/orchestration/path-generator.ts` | Situation → ordered steps |
| `lib/orchestration/progress.ts` | localStorage progress |
| `components/whats-happening-planner.tsx` | UI |

## QA checklist

1. **Moving + buying** — FL + miami-dade + Miami city → 3 steps, county on Lender, destination on Insurance  
2. **Moving + renting** — TX → Move + Insurance only; no Lender primary  
3. **Local purchase** — state only → Lender state page + Insurance  
4. **Refinance** — single Lender step with `journey=refi`  
5. Progress — click step 1, reload planner with same situation/state → visited badge  
6. No PII fields (name/email/phone) on the planner  
