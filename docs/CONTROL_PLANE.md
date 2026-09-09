# Ask Trust Hub Network Control Plane

Status: ATH-ADMIN-001 contract freeze (2026-09-08). This document defines architecture, not a deployed admin replacement.

## Operating doctrine

Ask is the network control plane: future staff authorization, aggregate telemetry, cases, campaign attribution, Needs Attention, privileged command coordination, and audit history. Each specialist remains the system of record for its identity grains, regulatory evidence, adapters, normalization, publication rules, public routes, and specialist execution. Ask must coordinate by authenticated, versioned contracts; it must not copy Layer A data into a competing source of truth.

Layer A is regulator/public-source evidence and is immutable to business managers. Layer B is separately provenanced business-supplied content. A claim grants management authority for one exact specialist profile; it is not endorsement, verification, ranking, or paid placement. Consumer identity and persisted research are a privacy firewall: ordinary operations receive aggregates, and any future named-record support access must be purpose-limited, reason-coded, role-limited, audited, and preferably time-limited. Businesses never learn who saved or watched them.

## Domain model

- **Source adapter:** one ingestion/normalization pipeline.
- **Capability / publication measure:** one scoped, usable evidence capability.
- **Publication snapshot:** deterministic accepted/published state and version.
- **Watch dependency:** exact capability/grain relied on by a Watch.
- **Entity:** durable network identity; a **specialist profile** is an exact hub identity.
- **Organization:** business-side container; a **management grant** authorizes it for one exact profile.
- **Project / Save / Watch / Alert:** consumer container, persisted interest, monitoring intent, and material event under valid coverage.
- **Ops case:** work requiring resolution. **Admin command:** privileged, reason-coded action with audit and rollback context.
- **Campaign:** attribution object; never authority evidence.

Source adapters, capabilities, and snapshots are not interchangeable. Future health must trace adapter → capabilities → snapshots → routes → Watches → Alerts and claimability/watchability.

## Frozen V1 contracts

Canonical typed contracts live in `lib/control-plane/contracts/`:

- `product_event.v1`: privacy-safe behavioral/technical telemetry. Search outcomes are exactly `RESULTS`, `CLARIFICATION`, `FAIL_CLOSED_WITH_ACTION`, `FAIL_CLOSED_DEAD_END`, or `ERROR`. Raw questions, tokens, personal data, private notes/decisions, secrets, and unnecessary exact identifiers are prohibited.
- `ops_case.v1`: claim, correction, response, source/publication, identity, support, moderation, and security work with queue, severity, SLA field, evidence and audit references. Existing queues are not migrated.
- `admin_command.v1`: actor, authorization context, target, reason, before/intended state, result, rollback and audit reference. It defines future commands but executes none.
- `claim_policy.v1`: scoped by hub × profile class × jurisdiction × policy version. Unknown rules remain `NOT_YET_DEFINED`; a matching website/email domain alone is never globally sufficient authority.

## Frozen activation metrics

- **Activated Business:** approved management grant + Business Manager opened + at least one legitimate post-claim action (profile update, team invite, correction, response, or meaningful monitoring/insight use).
- **30-Day Active Business:** an Activated organization with a qualifying management/product action in the following 30-day window.
- **Activated Consumer:** authenticated identity + meaningful persisted research (Project containing Save/Watch/tool, or active Watch) + a return research session.

These are proposed V1 metrics, not retroactively applied production analytics.

## Future operational contracts

Needs Attention separates incidents from opportunities. Candidate P0: false-silence Watch risk, privilege/security incident, unauthorized grant, corrupted public evidence. P1: degraded source with active dependency, competing claim beyond SLA, serious Search regression, correction beyond a public commitment, snapshot mismatch, campaign complaint/bounce spike, alert-delivery cluster. P2: growing zero-result cluster, identity backlog, stale noncritical metadata, inactive claimed business. Opportunities (high-interest unclaimed, weak coverage/high demand, claimed inactive, weak traffic/strong data, low Layer B completeness) never enter incident severity queues.

Founder Home later exposes roughly 12–15 top-line measures: research sessions, Search success, Save→Watch, activated consumers, Alert→return; Claim CTA→start, completion, review SLA, activated and 30-day-active organizations; impacted degraded/unknown capabilities and open P0/P1 incidents. No dashboard is implemented here.

Health states are `CURRENT`, `DELAYED`, `DEGRADED`, `UNKNOWN`. A failed latest check can never support “nothing changed.” Future health records include adapter/capability/hub/jurisdiction, cadence, source-as-of/retrieved-at/accepted-at, row count/delta, schema drift, quarantine, failures and blast radius.

Identity review types: `POSSIBLE_DUPLICATE`, `IDENTIFIER_REUSED`, `REVIEW_REQUIRED_BINDING`, `PROFILE_REDIRECT`, `MERGE_CANDIDATE`, `SPLIT_CANDIDATE`, `HUB_PROFILE_ORPHAN`, `ORGANIZATION_PROFILE_RELATIONSHIP_REVIEW`. Merge/split preview must enumerate Saves, Watches, Alerts, Projects, grants and publication references. No fuzzy-name automatic merge.

Campaign acquisition values are organic, manual outreach, email campaign, and internal test, with optional `campaign_id`. Future funnel: sent → delivered → opened → clicked → claim started → completed → approved → activated → 30-day active, plus bounce, spam complaint, unsubscribe, suppression and do-not-contact. No outreach occurs in ATH-ADMIN-001.

## Dependency map

1. ATH-ADMIN-002: staff auth, RBAC, audit and kill-switch command foundation.
2. ATH-ADMIN-003: telemetry ingestion and Founder Control Center V1.
3. ATH-ADMIN-004: claim/KYB operations using `claim_policy.v1` and `ops_case.v1`.
4. ATH-ADMIN-005: business operations and campaign attribution.
5. ATH-ADMIN-006: evidence, Watch and source/publication health.
6. ATH-ADMIN-007: Search reliability, canaries and release gates.
7. ATH-ADMIN-008: identity operations and adapter-led legacy admin consolidation.

No later ticket is implemented by this freeze.
