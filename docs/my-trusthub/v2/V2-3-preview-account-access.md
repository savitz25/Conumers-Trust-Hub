# V2-3 preview account access — Ask preview only

Password sign-in for Auth users who already exist on the isolated Supabase
project. This does not enable public signup, anonymous sign-in, email/OTP
delivery, or the My TrustHub workspace master gate. Do not set these on
Production, Development, or any preview branch other than
`mth-v2-3-parent-runtime`. Do not merge this into `main` from this note.

`MY_TRUSTHUB_PREVIEW_ACCOUNT_ACCESS` is ignored when `VERCEL_ENV` is
`production` or unset. Signup, email-link, recovery, and `/auth/callback`
still require `MY_TRUSTHUB_ENABLED`. Leave that master flag false so Saved,
Projects, Watch, alerts, export, and delete stay closed. CAPTCHA is unchanged:
the sign-in button stays disabled until the existing Turnstile site key is
present, and the server still rejects a missing token.

Set these on the Ask project, Preview environment, Git branch
`mth-v2-3-parent-runtime`, then rebuild. `NEXT_PUBLIC_*` values are bundled
at build time.

| Name | Value |
| --- | --- |
| `MY_TRUSTHUB_PREVIEW_ACCOUNT_ACCESS` | `true` |
| `MY_TRUSTHUB_ENABLED` | `false` |
| `MY_TRUSTHUB_SIGNUP_ENABLED` | `false` |
| `MY_TRUSTHUB_EMAIL_ENABLED` | `false` |
| `MY_TRUSTHUB_ACCESS_MODE` | `invitation` |
| `MY_TRUSTHUB_INVITED_USER_IDS` | Existing Auth user A and B UUIDs, comma-separated. Do not create users. |
| `MY_TRUSTHUB_NONPRODUCTION_APPROVED` | `true` |
| `NEXT_PUBLIC_SITE_URL` | Exact Ask preview origin Journey QA opens, including `https://` |
| `MY_TRUSTHUB_TEST_ORIGIN` | Same origin as `NEXT_PUBLIC_SITE_URL` |
| `NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL` | `https://xkkiicsassizmakcvxml.supabase.co` |
| `MY_TRUSTHUB_TEST_SUPABASE_URL` | `https://xkkiicsassizmakcvxml.supabase.co` |
| `NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_PUBLISHABLE_KEY` | Publishable key for that isolated project only |
| `NEXT_PUBLIC_MY_TRUSTHUB_TURNSTILE_SITE_KEY` | Existing Turnstile site key. Do not remove it to skip the check. |

Leave anonymous sign-in off in the Supabase project. Do not set a service-role
key, SMTP, or Resend variable for this check. `MY_TRUSTHUB_ACCESS_MODE=public`
does not admit users while the master flag is false.

After the rebuild, `/my/sign-in` shows email and password fields. `/my/create-account`
stays unavailable. A confirmed invited user can sign in; an uninvited or
unconfirmed user cannot. Removing `MY_TRUSTHUB_PREVIEW_ACCOUNT_ACCESS` and
rebuilding restores the unavailable sign-in state.
