# Somerset County — ATH-NJ-COUNTY-001B notes

FIPS 34035. Work limited to `data/network/new-jersey/counties/somerset/`.

## What came cleanly

- ArcGIS Hub + DCAT-US catalog (75 items), org `2g2XvfUywwLJoF2c`.
- Housing Options FeatureServer: 200 points; **58** senior-related (Senior Residence 21, Assisted Living 20, CCRC 4, Active Adult 13). Matches Housing Navigator “58”.
- Nursing-home geocode: 14 points from CJHRC addresses.
- Documented FeatureServers for sewer (48), county roads (2,171), parklands (28), ROSI (617), SFHA (2,401), parcels (132,911).

## Semantic locks

- County housing inventory ≠ NJDOH/CMS license.
- Parcel viewer ≠ legal survey.
- 200-foot widget ≠ automatic legal notice.
- Daniel’s Law: owner names redacted on the Tax Parcel Viewer and absent from the Parcels FeatureServer fields.
- Mortgage/lien records in Acclaim ≠ balance or contractor wrongdoing.

## Skipped on purpose

Acclaim (free account, no bulk). Sheriff HTML (buyer names). Bulk NJGIN parcels, FEMA, NJDEP hydro/LULC.
