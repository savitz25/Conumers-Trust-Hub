# My TrustHub Phase 2 Prompt 18 handoff

Date: September 8, 2026
Status: Complete and validated in one deleted ephemeral Supabase development branch. Production remains unapplied.

## Scope

P18 adds the durable, private envelope for comparisons, calculators, plans, worksheets, and inventory sessions. It persists enough state to resume research across devices while leaving computation, payload meaning, rendering, and schema migration code with each specialist hub.

No specialist calculator was implemented. No Watch, Alert, notification, recommendation, ranking input, production export, or live adapter is created by P18.

## Session envelope

`consumer.consumer_saved_sessions` owns the canonical consumer, hub, session type, schema key/version, payload, display-safe summary, opaque resume reference, lifecycle, activity timestamps, optimistic row version, copy provenance, creation idempotency, and optional guest-origin key.

One create idempotency key returns one durable session. Updates require the current row version and cannot change schemas. An approved specialist migration adapter is required for an explicit schema upgrade. Payloads are never put into browser-visible URLs.

Statuses are:

- `active`: editable and resumable while its schema is approved or deprecated;
- `archived`: retained and omitted from primary Continue results;
- `read_only`: visible and exportable but not resumable;
- `invalidated`: retained for later audit/export policy but not used as active research.

## Hub-owned schema contract

`network.consumer_session_schemas` is the parent-governed registry. Every schema declares its hub, session type, version, payload byte limit, allowed and required top-level payload keys, allowed scalar summary keys, safe resume route, data classification, sensitive-field policy, retention policy, lifecycle, and effective window.

Specialist BFFs may propose draft schemas for their own hub. Only `myth_session_governor` can approve, deprecate, retire, or approve an adapter. Browser roles cannot mutate the registry. Approved payload meaning is stable; materially changed semantics require a new key/version.

`network.consumer_session_schema_migrations` records reviewed, hub-owned adapter contracts. The parent stores and validates the before/after envelopes but never interprets or transforms specialist payloads by itself.

## Payload and summary validation

The default schema payload ceiling is 64 KiB; a schema may choose a reviewed value between 1 KiB and 256 KiB. Validation requires an approved, effective schema owned by the submitting hub, exact type/version matching, positive top-level key allowlists, required keys, scalar display summaries, and a 2 KiB summary limit.

Recursive screening rejects credential, authentication, account-number, SSN, payment-card, medical-record, brokerage-authorization, executable HTML, and private-key content. The deterministic fixtures use only general ZIPs, aggregate scenario values, opaque provider references, and non-sensitive planning state.

Financial schemas are explicitly classified and store only the minimum scenario inputs needed to resume. The Senior fixture excludes diagnoses and medical records. The Investor fixture is research-only and excludes credentials, trading authority, performance, and recommendations.

## Projects and lifecycle

`consumer.consumer_project_saved_sessions` is a many-to-many join. One session can be in several Projects without payload duplication. Removing one membership preserves the others and the session. A session with no active membership is valid Unfiled research.

Project archive does not archive or delete sessions. Session archive retains Project membership. Removing an attached session returns a conflict; callers must explicitly remove memberships or use a future reviewed combined operation.

## Resume contract

`ops.consumer_session_resume_handoffs` follows the P13 model: 90-second random codes, SHA-256 hashes at rest, audience binding, canonical-user binding, browser-state and nonce hashes, one-time consumption, and allowlisted relative return paths. The server-side row contains the internal session reference. The browser URL contains only opaque code/state material, never the session UUID or payload.

After consumption, a specialist BFF may retrieve exactly one session only when the canonical user owns it, the BFF hub matches, its scope includes `session:read`, the schema belongs to that hub, and both session and schema are resumable. Move cannot read Lender payloads and no specialist can enumerate all account sessions.

## Guest sessions

P18 adds `mytrusthub-guest-sessions/v1` as a separate browser-local envelope, preserving P12's already validated entity-import contract. It has a 256 KiB total limit, at most 50 unique items, a 90-day maximum window, per-schema validation, and no auth tokens, notes, Watches, or Alerts.

Preview is read-only and reports `valid`, `duplicate`, `unsupported_version`, `expired`, `invalid`, or `oversized`. Commit imports only selected items. Guest-origin identity deduplicates retries without collapsing distinct sessions that happen to have equal outputs. Project assignment is optional; the default is Unfiled. Receipts retain sanitized outcomes rather than raw browser payloads.

## Read models

Saved Research receives bounded session summaries with title, hub, type, safe summary, Project memberships, activity time, lifecycle, schema status, and resume availability. Raw payload is omitted.

Continue returns recent active/resumable sessions ordered only by last resumed, updated, and created timestamps. Sponsorship, public ranking, and provider popularity do not participate.

Read-only and retired sessions remain in Saved Research and the future export contract but are excluded from Continue and resume.

## Authorization

All eight P18 tables enable and force RLS.

- Consumers can read only their own session metadata, memberships, events, and import receipts.
- Raw payload writes and lifecycle mutations use owner-checking functions.
- Anonymous and unrelated business subjects receive no consumer research access.
- A dual-role identity is authorized only by the canonical consumer subject.
- Specialist BFFs receive one-session, hub-matched read/write operations and cannot enumerate sessions, notes, delivery history, Watches, or other hubs' payloads.
- The parent governor has schema-registry read and governance operations only.
- Operational resume handoffs have no browser policies or grants.

## Deterministic validation schemas

Non-production registry fixtures cover:

- Move comparison and inventory;
- Lender PITI v1/v2 and closing-cost worksheet;
- Contractor bid comparison;
- Insurance coverage planning;
- Senior non-sensitive shortlist planning;
- Investor research-only fee worksheet;
- one draft Move schema and one retired/read-only Lender schema;
- one approved Lender PITI v1-to-v2 adapter contract.

These define persistence envelopes only and make no claims about live specialist implementation.

## Validation

- P18 static contract: passed.
- TypeScript contract: passed.
- Production build and changed-file lint: passed, with only the two pre-existing unused-variable warnings outside P18.
- `git diff --check`: passed.
- Initial P11-P17 regression: 408/408 passed.
- P18 matrix: 72/72 passed.
- P18 rollback removed all eight P18 tables and left every P11-P17 anchor intact.
- Post-rollback P11-P17 regression: 408/408 passed.
- The corrected P18 migration reapplied cleanly; P18 passed 72/72 after reapplication and again after advisor fixes.
- The branch was deleted immediately after validation. The permanent Consumer project still lists only `remote_schema`; all P11-P18 anchor tables remain absent there.

Validation found and fixed four P18 defects before the clean reapplication proof: validation-role setup in the seed, missing `network` schema usage for scoped schema proposers, a reference to the optional/nonexistent profile soft-delete field, and ambiguous guest-import JSON expressions. Three incorrect SQL-test column references were also corrected. The Performance Advisor identified six P18 foreign keys without covering indexes; all six now have covering indexes and the finding cleared.

The final Security Advisor reported only informational `rls_enabled_no_policy` notices for deliberately server-only tables, including `ops.consumer_session_resume_handoffs`. Those tables have forced RLS, no browser grants, and mutations only through scoped server functions. The final Performance Advisor reported only expected unused-index notices on a fresh branch plus the inherited Auth fixed-connection-allocation notice. There were no remaining unindexed-foreign-key findings.

Advisor references:

- [RLS enabled with no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [Unused index](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)
- [Auth production configuration](https://supabase.com/docs/guides/deployment/going-into-prod)

Database execution, P11-P17 regressions, P18 rollback/reapplication, and Supabase advisors require one explicitly approved ephemeral P18 branch.

## Rollback boundary

The P18 rollback removes only session schemas/adapters, Saved sessions, Project-session memberships, session events, resume handoffs, guest-session receipts/items, functions, grants, and the two session scopes. P11-P17 identity, Saved entities, Projects, notes, guest entity imports, handoffs, Watches, source monitoring, Alerts, and notification delivery remain intact.

## Remaining production gates

- Each real specialist schema and migration adapter needs owner review and contract tests before enablement.
- Product/security must approve schema-specific data classification and retention.
- Real specialist resume routes must be registered and deployed before production use.
- The later export/delete prompt must finalize sensitive-field inclusion, retention, and hard-deletion orchestration.
- Legacy vertical session discovery and migration remain separate work; email equality is never an identity-link mechanism.

Nothing was deployed or applied to the permanent Consumer project. No real calculator/comparison payloads or legacy identities were used, and P19 was not started.
