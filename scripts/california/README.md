# California official acquisition (ATH-CA-001)

State-level only. No public California routes. No county work.

## Allowed

- Official bulk form postbacks (CSLB Public Data Portal)
- CKAN `datastore_search` and `datastore/dump/{id}`
- Simple public HTML tables (DIR DLSE debarment)
- Documented open APIs after a live probe

## Forbidden

- CAPTCHA bypass
- Session search scraping
- Browser automation
- Guessed private APIs
- Committing huge raw CSVs
- Inferring personal contact information

## Run

From the repo root:

```
python scripts/california/acquire_official.py
```

Outputs stay under `data/raw/california/` (gitignored). Small fixtures belong under `data/network/california/`.

CKAN S3 `resource.url` signatures expire (`SignatureDoesNotMatch`). Use `datastore/dump/{resource_id}`.

CSLB SOAP `GetDataByClassification` returns `Missing Classification or Token` without a Data Portal token. Do not claim OPEN_API.
