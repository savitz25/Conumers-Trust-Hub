# Academic 001B.2A — Release manifest specification

**Status:** Specification for a **future** immutable package.  
**No zip, CSV, Parquet, DOI, or download link is created in this task.**  
**Proposed package id:** `trusthub-senior-regulatory-v2026.07.29`  
**Snapshot date (CMS Provider Information `source_modified_at`):** 2026-07-29  
**Extract date (when files are later cut):** unassigned — must be recorded at extract time  
**Live warehouse recount used to size the freeze:** 2026-08-21T01:39:39.942Z UTC

Citation template (DOI blank until a repository assigns one):

```
TrustHub Research Data. TrustHub Senior Regulatory Research Dataset. Version trusthub-senior-regulatory-v2026.07.29. [extract date unassigned]. DOI: [when assigned].
```

Underlying records: Centers for Medicare & Medicaid Services public files listed below.

---

## 1. What a published freeze must contain

A later release directory (example name only) `trusthub-senior-regulatory-v2026.07.29/`:

| Path | Required |
|------|----------|
| `README.md` | yes — limitations, how to cite CMS vs TrustHub, no scoring claims |
| `LICENSE` | yes — text **after** counsel assigns a license; until then `LICENSE.STATUS = PENDING_COUNSEL` |
| `CITATION.txt` | yes — template above; empty DOI |
| `CHANGELOG.md` | yes — first version notes |
| `manifest.json` | yes — this spec instantiated with **file** SHA-256 after extract |
| `schema.json` or `schema/` | yes — column types matching the data dictionary |
| `data-dictionary.md` | yes — ship the dictionary (or a freeze of it) |
| `sources.csv` | yes — CMS vintages + source-file SHA-256 |
| `data/*.csv` | yes — tables listed in the freeze spec that counsel approved |
| `checksums.sha256` | yes — SHA-256 of every shipped file |

Optional: `data/*.parquet` twins. Never ship `.env`, database dumps, `raw_record` JSON, or Google cache.

The package **must not** be mutated in place after publication. A later CMS month becomes `v2026.MM.DD` (new snapshot date), not an overwrite of `v2026.07.29`.

---

## 2. `manifest.json` schema (to instantiate at extract time)

```json
{
  "package_id": "trusthub-senior-regulatory-v2026.07.29",
  "title": "TrustHub Senior Regulatory Research Dataset",
  "version": "2026.07.29",
  "release_status": "PLANNED",
  "access_level": "INTERNAL_RESEARCH",
  "doi": null,
  "download_href": null,
  "canonical_identifier": "cms_ccn",
  "snapshot": {
    "cms_provider_information_release_key": "2026-07-29",
    "cms_provider_information_source_modified_at": "2026-07-29T00:00:00.000Z",
    "cms_provider_information_retrieved_at": "2026-08-14T16:37:37.046Z",
    "warehouse_recount_at": "2026-08-21T01:39:39.942Z",
    "extract_completed_at": null
  },
  "row_counts_live_warehouse": {
    "facilities": 14693,
    "facility_inspections": 149705,
    "facility_deficiencies": 418344,
    "facility_enforcement": 16166,
    "facility_chains": 10231,
    "facility_ownership_all_relationships": 674063,
    "facility_ownership_organization_relationships": 220673,
    "facility_ownership_individual_relationships": 453390,
    "facility_ownership_changes": 5227,
    "facility_staffing_quarters": 57873
  },
  "files": [],
  "excluded_from_open_v1": [
    "pbj_staffing_day",
    "google_places",
    "family_workspace",
    "assisted_living",
    "facility_history_event",
    "published_state_claim",
    "ownership_individual_display_names",
    "raw_record"
  ],
  "license_status": "PENDING_COUNSEL",
  "citation_status": "TEMPLATE_ONLY"
}
```

After extract, each `files[]` entry:

```json
{
  "path": "data/facilities.csv",
  "bytes": null,
  "sha256": null,
  "rows": 14693,
  "primary_key": ["ccn"]
}
```

`sha256` and `bytes` stay null until files exist. **Do not invent checksums.**

---

## 3. Source-file SHA-256 already stored (warehouse provenance)

These hash **CMS files TrustHub retrieved**, not academic CSV extracts. Live `source_release.content_sha256` on 2026-08-21:

| Dataset key | release_key | transformation_version | content_sha256 |
|-------------|-------------|------------------------|----------------|
| nursing-home-provider-information | 2026-07-29 | provider-information-v2 | `dd15b5c31a632e46f9f28260ed9ad89486e48bba5d0589b3ccaa68214e8b9ef1` |
| nursing-home-inspection-dates | 2026-07-01 | inspection-dates-v1 | `d1163032b116a73e828ba43a68550fad36eec794f7d046d5ffc9ff6df705f942` |
| nursing-home-health-deficiencies | 2026-07-01 | health-deficiencies-v1 | `cba84cc4809cfa6baaecd10cb68305769e87d1120a77c4aa3cec465df4487c7f` |
| nursing-home-penalties | 2026-07-01 | penalties-v1 | `beeadfdb2ad5a1c8324548e260929419960bfe3948b5fec3b4febce99b28cb5f` |
| nursing-home-ownership | 2026-07-01 | cms-ownership-v1 | `400b92e113e216cadebe22e77397572e1b8a8c71d7fc240a3bdeaf41fa939879` |
| skilled-nursing-facility-all-owners | 2026-07-27 | cms-ownership-v1 | `b0f57a17e2d1eabe818ed574736ce9fe43345a9105768d54339abcaa5cd2a530` |
| skilled-nursing-facility-change-of-ownership | 2026-07-27 | cms-ownership-v1 | `67389bd582d2d8b9d7ed01a0eec541d09978fc9c7c6ee9970849a33ebb43721c` |
| skilled-nursing-facility-change-of-ownership-owner-information | 2026-07-27 | cms-ownership-v1 | `f0067fd76bd1f624eab1229e6c73285b208b58f7e525c14c3e4e1ad001fccbdd` |
| skilled-nursing-facility-enrollments | 2026-07-27 | cms-ownership-v1 | `6ad13e7f19a839a6927d04db625f86f9dcbd6b5343e80f2ffae9314e94f4a841` |
| skilled-nursing-facility-enrollments | 2026-07-27 | cms-chain-membership-v1 | same source bytes as row above |
| payroll-based-journal-daily-nurse-staffing | 2025-11-20 | pbj-daily-nurse-v1 | `5c1965fc3136a30f9472bc443a30a59c237e8dd143f11e9af7eddec398d1cdf5` |
| payroll-based-journal-daily-nurse-staffing | 2026-02-05 | pbj-daily-nurse-v1 | `9cc063f19283f110e6184cb2fee124fa76a2b89f646c4d90db4976139c28f3c8` |
| payroll-based-journal-daily-nurse-staffing | 2026-04-29 | pbj-daily-nurse-v1 | `d0423869d1e07227270d323c26e2b29fecec50a1c55f2291d0325f00c2e18571` |
| payroll-based-journal-daily-nurse-staffing | 2026-07-29 | pbj-daily-nurse-v1 | `32873501edc3383edc2177f4ada29e5f055b0d1459bea4cd0c0190e581236e1e` |
| nursing-home-chain-performance-measures | 2026-03-11 | cms-chain-v1 | `44d7fab517ffb21dc03b55b592b3fcd222efcdccf5f67b2a74e4d3e8facebe01` |
| nursing-home-chain-performance-measures | 2026-04-08 | cms-chain-v1 | `a218c6a4ced0591ea5bec7cd100b4701606001713140288922e5d436aea48f3f` |
| nursing-home-chain-performance-measures | 2026-05-15 | cms-chain-v1 | `1412e40f8206f365944a2ea0a540a26ecd814eaddc3a36436983ac3830feecc1` |
| nursing-home-chain-performance-measures | 2026-06-10 | cms-chain-v1 | `bdd949f6b112fecbd4193e708751d77b48a7c8701a015fd2eef2b9a26837acd2` |
| nursing-home-chain-performance-measures | 2026-07-15 | cms-chain-v1 | `09a0a196fa49ccb45939e370ca07797e539debdfad330f10b11d0dc71aeb6afe` |
| nursing-home-chain-performance-measures | 2026-08-12 | cms-chain-v1 | `5d8b03d8fc96410dd7105fd7f4fe17e3d855bc3376b2a31845adf6bb914b744b` |

Landing pages (official CMS, not TrustHub mirrors):

| Product | CMS id | URL |
|---------|--------|-----|
| Provider Information | `4pq5-n9py` | https://data.cms.gov/provider-data/dataset/4pq5-n9py |
| Inspection Dates | `svdt-c123` | https://data.cms.gov/provider-data/dataset/svdt-c123 |
| Health Deficiencies | `r5ix-sfxw` | https://data.cms.gov/provider-data/dataset/r5ix-sfxw |
| Penalties | `g6vv-u9sr` | https://data.cms.gov/provider-data/dataset/g6vv-u9sr |
| Ownership | `y2hd-n93e` | https://data.cms.gov/provider-data/dataset/y2hd-n93e |
| All Owners | `afe44b85-cc6d-40d7-b5df-00ae8910d1d2` | https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/skilled-nursing-facility-all-owners |
| Enrollments | `5f2c306f-3b1c-42cd-b037-187b2ce22126` | https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/skilled-nursing-facility-enrollments |
| CHOW | `f557a6ed-95b3-4a22-8433-4175db2dec1c` | https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/skilled-nursing-facility-change-of-ownership |
| CHOW owner information | `a4358712-e910-4eaf-8f24-5e90ba3cf8d0` | https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/skilled-nursing-facility-change-of-ownership-owner-information |
| Chain performance | `97ecfad1-d3f1-4d42-b774-d74661d830bc` | https://data.cms.gov/quality-of-care/nursing-home-chain-performance-measures |
| PBJ daily nurse staffing | `7e0d53ba-8f02-4c66-98a5-14a1c997c50d` | https://data.cms.gov/quality-of-care/payroll-based-journal-daily-nurse-staffing |
| NH data dictionary PDF | — | https://data.cms.gov/provider-data/sites/default/files/data_dictionaries/nursing_home/NH_Data_Dictionary.pdf |

---

## 4. Integrity checks at extract time (not run now)

When 001B.2B or a later extract is authorized:

1. Re-run the SELECT-only recount SQL. Fail if current-CCN count ≠ 14,693 **or** if the Provider Information `release_key` is no longer `2026-07-29` without a version bump.
2. Confirm duplicate current CCN groups remain 0.
3. Row counts of each CSV must equal the freeze table (or a documented, counsel-approved filter such as org-only ownership).
4. SHA-256 every output file into `checksums.sha256`.
5. `downloadHref` and `doi` remain null until publication is separately authorized.
6. Do not include Google, family workspace, assisted living, or daily PBJ.

If the warehouse has moved to a newer Provider Information month, **do not** silently relabel this package. Cut a new version string.

---

## 5. Access and citation fields (Ask registry)

Until publication:

| Field | Value |
|-------|--------|
| `releaseStatus` | `PLANNED` (documentation exists; files do not) |
| `accessLevel` | `INTERNAL_RESEARCH` |
| `downloadHref` | `null` |
| `doi` | `null` |
| `licenseStatus` | `PENDING_COUNSEL` |
| `citationStatus` | `TEMPLATE_ONLY` |
| `businessIdentificationPolicy` | `UNDECIDED_COUNSEL_REVIEW` |

Possible later archives (not registered): Zenodo, Harvard Dataverse.

---

## 6. README limitations that must ship with any future zip

Copy-forward from 001B.1 / this freeze:

- Missing CMS values are not a clean record.
- Inspections are not a complete history of harm.
- 30,374 deficiencies do not join to an inspection event in this vintage.
- Ownership is CMS-published disclosure, not independent beneficial-owner proof.
- Provider Information is active homes only.
- Stars are CMS methodology, not TrustHub scores.
- Penalty dates cover 2023-07-17–2026-06-11 only.
- One Provider Information release is a cross-section; inspection/deficiency/CHOW dates are event history **within CMS file windows**.
- Researchers must re-check the primary CMS source for current status.
