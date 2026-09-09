# My TrustHub P20D Vercel environment manifest

Scope: Ask Trust Hub Vercel project, **Production** environment only. This file
contains no credential or founder-email value. The existing generic Supabase
variables belong to the established AskTrustHub environment and must not be
changed, copied, or repurposed for My TrustHub.

## Production runtime variables

| Variable | Stage 1 value | Classification | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | verify existing value is `https://www.asktrusthub.com`; do not replace if already exact | PUBLIC, EXISTING SHARED CONFIG | Existing AskTrustHub canonical origin, also used for the Auth callback |
| `NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL` | `https://qvvxvbcdmbjzrgvwjatw.supabase.co` | PUBLIC | Namespaced My TrustHub Consumer Supabase project URL |
| `NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_PUBLISHABLE_KEY` | `<COPY PUBLISHABLE KEY FROM CONUMERS-TRUST-HUB>` | PUBLIC | Namespaced My TrustHub browser/SSR Data API and Auth key |
| `MY_TRUSTHUB_CANARY_ONLY` | `true` | NON-SECRET SERVER CONFIG | Keeps admission closed |
| `MY_TRUSTHUB_CANARY_EMAILS` | `<SET TO APPROVED FOUNDER EMAIL OUT OF BAND>` | NON-SECRET SERVER CONFIG, PRIVATE | OTP-request allowlist; never commit the value |
| `MY_TRUSTHUB_CANARY_USER_IDS` | empty | NON-SECRET SERVER CONFIG | Optional secondary canonical-ID allowlist; not needed for the one-user canary |
| `MY_TRUSTHUB_ENABLED` | `true` | NON-SECRET SERVER CONFIG | Master Stage 1 gate |
| `MY_TRUSTHUB_SIGNUP_ENABLED` | `false` | NON-SECRET SERVER CONFIG | `shouldCreateUser` remains false; Auth Admin provisions the sole user |
| `MY_TRUSTHUB_SAVED_ENABLED` | `true` | NON-SECRET SERVER CONFIG | Enables controlled parent Save |
| `MY_TRUSTHUB_PROJECTS_ENABLED` | `true` | NON-SECRET SERVER CONFIG | Enables Project and membership mutations |
| `MY_TRUSTHUB_WATCH_ENABLED` | `false` | NON-SECRET SERVER CONFIG | Keeps Watch unavailable |
| `MY_TRUSTHUB_ALERTS_ENABLED` | `false` | NON-SECRET SERVER CONFIG | Keeps Alerts unavailable |
| `MY_TRUSTHUB_EMAIL_ENABLED` | `false` | NON-SECRET SERVER CONFIG | Keeps Alert/P0 email unavailable |
| `MY_TRUSTHUB_EXPORT_ENABLED` | `false` | NON-SECRET SERVER CONFIG | Keeps export unavailable |
| `MY_TRUSTHUB_DELETE_ENABLED` | `false` | NON-SECRET SERVER CONFIG | Keeps deletion unavailable |
| `MY_TRUSTHUB_SPECIALIST_HANDOFF_ENABLED` | `false` | NON-SECRET SERVER CONFIG | Keeps specialist writes unavailable |
| `MY_TRUSTHUB_SOURCE_MONITORING_ENABLED` | `false` | NON-SECRET SERVER CONFIG | Keeps source workers unavailable |

Supabase Auth must separately retain:

- Site URL `https://www.asktrusthub.com`
- redirect URL `https://www.asktrusthub.com/auth/callback`
- public signup disabled

## Existing AskTrustHub variables — preserve exactly

Do not edit, delete, or reuse these existing Production variables during P20D:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- all existing `ATH_*` variables

Do not add `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as a generic fallback. My
TrustHub has no fallback to any generic Supabase variable; its URL and
publishable key must both use the namespaced variables above.

## One-time local Auth Admin variables

These variables are for `scripts/create-my-trusthub-canary.mjs` in a temporary
founder PowerShell process. They are **not** Vercel runtime requirements.

| Variable | Value | Classification |
|---|---|---|
| `MY_TRUSTHUB_CANARY_EMAIL` | `<ENTER APPROVED FOUNDER EMAIL INTERACTIVELY>` | SERVER-ONLY PRIVATE INPUT |
| `MY_TRUSTHUB_SUPABASE_URL` | `https://qvvxvbcdmbjzrgvwjatw.supabase.co` | NON-SECRET SERVER CONFIG |
| `MY_TRUSTHUB_SUPABASE_SECRET_KEY` | `<SET MANUALLY IN THE CURRENT PROCESS>` | SERVER-ONLY SECRET |
| `MY_TRUSTHUB_CONFIRM_CREATE` | `CREATE_ONE_MY_TRUSTHUB_CANARY` | NON-SECRET SAFETY CONFIRMATION |
| `MY_TRUSTHUB_ALLOW_EXISTING_UNRELATED_USERS` | unset | NON-SECRET SAFETY OVERRIDE; must remain unset for P20D |

Do not add `MY_TRUSTHUB_SUPABASE_SECRET_KEY` to Vercel for Stage 1 and do not
reuse the existing `SUPABASE_SERVICE_ROLE_KEY`. The deployed application performs
no Auth Admin operation. If a legacy service-role key is used instead of a modern
`sb_secret_...` key for the one-time local script, it has the same highly
privileged, server-only handling requirement.
