# Senior Academic V1 — future package manifest specification

**No zip, CSV, Parquet, checksum file, or DOI is created in this task.**  
Do not invent `bytes`, extract `sha256`, `release_date`, or DOI values.

---

## Future package contents

When an extract is later authorized, the directory `trusthub-senior-regulatory-v2026.07.29/` should contain:

| Path | Role |
|------|------|
| `README.md` | This dataset’s README |
| `DATA-DICTIONARY.md` | Dictionary |
| `SOURCES.md` | CMS source register |
| `LIMITATIONS.md` | Limitations |
| `FIELD-FREEZE.md` | Normative columns (may be folded into dictionary at ship time) |
| `CITATION.cff` | Citation File Format; DOI empty until assigned |
| `CHANGELOG.md` | First version notes |
| `manifest.json` | Machine-readable inventory |
| `checksums.sha256` | SHA-256 of **every shipped file** (academic outputs, not only CMS sources) |
| `data/*.csv` | Open V1 tables counsel approved |
| `data/*.parquet` | Optional twins |

Never ship `.env`, database dumps, `raw_record` JSON, Google cache, family workspace, or daily PBJ.

The published version string must not be mutated in place.

---

## `manifest.json` fields

Instantiate at extract time. Nulls below are required until a real extract exists.

| Field | Now | At extract |
|-------|-----|------------|
| dataset_id | `trusthub-senior-regulatory` | same |
| version | `v2026.07.29` (proposed) | freeze if Provider Information vintage unchanged |
| release_date | **null** | ISO date of publication authorization |
| created_at | **null** | ISO timestamp of extract job |
| canonical_entity | `nursing_facility` / `cms_ccn` | same |
| license_status | `PENDING_COUNSEL` | counsel-selected value |
| doi | **null** | repository value or still null |
| warehouse_recount_at | `2026-08-21T01:39:39.942Z` | plus extract-time recount |
| cms_provider_information_release_key | `2026-07-29` | must match or version bumps |

Per-file object (repeat for each shipped file):

| Field | Now |
|-------|-----|
| file name | path relative to package root |
| rows | live warehouse count as target; **null** for bytes until file exists |
| columns | count from FIELD-FREEZE public columns |
| bytes | **null** — do not invent |
| sha256 | **null** — do not invent (distinct from CMS `content_sha256`) |
| source releases | keys from `sources.csv` |
| transformation version | e.g. `provider-information-v2` |

Example shape (nulls are deliberate):

```json
{
  "dataset_id": "trusthub-senior-regulatory",
  "version": "v2026.07.29",
  "release_date": null,
  "created_at": null,
  "canonical_entity": {
    "type": "nursing_facility",
    "identifier": "cms_ccn"
  },
  "license_status": "PENDING_COUNSEL",
  "doi": null,
  "files": []
}
```

---

## `CITATION.cff` (future)

Use Citation File Format. Do **not** fill `doi` or `date-released` until real.

```yaml
cff-version: 1.2.0
title: TrustHub Senior Regulatory Research Dataset
message: Cite CMS as the source of the records; cite TrustHub for organization and schema.
type: dataset
version: trusthub-senior-regulatory-v2026.07.29
# doi:   # unassigned
# date-released:  # unassigned
```

---

## `checksums.sha256`

Standard `sha256sum` lines for every file in the package after extract. Empty until files exist. CMS source-file hashes belong in `sources.csv` / `SOURCES.md` and must not be substituted as academic CSV hashes.

---

## Integrity checks at extract time (not run now)

1. Re-run SELECT-only recount SQL.
2. Fail if current CCN count ≠ 14,693 **or** Provider Information `release_key` ≠ `2026-07-29` without a version bump.
3. Duplicate current CCN groups remain 0.
4. Each CSV row count equals freeze (or a documented counsel-approved filter).
5. Excluded-field scan: no `raw_record`, Google columns, ownership person names, daily PBJ, AL, state overlays, matcher confidence.
6. `downloadHref` and `doi` remain null until a separate publication decision.
