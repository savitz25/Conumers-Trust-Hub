# ATH-PR287 Turnstile browser fixture

The fixture mounts the production `TurnstileField` in the My TrustHub sign-in layout at `/my/qa/turnstile`. It is available only from `next dev` with `ATH_TURNSTILE_QA_FIXTURE=true`. The form reports a local mock-auth result and has no server action, Supabase client, email behavior, or account creation path.

It uses Cloudflare's official visible, forced-interaction test sitekey `3x00000000000000000000FF`. The real-widget pass measures the rendered Cloudflare iframe at 320, 360, 390, 406, 407, 768, and 1440 CSS pixels. A second pass installs a deterministic in-browser Turnstile API mock before the component loads so resize replacement, stale callback delivery, error/expiry callbacks, retry token clearing, and keyboard focus can be exercised without sending auth requests. The mock also verifies that the component passes the official test sitekey and retains the 406px compact/flexible boundary.

## Run locally

Start the development server with the fixture route enabled:

```powershell
$env:ATH_TURNSTILE_QA_FIXTURE = 'true'
npm run dev -- --hostname 127.0.0.1 --port 3107
```

In another terminal, run the browser checks. Chrome Stable is used by default; set `CHROME_PATH` to another local Chromium executable if needed.

```powershell
npm run qa:ath-pr287-turnstile-browser
```

The runner requires Node 22+ (built-in WebSocket and fetch) and a locally installed Chrome/Chromium. It starts an isolated headless browser profile, uses only localhost plus Cloudflare's official public test widget, prints bounded geometry and interaction results, then removes its temporary browser profile. It does not submit credentials or send authentication requests.

The normal `npm run check:my-trusthub-v2-2` test remains independent of browser availability. The Cloudflare test sitekey is for this QA fixture only; application server-side Turnstile verification and production keys are untouched.
