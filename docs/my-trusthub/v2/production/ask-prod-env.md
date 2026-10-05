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

## Insurance provider Save (operator, not set by this deploy)

Parent sync stays `OFF` and the canary stays `OFF`. Do not write these values
until the packet 13 preflight is clean and the forward packet has been applied
by the operator. No key material belongs in this file.

Insurance project (`insurance-trust-hub`, Production scope):

| Name | Notes |
| --- | --- |
| `MY_TRUSTHUB_V23_INSURANCE_KEY_ID` | dedicated Insurance key id, shared with Ask |
| `MY_TRUSTHUB_V23_INSURANCE_SIGNING_PRIVATE_KEY_PEM` | ed25519 private PEM. Secret. Insurance only |
| `MY_TRUSTHUB_V23_ASK_KEY_ID` | Ask key id, for callback verification |
| `MY_TRUSTHUB_V23_ASK_VERIFY_PUBLIC_KEY_PEM` | Ask ed25519 public PEM |
| `MY_TRUSTHUB_V23_PARENT_ORIGIN` | `https://www.asktrusthub.com` |

Ask project (`conumers-trust-hub`, Production scope):

| Name | Notes |
| --- | --- |
| `MY_TRUSTHUB_V23_INSURANCE_KEY_ID` | the same Insurance key id |
| `MY_TRUSTHUB_V23_INSURANCE_VERIFY_PUBLIC_KEY_PEM` | Insurance ed25519 public PEM |

The issuer is `urn:trusthub:v23:insurance:<service>`. It has no project id.
A missing Insurance verify key leaves Move and Lender running and rejects
Insurance handoffs. This deploy does not set either secret.

Must NOT be set in production: `MY_TRUSTHUB_V23_ISOLATED_PROJECT`,
`MY_TRUSTHUB_NONPRODUCTION_APPROVED`, `MY_TRUSTHUB_V23_MOVE_PROTECTION_BYPASS`,
`MY_TRUSTHUB_PREVIEW_ACCOUNT_ACCESS`, `MY_TRUSTHUB_TEST_*`. The code refuses the
production target if the first two are present.

Admission: production `/my` keeps its existing account policy
(`MY_TRUSTHUB_ACCESS_MODE` and canary/invitation lists). The Journey QA account
must already be admitted there.

## Investor official-firm Save (prepared, OFF)

Names only. No key material exists and none belongs in this file. Nothing here
is set by the deploy, and Ask refuses every Investor handoff until all of it is
in place and packet 14 has been applied by the operator.

Investor project (`investor-trust-hub-web`, Production scope):

| Name | Notes |
| --- | --- |
| `MY_TRUSTHUB_V23_INVESTOR_KEY_ID` | dedicated Investor key id, shared with Ask |
| `MY_TRUSTHUB_V23_INVESTOR_SIGNING_PRIVATE_KEY_PEM` | ed25519 private PEM. Secret. Investor only |
| `MY_TRUSTHUB_V23_ASK_KEY_ID` | Ask key id, for source-channel verification |
| `MY_TRUSTHUB_V23_ASK_VERIFY_PUBLIC_KEY_PEM` | Ask ed25519 public PEM |
| `MY_TRUSTHUB_V23_PARENT_ORIGIN` | `https://www.asktrusthub.com` |
| `NEXT_PUBLIC_INVESTOR_PARENT_SAVE_ENABLED` | `1` to enable (release gate, Investor side) |
| `MTH_INVESTOR_PARENT_SAVE_MODE` | `production` |
| `NEXT_PUBLIC_INVESTOR_PARENT_SAVE_CANARY_SLUGS` | `sec-crd-106176,sec-crd-104571,sec-crd-110441` for the canary |

Ask project (`conumers-trust-hub`, Production scope):

| Name | Notes |
| --- | --- |
| `MY_TRUSTHUB_V23_INVESTOR_KEY_ID` | the same Investor key id |
| `MY_TRUSTHUB_V23_INVESTOR_VERIFY_PUBLIC_KEY_PEM` | Investor ed25519 public PEM |

The issuer is `urn:trusthub:v23:qvvxvbcdmbjzrgvwjatw:investor` and the claim
set carries `investor_origin` (never `move_origin` or `lender_origin`). The
Investor verify key must be its own ed25519 key: a key equal to the Ask, Move,
Lender or Insurance key is ignored. A missing Investor verify key leaves every
other hub running and rejects Investor handoffs.
