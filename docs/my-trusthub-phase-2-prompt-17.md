# My TrustHub Phase 2 Prompt 17 handoff

Date: September 8, 2026
Status: Complete and validated on one deleted ephemeral Supabase branch. Production remains unapplied.

## Scope

P17 adds global transactional notification preferences, per-Watch email overrides, reviewed notification templates, an idempotent outbound-delivery ledger, bounded retry state, P1/P2 digest eligibility, and health-qualified periodic Watch-summary data. The only transport is deterministic mock behavior inside the isolated database/type contract.

P17 sends no real email, configures no provider, changes no Watch coverage, creates no Alert, and exposes no consumer address or delivery history to specialist hubs.

## Defaults and consent

Every consumer profile receives one preference row with these deterministic defaults:

- P0 email: enabled
- P1 digest: enabled
- P2 digest: disabled
- Periodic Watch summary: enabled
- Timezone: `UTC`
- Local digest time: `08:00`

These settings govern transactional monitoring delivery only. They do not represent marketing consent. Consumers select an IANA timezone; UTC is the fallback and IP location is not inferred.

Global consent is authoritative. A per-Watch override may disable email for one severity or restore use of the global default, but it cannot enable a globally disabled channel. In-app Alert creation and read state remain independent and always follow P16.

## Tables

- `network.consumer_notification_templates`: versioned parent-governed email templates for P0 immediate, P1 digest, P2 digest, periodic Watch summary, and future reviewed correction use.
- `consumer.consumer_notification_preferences`: one private global preference row per canonical consumer.
- `consumer.consumer_watch_notification_overrides`: email/severity delivery choices scoped to one Watch.
- `consumer.consumer_notification_events`: idempotent consumer-visible audit of preference and override changes.
- `ops.consumer_alert_deliveries`: one logical delivery row per Alert/channel/type/template/window, with consent snapshots and recipient hash rather than an address.
- `ops.consumer_alert_delivery_attempts`: append-only bounded attempt history.

All tables enable and force RLS. Delivery tables are server-only.

## Delivery eligibility

`ops.enqueue_alert_delivery` is restricted to `myth_notification_delivery`. It reads one existing P16 Alert and reuses its event severity. It never creates or reclassifies an Alert.

P0 becomes pending immediate email only when:

1. the source event is still active;
2. the Watch is currently active;
3. global P0 email remains enabled;
4. no per-Watch P0 override disables email;
5. the canonical Auth address is confirmed and syntactically deliverable;
6. an approved, enabled template exists;
7. no logical delivery already exists.

P1 enters a local-date digest window when P1 digest is enabled. P2 enters a digest only after explicit P2 opt-in; otherwise its Alert stays in-app and the email disposition is recorded as suppressed. Preference and Watch eligibility are checked again immediately before P0 processing.

## Delivery ledger and idempotency

The logical uniqueness key is Alert, channel, delivery type, template version, and delivery window. A separate unique idempotency key protects request replay. Processing locks one ledger row, treats delivery as terminal after success, and appends at most one attempt number.

The mock provider reference is deterministic and begins with `mock:p17:`. No network call exists. A future provider adapter must receive the same logical idempotency key and support provider-side deduplication or reconciliation before production email is enabled.

Alert read/unread state is never changed by enqueue, attempt, success, failure, suppression, or retry.

## Retry and failure behavior

Maximum attempts: five. Retry delays are deterministic: 1 minute, 5 minutes, 30 minutes, 2 hours, then 8 hours.

- transient, provider, and rate-limit failures schedule another bounded attempt;
- permanent and invalid-destination failures are terminal;
- reaching the maximum becomes a permanent terminal failure;
- a failed or suppressed delivery never pauses or stops a Watch.

The attempt ledger records attempt number, result class, safe error code, mock/provider reference, time, and worker identity. The parent delivery read model need not expose provider diagnostics to consumers.

## Retraction and suppression

Send-time eligibility is authoritative. An event retracted or suppressed before send changes a pending delivery to suppressed. A delivery already completed remains in the ledger. Correction email is disabled in the validation registry; future correction delivery requires a separately reviewed rule and template.

P15/P16 mass-change suppression propagates into delivery. Operator release does not bypass the P17 eligibility checks or create a bulk delivery automatically.

## Email content and template governance

The P0 payload is deterministic and contains My TrustHub identity, entity, hub, reviewed change description, official-as-of and observed clocks, source and confirmation reference, Project context, exact watched grain, why-received copy, and the disclosure:

> Extracts can lag. This is not a TrustHub verdict.

The factual subject pattern is `My TrustHub alert: public record changed for {{entity_name}}`. Templates cannot contain provider scoring or endorsement semantics. Approved copy is immutable; changed semantics require a new version.

The manage-notifications destination is a fixed parent path, `/my/notifications`, and contains no user, Watch, Project, or Alert identifier.

## Digest and periodic summary

Digest eligibility is bounded to P1 and explicitly enabled P2 delivery rows, grouped by consumer local date. Each Alert appears once and retains source name, source confirmation reference, official-as-of date, and entity context. No score or provider aggregation is introduced.

Periodic Watch summaries call P16's coverage-check operation. Only `check_state = no_change` contributes to the healthy no-change count. Delayed, degraded, unknown, and baseline-only coverage remain separate counts and can never be presented as reassuring silence. Inactive Watches are excluded.

## API and cross-hub boundary

The parent typed contract adds operations for preference reads/updates, Watch override reads/updates, digest eligibility, Watch-summary eligibility, and mock transport abstraction. Specialist contracts receive no notification scope, email address, preference values, delivery row, or provider diagnostics. Specialist UI may link to the fixed parent manage-notifications destination.

## Authorization

- Authenticated consumers can read only their own preference, override, and preference-event rows and mutate them through owner-checking functions.
- Anonymous and unrelated business subjects cannot access consumer settings.
- A dual-role identity receives only its canonical consumer rows.
- `myth_notification_delivery` can enqueue/process deliveries and render approved payloads through narrow functions.
- The delivery role cannot change Alerts, Watch coverage, Projects, notes, network identity, capability rules, source observations, or event severity.
- Browser and specialist roles cannot read or mutate the operational delivery ledger.

## Validation

The approved ephemeral branch `p17-notification-delivery-validation` (`upgvilzapkdwbcbpxmvk`) was created at the acknowledged `$0.01344/hour`, used only for P17 validation, and deleted immediately after the advisors completed.

- P11: 31/31 passed.
- P12: 56/56 passed.
- P13: 58/58 passed.
- P14: 62/62 passed.
- P15: 64/64 passed.
- P16: 67/67 passed.
- P17: 70/70 passed before rollback and after clean reapplication.
- P17 static contract: passed.
- Typed notification/service contract: passed TypeScript validation.
- Production build and changed-file lint: passed, with only the two pre-existing unused-variable warnings outside P17.
- `git diff --check`: passed.

The database run caught and corrected an ambiguous PL/pgSQL local variable in the enqueue operation. It also tightened two test assertions so they verify behavior through the narrow operation boundary instead of requiring browser or worker access to internal helper/ledger tables.

P17 rollback removed all six P17 tables and associated functions, triggers, policies, grants, and template state. P11-P16 anchor objects remained present and all six earlier SQL suites passed in the rolled-back state. The corrected P17 migration then reapplied cleanly and the complete P11-P17 stack passed again.

## Supabase advisors

Security Advisor returned informational `rls_enabled_no_policy` findings for server-only ops/raw monitoring tables, including the two P17 delivery tables. Those tables intentionally have forced RLS, no browser grants, and no permissive policies; access is through narrow security-definer operations. No P17 security error was reported.

Performance Advisor returned fresh-branch `unused_index` notices, including `consumer_notification_events_watch_idx`, plus the inherited fixed Auth database-connection allocation notice. A short-lived fixture branch cannot establish production index usage, so no index was removed based on that signal. The Auth allocation setting is a deployment gate rather than a P17 schema change.

After branch deletion, the parent project listed only its pre-existing `remote_schema` migration, and direct catalog checks confirmed the P11-P17 anchor tables remain absent from the permanent project.

## Rollback boundary

The P17 rollback removes only notification templates, preferences, overrides, notification audit, delivery ledger/attempts, P17 functions, grants, triggers, and the P17 role comment. It leaves P11-P16 identity, research, handoff, Watch, observation, source-health, change-event, and Alert objects intact.

## Remaining production gates

- Select and security-review an external transactional provider.
- Verify provider-side idempotency, webhook authentication, bounce handling, and suppression reconciliation.
- Approve sender identity, domain authentication, complaint handling, and operational alerting.
- Review transactional consent defaults and correction-email policy with product/legal stakeholders.
- Define production scheduler ownership for P1/P2 digest windows and periodic summaries.

Nothing has been deployed or applied to the permanent Consumer project. No real email was sent and no live provider was configured.
