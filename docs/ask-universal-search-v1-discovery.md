# AskTrustHub Universal Search v1 — Discovery Schema & Local Fixture Index (ASK-SEARCH-005)

**Status:** Implemented (local fixtures only — not production sync)  
**Fixture corpus:** `docs/fixtures/ask-universal-search-discovery-entities.v1.json`

## Thin-parent boundary

Ask stores enough to **FIND** (identity, type, category, geo/service area, eligibility, canonical specialist URL).

Ask does **not** store complaints, documents, Trust Score internals, calculators, consumer PII, or paid-ranking fields.

## Identity

```text
network_entity_id = {hub}:{source_entity_id}
```

Examples: `move:usdot-3141592`, `senior:ccn-675120`, `investor:crd-104986`.

## Modules

| Path | Role |
|------|------|
| `lib/search/discovery/types.ts` | Entity + search result types |
| `lib/search/discovery/identity.ts` | ID helpers + Hub identity notes |
| `lib/search/discovery/schema.ts` | Validation + preview eligibility |
| `lib/search/discovery/ranking.ts` | Explainable scores / top-7 slice |
| `lib/search/discovery/index.ts` | In-memory fixture index |

## Discovery eligibility vs SEO

`discovery_status: active | held | disabled` is **Ask Universal Search eligibility**, not Google indexability.

## Tests

```bash
npm run assert:search-005
```

## Non-goals

Production DB/publishers, UI, AI, Places, specialist edits, ASK-SEARCH-006.
