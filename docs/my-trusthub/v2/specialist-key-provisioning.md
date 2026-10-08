# Specialist signing-key provisioning (Lane A)

Status: preparation only, pending independent review and separate execution authorization.
This document does not authorize provisioning, deployment, rotation or activation.
No provisioning keys or live environment values were created to prepare it. Tests use
throwaway in-memory keys and a mocked CLI. Ask SQL/authority is closed; never rerun
packets or reopen PR #262. Do not run or edit `scripts/release/mth-v2-prod-secrets.mjs`.

## Targets and placement

Team scope: `savitz25-s-projects`. Environment: **Production only**.
Rollout order: Move (done), Lender, Investor, Insurance, Senior, Contractor.

| Hub | Specialist project | Prefix |
| --- | --- | --- |
| lender | lender-trust-hub | MY_TRUSTHUB_V23_LENDER |
| investor | investor-trust-hub-web | MY_TRUSTHUB_V23_INVESTOR |
| insurance | insurance-trust-hub | MY_TRUSTHUB_V23_INSURANCE |
| senior | care-trust-hub | MY_TRUSTHUB_V23_SENIOR |
| contractor | contractor-trust-hub | MY_TRUSTHUB_V23_CONTRACTOR |

For each prefix, the specialist receives `_KEY_ID` and
`_SIGNING_PRIVATE_KEY_PEM` (sensitive); Ask project `conumers-trust-hub` receives
`_KEY_ID` and `_VERIFY_PUBLIC_KEY_PEM`. The public specialist key is not installed
on its specialist. Each specialist also receives the **existing**
`MY_TRUSTHUB_V23_ASK_KEY_ID` and `MY_TRUSTHUB_V23_ASK_VERIFY_PUBLIC_KEY_PEM`.
Existing matching Ask public copies are verified and left untouched; absent copies
can be added. A conflicting copy stops execution. Insurance additionally receives
`MY_TRUSTHUB_V23_PARENT_ORIGIN=https://www.asktrusthub.com`.

Ask's own keys, Move's keys, the session MAC and gates are never write targets.
No Ask private key is needed or read. KIDs are `<hub>-v23-prod-YYYYMMDD`, with a
real calendar date, and must be distinct across all seven hubs and staged keys.
Fresh specialist public DER SPKI SHA-256 fingerprints must differ from Ask, Move,
every installed/staged specialist and all peers in this invocation.

## Prerequisites for a future authorized execution

1. Independent review of the exact commit; separate authorization naming hubs,
   placements, any replacements and later deployment sequence. Keep gates closed.
2. Node 22 or later and a reviewed Vercel CLI installation. CLI help was checked
   with version 62.7.0. Supply the absolute `vercel/dist/index.js` entry point to
   `--vercel-cli`. The script runs it with Node, without a shell. Do not use a
   `.cmd` wrapper. Authenticate through the approved narrowly scoped operator
   workflow; do not use the invalid `VERCEL_RO_TOKEN`, revoked
   `SUPABASE_ACCESS_TOKEN`, or request a broad token.
3. Use the approved Vercel connector for **all production reads**. Resolve all
   seven exact project names to IDs and confirm the team. No CLI `env pull`,
   `env ls`, decrypt call, bulk value export, environment dump or private-key read.
4. Obtain the existing Ask KID and public verification PEM from an approved public
   source (for example Move's non-sensitive Ask verification variables or a trusted
   operator public file). Obtain a separately trusted Ask DER SPKI SHA-256 pin.
   Do not derive the expected pin solely from the same unverified input file.
   Obtain Move's public KID/key and all specialist public keys, including retained
   public receipts for specialist keys staged before Ask placement.
5. Build the two public/name-only JSON inputs below outside the repository. The
   snapshots must be at most five minutes old at the start of writes. A connector
   adapter must filter target `production`, reject custom-environment ambiguity,
   and omit **all** value fields from metadata. Do not put raw connector responses
   containing values in logs. A missing public observation is a blocker, never an
   instruction to decrypt a signing key.
6. Serialize operations: no other operator changes these slots during provisioning.
   The snapshots and `complete` flag are operator attestations, not authentication
   performed by this script. Preserve the source receipts and independent pin for
   review. CLI failure or any guard failure means STOP; do not automatically retry.

The script has no connector credentials or network read path. `--verify-names`
checks a fresh connector-exported snapshot offline; it does not claim to fetch
live metadata or prove key values, deployment state or signing behavior.

### Metadata input

Use the approved connector's project-env metadata/filter operation backed by
`GET /v10/projects/{idOrName}/env` with `decrypt=false` and the approved team ID.
For the selected production records retain only `key` and `type`. Use project
metadata from that same approved connector to confirm each name/ID mapping.
Never enable decryption, even for verification. Public values required for the
separate inventory come only from specifically approved **public** sources.

Example shape (placeholders are deliberately not executable inputs):

```json
{
  "source": "approved-vercel-connector",
  "scope": "savitz25-s-projects",
  "decrypted": false,
  "capturedAt": "<fresh ISO UTC observation time>",
  "projects": {
    "ask": {"name":"conumers-trust-hub","id":"<confirmed project ID>","environment":"production","env":[]},
    "move": {"name":"move-trust-hub","id":"<confirmed project ID>","environment":"production","env":[]},
    "lender": {"name":"lender-trust-hub","id":"<confirmed project ID>","environment":"production","env":[]},
    "investor": {"name":"investor-trust-hub-web","id":"<confirmed project ID>","environment":"production","env":[]},
    "insurance": {"name":"insurance-trust-hub","id":"<confirmed project ID>","environment":"production","env":[]},
    "senior": {"name":"care-trust-hub","id":"<confirmed project ID>","environment":"production","env":[]},
    "contractor": {"name":"contractor-trust-hub","id":"<confirmed project ID>","environment":"production","env":[]}
  }
}
```

Populate every project's entire production name list, for example
`{"key":"MY_TRUSTHUB_V23_LENDER_SIGNING_PRIVATE_KEY_PEM","type":"secret"}`.
Empty arrays mean the connector actually observed no production variables, not
"not checked". The script accepts Vercel metadata types `secret`, `sensitive`,
`encrypted`, `plain`, `config`, `system`; signing keys must be `secret`/`sensitive`.
No `value` property is accepted. Verify types against the connector response.

Inventory names may be any case Vercel already stores. Valid characters are
letters, digits, and `_`, at most 256 characters, and the name must start with
a letter or underscore (`^[A-Za-z_][A-Za-z0-9_]{0,255}$`; Vercel
`env_key_invalid_characters` / `env_key_invalid_length` and the CLI env-name
schema). A complete list includes pre-existing names such as
`neon_tech_database` and `ImprovMX_API`; do not omit a real production name.
A name that case-folds onto a controlled spelling must be that exact uppercase
spelling, or the script rejects it with `NAME_ONLY_METADATA_REQUIRED`. Exact
uppercase controls remain valid metadata. Controlled spellings are
`MY_TRUSTHUB_*` (every V23 target, gate, KID, verify key, and Ask/Move
protected name), parent-save names matching `^(NEXT_PUBLIC_|MTH_).+PARENT_SAVE`,
`CARE_ENABLE_*`, `ATH_CLAIM_*`, plus `NEXT_PUBLIC_MY_TRUSTHUB_CONTRACTOR_SYNC`,
`NEXT_PUBLIC_MOVE_ISOLATED_AUTH_APPROVED`, `MTH_V23_MOVE_ISOLATED_SOURCE`,
`MTH_V23_MOVE_ISOLATED_SOURCE_APPROVED`, `MTH_V23_MOVE_PRODUCTION_SOURCE`, and
`MTH_V23_MOVE_PRODUCTION_SOURCE_APPROVED`. The production-source pair is the
Move publication attestation read by `savitz25/Move-trust-Hub`
`lib/my-trusthub/publication-resolver.ts`. Empty, duplicate, and value-shaped
names are rejected.

### Public inventory input

```json
{
  "source": "approved-public-key-inventory",
  "scope": "savitz25-s-projects",
  "capturedAt": "<fresh ISO UTC observation time>",
  "complete": true,
  "keys": {
    "ask": {"kid":"<existing Ask KID>","publicKeyPem":"<existing Ask PUBLIC KEY PEM>"},
    "move": {"kid":"<existing Move KID>","publicKeyPem":"<existing Move PUBLIC KEY PEM>"},
    "lender": null, "investor": null, "insurance": null, "senior": null, "contractor": null
  },
  "additionalKeys": [],
  "askCopies": {
    "lender": {"kid":null,"publicKeyPem":null},
    "investor": {"kid":null,"publicKeyPem":null},
    "insurance": {"kid":null,"publicKeyPem":null},
    "senior": {"kid":null,"publicKeyPem":null},
    "contractor": {"kid":null,"publicKeyPem":null}
  }
}
```

Each non-null key has exactly `kid` and `publicKeyPem`. If a specialist signing
pair exists, `keys.<hub>` describes that installed signer using its trusted public
receipt. Otherwise it describes the Ask verification pair if present. It is null
only when neither pair exists. Incomplete KID/key name pairs stop the script.
Include every **different** older Ask verification key or staged specialist key
in `additionalKeys` as `{ "hub": "lender", "kid": "...", "publicKeyPem": "..." }`.
De-duplicate identical copies of a pair; do not omit distinct pairs. If both sides
exist but their relationship is unknown, stop for the exact missing public record.

`askCopies` records each specialist's observed existing Ask public trust. Null
means that particular name is absent. Existing copies must match the pinned Ask
key/KID; the script will not replace them. No private PEM belongs in any input.
Refresh the inventory's observation time only after revalidating current metadata
and public sources/receipts; do not just change timestamps on old observations.

## Exact procedure (future execution only)

During preparation run only steps 1 and the isolated unit tests. The following
PowerShell examples document future apply commands; they were not executed.

1. **Dry-run** (offline, names only; no reads, generation or CLI):

   ```powershell
   node scripts/release/mth-v2-specialist-keys.mjs --dry-run
   node scripts/release/mth-v2-specialist-keys.mjs --dry-run --hub lender --placement specialist
   node --test scripts/release/mth-v2-specialist-keys.test.mjs
   ```

2. **Stage each specialist**, explicitly, in order Lender, Investor, Insurance,
   Senior, Contractor. Refresh both inputs before each command, retaining public
   receipts from prior stages in the inventory. Use the authorized actual date
   and a new public bundle filename for each hub. Example for Lender:

   ```powershell
   node scripts/release/mth-v2-specialist-keys.mjs --apply --hub lender --placement specialist --date YYYYMMDD --metadata C:\operator\metadata.json --public-inventory C:\operator\public-inventory.json --ask-spki-sha256 EXPECTED_ASK_SHA256 --public-bundle C:\operator\lender-public.json --vercel-cli C:\approved\node_modules\vercel\dist\index.js --closed-gates-confirmed
   ```

   Substitute `investor`, `insurance`, `senior`, `contractor` and their receipt
   filenames in the next four invocations. `--hub` is repeatable, but apply has no
   implicit all and requires `--placement specialist` or `--placement ask`.
   Private PEM travels only to the CLI on stdin with `--sensitive`. CLI stdout,
   stderr and error text are suppressed. No shell pipeline, clipboard, private
   key file, command argument, debug output or Slack message carries a key.
   Buffers are cleared in `finally`; this is not a guarantee of complete runtime
   memory zeroization. The only output file is the **public-only** receipt.

   Existing target names abort before generation. A separately authorized exact
   replacement requires repeatable `--replace MY_TRUSTHUB_V23_<HUB>_<SUFFIX>` for
   **each** existing target. Only those names receive CLI `--force`. There is no
   general `--force`. Ask/Move names can never be replacement targets. This is
   not a live rotation playbook: replacements require their own recovery plan.

3. **Ask public placement**. Obtain a fresh name-only snapshot showing the staged
   specialist names and sensitive private types, plus refreshed public inventory
   including all five successful receipts. Use all five explicit hubs and public
   receipts to place the ten Ask verification names in one invocation:

   ```powershell
   node scripts/release/mth-v2-specialist-keys.mjs --apply --placement ask --hub lender --hub investor --hub insurance --hub senior --hub contractor --metadata C:\operator\metadata.json --public-inventory C:\operator\public-inventory.json --ask-spki-sha256 EXPECTED_ASK_SHA256 --public-bundle C:\operator\lender-public.json --public-bundle C:\operator\investor-public.json --public-bundle C:\operator\insurance-public.json --public-bundle C:\operator\senior-public.json --public-bundle C:\operator\contractor-public.json --vercel-cli C:\approved\node_modules\vercel\dist\index.js --closed-gates-confirmed
   ```

   Ask mode does not generate keys. It requires `specialists-written` receipts
   matching the installed specialist public inventory and pinned Ask fingerprint.
   It checks uniqueness again. Names alone cannot prove the server's secret value;
   successful placement receipts and later authorized signing checks provide that
   evidence. Keep the operation serialized and gates closed throughout.

4. **Verify names**, after exporting another fresh approved connector snapshot:

   ```powershell
   node scripts/release/mth-v2-specialist-keys.mjs --verify-names --hub lender --hub investor --hub insurance --hub senior --hub contractor --metadata C:\operator\metadata-after.json
   ```

   This prints project/name and PRESENT or MISSING_OR_WRONG_TYPE only; no decrypt,
   CLI invocation, private material or key generation. Success covers both
   placements. `--placement specialist` or `--placement ask` narrows the check.
   A later separately authorized release puts **all five Ask verify pairs into
   one Ask deployment**, then deploys each specialist with gates closed, in
   Lender, Investor, Insurance, Senior, Contractor order. The script deploys nothing.

5. **Rollback**, only with separate authorization: retain gates closed; remove
   the affected hub's `_KEY_ID` and `_VERIFY_PUBLIC_KEY_PEM` from Ask, and that
   hub's `_KEY_ID` and `_SIGNING_PRIVATE_KEY_PEM` from its specialist; redeploy the
   affected Ask/specialist projects under the approved release procedure. Use
   explicit confirmed IDs/team/Production for each removal:

   ```powershell
   node C:\approved\node_modules\vercel\dist\index.js env rm MY_TRUSTHUB_V23_LENDER_KEY_ID production --project CONFIRMED_ASK_ID --scope savitz25-s-projects --yes --non-interactive
   ```

   Repeat only for the other three exact hub names/project placements described
   above, then verify their absence via fresh connector metadata. Never remove
   Ask/Move keys, shared Ask public copies, MACs, unrelated environment names or
   existing Insurance parent-origin configuration. Keep the public receipts for
   audit. For a replacement, removal does not restore an old private key: stop
   and use the separately approved recovery plan; do not export a private key.

## Partial failure and review limits

Vercel writes are sequential, not transactional. All known-input guards run
before the first write, but a later CLI/network failure can leave partial names.
Success lines name only completed writes. A public receipt is created exclusively
with `state: pending` before writes and becomes `specialists-written` only after
all specialist writes succeed. The script never resumes a pending receipt or
reuses its filename. It does not retain the private key for retries. Stop, inspect
names through the connector, and obtain scoped cleanup/reprovision authorization;
do not hand-edit receipt state or bypass incomplete-pair guards. An Ask-phase
failure likewise needs scoped cleanup or reviewed explicit replacements.

Gate settings are a separate authorization. Empty canary lists are **broad** for
Lender, Insurance, Investor and Senior. Their master + mode + **NONEMPTY** list
must be set together in the same build when activation is authorized. Insurance's
first canary is `asfin-llc-l106287` (FL L106287). Contractor is last;
CGC1506243 is forbidden, and ABACO CGC1517216 is reserved for later expansion.

Independent review must inspect exact project targeting, all five distinct pairs,
protected names, replacement guards, stdin/sensitive handling, suppressed CLI
errors, complete public inventory, stale-receipt rejection and these commands.
The focused workflow runs only standard Node unit tests, with no credentials or
production connections. `NO_PRIVATE_MATERIAL_IN_LOGS` searches dry-run and mocked
apply success/failure logs for `PRIVATE KEY` and the throwaway PEM bodies.

References: [Vercel environment CLI](https://vercel.com/docs/cli/env),
[project environment metadata API](https://vercel.com/docs/rest-api/projects/retrieve-the-environment-variables-of-a-project-by-id-or-name).
