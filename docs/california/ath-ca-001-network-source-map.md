# ATH-CA-001 — California six-hub official source map

State level only. First California ticket. No public California pages. No county work. No sitemap changes.

Repo: `savitz25/Conumers-Trust-Hub`  
Branch: `ath-ca-001-california-network-foundation`  
Checked: 2026-09-03

Machine-readable maps live under `data/network/california/`.

## What shipped

- Isolated source manifests for Ask + six hubs
- Contractor-first discovery, including a live CSLB bulk portal (file transfer incomplete)
- Easy official bulk for Senior (ELMS, HCAI, CCLD RCFE) and Insurance (DMHC trends, CDI health HTML list)
- Small fixtures only
- Safe acquisition scripts
- A narrow CSLB Full File request draft (not submitted)

## Hub readiness after this ticket

| Hub | Strongest ready official dataset | Access | Next |
| --- | --- | --- | --- |
| Contractor | CSLB Public Data Portal master (free) | OPEN_BULK_DOWNLOAD (transfer incomplete) | Stream the CSV |
| Senior | CDPH ELMS locations 15,097 + CCLD RCFE 12,522 + HCAI listing 10,871 | OPEN_BULK_DOWNLOAD | Fixtures → state page research |
| Insurance | DMHC enforcement 5,435 + CDI health list 28 | OPEN_BULK_DOWNLOAD / HTML table | Company-level, not producer scrape |
| Lender | CalHFA approved-lender HTML directory; DFPI/NMLS search | HTML table / OPEN_SEARCH_ONLY | No Florida-OFR-style bulk roster |
| Move | BHGS (not CPUC) | OPEN_SEARCH_ONLY | No bulk roster found |
| Investor | DFPI / IARD search | OPEN_SEARCH_ONLY | No CA RIA bulk file found |

## Identity and contact

See `data/network/california/identity-source-map.json` and `contact-source-summary.json`.

Rank: OFFICIAL_REGULATOR > OFFICIAL_VENDOR_REGISTRY > OFFICIAL_GOVERNMENT_PROGRAM > OFFICIAL_BUSINESS_REGISTRY > OTHER_OFFICIAL_SOURCE.

Never overwrite CSLB/CDPH/CDSS/CDI/DFPI/BHGS contacts with SOS or vendor contacts. Never infer personal contact.

## Deliberate skips

County assessor/parcel/sheriff, municipal permits, CAPTCHA, Incapsula/Cloudflare bypass, session scraping, huge raw CSVs, California public UI.

## Recommended state build sequence

1. Contractor (deepest) — land CSLB master, then DIR debarment.
2. Senior — strongest already-counted official bulk.
3. Insurance — DMHC + CDI HTML.
4. Lender — CalHFA directory as program evidence; DFPI/NMLS remain search.
5. Move / Investor — search-only until a bulk roster appears.

Then public **state** pages. Not counties.
