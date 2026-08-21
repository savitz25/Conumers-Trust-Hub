# SHARE-001 — TrustHub Network Smart Share Audit & Architecture

**Status:** PARTIAL (architecture ready; Vercel project IDs and domain-alias lists not readable from local machines)

**Date:** 2026-08-19  
**Scope:** Audit + architecture only. No domain mutation. No production feature deploy required for this document.  
**Network deploy rule:** `docs/NETWORK-DEPLOY.md` — repository → correct Vercel project → correct canonical domain.

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
