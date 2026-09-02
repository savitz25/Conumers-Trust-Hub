# ATH-CUST-014A Insurance dependency lock

- Production SHA audited at implementation: `d2242bc3b305db7f00d3b66ae0fa164e1bc6d0cd`
- Endpoint: `https://www.insurancetrusthub.com/api/customer-claim-validation/v1`
- Contract: `insurance-customer-claim-validation-v1`
- Version: `1.0.0`
- Schema fingerprint: `cc8d6cc82c4e118e266607196cad17ecf99033f4ee1bb6c46ffceceddf62741b`
- Contract fingerprint: `b6396688c36251e59e906db2b98cde40fd88d46c271e31598d7bd0a22c06c9eb`

Ask accepts only an exact `legal_insurer` response that binds the canonical
`national_entities.id`, five-digit NAIC Company Code, `PUBLIC_PROFILE`, current
eligibility, and the existing canonical InsuranceTrustHub profile URL.

Agency, producer/person, brand, group, relationship, directory, bail-bond,
research-only, unpublished, and held identities remain nonclaimable. This
integration does not publish profiles, add monitoring, change ordering, or
write to the Insurance evidence plane.

Accepted Production fixtures at implementation:

- Citizens Property Insurance Corporation: NAIC `10064`, UUID `27d7418a-d2bf-4339-8c3b-4774e7f403bc`.
- Florida Peninsula Insurance Company: NAIC `10132`, UUID `48283d8b-3092-4b0f-aa05-b8c4855f1c70`.
- A Central Insurance Company: NAIC `11105`, `PUBLICATION_RESTRICTED`.
