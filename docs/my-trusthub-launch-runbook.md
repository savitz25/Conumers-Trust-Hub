# My TrustHub launch and operations runbook

Date: 2026-09-08
Applies to the parent consumer control plane and all six specialist integrations.

## Independent kill switches

Server-side flags default off and require the master `MY_TRUSTHUB_ENABLED` gate:

- `MY_TRUSTHUB_SIGNUP_ENABLED`
- `MY_TRUSTHUB_SAVED_ENABLED`
- `MY_TRUSTHUB_PROJECTS_ENABLED`
- `MY_TRUSTHUB_WATCH_ENABLED`
- `MY_TRUSTHUB_ALERTS_ENABLED`
- `MY_TRUSTHUB_EMAIL_ENABLED`
- `MY_TRUSTHUB_EXPORT_ENABLED`
- `MY_TRUSTHUB_DELETE_ENABLED`
- `MY_TRUSTHUB_SPECIALIST_HANDOFF_ENABLED`
- `MY_TRUSTHUB_SOURCE_MONITORING_ENABLED`

Capability-level enablement and eligibility remain separate database kill switches. Source quarantine prevents acceptance/events. Alert and notification worker deployment/scheduling provides an additional operational stop. Disabling any switch retains user state.

## Launch dashboard

Track counts and rates without using behavior for ranking:

- canonical signup and authentication failures
- Save, Project, and membership operation failures
- handoff creation/consumption failures, replay denials, audience/state failures, and rate-limit failures
- Watch start failures by safe reason and capability
- checkpoint health by source/capability: current, delayed, degraded, unknown
- quarantined observations and mass-change guards awaiting review
- change-detector and Alert-fanout failures/duplicates skipped
- delivery pending, delivered, transient failure, permanent failure, bounce, complaint, and suppression
- export/deletion jobs by status, age, retry count, and terminal failure
- RLS/authorization denials and service-scope violations, with sensitive values redacted

Never emit handoff codes, tokens, private notes, raw guest/session payloads, consumer email, export content, confirmation secrets, or provider credentials.

## Incident procedures

### Source delayed, degraded, or schema changed

1. Disable source monitoring for the adapter or set the capability operational state unavailable.
2. Confirm the checkpoint is not `current`; no-change language must be suppressed.
3. Quarantine affected candidates and events.
4. Inspect schema/completeness/cadence without changing prior accepted evidence.
5. Parent/operator approves quarantine release after adapter validation and a controlled replay.
6. Do not bulk-release Alerts without a separate reviewed fanout decision.

### Mass-change quarantine

1. Keep the affected run and events suppressed.
2. Compare record counts, pagination, source schema, and a deterministic sample with the official source.
3. Record operator evidence and release decision.
4. If the change is real, use bounded controlled fanout; clearing the source guard alone must not email consumers.

### Duplicate or ambiguous identity

1. Mark the binding `review_required`; Watch must remain unavailable.
2. Preserve existing Saved references and identifier validity periods.
3. Review provenance and authoritative IDs.
4. Use governed redirect/merge functions only; never reassign Watches based on name or email.

### Handoff failures or replay spike

1. Disable `MY_TRUSTHUB_SPECIALIST_HANDOFF_ENABLED` if the error rate is anomalous.
2. Check exact origin/audience/issuer, TTL, browser state, nonce, and rate limiter.
3. Redact the code from logs and telemetry.
4. Do not weaken one-time consumption or fail-open behavior to restore service.

### Alert retraction

1. Mark the shared event retracted with correction provenance.
2. Suppress pending fanout/delivery.
3. Keep existing consumer Alert history visible with correction status.
4. Do not automatically send correction email without an approved rule/template.

### Email bounce or complaint

1. Reconcile provider webhook only after signature verification.
2. Mark the delivery destination suppressed; retain the in-app Alert and Watch.
3. Stop retries for permanent failures.
4. Never disable Watch coverage because an email failed.

### Export failure

1. Keep the job private and non-downloadable.
2. Retry only resumable steps under the assigned user/job scope.
3. Verify manifest and hash before completion.
4. Expire artifacts after seven days; never expose a public bucket URL.

### Deletion failure

1. Keep notification/fanout blocking active once processing begins.
2. Resume from the recorded deletion step; do not recreate deleted private state.
3. Preserve auth identity and Business Manager authorization for a dual-role user.
4. Never delete network entities, bindings, source observations, public profiles, or business claims.

### Service outage

1. Turn off the smallest affected feature flag.
2. Keep reads available when they remain accurate and private.
3. For monitoring outages, suppress reassurance and expose delayed/degraded/unknown state.
4. Record recovery validation before re-enabling mutations or workers.

## Support boundaries

Consumer decisions, Saves, Watches, Projects, and session activity never feed public ranking. Providers are never notified that a consumer saved, watched, or selected them. Legal/privacy review is required for final retention copy, transactional email defaults, export copy, deletion copy, and monitoring limitation language.
