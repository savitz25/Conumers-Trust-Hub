# Claim Policy Matrix V1

Version: `ath-claim-policy-2026-09-09.1`

Claim authority is evaluated by hub, exact profile class, jurisdiction and policy version. It authorizes a human through an organization to one specialist profile. It never transfers ownership of Layer A evidence, implies endorsement, or affects ranking. All V1 policies require human confirmation; automatic approval is off.

| Hub | Claimable profile class | Identifier grain | Status | Automatic approval | Strong signals | Step-up/conflict behavior |
|---|---|---|---|---|---|---|
| Move | `mover` | Exact published USDOT mover profile | PARTIAL | INELIGIBLE | corporate officer match plus independently verified public callback | Free email, representatives and missing independent authority are held; competing claims or grants conflict |
| Lender | `institution` | Exact published NMLS institution | PARTIAL | INELIGIBLE | corporate officer match plus independent authority | Branches and MLOs are excluded; conflicts are held |
| Insurance | `legal_insurer` | Exact published NAIC legal insurer | PARTIAL | INELIGIBLE | corporate officer match plus independent authority | Agency and producer identities are excluded |
| Senior | `nursing_home` | Exact CMS CCN nursing-home profile | PARTIAL | INELIGIBLE | corporate officer match plus independent authority | Provider class must remain exact |
| Senior | `home_health` | Exact CMS CCN home-health profile | PARTIAL | INELIGIBLE | corporate officer match plus independent authority | Provider class must remain exact |
| Senior | `hospice` | Exact CMS CCN hospice profile | PARTIAL | INELIGIBLE | corporate officer match plus independent authority | Provider class must remain exact |
| Contractor | `contractor` | Exact published credential/native profile | PARTIAL | INELIGIBLE | corporate officer match plus independent authority | Similar names never establish identity |
| Investor | `firm` | Exact published firm CRD profile | PARTIAL | INELIGIBLE | corporate officer match plus independent authority | Individual adviser CRDs are excluded |

Unknown hubs, profile classes, jurisdiction-specific overrides, and unproven cells return `NOT_YET_DEFINED` and fail closed to manual review. A matching business email domain is only a signal and cannot independently produce GREEN. An active management grant or competing claim produces a conflict requiring manual resolution. Sensitive uploaded-document workflows are not yet defined.
