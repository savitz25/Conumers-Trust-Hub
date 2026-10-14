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

The project id is not taken from operator metadata alone. The wrapper holds
this reviewed map for team `savitz25-s-projects`. Before key generation it
requires the selected destination, the pinned id, and the fresh Production
metadata (name, id, and `environment: "production"`) to be the same value.
Any other id stops the process. Move is not a destination.

| Destination | Pinned project id |
| --- | --- |
| Ask | `prj_925ZdSHjPhPU7pH9WiwyNOK1MrZB` |
| Lender | `prj_Il28Mv0ebRiIrumFO7iBX6JrSbdD` |
| Investor | `prj_Qu2DT0AIy8R7XYTQiHgNcDYjE9i8` |
| Insurance | `prj_ARBlfWYNhpJWBtaPO4vUJlraa5BK` |
| Senior | `prj_k9GyyXn28JZkyYKqLhBJ4rUQcpUb` |
| Contractor | `prj_OYmhfgBxZvRAKBPJv5zqshJnJwgq` |

Forbidden Move write destination: `prj_gudPGeW9SZBkgiL8zxvi3Swfo6T0`.

An eventual authorized execution must read project identity again through the
approved connection and compare it with this map before any key generation.
This draft does not perform that live read and does not call Vercel. The
certified five-minute freshness check still applies to the metadata and the
public inventory supplied at execution time.

| Process | `--destination` | Project token may write |
| --- | --- | --- |
| 1 | `lender` | `lender-trust-hub` only |
| 2 | `investor` | `investor-trust-hub-web` only |
| 3 | `insurance` | `insurance-trust-hub` only |
| 4 | `senior` | `care-trust-hub` only |
| 5 | `contractor` | `contractor-trust-hub` only |
| 6 | `ask` | `conumers-trust-hub` only |

Move is not a destination. Specialist processes use `--placement specialist`
and exactly one `--hub` equal to that destination, plus one public-bundle
file. `--replace`, `--force`, and `--vercel-cli` are rejected. This transport
does not overwrite an existing name.

## Ask requires all five hubs

The Ask process is valid only when `--destination ask`, `--placement ask`, and
the hubs are exactly this order:

`lender`, `investor`, `insurance`, `senior`, `contractor`

It also requires exactly five `--public-bundle` files in that same order.
File 1 is Lender, file 2 is Investor, file 3 is Insurance, file 4 is Senior,
and file 5 is Contractor. Each file must be one public receipt for that hub
only: version 1, scope `savitz25-s-projects`, state `specialists-written`,
the expected Ask fingerprint, and one `kid` plus `publicKeyPem`.

A single hub, a missing file, a duplicate hub or bundle, a reversed list, or
a file associated with a different hub stops the process before the first
REST write and before any key generation. The Ask process generates zero
keys. When the checks pass it writes exactly ten public records on Ask: each
hub's `KEY_ID` and `VERIFY_PUBLIC_KEY_PEM`.

That precheck does not replace the certified script. `run()` still verifies
each bundle, compares it with the installed specialist public key, and
requires the specialist placement records before `writeEnv`.

The wrapper stops unless `--date` is the current UTC day and more than five
minutes remain before UTC midnight (`REST_KID_DATE_NOT_UTC_TODAY`,
`REST_MIDNIGHT_WINDOW`). It repeats both checks immediately before every REST
POST. Production reads `Date.now()` again for each POST. An injected clock is
only for offline tests and must not be reused from the start of the process.

Before every POST, the wrapper also checks the metadata `capturedAt` and the
public-inventory `capturedAt` on the same snapshots `run()` reads. Each
timestamp must parse, must not be in the future, and must be no older than
five minutes (`STALE_OR_INVALID_CONNECTOR_SNAPSHOT`). If any check fails, that
POST is not sent, later POSTs are not sent, and there is no retry. A
specialist receipt stays pending. The certified script's own calendar and
freshness checks still run.

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

Success requires HTTP 201, an empty `failed` array, and a `created` value
that is either one object or a one-element array of one object. That entry
must match the requested key and type, and `target` must be exactly
`["production"]`. `gitBranch` must be absent or null. `customEnvironmentIds`
must be absent, null, or an empty array. Any other response, including a
malformed array, more than one created record, a nonempty `failed` array, a
mismatched key or type, a git branch, a custom environment, HTTP 401, 403,
409, 429, 5xx, a redirect, a timeout, or a non-JSON body, throws one constant
code and does not send another request. There is no upsert and no second POST
for the same variable. The UTC-day, midnight, metadata-freshness, and
inventory-freshness checks run again before every later POST. The certified
pending receipt is left pending. Do not retry, repair the receipt, or roll
back from this wrapper.

## Errors that may be printed

The process prints an error only when its message is one exact member of a
finite allowlist of internal codes. Every other thrown message, including an
uppercase string, a token, or a private key, is printed as
`PROVISIONING_FAILED`. A file that cannot be read becomes
`INPUT_FILE_INVALID` and the original message is discarded. A failed fetch
becomes only `REST_NETWORK`, `REST_REDIRECT`, or `REST_TIMEOUT`. The foreign
message is not rethrown.

## Future command shape

Do not run these commands under this draft. They show the intended process
boundary only. Refresh the certified name-only metadata and public inventory
within five minutes of each process, and confirm the live project id still
equals the pinned id above, in Lender, Investor, Insurance, Senior,
Contractor order, then Ask.

```powershell
$env:MTH_V23_PROJECT_TOKEN = '<lender project token>'
node scripts/release/mth-v2-rest-provision.mjs --destination lender --placement specialist --hub lender --date YYYYMMDD --metadata C:\operator\metadata.json --public-inventory C:\operator\public-inventory.json --ask-spki-sha256 EXPECTED_ASK_SHA256 --public-bundle C:\operator\lender-public.json --closed-gates-confirmed
Remove-Item Env:MTH_V23_PROJECT_TOKEN
```

Repeat with a new process and that project's token for Investor, Insurance,
Senior, and Contractor. The Ask process is a sixth process. It uses only the
Ask token, all five hubs in the order above, and the five public-bundle files
in that same order. Clear the token before the next process.

```powershell
$env:MTH_V23_PROJECT_TOKEN = '<ask project token>'
node scripts/release/mth-v2-rest-provision.mjs --destination ask --placement ask --hub lender --hub investor --hub insurance --hub senior --hub contractor --date YYYYMMDD --metadata C:\operator\metadata.json --public-inventory C:\operator\public-inventory.json --ask-spki-sha256 EXPECTED_ASK_SHA256 --public-bundle C:\operator\lender-public.json --public-bundle C:\operator\investor-public.json --public-bundle C:\operator\insurance-public.json --public-bundle C:\operator\senior-public.json --public-bundle C:\operator\contractor-public.json --closed-gates-confirmed
Remove-Item Env:MTH_V23_PROJECT_TOKEN
```

Offline proof:

```powershell
node --test scripts/release/mth-v2-specialist-keys.test.mjs scripts/release/mth-v2-rest-provision.test.mjs
```
