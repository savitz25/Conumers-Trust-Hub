# My TrustHub Stage 5

Status: **closed**. Stage 5 enables private, in-app Alerts from accepted, material network change events for explicitly watched public-record grains. Email, push, SMS, and digest delivery remain disabled for Stage 6.

## Live capability

The founder canary watches `contractor.fl.dbpr.license_status` version 2 for DBPR credential `CCC1332036`. Its primary source is the exact DBPR Verify a Licensee lookup. The current real observation remains `primary_status=delinquent` and `secondary_status=active`; unchanged daily polling creates no event and no Alert. The historical version 1 coverage remains disabled and cannot fan out.

Approved template: `license_status_changed`, severity P2, factual headline “Florida DBPR license status changed”. The source presentation is Florida DBPR Verify a Licensee. Alert copy states that it reflects a change in the watched public record and is not a recommendation or verdict. Official/source-as-of is shown separately from observed/checked-at; an unpublished official timestamp is stated as such.

## Runtime and fanout

The existing P16 tables and functions are used: `network.consumer_alert_templates`, `network.consumer_source_presentations`, `consumer.consumer_alerts`, `ops.consumer_alert_fanout_audit`, and `consumer.fanout_change_event`. The daily DBPR cron invokes the scoped P15 runtime, then drains only approved pending events through idempotent fanout. It requires an exact capability and version match, active Watch coverage, an eligible pause boundary, and an approved severity template. Quarantined, suppressed, retracted, unsupported, stale, failed, duplicate, and mass-change events do not create consumer Alerts.

The P15 runtime has only the DBPR polling and Alert fanout function grants required by this path. No browser credential or consumer private-data grant is used. A fanout failure is returned as retryable and remains observable in the audit trail.

## Inbox and history

`/my/alerts` is private, no-store, noindex/nofollow/noarchive, and offers all, unread, P0, P1, and P2 views. Cards show the entity, hub, exact grain, change, severity, source, source timing, and coverage version. Detail shows prior/current normalized values, source evidence timing, Watch coverage, lifecycle history, correction/retraction notices, and a research action. Read/unread and mark-all-read are owner-only state and never affect severity, Watch state, polling, or ranking.

Corrections and retractions preserve the original Alert and add an auditable lifecycle event. Intentional pause follows the existing P14 policy: events during pause do not backfill on resume; future accepted events are eligible. Business claims, edits, payments, Save counts, and provider access cannot influence Alert creation or severity.

## Certification

The real production canary was unchanged: current DBPR polling succeeded, source health stayed current, and permanent production Alerts remain zero. An isolated transaction fixture for the exact v2 capability produced one P2 Alert from an accepted material transition, duplicate fanout produced one Alert, and the transaction rolled back. The same P16 foundation matrix remains the governing test suite; production rows were not seeded by certification. Mass-change suppression, source failure, schema incompatibility, pause, correction/retraction, owner isolation, and version pinning were covered by the rollback-safe matrix and runtime checks.

## Stage 6 dependency

`MY_TRUSTHUB_EMAIL_ENABLED=false`; `consumer_notification_events` and operational deliveries remain at zero for Stage 5. Stage 6 may add deliberate notification delivery after separate approval and certification.
