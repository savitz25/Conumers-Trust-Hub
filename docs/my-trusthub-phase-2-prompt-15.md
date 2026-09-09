# My TrustHub Phase 2 Prompt 15 handoff

Date: September 8, 2026
Status: Complete and validated on a deleted ephemeral Supabase branch. Production remains unapplied.

## Scope

P15 adds the server-only observation and change-detection layer beneath P14 Watch subscriptions. It stores a minimal normalized observation envelope, preserves six source clocks, evaluates feed health, quarantines unreliable input, creates one deterministic material event from a reviewed classifier, and exposes exact-version active-Watch matches for future P16 fanout.

P15 creates no consumer Alerts, Watch-check UI, delivery behavior, source polling, or live regulator connection.

## Tables

- `network.watch_capability_observation_contracts`: immutable normalized schema/material-field contract, classifier version, freshness grace, completeness ratio, anomaly threshold, and operational kill switch per capability version.
- `network.alert_severity_rules`: parent-approved deterministic event rules and safe template keys. Severity belongs to the event.
- `ops.source_feed_checkpoints`: idempotent source-run facts, record counts, completeness, schema, clocks, and health.
- `network.source_observations`: minimal normalized value/material envelope with original and canonical entity references, exact capability version, source provenance, fingerprints, status, and all source clocks.
- `network.network_change_events`: idempotent material transitions with both observations, source run, classifier rule/version, severity, and lifecycle status.
- `ops.source_monitoring_events`: compact operational audit for checkpoints, quarantine, acceptance, events, kill switches, release, and retraction.

All six are server-only, RLS-enabled, and forced-RLS tables. Browser roles have no direct grants.

## Clock semantics and ordering

The observation envelope independently retains:

- `source_as_of`: the source's effective/as-of time;
- `published_at`: source publication time when separately known;
- `retrieved_at`: when the specialist pipeline retrieved the source;
- `observed_at`: when the monitoring control plane accepted/evaluated the observation;
- `snapshot_as_of`: the source dataset/snapshot reference time;
- `generated_at`: when a source artifact was generated.

Missing clocks remain null. Deterministic effective ordering uses the first available clock in this order: `source_as_of`, `published_at`, `snapshot_as_of`, `retrieved_at`. The derived ordering key never overwrites the individual clocks.

An older effective observation that arrives later is preserved as `superseded / late_historical` and cannot reverse the current state. Different material values at the same effective time quarantine the new candidate, degrade the source/capability, and create no event until a parent operator resolves the conflict.

## Source health

Canonical ordering is `current < delayed < degraded < unknown`; `unknown` is worst because no reliable determination is possible. Whole-Watch health is the worst enabled coverage grain.

- `current`: the expected run succeeded within capability freshness plus grace, completeness is complete, schema is compatible, and no anomaly guard is active.
- `delayed`: the latest successful complete run exceeded its freshness window.
- `degraded`: a run occurred but completeness, schema, conflict, classifier, or quality facts are unreliable.
- `unknown`: no reliable successful health determination exists.

Completeness states are `complete`, `partial`, `failed`, and `unknown`. Schema states are `compatible`, `changed`, `invalid`, and `unknown`. Partial/failed/unknown completeness and non-compatible schema can never authorize no-change reassurance.

Specialist/source pipelines own acquisition and raw freshness facts. The parent control plane owns freshness thresholds, approved normalized contracts/classifiers, Watch-grade eligibility, and consumer-facing health truth.

## Observation acceptance and change detection

Each hub has a distinct non-login ingestion role. It may start/complete checkpoints and submit candidates only for its hub. It cannot accept observations, mutate Watches, read consumer research, approve capabilities, or create Alerts.

The parent change detector validates the binding, canonical entity, exact capability/version/source/grain, checkpoint, schema version, material fields, allowed values, provenance, clocks, and capability operational state. Only `candidate` rows may become `accepted`.

Material fingerprints include only the capability-approved fields, so retrieval metadata changes do not create material events. The first accepted observation is a baseline. An identical material value records `no_change` and creates no event. A changed material value creates an event only when an approved deterministic classifier rule matches.

The event fingerprint is protected by a unique constraint, while an entity/capability advisory transaction lock serializes competing detector workers. Identical submissions, repeated transitions, and concurrent acceptance therefore remain retry-safe.

## Quarantine and anomaly protection

Candidates are quarantined or rejected for schema drift, missing material fields, invalid allowed values, fingerprint mismatch, missing provenance, impossible source clocks, unresolved identity, capability disablement, or unhealthy source state. Quarantine updates source health and writes an operational audit record.

Every capability contract has a per-run mass-change threshold and completeness ratio. Exceeding the mass threshold marks the run degraded, suppresses earlier pending events from that run, quarantines the threshold-crossing event, and activates the capability kill switch. A record-count collapse degrades the checkpoint and capability before observations can support monitoring claims.

The parent monitoring operator alone can release quarantine, change operational capability state, or retract a sourced event. Release requires an otherwise successful, complete, compatible checkpoint. It does not silently reaccept quarantined observations. Source corrections preserve history: an existing event becomes `retracted` with provenance/reason, and any corrective material transition is a separate reviewed event.

## False-silence protection

`coverage_no_change_eligible` is true only when all conditions hold:

1. Watch and exact coverage version are active/enabled.
2. Capability governance and operational state allow monitoring.
3. Latest checkpoint is current, complete, schema-compatible, and not under anomaly guard.
4. A valid accepted baseline exists for the canonical entity and exact capability version.
5. The latest accepted observation belongs to that valid checkpoint and evaluated as `no_change`.
6. No active pending material event exists for that entity/capability version.

Source failure, silence, stale data, baseline-only state, quarantine, or an unsurfaced material event always returns false.

## Watch matching

The server-only match operation returns only active Watches with enabled coverage for the event's exact capability row and version. It resolves Saved entity redirects canonically and returns one Watch even if its Saved entity belongs to several Projects. Paused and stopped Watches are excluded. An event must be observed on or after `resume_boundary_at`, preserving P14's no-retroactive-fanout pause policy.

P15 grants no privilege to the reserved Alert fanout or notification roles. P16 will add a narrow consumer-alert fanout contract over active pending events.

## Validation fixtures

`lib/my-trusthub/monitoring.fixture.json` and `supabase/seeds/p15_monitoring_validation.sql` are explicitly validation-only. They define normalized contracts and deterministic example envelopes for all eight accepted Phase 1 grains across Contractor, Move, Lender, Insurance, Senior, and Investor. They claim no live source connection and contain only fictional fixture entities.

The severity seed includes reviewed P0, P1, and P2 examples. The P0 example is a fictional `Active -> Suspended` license transition. P1 covers a fictional ownership-record transition. P2 covers neutral/public status or administrative material changes. No fixture classifies an entity.

## Architecture decisions closed

1. **Health order:** `current < delayed < degraded < unknown`; unknown is worst.
2. **Same-time conflict:** quarantine the later conflicting candidate, degrade health, retain the earlier accepted state, and require operator review.
3. **Corrections:** preserve prior history using explicit retraction; create a separate reviewed corrective event when material state changes.
4. **Kill switch:** non-current operational state blocks acceptance/no-change truth and suppresses pending events; consumer coverage remains historically visible.
5. **Freshness ownership:** source pipelines provide facts; parent monitoring owns thresholds and consumer-monitoring eligibility.
6. **Quarantine release:** parent monitoring operator only; release never silently replays candidates.

## Local validation

- Existing Network/share assertions: passed.
- P11-P14 static and executable checks: passed.
- P15 static contract: passed.
- TypeScript: passed.
- Changed-file ESLint: passed.
- Production build: passed (two pre-existing unrelated lint warnings remain).
- `git diff --check`: passed.

## Isolated database validation

Validation ran on the single approved ephemeral branch `p15-source-observation-validation` (branch project `bsrljispkylmelfnhovp`). The branch was deleted immediately after validation; a final branch listing showed only the permanent `main` branch.

- P11 authorization/entity/identity-link suite: **31/31 passed**.
- P12 Saved/Project/guest-import suite: **56/56 passed**.
- P13 handoff/API/security suite: **58/58 passed**.
- P14 capability/Watch suite: **62/62 passed**.
- P15 observation/health/change suite: **64/64 passed**.
- P15-only rollback removed the six P15 tables, P15 functions, and P15 roles while P11-P14 objects remained present.
- All four earlier SQL suites passed again in the rolled-back P11-P14 state.
- The corrected P15 migration reapplied cleanly, its validation seed applied, and all five suites passed together again.
- The permanent Consumer project retained only its pre-existing `remote_schema` migration; direct checks confirmed P11-P15 tables are absent.

Validation found and corrected two defects before completion: the same-effective-time conflict path now exits immediately after quarantine, and the rollback drops trigger-owning tables before their trigger functions. The P14 regression also now verifies that starting a Watch creates zero observation rows when the later P15 table exists, instead of assuming that table is absent.

Security Advisor reported only `INFO` notices for RLS-enabled tables with no policies. This is intentional for server-only P13/P15 tables: browser roles have no grants and all six P15 tables use forced RLS. Performance Advisor reported only `INFO` unused-index notices expected on a new validation database, plus the project-level Auth connection notice. No P15 warning or error required remediation.

## Rollback and deployment boundary

The P15 rollback removes only P15 functions, roles, contracts, observations, checkpoints, events, and monitoring audit tables. It does not drop P11 identity, P12 consumer state, P13 handoffs, or P14 capabilities/Watches/coverage.

Nothing has been deployed or applied to the permanent Consumer project. No source is connected, no Alert can be created, and no legacy user was migrated.
