# Contractor V1 field matrix

All public values use source `BUSINESS_SUPPLIED`, appear only in the separate “Information supplied by the business” section, and never override DBPR evidence. Blank values produce no row or empty card. Public values withdraw after active authority is lost, within the cache window. Owner saves and prior/new versions remain reconstructable from first-party audit state.

| Ask storage key | V1 policy | Validation | Public label/location | Freshness, cache, SEO and rollback |
|---|---|---|---|---|
| description | PUBLIC_NOW | Plain text, no markup, max 2,000 | About / business section | Business freshness; 60s API window; HTML only, not source JSON-LD; withdrawn on revocation |
| website | PUBLIC_NOW | Absolute HTTP(S), max 300; consumer rejects credentials | Website / business contact | `nofollow noopener noreferrer`; not source JSON-LD; withdrawn on revocation |
| public_phone | PUBLIC_NOW | 7–40 safe phone characters | Phone / business contact | Explicitly business-supplied; withdrawn on revocation |
| public_email | PUBLIC_NOW | Email shape, max 254 | Email / business contact | Explicitly business-supplied; withdrawn on revocation |
| founded_year | PUBLIC_NOW | Four digits, plausible year | Founded year provided by the business | Separate from official filing date; not source JSON-LD |
| emergency_service | PUBLIC_NOW | `true` or `false` | Availability provided by the business | Reported availability; response not guaranteed |
| contact_context | PRIVATE_V1 | Owner-account text validation | Not serialized or rendered publicly | Remains private; no cache/SEO/public rollback effect |
| services | PUBLIC_NOW | Up to 30 unique plain-text values, 80 chars each | Services described by the business | Separate section; withdrawn on revocation |
| serviceAreas | PUBLIC_NOW | Up to 30 unique plain-text values, 80 chars each | Service area provided by the business | Explicitly not license authority |
| languages | PUBLIC_NOW | Up to 30 unique plain-text values, 80 chars each | Languages / business section | Business-supplied; withdrawn on revocation |
| hours | PUBLIC_NOW | Unique weekdays; valid ordered 24h times; closed days have no times | Availability provided by the business | Business-supplied; withdrawn on revocation |

All ten `PUBLIC_NOW` dimensions publish automatically after a valid save by current authorized management. Business responses are separately moderated and are not part of these eleven dimensions.
