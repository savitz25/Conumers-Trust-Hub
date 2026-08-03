# Step 2 — Make “Ask” real

## What shipped
- Homepage **situation router** above the fold (`SituationRouter`)
- **Trust Center** strip owned on Ask (`TrustCenterStrip` → promise, methodology, data sources, etc.)
- Specialist hub discovery cards retained below
- No directories, city farms, or competing guides on Ask

## Situation → destination map

| Situation | Destination |
|-----------|-------------|
| Moving / scam risk | `movetrusthub.com/verify-dot` |
| Lender legitimacy | `lendertrusthub.com/local-lenders` |
| Health coverage confusion | `insurancetrusthub.com/tools/cost-estimator` |
| Medicare / turning 65 | `insurancetrusthub.com/tools/medicare-plan-finder` |
| Verify insurance agent | `insurancetrusthub.com/tools/license-verification` |
| Independence / methodology | `/promise` (Ask) |

## Components
- `components/situation-router.tsx`
- `components/trust-center-strip.tsx`
- `lib/situations.ts`

## Verify
1. https://www.asktrusthub.com — router first in viewport
2. Each card opens correct specialist tool or Ask Trust Center page
3. No directory listings on Ask
