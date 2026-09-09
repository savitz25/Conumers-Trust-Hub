# My TrustHub Phase 2 Prompt 13 handoff

Date: September 7, 2026
Status: Complete and validated on one deleted ephemeral Supabase branch. Production remains unapplied.

## Scope

P13 defines the parent-owned `/v1/my` integration boundary used by same-origin specialist BFFs. It adds canonical auth and Project-context handoff storage under `ops`, exact hub/origin/path configuration, browser-session binding, replay controls, safe state reads, and narrow reuse of P12 Save/Project operations.

P13 does not add Watches, Watch capabilities, observations, changes, Alerts, notifications, saved session payloads, decisions, export/delete, legacy-user migration, or production deployment.

## Existing handoff audit

The checked-in Move/Lender/Insurance implementation already uses 32-byte random codes, SHA-256 hashes at rest, a 90-second TTL, target-hub binding, atomic one-time consumption, host-scoped destination sessions, and relative-path sanitization. Those primitives are retained.

The existing bridge is not the canonical consumer bridge because:

- storage is `public.network_auth_handoffs` in vertical Supabase projects;
- canonical identity still assumes a shared vertical `auth.users.id` that the P11 audit disproved;
- only some hubs deploy the runtime;
- issuer, exact origin, browser state, and nonce are not bound;
- the code and `next` path appear together in the destination URL;
- rate-count failure returns zero and therefore fails open;
- the vertical implementation uses broad service-role access and mints a destination session through an email/magic-link administrative path.

P13 does not modify those live repositories. A later rollout replaces their transport adapters only after the parent control plane is deployed and each hub passes the shared contract.

## Hub registry

`lib/my-trusthub/hub-registry.json` and `ops.consumer_hub_registry` define Ask plus the six specialists. Each entry has:

- an exact hub key;
- issuer and audience identifiers;
- a non-secret BFF service identity;
- exact production origins;
- an empty staging allowlist pending real staging domains;
- one explicit development localhost origin/port;
- allowed return-path prefixes;
- allowed scopes;
- enabled state.

Wildcard domains and arbitrary request `Origin` values are not accepted. Localhost entries are considered only when the caller explicitly selects the development environment.

## Browser-bound two-leg handoff

Unrelated domains cannot verify one another's host-only cookies. P13 therefore introduces a destination-prepared intent:

1. The destination BFF creates a 32-byte browser state and nonce and stores them in a secure, host-scoped session/cookie.
2. It creates a short-lived `ops.consumer_browser_handoff_intents` row. Only hashes are stored.
3. The browser carries an opaque intent code to the signed-in issuer.
4. The issuer BFF proves the canonical or verified legacy identity and converts that intent into an auth or Project-context handoff.
5. The browser carries only the new opaque handoff code to the destination.
6. The destination BFF reads state/nonce from its own host session and atomically consumes the handoff.
7. The handoff URL is immediately replaced in browser history. It is never persisted to local/session storage or analytics.

This design binds the transfer to a prepared destination browser session without attempting cross-domain cookies or placing state, nonce, user IDs, Project IDs, Saved IDs, JWTs, or refresh tokens in the URL.

## Database objects

P13 adds eight forced-RLS `ops` tables:

- `consumer_hub_registry`
- `consumer_security_controls`
- `consumer_rate_limit_events`
- `consumer_browser_handoff_intents`
- `consumer_auth_handoffs`
- `consumer_context_handoffs`
- `consumer_identity_link_attempts`
- `consumer_handoff_events`

Auth and context handoffs store SHA-256 hashes, issuer/audience/origin intent, normalized return path, state/nonce hashes, 90-second expiry, status, failed-attempt count, and consumption time. Context stores the internal Project ID only server-side and releases only Project name plus explicitly allowed location context.

Operational audit events store sanitized action/reason references. They contain no raw code, state, nonce, token, Project payload, or URL.

## Consumption behavior

Consumption locks the matching row with `FOR UPDATE`. Only an unexpired `issued` row with matching issuer, audience, target origin, browser state, and nonce can transition to `consumed`.

- Successful consumption is single-use.
- Replay returns `HANDOFF_ALREADY_USED`.
- Expiry transitions to `expired`.
- Mismatch does not consume the valid code. It increments the failed-attempt count and revokes after five mismatches.
- Unknown code returns a generic state failure.
- Rate-limit infrastructure unavailability denies handoff preparation/issue/consumption.

## Canonical and legacy identity

`ops.resolve_linked_consumer` accepts only an active P11 `consumer_identity_links` row. Pending link attempts, revoked links, unknown subjects, and same-email assumptions do not authorize a handoff.

Contractor `app_users` and every vertical Supabase UUID remain opaque legacy subjects. A verified Move link and verified Insurance link may both resolve to one canonical parent `auth.users.id`; no vertical row or UUID is merged.

`consumer_identity_link_attempts` records short-lived pending proof attempts. Completing a link is intentionally not a database-only action: a parent adapter must first validate the legacy session proof, then use the P11 linker with an evidence reference. Email equality is never proof.

## Project context

`consumer_context_handoffs` stores the Project relationship server-side. Its URL contains only an opaque code. Successful consumption returns a server-held context reference, Project display name, optional allowlisted location context, and normalized specialist return path.

The specialist BFF stores this narrow context in its secure host session. Clear context marks the parent context cleared and removes it from the specialist session. Private notes and unrelated Project data are never returned.

## `/v1/my` contract

The typed contract defines:

- `GET /v1/my/entities/:networkEntityId/state`
- `POST /v1/my/entities/state:batch`, limited to 50
- `POST /v1/my/saved`
- `DELETE /v1/my/saved/:savedId`
- `GET /v1/my/projects:summaries`
- Project-membership add/remove
- P12 Project creation delegation
- auth/context prepare, issue, and consume operations

Specialist browsers call their own BFF. The BFF supplies a hub-scoped service assertion and a short-lived canonical-user authorization assertion to the parent. The parent validates both, then invokes P12 operations with the canonical user context. A hub service never receives parent `service_role` credentials.

Entity-state reads return only canonical display reference, Save state, Save-time identity state, and that user's bounded Project memberships. They do not return notes, Alerts, other Saves, account settings, or Business Manager roles.

Unsave preserves the P12 membership conflict. Future Watch conflict behavior remains deferred.

## Service and authorization boundary

P13 defines parent-only `myth_handoff_broker` and `myth_consumer_api` roles plus one non-login identity per BFF. Hub roles can read only their own registry row and prove only their own hub/scope mapping. They have no consumer-table access.

All handoff tables are in `ops`, have forced RLS, and have no browser policies or grants. The parent state functions derive the consumer from `auth.uid()` and preserve P12 ownership checks. Private notes remain parent-only.

## CSRF, URL, logs, and headers

State-changing same-origin BFF requests require exact expected `Origin` plus a constant-time double-submit CSRF token comparison. `Referer` alone does not authorize a mutation.

Return paths reject schemes, protocol-relative values, backslashes, fragments, controls, encoded separators/colon, double encoding, and unregistered prefixes. Origins reject credentials, path/query/fragment suffixes, unknown domains, and production localhost.

Handoff responses require:

- `Cache-Control: no-store, max-age=0`
- `Referrer-Policy: no-referrer`
- `X-Content-Type-Options: nosniff`
- `X-Robots-Tag: noindex, nofollow, noarchive`

Logging utilities redact `code`, `state`, `nonce`, `handoff`, and `token`. Analytics must ignore handoff routes and query strings.

## Safe errors

The typed contract closes errors to:

`AUTH_REQUIRED`, `IDENTITY_LINK_REQUIRED`, `HANDOFF_EXPIRED`, `HANDOFF_ALREADY_USED`, `INVALID_AUDIENCE`, `INVALID_STATE`, `RETURN_NOT_ALLOWED`, `ENTITY_UNRESOLVED`, `ENTITY_REVIEW_REQUIRED`, `SAVE_CONFLICT`, `PROJECT_MEMBERSHIP_CONFLICT`, and `RATE_LIMITED`.

These errors do not disclose whether an unrelated user, Project, Save, or identity relationship exists.

## Validation

Local validation passed:

- P11, P12, and P13 static assertions;
- the executable P13 security contract, including CSRF, return-path, redaction, batch-bound, guest-continuation, and client-secret checks;
- existing Network/share assertions;
- TypeScript;
- changed-file ESLint;
- production build;
- `git diff --check`.

Database validation used exactly one non-production Supabase development branch named `p13-cross-hub-handoff-validation` at the approved $0.01344/hour rate. The sequence and results were:

1. Applied P11, P12, and P13 successfully.
2. P11 regression: 31/31 passed.
3. P12 regression: 56/56 passed.
4. P13 auth, identity, context, state, mutation, security, and round-trip matrix: 58/58 passed.
5. Rolled back P13 only. All P13 tables, roles, and functions were absent while P11 network/profile objects and P12 Saves, Projects, memberships, and notes remained present.
6. Reapplied P13 cleanly.
7. Reran P13: 58/58 passed.
8. Reran P11 and P12 regressions: no failures, including their final test cases.
9. Verified all eight P13 tables were present with RLS enabled and forced, all seven hub entries were enabled, browser and anonymous roles lacked `ops` schema access, and no Watch table existed.
10. Ran Security and Performance Advisors.
11. Deleted the development branch immediately after validation.
12. Verified only the permanent `main` branch remained and that the permanent project still had only its pre-existing `remote_schema` migration. P11, P12, P13, context handoffs, and Watches were all absent there.

Security Advisor returned no warning or error findings. Its seven informational findings report forced-RLS server-only `ops` tables with deliberately no direct-access policies; access is available only through narrow reviewed functions. Performance Advisor returned nine informational findings: unused indexes expected on a newly created branch with no workload history and the inherited Auth absolute-connection allocation setting. No advisor finding blocks P14.

## Deployment boundary

Nothing in P13 is deployed or applied to the permanent Consumer project. No specialist repository, vertical Auth row, legacy user, production cookie, or public route was changed.
