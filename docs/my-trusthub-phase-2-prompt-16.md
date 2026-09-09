# My TrustHub Phase 2 Prompt 16 handoff

Date: September 8, 2026
Status: Complete and validated on a deleted ephemeral Supabase branch. Production remains unapplied.

## Scope

P16 adds the private consumer Alert layer above P14 Watches and P15 material change events. It creates one durable Alert per exact Watch/event pair, supplies health-qualified Watch checks, keeps meaningful Watch observation history, and exposes a narrow entity-scoped Alert summary to specialist BFFs.

P16 sends no email, executes no notification preferences, connects no live source, migrates no user, and adds no public Alert API.

## Tables

- `network.consumer_alert_templates`: versioned, parent-reviewed deterministic consumer copy selected through the P15 severity rule's safe template key.
- `network.consumer_source_presentations`: reviewed consumer display names and controlled confirmation references for public sources.
- `consumer.consumer_alerts`: one private Alert per `watch_id + change_event_id`, immutable event/source clocks, minimal Project context snapshot, and independent read state.
- `ops.consumer_alert_fanout_audit`: counts for event receipt, matching Watches, created Alerts, skipped duplicates, suppression, controlled release, and handled errors. It contains no raw source payloads or private notes.

All P16 tables enable and force RLS. Network presentation configuration is parent-governed. Alerts are selectable only by their canonical owner. The fanout audit is server-only.

## Alert eligibility and fanout

`consumer.fanout_change_event` is executable only by `myth_alert_fanout`. It serializes fanout per change event, accepts only `active / pending` P15 events, and matches only:

- an active Watch owned by a canonical consumer;
- an active Saved entity;
- enabled coverage for the exact capability row and version;
- the event's canonical network entity;
- an event observed on or after both the Watch resume boundary and the coverage enable boundary.

The function inserts with `ON CONFLICT (watch_id, change_event_id) DO NOTHING`. The database uniqueness constraint remains the final concurrency guard. It marks the event fanout complete even when no eligible Watch exists so Watches created later cannot receive historical events.

The Alert copies P15 severity without recalculation. Approved templates create deterministic `what changed` text; no freeform or AI-generated interpretation participates. Template version is frozen on the Alert. P0/P1/P2 continues to describe the event only.

## Consumer read model

The bounded Alert list supports severity and unread filters plus cursor-style `before` pagination with a maximum of 100 rows. The detail operation returns only consumer-safe fields:

- severity and event correction state;
- hub, canonical display name, and allowed source identifier;
- reviewed change headline/body;
- official-as-of, source-check, observation, and surfaced times as distinct clocks;
- reviewed source name and confirmation reference;
- minimal Project context;
- exact coverage, capability version, and watched grain;
- why-received language and the required verdict disclosure.

Raw normalized values, prior/new source payloads, checkpoints, and private notes are absent from this contract.

## Project context

One Alert is created even when the Saved entity belongs to several Projects. Fanout snapshots only Project reference, display name, status, and capture time. The read layer supplements that snapshot with each Project's current status so a later completion/archive remains understandable without rewriting the historical context. Membership removal, Project archive, Watch stop, and Saved soft removal do not delete Alert history.

## Read and unread

New Alerts begin unread. Owner-authorized operations support mark read, mark unread, and mark all read with row-version protection for individual changes. Attention state never mutates or deletes the source event or Alert history.

`all_read` is true only when at least one Alert exists and none is unread. A zero-Alert workspace remains the distinct `No alerts` state. “You're caught up” means only that no surfaced Alert is unread.

## Watch checks and no-change truth

The per-grain Watch-check operation reuses P15's `coverage_no_change_eligible`; P16 does not re-create or weaken that rule. `no_change` is returned only when the exact active coverage has a current, complete, schema-compatible source checkpoint, a valid accepted baseline, a latest accepted no-change observation from that checkpoint, and no active pending material event.

Possible coverage states are:

- `no_change`
- `material_change`
- `delayed`
- `degraded`
- `unknown`
- `baseline_only`

Delayed, degraded, and unknown health take precedence over reassuring language. Active material events are bounded by both the current Watch resume boundary and the coverage enable boundary. Corrected/retracted Alerts remain history but do not count as an active material Alert.

Whole-Watch health is the worst enabled coverage grain using P15's order `current < delayed < degraded < unknown`. A healthy grain cannot hide an unhealthy one. The summary exposes health separately even when an active Alert makes the attention state `needs_attention`.

The Alerts overview returns Alert counts and a separate `has_monitoring_health_issue` fact. Therefore an empty Alert list never serves as evidence that monitoring is current.

## Observation and Watch history

Consumer history is derived from durable Watch lifecycle events, qualified no-change checks, surfaced Alerts, and source corrections. It includes Watch start/pause/resume/stop, coverage add/remove/retirement, qualified source checks, material Alerts, and correction notices. It omits candidates, raw ingests, retries, and internal checkpoint noise.

Retraction changes the joined event state and adds a correction notice while retaining the original Alert. A retracted event never creates a new Alert. A future corrective transition remains a separate reviewed P15 event.

## Mass-change release

Suppressed or quarantined events cannot fan out. `network.approve_change_event_for_fanout` requires the parent monitoring-operator role, a released P15 checkpoint guard, and an explicit reason. Release is per event, retains original source provenance, records release in the fanout audit, and uses the later Alert `surfaced_at` as the delivery-facing release time. Clearing a source-wide guard alone does not bulk-send Alerts.

## Cross-hub contract

P13's `/v1/my` contract now includes the `alert:read` scope and the entity-scoped endpoint `/v1/my/entities/:networkEntityId/alerts:state`. It returns only a bounded count, unread presence, and the latest severity, event state, reviewed headline, opaque Alert reference, and observed time for an entity already Saved by the canonical user.

Specialist BFFs cannot enumerate the account Alert table, Projects, notes, or unrelated entities. Same-origin BFF and canonical-user authorization requirements from P13 remain unchanged.

## Service authorization

- `myth_alert_fanout`: may execute the single fanout operation; it cannot mutate Projects, Saved research, notes, identity, capability governance, or delivery state.
- `myth_monitoring_operator`: may deliberately release an eligible suppressed/quarantined event for fanout; it cannot create Alerts directly.
- `myth_notification_worker`: remains unprivileged in P16.
- authenticated browser roles: may select only their own Alert rows and use owner-checking read/read-state functions; they cannot read raw P15 observations/events/checkpoints.

## Validation results

`supabase/tests/p16_consumer_alerts.sql` contains the required 66 cases plus case 67 for the explicit empty-inbox/unhealthy-monitoring invariant. It covers fanout, pause boundaries, exact versions, read state, safe detail, health-qualified checks, history, retractions, mass-change release, RLS, cross-hub state, and Project/Watch/Saved lifecycle retention.

Local static validation checks all 67 cases, P16 schema/rollback containment, exact Watch and coverage boundaries, P15 no-change reuse, required types, narrow cross-hub scope, and absence of notification delivery.

Validation ran on the single approved ephemeral branch `p16-consumer-alerts-validation` (branch project `splbvafetckgxaanbywy`). The branch was deleted immediately afterward; the final branch listing contained only the permanent `main` branch.

- P11 identity/RLS regression: **31/31 passed**.
- P12 Saved/Project/guest regression: **56/56 passed**.
- P13 handoff/API/security regression: **58/58 passed**.
- P14 capability/Watch regression: **62/62 passed**.
- P15 observation/health/change regression: **64/64 passed**.
- P16 Alert/Watch-check/history matrix: **67/67 passed**.
- P16-only rollback removed its Alerts, presentation tables, fanout audit, functions, grants, and `alert:read` scope while P11-P15 objects remained.
- P11-P15 all passed again in the rolled-back state.
- P16 reapplied cleanly, its validation presentation seed reapplied, and all P11-P16 suites passed together again.

The first P16 execution identified a validation-fixture clock-order problem: the checkpoint intended to prove healthy no-change was older than another capability-wide checkpoint. The fixture now makes that run unambiguously latest. No production logic was weakened. Review also tightened event eligibility to both the Watch resume and coverage enable boundaries and stopped retracted Alerts from counting as active material attention.

Local verification passed the complete static test chain, TypeScript, changed-file ESLint, production build, and `git diff --check`. The build retains two pre-existing unrelated unused-variable warnings in `components/trust-standards-section.tsx` and `lib/orchestration/journey-metadata.ts`.

## Advisor results

The first Performance Advisor run found one P16 issue: the composite Alert-template foreign key lacked a covering index. `consumer_alerts_template_idx` now covers `(template_key, template_version)`; after remediation the advisor no longer reports an unindexed foreign key.

Security Advisor reports only informational `rls_enabled_no_policy` notices on deliberately server-only, forced-RLS P13/P15/P16 tables. Browser roles have no table grants and access is confined to checked `SECURITY DEFINER` operations. [Supabase linter guidance](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)

Performance Advisor reports only unused-index informational notices expected on a newly created validation database and the project-level Auth fixed-connection setting. No schema warning or error remains. The connection-allocation setting should be reviewed before production compute scaling. [Supabase production guidance](https://supabase.com/docs/guides/deployment/going-into-prod)

## Rollback boundary

The P16 rollback removes only P16 functions, grants, `alert:read` registry scope, Alerts, fanout audit, and presentation configuration. It leaves every P11-P15 identity, research, handoff, Watch, observation, checkpoint, and material-event object intact.

## Remaining risks

- Live source confirmation destinations remain controlled references until the later adapter rollout verifies production URLs and redirect policy.
- Delivery preferences, channel attempts, retries, digests, and P0 email belong to P17 and have no P16 grants or columns.
- Event/template governance needs an operator runbook before permanent application.
- Retention after Saved removal must align with the later export/deletion policy; the current contract retains Alert history until consumer workspace deletion.

Nothing in P11-P16 has been applied to the permanent Consumer project. Its migration list still contains only the pre-existing `remote_schema` entry, and direct checks confirm all six foundations are absent.
