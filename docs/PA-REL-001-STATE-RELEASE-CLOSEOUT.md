# PA-REL-001 — State release closeout standard

A state release is not complete merely because its canonical route exists.

A Production state closeout requires:

1. Canonical-route success (`/{state}` HTTP 200, real content, `index,follow`, self-canonical)
2. Sitemap publication of the lowercase statewide route exactly once
3. Intended user-facing discovery (header/By State, footer research links, homepage/coverage/places where those surfaces exist)
4. Valid internal links using lowercase `/{state}`
5. Exact specialist/network handoffs
6. Safe URL normalization for published statewide intelligence routes

Mixed-case published state paths such as `/Pennsylvania` must permanently redirect (308) to `/{state}` before serving indexable content. This rule does **not** lowercase business slugs, IDs, auth codes, or API paths.

This standard is reusable for future North Carolina and Ohio closeouts.
