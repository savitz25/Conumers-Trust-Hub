# ATH-CUST-011B customer experience contract

## Scope

This release presents the accepted Ask customer plane as one customer product. It does not replace authentication, claims, organizations, exact-profile grants, Layer C business data, corrections, business responses, monitoring, teams, or audit history.

## Claim experience

The customer-facing sequence is Your account, Business, Your role, Verification, Review, and Access. Existing database statuses map to presentation states; no new claim enum or persistence model is introduced. Magic-link authentication retains the exact claim/status return path.

Every terminal or waiting state explains what happened and provides at least two actions. Manual reviews are described as usually completed within 1–2 business days, not as a guaranteed SLA. Approval means control of business-supplied information was verified; it is not an endorsement and has no effect on ranking, evidence, publication, or search ordering.

## Dashboard and workspace

`/manage` is hub-neutral and may display exact Contractor, Move, and Lender grants together without merging identities. Each workspace separates information supplied by the business from read-only official evidence and exposes corrections, business response, monitoring, activity, and team access as customer concepts.

Contractor monitoring remains supported. Move and Lender monitoring remain unavailable and provide useful navigation instead of a dead end.

## Support

The Ask-owned support screen carries only safe public context: hub, profile ID, public identifier, category, and the customer's message. It warns against sharing claim links, tokens, documents, passwords, or private evidence. The current transport is a customer-reviewed email handoff; no support queue or new database table is introduced.

## Preview fixtures

`/internal/customer-experience-fixtures` is a synthetic, no-PII acceptance navigator and returns 404 when `VERCEL_ENV=production`. It creates no claims, grants, customer profiles, or evidence rows.

## Data and security

There is no schema migration in this release. Existing forced RLS, server-side authorization, HMAC handoffs, replay protection, exact profile grants, append-only audit, and rate controls remain authoritative. Specialist evidence databases are read-only and receive no writes.

## Rollback

Revert the ATH-CUST-011B application commit and redeploy the previous exact production SHA. No database rollback is required.
