# Research Services inquiries

Sample requests from `/research-services` are saved in the Ask customer Postgres database, then a separate notification is sent to `hello@asktrusthub.com`. The visitor sees a receipt only after the row commits. A failed notification does not remove the row and is not described as a failed request.

The public page keeps the mailto link. Until migration `020_ath_research_service_inquiries.sql` is present and `ATH_HANDOFF_SECRET` is set, the page keeps preparing that email instead of showing a save button.

The public offer is the free three-vendor identity and license-status screen. The independence statement and finding definitions are unchanged. The fictional sample report is linked from the page and is not indexed.

## Configuration

Use the existing Ask customer database and Resend account. Do not add a new database or email vendor.

| Name | Required | Purpose |
| --- | --- | --- |
| `neon_tech_database` or `ASK_DATABASE_URL` | Yes, to save | Existing Ask-owned Neon Postgres URL. Do not use a specialist database URL. |
| `ATH_HANDOFF_SECRET` | Yes, to save | Existing server secret. Used only as an HMAC pepper for rate-limit keys. It is not sent to the browser. |
| `RESEND_API_KEY` | Only to notify | Existing Resend key. Inquiries still save when it is absent. Notification status becomes `failed` with `unconfigured`. |
| `ASK_AUTH_FROM_EMAIL` or `AUTH_FROM_EMAIL` | No | From address. Default remains `Ask Trust Hub <hello@asktrusthub.com>`. |

`RESEARCH_SERVICES_MAIL_TRANSPORT=test` records a successful test transport on non-production runtimes and does not call Resend. Production ignores it. `RESEARCH_SERVICES_INQUIRY_UI=server` only changes the local development form. It does nothing when `VERCEL` or `VERCEL_ENV` is set.

No inquiry field is sent to product analytics.

## Migration

Leave `scripts/ath-cust-002-migrate.ts` and `npm run migrate:ath-cust-002` unused for migration 020. That command replays every customer migration and splits each file into separate statements. Migration 020 has to be one SQL body in one transaction on the Neon direct connection.

The unapplied plan is `docs/research-services-020-single-migration-plan.md`. Build, test, and deploy do not run that plan.

The migration enables and forces row level security, allows only `ath.app_role = server`, and revokes the table from `PUBLIC`, `anon`, and `authenticated`. There is no browser read policy and no public list API.

## Operator retrieval and notification retry

There is no admin screen. From the repository, with the database URL in the environment:

```powershell
$env:RESEARCH_SERVICES_OPERATOR = '1'
node --experimental-strip-types scripts/research-services-inquiries.ts list
node --experimental-strip-types scripts/research-services-inquiries.ts list --status=failed
node --experimental-strip-types scripts/research-services-inquiries.ts retry
node --experimental-strip-types scripts/research-services-inquiries.ts retry --send
```

`list` prints inquiry fields to the terminal. Treat that output as personal information.

`retry` without `--send` lists failed notifications and notifications that have been pending or sending for at least two minutes. It does not send email.

`retry --send` claims each due row, sends one notice to `hello@asktrusthub.com`, and stores `sent` or `failed`. It does not email the visitor. The command always prints `inboxDeliveryVerified: false`. A `sent` status means Resend accepted the message or the test transport recorded it. It does not prove the inbox received it.

The same script refuses to run unless `RESEARCH_SERVICES_OPERATOR=1`.

## Rollback

The default rollback is an application reversal to the previous production deployment. It keeps `ath_research_service_inquiries` and its rows. `schema/migrations/020_ath_research_service_inquiries.down.sql` drops the table. Leave that file unused unless a separate approval follows an operator export. The procedure is in `docs/research-services-020-single-migration-plan.md`.
