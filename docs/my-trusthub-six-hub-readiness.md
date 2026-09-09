# My TrustHub six-hub readiness

Date: 2026-09-08
Status: non-production audit; no specialist production write path changed

## Shared integration contract

Every specialist browser calls its same-origin BFF. The BFF uses a hub-scoped server identity and a short-lived canonical-user authorization assertion to call the parent `/v1/my` surface. The parent derives the consumer from the verified assertion/session and never accepts a browser-supplied canonical user ID. Cookies remain host scoped. Private notes, delivery history, export, and deletion stay parent-only.

The checked-in [hub registry](../lib/my-trusthub/hub-registry.json) contains exact production and preview origins, return-path prefixes, audiences, service identities, and scopes. The [reference BFF adapter](../lib/my-trusthub/specialist-bff-adapter.ts) is deliberately inert until an assertion issuer and hub credentials are provisioned. No parent `service_role` credential is distributed.

## Readiness matrix

| Hub | Current identity/data reality | Entity binding | BFF | Save | Project context | Watch certification | Session resume | Production environment | Recommendation |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| Move | Separate Supabase identity/data; existing legacy handoff and FMCSA-oriented data | No production parent bootstrap | No canonical P13 adapter provisioned | No | No | None | No | Unverified | HOLD |
| Lender | Separate Supabase identity/data; legacy public handoff uses broad service-role session minting | No production parent bootstrap | Legacy flow is not the canonical P13 contract | No | No | None | No | Unverified | HOLD |
| Insurance | Separate Supabase identity/data; local Saved state and legacy handoff exist | No production parent bootstrap | Legacy flow is not the canonical P13 contract | No | No | None | No | Unverified | HOLD |
| Contractor | Custom PostgreSQL `app_user`/session model; FL DBPR and Sunbiz pipelines exist | No production parent bootstrap | Custom-session P13 adapter absent | No | No | None | No | Unverified | HOLD |
| Senior | PostgreSQL/CMS evidence pipeline; no established canonical parent consumer session | No production parent bootstrap | P13 adapter absent | No | No | None | No | Unverified | HOLD |
| Investor | PostgreSQL/Form ADV pipeline; future user/RLS placeholders are not canonical parent auth | No production parent bootstrap | P13 adapter absent | No | No | None | No | Unverified | HOLD |

`HOLD` means public specialist research remains unchanged. It does not block the public evidence pages; it blocks My TrustHub writes from that hub.

## Evidence found and remaining work

- Move has FMCSA fields, refresh-run/change-log concepts, and existing source assets. Those records have not been transformed through the P15 observation/checkpoint contract or certified for consumer monitoring.
- Lender has NMLS identity validation, regional evidence migrations, and an older shared-tenant handoff implementation. It must adopt canonical parent identity links and hub-scoped credentials.
- Insurance has Supabase Auth, private vertical state, DFS datasets, and an older shared-tenant handoff. Existing vertical Saves remain separate and are not migrated by email or UUID.
- Contractor has robust FL DBPR and Sunbiz ingestion assets. Its custom session requires the P13 Contractor adapter; its local `app_user` ID can never be used as the parent consumer subject.
- Senior has CMS ingestion, ownership tables, source manifests, and identifier-based matching. It still needs a parent entity-binding bootstrap, P15 adapter, BFF, and host session contract.
- Investor has SEC Form ADV ingestion and canonical firm identifiers. It still needs a parent entity-binding bootstrap, P15 adapter, BFF, and host session contract.

## Binding bootstrap gate

For each hub, produce a reviewed manifest containing hub, specialist entity ID, identifier namespace, source identifier, jurisdiction, validity range, provenance, proposed network entity, and resolution state. Only deterministic authoritative identifiers may become accepted. Ambiguous matches enter `review_required`. Email, names alone, ranking position, or similarity alone cannot create an accepted binding. The parent identity governor reviews and applies accepted records through the P11 governance functions.

## Watch capability gate

No Watch grain is certified for production. Candidate assets exist, but none has completed the required production-specific checks: exact entity linkage, normalized material schema, source clocks, pagination/completeness, cadence, freshness policy, anomaly threshold, outage behavior, baseline creation, confirmation destination, and operational ownership.

| Candidate grain | Current result |
|---|---|
| FL DBPR license status | UNCERTIFIED |
| FL DBPR discipline | UNCERTIFIED |
| FL Sunbiz entity status | UNCERTIFIED |
| FMCSA operating authority | UNCERTIFIED |
| NMLS public status | UNCERTIFIED |
| FL DFS agency status | UNCERTIFIED |
| CMS ownership | UNCERTIFIED |
| Form ADV material change | UNCERTIFIED |

Until certification, Saved may be enabled after the corresponding BFF/binding gate, while Watch remains unavailable or honestly limited.
