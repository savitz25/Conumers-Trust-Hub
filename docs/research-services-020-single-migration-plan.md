# Single-migration 020 plan

ASK-285-BODY-SIZE-DRAFT-001. This plan is not a migration. It was not applied. No database connection was opened, and no production environment or DNS record was changed.

## Audit

The inquiry handler in `lib/research-services/http.ts` still rejects a request body over 8,000 UTF-8 bytes with HTTP 413 before it decodes or stores the JSON. A valid inquiry at the field limits stays under that cap. The largest checked example is 1,000 control characters in the message plus the maximum control-character name and organization, which encodes to 7,416 bytes. That gate is unchanged.

The path that blocks a single migration 020 is `scripts/ath-cust-002-migrate.ts`. It calls `applyCustomerMigrations`, which reads every `schema/migrations/*.sql` file except the down files and, when the client has no `exec`, splits each file on semicolons. Migration 020 becomes seven statements. Each statement autocommits. The file has to move as one simple-query body so PostgreSQL keeps those seven statements in one transaction.

`pg` uses the extended protocol when a query carries bind parameters, and that protocol accepts one statement. The 020 body has no bind parameters. The runner sends it with `client.query(text)` and no parameter list.

## Certified file

| Item | Value |
| --- | --- |
| File | `schema/migrations/020_ath_research_service_inquiries.sql` |
| Git blob | `f2d19053e76cb623d355897e05dfa5ef724f01a0` |
| SHA-256 of the LF bytes | `1fb96942b48049581cc07e6596c04709c78ad376dbba0a369accd532cf60b1c4` |
| LF size | 4544 bytes |
| Down file | `schema/migrations/020_ath_research_service_inquiries.down.sql` |

A Windows checkout may store CRLF. The runner normalizes to LF and refuses the file when the hash or the 4544-byte length differs. This draft does not edit the SQL.

## Already present

On 2026-11-04 the table `ath_research_service_inquiries` was already present on the Ask Neon database `neondb` (project `hidden-glitter-26313488`, branch `br-square-frog-aeqbig90`, direct host fingerprint `474840f085743b03`, port 5432). RLS was on and forced. The updated-at trigger, `ath_server_all` policy, fingerprint index, and notification index were present. `PUBLIC`, `anon`, and `authenticated` had no grants. One row was present. This draft did not reconnect and did not count that row again.

If a later read-only verify reports the schema complete, stop. The runner's `apply` and `rehearse` modes also leave a complete schema unchanged.

## Later founder procedure

Use the Neon direct connection. A host containing `pooler` is refused. Set `ATH_020_TARGET_URL` for that shell only. Do not add it to the Vercel project. The script refuses to start when `VERCEL` or `VERCEL_ENV` is set, and it does not read `.env.local`.

```powershell
$env:ATH_020_TARGET_URL = '<neon-direct-url>'
node --experimental-strip-types scripts/research-services-020-apply.ts verify
node --experimental-strip-types scripts/research-services-020-apply.ts rehearse
node --experimental-strip-types scripts/research-services-020-apply.ts apply --confirm=APPLY-020-1fb96942b480
```

`verify` is read-only. Exit 0 means the schema is complete, exit 3 means it is absent, and exit 4 means it is partial. A partial schema is not repaired by this script.

`rehearse` sends the body only when the schema is absent, then rolls back. `apply` commits only in that same absent case, after the post-body read matches the expected schema. Both use `SET LOCAL lock_timeout = '3s'` and `SET LOCAL statement_timeout = '60s'`.

Leave `scripts/ath-cust-002-migrate.ts` and `npm run migrate:ath-cust-002` unused for this file. Leave `020_ath_research_service_inquiries.down.sql` unused. The default rollback remains an application reversal to `5707d3817d72bf83a39d1dc9338eeca4348e7f21` (deployment 7423153851) while keeping the table and its rows. Dropping the table needs a separate approval after an operator export.

These commands were not run for this draft.
