# Packet 17 — Senior CMS nursing-home Save (Ask side)

Builder: C-B1. **Prepared only. Nothing here is applied, merged or deployed.**
Senior parent sync OFF. Senior canary OFF. No keys created.

## Scope (locked)

CMS nursing-home profiles only.

| | |
| --- | --- |
| hub | `senior` |
| profile class / specialist entity type | `cms_facility` |
| identifier namespace | `cms.ccn` |
| source identifier = specialist entity id | the exact CMS CCN (six letters or digits) |
| jurisdiction | `US` |
| canonical return / profile ref | `/facility/cms/<CCN>/<canonical slug>` |

The CCN is the identity. The slug is navigation only; the name is display only.
Home health, hospice, assisted living, Florida and Texas state-only facilities,
and administrators or persons are **not admitted** and stay device-only on
Senior. A CCN existing somewhere in Senior is not sufficient: the class, the
route, the binding and Senior's fresh source proof must all agree.

This matches `lib/my-trusthub/contracts/v2-3-profile-transfer.ts` as it stands
on main (`APPROVED_PROFILE_CLASS.senior`, `SENIOR_CCN`, `v3ReturnPath`,
`PRODUCTION_ORIGINS.senior`); the contract file is not changed.

## Canaries

| CCN | Route |
| --- | --- |
| `015009` | `/facility/cms/015009/burns-nursing-home-inc` |
| `055223` | `/facility/cms/055223/san-jacinto-valley-post-acute` |
| `155805` | `/facility/cms/155805/addison-pointe-health-and-rehabilitation-center` |

## Files

| File | Purpose |
| --- | --- |
| `17-ask-prod-senior-ccn-preflight.sql` | Read only. Results 1–5 must be empty; result 6 is the readiness row. |
| `17-ask-prod-senior-authority-forward.sql` | Adds the one token `'senior'` to the hub list of `v23_private.authority()`. **Required**: the installed function admits move, insurance and lender only, so a Senior stage is refused in the database without it. |
| `17-ask-prod-senior-authority-rollback.sql` | Removes that one token. |
| `17-ask-prod-senior-ccn-binding-forward.sql` | One active organization and one accepted exact binding per canary, plus the read-only resolver `v23_private.prod_senior_ccn_binding_for(text)`. Returns three receipt rows: `ccn, binding_id, network_entity_id, canonical_public_profile_ref`. |
| `17-ask-prod-senior-ccn-binding-rollback.sql` | One receipt row per execution. Closes that binding's validity window. Never deletes. Saved research is preserved. |

No account-context SQL is in packet 17. Packet 15 (G-B2) owns it.

## Order (future, operator, only on founder authorization)

1. `17-…-preflight.sql` — results 1–5 empty; `authority_installed = true`.
2. `17-…-authority-forward.sql`. If packet 14's authority packet (Investor) is
   also to be applied, apply it **before** this one: it requires the exact
   three-hub list, while this one accepts either reviewed list and preserves it.
   Roll back in the reverse order.
3. `17-…-ccn-binding-forward.sql` with both guards set. Keep the three receipt rows.
4. Preflight again: results 1, 2 and 4 show three rows each; 3 and 5 stay empty;
   `senior_admitted = true`, `resolver_installed = true`.

## Waiting on the shared account context (G-B2, PR #231 / packet 15)

A Senior commit consumes its one-time account context as hub `senior`, so it
cannot use the Move issuer. `senior-context-seam.ts` calls the shared per-hub
issuer `v23_private.prod_hub_issue_context(proof, subject, session, hub)` with
the hub fixed to `senior` on the server.

Packet 15 as prepared admits `lender` and `insurance` only. Until it also maps
`'senior' -> 'https://www.seniortrusthub.com'` (and its precondition checks that
origin is registered), a Senior Save is staged but fails closed at the commit:
no context, no Saved row, no acknowledgement. After rebasing onto PR #231, its
hub guard in `preview-assembly.ts` (`hub !== 'move' && hub !== 'lender' && hub
!== 'insurance'`) must also admit `senior`, or the Senior branch of the seam
must stay ahead of it.

## Environment (names only; no values exist)

Ask: `MY_TRUSTHUB_V23_SENIOR_KEY_ID`, `MY_TRUSTHUB_V23_SENIOR_VERIFY_PUBLIC_KEY_PEM`.
Senior: `MY_TRUSTHUB_V23_SENIOR_KEY_ID`, `MY_TRUSTHUB_V23_SENIOR_SIGNING_PRIVATE_KEY_PEM`,
`MY_TRUSTHUB_V23_ASK_KEY_ID`, `MY_TRUSTHUB_V23_ASK_VERIFY_PUBLIC_KEY_PEM`.

Without the Senior verify key, Ask refuses every Senior hand-off and Move,
Lender and Insurance are unaffected.

## Senior side

Senior PR #64 (`mth-sen-001-shared-handoff`, `4605b7d`) stays draft. Its
migration `0036_my_trusthub_handoff_acks.sql` is not applied. Its `web` check is
red on five docs files it does not touch; the same check fails on Senior main.

## Proof

`npm run check:mth-senior-ccn` — unit tests, then
`scripts/qa/v23-senior-ccn-postgres.mjs`, which applies the real migrations and
packets on an embedded Postgres and drives the real parent assembly: authority
packet, preflight, binding forward, resolver, fail-closed context seam, Save,
repeated Save, Unsave, every denial, tamper cases, rollback, and Move/Lender
regression. The harness installs a local stand-in for the shared per-hub
issuer to prove the path after the seam; that stand-in is not a packet.
