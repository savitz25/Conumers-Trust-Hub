# AskTrustHub Universal Search v1 — Hub Adapters & Handoff (ASK-SEARCH-004)

**Status:** Implemented (library only — not wired to public UI)  
**Depends on:** ASK-SEARCH-001 / 001.1 / 002 / 003  

## Pipeline

```text
query → parseUniversalSearchQuery → TrustHubSearchIntent
      → buildViewMoreHandoff / buildEntityHandoff
      → specialist URL + allowlisted structured context
```

## Modules

| Path | Role |
|------|------|
| `lib/search/handoff.ts` | Allowlisted serialize/parse; back labels |
| `lib/search/adapters/types.ts` | `HubSearchAdapter`, `NetworkDiscoveryEntity` |
| `lib/search/adapters/hubs.ts` | Six Hub adapters |
| `lib/search/adapters/registry.ts` | Registry + `buildViewMoreHandoff` / `buildEntityHandoff` |

## Allowlisted params

Stage A′: `src`, `journey`, `state`, `county`, `intent`  
Search extensions: `entity`, `category`, `city`, `zip`, optional `sid`  

**Never** transferred: raw free-text `query`, email, name, phone, coordinates.

## Option A / Option B

- **View More** → `buildViewMoreHandoff(intent)`  
- **Entity click** → `buildEntityHandoff(entity, intent)` (retains search context + `backLabel`)

Ambiguous multi-hub intents return `null` from View More (clarification first).

## Maturity

| Hub | Maturity |
|-----|----------|
| Move, Lender, Insurance | `ready` (structured paths) |
| Contractor, Senior, Investor | `soft_handoff` (context attached; Hub may seed later) |

## Tests

```bash
npm run assert:search-004
```

## Out of scope

Discovery index, Top Matches UI, specialist-repo changes, AI, Places, deploy.
