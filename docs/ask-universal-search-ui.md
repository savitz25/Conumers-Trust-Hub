# ASK-SEARCH-007 — Universal Search UI

**Status:** Customer-facing UI on branch/preview only. Not production-enabled. Not deployed.

Uses the ASK-SEARCH-006B.1 real index (692 active entities). Synthetic 005 fixtures are test-only.

## Entry

- Homepage: `#universal-search` natural-language form (additive; Concierge remains)
- `/search?q=` — noindex, omitted from sitemap, generic share metadata (no raw-query OG titles)

## States

idle, loading (`app/search/loading.tsx`), results (Top Matches), empty, unsupported, needs clarification, error.

## Top Matches

Max 7, no padding, engine order unchanged. View More uses specialist `/from-ask` (Move keeps local routes).

## Privacy

Raw query stays on Ask (`q` on `/search` only). Specialist URLs are allowlisted context only.
