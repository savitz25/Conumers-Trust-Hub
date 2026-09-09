# Business Activation V1

Activated Business is frozen as: an approved active management grant, plus an exact Business Manager profile open, plus at least one legitimate post-claim action. Approval, login, or a page open alone is insufficient.

Manager opens are recorded in `ath_business_activity_events` only after the canonical Ask session, active membership, active grant, and exact managed profile are resolved server-side. The browser cannot supply an organization identity. Recording is fail-open for the legitimate Business Manager request.

The instrumentation epoch is the `MANAGED_PROFILE_OPEN_V1` row created by Migration 015. An older grant with no measured open is `MANAGER_OPEN_HISTORY_UNAVAILABLE`, not falsely unactivated. Activation time is the latest of grant approval, first valid manager open, and first qualifying action.

Qualifying durable actions are Layer B updates/reconfirmation, team invitations, record issues, submitted business responses, and supported monitoring enablement. Authoritative domain records are queried rather than duplicated.

Thirty-day active means an activated organization with qualifying product activity during the following 30-day measurement window. `ACTIVATED_WITHIN_30_DAYS_OF_APPROVAL` remains a separate growth conversion metric. Entitlement or future paid status is not an activation input.
