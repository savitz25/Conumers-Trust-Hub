# My TrustHub Stage 6

Status: **closed**. Private transactional email delivery is live for existing My TrustHub Alerts. Email is a downstream effect of an Alert and can never create one.

## Preferences and policy

The existing P17 preference tables and functions are used. Defaults remain P0 immediate email enabled, P1 digest enabled, P2 digest disabled, Watch summary enabled, UTC fallback, and 08:00 local digest time. `/my/you` exposes plain-language controls for urgent alerts, important digest, lower-priority digest, summaries, timezone, and digest time. Per-Watch email overrides inherit global settings, can tighten a severity, and can be removed to restore inheritance. Preferences never stop polling, Watches, or in-app Alerts.

P0 sends immediately after eligibility. P1 is batched into due local-time digests. P2 remains off by default and is digest-only when explicitly enabled. Digest evaluation runs hourly through `/api/cron/my-trusthub-notifications` (`7 * * * *`). The worker claims only pending, active, eligible deliveries and records one ledger row per Alert/channel/policy/window.

## Provider and ledger

The existing Resend integration is used with the Ask Trust Hub sender identity. A dedicated server-only `myth_notification_delivery` runtime credential and `MY_TRUSTHUB_P17_DATABASE_URL` are configured. The role can call only notification enqueue, payload, batching, result, and canary functions; no browser or raw consumer-table access is granted. Resend API keys never enter client bundles or logs.

Delivery attempts are bounded at five with existing exponential delays (1 minute, 5 minutes, 30 minutes, 2 hours, 8 hours). Temporary failures, timeouts, 429s, and 5xx responses retry; invalid destinations and permanent failures terminate. Provider outages leave Alerts and Watches intact and retain retryable delivery state.

## Certification

The real DBPR Watch remained unchanged: zero material events, zero Alerts, and zero consumer delivery rows. A rollback-only exact-v2 P0 fixture passed enqueue idempotency and governed mock delivery without leaving production rows. P17 static foundation checks passed. The production notification worker ran successfully with no pending deliveries.

A single clearly labeled transport canary was sent through the real Resend worker path to `hello@asktrusthub.com`: “My TrustHub internal notification delivery test”. Resend accepted it and returned a provider message identifier. It is stored separately as `test/canary`; it did not create an Alert or delivery row and did not change Watch state.

The email kill switch was exercised off and restored on. With email disabled, in-app Alerts and source polling remain available while outbound delivery is skipped. Master UI remains independently controlled; no consumer data is deleted or mutated by either switch.

Email links contain no session token, JWT, private payload, or raw source data. They return to private My TrustHub settings/Alert surfaces. Stage 7 may add richer delivery history and deliberate notification channels after separate certification.
