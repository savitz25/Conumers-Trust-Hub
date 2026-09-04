# Arizona remaining build sequence (ATH-AZ-001)

Internal prioritization from **actual** 2026-09-04 evidence. Not a consumer ranking. No Trust Score.

Arizona must remain fast. Contractor is already Builder 3 (AZ-CON-001). Senior is already live (AZ-SEN-001). This ticket decides how the other four hubs finish.

There is **no remaining free bulk that adds actual companies** for Move, Insurance, Lender, or Investor.

## Evaluation

| Hub | Bulk roster? | Exact IDs? | Contacts? | Entity growth? | Ease |
| --- | --- | --- | --- | --- | --- |
| **Contractor** | ROC in flight (Ask 58,408 license rows) | ROC license | UNKNOWN here | In flight | Builder 3 |
| **Senior** | Shipped | CMS CCN + AZ state ID | shipped | 0 canonical / 2,776 state identities | Closed |
| **Investor** | No state-RIA CSV. IARD already national | CRD | UNKNOWN | **0** from overlay; UNKNOWN from PRA list | **HIGH** intelligence |
| **Lender** | No company CSV. HMDA already in Ask | NMLS on verify | UNKNOWN | **0** from HMDA | **HIGH** intelligence |
| **Insurance** | Lookup free; SBS report **paid** | NPN / NAIC | email in paid CSV | UNKNOWN, blocked paid | **LOW** as entity; thin page MEDIUM |
| **Move** | **No state roster** | USDOT on overlay | UNKNOWN | **0** from state roster | Thin page MEDIUM |

## Remaining specialist order

1. **AZ-INV-001** (InvestorTrustHub) — Arizona principal-office overlay of the existing SEC IARD graph (25,777 canonical firms / 17,018 RIA facts). Exact CRD. Zero net-new canonical organizations. Arizona principal office ≠ ACC state registration.
2. **AZ-LEND-001** (LenderTrustHub) — HMDA Arizona market page from numbers already in Ask (307,379 / 183,374 / 49,376). Applications ≠ lenders. NMLS stays search-only.
3. **AZ-INS-001** (InsuranceTrustHub) — thin DIFI / SBS Lookup path plus enforcement attach **only** on exact NPN/NAIC. Do not buy SBS ($0.03/row, $30 minimum).
4. **AZ-MOVE-001** (MoveTrustHub) — consumer-truth page: Arizona has no mover license (AG 2025-07-07); hostage-load statute + DPS hotline; optional AZ HQ overlay of the existing 5,022 federal profiles. Do not ingest 60,519 MCMIS carriers as movers.
5. **ATH-AZ-002** (Ask) — public `/arizona` only after those specialist pages exist. **Not this ticket.**

## Builder assignments

- **Builder 3 next after AZ-CON-001:** **AZ-INS-001** in `insurance-trust-hub`. Hardest remaining specialist (paid-SBS trap). Continues Arizona in a parallel repo.
- **Builder 4 next:** **AZ-INV-001** in `investor-trust-hub`. Fastest remaining specialist. Then **AZ-LEND-001** if still free.

Do not start local Arizona. `ARIZONA_LOCAL_PHASE = NO`.

Do not publish Ask `/arizona` from ATH-AZ-001. No sitemap changes.
