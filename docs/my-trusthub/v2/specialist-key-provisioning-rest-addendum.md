# PROPOSED operator addendum — project-scoped REST transport

Status: draft proposal for independent review. This page does not replace
`docs/my-trusthub/v2/specialist-key-provisioning.md` and does not extend the
certification of R2 packet SHA-256
`9990d6c656f6e43e99c392e28e9a32e18cf88a06b72b7dba4f175400dc2750c0`.
The certified script blob `40707cf236d6507a001ef73ddf054baf50ff8b6d` is unchanged.
No credential, live request, production write, or deployment is authorized here.

## Why this transport exists

The certified CLI writer always passes `--scope`. Installed Vercel CLI 62.x
resolves that scope with a user or team call, which a project-scoped token is
documented to deny. `scripts/release/mth-v2-rest-provision.mjs` calls the
certified `run(options, deps)` and injects `deps.writeEnv`. The new writer posts
one variable at a time:

`POST https://api.vercel.com/v10/projects/{projectId}/env`

The URL has no `upsert`, `teamId`, or `slug` query. There is no CLI process,
no `--scope`, and no read of `VERCEL_TOKEN` or `auth.json`.

## One credential, one project

Each process exports only `MTH_V23_PROJECT_TOKEN`. If `VERCEL_TOKEN` is also
set, the process stops with `REST_SAVED_TOKEN_PRESENT`. The token is not an
argument. A missing, empty, or non-token credential stops before
`run()` and therefore before key generation.

| Process | `--destination` | Project token may write |
| --- | --- | --- |
| 1 | `lender` | `lender-trust-hub` only |
| 2 | `investor` | `investor-trust-hub-web` only |
| 3 | `insurance` | `insurance-trust-hub` only |
| 4 | `senior` | `care-trust-hub` only |
| 5 | `contractor` | `contractor-trust-hub` only |
| 6 | `ask` | `conumers-trust-hub` only |

Move is not a destination. Specialist processes use `--placement specialist`
and exactly one `--hub` equal to that destination. The Ask process uses
`--placement ask` and the five hubs only after the five public receipts exist.
`--replace`, `--force`, and `--vercel-cli` are rejected. This transport does
not overwrite an existing name.

The wrapper also stops unless `--date` is the current UTC day and more than
five minutes remain before UTC midnight (`REST_KID_DATE_NOT_UTC_TODAY`,
`REST_MIDNIGHT_WINDOW`). The certified script's own calendar and freshness
checks still run.

## Payload and private PEM boundary

Private signing names are JSON `type: "sensitive"`. Public KID, public PEM,
and Insurance `MY_TRUSTHUB_V23_PARENT_ORIGIN` (`https://www.asktrusthub.com`)
are JSON `type: "encrypted"`. `target` is exactly `["production"]`.

The certified script passes the PKCS#8 PEM as a Buffer and zeroes that Buffer
in `finally`. `JSON.stringify` on a Buffer uses `Buffer#toJSON` and would store
a byte array. The writer decodes that Buffer once with `toString('utf8')` and
puts the resulting PEM text in the JSON `value` field. That string is not
written to disk, returned to the caller, or copied into an error. A JavaScript
string cannot be zeroed; the Buffer zeroing remains the certified cleanup.

Success requires HTTP 201, an empty `failed` array, and one `created` object
whose key, type, and target match the request. Any other response, including
401, 403, 409, 429, 5xx, a redirect, a timeout, a non-JSON body, a partial
`failed` entry, or a non-production target, throws one constant code and does
not send another request. The certified pending receipt is left pending. Do
not retry, repair the receipt, or roll back from this wrapper.

## Future command shape

Do not run these commands under this draft. They show the intended process
boundary only. Refresh the certified name-only metadata and public inventory
within five minutes of each process, in Lender, Investor, Insurance, Senior,
Contractor order, then Ask.

```powershell
$env:MTH_V23_PROJECT_TOKEN = '<lender project token>'
node scripts/release/mth-v2-rest-provision.mjs --destination lender --placement specialist --hub lender --date YYYYMMDD --metadata C:\operator\metadata.json --public-inventory C:\operator\public-inventory.json --ask-spki-sha256 EXPECTED_ASK_SHA256 --public-bundle C:\operator\lender-public.json --closed-gates-confirmed
Remove-Item Env:MTH_V23_PROJECT_TOKEN
```

Repeat with a new process and that project's token for Investor, Insurance,
Senior, and Contractor. The Ask process is separate and uses only the Ask
token plus the five `--public-bundle` receipts. Clear the token before the
next process. Offline proof:

```powershell
node --test scripts/release/mth-v2-specialist-keys.test.mjs scripts/release/mth-v2-rest-provision.test.mjs
```
