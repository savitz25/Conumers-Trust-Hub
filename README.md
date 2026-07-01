# Consumers Trust Hub

**One Trusted Hub for Moving, Lending & Insurance – Shop with Confidence.**

Central umbrella brand connecting three live sister sites:

| Site | Domain | Focus |
|------|--------|-------|
| Move Trust Hub | [movetrusthub.com](https://www.movetrusthub.com) | FMCSA-verified interstate movers |
| Lender Trust Hub | [lendertrusthub.com](https://www.lendertrusthub.com) | NMLS-verified mortgage lenders |
| Insurance Trust Hub | [insurancetrusthub.com](https://www.insurancetrusthub.com) | DOI-verified insurance agents |

## Tech Stack

- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS 4** + shadcn/ui-style components
- **Framer Motion** for animations
- **React Hook Form** + Zod for forms
- **TanStack Query** for client data fetching
- **Supabase** (optional, scaffolded for future saved searches)
- **next-themes** for dark/light mode
- **Vercel Analytics** + GA4 cross-domain tracking

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SITE_URL` | Yes (prod) | `https://www.consumerstrusthub.com` |
| `NEXT_PUBLIC_GA4_ID` | No | Google Analytics 4 measurement ID |
| `NEXT_PUBLIC_SUPABASE_URL` | No | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Server-side Supabase key |

## Project Structure

```
consumers-trust-hub/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Homepage
│   ├── moving/             # Moving hub page
│   ├── lending/            # Lending hub page
│   ├── insurance/          # Insurance hub page
│   ├── resources/          # Guides & articles
│   ├── about/              # Family story
│   ├── trust/              # Independence pledge
│   ├── contact/            # Contact form
│   ├── privacy/            # Privacy policy
│   ├── terms/              # Terms of service
│   ├── sitemap.ts          # Dynamic sitemap
│   └── robots.ts           # robots.txt
├── components/             # React components
│   ├── navbar.tsx          # Global navigation
│   ├── footer.tsx          # Site footer
│   ├── unified-search.tsx  # ZIP + vertical search
│   ├── service-card.tsx    # Sister site cards
│   └── ui/                 # shadcn/ui primitives
├── lib/
│   ├── sites.ts            # Sister site config & deep links
│   ├── stats.ts            # Aggregate trust statistics
│   ├── resources/          # Article content
│   └── seo/                # Metadata & JSON-LD schemas
└── providers/              # React context providers
```

## Connecting Sister Sites

Integration is via **deep links** and **ZIP-prefilled redirects** (no shared API required):

```typescript
// lib/sites.ts
getSearchUrl('moving', '90210')
// → https://www.movetrusthub.com/companies?zip=90210
```

Service pages include:
- Hub overview tabs with stats and features
- Direct links to calculators and directories on live sites
- Optional iframe preview of sister sites (sandboxed)

### Cross-Domain GA4 Setup

1. Create a GA4 property for Consumers Trust Hub
2. In Admin → Data Streams → Configure tag settings → Configure your domains, add all four domains
3. Set `NEXT_PUBLIC_GA4_ID` in Vercel environment variables
4. Cross-domain linker is configured in `components/analytics.tsx`

## Deploy to Vercel

1. Push this repo to GitHub
2. Import project in [Vercel](https://vercel.com/new)
3. Set environment variables from `.env.example`
4. Point `consumerstrusthub.com` DNS to Vercel:
   - `A` record → `76.76.21.21`
   - `CNAME` for `www` → `cname.vercel-dns.com`
5. Add domain in Vercel project settings
6. Deploy

```bash
npm run build   # Verify production build locally
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |

## Future Enhancements

- **Shared Supabase database** for unified saved searches across all four sites
- **SSO via Clerk or Supabase Auth** for user profiles
- **Bundled quoting** — single form that routes to mover, lender, and insurance quote flows
- **Real-time stats API** pulling live counts from sister site databases
- **Embeddable widgets** for sister sites to cross-promote the umbrella brand