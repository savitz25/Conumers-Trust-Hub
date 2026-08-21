# VISUAL-002 — AskTrustHub reference shell artifacts

**Open these first (visual judgment, not Markdown):**

| Deliverable | Path |
|-------------|------|
| OLD vs NEW board (HTML) | [`compare.html`](./compare.html) |
| Side-by-side desktop 1440 | [`compare-desktop-1440.jpg`](./compare-desktop-1440.jpg) |
| Side-by-side mobile 390 | [`compare-mobile-390.jpg`](./compare-mobile-390.jpg) |
| Side-by-side header | [`compare-header-desktop.jpg`](./compare-header-desktop.jpg) |
| Full compare board JPEG | [`compare-board.jpg`](./compare-board.jpg) |
| Future multi-Hub header board | [`hub-hop.html`](./hub-hop.html) · [`hub-hop-board.jpg`](./hub-hop-board.jpg) |

**AFTER captures:** `after/` (desktop, switch, mobile, drawer, network, viewport sweep, `qa.json`)  
**BEFORE captures:** `before/` (production baseline)

## Geometry addendum

See [`BRACKET-GEOMETRY.md`](./BRACKET-GEOMETRY.md). Canonical mark: `components/ask-network-mark.tsx`.

## Other-Hub outliers (documented — no production edits in VISUAL-002)

| Hub | Status |
|-----|--------|
| Contractor | TOO HEAVY — re-export at Contractor visual migration |
| Investor | HEAVIER — evaluate/thin at migration |
| Senior | MILD HEAVY — normalize at migration |
| Lender | Prefer clean canonical SVG re-export |
| Insurance | Audit header mark vs shield icon treatment |
| Ask | Legacy alternate asset cleanup may be needed (`public/brand/logo.svg` hexagon) |

## Capture

```bash
ASK_ORIGIN=http://127.0.0.1:3011 node capture-after.mjs
node make-composites.mjs
node verify-a11y.mjs
```
