# AskTrustHub Sentry reference (ATH-REL-001A)

Error monitoring + tracing for `www.asktrusthub.com`. Do not rename the existing Sentry project.

## Identities

- Org: `ask-trust-hub` (US, `https://us.sentry.io`)
- Project slug: `javascript-nextjs` — **do not rename**
- Site: `https://www.asktrusthub.com`

## Required Vercel env vars

Set on Production (and Preview if you want preview events). Values are not stored in git.

| Name | Type | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SENTRY_DSN` | Config | Browser ingest DSN from project `javascript-nextjs` |
| `SENTRY_DSN` | Config | Server/edge ingest DSN (same value is fine) |
| `SENTRY_ORG` | Config | `ask-trust-hub` |
| `SENTRY_PROJECT` | Config | `javascript-nextjs` |
| `SENTRY_AUTH_TOKEN` | Sensitive, build-only | Source map upload. Scopes: `project:releases`, `org:read`. Never `NEXT_PUBLIC_*`. |
| `SENTRY_PROBE_ENABLED` | Config | Must be `false` except for the one production closeout POST |
| `SENTRY_PROBE_SECRET` or `ATH_OPERATOR_SECRET` | Sensitive | Bearer for the probe. >= 16 characters |

DSN/org/project are read from env only. The SDK does not hardcode them.

## SDK layout

- Client: `instrumentation-client.ts`
- Node server: `sentry.server.config.ts` via `instrumentation.ts`
- Edge / `proxy.ts`: `sentry.edge.config.ts`
- Source maps: `withSentryConfig` in `next.config.ts` (upload skipped when `SENTRY_AUTH_TOKEN` is missing so CI still builds)
- Release: `VERCEL_GIT_COMMIT_SHA`
- Environment: `lib/analytics/environment.ts` → `production` \| `preview` \| `development`

## Privacy

Aligned with `lib/analytics/privacy.ts`:

- `sendDefaultPii: false` and explicit `dataCollection` opt-outs (no user info, no HTTP bodies)
- `beforeSend` strips Ask `q`, auth headers, cookies, claim/My TrustHub bodies, notes, and non-UUID user ids
- Sentry Session Replay is **off** (no `replayIntegration`; replay worker tree-shaken)
- PostHog Replay is unchanged and separate

## Tracing

- Production `tracesSampleRate` 0.1, preview 0.25, development 1.0
- Cron, health, and `/sentry-tunnel` transactions are dropped

## Production closeout probe

After founder merge and Vercel production deploy with DSN set:

1. Set `SENTRY_PROBE_ENABLED=true` on Production only.
2. `POST https://www.asktrusthub.com/api/internal/sentry-probe` with `Authorization: Bearer <SENTRY_PROBE_SECRET or ATH_OPERATOR_SECRET>`.
3. Confirm the issue in org `ask-trust-hub` / project `javascript-nextjs`, environment `production`, release = deploy SHA, mapped stack.
4. Set `SENTRY_PROBE_ENABLED=false` immediately (or delete the route in a follow-up PR).

Unauthenticated GET/POST without the flag returns 404.

## Alerts

Create production-only issue alerts (email to org members is enough). Do not alert on preview/development.

- New issue
- Regression
- Event spike
- High-impact recurring issue
