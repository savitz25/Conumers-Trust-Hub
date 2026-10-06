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

Packet 15 stops at issuance. It does not change `v23_private.authority()`.
The current production baseline admits `move`, `insurance`, and `lender`.
A Contractor Save commit through `consume_context` stays fail-closed until
packet 19 admits the contractor contract (`contractor` / `contractor_profile` /
`fl.dbpr.license`) inside the six-hub network authority.
`16-ask-prod-contractor-authority-forward.sql` and
`16-ask-prod-contractor-authority-rollback.sql` are superseded by packet 19
and are not applied in production. Packet 15 makes the issued context match
hub `contractor`. Packet 16 binding is still required before a Contractor Save
can resolve a DBPR profile. Move keeps `prod_issue_context`. Investor keeps
`prod_investor_issue_context`. Senior stays on the shared issuer from packet 18.

| File | Purpose | Marker |
| --- | --- | --- |
| `15-ask-prod-hub-account-context-forward.sql` | One new function, `v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)`, owned by `myth_v23_foundation`, EXECUTE for `myth_v23_authorizer` only. Accepts exactly `lender`, `insurance`, and `contractor`, each mapped to its pinned production origin. Refuses `move`, `investor`, `senior`, empty, unknown, and a proof that carries a hub field. | `V23_PROD_HUB_CONTEXT_APPLIED` |
| `15-ask-prod-hub-account-context-rollback.sql` | Drops that function only when its body, signature, owner, security definer, search_path, and ACL are the frozen Packet 15 predecessor. A Packet 18 body is refused and left in place; run the Packet 18 rollback first. The Move issuer is untouched. This rollback does not drop `prod_investor_issue_context`. | `V23_PROD_HUB_CONTEXT_ROLLED_BACK` |

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
`investor_issue_context`, `lender` / `insurance` / `contractor` / `senior` →
`hub_issue_context` with the verified hub as `$4`, anything else fails closed
before a statement is sent. The return-task port now also receives the
transaction connection.

**For Contractor (PR #232, packet 19 compatibility from PR #238).** This
candidate includes the Contractor assertion, the DBPR resolver, the binding,
and the superseded packet 16 authority files. Packet 16 owns the DBPR binding.
Packet 16 authority forward and rollback are superseded by packet 19 and are
not applied. A verified contractor caller uses `hub_issue_context` with
`$4 = contractor`. The Contractor return lookup uses the stage connection.
Investor stays on `prod_investor_issue_context`. Senior stays on the shared
issuer.

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
| `18-ask-prod-senior-hub-context-rollback.sql` | Restores the frozen three-hub function. Senior is denied again. The function is not dropped. Run this before the Packet 15 rollback when the Senior arm is installed. | `V23_PROD_SENIOR_HUB_CONTEXT_ROLLED_BACK` |

The verified caller hub is still `a.caller.hub`. A browser field cannot select it.
Apply Packet 15 first. Run the Packet 18 preflight. Apply Packet 18 only when
that preflight passes. Packet 17 stays a separate operator step.

Local proof: `npm run check:my-trusthub-v2-hub-context`. The full Move widening
suite is `npm run check:my-trusthub-v2-3-widening`.

## Contractor production SQL (packet 16 bindings, packet 19 authority)

SUPERSEDED BY PACKET 19 — DO NOT APPLY IN PRODUCTION:

- `16-ask-prod-contractor-authority-forward.sql`
- `16-ask-prod-contractor-authority-rollback.sql`

Both files stay in the repository for provenance and recovery. They are not in
the production activation order. Packet 19
(`19-ask-prod-network-authority-forward.sql`) is the only production authority
transition. It admits `contractor` / `contractor_profile` / `fl.dbpr.license`
together with move, insurance, lender, investor, and senior.

Production SQL, in this order:

1. `16-ask-prod-contractor-dbpr-preflight.sql` while `v23_private.authority()`
   is still the three-hub baseline (`move`, `insurance`, `lender`). Result 5
   must be `BASELINE_NO_AUTHORITY_CONFLICT`. That row is not an authority
   conflict. Packet 19 is the future authority step.
2. `16-ask-prod-contractor-dbpr-binding-forward.sql` (the Contractor binding).
3. Other hub binding packets as applicable.
4. `19-ask-prod-network-authority-forward.sql`.

There is no packet 16 authority forward in this order. Packet 15 remains separately required for Contractor account-context issuance. The binding forward does not call `authority()`.

After packet 19, result 5 is `NETWORK_AUTHORITY_FINAL` only when
`md5(regexp_replace(prosrc, '\s+', '', 'g'))` equals the certified packet 19
function body. That state is ready. Packet 16 authority is not missing. A
comment, a hub list alone, or a loosened guard does not match.

`LEGACY_PACKET16_AUTHORITY_HOLD` means the exact packet 16 contractor authority
body is installed. Hold, and converge with packet 19. Do not re-apply packet
16 authority.

`UNKNOWN_AUTHORITY_HOLD` means stop. The body is not the exact three-hub
baseline, the exact packet 19 final body, or the exact legacy packet 16
contractor body. No mutation.

### Rollback after packet 19

Contractor-specific rollback is
`16-ask-prod-contractor-dbpr-binding-rollback.sql`, and only with steward
review after a consumer Save. It closes that binding. It does not delete Saved research.

Network authority rollback is `19-ask-prod-network-authority-rollback.sql`.
That is a network-level steward decision.

`16-ask-prod-contractor-authority-rollback.sql` is not the production rollback
after packet 19.

## Investor official-firm Save (packet 14 context + bindings, packet 19 authority; PREPARED — not applied, not deployed)

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

Network authority is packet 19 (PR #236, certified head
`3b565707946b7c93252b767cf10aa185336ec8b1`). The packet 14 authority files are
**SUPERSEDED BY PACKET 19 — DO NOT APPLY IN PRODUCTION**. They are kept as the
audited predecessor and are not part of this order.

Operator packets, in this order, with the Investor release gate OFF:

| Step | File | Purpose | Marker |
| --- | --- | --- | --- |
| 1 | `14-ask-prod-investor-crd-preflight.sql` | Read only. On a clean database sets 1, 2, 3 and 5 are empty and set 4 is one row `baseline` / `PROCEED`. Sets 1 to 3 must be empty before the binding packet. Set 4 must not say `HOLD` (see below). | — |
| 2 | `14-ask-prod-investor-context-forward.sql` | New `v23_private.prod_investor_issue_context`: the Move issuer with hub `investor` and the pinned Investor origin. Investor stays on this issuer; it is never routed through `prod_hub_issue_context` (packets 15/18). `prod_issue_context` is not touched. | `V23_PROD_INVESTOR_CONTEXT_APPLIED` |
| 3 | `14-ask-prod-investor-crd-binding-forward.sql` | Three canary entities + accepted `sec.crd` bindings and the exact resolver. Needs `v23bind.sec_iapd_checked=true` after confirming each CRD on SEC IAPD. Returns the receipt. Does not call or need `authority()`. | `V23_PROD_INVESTOR_CRD_BINDINGS_APPLIED` |
| — | ~~`14-ask-prod-investor-authority-forward.sql`~~ | Not applied. Superseded. | — |
| later | `19-ask-prod-network-authority-preflight.sql`, then `-forward.sql` | Network step, after every hub's binding packets: the one six-hub authority (move, insurance, lender, investor `official_firm` / `crd-<CRD>`, contractor, senior). Until it runs, the database refuses every Investor stage with `invalid authority`. | `V23_PROD_NETWORK_AUTHORITY_APPLIED` |

Preflight set 4 (authority state) compares the installed `authority()` body,
whitespace removed, with the three reviewed bodies:

| `authority_state` | `disposition` | Meaning |
| --- | --- | --- |
| `baseline` | `PROCEED` | Migration three-hub body. Investor context and binding packets may run. Authority comes later from packet 19. |
| `network_final` | `FINAL` | Packet 19 body. Network authority is final. Apply no authority file. |
| `legacy_packet14` | `HOLD` | The superseded packet 14 four-hub body is installed. Stop. Converge with the packet 19 preflight and forward after review (packet 19 accepts this body as a reviewed predecessor). Do not run the packet 14 authority rollback. |
| `unknown` | `HOLD` | Any other body, or none. Stop and get review. |

Rollbacks, each owned separately:

| Artifact | Rollback | Note |
| --- | --- | --- |
| Investor bindings | `14-ask-prod-investor-crd-binding-rollback.sql` | One receipt row per run; closes the binding's validity, no DELETE. |
| Investor context issuer | `14-ask-prod-investor-context-rollback.sql` | Drops the one function. Nothing else uses it. |
| Network authority | `19-ask-prod-network-authority-rollback.sql` | The only authority rollback. Restores the three-hub body from the packet 19 body only; affects every hub packet 19 admits. |
| ~~Packet 14 authority~~ | ~~`14-ask-prod-investor-authority-rollback.sql`~~ | Superseded. Not a safe undo after packet 19: it refuses the packet 19 body. |

No step deletes Saved research. After any successful consumer Investor Save,
each of the three rollbacks above needs steward review first: the binding
rollback (for the firm whose Saved rows point at that binding), the context
rollback (no further Investor Saves can commit), and the network authority
rollback (stages for every non-Move hub it admits then fail closed; packet 19
raises `V23_PROD_NETWORK_AUTHORITY_ROLLBACK_STEWARD`). Saved rows stay in place.

Then: exchange keys (names in `ask-prod-env.md`), set the Ask verify key and
the Investor variables, set the Investor release gate to the three canary
slugs, redeploy Investor. Live proof on the three canaries; an unrelated firm
must stay device-only.

Account context: Investor keeps its dedicated issuer
`prod_investor_issue_context` (step 2). It is never routed through the shared
`prod_hub_issue_context` (packets 15 and 18), which refuses `investor`.

Local proof: `npm run check:my-trusthub-v2-investor`.

### Investor and the shared per-hub account context (packets 15 and 18, on main)

The shared router is `accountContextIssueQuery` in
`lib/my-trusthub/profile-save/hub-account-context.ts`: `move` →
`issue_context`; `investor` → `investor_issue_context`; `lender`,
`insurance`, `contractor`, `senior` → `hub_issue_context` with the verified
hub as `$4`; anything else fails closed before a statement is sent. This branch
adds no issuer selection of its own. It adds the Investor assertion key and
source channel beside Lender's and Insurance's in `preview-assembly.ts` and
`hosted-runtime.ts`, and the Investor acknowledgement beside Insurance's.
This candidate also adds the Contractor assertion key and source channel in
those same files. Contractor uses the shared issuer. The Investor issuer, the
Insurance acknowledgement path, and the Senior shared-hub arm stay.

Packet 14 touches none of the packet 15 or 18 objects. They apply in either
order.

Also in this branch (shared code, one guard): a continuation is read only for
the hub that staged it. Before it, an Investor (or Lender) continuation arriving
with another hub's Origin was refused only after Ask had called that other
hub's source channel with it; now nothing is sent.

## Packet 19 — network authority finalization

Packet 19 is the one production transition of `v23_private.authority()` from the
reviewed three-hub body (`move`, `insurance`, `lender`) to the six-hub body.
It does not issue account context, create bindings, write Saved research, or
create keys. Packets 14, 16, and 17 authority forwards do not compose; they
are superseded by this packet. Their binding and resolver files stay.

| File | Purpose |
| --- | --- |
| `19-ask-prod-network-authority-preflight.sql` | Read-only. Accepts only a reviewed predecessor. Sets `v23.network_authority_state` and `v23.network_authority_hubs`. Marker `V23_PROD_NETWORK_AUTHORITY_PREFLIGHT_PASS`. |
| `19-ask-prod-network-authority-forward.sql` | Replaces `authority()` with one six-hub body. Second run stops. Marker `V23_PROD_NETWORK_AUTHORITY_APPLIED`. |
| `19-ask-prod-network-authority-rollback.sql` | Restores the three-hub body only when the installed body is the packet 19 body. No DELETE. Marker `V23_PROD_NETWORK_AUTHORITY_ROLLED_BACK`. |

Final contracts, and no others: `move`, `insurance`, and `lender` keep the
reviewed checks with no new class predicate. `investor` is `official_firm` /
`sec.crd` (`crd-<CRD>`). `contractor` is `contractor_profile` /
`fl.dbpr.license:<DBPR key>`. `senior` is `cms_facility` / `cms.ccn` (the bare
CCN). The hub is the authorizer's transaction row. A browser field cannot
select it.

Production SQL order, with the current hub preflight files left as they are:

1. Hub preflights, while `authority()` is still the three-hub body.
2. Hub binding packets, any order among packet 14, 16, and 17 bindings.
   Binding forwards do not read `authority()`. They do require
   `myth_v23_prod_reader` from packet 02, which production already has.
3. Packet 19 preflight (`state=baseline`), then the packet 19 forward.
4. Keys, gates, and canaries. Not part of this packet.

Do not apply `14-ask-prod-investor-authority-forward.sql`,
`16-ask-prod-contractor-authority-forward.sql`, or
`17-ask-prod-senior-authority-forward.sql`, or their rollbacks, in production.
After any successful Investor, Contractor, or Senior consumer Save, packet 19
rollback requires explicit steward review. The rollback restores the function
and does not delete Saved rows.

The current hub preflights mis-report if they are run after packet 19. The
owner edits are in `19-NETWORK-AUTHORITY.md`. This runbook does not change
those packets.

Local proof: `npm run check:my-trusthub-v2-network-authority`.
