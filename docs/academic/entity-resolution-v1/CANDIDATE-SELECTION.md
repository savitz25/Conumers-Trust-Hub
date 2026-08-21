# ER V1 candidate selection

**Version / seed:** `trusthub-er-candidate-v1`  
**Generator:** `scripts/academic-001c1-er-candidates.py`  
Re-running on the same frozen Move 008b JSON and Contractor staging license CSVs must reproduce the same IDs, order, and file hash.

## Sources (read-only)

**Move:** `Move-trust-Hub/docs/task-008b-identity-review-pilot.json` (200 identity-review overlay rows). These overlays are **candidates, not labels**. `google_places_requests: 0`.

**Contractor:** staging `licenses_normalized.csv` for AZ ROC, CA CSLB, NJ DCA, NV NSCB, OK CIB, KY DHBC, TN BLC, ID DOPL, MN DLI, VA DPOR, CT DCP. Business-like legal names only (LLC/INC/construction/etc.). Sole-owner / individual-coded rows excluded from V1.

## Move construction

Each 008b row becomes one pair:

- Record A: FMCSA L&I USDOT (`fmcsa_li`)
- Record B: other USDOT when present, else `move-profile:{slug}`

Category mapping (selection metadata only):

| 008b category | case_type | difficulty |
|---------------|-----------|------------|
| DBA ≠ legal name | LEGAL_NAME_DBA | EASY |
| SAME_NAME_DIFFERENT_LOCATION | SIMILAR_NAME_DIFFERENT_STATE | MODERATE |
| NAME_SIMILAR_TO_EXISTING_USDOT_DIFFERENT | NAME_VARIATION | HARD |
| BRAND_FRANCHISE_VAN_LINE | FRANCHISE_OR_BRANCH | HARD |
| SAME_NAME_SAME_LOCATION_DIFFERENT_USDOT | SAME_ADDRESS_DIFFERENT_ENTITY | VERY_HARD |
| POSSIBLE_DUPLICATE_INGEST | DUPLICATE_SOURCE_RECORD | VERY_HARD |

008b `resolution` / `REMAIN_REVIEW_REQUIRED` is **not** copied into the candidate.

## Contractor construction (surfacing only)

Automated pairing may rank; it does **not** label.

| Method | case_type | difficulty |
|--------|-----------|------------|
| Same normalized name, same state, different license key | MULTI_LICENSE_ENTITY | MODERATE |
| Same normalized name, different state | CROSS_STATE_ENTITY | HARD |
| Same normalized address, different name | SAME_ADDRESS_DIFFERENT_ENTITY | VERY_HARD |
| One record’s DBA normalizes to another’s legal name | LEGAL_NAME_DBA | MODERATE |
| Shared leading name tokens, different remainder and address | FALSE_POSITIVE_TRAP | HARD |

Then deterministic rank `sha256(seed\|case_id)` with difficulty quotas (20/64/76/40 of 200) filled from those pools without inventing extra easy duplicates.

## Difficulty meaning

Assigned from **how the candidate was surfaced**, not from a predicted label. Guidance mix (10–20% EASY, …) is not forced when the frozen Move pool is dominated by same-name-different-location overlays.

## Pair control

- Canonical A/B order  
- duplicate case IDs = 0  
- duplicate logical pairs = 0  
- reverse duplicates = 0  
- one logical pair cannot appear under two case types  

## Not generated

- 10,000 auto cases  
- Google features  
- Individual-person license matching as the core question  
- Ground-truth MATCH/NON_MATCH
