# My TrustHub Phase 2 Prompt 12 handoff

Date: September 7, 2026
Status: Complete in an isolated non-production validation branch. Nothing was applied to the permanent `Conumers-Trust-Hub` project.

## Scope delivered

P12 adds the durable consumer research-state layer on top of P11B:

- one durable Saved row per canonical consumer and network entity;
- optional, many-to-many Project membership;
- consumer-private notes;
- explicit preview and consent-based commit for browser-local guest research;
- archive and restore foundations that preserve Saves, memberships, and notes;
- narrow authenticated database operations and typed parent-service contracts;
- forced RLS, ownership triggers, concurrency controls, and idempotency constraints.

P12 does not create Watches, Watch coverage, observations, changes, Alerts, notification delivery, saved session payloads, cross-domain runtime APIs, decisions, snapshots, export/deletion jobs, user migrations, or Business Manager state.

## Isolated validation environment

One ephemeral Supabase development branch named `p12-saved-projects-guest-validation` was created from the permanent Consumer control plane after explicit hourly-cost approval. P11 was applied first and P12 second. The P12 rollback was then applied, P11 survival was queried directly, and the consolidated P12 migration was reapplied from a clean P11 state.

The branch was deleted immediately after the final SQL suites and advisors completed. A follow-up branch listing showed only `main`. Direct inspection of the permanent project showed the P11 and P12 relations absent, and its migration history remained the existing `remote_schema` baseline only.

## Schema

### `consumer.consumer_saved_entities`

- References the canonical parent `auth.users.id` and a P11 `network.network_entities.id`.
- Optionally records the source binding and its Save-time resolution state (`accepted` or `review_required`).
- Stores only bounded source context, not a vertical profile or regulator evidence copy.
- Enforces one durable row for `(user_id, network_entity_id)`.
- Uses soft removal and restores that same durable row on a later Save.
- Uses `row_version` for optimistic concurrency.
- A Save has no Watch or public/ranking side effect.

The stored network entity remains durable after a later redirect. `consumer.list_saved_entities()` resolves the current terminal canonical entity through P11's redirect resolver at read time. A future controlled reconciliation job may rewrite stored references, but P12 does not move them blindly.

### `consumer.consumer_projects`

- Supports `active`, `completed`, and `archived` storage states.
- Persists allowlisted life-event values: `buying_home`, `moving`, `aging_parent`, `contractor`, `protecting`, `adviser_research`, and `blank`.
- Stores a bounded, versioned, allowlisted location-context object and optional target date.
- Uses `(user_id, creation_key)` for idempotent creation and `row_version` for edits/transitions.
- P12 exposes active-to-archived and archived-to-active operations. Completion is structurally supported but remains part of the later decision implementation.

Project category slots are derived from versioned product templates. P12 creates no category table and stores no hub ranking/order. A later prompt may add a compact override only if accepted UX requires one.

### `consumer.consumer_project_saved_entities`

- Durable many-to-many link between a Project and a Saved row.
- Composite primary key makes add idempotent and permits restoring a removed membership.
- One Saved row can belong to any number of the same consumer's Projects.
- A trigger verifies both parents have the same canonical owner and rejects active membership for a removed Save.
- Removing one membership leaves the Saved row and every other membership intact.
- Zero active memberships means the Save is Unfiled.

### `consumer.consumer_notes`

- A note can target a Project, a Saved entity, or an active Project/Saved membership pair.
- At least one target is required.
- `note_type` is limited to `general`, `research`, or `reminder`; body length is 1–4,000 characters.
- Ownership is checked from the parent rows by trigger as well as by narrow mutation functions.
- Notes have no grant, trigger, or foreign key into public evidence, rankings, or Business Manager state.

### Guest-import receipt tables

`consumer.consumer_guest_imports` stores a minimal idempotent receipt: version, per-user idempotency key, request fingerprint, counts, status, and timestamps.

`consumer.consumer_guest_import_items` stores only sanitized item outcomes and references. It does not retain the raw browser payload, entity names, notes, tokens, or regulator data.

## Guest contract

The shared TypeScript and SQL contract is `mytrusthub-guest/v1`:

- browser-local payload;
- maximum encoded size of 256 KiB;
- maximum age and expiry window of 90 days;
- exact allowlisted top-level and item keys;
- P12 item type limited to `saved_entity`;
- no auth tokens, service secrets, raw regulator dumps, private notes, Watch state, Alerts, or vertical auth IDs.

Preview validates without mutation and returns an item status of `accepted`, `duplicate`, `review_required`, `unresolved`, or `invalid`, plus importability and any existing Saved ID. It resolves every item from specialist identity through the P11 binding and canonical redirect path.

Commit accepts an explicit list of selected client item IDs. It creates or restores only importable selected Saves, deduplicates existing Saves, optionally adds them to an owned Project, otherwise leaves them Unfiled, and records a minimal receipt. It never creates a Watch or Project. Reusing an idempotency key with the same request returns the stable receipt; using it for different input is rejected.

`review_required` research can be Saved and remains visibly marked. It does not gain accepted or Watch-eligible identity semantics.

## Saved removal and Project lifecycle

Removing an Unfiled Save sets `removed_at` and retains its durable identity. If active Project memberships exist, removal returns a conflict and requires explicit membership handling. This leaves room for P14/P15 to add the equivalent active-Watch conflict without changing the current contract.

Archiving a Project changes only Project lifecycle fields. It does not remove Saved rows, memberships, or notes. Restore reactivates the same Project and preserves all relationships.

## Authorization

All six P12 tables have RLS enabled and forced. Authenticated consumers have read policies scoped to `auth.uid()`; child-table reads derive ownership from the Project/import parent. Anonymous roles receive no schema/table/function access.

Browser clients have no direct write grants. Mutations use narrowly granted `SECURITY DEFINER` functions with fixed search paths, canonical-subject checks, parent ownership validation, constraints, advisory locks where needed, idempotency keys, and row versions. Business metadata supplies no bypass. A dual-role identity receives consumer access only to rows owned by that same canonical subject.

## Parent service contract

`lib/my-trusthub/contracts.ts` defines the shared guest payload and result types plus the parent-side `MyTrustHubResearchService` operations:

- save/remove/list Saved entities;
- create/list Projects;
- add/remove membership;
- create/update/delete a private note;
- preview/commit guest import.

This is a parent control-plane contract. It does not expose broad table or service-role access to specialist browsers. P13 will provide the hardened cross-hub API and canonical auth/context handoffs.

## Validation results

### P11 regression

All 31 P11 SQL checks passed after initial application and again after the final P12 reapplication:

- 15 authorization allow/deny checks;
- 10 entity-resolution/governance checks;
- 6 canonical-to-legacy identity-link checks.

### P12 56-case matrix

All 56 cases passed before rollback and after clean reapplication:

1. Consumer A saves accepted entity — allow.
2. Duplicate Save returns the same durable row.
3. Consumer B cannot read A's Save.
4. Anonymous cannot read Saves.
5. Business-only subject cannot read A's Save.
6. Save creates no Watch.
7. Save changes no network/public ranking data.
8. `review_required` Save remains distinguishable.
9. Redirected identity resolves to the terminal canonical entity.
10. Consumer A creates Projects.
11. Consumer A edits an owned Project.
12. Stale Project update is rejected.
13. Consumer B cannot read A's Project.
14. Invalid life-event value is rejected.
15. Saved entity is added to an owned Project.
16. Duplicate membership add is idempotent.
17. One Saved row belongs to two Projects.
18. Owned active Project archives.
19. Restore preserves membership.
20. Removing membership from one Project leaves the other.
21. Cross-user membership is denied.
22. A Save with no active membership remains Unfiled.
23. Guest preview performs no mutation.
24. Unresolved guest item is not importable.
25. `review_required` preview follows the Save-only contract.
26. Payload over 256 KiB is rejected.
27. Unknown guest schema version is rejected.
28. Expired guest payload is rejected.
29. Raw auth-token field is rejected by the closed schema.
30. Selected accepted guest item imports.
31. Duplicate guest item resolves the existing Saved row.
32. Selected `review_required` item imports with that state.
33. Deselected item is not imported.
34. No Project choice produces Unfiled research.
35. Explicit owned-Project assignment works without duplicate Save.
36. Guest import creates no Watch.
37. Repeated idempotency key creates no duplicates.
38. Consumer A creates a private Project note.
39. Consumer A creates a private Saved-entity note.
40. Note writes do not touch network/public evidence.
41. Consumer B cannot read A's notes.
42. Business role metadata cannot read A's notes.
43. Removing an Unfiled Save succeeds by soft removal.
44. Removing a Save with active Project membership returns a conflict.
45. Project archive never removes the Saved row.
46. Consumer A can read owned rows in every P12 table.
47. Direct browser writes are denied.
48. Consumer B sees no A Saved rows.
49. Consumer B sees no A Project rows.
50. Consumer B sees no A membership rows.
51. Consumer B sees no A note rows.
52. Consumer B sees no A import receipts.
53. Consumer B sees no A import item outcomes.
54. Anonymous is denied every P12 table.
55. Business-only subject sees no unrelated P12 rows.
56. Dual-role subject sees only its own P12 rows.

### Rollback and reapplication

The P12 compensating rollback removed all six P12 tables and P12 functions. Direct assertions confirmed P11's `network.network_entities`, `consumer.consumer_profiles`, `ops.consumer_identity_links`, entity resolver, and forced profile RLS remained. The consolidated P12 migration then reapplied cleanly, and both the 56-case P12 matrix and 31-case P11 regression suite passed again.

### Static and application checks

- P11 static contract assertions: passed.
- P12 static contract assertions: passed.
- TypeScript contract/type check: passed.
- Production build: passed.
- Existing repository tests: passed.
- Changed-file lint: passed.
- `git diff --check`: passed.

### Supabase advisors

Security Advisor returned no findings. The P12 performance finding for the guest-item network-entity foreign key was corrected with a covering index. The final Performance Advisor result contained only the existing project-level Auth connection allocation note (`auth_db_connections_absolute`), which is outside the P12 schema and should be addressed as part of production capacity configuration.

## Phase 1 UX contract proof

- First Save without Project: Saved row needs no membership.
- Later Project assignment: independent membership operation.
- Multi-Project membership: composite links share one Saved row.
- Remove from one Project: soft-removes that link only.
- Unfiled research: zero active memberships is valid.
- Guest import after signup: preview then explicit selected commit.
- Duplicate guest Save: resolves the existing durable Saved ID.
- Optional Project assignment: commit accepts an owned Project or none.
- No implicit Watch: P12 has no Watch table or operation.
- Archive preservation: lifecycle update never mutates Saved/membership/note rows.
- Business separation: canonical subject ownership remains the only consumer authority.
- Private notes: consumer-only schema, RLS, ownership checks, and no public-write path.

## Deviations and deferred work

- Saved lifecycle uses one permanent `(user, network entity)` row and restores it after soft removal, rather than creating repeated lifecycle rows. This preserves stable references and prevents duplication.
- Project categories remain template-derived; P12 adds no relational category subsystem.
- Guest project drafts are not imported in P12 because the accepted UX can create Projects explicitly after import, and the requested lifecycle requires Saved items only.
- P12 exposes narrow SQL operations and a typed parent service interface, not HTTP endpoints. The cross-hub API and handoff runtime belong to P13.
- The existing Auth connection allocation setting remains a production-readiness note; changing project-level capacity configuration was not authorized in P12.

## Remaining risks and P13 gate

No P0 blocker remains for P13. Before production use, P13 must authenticate every specialist handoff to the canonical parent subject, validate redirect and Project context allowlists, protect mutations against CSRF/replay, and keep service credentials server-side. P14 must consume `identity_resolution_state` and current binding state so `review_required` Saves cannot become Watch-eligible.

Recommended P13 scope: parent-owned cross-hub state API plus one-time canonical auth and opaque Project/context handoffs, including origin/return-URL allowlists, CSRF/state binding, replay protection, least-privilege server authorization, and end-to-end specialist round-trip tests. Do not add Watch subscriptions in P13.
