# ASK-SEARCH-006B — Real multi-hub discovery pilot

**Status:** Engine/data/handoff layer only. No customer-facing Universal Search UI. Not deployed.

**006B.1:** Integrated onto current `origin/main` (VISUAL-009 chassis freeze) without rolling back newer Ask chrome/docs. Search engine remains additive.

ASK-SEARCH-006B.0 importer did **not** exist in reachable history. This task adds a generic `ask-network-discovery-v1` loader on top of ASK-SEARCH-003/004/005.

## Architecture reused

| Module | Role |
|---|---|
| `lib/search/parser.ts` | Deterministic query parser |
| `lib/search/lexicon.ts` | Intent lexicon |
| `lib/search/adapters/` | Hub adapter registry + handoff |
| `lib/search/discovery/` | NetworkDiscoveryEntity + in-memory index |
| `lib/search/feeds/` | Real-feed import, provenance, activation policy |

No second parser. No second discovery engine.

## Active feeds

See `data/network-discovery/feeds/provenance.json`.

Snapshots are copied unmodified. Insurance uses an **explicit** field projection (`network_id` → `network_entity_id`, `profile_url` → `canonical_profile_url`, `eligible` → `active`). Contractor snapshot stays 200 rows; Ask **activates** only Florida READY trades.

## Ranking

Score = hub + entity + category + geographic precision.

Tie-break: score desc, then `display_name`, then `network_entity_id`.

Forbidden: payment, Premium, ads, leads, popularity, ratings, reviews, Trust Score, RAUM.

Precision (high → low): physical ZIP/city → physical county → county service area (incl. ZIP→county) → physical state → licensed/HMDA/state service → nationwide.

Top Matches: max 7, no padding.

## Contractor activation

Hub-wide adapter remains `soft_handoff` (004 contract). Ask search activation is Florida READY only: roofing, plumbing, HVAC (CAC), pool, CGC. NJ is not a READY Top Matches source. View More uses Contractor `/from-ask`.

## Handoff

Allowlist: `src, journey, state, county, intent, entity, category, city, zip, sid`.

View More: Move keeps local-mover routes; Lender/Insurance/Contractor Florida use specialist `/from-ask`.

Entity: canonical specialist URL + allowlisted context. No raw query.

## Next

ASK-SEARCH-007 — consumer Top Matches UI. Do not start in this task.
