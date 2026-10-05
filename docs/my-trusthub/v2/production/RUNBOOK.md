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

## Move exact-USDOT binding expansion (packet 11, PREPARED — not applied)

Bulk form of packet 10 for every PUBLISHABLE supported mover that Move
identifies by exactly one USDOT number. Identity is `move` / `mover` /
`fmcsa.usdot` / `US` / `usdot-<number>` only; nothing is connected by name.

| File | Purpose |
| --- | --- |
| Move repo `scripts/qa/mth-exact-usdot-candidates.ts` | Read-only enumeration of production `public.companies` (anon key), judged by the Save path's own `evaluatePublishedMover`. |
| `scripts/release/mth-v2-exact-usdot-packet.mjs` | Deterministic transform of that enumeration into the two generated files below. |
| `11-move-exact-usdot-candidates.sql` (generated) | Session-local temp table of candidates + manifest sha256. |
| `11-move-exact-usdot-evidence.csv` (generated) | Row-level Move verdict for every PUBLISHABLE supported mover. |
| `11-ask-prod-move-exact-usdot-reconcile.sql` | Read-only classification: ALREADY_ACCEPTED / SAFE_NEW_BINDING / CONFLICT / REVIEW_REQUIRED / AMBIGUOUS. |
| `11-ask-prod-move-exact-usdot-batch-forward.sql` | One serializable transaction: one entity + one accepted binding per SAFE_NEW_BINDING row, INSERT only. Marker `V23_PROD_MOVE_EXACT_USDOT_BATCH_APPLIED`. |
| `11-ask-prod-move-exact-usdot-batch-rollback.sql` | Retires exactly the receipt's bindings (validity closed, entity retired). No DELETE. Marker `V23_PROD_MOVE_EXACT_USDOT_BATCH_RETIRED`. |
| `11-move-exact-usdot-RECEIPT-TEMPLATE.md` | Operator receipt. |

Order: 09 applied → regenerate the candidates if older than 24 h → one psql
session: candidates, reconcile, review counts and non-safe rows, then (only
with a separate mutation authorization) the forward file within two minutes of
the reconciliation → export the receipt → revoke the temporary
`myth_identity_governor` membership. Movers already bound by packet 10 simply
classify ALREADY_ACCEPTED; packet 10 stays valid for single movers.

Shipped manifest (enumerated 2026-10-03T20:17Z): 5,957 company rows, 5,022
PUBLISHABLE, 4,727 supported movers, 4,312 exact-USDOT candidates, 373 held for
a missing USDOT, `MOVE_NAME_COLLISION_HOLD` = 42 (identical legal name on more
than one mover), 0 USDOTs on more than one Move row. The Move holds are not Ask
classes: the Ask classification is unknown until the reconcile file is run on
production. The enumeration itself is kept in the Move repo at
`docs/my-trusthub-v2-production/exact-usdot-enumeration-2026-10-03.json`.

Local proof: `npm run check:my-trusthub-v2-exact-usdot-batch`.

## Per-hub account context for Lender, Insurance, and Contractor (packet 15, PREPARED — not applied)

**Defect.** `v23_private.prod_issue_context` issues the one-time account context
as issuer hub `move` from the Move origin, always. The Save commit consumes it
as the hub of the verified caller (`v23_private.consume_context` →
`ops.consume_consumer_auth_handoff`, expected issuer = caller hub). Move issues
and consumes as `move`, so it works. For Lender or Insurance the consume
returns `INVALID_AUDIENCE`, `consume_context` raises 42501, no Saved row is
written and nothing is acknowledged. The same mismatch applies to Contractor
while it still calls `prod_issue_context`. Packets 12, 13, and 16 do not change
this. Reproduced on the embedded database with packets 02/03/04/05/09/12/13
unmodified, for Lender on the unmodified runtime and for Insurance once its
stage could run on one connection (below).

**Contract after the fix.** A context is issued for exactly one hub and is
consumable only as that hub. The hub is the one the runtime verified from the
specialist's signed assertion and the stored stage. It is never a browser field
and never read from the proof. A proof that carries `hub`, `issuer`,
`issuerHub`, or `sourceHub` is refused.

| Hub | Issuer function | Issued as | Origin | Consumed as |
| --- | --- | --- | --- | --- |
| Move | `prod_issue_context` (unchanged) | `move` | deployment pin | `move` |
| Investor | `prod_investor_issue_context` (packet 14, not this packet) | `investor` | `https://www.investortrusthub.com` | `investor` |
| Lender | `prod_hub_issue_context(…, 'lender')` | `lender` | `https://www.lendertrusthub.com` | `lender` |
| Insurance | `prod_hub_issue_context(…, 'insurance')` | `insurance` | `https://www.insurancetrusthub.com` | `insurance` |
| Contractor | `prod_hub_issue_context(…, 'contractor')` | `contractor` | `https://www.contractortrusthub.com` | `contractor` |

The Contractor origin is the production pin `contractorOrigin` and
`PRODUCTION_ORIGINS.contractor`. The apex alias is registered and is not the
pin. Anything else, including `move`, `investor`, `senior`, an empty hub, and
an unrecognized value, is refused by `prod_hub_issue_context`.

Single use, the 90 second lifetime, the state/nonce binding, the hub check at
consume time and five-strikes revocation are unchanged.

Packet 15 stops at issuance. It does not make a Contractor Saveable.
`v23_private.authority()` still admits only `move`, `insurance`, and `lender`.
Packet 15 does not add `contractor` to that function. Before a Contractor Save
can commit, Packet 16 must separately authorize the Contractor authority
contract: hub `contractor`, profile class `contractor_profile`, namespace
`fl.dbpr.license`. Until that packet is applied, `consume_context` for hub
`contractor` fails closed and writes no Saved row. That denial is intentional.
Move keeps `prod_issue_context`. Investor keeps `prod_investor_issue_context`.

| File | Purpose | Marker |
| --- | --- | --- |
| `15-ask-prod-hub-account-context-forward.sql` | One new function, `v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)`, owned by `myth_v23_foundation`, EXECUTE for `myth_v23_authorizer` only. Accepts exactly `lender`, `insurance`, and `contractor`, each mapped to its pinned production origin. Refuses `move`, `investor`, `senior`, empty, unknown, and a proof that carries a hub field. | `V23_PROD_HUB_CONTEXT_APPLIED` |
| `15-ask-prod-hub-account-context-rollback.sql` | Drops exactly that function. Lender, Insurance, and Contractor then fail closed. The Move issuer is untouched. This rollback does not drop `prod_investor_issue_context`. | `V23_PROD_HUB_CONTEXT_ROLLED_BACK` |

Order for a specialist canary: deploy this Ask build, apply packet 15, apply
that specialist's binding packet, exchange keys, then open that specialist's
release gate. Until packet 15 is applied a Lender, Insurance, or Contractor
account-context Save stays a device Save. Do not apply packet 15 from this
release candidate.

**Two more Insurance changes in the same build (application only, no SQL):**

1. *Acknowledgement.* Ask did not tell Insurance the outcome (the call was
   skipped). Insurance reports an account Save or Unsave only on Ask's signed
   `source:ack` call, so Ask now sends it (`insurance-channel.ts`), and the
   request keys of an Insurance Save start with the browser proof Insurance
   signed, which is what Insurance's source route checks. Checked against the
   Insurance repository's own handler code.
2. *One connection per stage.* The Insurance return-path lookup opened a second
   pooled connection inside the stage transaction (pool size 3). It now reads
   on the transaction's own connection.

**For Investor (draft PR #230).** That branch carries its own issuer
(`prod_investor_issue_context`, packet 14) and edits the same issuer-selection
line in `preview-assembly.ts`. When it is rebased onto this change it keeps
`investor_issue_context`. It must not route `investor` through
`prod_hub_issue_context`, which refuses it. The selection lives in
`accountContextIssueQuery`: `move` → `issue_context`, `investor` →
`investor_issue_context`, `lender` / `insurance` / `contractor` →
`hub_issue_context` with the verified hub as `$4`, anything else fails closed
before a statement is sent. The return-task port now also receives the
transaction connection.

**For Contractor (PR #232).** Packet 16 owns the Contractor authority contract
and the DBPR binding. Packet 15 does not. A verified contractor caller uses
`hub_issue_context` with `$4 = contractor`. The Contractor return lookup must
use the stage connection. This branch does not copy the Contractor assertion,
resolver, binding, or authority function.

## Senior on the shared issuer (packet 18, PREPARED — not applied)

Packet 15 remains the frozen three-hub function. Packet 18 replaces that
installed function with the same body plus one exact arm, `senior` →
`https://www.seniortrusthub.com`. It does not create `prod_senior_issue_context`.
Move stays on `prod_issue_context`. Investor stays on
`prod_investor_issue_context`. `v23_private.authority()` is not modified.
Packet 17 owns Senior authority and the CMS CCN bindings. Until Packet 17 is
applied, a Senior context can be issued and `consume_context` still fails
closed with no Saved row and no acknowledgement.

| File | Purpose | Marker |
| --- | --- | --- |
| `18-ask-prod-senior-hub-context-preflight.sql` | Read-only. The installed shared issuer must be the frozen Packet 15 body, Senior must not already be admitted, and the three pinned origins must match. Any other body stops. | `V23_PROD_SENIOR_HUB_CONTEXT_PREFLIGHT_PASS` |
| `18-ask-prod-senior-hub-context-forward.sql` | Replaces the shared issuer so the exact hubs are lender, insurance, contractor, and senior. | `V23_PROD_SENIOR_HUB_CONTEXT_APPLIED` |
| `18-ask-prod-senior-hub-context-rollback.sql` | Restores the frozen three-hub function. Senior is denied again. The function is not dropped. | `V23_PROD_SENIOR_HUB_CONTEXT_ROLLED_BACK` |

The verified caller hub is still `a.caller.hub`. A browser field cannot select it.
Apply Packet 15 first. Run the Packet 18 preflight. Apply Packet 18 only when
that preflight passes. Packet 17 stays a separate operator step.

Local proof: `npm run check:my-trusthub-v2-hub-context`. The full Move widening
suite is `npm run check:my-trusthub-v2-3-widening`.
## Investor official-firm Save (packet 14, PREPARED — not applied, not deployed)

Identity (locked): hub `investor` / class `official_firm` / namespace `sec.crd` /
source identifier = exact numeric firm CRD / specialist entity id `crd-<CRD>` /
jurisdiction `US`. Return path `/firm/sec-crd-<CRD>`. Never the firm row UUID,
the name, the slug, an individual adviser CRD, a branch, a notice filing or a
state-registration observation.

Runtime rule: Ask admits an Investor Save only when (1) the stage carries a
valid Investor ed25519 assertion, (2) the manifest is one `official_firm` whose
slug and return path are the ones its CRD implies, (3) Investor re-proves
publication of that exact CRD over the signed source channel, and (4)
`v23_private.prod_investor_crd_binding_for` returns exactly one current row that
is accepted, `official_firm`, `sec.crd`, `US`, on an active entity whose
canonical profile ref is `/firm/sec-crd-<CRD>`, agreeing on both the native id
and the CRD. Anything else fails closed.

Operator packets, in this order, with the Investor release gate OFF:

| File | Purpose | Marker |
| --- | --- | --- |
| `14-ask-prod-investor-crd-preflight.sql` | Read only. Run first: all four result sets are empty on a clean database. Sets 1 to 3 must be empty before the binding packet; set 4 reports the authority and context packets. | — |
| `14-ask-prod-investor-authority-forward.sql` | Adds `investor` to the hub list of `v23_private.authority()` (one token; body otherwise identical, verified before replace). Without it the database refuses every Investor stage with `invalid authority`. | `V23_PROD_INVESTOR_AUTHORITY_APPLIED` |
| `14-ask-prod-investor-context-forward.sql` | New `v23_private.prod_investor_issue_context`: the Move issuer with hub `investor` and the pinned Investor origin. Without it an Investor Save cannot obtain an account context. `prod_issue_context` is not touched. | `V23_PROD_INVESTOR_CONTEXT_APPLIED` |
| `14-ask-prod-investor-crd-binding-forward.sql` | Three canary entities + accepted `sec.crd` bindings and the exact resolver. Needs `v23bind.sec_iapd_checked=true` after confirming each CRD on SEC IAPD. Returns the receipt. | `V23_PROD_INVESTOR_CRD_BINDINGS_APPLIED` |

Rollbacks: `14-ask-prod-investor-crd-binding-rollback.sql` (one receipt row per
run; closes the binding's validity, no DELETE), `14-ask-prod-investor-context-rollback.sql`
(drops the one function), `14-ask-prod-investor-authority-rollback.sql`
(restores the exact three-hub body).

Then: exchange keys (names in `ask-prod-env.md`), set the Ask verify key and
the Investor variables, set the Investor release gate to the three canary
slugs, redeploy Investor. Live proof on the three canaries; an unrelated firm
must stay device-only.

Note for the other hubs: `prod_issue_context` issues every account context as
hub `move`, and the commit consumes it as the caller's hub. The Investor
packet adds its own issuer for that reason. Packets 12 (Lender) and 13
(Insurance) do not add one. Reproduced on the embedded database with packets
02/04/05/12 exactly as in this repository: a Lender marketplace Save stages,
then fails at `consume_continuation` with 42501, writes no Saved row and sends
no acknowledgement. Insurance takes the same commit path. Production may differ
only if it holds a change that is not in this repository.

Local proof: `npm run check:my-trusthub-v2-investor`.

### Investor and the shared per-hub account context (draft PR #231)

This branch is held until the shared Lender/Insurance account-context change
(PR #231, packet 15) lands. It does not depend on that change to work: Investor
has its own issuer (`prod_investor_issue_context`, packet 14). The two meet in
three places, all in `lib/my-trusthub/profile-save/`:

| Place | This branch | After PR #231 | On rebase |
| --- | --- | --- | --- |
| `preview-assembly.ts`, `exchange()` issuer selection | `investor` → `investor_issue_context`, everything else → `issue_context` | `move` → `issue_context`; `lender`/`insurance` → `hub_issue_context(…, hub)`; anything else refused | keep #231's selection and add `investor` → `investor_issue_context` to it, including in the "refused" guard. Never route `investor` through `prod_hub_issue_context`: packet 15 refuses it |
| `authorized-postgres.ts`, `returnTask` port | `(identity)` | `(identity, db)` | take #231's signature; the Investor return task needs no database read |
| `preview-assembly.ts` / `hosted-runtime.ts`, hub fields and imports | adds `investorKey`, `investorSource` | adds `insuranceSource` | keep both |

Packet 14 and packet 15 touch different objects and can be applied in either
order. Nothing in packet 14 changes if packet 15 is applied first.

Also in this branch (shared code, one guard): a continuation is read only for
the hub that staged it. Before it, an Investor (or Lender) continuation arriving
with another hub's Origin was refused only after Ask had called that other
hub's source channel with it; now nothing is sent.
