# Contractor DBPR license-status source contract v2

Capability: `contractor.fl.dbpr.license_status`, version **2**, namespace `fl.dbpr.license`, grain `license_status`, jurisdiction FL. This is a new approved contract; v1 and its observations retain their original meaning.

The primary source is [DBPR Verify a Licensee, Search by License Number](https://www.myfloridalicense.com/wl11.asp?mode=1&search=LicNbr). Each check submits the full credential with Construction Board 06, resolves one unique official detail ID, and independently confirms the same full credential on that detail page. Primary-name and DBA search rows may share that one ID. Different IDs for the same credential, numeric-core collisions, missing identity, changed markup and unsupported status combinations fail closed.

The [Construction bulk extract](https://www2.myfloridalicense.com/sto/file_download/extracts//CONSTRUCTIONLICENSE_1.csv) remains a secondary discovery input. Its intentional exclusion of delinquent, null-and-void and involuntarily inactive licenses is never interpreted as a license status. The v2 scheduled check does not depend on bulk inclusion.

## Material fields and permitted metadata

`primary_status` and `secondary_status` are independently material. Both participate in the deterministic P15 fingerprint and status-pair transition classifier. The original official status string is retained as bounded metadata and must agree with the normalized pair.

| Official primary value | Normalized value |
|---|---|
| Current | `current` |
| Delinquent | `delinquent` |
| Null & Void / Null and Void | `null_and_void` |
| Involuntary / Involuntarily Inactive | `involuntarily_inactive` |

Secondary values preserve active, inactive, voluntarily inactive and involuntarily inactive. A genuinely absent secondary value is `not_reported`. Unknown text is a schema failure, not an invented safe status. DBPR's [renewal FAQ](https://www2.myfloridalicense.com/construction-industry/faqs/) explains why Delinquent,Active must not become current active: its secondary status describes the state before delinquency.

Permitted provenance is the exact credential plus the allowlisted official detail URL. No person name, address, email, consumer ID, session token, discipline, Sunbiz record, permit, lawsuit or review is ingested by this path.

## Clocks, source health and ordering

The official detail page does not publish a record-as-of timestamp. `source_as_of` stays NULL and the UI says **Not published by DBPR**. The page's rendered wall clock, license expiration date and original licensure date are not substituted for that timestamp.

`retrieved_at` records completion of the actual exact lookup. `observed_at` records database observation time. Existing P15 ordering uses retrieval time for this explicitly undated live source; it does not claim that the license status legally became effective then. The source contract and clock policy are immutable within v2.

Daily polling remains at **12:41 UTC**. A compatible exact lookup is current for the governed one-day expectation plus one-day grace. Health describes the check, never whether the license is active or current. Missing checks, lookup failures, schema drift, ambiguity and quarantine prevent no-change reassurance. A transient fetch failure can recover after the next compatible lookup; schema drift and mass-change quarantine still require operator review.

The first accepted v2 observation is a new baseline, not an inferred transition from v1's different contract. A repeated scheduled run is idempotent. A later retrieval with the same material pair records a check without a change event. Out-of-order and same-time conflicting observations retain P15 protections. Mass-change quarantine and source-event classification remain; the ingestor has no consumer Alert or delivery fanout privilege.

## Consent and permissions

Registering v2 creates no coverage. The owner must submit the version-change form with consent revision `dbpr-exact-lookup-v2/2026-09-10`. The atomic P14 operation preserves the Watch, disables its v1 coverage, enables one v2 coverage row, and records both versions and the consent revision in private audit events. Retry is idempotent; missing consent, stale Watch versions, other users and unrelated capabilities are denied. Pause/resume and restart preserve selected versions.

The existing scoped `myth_p15_dbpr_runtime` role may execute exactly four functions: the v1 target/poll pair and the v2 target/poll pair. It still has no table grants, role memberships, arbitrary consumer access, source-governance mutation or quarantine-release capability. SQL separately validates allowed fields, exact identities, timestamps, source URLs and the official/normalized status agreement.

The v2 adapter permits at most 20 targets per invocation and a 60-second lookup budget, with bounded response bodies and at least one second between requests within each lookup. Capacity or timeout failures record unsuccessful health rather than silently skipping coverage. The initial canary has one exact target.

## Verification

Reproduce the isolated checks with `node --test scripts/test-stage4-dbpr-v2.mjs`, `node scripts/test-stage4-dbpr-v2-runtime.mjs`, `node scripts/test-stage4-p15.mjs` and `node scripts/test-stage4-runtime.mjs`. Production founder-consent, scheduler and release evidence belongs in `docs/my-trusthub-stage-4.md` and `artifacts/my-trusthub-stage-4.json` after certification.
