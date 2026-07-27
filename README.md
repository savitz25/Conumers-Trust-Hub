# ConsumerTrust Hub

**Independent verification. Transparent methodology. Zero paid placements.**

Thin parent brand site for the ConsumerTrust Hub network — trust infrastructure and discovery, not a directory or content farm.

| Hub | Domain | Status |
|-----|--------|--------|
| MoveTrustHub | [movetrusthub.com](https://www.movetrusthub.com) | Live |
| InsuranceTrustHub | [insurancetrusthub.com](https://www.insurancetrusthub.com) | Live |
| LenderTrustHub | [lendertrusthub.com](https://www.lendertrusthub.com) | Coming soon |

**Parent domain:** [consumerstrusthub.com](https://www.consumerstrusthub.com)

## Positioning

- Institutional, calm, trustworthy (Stripe / Linear / Consumer Reports)
- Deep navy + white + restrained teal accent
- No directories, location pages, urgency tactics, or lead-gen chrome on the parent

## Pages

- `/` — Homepage (network positioning, hub cards, independence)
- `/promise` — Independence / no paid placements
- `/methodology` — How we verify + Trust Score philosophy
- `/about` — About the network
- `/who-we-are` — Named founder accountability
- `/how-we-make-money` — Transparent revenue model
- `/editorial-standards` — Quality, corrections, AI use
- `/data-sources` — FMCSA, DOI/NAIC, NMLS, etc.
- `/contact` · `/privacy` · `/terms`

## Tech

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS 4
- Organization schema with `subOrganization` for the three hubs
- `sitemap.xml` + `robots.txt`

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SITE_URL` | Yes (prod) | `https://www.consumerstrusthub.com` |

## Explicitly out of scope

Directories, location pages, heavy guides competing with specialist hubs, blogs/content farms.
