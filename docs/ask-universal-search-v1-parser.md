# AskTrustHub Universal Search v1 — Deterministic Parser (ASK-SEARCH-003)

**Status:** Implemented (library only — not wired to public UI)  
**Entry:** `parseUniversalSearchQuery()` from `lib/search`  
**Contract:** architecture + lexicon + `docs/fixtures/ask-universal-search-intent-corpus.v1.json`

## Behavior

```text
string query → normalize → exclusions → life-event → lexicon → geography stub → confidence flags
         → TrustHubSearchIntent
```

- **No** LLM / Places / external geo / specialist API calls  
- Providers are **never** returned — intent only  
- Preview/UI/index/handoff adapters = later tasks (ASK-SEARCH-004+)

## Modules

| File | Role |
|------|------|
| `lib/search/types.ts` | `TrustHubSearchIntent` and related types |
| `lib/search/normalize.ts` | Curated misspellings + cleanup |
| `lib/search/lexicon.ts` | Phrases, exclusions, single tokens |
| `lib/search/geography.ts` | Offline state/city/ZIP/county stub |
| `lib/search/confidence.ts` | Helpers (categorical confidence applied in parser) |
| `lib/search/parser.ts` | `parseUniversalSearchQuery` |
| `lib/search/index.ts` | Public exports |

## Tests

```bash
npm run assert:search-003
```

Runs all **119** corpus fixtures + critical regressions + performance timings.

## Geography limitation

ZIP/city tables are **stubbed** for corpus coverage. Designed for drop-in full gazetteer later without changing the parse API.

## Not in scope

Public search UI, discovery index, Hub adapters, AI assist execution, specialist repo edits.
