# My TrustHub Phase 2 Prompt 19 handoff

Date: September 8, 2026
Status: Complete and validated in one deleted ephemeral Supabase development branch. Production remains unapplied.

## A. Status

P19 is complete as an additive migration, P19-only rollback, governed validation seed, 97-case SQL matrix, static contract assertion, and TypeScript lifecycle contract. No decision UI, live export artifact, real-user deletion, legacy migration, deployment, or permanent database application occurred.

## B. Isolated environment

The permanent `Conumers-Trust-Hub` project (`qvvxvbcdmbjzrgvwjatw`) was rechecked before branch approval: it still contains only the `remote_schema` migration, no `network`, `consumer`, or `ops` tables, and no development branch besides `main`. The current quoted development-branch price is `$0.01344/hour`.

The approved branch `p19-decision-export-delete-validation` (`ebqxxrecfrfxxpdalsrh`, branch ID `37483649-3e3d-497e-bae3-5be1e228fe84`) received P11 through P19 and the deterministic validation seeds. It was deleted immediately after tests and advisors completed; the parent project now lists only `main`.

## C. Tables and functions

P19 adds:

- `consumer.consumer_project_decisions`
- `consumer.consumer_project_decision_entities`
- `consumer.consumer_research_snapshots`
- `consumer.consumer_project_events`
- `ops.consumer_export_jobs`
- `ops.consumer_destructive_confirmations`
- `ops.consumer_deletion_jobs`
- `ops.consumer_deletion_steps`

It adds decision recording, snapshot construction/verification, completion/reopen, narrow specialist decision context, export request/status and leased worker operations, purpose-bound deletion confirmation, deletion request/status/cancel, leased checkpointed deletion, and future-fanout/delivery suppression functions. It extends the P18 session registry with governed export policy and redaction keys.

## D. Decision model

`consumer_project_decisions` supports `selected_provider`, `still_deciding`, `not_proceeding`, `completed_without_provider`, and `other`. A selected-provider decision requires at least one selection; all other types require none. Notes are optional, private, limited to 4,000 characters, and have no publication route.

Selections are many-to-one by decision and may span the allowlisted lender, insurance, contractor, move, senior, investor, and other categories. A selected Saved row must be active, owned by the same canonical consumer, and actively attached to that Project at decision time.

## E. Decision supersession

Decisions are append-only checkpoints. A new checkpoint sets only `superseded_at` and the concurrency version on the prior current row, then inserts a new decision. The prior row and its snapshot remain. Idempotency binds a request key to a deterministic request fingerprint so a retry returns the same decision/snapshot and a changed request cannot reuse the key.

## F. Research Snapshot model

Every recorded decision creates `mytrusthub-research-snapshot/v1` atomically. The immutable JSON document contains stable references and minimal display facts for:

- Project and decision state;
- selected and Project-attached Saved records;
- Watch IDs and exact capability IDs/versions;
- source health, completeness, schema status, source-as-of, and last successful checks;
- qualified no-change truth from P15;
- Alert IDs, change-event IDs, event state, official/source time, and observed time;
- Saved-session IDs, safe summaries, schema versions, status, and update time.

It does not copy full source records, regulator datasets, raw specialist payloads, or a conclusion that a provider is safe, approved, recommended, or certified.

## G. Snapshot immutability and reproducibility

A database trigger rejects every snapshot update. Corrections and changed decisions create a new row. SHA-256 over the canonical PostgreSQL `jsonb` text detects tampering. Frozen names, identifiers, original network-entity references, event state, and session versions preserve intelligibility after an entity redirect, Alert retraction, or schema retirement; current reads may separately annotate later changes.

## H. Project complete, archive, and reopen

Completion requires the current non-`still_deciding` decision and its snapshot, uses optimistic concurrency, and records a meaningful Project event. `completed → archived` changes workspace visibility. `completed → active` and `archived → active` reopen the Project while retaining all decisions, snapshots, and history. The P12 `restore_project` contract is retained for compatibility and now records a reopen event.

## I. Watch continuation

Decision recording, completion, archive, and reopen never update `consumer_watches` or coverage. A Watch remains attached to its durable Saved record across Project lifecycle changes. Alerts and Watch history remain intact.

## J. Export model

`mytrusthub-export/v1` is a deterministic JSON bundle contract. A consumer requests an idempotent job; an export worker must claim that exact job with a hashed lease token before it can construct or complete the bundle. The manifest records version, export reference, request time, named sections, content hash, and later artifact expiry.

The bundle includes profile/preferences, Projects, Saved records, entity and session memberships, notes, Watches and exact coverage, Alerts with retraction state, notification settings, Saved sessions, decisions, snapshots, guest-import receipts, Project events, and retained Recent Research when implemented. Stopped Watches and retracted Alerts remain exportable history.

Test artifacts use an opaque `exports/...` storage reference and are never public URLs. Production artifact creation/download is deferred.

## K. Export security and sensitive data

Business Manager data, Auth secrets, tokens, service credentials, raw regulator datasets, identity confidence, other users, and delivery-provider internals are excluded.

Each P18 session schema has one governed policy:

- `full`: validated payload may be included;
- `redacted`: reviewed keys are removed;
- `summary_only`: only the envelope and safe summary are exported.

The non-production PITI fixtures use `summary_only`; read-only/legacy sessions remain exportable at least as envelope and summary. Artifact access expires after seven days and must later use authenticated opaque storage access.

## L. Delete model

Workspace deletion requires canonical consumer authentication plus a one-time, SHA-256-at-rest, purpose-bound confirmation code that expires within ten minutes. The request enters a seven-day grace period and is idempotent across request keys while active. Cancellation is allowed only during that grace period.

The worker claims one job with a hashed lease and runs six ordered, retry-safe steps:

1. revoke consumer handoffs, stop Watches, cancel queued delivery/export work;
2. remove notification state, delivery ledger rows, and Alerts;
3. remove Project events, decisions, and snapshots;
4. remove resume handoffs, sessions, notes, and session memberships;
5. remove Watch coverage/history, Watches, guest receipts, Projects/memberships, and Saves;
6. remove legacy consumer identity links and the consumer profile.

A deletion request immediately prevents new Alert and outbound-delivery inserts. A completed job blocks accidental consumer-workspace recreation. Step checkpoints support safe resume after partial failure.

## M. Dual-role and Business Manager boundary

P19 deletes the My TrustHub workspace, not the common Auth subject. The canonical `auth.users` row remains in all cases; full sign-in-account deletion is a separate, future identity lifecycle. This preserves a dual-role user's Business Manager authorization and claimed public company. The deletion worker has no function or grant that mutates Business Manager or shared network/public evidence.

The narrow specialist decision response answers only whether the exact Saved record is “Selected for this Project,” plus decision type/category/time. It omits private notes and does not support decision enumeration or popularity inference.

## N. Retention decisions

- Deletion grace period: 7 days.
- Export artifact access: 7 days.
- Completed operational deletion-job metadata: 30 days, followed by purge or pseudonymization.
- Consumer-private product state: delete.
- Shared network/regulatory evidence: retain because it is not consumer-owned.
- Stopped Watches: export history.
- Retracted Alerts: export with current correction/retraction state.
- Canonical Auth subject: retain; account deletion is separate.

The exact legally required operational/security retention period remains a launch gate for privacy/legal review; the architecture makes no broader legal claim.

## O. RLS and worker authorization

All eight P19 tables enable and force RLS. Consumers receive SELECT-only access to their own decisions, selections, snapshots, and Project events. Mutations use narrow owner-checking functions. `ops` tables have no browser policies or direct grants.

The export worker receives leased export functions only and no direct consumer-table grants. The deletion worker receives confirmation and leased deletion functions only. Specialist BFFs receive only exact entity/Project decision context under `decision:read`; they receive no decision-note, snapshot, export, or deletion access. Anonymous and unrelated business subjects are denied.

## P. Test results

Local validation completed:

- P19 static contract: passed.
- TypeScript: passed.
- Changed-file ESLint: passed.
- Production build: passed with only two pre-existing unused-variable warnings outside P19.
- Full repository static tests through P19: passed.
- `git diff --check`: passed.

Database validation completed:

- Initial P11-P18 regression: 505/505 passed.
- P19 matrix after correcting two test-contract assertions: 97/97 passed.
- P19 rollback removed every P19 object and left all eight prior anchor groups intact.
- Post-rollback P11-P18 regression: 505/505 passed.
- Final checked-in P19 migration reapplied cleanly.
- Final P19 matrix: 97/97 passed.

The initial P19 run exposed one PostgreSQL test-harness syntax error before test execution; a nested data-modifying CTE was replaced with transaction-local helper functions. The next run found two incorrect expectations: cross-user export status safely returns no row instead of throwing, and an identity-confidence assertion matched the manifest's explicit exclusion label. Both tests were corrected without weakening the production contract.

## Q. Regression results

P11-P18 database regressions passed 505/505 both before P19 validation and after the P19 rollback:

- P11: 31
- P12: 56
- P13: 58
- P14: 62
- P15: 64
- P16: 67
- P17: 70
- P18: 72

## R. Rollback and reapplication

The P19-only rollback removed the eight P19 tables, P19 triggers/functions/grants/scopes, and the two session export-policy columns. It restored the exact P12 archive/restore functions. Direct catalog assertions confirmed P11-P18 remained installed, and all 505 prior cases passed afterward. The final P19 migration text then reapplied cleanly and passed 97/97.

## S. Advisors

The first Performance Advisor run identified six P19 foreign keys without covering indexes and four RLS policies that evaluated `auth.uid()` per row. The migration now includes the six indexes and uses scalar subqueries for `auth.uid()`; the final advisor run confirmed both finding classes cleared.

The final Security Advisor reported only informational `rls_enabled_no_policy` notices for deliberately server-only `network` and `ops` tables. They use forced RLS, no browser grants, and narrow server functions. The final Performance Advisor reported only expected unused-index notices on a fresh database and the inherited Auth fixed-connection-allocation notice. No P19 unindexed foreign key, RLS initialization-plan warning, or security error remains.

Advisor references:

- [RLS enabled with no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [Unused index](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)
- [Auth production configuration](https://supabase.com/docs/guides/deployment/going-into-prod)

## T. Files changed

- `supabase/migrations/20260908210000_my_trusthub_decisions_export_delete.sql`
- `supabase/rollback/20260908210000_my_trusthub_decisions_export_delete.down.sql`
- `supabase/seeds/p19_decision_export_delete_validation.sql`
- `supabase/tests/p19_decisions_export_delete.sql`
- `scripts/assert-p19-foundation.mjs`
- `lib/my-trusthub/lifecycle-contract.ts`
- `lib/my-trusthub/session-contract.ts`
- `lib/my-trusthub/cross-hub-contract.ts`
- `lib/my-trusthub/hub-registry.json`
- `package.json`
- `docs/my-trusthub-phase-2-prompt-19.md`

## U. Remaining risks

- Real export object storage, encryption, signed downloads, purge confirmation, and restore drills remain P20 gates.
- Legal/privacy review must approve exact audit, deletion, and backup-retention behavior before launch.
- Snapshot payload size should be load-tested against high-cardinality Projects before production application.
- Deletion must be reconciled with backups, analytics, support systems, and any future data warehouse before production.
- Existing real specialist session schemas need individual export-classification approval.

## V. P20 readiness

1. Recording a decision has no database trigger, grant, foreign key, or function path to public ranking.
2. A Research Snapshot cannot change after creation; a correction creates a new immutable row.
3. Project completion cannot stop a Watch implicitly.
4. Project archive cannot delete Saved research.
5. A business role cannot see private decisions; only the same canonical subject can access its consumer workspace.
6. Export excludes Business Manager state and raw regulator datasets.
7. Consumer deletion preserves network entities, bindings, source observations, change events, public profiles, and regulator evidence.
8. Dual-role workspace deletion retains the Auth subject and does not touch Business Manager authorization.
9. Frozen display facts and stable/versioned references keep historical decisions understandable after redirects, retractions, and session retirement.
10. No P0 blocker remains before P20. Production application, real object storage, legal/privacy retention approval, and launch operations remain explicit P20 gates.

## W. Next prompt

After isolated validation passes, P20 should integrate the frozen Lab UI with real parent state, add the six-hub rollout adapters, exercise migration and restore rehearsals, harden operational monitoring, and define the deployment/security/launch gate. P20 must not begin until P19 is fully validated and separately authorized.
