# VISUAL-001 production artifacts

Captured 2026-08-21 against canonical `www` hosts with Playwright (1440×900 desktop, 390×844 mobile). Read-only. No production UI was changed.

## Hub-hop boards

Desktop (1440): `desktop/{hub}-home.jpg` in order ask → move → lender → insurance → contractor → senior → investor.

Mobile (390): `mobile/{hub}-home.jpg` same order.

Header crops (where a semantic `header` existed): `headers/{hub}-{desktop|mobile}.png`.

Switch Hub open: `desktop/{hub}-switch-hub.jpg` and `mobile/{hub}-switch-hub.jpg` when the trigger was found.

## Measurements

`measurements.json` — computed bounding boxes. Caveats:

- Move **desktop home** first pass was a loading skeleton (`header`/`logo` 0×0). Recapture: `desktop/move-home.jpg`. Prefer Move **desktop inner** and **mobile home** for logo geometry.
- `contentWidth` / `leftGutter` are viewport-level (`main` is often full-bleed). Use logo `x` as the content-edge proxy.
- Logo CSS boxes are not optical ink (especially Senior 352×115 and Ask tagline lockups).

Do not commit `node_modules/` from the local capture toolchain.
