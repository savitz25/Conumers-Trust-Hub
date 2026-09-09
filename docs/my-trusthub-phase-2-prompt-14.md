# My TrustHub Phase 2 Prompt 14 handoff

Date: September 8, 2026
Status: Complete. Local implementation and isolated Supabase validation passed. The ephemeral branch was deleted, and production remains unapplied.

## Scope

P14 implements the durable distinction between Saved and Watched. It adds a parent-governed, versioned capability registry; one Watch per Saved entity; explicit immutable-version coverage rows; lifecycle and coverage audit events; pause/resume/stop/restart operations; limited-coverage reads; and the narrow cross-hub Watch state contract.

P14 adds no polling, source observations, change detection, Alerts, Watch-check reassurance, notification delivery, saved sessions, decisions, snapshots, export/delete jobs, user migration, or deployment.

## Capability registry and governance

`network.watch_capabilities` declares exactly one hub, entity type, jurisdiction, identifier namespace, source, and observable grain per version. Its governance states are `draft`, `review_required`, `approved`, `disabled`, and `retired`. New subscription eligibility requires all of:

- an approved, enabled, Watch-eligible capability;
- an active effective period;
- a source connection state other than `not_connected`;
- a matching entity type and jurisdiction;
- a currently accepted binding for the relevant hub and identifier namespace;
- an active terminal canonical entity.

Specialist roles may propose only for their own hub. They cannot approve or enable. The parent `myth_capability_governor` owns approval, disablement, and retirement. Browser roles cannot read or mutate registry tables directly; the consumer receives only the narrow capability operation.

Approved capability semantics are immutable. Changes to the key, version, hub, entity type, jurisdiction, identifier namespace, source, grain, or consumer-facing meaning require a new version. Operational metadata and governance state can change under parent control.

`network.watch_capability_events` records proposals and governed state changes without creating a consumer feed.

## Validation-only capability configuration

The eight Phase 1 grains are represented in `lib/my-trusthub/watch-capabilities.fixture.json` and `supabase/seeds/p14_watch_capabilities_validation.sql`:

- Contractor: Florida DBPR license status, DBPR disciplinary records, and Sunbiz entity status;
- Move: FMCSA operating authority status;
- Lender: NMLS public status where supported;
- Insurance: Florida DFS agency license status;
- Senior: CMS ownership;
- Investor: material Form ADV change.

The fixture and SQL seed are explicitly `validation_only`; neither claims a live source connection, and the seed is not part of the production migration.

## Watch and coverage lifecycle

`consumer.consumer_watches` has one durable row per Saved entity. Because every Saved row already has one canonical owner, `unique(saved_entity_id)` is the strongest one-Watch constraint. Project IDs do not appear on the Watch.

Watch statuses are `active`, `paused`, and `stopped`. Stopping retains the Watch, Save, Project memberships, coverage definition, and audit history. Restart reuses the durable Watch but requires a new explicit selection of currently eligible capabilities.

`consumer.consumer_watch_coverage` preserves the exact selected capability row and version. Coverage states are:

- `enabled` — explicitly selected and currently offered;
- `paused_by_capability` — the parent capability is temporarily unavailable;
- `disabled` — the consumer explicitly removed it or omitted it during restart;
- `retired` — that capability version was retired.

Adding a new registry grain or publishing a new version never adds or upgrades coverage. Capability withdrawal changes the coverage row to an honest unavailable/retired state without deleting history. Reapproval does not silently restore it.

An active or paused Watch cannot have its last enabled grain removed through the consumer operation. The consumer must select another eligible grain or stop the Watch. A parent capability retirement may leave a lifecycle-active Watch with no effective grains; the read model exposes the unavailable coverage rather than pretending monitoring continues. P16 source health can add operational degraded state without rewriting this subscription history.

## Pause catch-up decision

The Prompt 10 decision is closed for V1: **no retroactive Alert fanout for the interval in which a consumer intentionally paused a Watch**.

Resume records `resume_boundary_at`, keeps `resume_policy = next_accepted_observation`, and starts future processing at the next accepted observation boundary. The private lifecycle event records `catch_up: none`. A later UI may disclose the paused interval, but P14 creates no observations or Alerts.

## Saved and Project independence

Starting a Watch requires an active Saved row and explicit capability IDs. It creates no Project membership. A Saved row can remain in multiple Projects while retaining exactly one Watch. Archiving or removing Project memberships does not mutate the Watch. Removing the final membership makes the Saved record Unfiled and leaves the Watch unchanged.

P14 replaces the P12 unsave operation with one additional conflict: active and paused Watches block removal. A stopped Watch permits removal if no active Project membership remains. `stop_watch_and_remove_saved_entity` is an explicit atomic combined operation; membership conflict rolls the stop back as well.

## Limited coverage and read models

Coverage limitations are consumer-safe registry metadata attached to the exact grain. For example, CMS ownership can state that state enforcement, local inspections, and other licensing activity are outside that Watch without implying a provider problem.

The narrow reads are:

- available capabilities for one owned Saved row, including safe ineligibility reason;
- one Watch summary with lifecycle state, enabled/historical counts, limited-coverage flag, and resume policy;
- exact coverage rows, versions, sources, status, and limitations;
- composed cross-hub entity Watch state with Save, Watch, enabled/available counts, and coverage summary.

P14 deliberately returns `source_check_status = not_available` and the message “Monitoring source connection not yet active in this environment.” It does not fabricate `Last checked` or “No material change detected.”

## Source and freshness ownership

The remaining Prompt 10 governance decision is closed:

- each specialist/source pipeline owns acquisition, retrieval outcomes, source timestamps, and raw freshness facts;
- the parent Watch control plane owns consumer capability approval, freshness-policy thresholds, and whether a degraded source may be represented as current coverage;
- only the parent capability governor can expose a grain for new consumer subscription;
- P16 will implement source-health/check facts and false-silence protection.

## Authorization and audit

All five P14 tables have RLS enabled and forced. Consumers may select only their own Watches, coverage, and events. All mutations use narrow functions that derive the canonical subject with `auth.uid()`, validate Saved ownership and current capability eligibility, use row locks and row versions, and preserve idempotency keys in the lifecycle audit.

Anonymous users, unrelated consumers, Business Manager metadata, and specialist BFF database roles receive no table access. The P13 hub registry gains only `watch:read` and `watch:write` scopes; BFFs still require a user-scoped canonical authorization assertion.

`consumer.consumer_watch_events` records start, pause, resume, stop, restart, coverage add/remove, and capability unavailability/retirement. It does not log routine reads or future source checks.

## Typed contract

The `/v1/my` contract now includes `WatchStatus`, `WatchCapability`, `WatchCoverage`, `WatchState`, `AvailableCapability`, `StartWatchRequest`, and `ModifyCoverageRequest`, plus endpoints/operations for availability, state, start, lifecycle changes, and coverage changes. Existing entity-state responses gain only the narrow Watch state and available-capability count.

## Validation

- Existing Network/share assertions: passed.
- P11 static assertions: passed.
- P12 static assertions: passed.
- P13 static and executable contract tests: passed.
- P14 static contract: passed.
- TypeScript: passed.
- Changed-file ESLint: passed.
- Production build: passed with only the two pre-existing unused-variable warnings documented in earlier handoffs.
- `git diff --check`: passed.

The P14 SQL matrix contains 62 named cases covering capability governance, exact opt-in, Project independence, pause/resume, stop/restart, coverage changes/versioning, unsave conflicts, RLS, cross-hub reads, and audit events.

An approved ephemeral Supabase branch named `p14-watch-capability-validation` was created at the verified price of $0.01344 per hour. Validation completed as follows:

1. P11, P12, P13, and P14 applied in order.
2. The deterministic P14 validation seed applied separately from migration history.
3. P11 passed 31/31, P12 passed 56/56, P13 passed 58/58, and P14 passed 62/62.
4. The P12 suite was made forward-compatible: its two "creates no Watch" assertions now verify zero Watch rows when P14 exists and retain the same result when only P11/P12 are installed.
5. P14 rollback removed all P14 tables, functions, roles, and hub scopes; restored the P12 unsave operation; and left P11-P13 objects intact.
6. P11, P12, and P13 then passed 31/31, 56/56, and 58/58 in the rolled-back state.
7. P14 reapplied cleanly, its seed reapplied, and P14 passed 62/62 again. P11-P13 then passed again on the reapplied schema.
8. The Performance Advisor identified an unindexed foreign key on `consumer.consumer_watch_events.watch_id`. The migration gained `consumer_watch_events_watch_idx`; the branch received the equivalent index; P14 passed 62/62 once more.
9. Final structural checks found five P14 tables, all with enabled and forced RLS, zero browser mutation grants, Watch scopes on exactly the seven registered apps, and no Alert or source-observation tables.
10. The branch was deleted immediately after validation. Only the permanent `main` branch remains.

The final Security Advisor had no P14 security finding. Its seven informational `rls_enabled_no_policy` notices are inherited P13 `ops` tables that intentionally have no browser policies and are reachable only through server operations ([advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)). The final Performance Advisor had no unindexed-foreign-key finding. Its remaining notices were expected unused indexes in the fresh validation database ([advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)) and the branch environment's fixed Auth connection allocation ([production guidance](https://supabase.com/docs/guides/deployment/going-into-prod)).

## Deployment boundary

Nothing in P11-P14 is deployed or applied to the permanent Consumer project. Its migration history still contains only `remote_schema`, and direct schema checks confirmed P11, P12, P13, and P14 objects are absent. No legacy users were migrated. The existing working tree, earlier lab work, and P11-P13 artifacts remain intact.
