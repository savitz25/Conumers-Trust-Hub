# AskTrustHub PostHog reference (ATH-OBS-001)

Reusable observability contract for later specialist-hub rollout. Do not copy this ticket into other repos until this Ask implementation is production-verified.

## Required environment variables

- `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`
- `NEXT_PUBLIC_POSTHOG_HOST`

No personal API key or service-account secret is required for browser analytics. Never commit token values.

## Initialization

- Client-only `posthog-js` via `lib/analytics/posthog-browser.ts`.
- Mounted once from `components/analytics/posthog-root.tsx` in the App Router root layout.
- `capture_pageview` is off. Sanitized `$pageview` is captured on pathname change.
- Init only when `NEXT_PUBLIC_VERCEL_ENV` / `VERCEL_ENV` is `production` and both env vars are present.
- Localhost, Playwright `navigator.webdriver`, preview, and development do not initialize.

## Event helper

Use `captureTrustEvent` from `lib/analytics/trusthub.ts`. Do not scatter raw `posthog.capture()` calls.

Common properties, sent only when known:

- `hub`: always `"ask"` on this implementation
- `environment`: `"production"` | `"preview"` | `"development"`
- `surface`
- `authenticated`
- `specialist_hub`
- `state`
- `capability`
- `result_count`
- `capability_state`
- `success`

## Identity policy

- Anonymous until an authenticated opaque UUID is read from `/api/analytics/identity`.
- Distinct id is a UUID only. Email, name, phone, NMLS, USDOT, CCN, CRD are rejected.
- `identify()` / `reset()` are no-ops when analytics is disabled.

## Privacy policy

- Raw Ask `q` / question text is never an event property.
- Forbidden keys are listed in `lib/analytics/privacy.ts`.
- Pageview URLs strip `q`, `code`, `token`, `email`, and similar keys.
- `/ask` and `/search` pageview titles are replaced with `Ask Trust Hub` so document titles that include `q` never reach PostHog.

## Session Replay

Enabled only with production init:

- `maskAllInputs: true`
- password and email input masking
- `maskTextSelector`: `input, textarea, [contenteditable], [data-ph-mask], .myth-form, .myth-auth-card`

## Event names

`search_submitted`, `search_results_returned`, `search_result_opened`, `specialist_handoff_started`, `profile_saved`, `account_signup_started`, `project_created`, `claim_started`.

Do not invent events for flows that do not exist.

## Specialist rollout

Copy this helper, env names, privacy module, and production gate. Change only `hub`. Do not begin that rollout from this ticket.
