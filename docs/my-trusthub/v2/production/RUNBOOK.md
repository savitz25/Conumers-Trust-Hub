# My TrustHub V2 — production handoff runbook (Hindman canary)

Status: code SHIPPED behind flags, infrastructure NOT APPLIED. Production keeps
its current behaviour until every step below is done and the canary flags are
set. Everything here is the smallest delta from the proven isolated preview
runtime: same objects, same roles, production identifiers and pins.

Operator split: an operator with production database and Vercel access applies
the SQL packets and secrets. The release owner cannot apply production SQL or
read production keys from the release machine (harness-blocked), so this runbook
is written to need no interpretation. Every packet ends in a single PASS marker.

## 0. Pins

| Item | Value |
| --- | --- |
| Ask production project | `qvvxvbcdmbjzrgvwjatw` |
| Ask production origin | `https://www.asktrusthub.com` |
| Move production project | `arepfylnilkjmyduhwbz` |
| Move production origin | `https://www.movetrusthub.com` |
| Canary profile | Hindman & Isaacs Moving & Storage, INC. — USDOT `1002530` — `/companies/hindman-isaacs-moving-storage-inc` |
| Ask runtime login | `myth_v23_parent_prod` (SET-only member of `myth_v23_authorizer`, `myth_v23_executor`) |
| Move runtime login | `mth_move_v23_prod` (SET-only member of `mth_move_profile_transfer`) |
| Ask SQL identifiers | `v23_private.prod_*` (preview keeps `preview_*`; nothing is shared or renamed) |
| Service assertion identity | `svc:trusthub:<service>:v23:production`, issuer `urn:trusthub:v23:qvvxvbcdmbjzrgvwjatw:<service>` |

Preview behaviour is unchanged: the isolated pair, `preview_*` identifiers and
`xkkiicsassizmakcvxml` are untouched and are never production authority.

## 1. Secrets (one operator machine, nothing printed)

Run from the Ask repo on a machine that is logged into Vercel for both projects:

```
node scripts/release/mth-v2-prod-secrets.mjs --apply
```

It generates two fresh ed25519 pairs (Ask and Move, production key ids
`ask-v23-prod-<date>` / `move-v23-prod-<date>`), writes the four PEM/keyid
variables to the Ask and Move production environments through the Vercel CLI,
and writes ONLY the session-MAC hex (sha256 of the Ask private PEM) to
`$HOME/.trusthub-secrets/v23-prod-session-mac.hex` for step 2.5. It never
reuses preview keys and never prints a secret. Dry run without `--apply`.

Database passwords are set inside the SQL sessions (steps 2.4 and 3.3) and then
typed only into the two DATABASE_URL secrets.

## 2. Ask production database (`qvvxvbcdmbjzrgvwjatw`)

One persistent psql session as the operator role, `ON_ERROR_STOP=1`, with
`select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);` first.

| Step | File | Marker |
| --- | --- | --- |
| 2.0 | `00-ask-prod-preflight.sql` | every row as annotated; decides whether 2.3 runs |
| 2.1 | `../V2-3-parent-storage-proposal.sql` then `supabase/migrations/20260919205200_my_trusthub_v23_transaction_capability.sql` (verbatim) then `01-ask-prod-foundation.sql` | `V23_PROD_FOUNDATION_PASS` |
| 2.2 | `02-ask-prod-ports-forward.sql` | `V23_PROD_PORTS_FORWARD_APPLIED` |
| 2.3 | `03-ask-prod-move-binding-forward.sql` — ONLY if preflight said the Hindman binding is absent; needs the fresh public-profile read and the temporary `myth_identity_governor` SET grant, revoked right after COMMIT | returned `binding_id`, `network_entity_id`, `provenance_ref` recorded |
| 2.4 | `04-ask-prod-runtime-role-forward.sql`, then `\password myth_v23_parent_prod` in the same session | role exists |
| 2.5 | `05-ask-prod-session-mac-install.sql` with `v23.install_session_mac` loaded from the hex file through a non-echoing runner | `V23_PROD_SESSION_MAC_INSTALLED` |
| 2.6 | `06-ask-prod-readiness.sql` | `V23_PROD_PARENT_READY_PASS` |

If 2.6 reports `V23_PROD_OUTBOUND_FAIL`, revoke USAGE on schema `net` and
EXECUTE on `net.*` from the three runtime roles and rerun 2.6. Do not drop
`pg_net`; production may use it elsewhere.

Rollback of 2.2/2.4 only: `07-ask-prod-rollback.sql` with
`v23.rollback_authorized=true` after the Vercel flag is off.

## 3. Move production database (`arepfylnilkjmyduhwbz`)

One persistent psql session as the operator role, with
`select set_config('mth.v23_production','approved',false);` first.

| Step | File | Marker |
| --- | --- | --- |
| 3.1 | `docs/my-trusthub-v2-production/01-move-prod-source-stage.sql` | `MTH_PROD_SOURCE_STAGE_APPLIED` |
| 3.2 | `02-move-prod-certified-publication.sql` with `mth.v23_canary_evidence_ref` set to the fresh public-profile read (URL + timestamp) | `MTH_PROD_CANARY_PUBLICATION_APPLIED` |
| 3.3 | `03-move-prod-runtime-role.sql`, then `\password mth_move_v23_prod` | `MTH_PROD_RUNTIME_LOGIN_APPLIED` |
| 3.4 | `04-move-prod-readiness.sql` | `MTH_PROD_SOURCE_READY_PASS` |

Rollback: `05-move-prod-rollback.sql` with `mth.v23_rollback_authorized=true`
after the Vercel flag is off.

## 4. Vercel production environment

Set exactly the variables in `ask-prod-env.md` (Ask project) and
`docs/my-trusthub-v2-production/move-prod-env.md` (Move repo), Production
scope only. Both DATABASE_URL secrets use the Supavisor session pooler, port
5432, database `postgres`. Redeploy both projects (any commit on main, or
"Redeploy" in Vercel) so the NEXT_PUBLIC_* values are bundled.

Canary ON = all of: Ask `MY_TRUSTHUB_V23_PRODUCTION_HANDOFF_ENABLED=true`,
Move `MTH_MOVE_PARENT_SAVE_MODE=production` +
`NEXT_PUBLIC_MOVE_PARENT_SAVE_CANARY_SLUGS=hindman-isaacs-moving-storage-inc`.
Canary OFF (flag rollback, no SQL) = Ask flag `false` and Move
`NEXT_PUBLIC_MOVE_PARENT_SAVE_ENABLED=0`, then redeploy Move. Ask refuses the
runtime immediately on the next request once its flag is false (no rebuild).

## 5. Live proof (Journey QA)

`https://www.movetrusthub.com/companies/hindman-isaacs-moving-storage-inc`
→ Save → Keep this in My TrustHub → `www.asktrusthub.com` sign-in (production
account, magic link) → Confirm Save → "Saved to My TrustHub" → `/my/saved` →
Hindman row, "Saved from Move Trust Hub" → Unsave → Saved count 0.

PASS requires no 4xx/5xx, the exact entity, receipt `saved`/`already_saved`, no
duplicate row, Unsave sticking on reload, no Watch, and the serving SHAs equal
to the intended release.

## 6. Widening (separate ship)

Only after the canary passes: replace the Hindman-only resolver
(`publication-resolver.ts`, `prod_move_binding()`, the two exact reader
policies and the one-row attestation table) with a resolver over the real
production mover publication source, and remove
`NEXT_PUBLIC_MOVE_PARENT_SAVE_CANARY_SLUGS`. Journey QA then samples Hindman
plus two more published movers.

## Move widening — any eligible published mover

The runtime no longer pins the Hindman profile. For every Save it takes the
identity from the verified, signed Move manifest (`move` / `mover` /
`usdot-<number>`), re-proves publication with Move over the signed source
channel, and resolves the binding through
`v23_private.prod_move_binding_for(text)`. A Save is admitted only for exactly
one current binding that is accepted, class mover, namespace `fmcsa.usdot`,
jurisdiction `US`, on an active entity, and agrees with the identity on both the
native id and the number. Zero, several, `review_required` or any disagreement
fails closed. Browser-supplied ids, names and emails are never looked up.

Operator packets (canary flags OFF while applying):

| File | Purpose |
| --- | --- |
| `09-ask-prod-move-binding-resolver-forward.sql` | Two read policies for the nologin reader and the exact resolver function. Verifies the Hindman reference resolves identically. Marker `V23_PROD_MOVE_BINDING_RESOLVER_APPLIED`. |
| `09-ask-prod-move-binding-resolver-rollback.sql` | Drops exactly those three objects. |
| `10-ask-prod-move-mover-binding.sql` | Per mover: read-only preflight, then one entity + one accepted binding when none exists. Needed for `gentle-giant-moving` (USDOT 373544) and `caraway-moving-inc` (USDOT 1684331). |

Until 09 is applied the deployed application reports the profile-save runtime
as unavailable (it probes the resolver on every request); the canary must stay
OFF until then. The isolated preview pair needs
`../final-parent-wiring/move-binding-resolver-forward.sql` for the same reason.

Local proof: `npm run check:my-trusthub-v2-3-widening`.
