# My TrustHub Phase 2 Prompt 11B handoff

**Date:** September 7, 2026

**Production deployment:** Not authorized; not performed

**Permanent Consumer project:** P11B application migration not applied

## A. STATUS

**Complete.** The original Prompt 11 identity decision is closed. P11B was implemented and tested on one ephemeral Supabase branch, then the branch was deleted. No legacy users were migrated and P12 was not started.

## B. AUTH / CONTROL-PLANE AUDIT

- Intended control plane: `Conumers-Trust-Hub` (`qvvxvbcdmbjzrgvwjatw`).
- Health: `ACTIVE_HEALTHY`.
- Region/database: `us-east-1`, Postgres 17.6, GA channel.
- Canonical subject: this project's future `auth.users.id`.
- Permanent state after P11B: no application tables and no P11 application migration.
- Security Advisor: no findings.
- Performance Advisor: existing informational Auth fixed-connection allocation of 10 connections.
- The project exposes an active publishable key. No secret/service-role key was printed, persisted, or added to source.
- Move, Lender, Insurance, Contractor, Senior, and Investor subjects remain non-canonical legacy identities.
- Business Manager authorization remains in its existing independent vertical stores.
- Prior same-email/different-UUID evidence remains the reason email cannot identify or merge accounts.
- Current tools cannot read Site URL/redirect allowlists, enabled providers, SMTP, OTP/session policy, network restrictions, SSL policy, backup-run history, PITR enablement, or restore-drill status. These remain pre-production gates.
- The organization is Pro; Supabase documentation describes daily backups on paid plans, but this is not proof of a successful project-specific backup or restore.

## C. CONTROL-PLANE DECISION

Prompt 10's original shared-vertical-tenant assumption remains rejected. The founder-approved dedicated parent project is accepted as the My TrustHub control plane. Parent `auth.users.id` is canonical. Vertical IDs are stored only as evidence-backed legacy links. Email-only linking and UUID copying are prohibited.

## D. SCHEMAS / TABLES CREATED

The repository migration creates these objects when later approved:

- `network.network_entities`
- `network.network_entity_bindings`
- `network.network_entity_redirects`
- `network.identity_governance_events`
- `consumer.consumer_profiles`
- `ops.consumer_identity_links`
- `ops.consumer_identity_link_events`

It also creates guarded resolution/governance/link functions, update/audit triggers, indexes, constraints, RLS policies, explicit grants, and least-privilege `myth_*` roles. It creates no Saves, Projects, Watches, Alerts, sessions, decisions, observations, notification jobs, exports, or deletion jobs.

## E. NETWORK ENTITY MODEL

- The registry is a thin UUID identity layer with entity type, canonical display name, primary hub, optional jurisdiction/profile reference, governance status, and timestamps.
- Hub bindings preserve specialist type/ID, namespaced source identifier, jurisdiction, validity interval, provenance, confidence, and accepted/review/superseded/invalid state.
- Accepted source-identifier validity ranges cannot overlap for the same hub, namespace, jurisdiction, and normalized identifier.
- Non-overlapping ranges support legitimate identifier reuse without moving the old entity.
- A current accepted specialist ID cannot bind to multiple entities.
- `review_required` and `invalid` bindings resolve with their real state but return `watch_identity_eligible = false`.
- Redirect creation resolves the terminal target, rejects self-links/cycles, caps traversal depth, marks the source merged, and writes governance audit events.
- Parent/Ask owns acceptance and redirects. Hub services can propose only `review_required` bindings for their own hub.

## F. CONSUMER ROOT MODEL

`consumer.consumer_profiles` contains only canonical `user_id`, optional validated ZIP, research-memory flag, and timestamps. It references parent `auth.users` and cascades only with deletion of that canonical auth subject. It contains no business role or public-profile data.

## G. RLS / AUTHORIZATION

- RLS is enabled and forced on all seven P11 tables.
- `authenticated` can select, insert, and update only its own consumer profile.
- Column grants allow profile creation and changes only to `preferred_zip` and `research_memory_enabled`; browser delete is unavailable.
- `anon` has no consumer schema access.
- Browser roles have no `network` or `ops` schema access.
- Business-role metadata does not widen consumer RLS.
- Hub proposal roles can read registry identities and propose `review_required` bindings only for their hub.
- Only the parent governor can accept/update entities and bindings or create redirects.
- Only the identity linker can call the canonical-to-legacy link function or read link audit data.
- Default privileges revoke future browser access in all three schemas.

## H. SERVICE IDENTITIES

P11B defines `NOLOGIN`, `NOINHERIT`, non-superuser, non-`BYPASSRLS` roles for:

- six hub-scoped identity proposers;
- parent identity governor;
- parent identity linker;
- future source ingestion, change detection, Alert fanout, notification delivery, export, and deletion responsibilities.

The future roles have no data privileges in P11B. They reserve independent authorization boundaries and prevent a universal job credential from becoming the application contract. Supabase's broad service role may be used only as a contained server bootstrap if no narrower credential is available; it is never a browser credential.

## I. CROSS-DOMAIN AUTH FINDINGS

The existing Lender/Insurance one-time handoff pattern has hashed codes, short TTL, target binding, and atomic consumption, but assumes a shared Auth subject and lacks the final P13 parent-link/state/nonce contract. P11B did not modify it. Cross-domain cookies remain unsupported as an identity strategy. P13 must exchange a short-lived opaque code for the canonical parent subject and separately verify any legacy link evidence.

## J. TEST MATRIX

All authorization assertions passed on the initial migration and again after rollback/reapplication:

1. Consumer A reads own profile — allow.
2. Consumer A updates own research-memory flag — allow.
3. Consumer A reads Consumer B — deny.
4. Consumer A updates Consumer B — deny.
5. Anonymous reads profile — deny.
6. Anonymous writes profile — deny.
7. Business-only user reads unrelated profile — deny.
8. Dual-role user reads own profile — allow.
9. Dual-role user reads another profile — deny.
10. Browser inserts accepted binding — deny.
11. Browser creates redirect — deny.
12. Hub-scoped identity service proposes review-required binding — allow.
13. Hub proposer self-accepts binding — deny.
14. Specialist service enumerates profiles — deny.
15. Consumer has network mutation privileges — deny.

Client/service-role secret scan passed.

## K. ENTITY RESOLUTION TESTS

All 10 passed twice:

- accepted binding resolves and is Watch-eligible;
- review-required remains distinguishable and ineligible;
- invalid never resolves as accepted;
- exact duplicate accepted binding is rejected;
- non-overlapping identifier reuse is allowed;
- overlapping accepted validity is rejected;
- two-hop redirect resolves deterministically;
- redirect loop is rejected;
- cross-hub bindings converge through one canonical entity;
- entity/binding/redirect governance actions are audited.

## L. IDENTITY-LINK TESTS

All six passed twice:

- verified vertical subject links to a canonical parent subject;
- one canonical subject can link multiple vertical subjects;
- one legacy subject cannot link to two canonical subjects;
- email-only linking is rejected;
- successful links write audit events;
- browser consumers cannot enumerate identity links.

Allowed evidence methods are signed handoff, reauthenticated legacy session, reviewed migration batch, and administrative review. No real user or legacy subject was linked.

## M. MIGRATIONS

- Forward: `supabase/migrations/20260907160000_my_trusthub_identity_foundation.sql`.
- Down/compensating rollback: `supabase/rollback/20260907160000_my_trusthub_identity_foundation.down.sql`.
- Matrix: `supabase/tests/p11_identity_foundation.sql`.
- Static contract: `scripts/assert-p11-foundation.mjs`.
- Test target: ephemeral branch `p11b-identity-foundation-validation` only.
- Initial forward: passed.
- Rollback: passed; all P11 schemas, objects, and roles removed.
- Clean reapplication: passed.
- Complete SQL matrix after clean reapplication: 31/31 passed.
- Final branch row counts: zero for profiles, entities, bindings, and links.
- Branch deletion: passed.
- Permanent project: no P11 tables and no P11 migration.
- Supabase Branching initialized a `remote_schema` baseline migration on main when branching was first enabled. This is platform branching metadata; no P11 application DDL was applied to main.

## N. FILES CHANGED

- `package.json`
- `package-lock.json`
- `scripts/assert-p11-foundation.mjs`
- `supabase/config.toml`
- `supabase/migrations/20260907160000_my_trusthub_identity_foundation.sql`
- `supabase/rollback/20260907160000_my_trusthub_identity_foundation.down.sql`
- `supabase/tests/p11_identity_foundation.sql`
- `docs/my-trusthub-control-plane.md`
- `docs/my-trusthub-production-architecture.md`
- `docs/my-trusthub-phase-2-prompt-11b.md`

The existing uncommitted Phase 1 Consumer Lab work was preserved.

## O. RISKS / BLOCKERS

No new P0 blocker was found.

- P1: dashboard/management verification is still required for Auth redirects/providers, SMTP, OTP/session policy, SSL/network restrictions, backups, PITR, and restore drills before production application.
- P1: P13 must replace the shared-UUID handoff assumption with canonical parent linking and state/nonce protections.
- P1: network binding acceptance needs an operational parent review/SLA.
- P1: legacy Business Manager links must be migrated independently of consumer links.
- P2: Auth's fixed 10-connection allocation should be changed to percentage-based allocation when compute/traffic requires it. See [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod).

## P. OPEN DECISIONS CLOSED

- Control plane: dedicated `Conumers-Trust-Hub` parent project.
- Canonical consumer subject: parent `auth.users.id`.
- Legacy identity relationship: explicit evidence-backed mapping, never email-only and never UUID reuse.
- Network identity governance: Parent/Ask owns canonical acceptance and redirects; specialist hubs propose.

## Q. DEFERRED ITEMS

- Permanent migration application and production deployment.
- Real consumer account creation and legacy-user linking.
- Auth redirect/provider/SMTP/session hardening.
- Backup/PITR/RPO/RTO decisions and restore drill.
- Saved entities, Projects, memberships, guest import, and notes.
- Full cross-domain BFF and handoff implementation.
- Watch capabilities/subscriptions, observations, Alerts, notifications, sessions, decisions, snapshots, export, and delete workflows.

## R. PRODUCTION READINESS FOR P12

1. **Control plane safe enough for Saved entities and Projects?** Yes at the reviewed schema/RLS contract level.
2. **One auth subject supports Consumer and Business Manager separately?** Yes; ownership RLS passed for consumer-only, business-only, and dual-role cases.
3. **Registry safe enough for Saved references?** Yes; identity, reuse, duplicate, redirect, and governance constraints passed twice.
4. **Review-required bindings excluded from trusted Watch identity?** Yes; resolution returns ineligible and proposal roles cannot self-accept.
5. **Reason not to proceed to P12?** No P11 foundation blocker remains. This handoff does not authorize P12 or production application.

## S. NEXT PROMPT

P12 should implement Saved entities, Projects, many-to-many membership, private notes, and explicit versioned guest-import preview/commit against the canonical parent subject and accepted network entity IDs. It must exclude Watches, Alerts, live cross-hub rollout, legacy-user migration, and production deployment.
