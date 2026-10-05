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
| `17-ask-prod-senior-ccn-preflight.sql` | Read only. Results 1–5 must be empty. Result 6 classifies the installed `authority()` from its whole body: `baseline`, `network_authority_final` (certified packet 19), `legacy_packet17_hold`, or `unknown_hold`. A bare `senior` token is never read as final authority. |
| `17-ask-prod-senior-ccn-binding-forward.sql` | One active organization and one accepted exact binding per canary, plus the read-only resolver `v23_private.prod_senior_ccn_binding_for(text)` (normalized CCN comparison, btrim-hardened reader policy). Returns three receipt rows: `ccn, binding_id, network_entity_id, canonical_public_profile_ref`. |
| `17-ask-prod-senior-ccn-binding-rollback.sql` | One receipt row per execution. Closes that binding's validity window. Never deletes. Saved research is preserved. |
| `17-ask-prod-senior-authority-forward.sql` / `-rollback.sql` | **SUPERSEDED BY PACKET 19 — DO NOT APPLY IN PRODUCTION.** Kept for provenance and local recovery evidence only. |

No account-context SQL is in packet 17. Packet 15 creates the shared issuer and
packet 18 admits `senior` on it.

## Production order (future, operator, only on founder authorization)

1. Packet 15 — `15-ask-prod-hub-account-context-forward.sql` (shared account-context issuer).
2. Packet 18 — `18-ask-prod-senior-hub-context-preflight.sql`, then `18-…-forward.sql`
   (adds `senior -> https://www.seniortrusthub.com`).
3. Packet 17 preflight — results 1–5 empty; result 6 `baseline`
   (or `network_authority_final` if packet 19 is already in). Any HOLD stops.
4. Packet 17 binding forward only — `17-ask-prod-senior-ccn-binding-forward.sql`
   with both guards set. Keep the three receipt rows.
5. Packet 19 — `19-ask-prod-network-authority-preflight.sql`, then `-forward.sql`
   (the one network authority; certified PR #236 head `3b56570`).
6. Packet 17 preflight again — results 1, 2 and 4 show three rows each; 3 and 5
   stay empty; result 6 `network_authority_final`, `resolver_installed = true`.
7. Keys, environment, gates and canaries later.

Never apply `17-ask-prod-senior-authority-forward.sql` in production. If a legacy
packet 17 authority body is ever found (`legacy_packet17_hold`), converge with
packet 19.

## Account context

A Senior commit consumes its account context as hub `senior`. Senior uses the
shared hub router (`hub-account-context.ts`, `SHARED_HUB_ACCOUNT_CONTEXT`) and
`v23_private.prod_hub_issue_context(..., 'senior')`, which packet 18 admits with
the origin pinned to `https://www.seniortrusthub.com`. There is no Senior-specific
issuer or selection path.

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
packets 15, 18, 17 (binding) and 19 (read from PR #236 head `3b56570`) on an embedded Postgres and drives the real parent assembly: authority
packet, preflight, binding forward, resolver, fail-closed context seam, Save,
repeated Save, Unsave, every denial, tamper cases, rollback, and Move/Lender
regression. There is no stand-in issuer: packets 15 and 18 are the real ones.
