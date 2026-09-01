# ATH-GUIDED-001 — Specialist locks

Verified 2026-09-01 before implementation.

## AskTrustHub

- Repository: savitz25/Conumers-Trust-Hub
- Accepted main: 0b632069d82e67a515835f87587cf9b369b3802a
- Production deployment: dpl_3kPd1Da1cCh6bRS7x8CFvPaoeaoU

## MoveTrustHub

- Repository: savitz25/Move-trust-Hub
- Main: 3cd9b72264aaa379ab8d04e5101a56744a1ae7fd
- Endpoint: https://www.movetrusthub.com/api/specialist-execution/v2
- Contract: trusthub-specialist-execution-v2
- Schema fingerprint: 48e96f1b7ebc6e3dae91e56f48737a23bbf80cdeaf2d03a9dba56b871297186d
- Contract fingerprint: 16a9c357c6472e1bcbe5feb75522ff9963e16b0c726701bd5152bf787b363949
- Locks: recorded HQ is not service territory; Broker may not physically transport; identity delegates to move-network-resolver-v1.

## SeniorTrustHub

- Repository: savitz25/care-trust-hub
- Main: 4a157de148fb7ec11c12c68d39bdf5eb98a35a3f
- Endpoint: https://www.seniortrusthub.com/api/specialist-execution/v2
- Contract: trusthub-specialist-execution-v2
- Fingerprints: not advertised by the accepted capability response
- Classes: Nursing Home, Home Health, Hospice
- Geography: state/city/ZIP for all; county for Nursing Home and Hospice; Home Health county is structured unsupported.
- Locks: classes stay separate; provider/office geography is not service area; CMS ratings are source-native, not rankings.

## ContractorTrustHub

- Repository: savitz25/contractor-trust-hub
- Main: c5d1d8b3eb50293bb5a1fc86ceee3808e0678a13
- Endpoint: https://www.contractortrusthub.com/api/specialist-execution/v2
- Contract: trusthub-specialist-execution-v2
- Fingerprints: not advertised by the accepted capability response
- Scope: public non-thin Florida DBPR construction credentials, supported trade/status/county filters, exact credential, pagination.
- Locks: Florida electrical returns HTTP 422 with unsupported_florida_electrical_source; recorded geography is not service territory; credential is not endorsement.

## Live probes

- Senior Nursing Home, Florida: HTTP 200; 694 total.
- Contractor Roofing, Broward: HTTP 200; 924 total.
- Move Auto Transport, New York recorded HQ: HTTP 200; 6 total.

Totals are source responses, not application constants.

