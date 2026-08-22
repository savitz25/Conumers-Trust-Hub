# VISUAL-009 — TrustHub Network Seven-Hub Certification & Design-System Freeze

**Date:** 2026-08-22  
**Status:** FROZEN — production certified  
**Method:** Live Playwright audit at identical 1440 / 768 / 390, DPR=1. No production UI was changed.  
**Evidence:** `docs/artifacts/visual-009/`  
**Captured at:** 2026-08-22T16:28:01Z

This document supersedes VISUAL-001 as the **production baseline**. VISUAL-001 remains the historical pre-migration audit. Future Hub work must not casually reintroduce drift against this freeze.

---

## 1. Verdict

**CERTIFIED.**

All seven live Hubs share the frozen chassis. No material contract failure. No remediation ticket is opened.

Residual, non-blocking notes are listed in §12. They are not license to restyle the network.

---

## 2. Production SHA inventory

| Hub | GitHub | origin/main SHA | tip | Vercel project | Project ID | Canonical | Live `data-th-chassis` |
|---|---|---|---|---|---|---|---|
| Ask | savitz25/Conumers-Trust-Hub | `31b20cda` | VISUAL-002 | conumers-trust-hub | prj_925ZdSHjPhPU7pH9WiwyNOK1MrZB | https://www.asktrusthub.com | `2026.08.21-visual-v1` |
| Move | savitz25/Move-trust-Hub | `cf42ae00` | FL-C011 after VISUAL-006 | move-trust-hub | prj_gudPGeW9SZBkgiL8zxvi3Swfo6T0 | https://www.movetrusthub.com | `2026.08.21-visual-v1` |
| Lender | savitz25/Lender-Trust-Hub | `5a4954d2` | VISUAL-004 | lender-trust-hub | prj_Il28Mv0ebRiIrumFO7iBX6JrSbdD | https://www.lendertrusthub.com | `2026.08.21-visual-v1` |
| Insurance | savitz25/Insurance-trust-hub | `fb9db9c9` | VISUAL-005 | insurance-trust-hub | prj_ARBlfWYNhpJWBtaPO4vUJlraa5BK | https://www.insurancetrusthub.com | `2026.08.21-visual-v1` |
| Contractor | savitz25/contractor-trust-hub | `10c58dde` | VISUAL-007 | contractor-trust-hub | prj_OYmhfgBxZvRAKBPJv5zqshJnJwgq | https://www.contractortrusthub.com | `2026.08.21-visual-v1` |
| Senior | savitz25/care-trust-hub (`apps/web`) | `179061b0` | VISUAL-008 | care-trust-hub | prj_k9GyyXn28JZkyYKqLhBJ4rUQcpUb | https://www.seniortrusthub.com | `2026.08.21-visual-v1` |
| Investor | savitz25/investor-trust-hub | `c71e43d9` | VISUAL-003 | **investor-trust-hub-web** | prj_Qu2DT0AIy8R7XYTQiHgNcDYjE9i8 | https://www.investortrusthub.com | `2026.08.21-visual-v1` |

SHA match notes:

- Ask / Lender / Insurance / Contractor / Senior / Investor main tips are the visual-shell merges (or the merge commit wrapping them). Live chassis stamp matches.
- **Move main advanced after VISUAL-006** (`cf42ae00`, FL county work). Live production still measures as the frozen chassis. Do not treat later product commits as a visual regression unless geometry fails.

Investor remains linked only to `investor-trust-hub-web`. No DNS or relink.

---

## 3. Frozen chassis (production)

| Token | Desktop ≥1024 | Tablet 768–1023 | Mobile |
|---|---|---|---|
| Header | **69px** | **65px** | **57px** |
| Mark optical | **36px** | **33px** | **30px** |
| Logo left @ 1440 | **x=144** | gutter 16 | gutter 16 |
| Switch Hub height | **44px** | in drawer | in drawer |
| Switch Hub @ 1440 | **x=1167, 129×44** (Contractor 124×44 @ x=1172; right edge 1296) | — | — |
| Rows | 1 | 1 | 1 |
| Overflow | 0 | 0 | 0 |
| Shell | 1200 + 24 gutter | — | 16 gutter |
| Chassis stamp | `2026.08.21-visual-v1` | same | same |

Live 1440 measurements (2026-08-22):

| Hub | Header | Mark h | Lock x | Switch Hub | Overflow | Slogan | Network bar |
|---|---|---|---|---|---|---|---|
| Ask | 69 | 36 | 144 | 44×129 @ 1167 | 0 | none | none |
| Move | 69 | 36 | 144 | 44×129 @ 1167 | 0 | none | none |
| Lender | 69 | 36 | 144 | 44×129 @ 1167 | 0 | none | none |
| Insurance | 69 | 36 | 144 | 44×129 @ 1167 | 0 | none | none |
| Contractor | 69 | **36 lock** | 144 | 44×124 @ 1172 | 0 | none | none |
| Senior | 69 | 36 | 144 | 44×129 @ 1167 | 0 | none | none |
| Investor | 69 | 36 | 144 | 44×129 @ 1167 | 0 | none | none |

Tablet 768: all headers **65**. Mobile 390: all headers **57**, menu **44×44**, overflow **0**.

Contractor compact header is an SVG lockup (`img`), so mark optical height = lockup height (36 / 33 / 30). Public mark file ` /brand/contractor-trust-hub-mark.svg` is viewBox 36, stroke 2.4.

---

## 4. Canonical mark

Immutable geometry (Ask path):

- viewBox `0 0 36 36`
- bracket stroke **2.4** (6.67%)
- outer dots **r=2.5** at (18,10.2), (11.2,18), (24.8,18), (18,25.8)
- center **r=2.1** at **(18,18)**
- vertical offset **7.8**; lateral offset **6.8** (this pair is the canonical Ask cross, not drift)

Identity only:

| Hub | Bracket | Node palette |
|---|---|---|
| Ask | `#0A2540` | Ask four-point |
| Move | `#FF5A1F` | Ask four-point |
| Lender | `#0D9488` | Ask four-point |
| Insurance | `#0284C7` | Ask four-point |
| Contractor | `#F5C518` | Contractor orange/blue/teal/purple |
| Senior | `#681860` | Senior cyan/lime family |
| Investor | `#0F766E` | Ask four-point |

**BRACKET: MATCH · STROKE: MATCH · DOTS: MATCH · SPACING: MATCH · CENTER: MATCH · INK BOUNDS: PASS**

Board: `docs/artifacts/visual-009/marks.html`

---

## 5. Lockup rule

All seven compact headers are:

`[canonical mark] + [HUBNAME / TRUST HUB]`

No header slogan. Footer / marketing lockups may keep taglines (Contractor “BEFORE YOU HIRE, VERIFY.” on the full lockup only).

---

## 6. Network Navigator

Live Ask panel (representative; same component family on all seven):

- Heading: **ASK TRUST HUB NETWORK**
- Order: Ask → Move → Lender → Insurance → Contractor → Senior → Investor
- Current hub: **Current** + `aria-current="page"`
- Blurbs from registry `switcherLabel`
- Trigger: 44px, outlined, Inter, “Switch Hub” + chevron

Evidence: `docs/artifacts/visual-009/navigator/`

---

## 7. Specialist typography exceptions (certified, required)

| Hub | Chrome | Display / interior |
|---|---|---|
| Ask | Inter | Inter H1 48/600 |
| Move | Inter chrome | Geist interior H1 52 (performance exception) |
| Lender | Inter | Inter H1 ~52/700 |
| Insurance | Inter | Inter H1 ~52/700 |
| Contractor | Inter in chrome stack | Inter/system H1 48/600 |
| Senior | Inter chrome | **Georgia** H1 **60**/500; cream canvas; 18px-class body |
| Investor | Inter chrome | **Source Serif 4** H1 **58**/400; cream canvas |

Do not delete Senior Georgia or Investor Source Serif 4 to “make them match Ask.”

---

## 8. Overflow / a11y floor

- Horizontal overflow: **0** at 1440 and 390 on all seven.
- Mobile menu target: **44×44**.
- Skip links present on the chassis Hubs.
- Gold (Contractor) is fill/accent, not small body text.

---

## 9. Evidence boards

| Board | Path |
|---|---|
| Desktop hop 1440 | `docs/artifacts/visual-009/hop-1440.html` |
| Tablet hop 768 | `docs/artifacts/visual-009/hop-768.html` |
| Mobile hop 390 | `docs/artifacts/visual-009/hop-390.html` |
| Mark ink-scan | `docs/artifacts/visual-009/marks.html` |
| Raw JSON | `docs/artifacts/visual-009/measurements.json` |

Same viewport, same DPR, same crop origin. Do not rescale per Hub.

---

## 10. What this freeze forbids

Without a new numbered visual ticket:

- Changing header height, mark optical size, or 1440 logo x
- Restoring a stacked Ask Network bar
- Putting slogans in the 69px header
- Thickening or padding the canonical mark
- Swapping Inter chrome for Geist / Source Sans 3 / system-only on a Hub that already loads Inter
- Relinking Vercel projects or changing canonical hosts
- “Quick” logo redesigns (especially Contractor)

---

## 11. What this freeze still allows

- Specialist IA, accents, and content
- Senior Georgia + cream; Investor Source Serif 4 + cream
- Move Geist **interior** only
- Product work that does not touch the shell (search, CMS, licenses, Places bans still apply)

---

## 12. Residual notes (not STOP)

1. **Contractor Switch Hub** is 124×44 at x=1172 because the compact wordmark is wider. Height 44 and shell right-edge 1296 match. Do not restyle unless a future ticket locks trigger **width**.
2. **Lender / Insurance H1 weight 700** vs Ask 600. Personality, not chassis.
3. **Ask** still shows eight desktop nav items; they fit the 69px row.
4. **Move** `origin/main` is ahead of the VISUAL-006 merge; live shell still certifies.
5. Navigator DOM scrape in the harness missed menuitems; screenshots confirm order and Current. No production defect.

No Hub materially failed. No VISUAL-010 remediation is required for chassis geometry.

---

## 13. Recommendation

The seven-Hub visual OS is frozen.

Next visual work should be **named, scoped, and measured against this document**. Suggested optional follow-ups (not opened here):

- VISUAL-010 only if a future hop recapture shows drift
- Token packaging / shared CSS as an engineering convenience, not a redesign
- Contractor Switch Hub width unification **only** if a product owner wants 129px triggers everywhere
