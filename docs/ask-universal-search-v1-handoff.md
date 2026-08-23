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

Prefer status-aware APIs:

- **View More** → `resolveViewMoreDestination(intent)` → `{ status: 'ok' | 'unsupported' | 'soft_handoff' | 'needs_clarification' | 'disabled' }`
- **Entity click** → `resolveEntityDestination(entity, intent)` / `buildEntityHandoff`

Entity handoff shape:

```text
canonical specialist profile URL
+ src=ask
+ normalized non-PII search context
+ handoffType=entity (on result / analytics)
+ backLabel metadata for future “← Back to …” (specialist UI not implemented here)
```

## Maturity / capability

| Value | Meaning |
|-------|---------|
| `ready` | Known specialist route can support meaningful preloaded search handoff |
| `soft_handoff` | Ask understands Hub/category; precise SERP preload not guaranteed |
| `disabled` | Must not participate |

| Hub | Maturity |
|-----|----------|
| Move, Lender, Insurance | `ready` |
| Contractor, Senior, Investor | `soft_handoff` |

Fail-closed examples: memory care → `unsupported`; multi-hub ambiguity → `needs_clarification`; loan officer → soft company directory.

## Analytics metadata (on result, not PII URL dump)

`source`, `destinationHub`, `handoffType`, `entityType`, `category`, `state`, `county`, `city`, `zip`, `maturity`

## Tests

```bash
npm run assert:search-004
```

## Out of scope

Discovery index, Top Matches UI, specialist back button, specialist-repo changes, AI, Places, deploy, ASK-SEARCH-005.
