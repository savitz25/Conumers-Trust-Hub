# Search Rollback Runbook

Rollback is a deliberate operator action; ATH-ADMIN-007 never promotes a deployment automatically.

1. Confirm the failing serving build SHA and current release evaluation.
2. Inspect blocker assertions, real-traffic context, dependency health, and any open Search incident.
3. Identify the last known good Vercel deployment whose build-specific RELEASE evidence was current.
4. Confirm database/schema compatibility between that artifact and current Production. Do not roll application code behind a required irreversible schema dependency.
5. With appropriate deployment authority, manually promote the last known good Vercel artifact when warranted.
6. Verify the production alias serves the intended SHA; an identity mismatch remains BLOCKED.
7. Run the RELEASE suite, then QUICK. Require fresh evidence for the serving build.
8. Verify `/`, `/ask`, `/claim/continue`, `/manage`, `/methodology`, `/trust`, and fail-closed Admin routes.
9. Record the incident recovery and deployment decision without secrets, raw questions, or raw responses.

The Control Plane may display `ROLLBACK RECOMMENDED`, but generic Admin Commands and `SEARCH_FEATURE_DISABLED` remain `NOT_YET_CONNECTED` until mature MFA/step-up and separate governance exist.
