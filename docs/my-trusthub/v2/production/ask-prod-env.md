# Ask production environment packet (Vercel project `conumers-trust-hub`, Production scope)

No values are recorded here. Secrets are written by `scripts/release/mth-v2-prod-secrets.mjs`
or typed once by the operator. Nothing from the preview branch is reused.

| Name | Value | Notes |
| --- | --- | --- |
| `MY_TRUSTHUB_V23_PRODUCTION_HANDOFF_ENABLED` | `true` | canary ON/OFF switch (set `false` to roll back; no rebuild needed) |
| `MY_TRUSTHUB_V23_PROFILE_SAVE_ENABLED` | `true` | |
| `MY_TRUSTHUB_ENABLED` | `true` | already required for /my in production |
| `MY_TRUSTHUB_SAVED_ENABLED` | `true` | |
| `MY_TRUSTHUB_SPECIALIST_HANDOFF_ENABLED` | `true` | |
| `MY_TRUSTHUB_V23_PRODUCTION_PROJECT` | `qvvxvbcdmbjzrgvwjatw` | exact pin |
| `MY_TRUSTHUB_V23_PARENT_ORIGIN` | `https://www.asktrusthub.com` | exact pin |
| `MY_TRUSTHUB_V23_MOVE_ORIGIN` | `https://www.movetrusthub.com` | exact pin |
| `MY_TRUSTHUB_V23_SESSION_AFFINITY` | `dedicated` | |
| `MY_TRUSTHUB_V23_DATABASE_CONNECTION_MODE` | `SUPAVISOR_SESSION` | |
| `MY_TRUSTHUB_V23_SUPAVISOR_SESSION_HOST` | the project's session pooler host, e.g. `aws-0-<region>.pooler.supabase.com` | from the Supabase connect dialog, session mode |
| `MY_TRUSTHUB_V23_PARENT_DATABASE_URL` | `postgresql://myth_v23_parent_prod.qvvxvbcdmbjzrgvwjatw:<password>@<session host>:5432/postgres` | secret; password from step 2.4 |
| `MY_TRUSTHUB_V23_DATABASE_CA_PEM` | Supabase CA certificate PEM | secret |
| `MY_TRUSTHUB_V23_ASK_KEY_ID` | `ask-v23-prod-<date>` | written by the script |
| `MY_TRUSTHUB_V23_ASK_SIGNING_PRIVATE_KEY_PEM` | ed25519 private PEM | secret, written by the script |
| `MY_TRUSTHUB_V23_MOVE_KEY_ID` | `move-v23-prod-<date>` | written by the script |
| `MY_TRUSTHUB_V23_MOVE_VERIFY_PUBLIC_KEY_PEM` | ed25519 public PEM | written by the script |
| `NEXT_PUBLIC_SITE_URL` | `https://www.asktrusthub.com` | must already be set |
| `NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL` | `https://qvvxvbcdmbjzrgvwjatw.supabase.co` | must already be set |
| `NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_PUBLISHABLE_KEY` | production publishable/anon key | must already be set |

Must NOT be set in production: `MY_TRUSTHUB_V23_ISOLATED_PROJECT`,
`MY_TRUSTHUB_NONPRODUCTION_APPROVED`, `MY_TRUSTHUB_V23_MOVE_PROTECTION_BYPASS`,
`MY_TRUSTHUB_PREVIEW_ACCOUNT_ACCESS`, `MY_TRUSTHUB_TEST_*`. The code refuses the
production target if the first two are present.

Admission: production `/my` keeps its existing account policy
(`MY_TRUSTHUB_ACCESS_MODE` and canary/invitation lists). The Journey QA account
must already be admitted there.
