# ATH-GUIDED-001 — Specialist locks

Verified 2026-09-01 before implementation; Contractor V2.1 reverified 2026-09-02 after CON-CAP-002 Production closure.

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
- Production main: bf39fbc638dc2949e3d9a88f78e53673c7c513e0
- Endpoint: https://www.contractortrusthub.com/api/specialist-execution/v2
- Contract: trusthub-specialist-execution-v2
- Contract version: 2.1.0
- Schema fingerprint: 4c22013742744eab394f6d644ab1ffc4a287d9205a73545815e8a1619a0f79b5
- Contract fingerprint: 441f0e7c1f62bc4c5f9ed3720c56095d2b10748dcb9ff9130ad7eb62ea2f5eb7
- Integration artifact: docs/CON-CAP-002-ASK-INTEGRATION.md at the accepted Contractor main.
- Scope: public non-thin Florida DBPR construction credentials plus New Jersey DCA HIC and source-native specialty credentials; state/county/city execution where supported; exact credential; pagination; source-owned capability choices.
- Locks: HIC is not General; NJ mechanical is bounded to Master HVACR; Summit is a city in Union County; statewide fallback requires explicit confirmation; Florida electrical remains unsupported_florida_electrical_source; recorded geography is not service territory; credential is not endorsement.

## Live probes

- Senior Nursing Home, Florida: HTTP 200; 694 total.
- Contractor Roofing, Broward: HTTP 200; 924 total.
- Contractor HIC, New Jersey: HTTP 200; 25,111 active/current total.
- Contractor Electrical, New Jersey: HTTP 200; 13,091 active/current total.
- Contractor HIC, Summit/Union County: HTTP 200; 29 active/current total.
- Move Auto Transport, New York recorded HQ: HTTP 200; 6 total.

Totals are source responses, not application constants.
