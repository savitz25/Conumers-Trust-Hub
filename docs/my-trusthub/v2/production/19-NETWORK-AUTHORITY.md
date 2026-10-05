# Packet 19 — network authority finalization

Owner of this packet: G-B2. This note is the production procedure and the
later edits for the owners of packets 14, 16, and 17. Those pull requests are
not modified here.

## Root cause

`v23_private.authority()` is one function. Packet 14, packet 16, and packet 17
each replace the whole function, and each accepts only its own predecessor:

- Packet 14 and packet 16 accept only the whitespace-normalized migration body
  whose hub list is exactly `move`, `insurance`, `lender`.
- Packet 14's result is that list plus `investor`, with no class or namespace
  guard. Packet 16's result adds `contractor` and a `contractor_profile` /
  `fl.dbpr.license` guard.
- Packet 17 accepts a body only when the hub list is its single difference
  from the migration text. Packet 16's guard makes that check fail. Packet 14
  then packet 17 can append `senior`. The reverse fails because packet 14
  still demands the three-hub body.

There is no order in which all three authority forwards succeed, and each
rollback restores only its own predecessor. That is not a six-hub procedure.

## Architecture

Packet 19 is the only production authority transition. It classifies the
installed body and replaces a reviewed predecessor with one final body.
Anything else stops. It does not create a function when `authority()` is
missing, and it does not read a browser hub.

Reviewed predecessors:

- `baseline` — the migration body, list exactly `move`, `insurance`, `lender`.
  This is the production starting point.
- `packet14_authority` — that body with the list extended to
  `move`, `insurance`, `lender`, `investor` and no other change.
- `packet16_authority` — packet 16's exact contractor body.
- `packet17_style` — the migration body whose only change is a unique hub list
  that still contains `move`, `insurance`, and `lender` and is drawn only from
  the six hubs.
- `applied` — the packet 19 body. The forward and the rollback both refuse a
  second run.

Accepting the packet 14, 16, and 17 bodies is recovery after a mistaken
authority apply. It is not the production procedure. Rollback always restores
the three-hub migration body, and only from the packet 19 body.

Final body, in list order `move`, `insurance`, `lender`, `investor`,
`contractor`, `senior`:

- The audience, service (`svc:trusthub:<hub>:bff:v1`), browser
  (`^[a-f0-9]{64}$`), scope, and operation checks are the reviewed checks.
- `move`, `insurance`, and `lender` gain no class or namespace predicate.
- `investor` on prepare, commit, and a verify that carries a profile:
  `official_firm`, native id `^crd-[1-9][0-9]{0,9}$`. A present
  `identifierNamespace` must be `sec.crd`. A missing key is not a failure,
  because the runtime profile does not send one. `sec.crd:106176`, a bare
  CRD, and `crd-0106176` are denied.
- `contractor`: packet 16's guard, `contractor_profile`, native id
  `^fl\.dbpr\.license:[A-Z]{1,4}[0-9]{3,9}$`, and the same optional
  `identifierNamespace` rule for `fl.dbpr.license`.
- `senior`: `cms_facility`, native id `^[A-Za-z0-9]{6}$` (the stacked
  packet 17 resolver), optional `identifierNamespace` `cms.ccn`. A prefixed
  `cms.ccn:015009` is denied. No other Senior class is admitted.
- `consumeProfileSaveContinuation` and `prepareProfileSaveContinuation` carry
  no profile. They pass on hub membership plus the existing scope checks, as
  packet 16 already does for contractor.

Account context is not this packet. Packet 15 issues lender, insurance, and
contractor. Packet 18 adds senior. Investor stays on
`prod_investor_issue_context`. Move stays on `prod_issue_context`.

## Production order

Proved on embedded Postgres against the current candidate files:

- Investor PR #230 `cad6857664e4cc6899588ad82318f7317d1d6dd1`
- Contractor PR #232 `e3f1f67a5945112ce890e41237e935c69e98c76c`
- Senior authority PR #233 `16a35a6d9ac7cfcc8c1c6fd415f9ab04d07c1532`
  (the authority forward and rollback are byte-identical on stacked PR #235
  `5752e5cbef6cbcd8483c6124c049eeea232a2643`)
- Senior binding and preflight: the stacked PR #235 files

Binding forwards check `v23.approved_project`, their own checked GUC, empty
collision preconditions, and the roles `myth_v23_prod_reader`,
`myth_v23_authorizer`, and `myth_v23_executor`. They do not call
`authority()` and they do not require the hub to be absent from it. Packet 02
creates `myth_v23_prod_reader` and must already be applied. The three binding
forwards apply in any mutual order, before or after packet 19.

The safe order while the current preflight files are unchanged:

1. Hub preflights, on the three-hub authority body.
2. Binding packets 14, 16, and 17, any order.
3. Packet 19 preflight, which must report `baseline`, then the packet 19 forward.
4. Keys, gates, and canaries. Not this packet.

Running today's preflights after packet 19 mis-reports. See the owner edits.
Do not apply the three authority forwards in production.

## Rollback

`19-ask-prod-network-authority-rollback.sql` runs only when the installed body
is the packet 19 body. It restores the three-hub migration body. It does not
restore a packet 14, 16, or 17 body, and it does not drop the function. A
second run stops. Bindings stay.

After any successful Investor, Contractor, or Senior consumer Save, do not run
this rollback until a steward has reviewed those rows. The file raises
`V23_PROD_NETWORK_AUTHORITY_ROLLBACK_STEWARD` when such a row exists and still
performs only the function restore. It contains no `DELETE`. New stages for
those hubs then fail closed. The Saved rows remain.

## Owner changes required later

Do not apply these by editing the open pull requests from this branch. Each
owner applies them on that owner's branch.

### Packet 14 — Investor PR #230

Banner, first lines of both files:

- `14-ask-prod-investor-authority-forward.sql`
- `14-ask-prod-investor-authority-rollback.sql`

```
SUPERSEDED BY PACKET 19 — DO NOT APPLY IN PRODUCTION
The production authority transition is 19-ask-prod-network-authority-forward.sql.
This file remains the audited predecessor. Its rollback is not a safe undo
after packet 19: packet 19 rollback restores the three-hub body only from the
packet 19 body, and this rollback refuses any other body.
```

`14-ask-prod-investor-crd-binding-forward.sql` and
`v23_private.prod_investor_crd_binding_for(text)` stay hub-specific.
`prod_investor_issue_context` stays the Investor account-context issuer.

`14-ask-prod-investor-crd-preflight.sql` result 4 now treats
`position('lender','investor' in authority prosrc) > 0` as "packet 14
authority is already applied." Packet 19's list contains that substring, so
result 4 returns a row after packet 19 even though the installed function is
not packet 14's four-hub body.

Replace that authority predicate:

- no row when the body is the three-hub baseline (bindings may proceed;
  packet 19 owns authority)
- no row when the body is the packet 19 final body (do not apply packet 14's
  authority forward or rollback)
- a HOLD row when the body is packet 14's exact four-hub body or any other
  body, telling the operator to stop and use packet 19

Runbook: bindings may be applied before packet 19. Do not apply the packet 14
authority forward or rollback in production.

### Packet 16 — Contractor PR #232

Same banner on:

- `16-ask-prod-contractor-authority-forward.sql`
- `16-ask-prod-contractor-authority-rollback.sql`

`16-ask-prod-contractor-dbpr-binding-forward.sql` and
`v23_private.prod_contractor_dbpr_binding_for(text)` stay hub-specific.

`16-ask-prod-contractor-dbpr-preflight.sql` result 5 matches
`c->>'hub' in ('move','insurance','lender','contractor')`. Packet 19's list is
`('move','insurance','lender','investor','contractor','senior')`, which does
not contain that substring. After packet 19, result 5 is empty. The current
comment says an empty result 5 means the three-hub body is still installed and
is the precondition for the packet 16 authority forward. That reading is false
once packet 19 exists, and applying the packet 16 authority forward then
raises because the body is not the three-hub predecessor.

Change result 5:

- no hold on the three-hub baseline, and the next authority step is packet 19,
  not `16-ask-prod-contractor-authority-forward.sql`
- no hold when the body is the packet 19 final body (the six-hub list and the
  `contractor_profile` / `fl.dbpr.license` guard). Report network authority
  final.
- HOLD when the body is packet 16's exact contractor body or any other
  unrecognized body. Do not re-apply the packet 16 authority forward.

Runbook: do not apply the packet 16 authority files in production. Packet 19
admits `contractor_profile` / `fl.dbpr.license`.

### Packet 17 — Senior PR #233 and stacked PR #235

The authority forward and rollback are the same bytes on both heads. Put the
same banner on both files on the branch that will merge:

- `17-ask-prod-senior-authority-forward.sql`
- `17-ask-prod-senior-authority-rollback.sql`

`17-ask-prod-senior-ccn-binding-forward.sql` at the stacked head and
`v23_private.prod_senior_ccn_binding_for(text)` stay hub-specific.

`17-ask-prod-senior-ccn-preflight.sql` result 6 sets `senior_admitted` from
the bare token `senior` inside the hub-list substring. The comment says to
apply `17-ask-prod-senior-authority-forward.sql` when that flag is false.
After packet 19 the flag is true, and it would also be true for a list-only
append that has no `cms_facility` guard.

Replace result 6:

- `network_authority_final` is true only when `prosrc` is the packet 19 body:
  the six-hub list, the `cms_facility` guard, and `cms.ccn`
- when the body is the three-hub baseline, the flag is false and the operator
  applies packet 19, not the packet 17 authority forward
- a bare `senior` token without `cms_facility` is not final

Runbook: do not apply the packet 17 authority files in production.

### Shared consequence for all three rollbacks

Packet 14, 16, and 17 authority rollbacks are not a safe undo after packet 19.
Each refuses a body that is not its own successor. The only authority rollback
in the production procedure is `19-ask-prod-network-authority-rollback.sql`,
and it requires steward review once any of the three hubs has a Saved row.
