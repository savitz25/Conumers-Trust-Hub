# Contractor publication audit

Reviewed 7 September 2026. My Trust Hub writes validated business-controlled values to `ath_business_profile_*`. Ask projects a strict public DTO from an exact Contractor UUID. ContractorTrustHub fetches that DTO server-side, validates it, and renders a separate business-supplied section without changing the Trust Report.

## Findings and corrections

- The dedicated Contractor endpoints accidentally selected generic contract V2 while the live Contractor consumer accepted V1. They now explicitly select the frozen V1 overload.
- Contractor fetching was coupled to claim-CTA rollout. Fetching now depends on exact claim-profile identity; the rollout flag controls only new claim intake.
- Profile publication already required an active organization, grant, and qualifying membership. Response publication now has the same authority requirement.
- `contact_context` was accidentally public. It is private operator context in V1 and is removed from both producer and consumer contracts.
- Ask caches successful public DTOs for 60 seconds; Contractor fetches with `no-store` and a 1.5-second timeout. Invalid, missing, mismatched, or unavailable account data omits only the business layer.

The official DBPR-backed page model is never written by this path. No database migration is required.
