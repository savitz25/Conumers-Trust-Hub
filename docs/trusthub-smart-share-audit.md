# TrustHub Network Smart Share — SHARE-001 audit + SHARE-002 baseline + SHARE-003 contextual cards

**Network deploy rule:** `docs/NETWORK-DEPLOY.md` — repository → correct Vercel project → correct canonical domain.

---

# SHARE-003 — Dynamic ENTITY + CONTENT cards (implemented 2026-08-21)

**Status:** COMPLETE  
**Scope:** Public CONTENT and ENTITY social cards only. No calculator snapshots, saved comparisons, `/share/[id]`, or consumer-specific data (SHARE-004). No Google Places. No unpublished fields.

SHARE-002 Hub fallback remains the safe baseline. Every contextual route uses a stable `/share-og` ImageResponse handler (Next hashes nested `opengraph-image.tsx` filenames and those URLs 404). Missing entity/content data, malformed routes, and render errors fall back to the SHARE-002 card — never 500, blank, `undefined`, or `UNKNOWN`.

Pattern: `generateMetadata()` sets absolute `https://www.{hub}/…/share-og`. Cards are 1200×630, `summary_large_image`, system-ui/Arial only.

**Publication safety:** NO previously unpublished field was exposed. Cards use only fields already rendered on the public page. Absence is never converted into “no complaints / fully verified / approved.”

## SHARE-003 network table

| Hub | Entity cards | Content cards | Fallback | Starting SHA | Final SHA | Vercel project | Deployment | Prod QA | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Move | `/companies/[slug]` | `/local-movers/[state]`, `/local-movers/[state]/[county]` | SHARE-002 ImageResponse | `b167a5ee` | `14b891f2` | move-trust-hub | prod READY | PASS | GO |
| Senior | `/facility/[slug]`, CMS `/facility/cms/[ccn]/[slug]` | — | SHARE-002 ImageResponse | `b8a785f2` | `82b4e4a1` | care-trust-hub | prod READY | PASS | GO |
| Lender | `/lenders/[slug]` | — | SHARE-002 ImageResponse | `39080e46` | `01841a39` | lender-trust-hub | prod READY | PASS | GO |
| Contractor | `/contractors/[slug]` | FL/AZ/WA/OR discovery + guides | SHARE-002 PNG | `96e751ee` | `a00a2aad` | contractor-trust-hub | prod READY | PASS | GO |
| Investor | `/firm/[slug]` official + synthetic | `/research` | SHARE-002 PNG | `c8d500f1` | `68d5654e` | **investor-trust-hub-web** | prod READY | PASS | GO |
| Insurance | `/carriers/[slug]`, verified `/providers/[slug]` | destinations + ACA guides | SHARE-002 PNG | `187f3ac2` | `d93e8e9e` | insurance-trust-hub | prod READY | PASS | GO |
| Ask | — | `/network`, `/guides/[slug]`, `/journeys/[slug]` | SHARE-002 PNG | `d6fe6fa2` | (this commit) | conumers-trust-hub | (after merge) | (after merge) | GO |

## Per-hub SHARE-003 record

### Move

- **Routes:** `/companies/[slug]`, `/local-movers/[stateSlug]`, `/local-movers/[stateSlug]/[countySlug]`
- **Card type:** ENTITY + CONTENT
- **Metadata:** `generateMetadata` + `shareRouteOgImage`
- **Image:** `/…/share-og` ImageResponse (navy + orange accent bar)
- **Fields:** public name, headquarters, USDOT only if `canShowLicenseNumbers()`, interstate/profile label. County/state geography only — no mover lists.
- **Safety:** no ratings, BBB, phone, email. Invalid slug → SHARE-002 card.
- **Tests:** `scripts/assert-share-003.ts`
- **Production:** `https://www.movetrusthub.com/companies/1-800-pack-rat/share-og`, Palm Beach County + Florida local pages. facebookexternalhit / Twitterbot / Slackbot PASS.
- **PR:** https://github.com/savitz25/Move-trust-Hub/pull/43 (final stable `/share-og`; earlier #39/#41 hashed-path attempt)
- **SHA:** `14b891f2`

### Senior

- **Routes:** `/facility/[slug]`, `/facility/cms/[ccn]/[slug]`
- **Card type:** ENTITY
- **Public projection:** same fail-closed identity as the facility page. Name, city/state, care type, CMS/staffing/inspections/ownership research labels.
- **Excluded:** REVIEW_REQUIRED website, PROBABLE identity, UNRESOLVED match, hidden Place IDs, match confidence, cmsOverall/stars/deficiencies/penalties, telephone, street address.
- **Fallback:** SHARE-002 cream/plum Hub card
- **Production:** Harbor Pines `https://www.seniortrusthub.com/facility/harbor-pines/share-og` 1200×630
- **PR:** https://github.com/savitz25/care-trust-hub/pull/3
- **SHA:** `82b4e4a1`

### Lender

- **Routes:** `/lenders/[slug]`
- **Card type:** ENTITY
- **Fields:** name, city/state, numeric NMLS, type. No APR, rates, rating, trustScore, phone, CFPB dumps, Google ratings.
- **Financial-data safety:** no borrower-specific or personalized APR.
- **Production:** Pacific Trust Mortgage `…/lenders/pacific-trust-mortgage/share-og` 1200×630, NMLS 1984721
- **PR:** https://github.com/savitz25/Lender-Trust-Hub/pull/2
- **SHA:** `01841a39`

### Contractor

- **Routes:** `/contractors/[slug]`; `/florida` `/arizona` `/washington` `/oregon` and segment/facet discovery; `/guides/*`
- **Card type:** ENTITY + CONTENT
- **Fields:** displayName, city/county/state, occupation label. No license numbers on the image, no discipline counts, no matchConfidence, no Google Places.
- **Fallback:** exact SHARE-002 PNG `public/brand/contractor-trust-hub-og.png`
- **Worktree:** implemented from `origin/main`; dirty NJ MyLicense worktree was not touched.
- **Production:** MBCS Company entity card; Palm Beach County contractors; Florida state; how-to-verify guide; invalid slug → PNG
- **PR:** https://github.com/savitz25/contractor-trust-hub/pull/2
- **SHA:** `a00a2aad`

### Investor

- **Deployed only to** `investor-trust-hub-web` / `prj_Qu2DT0AIy8R7XYTQiHgNcDYjE9i8`
- **Routes:** `/firm/[slug]`, `/research`
- **Official firms:** displayName, city/region, numeric CRD only. No RAUM/AUM, website hotlink, disclosure-absence-as-endorsement, street address, quality/performance claims.
- **Synthetic (Northbridge):** `SYNTHETIC FIRM RESEARCH` + “Development fixture · not a real firm”. SYN- CRD identifiers are never printed.
- **Production:** Northbridge, `/research`, official `sec-crd-160657` (long dual name truncated), invalid slug → PNG
- **PR:** https://github.com/savitz25/investor-trust-hub/pull/3
- **SHA:** `68d5654e`

### Insurance

- **Justified public routes:** curated `/carriers/[slug]`; fail-closed verified `/providers/[slug]`; `/destinations/[state]` and `[city]`; ACA `/guides/[slug]`
- **Not contextualized:** Medicare contract pages, marketplace plan results, calculators, `/my-insurance` (personalized / SHARE-004 / CMS-endorsement risk)
- **Provider gate:** same `canShowAsVerified` as the public page. Unpublished listings do not get an entity card.
- **No:** CMS endorsement copy, Google Places, phones, ratings, trust scores
- **Production:** Humana carrier card; Florida destination; Florida ACA guide; invalid carrier → PNG
- **PR:** https://github.com/savitz25/Insurance-trust-hub/pull/2
- **SHA:** `d93e8e9e`

### Ask

- **Routes:** `/network`, `/guides/[slug]`, `/journeys/[slug]`
- **Not forced:** homepage and utility pages keep SHARE-002 PNG
- **Card type:** CONTENT (parent discovery layer; no entity directory)
- **Fallback:** `/og/ask-trust-hub-social-card.png`
- **PR / SHA:** recorded at merge of this Ask commit

## SHARE-004 readiness (not implemented)

Ranked first tools:

1. **Native “Share this research” control on public ENTITY pages** — copies canonical URL; Web Share API where available. Highest consumer value, lowest risk (no new data surface).
2. **Privacy-safe comparison share** — opaque `/share/{id}` of already-public entity slugs only, noindex, TTL. High value, medium risk (must not embed account state).
3. **Calculator snapshot share** — last, because inputs can be quasi-PII (income, ZIP+age, loan amounts). Needs redaction rules before any snapshot store.

---

# SHARE-002 — Network social-share baseline (implemented 2026-08-21)

**Status:** COMPLETE  
**Scope:** Generic 1200×630 fallback cards only. No ENTITY/CONTENT cards (SHARE-003). No calculator snapshots or `/share/` routes (SHARE-004). No Vercel domain changes.

Verified allowlist used for every production-affecting push. `MATCH = YES` before each push. No `vercel link`.

## SHARE-002 network table

| Hub | Repo | Starting SHA | Final SHA | Vercel project | Project ID | Canonical | 1200×630 | Twitter large | Prod probe | Visual QA | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Ask | savitz25/Conumers-Trust-Hub | `06d825c77e6c` | `6c08968d2097` | conumers-trust-hub | prj_925ZdSHjPhPU7pH9WiwyNOK1MrZB | https://www.asktrusthub.com | yes PNG | yes | PASS | PASS | GO |
| Insurance | savitz25/Insurance-trust-hub | `e5a3225555cd` | `187f3ac286ea` | insurance-trust-hub | prj_ARBlfWYNhpJWBtaPO4vUJlraa5BK | https://www.insurancetrusthub.com | yes PNG | yes | PASS | PASS | GO |
| Move | savitz25/Move-trust-Hub | `68be79002293` | `38fc5532908b` (on main under later `a5d9b72f`) | move-trust-hub | prj_gudPGeW9SZBkgiL8zxvi3Swfo6T0 | https://www.movetrusthub.com | yes ImageResponse | yes | PASS | PASS | GO |
| Lender | savitz25/Lender-Trust-Hub | `c7f8896e0700` | `39080e4658ed` | lender-trust-hub | prj_Il28Mv0ebRiIrumFO7iBX6JrSbdD | https://www.lendertrusthub.com | yes PNG | yes | PASS | PASS | GO |
| Contractor | savitz25/contractor-trust-hub | `4818247d8f2d` | `96e751ee046d` | contractor-trust-hub | prj_OYmhfgBxZvRAKBPJv5zqshJnJwgq | https://www.contractortrusthub.com | yes PNG | yes | PASS | PASS | GO |
| Senior | savitz25/care-trust-hub | `48346da8691e` | `b8a785f247e5` | care-trust-hub | prj_k9GyyXn28JZkyYKqLhBJ4rUQcpUb | https://www.seniortrusthub.com | yes ImageResponse | yes | PASS | PASS | GO |
| Investor | savitz25/investor-trust-hub | `2df7ac7493f1` | `c8d500f18de1` | **investor-trust-hub-web** | prj_Qu2DT0AIy8R7XYTQiHgNcDYjE9i8 | https://www.investortrusthub.com | yes PNG | yes | PASS | PASS | GO |

## Per-hub implementation

### Ask

- Kept production card `/og/ask-trust-hub-social-card.png` (1200×630). No visual redesign.
- Pinned `SHARE_HUB.origin = https://www.asktrusthub.com`.
- Stopped metadata from referencing stale `og-default.png`.
- PR: https://github.com/savitz25/Conumers-Trust-Hub/pull/2
- Image: `https://www.asktrusthub.com/og/ask-trust-hub-social-card.png?v=20260819`
- Probed `/` and `/network` with facebookexternalhit, Twitterbot, Slackbot, browser. No localhost. No other Hub host.

### Insurance

- Kept navy lockup; added Ask network label, independent-research line, and `insurancetrusthub.com`.
- Absolute OG URL. Tools/carriers inherit the fallback via `buildMetadata`.
- PR: https://github.com/savitz25/Insurance-trust-hub/pull/1
- Image: `https://www.insurancetrusthub.com/brand/insurance-trust-hub-og.png?v=20260821share002`
- Probed `/`, `/tools/coverage-compass`, `/carriers`.

### Move

- ImageResponse 1200×630 in Move orange with Ask network signature and `movetrusthub.com`.
- `getOgImageForHub()` always returns the Move card on this host.
- Removed leftover `app/lender/opengraph-image.tsx` and `app/insurance/opengraph-image.tsx`.
- Production: `/lender/opengraph-image` and `/insurance/opengraph-image` now **HTTP 404**.
- Wrong-Lender-domain scan: **none** in homepage/calculator/company/Florida local-movers metadata.
- Wrong-Insurance-domain scan: **none**.
- PR: https://github.com/savitz25/Move-trust-Hub/pull/34
- Vercel domains were **not** modified.
- Probed `/`, `/moving-calculator`, `/companies/1-800-pack-rat`, `/local-movers/florida`.

### Lender

- Replaced 720×217 `/brand/lender-trust-hub-logo-header.png` social preview with 1200×630 `/brand/lender-trust-hub-og.png`.
- Old header-logo preview is **gone** from Open Graph tags.
- PR: https://github.com/savitz25/Lender-Trust-Hub/pull/1
- Probed `/` and `/tools/loan-estimate-analyzer`. Image HTTP 200, 1200×630.

### Contractor

- SVG `/brand/contractor-trust-hub-logo.svg` + `twitter:card=summary` replaced with PNG 1200×630 and `summary_large_image`.
- SVG social fallback is **gone**. Large card is **active**.
- PR: https://github.com/savitz25/contractor-trust-hub/pull/1
- Probed `/` and `/florida`.

### Senior

- `metadataBase` pinned to `https://www.seniortrusthub.com` (no production localhost).
- Facility pages no longer set `images: []`. They now attach the default 1200×630 card.
- ImageResponse includes Ask network + `seniortrusthub.com`.
- PRs: https://github.com/savitz25/care-trust-hub/pull/1 and https://github.com/savitz25/care-trust-hub/pull/2
- Localhost scan of production metadata: **none**.
- Blank-image fallback: Harbor Pines now emits `/opengraph-image` 1200×630, `summary_large_image`.
- Probed `/`, `/facility/harbor-pines`, `/search`.

### Investor

- Vercel project confirmed **investor-trust-hub-web** (`prj_Qu2DT0AIy8R7XYTQiHgNcDYjE9i8`). Not `investor-trust-hub`.
- Canonical/OG/Twitter pinned to `https://www.investortrusthub.com`. Production metadata has **no localhost**.
- `/opengraph-image` 404d for crawlers; SHARE-002 follow-up publishes `/opengraph-image.png` (HTTP 200, 1200×630).
- Twitter images completed (`summary_large_image` + image URL).
- PRs: https://github.com/savitz25/investor-trust-hub/pull/1 and https://github.com/savitz25/investor-trust-hub/pull/2
- Probed `/`, `/research`, `/firm/northbridge-ledger-advisors`.

## Git / PRs

| Repo | Branch | PR | Starting SHA | Final / merge SHA |
| --- | --- | --- | --- | --- |
| Conumers-Trust-Hub | share-002-social-baseline | #2 | 06d825c | 6c08968 |
| Insurance-trust-hub | share-002-social-baseline | #1 | e5a3225 | 187f3ac |
| Move-trust-Hub | share-002-social-baseline | #34 | 68be7900 | 38fc553 |
| Lender-Trust-Hub | share-002-social-baseline | #1 | c7f8896e | 39080e46 |
| contractor-trust-hub | share-002-social-baseline | #1 | 4818247d | 96e751ee |
| care-trust-hub | share-002-social-baseline | #1 | 48346da8 | d942325 |
| care-trust-hub | share-002-facility-fallback | #2 | d942325 | b8a785f |
| investor-trust-hub | share-002-social-baseline | #1 | 2df7ac74 | a79b178 |
| investor-trust-hub | share-002-static-og | #2 | a79b178 | c8d500f |

## Vercel production deployments (GitHub deployment IDs)

| Hub | Project | Project ID | Deployment ID | Host | READY |
| --- | --- | --- | --- | --- | --- |
| Ask | conumers-trust-hub | prj_925ZdSHjPhPU7pH9WiwyNOK1MrZB | 6023705841 | www.asktrusthub.com | yes |
| Insurance | insurance-trust-hub | prj_ARBlfWYNhpJWBtaPO4vUJlraa5BK | 6023831799 | www.insurancetrusthub.com | yes |
| Move | move-trust-hub | prj_gudPGeW9SZBkgiL8zxvi3Swfo6T0 | 6024092255 | www.movetrusthub.com | yes |
| Lender | lender-trust-hub | prj_Il28Mv0ebRiIrumFO7iBX6JrSbdD | 6024182935 | www.lendertrusthub.com | yes |
| Contractor | contractor-trust-hub | prj_OYmhfgBxZvRAKBPJv5zqshJnJwgq | 6024244045 | www.contractortrusthub.com | yes |
| Senior | care-trust-hub | prj_k9GyyXn28JZkyYKqLhBJ4rUQcpUb | 6024418141 | www.seniortrusthub.com | yes |
| Investor | investor-trust-hub-web | prj_Qu2DT0AIy8R7XYTQiHgNcDYjE9i8 | 6024505098 | www.investortrusthub.com | yes |

## Rollback targets

Roll back **that Hub only** by reverting to the starting SHA above (or the previous Production deployment SHA in the table).

## Remaining work (do not start SHARE-003 here)

Routes now ready for later **CONTENT** cards: Ask `/network`, `/guides`, `/journeys`; Insurance research articles; Move county/state guides; Contractor `/guides`; Investor `/research`.

Routes now ready for later **ENTITY** cards: Move `/companies/[slug]`; Insurance `/carriers/[slug]` and provider pages; Lender `/lenders/[slug]`; Contractor `/contractors/[slug]`; Senior `/facility/[slug]` and CMS facility pages; Investor `/firm/[slug]`.

Applications eventually ready for **COMPARISON / CALCULATOR / SMART SHARE SNAPSHOT** (SHARE-004): Move calculator and compare; Insurance Coverage Compass / cost tools; Lender Loan Estimate Analyzer; Contractor quote/compare tools; Senior cost planner; Investor compare. Not implemented in SHARE-002.

---

# SHARE-001 — TrustHub Network Smart Share Audit & Architecture

**Status:** COMPLETE as an audit. SHARE-002 implemented 2026-08-21.

**Date:** 2026-08-19  
**Scope:** Audit + architecture only. No domain mutation. No production feature deploy required for this document.

---

## A. STATUS

**PARTIAL**

Ready to implement SHARE-002 (Ask + Insurance + Move default cards) once a human confirms Vercel Git + domain bindings.

Blocked items (do not guess):

- Local clones have **no** `.vercel/project.json`. This agent cannot read Vercel project IDs or attached domain aliases from the dashboard.
- Apparent **move-trust-hub / lendertrusthub.com** dashboard pairing cannot be confirmed or cleared without Vercel Settings → Domains.

---

## B. REPOSITORY / PROJECT MAPPING

Verified from `git remote -v`, `git rev-parse HEAD`, `package.json`, production HTML, and `docs/NETWORK-DEPLOY.md`. Vercel project **IDs** are unknown locally.

| Hub | Local path | GitHub remote | Expected Vercel project (from NETWORK-DEPLOY / task) | Canonical | Local SHA (2026-08-19) | Linked `.vercel` | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Ask | `C:\Users\Michael.Savitsky\consumers-trust-hub` | `savitz25/Conumers-Trust-Hub` (typo in GitHub name is real) | `consumers-trust-hub` | https://www.asktrusthub.com | `bc6c30f7` | **none** | Production live; OG card PNG in use |
| Move | `C:\Users\Michael.Savitsky\move-trust-hub-temp` | `savitz25/Move-trust-Hub` | `move-trust-hub` | https://www.movetrusthub.com | `68be7900` | **none** | Dirty working tree (unrelated). Folder `move-trust-hub` is **not** a git repo |
| Insurance | `C:\Users\Michael.Savitsky\insurance-trust-hub` | `savitz25/Insurance-trust-hub` | `insurance-trust-hub` | https://www.insurancetrusthub.com | `e5a32255` | **none** | Standalone production repo |
| Lender | `C:\Users\Michael.Savitsky\lender-trust-hub` | `savitz25/Lender-Trust-Hub` | `lender-trust-hub` | https://www.lendertrusthub.com | `c7f8896e` | **none** | Standalone production repo |
| Contractor | `C:\Users\Michael.Savitsky\contractor-trust-hub` | `savitz25/contractor-trust-hub` | `contractor-trust-hub` | https://www.contractortrusthub.com | `4818247d` | **none** | Dirty working tree (NJ MyLicense, unrelated) |
| Senior | `C:\Users\Michael.Savitsky\care-trust-hub` | `savitz25/care-trust-hub` | `care-trust-hub` | https://www.seniortrusthub.com | `48346da8` | **none** | Monorepo `apps/web` |
| Investor | `C:\Users\Michael.Savitsky\investor-trust-hub` | `savitz25/investor-trust-hub` | `investor-trust-hub-web` (task name; **unverified**) | https://www.investortrusthub.com | `2df7ac74` | **none** | Monorepo `apps/web`. Vercel project name not in local files |

**STOP / do not guess:** Investor Vercel project might be `investor-trust-hub-web` (task) or `investor-trust-hub`. Confirm in dashboard before any Investor push.

**Human must confirm after SHARE-001 (no agent mutation):**

1. Each Vercel project → Git repo + production branch `main`
2. Production aliases for `www.{hub}trusthub.com`
3. Whether `lendertrusthub.com` remains attached to the **Move** Vercel project

---

## C. MOVE / LENDER ANOMALY FINDING

**Do not remove, reassign, or modify domains in this task.**

### What production HTML shows

- `https://www.lendertrusthub.com/` returns **Lender Trust Hub** OG (`site_name: Lender Trust Hub`, teal header-logo image).
- `https://www.movetrusthub.com/` returns **Move Trust Hub** OG (`site_name: Move Trust Hub`, `/opengraph-image`).

Live traffic on those two hostnames is **not currently swapped**.

### What the Move git repo still contains (contamination risk)

`Move-trust-Hub` is a historical multi-hub monolith. It still has:

- `app/lender/opengraph-image.tsx` — Lender-branded 1200×630 ImageResponse
- `app/insurance/opengraph-image.tsx`
- `lib/seo/site-metadata.ts` helpers `LENDER_OG_IMAGE`, `INSURANCE_OG_IMAGE`, `getOgImageForHub()`
- `app/lender/[[...legacy]]/page.tsx`
- `vercel.json` **crons** for `/api/refresh/lenders`
- Hundreds of **redirects** from old Move paths to `https://www.lendertrusthub.com/...`

That is enough for a Vercel dashboard row to show:

```text
move-trust-hub
lendertrusthub.com
GitHub: savitz25/Move-trust-Hub
```

while a separate `lender-trust-hub` project also serves `www.lendertrusthub.com`.

### Most likely explanations (ranked)

1. **Stale alias** on the Move Vercel project from the split (apex `lendertrusthub.com` still listed; www points at Lender project).
2. **Redirect-only association** (Move project still knows the hostname because `vercel.json` destinations cite it).
3. **Dashboard display artifact** grouping by git repo that still contains `/lender` code.
4. **Genuine cross-project contamination** — possible but **not proven**. Production HTML for `www.lendertrusthub.com` currently looks like Lender, not Move.

### Required human check (no agent action)

In Vercel → **move-trust-hub** → Settings → Domains:

- Is `lendertrusthub.com` or `www.lendertrusthub.com` listed?
- If yes: is it Redirect / Alias / Production?
- Compare with **lender-trust-hub** → Domains.

**Do not delete the alias in SHARE-001.** If it is a leftover redirect, SHARE-002+ can open a dedicated ops ticket.

### Deployment safety implication

SHARE implementation **must never** ship Lender OG from the Move repo as the Move default card. Move renderer expected hub = `move`, host = `www.movetrusthub.com`. QA must fail if a Move page emits `og:image` under `/lender/opengraph-image` or `og:site_name` Lender Trust Hub.

---

## D. CURRENT SOCIAL SHARE AUDIT

Crawler UA used: `facebookexternalhit/1.1` (2026-08-19).

### Network matrix

| Hub | Framework | Default title (prod HTML) | OG image (prod) | Twitter card | metadataBase | Absolute image? | Route-specific meta | Dynamic OG | Fallback OG | Known defects |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Ask | Next 15.5.19 App Router | Ask Trust Hub | `/og/ask-trust-hub-social-card.png?v=20260819`  (static PNG) | summary_large_image | yes (`NEXT_PUBLIC_SITE_URL` / brand url) | **yes** | yes (`createPageMetadata`) | `app/opengraph-image.tsx` exists in git but **prod HTML uses static PNG** | `public/og-default.png` in source | Local metadata.ts still points at `og-default.png`; prod uses `/og/ask-trust-hub-social-card.png`. Two sources of truth. |
| Move | Next 15.5.19 App Router | Where Are You Going? … \| Move Trust Hub | `/opengraph-image` (ImageResponse, edge) | summary_large_image | yes (`https://www.movetrusthub.com`) | relative path resolved by metadataBase | yes (many `generateMetadata`) | **yes** default + leftover lender/insurance variants | same default image for calculator | Calculator/profile/county reuse **homepage** OG image. Monolith leftover `/lender` and `/insurance` OG routes. Dirty WT. |
| Insurance | Next 15.5.19 App Router | Independent Insurance Research \| Insurance Trust Hub | `/brand/insurance-trust-hub-og.png?v=20260807transport` | summary_large_image | yes | **yes** | yes (`buildMetadata`) | no ImageResponse | dedicated OG PNG | Tools/hub pages share the **same** homepage OG art. No per-entity cards. |
| Lender | Next **16.2.9** App Router | Verify. Compare. Finance wisely. \| Lender Trust Hub | header lockup PNG **720×217** | summary_large_image | hardcoded prod | yes but **wrong aspect** | mixed; many cluster pages title-only | **none** | header logo | Unfurl will look like a cropped logo, not a 1200×630 card. Dual old/new icons. |
| Contractor | Next ^15.5.23 App Router | Before you hire, verify | **SVG logo** | **`summary`** (small) | yes | relative SVG | many via `pageMetadata`; some tools skip OG | **none** | SVG | Facebook/LinkedIn often **drop SVG**. Small Twitter card. |
| Senior | Next ^16.3.1 monorepo | SeniorTrustHub | `/opengraph-image` ImageResponse 1200×630 | summary_large_image | launch-gated; can be localhost pre-launch | relative `/opengraph-image` | 9 generateMetadata; many legal pages title-only | **yes** | ImageResponse | Synthetic facility pages set `images: []` (blank card). Home canonical always production. |
| Investor | Next 15.5.23 monorepo | Research before you invest. · InvestorTrustHub | `/opengraph-image` static PNG 1200×630 | summary_large_image | `NEXT_PUBLIC_SITE_URL` **defaults localhost** | relative `/opengraph-image` | `pageMetadata()` | static PNG | unused duplicate in `public/brand/og-landscape-1200x630.png` | Twitter metadata often omits `images[]`. Localhost default is a production foot-gun. |

### Representative URL findings

| URL | og:image | Notes |
| --- | --- | --- |
| asktrusthub.com/ | branded PNG | Best current network card |
| asktrusthub.com/methodology | same PNG | Route title/description unique; **image not unique** |
| movetrusthub.com/ | `/opengraph-image` | Branded ImageResponse |
| movetrusthub.com/moving-calculator | **same** `/opengraph-image` | Not a calculator card |
| insurancetrusthub.com/ | OG PNG | Good dimensions if file is 1200×630 |
| insurancetrusthub.com/tools/license-verification | **same** PNG | Title unique; image generic |
| lendertrusthub.com/ | header PNG | Wrong size |
| contractortrusthub.com/ | SVG | Weak crawler support |
| seniortrusthub.com/ | ImageResponse | Unique; missing og:url in HTML sample |
| investortrusthub.com/ | static `/opengraph-image` | Good size |

No site currently has privacy-safe `/share/[type]/[id]` snapshot routes. Contractor has `/contractors/[slug]/summary` (noindex Trust Report), which is **entity print**, not a Smart Share snapshot.

---

## E. EXISTING ASSET INVENTORY

Prefer existing repo assets. Do not redesign logos.

| Hub | Best lockup | Mark / brackets | Favicons | Dedicated 1200×630 |
| --- | --- | --- | --- | --- |
| Ask | `public/brand/logo-header.png`, `logo.svg` | `ask-bracket-hub-mark.png` | favicon-16/32/48, icon-192/512 | **prod** `/og/ask-trust-hub-social-card.png`; git also `opengraph-image.tsx` + `og-default.png` |
| Move | hub logo slot / brand PNGs under `public/brand/` | ImageResponse `[·]` bracket in OG | present | **ImageResponse** `app/opengraph-image.tsx` |
| Insurance | `insurance-trust-hub-logo-header.png` | `insurance-trust-hub-icon.svg` / icon PNGs | 16/32/48 | **`public/brand/insurance-trust-hub-og.png`** |
| Lender | `public/brand/lender-trust-hub-logo-header.png` | teal-bracket hub PNGs | mixed old handshake vs new mark | **missing** |
| Contractor | `contractor-trust-hub-logo.svg` / `.png` | gold mark | 192/512 PNG | **missing** |
| Senior | `public` SVGs (`senior-trust-hub-logo.svg`) | four-node mark in OG | SVG icon | **ImageResponse** |
| Investor | `public/brand/` horizontal logos + `mark.svg` | four-dot / node colors | ico + svg | **`app/opengraph-image.png`** + unused public copy |

Network signature already in use: **brackets + hub mark** (Ask, Move OG, Lender brand, Contractor gold). Senior/Investor use **four colored nodes**. Both can coexist: hub mark primary, four-dot or bracket as a small network chip.

### Brand tokens (from source, not invented)

| Hub | Primary | Navy / dark | Accent notes |
| --- | --- | --- | --- |
| Ask | `#4F46E5` indigo | `#0A2540` | periwinkle `#E0E7FF` |
| Move | `#FF5A1F` orange | `#0A2540` / `#071525` | |
| Insurance | `#0284C7` shield | `#0A2540` | sapphire `#1E3A8A` |
| Lender | `#0D9488` teal | `#0A2540` | gold `#F59E0B` |
| Contractor | `#F5C518` gold | `#0A2540` | |
| Senior | `#681860` plum | `#082860` | nodes orange/cyan/green/violet |
| Investor | `#0F766E` teal / logo green | `#001F52` / `#0A2540` | bronze `#92400E` |

---

## F. PROPOSED SHARE DESIGN SYSTEM

### Canvas

- **1200 × 630 PNG** (required)
- Safe inset ≥ 56px
- Type must remain readable at ~200px wide (iMessage / WhatsApp)
- Contrast: light text on navy/plum **or** navy text on warm canvas (Senior). Never gray-on-white empty boxes.

### Anatomy (network)

```
┌────────────────────────────────────────────────────┐
│ [HUB MARK]  HUB NAME              ASK TRUST HUB    │
│                                   NETWORK          │
│ CONTEXT LABEL (Guide · Agency · Calculator)        │
│ Headline (max ~70 glyphs)                          │
│ Optional metric / location (one line)              │
│ Supporting evidence (one line, source-backed)      │
│ Independent consumer research        domain.com    │
└────────────────────────────────────────────────────┘
```

Hub identity is primary. Network line is quiet (`Part of the Ask Trust Hub Network` or the four-dot / bracket chip).

Avoid: star-rating walls, “#1 in town”, stock photos, giant unused whitespace, hype CTAs.

### Card types

| Type | Use | Required fields | Forbidden extras |
| --- | --- | --- | --- |
| **HUB** | homepage, about, fallback | hub, tagline, domain, networkMark | rankings |
| **CONTENT** | guides, methodology, county/state | hub, contentType, title, location?, updatedDate? | fake “updated daily” |
| **ENTITY** | mover / agency / lender / facility / contractor / firm | hub, entityName, entityType, location, 1–3 **verified facts**, sourceLabel | endorsement, stars as quality |
| **COMPARISON** | compare trays | hub, count, comparisonType, snapshotDate, shareId | full personal shortlist |
| **CALCULATOR** | tool results | hub, toolName, primaryResult, location grain, snapshotDate, shareId | street addresses, income |

---

## G. TECHNICAL ARCHITECTURE

### Recommendation: **Option B — spec + copy-adapted reference** (not a shared npm package)

Reasons:

- Seven Vercel projects; a private package would couple deploys and version skew.
- Framework versions already diverge (Next 15.5 vs 16.2/16.3).
- `NETWORK-DEPLOY.md` forbids assuming a monorepo ships all domains.

**Do:**

1. Keep this document as the **canonical spec** (Ask repo).
2. SHARE-002: implement `lib/share/types.ts` + `app/opengraph-image.tsx` **inside Ask**, then copy the same types/renderer into Insurance and Move with hub tokens swapped.
3. Use Next.js `ImageResponse` (`next/og`) where a static PNG is insufficient. No Sharp/Puppeteer.
4. Hybrid: static 1200×630 PNG for HUB fallback; `opengraph-image.tsx` for CONTENT/ENTITY later.

**Runtime:** Node `ImageResponse` preferred over Edge when loading local fonts/PNGs (Senior/Move already mix). Fonts: system-ui first; optional Geist/Inter files if already in the repo.

**Absolute URLs:** always `metadataBase` + `https://www.{canonical}`. Never `.vercel.app` or localhost in production metadata (Contractor already strips `.vercel.app`; Investor must not default localhost).

### Smart Share snapshot (future)

```
User result → Share this research → privacy-safe snapshot
  → opaque id (nanoid, 8–12 chars)
  → /share/{hub}/{id}
  → server-rendered public HTML + matching opengraph-image
```

Crawlers must not need cookies, localStorage, or calculator reconstruction.

Persistence: later SHARE-00x. Could be KV/Supabase table `share_snapshots` with TTL. Not in SHARE-002.

---

## H. DATA CONTRACT

Shared **concept** (field names may map to existing SEO helpers):

```ts
type TrustHubId =
  | 'ask' | 'move' | 'insurance' | 'lender'
  | 'contractor' | 'senior' | 'investor';

type ShareCardType = 'hub' | 'content' | 'entity' | 'comparison' | 'calculator';

type TrustShareCard = {
  hub: TrustHubId;
  expectedHost: string;          // e.g. www.movetrusthub.com — QA fails if mismatch
  cardType: ShareCardType;
  title: string;
  eyebrow?: string;
  subtitle?: string;
  location?: string;             // "Palm Beach County, FL" or "Miami, FL → Charlotte, NC"
  primaryMetric?: string;
  secondaryMetric?: string;
  facts?: string[];              // verified, short
  sourceLabel?: string;          // "Florida DFS" / "FMCSA" / "NMLS"
  snapshotDate?: string;         // ISO date, not PII
  canonicalUrl: string;
  shareUrl: string;
  imageAlt: string;
  privacyMode: 'public' | 'snapshot';
  robots: 'index' | 'noindex';
};
```

Each renderer constants file **must** export:

```ts
export const SHARE_HUB = { id: 'move', host: 'www.movetrusthub.com', brand: 'Move Trust Hub' } as const;
```

QA compares `SHARE_HUB.host` to `metadataBase` and to `og:url` host.

---

## I. PRIVACY + SEO MODEL

### Prohibited on OG images and share HTML (unless a later explicit policy)

- Full consumer name, email, phone
- Full street address
- Account IDs, auth tokens
- Uploaded documents, private notes
- Exact origin/destination streets for a move
- Borrower income, DTI, credit, balances
- Private My Insurance / My Move / My Lending saved state

Prefer city/state grain: `Boca Raton, FL → Charlotte, NC`.

### Indexation

| Surface | robots | sitemap |
| --- | --- | --- |
| Public hub/content/entity pages | index when the page is already indexable | yes if already in sitemap |
| Personalized `/share/...` snapshots | **noindex, follow** | **never** |
| Calculator live query URLs with PII | should not exist; snapshots instead | no |

Do not generate thin location pages from share IDs.

---

## J. ANALYTICS MODEL

Reuse Vercel Analytics custom events (`lib/analytics/track.ts` / `ANALYTICS_EVENTS`). Add names, do not fork a second system.

Proposed events (primitives only):

| Event | When |
| --- | --- |
| `share_opened` | Share control shown |
| `share_clicked` | User activates share |
| `share_copy_link` | Clipboard fallback |
| `share_native_sheet` | `navigator.share` |
| `share_created` | Snapshot persisted |
| `share_snapshot_viewed` | `/share` GET (server or beacon) |
| `share_snapshot_cta` | CTA on snapshot page |

Dimensions: `hub`, `card_type`, `tool`, `entity_type`, `source_route` (path pattern, not full query). **Never** log ZIP+name, addresses, incomes.

---

## K. CRAWLER / CACHE / A11Y / PERF

- Facebook/LinkedIn cache OG aggressively — need cache-bust `?v=` **or** new image URL on content change; LinkedIn debugger for re-scrape.
- iMessage/WhatsApp use OG image; **PNG 1200×630**, not SVG.
- Slack/Discord similar; absolute HTTPS required.
- `og:image:alt` + `twitter:image:alt` required.
- `opengraph-image.tsx` is request-time; cache with `export const revalidate` (e.g. 86400 for HUB cards).
- Do not run ImageResponse on every normal document request beyond Next’s OG route.
- Edge vs Node: prefer Node if loading local PNG logos; Edge is fine for CSS-only cards (Move default).

---

## L. TEST PLAN

### Automated (SHARE-002+)

For each production origin:

- `og:title`, `og:description`, `og:image` present
- `og:image` absolute `https://www.{expectedHost}/...`
- `HEAD/GET og:image` → 200
- dimensions 1200×630 (or documented exception during Lender/Contractor repair)
- `twitter:card` = `summary_large_image` (Contractor must leave `summary`)
- canonical host = expected hub
- no `localhost`, no `*.vercel.app`, no **wrong-hub domain**
- Move pages must not reference `/lender/opengraph-image` or `lendertrusthub.com` as `og:image` / `og:url`
- `/share/*` if present: `noindex` and absent from sitemap
- snapshot payload schema rejects prohibited fields

### Visual

Screenshot 1200×630 cards at 100% and 320px-wide downscale for HUB + one ENTITY per hub.

### Cross-hub contamination test

Fixture table `expectedHub × url × og:site_name × og:image host`. Fail CI if any cell mismatches.

---

## M. IMPLEMENTATION WAVES

### SHARE-002 — Default cards that actually unfurl (no snapshots)

Order (safest first; one repo per PR; verify Vercel Git + domain **before push**):

1. **Ask** (`Conumers-Trust-Hub`) — align git metadata with the production `/og/ask-trust-hub-social-card.png`; add `og:image:alt`; document the card spec in code comments.
2. **Insurance** — already has 1200×630 PNG; add `opengraph-image.tsx` **or** keep PNG; ensure tools/hub pages don’t look untitled; optional CONTENT card for methodology.
3. **Move** — keep ImageResponse; **do not** use `/lender` or `/insurance` OG on Move canonical routes; add a Move-only expectedHost assert.
4. **Lender** — add real 1200×630 card (PNG or ImageResponse); stop using 720×217 header lockup.
5. **Contractor** — PNG 1200×630; switch Twitter to `summary_large_image`; stop SVG OG.
6. **Senior** — keep ImageResponse; fix `images: []` on synthetic facilities; never localhost metadataBase in production.
7. **Investor** — twitter images array; kill localhost default in prod.

No `/share` persistence in SHARE-002.

### SHARE-003 — Route-specific CONTENT + ENTITY cards

- Move: calculator, county, company profile (facts = FMCSA authority / not a ranking)
- Insurance: agency/hub/tool
- Lender: lender profile (NMLS id as fact, not endorsement)
- Contractor: Trust Report
- Senior: CMS facility
- Investor: SEC/IARD firm

### SHARE-004 — Privacy-safe snapshots + “Share this research” control

- `/share/{hub}/{opaqueId}`
- Web Share API + copy link
- noindex snapshots
- analytics events above

---

## N. RISK REGISTER

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Wrong Vercel project / domain | **critical** | Pre-push mapping check; no SHARE work until human confirms aliases |
| Move repo emitting Lender OG | **critical** | Ban `/lender/opengraph-image` on Move host; QA host assert |
| Stale `lendertrusthub.com` on Move project | high | Human domain audit; no deletion in SHARE-001 |
| OG crawler cache | high | versioned image URLs; debugger re-scrape |
| Client-state unfurl (calculator) | high | snapshots, not query-string PII |
| Private data on cards | **critical** | deny-list in types + tests |
| SVG OG (Contractor) | high | PNG only |
| Wrong-size Lender image | high | 1200×630 |
| Font/runtime ImageResponse failures | medium | system-ui fallback; Node runtime if assets fail on Edge |
| SEO index explosion from shares | high | noindex + no sitemap |
| Shared package coupling | medium | Option B copy-adapt |
| Investor localhost metadataBase | high | env required in production |

---

## GIT (this SHARE-001 commit)

See the agent final response for SHAs after commit.

**Production impact of documenting in Ask:** a docs-only commit on `Conumers-Trust-Hub` `main` will trigger an Ask Vercel rebuild with **no intended UI change**. Domain settings are untouched.
