# Arizona remaining build sequence (ATH-AZ-001)

Internal prioritization from **actual** 2026-09-04 evidence. Not a consumer ranking. No Trust Score.

Arizona must remain fast. Contractor is already Builder 3 (AZ-CON-001). Senior is already live (AZ-SEN-001). This ticket decides how the other four hubs finish.

There is **no remaining free bulk that adds actual companies** for Move, Insurance, or Lender. Investor has a request-gated ACC CSV (not filed).

## Evaluation

| Hub | Bulk roster? | Exact IDs? | Contacts? | Entity growth? | Ease |
| --- | --- | --- | --- | --- | --- |
| **Contractor** | ROC in flight (Ask 58,408 rows; AZ-CON-001 58,131 distinct) | ROC license | UNKNOWN here | In flight | Builder 3 |
| **Senior** | Shipped | CMS CCN + AZ state ID | shipped | 0 canonical / 2,776 state identities | Closed |
| **Lender** | No company CSV. HMDA already in hand | NMLS on verify | UNKNOWN | **0** from HMDA | **HIGH** intelligence |
| **Investor** | No free state-RIA CSV. IARD 213 AZ principal-office already counted | CRD | UNKNOWN on overlay | **0** from overlay; UNKNOWN from PRA list | Overlay HIGH; PRA LOW |
| **Insurance** | Lookup free; SBS report **paid** | NPN / NAIC | email in paid CSV | UNKNOWN, blocked paid | **LOW** as entity |
| **Move** | **No state roster** | USDOT on overlay | UNKNOWN | **0** from state roster | Thin page MEDIUM |

## Remaining specialist order

1. **AZ-LEND-001** (LenderTrustHub) — HMDA Arizona market page from numbers already in hand (Ask 307,379 / 183,374 / 49,376; Lender slice 15 of 15 counties, 308,338 / 183,374 / 49,721, 953 LEI rows, 123 high-confidence maps). Applications ≠ lenders. NMLS stays search-only. **Builder 4, now, parallel with AZ-CON-001.**
2. **AZ-INV-001** (InvestorTrustHub) — Arizona principal-office overlay of the existing 213 IARD firms plus optional later ACC list request. Exact CRD. Zero net-new canonical from the overlay. Arizona principal office ≠ ACC state registration. **Builder 3 after AZ-CON-001.** Do not file PRA unless the owner authorizes the commercial-purpose (notary) path.
3. **AZ-INS-001** (InsuranceTrustHub) — thin DIFI / SBS Lookup path plus enforcement attach **only** on exact NPN/NAIC. Do not buy SBS ($0.03/row, $30 minimum).
4. **AZ-MOVE-001** (MoveTrustHub) — consumer-truth page: Arizona has no mover license (AG 2025-07-07); hostage-load statute + DPS hotline; optional AZ HQ overlay of the existing 5,022 federal profiles. Do not ingest 60,519 MCMIS carriers as movers.
5. **ATH-AZ-002** (Ask) — public `/arizona` only after those specialist pages exist. **Not this ticket.**

## Builder assignments

- **Builder 4 next:** **AZ-LEND-001** in `lender-trust-hub`. Ready now. Highest remaining intelligence per hour.
- **Builder 3 next after AZ-CON-001:** **AZ-INV-001** in `investor-trust-hub`. Only remaining plausible state-registration entity path (request-gated) plus a ready 213-firm overlay.

Do not start local Arizona. `ARIZONA_LOCAL_PHASE = NO`.

Do not publish Ask `/arizona` from ATH-AZ-001. No sitemap changes.
