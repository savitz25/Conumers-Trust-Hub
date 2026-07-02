# 308 Redirect Activation Guide

**Status:** READY TO ACTIVATE — shell is live on `consumertrusthub.com`. Do NOT enable until QA sign-off.

## Vercel Deployment (Today)

1. Import `savitz25/Conumers-Trust-Hub` at [vercel.com/new](https://vercel.com/new)
2. Environment variables:
   ```
   NEXT_PUBLIC_SITE_URL=https://www.consumertrusthub.com
   NEXT_PUBLIC_GA4_ID=G-XXXXXXXXXX
   ```
3. Add domains: `consumertrusthub.com`, `www.consumertrusthub.com`
4. Deploy `main` branch

## Cloudflare 308 Rules (Activate on "Go")

**Important:** Use **308** (not 301) to preserve HTTP method/body for POST quote forms.

### Bulk Redirect List

```text
# MoveTrust Hub → /moving/*
https://www.movetrusthub.com/*  →  https://www.consumertrusthub.com/moving/$1  308
https://movetrusthub.com/*      →  https://www.consumertrusthub.com/moving/$1  308

# LenderTrust Hub → /lending/*
https://www.lendertrusthub.com/*  →  https://www.consumertrusthub.com/lending/$1  308
https://lendertrusthub.com/*      →  https://www.consumertrusthub.com/lending/$1  308

# InsuranceTrust Hub → /insurance/*
https://www.insurancetrusthub.com/*  →  https://www.consumertrusthub.com/insurance/$1  308
https://insurancetrusthub.com/*      →  https://www.consumertrusthub.com/insurance/$1  308
```

### Path Overrides (higher priority)

| Legacy path | New path |
|-------------|----------|
| `/moving-calculator` | `/moving/calculator` |
| `/companies` | `/moving/companies` |
| `/compare` | `/moving/compare` |
| `/local-lenders` | `/lending/lenders` |
| `/directory` | `/insurance/directory` |

### Welcome Banner Query

Append `?from=movetrusthub` (or `lendertrusthub`, `insurancetrusthub`) on redirect target for first-visit banner:

```
https://www.consumertrusthub.com/moving?from=movetrusthub
```

## GSC Actions (Day of Cutover)

- [ ] Submit new sitemap: `https://www.consumertrusthub.com/sitemap.xml`
- [ ] Change of Address for each legacy property
- [ ] Monitor Coverage report for 7 days

## Rollback

Disable Cloudflare redirect rules → legacy sites resume (keep DNS pointed to original hosts).