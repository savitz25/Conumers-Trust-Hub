# Stage B.3 — Optional My Trust Journey metadata layer

## Goal

A lightweight orchestration overview on **AskTrustHub** over existing specialist workspaces:

- My Move (MoveTrustHub)
- My Lending (LenderTrustHub)
- My Insurance (InsuranceTrustHub)

…without forced account merge, PII collection, or lead-funnel language.

## What is synced (metadata only)

Stored on **Ask origin** in `localStorage` key `ath:my-trust-journey:v1`:

| Field | Example |
|-------|---------|
| `situationId` | `move_buy` |
| `journey` | `relocate` |
| `intent` | `buy` |
| `stateCode` / `county` | `FL` / `miami-dade` |
| `stepIds` / `hubsVisited` | step progress |
| `currentStepId` | which step is next |
| timestamps | created / updated |

Also reuses B.2 progress key `ath:ask-journey-progress:v1` for visited step ids.

## What is **not** synced

- Mover shortlists  
- Loan estimates / LE inputs  
- Insurance plan details  
- Notes / documents  
- Names, emails, phones  
- Cross-hub shared login  

Those remain in specialist My… products.

## Continuity model

| Layer | Role |
|-------|------|
| Stage A′ URL params | Cross-domain research context |
| Stage B.1 per-origin session | Return visits on each specialist hub |
| Stage B.2 path generator | Situation → ordered steps |
| Stage B.3 Ask metadata | Calm overview + progress on Ask only |

## Surfaces

| URL | Purpose |
|-----|---------|
| `/my-trust-journey` | Journey overview UI |
| `/#whats-happening` | Build / update plan (writes metadata) |

## Specialist deep links

| Workspace | URL |
|-----------|-----|
| My Move | `https://www.movetrusthub.com/my-move` |
| My Lending | `https://www.lendertrusthub.com/my-lending` |
| My Insurance | `https://www.insurancetrusthub.com/my-insurance` |

Plus contextual public research continues (local-lenders, destinations, movers) from Stage B.2 builders.

## Guardrails

- Optional, no forced login  
- Research passport energy, not CRM  
- No “complete your package” sales copy  
- No auto-created accounts  
- No scraping specialist workspace contents into Ask  

## Code map

| File | Role |
|------|------|
| `lib/orchestration/journey-metadata.ts` | Schema + persistence |
| `components/my-trust-journey-overview.tsx` | Overview UI |
| `app/my-trust-journey/page.tsx` | Route |
| `components/whats-happening-planner.tsx` | Writes metadata on plan build |

## QA

1. **Anonymous relocate + buy** — Build path on homepage → open My Trust Journey → see FL · may buy · Step 1 of 3  
2. **Anonymous relocate + rent** — Move + Insurance only; no Lender step forced  
3. **Return visit** — Reload `/my-trust-journey` → same metadata  
4. **Continue My Lending / My Move** — Cards open specialist hubs; shortlists still only there  
5. **Clear** — Removes Ask overview only; does not touch specialist storage  
