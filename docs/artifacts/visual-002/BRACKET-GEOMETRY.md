# VISUAL-002 Addendum — Bracket geometry audit

**Date:** 2026-08-21 (addendum session)  
**Worktree:** `ask-visual-002`  
**Contractor production:** **not modified**

## Canonical source

**Ask / Move stroke-bracket family** — reference: `components/ask-network-mark.tsx`  
`viewBox="0 0 36 36"`, bracket `strokeWidth="2.4"` (**6.67%** of mark height), outer dots `r="2.5"`, center `r="2.1"`, spacing **7.8**.

Contractor filled gold brackets are **not** canonical.

## Rule

> The bracket-and-four-point TrustHub mark is immutable network geometry. Hub identity changes through accent color and wordmark, not through bracket thickness, proportions, dot geometry or spacing.

## Verdict block

| Check | Result |
|-------|--------|
| **CANONICAL BRAND MARK** | **PASS** (AskNetworkMark + Move stroke SVG define the lock) |
| **CONTRACTOR CURRENT MARK** | **TOO HEAVY** |
| **CONTRACTOR ASSET CORRECTION REQUIRED** | **YES** (at Contractor visual migration — re-export asset; no CSS fake-fix; **no production change in VISUAL-002**) |
| **OTHER HUB LOGO-GEOMETRY OUTLIERS** | Investor (heavier stroke ~11.4% of bracket H); Senior (mild heavy stroke 8% + larger dots); Insurance favicon/icon SVG is **shield architecture** (not brackets); Lender PNG-in-SVG wrappers (prefer true stroke SVG); Ask `public/brand/logo.svg` legacy hexagon tile |

Full table: `docs/trusthub-network-visual-standard-v1.md` §G2.

## Simulation

`docs/artifacts/visual-002/hub-hop.html` — all seven Hubs share one canonical SVG mark, accent-colored brackets only.
