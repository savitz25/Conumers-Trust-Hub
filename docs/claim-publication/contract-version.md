# Contractor public contract version

The certified contract is version `1`, hub `contractor`, exact UUID `nativeProfileId`, `managed: true`, and source `BUSINESS_SUPPLIED`. Dedicated Contractor endpoints emit V1; generic network endpoints may use their existing V2 contract.

Ask uses a serialization allowlist. Contractor rejects unknown top-level, field, freshness, hour, and response keys, mismatched IDs or hubs, unsupported versions, invalid URLs/contact values, markup, and malformed collections. The identical canonical JSON fixture is checked into both repositories and parsed by both test gates. A future version must be deployed compatibly: consumer support first, then producer emission, then optional retirement.
