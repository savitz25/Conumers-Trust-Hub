# ATH-TX-001 — Texas six-hub official source map

State level only. First Texas ticket. No public `/texas` pages. No county work. No sitemap changes. No specialist-repo edits.

Repo: `savitz25/Conumers-Trust-Hub`  
Branch: `ath-tx-001-texas-network-foundation`  
Checked: 2026-09-03

Machine-readable maps live under `data/network/texas/`.

## What shipped

- Isolated source manifests for Ask + six hubs
- Live SODA counts and official CSV clocks for TDLR, TDI, Comptroller CMBL, TxDOT, TSBPE, SML
- Small fixtures only (giant files gitignored under `data/raw/`)
- Safe acquisition scripts (`scripts/texas/`)
- No Trust Score, no paid ranking, no people publication

## Hub readiness after this ticket

| Hub | Strongest ready official dataset | Access | Next |
| --- | --- | --- | --- |
| Insurance | TDI agencies 56,625 rows / 43,597 NPN + 622,019 agency appointments (1,414 NAIC) | OPEN_SODA_API | Ingest agency graph; export authorized-company report; do not publish 962,001 person licenses or 4.40M person appointments |
| Contractor | TDLR electrical contractors 14,036 (phones 14,031) + TSBPE RMP 9,360 (insurance expiry 9,348) + CMBL 12,000 (email 11,998). **No statewide GC license.** | OPEN_BULK_DOWNLOAD | Trade subsets + plumbing insurance file + vendor overlay. Not a CSLB clone. |
| Senior | TULIP search-only. HHSC CCL 14,973 is **daycare**, not senior care. CMS overlay count UNKNOWN. | OPEN_SEARCH_ONLY / planned overlay | Do not scrape TULIP. Do not treat missing as zero facilities. |
| Lender | SML enforcement CSV 3,981 orders (NMLS on 2,493). NMLS Consumer Access search-only. | OPEN_BULK (orders only) / SEARCH_ONLY | No Florida-OFR-style company roster |
| Move | TxDMV TxMCCS household-goods **search-only**. TDLR tow companies 3,797 **do** expose Form E insurance fields. | SEARCH_ONLY / OPEN_BULK (tow only) | Tow ≠ household goods. TX authority ≠ USDOT. |
| Investor | SSB certificate search by CRD / TX file number. State-RIA bulk UNKNOWN. | OPEN_SEARCH_ONLY | SEC/IARD overlay. TX principal office ≠ state registration. |

## Recommended state build sequence (from this evidence)

1. **Insurance** — strongest complete bulk specialist environment (agency roster + appointment graph + complaints + rates).
2. **Contractor** — strong trade files, but not a general-contractor universe. Pair TDLR electrical/HVAC/elevator with TSBPE RMP (insurance-on-license) and CMBL vendor overlay.
3. Senior is **not** an early Texas specialist: TULIP is search-only; the easy HHSC SODA file is child care.

Then public **state** pages. Not counties. Not `/texas` in this ticket.

## Identity and contact

See `identity-source-map.json` and `contact-source-summary.json`.

Exact IDs only for adverse attach: TDLR, TSBPE LICENSE_NBR, NPN, NAIC, NMLS, CMBL VID, CRD, CMS CCN, HHSC ID, TxDMV, USDOT.

CMBL is the strongest contact file (12,000/12,000 phones, 11,998 emails) and is a **vendor** registry. It must not overwrite TDLR/TSBPE/TDI regulator fields.

## Deliberate skips

Texas counties, municipal permits, CAPTCHA, search scraping, TWC wage records (confidential), SOS paid Master Unload, giant TDLR All Licenses 187.40 Mb ingest, people publication, Trust Score, paid ranking, `/texas` UI.
