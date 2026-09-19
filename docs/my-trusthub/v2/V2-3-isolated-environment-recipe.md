# V2-3 minimum isolated integration environment — approval recipe, NOT execution

V2-3F update: use `V2-3F-isolated-checklist.md` as the single current executable
approval checklist. Its fourth migration and least-privilege role model supersede
the earlier permission/storage proposal below. Nothing is authorized to run yet.

Date: 2026-09-19. PR #185 remains draft/open; production HOLD.
ISOLATED BACKEND = PENDING FOUNDER/LAPTOP VERIFICATION.
No active approved backend is identified on this computer. This does not establish
that none exists elsewhere. Do not connect to historical deleted branch references.
No provisioning, credentials, permissions, migrations or environment changes are
authorized by this document. All setup/teardown instructions below are conditional
on a separate founder authorization naming the exact isolated target.

Runtime basis: `2e7a467ec8b0f959a7a77dfbde64956b23fc2322`;
contract baseline: `b194642d56d31d90eeacd9458cf29266cfc6fc07`;
immutable specialist interface: `26c4e9ed5c2d6ed8fbf3b3712516b7bbfdee3cd2`.

## A. Required Supabase branch baseline

One isolated parent Supabase backend with its OWN Database and Auth, schema-only,
no production users/customer research, and no active schedulers/webhooks/email jobs.
Prefer recovering/verifying an existing approved environment first. If a new one
is approved, use a clean compatible parent baseline with Supabase-managed Auth,
roles/extensions and the three forward migrations below; record engine version,
migration ledger and checksums before applying anything. P20 documented PostgreSQL
17.6.1.141 and `20260907170303 remote_schema` at rehearsal time, not a current
requirement to restore that exact managed engine or replay an unavailable dump.
Review any inherited schema/settings before use: a fresh branch is not proof that
inherited functions, outbound integrations or Auth redirect configuration are safe.
Do not blindly run all repository migrations: later migrations include Watch,
Alert, notification, export and deletion runtimes outside this test.

## B. Exact P11/P12/P13 migrations required

In this order, from `supabase/migrations/`:

1. `20260907160000_my_trusthub_identity_foundation.sql`
2. `20260907190000_my_trusthub_saved_projects_guest_import.sql`
3. `20260907220000_my_trusthub_cross_hub_handoffs.sql`

P11 supplies `network`, `consumer`, `ops`, identity/binding governance and canonical
consumer identities. P12 adds Saved/Projects/private notes and owner-checked RPCs.
P13 supplies browser-bound one-time exchanges, hub registry and scoped BFF roles.
Their role creation/grants are part of the FUTURE approval, not permission to apply
them now. Do not replay already-applied migrations; compare ledger/schema first.
Run their checked-in SQL validation suites in the isolated target and retain
sanitized results. Historical 31/56/58 passes are not new-environment evidence.

Exact validation files: `supabase/tests/p11_identity_foundation.sql`,
`supabase/tests/p12_saved_projects_guest_import.sql`, and
`supabase/tests/p13_cross_hub_handoffs.sql` (review fixture setup before execution).

## C. Exact V2-3 proposed schema

`docs/my-trusthub/v2/V2-3-parent-storage-proposal.sql` is the current exact artifact,
NOT an executable-ready approved migration. It defines:

- `ops.v23_profile_runtime_records`: `(kind,key_hash)` primary key; four allowed
  kinds stage/continuation/grant/receipt; 64-hex hash; bounded JSON-object payload;
  creation timestamp.
- `ops.v23_profile_runtime_quota`: hashed bucket primary key, minute window and
  positive counter.
- Enabled/forced RLS; revoked PUBLIC/anon/authenticated access; no role/policy grant.

Before application, prepare and review the narrow parent transaction capability,
RLS policies, ownership/session reauthorization for durable receipts, cleanup
indexes/retention and source-owned manifest/parent snapshot separation. Current
proposal alone intentionally cannot support runtime access. Generate the eventual
migration with `supabase migration new` once the reviewed design is ready; do not
invent an approved migration filename or treat broad service-role access as a fix.
No schema has been applied.

## D. Auth requirements

Use ONLY the isolated parent's issuer/JWKS/Auth URL and matching publishable key.
Verify current user/session server-side; derive canonical subject from verified
Auth, never browser JSON, email matching or user-editable metadata. Restrict
admission to approved ordinary invitation test identities; signup stays disabled.
Use server-controlled invitation eligibility, not the founder-specific canary
claim or user-editable metadata. Preserve internal founder policy unchanged.
Ordinary test users remain ordinary database users, not service/admin roles.
Use existing approved password login with confirmed test emails and CAPTCHA
configuration where the account UI requires it; do not weaken CAPTCHA to test.
No OAuth/SMTP/magic-link setup is needed for the minimum password-login journey.
Exact Ask preview origin/callback allowlist, host-only cookies, PKCE and current
session validation are required. Logout/session switch must invalidate authority.
Parent Auth is not the legacy Move account; no identity merging or signup opening.

## E. Ordinary test users

Minimum TWO isolated ordinary confirmed users: A and B. Both are admitted only
through the existing invitation QA mechanism without founder claims. A owns a Project and pre-existing
Saved row; B owns a different Project for negative ownership tests. A fresh browser
context supplies the guest (no anonymous Auth user required). Test denied admission
with a reversible isolated fixture change or a third ordinary non-admitted user
if separate stable credentials are preferable. No business/admin identity needed
for the minimum real journey; business-metadata bypass remains covered in fixtures.
Seed only synthetic profiles, notes and research, never copied production users.

## F. Parent BFF / narrow-role requirements

No parent service-role key in either browser or Move BFF. Existing P13 defines
`myth_handoff_broker`, `myth_consumer_api` and `myth_bff_ask`; these do NOT jointly
grant the current adapter all required transactional capabilities. P12 Save derives
ownership through `consumer.require_user()`/`auth.uid()` and is granted to
`authenticated`; P13 consume is broker-only. Review a narrow, parent-only capability
that preserves both checks and atomic receipt+Save commit. Do not solve this by
giving the BFF superuser/BYPASSRLS or blindly combining role memberships.
The scoped transaction must cover receipt storage, exact binding lookup and the
specific approved P12/P13 functions, use verified identity, TLS CA verification,
bounded pool/timeouts, and deny arbitrary subject/SQL/RPC selection. Actual RLS
and transaction tests are required; mocked SQL does not prove permissions.
Admin-only fixture setup, if separately approved, is outside deployed runtime.

## G. Move specialist BFF requirements

Builder 3 implements the adapter against the immutable six-operation interface.
Same-origin browser requests require CSRF/Origin checks; parent-bound requests
require a verified Move-scoped service assertion AND short-lived canonical-user
authorization, exact audience, expiry and replay protections. `myth_bff_move`
describes the narrow hub identity; it grants no parent consumer-table access.
Store selected manifests at the specialist server, transfer only explicit selected
items, keep notes/local records untouched, and bind continuation to browser intent.
Resolve Company slug to authoritative Company.id with class `mover`; never send
the fixture-only class/native IDs as live mappings. Use reviewed synthetic public
profile fixtures in an isolated Move data adapter or isolated specialist backend;
do not require a second database merely for the protocol, but do not claim the
real profile resolver verified when using fixture data. No legacy magic-link bridge.

## H. Required environment VARIABLE NAMES only

Existing Ask names (configuration semantics are specified elsewhere in this recipe):

```text
VERCEL_ENV
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL
NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_MY_TRUSTHUB_TURNSTILE_SITE_KEY
MY_TRUSTHUB_NONPRODUCTION_APPROVED
MY_TRUSTHUB_TEST_ORIGIN
MY_TRUSTHUB_TEST_SUPABASE_URL
MY_TRUSTHUB_ENABLED
MY_TRUSTHUB_ACCESS_MODE
MY_TRUSTHUB_CANARY_USER_IDS
MY_TRUSTHUB_CANARY_EMAILS
MY_TRUSTHUB_SIGNUP_ENABLED
MY_TRUSTHUB_AUTH_SECURITY_READY
MY_TRUSTHUB_SAVED_ENABLED
MY_TRUSTHUB_PROJECTS_ENABLED
MY_TRUSTHUB_SPECIALIST_HANDOFF_ENABLED
MY_TRUSTHUB_V23_PROFILE_SAVE_ENABLED
MY_TRUSTHUB_DATABASE_CA
```

Existing legacy scoped connection name (NOT a V2-3 binding or fallback):

```text
MY_TRUSTHUB_P13_DATABASE_URL
```

Reserved PROPOSED adapter names, not yet read by deployed code or provisioned:

```text
MY_TRUSTHUB_V23_DATABASE_URL
MY_TRUSTHUB_V23_PARENT_ORIGIN
MY_TRUSTHUB_V23_MOVE_ORIGIN
MY_TRUSTHUB_V23_BFF_ISSUER
MY_TRUSTHUB_V23_BFF_AUDIENCE
MY_TRUSTHUB_V23_BFF_KEY_ID
MY_TRUSTHUB_V23_BFF_PRIVATE_KEY
MY_TRUSTHUB_V23_BFF_PUBLIC_KEY
```

## I. Ask preview binding requirements

Pin the QA deployment SHA and exact HTTPS origin. Match account-policy's approved
origin/backend pair and branch-specific key; verify issuer/project reference through
approved metadata before login. Configure exact counterpart origins in the isolated
registry only; no wildcards or production aliases. Source-selected confirmation,
current Auth/P13 proof, optional owned Project reference mapping and the reviewed
PostgreSQL binding must replace today's `runtimeForRequest: null`. Flags alone are
insufficient. Keep production hard-denied; keep unrelated feature gates off.
Verify no fixture backend is imported by the deployed route. A green Vercel build
does not prove isolation; existing preview must not be used for authenticated QA.

## J. Move preview binding requirements

Pin Builder 3's adapter SHA and exact HTTPS origin, separately from closed V2-1
`35a83ca97f98fb5ee46bb849569808fd5e962a90`. Verify all auth/mutation destinations
are approved nonproduction, not inherited production Supabase defaults. Restrict
the BFF to the exact Ask QA origin/service identity. Preserve local storage key,
profile identity, notes, duplicate semantics and device disclosure across reload.
Use separate A/B browser contexts; leave legacy account mutations unavailable if
their own backend isolation is not established. Respect preview access protection;
do not bypass it or treat it as application authentication.

## K. Exact integration test sequence (after approval and code readiness)

1. Record both SHAs, both origins, isolated project identifier and migration hashes;
   prove no production target/fallback or outbound job enabled. Keep secrets out
   of the receipt. Run local contracts/runtime/typecheck/lint/build first.
2. Apply/reconcile only approved isolated migrations; run P11/P12/P13 SQL suites,
   RLS/advisor checks and V2-3 transaction/permission tests. Seed A/B, their Projects,
   accepted/review/unresolved synthetic identities and pre-existing research.
3. Fresh Move guest: Save promptly; assert local write, device disclosure, reload
   persistence and no parent claim. Record pre-transfer shortlist/notes checksum.
4. Explicitly select one item. Stage -> prepare continuation -> sign in as A on
   Ask -> show/confirm exact selection -> consume browser-bound P13 exchange.
5. Commit without Project; obtain durable receipt; lookup and independently verify
   exact manifest/item/profile/owner. Query isolated P12 to prove one A-owned Save,
   no membership, no Watch/Alert/public-data changes. Retain local copy.
6. Repeat/parallel-submit same request; assert same receipt and one Save. Mutate
   item/digest/Project under same key; reject conflict without mutation.
7. With a new request choose A's Project: one membership, no duplicate Save. Choose
   B's Project: ownership denied/Project failed, A's valid Save retained honestly.
8. Sign out/switch A to B, navigate profiles mid-flight, alter hub/audience/browser
   proof/return destination, replay/expire continuation; assert no wrong-owner write
   or receipt disclosure. Unknown/unpublished/ambiguous binding fails closed.
9. Interrupt before receipt commit and retry; prove rollback or stable committed
   receipt, never false success. Restart service and retrieve receipt. Exercise
   session renewal/grant expiry after the reviewed reauthorization path exists.
10. Block parent temporarily; verify device copy retained and sync unavailable,
    then recover without duplication. Reload both views; device-only vs confirmed
    parent state remains truthful. Keyboard/focus/status at 1440/390/320 widths.
11. Recheck research/notes checksum and ownership; publish exact-head sanitized
    evidence. Distinguish local Save, legacy account Save and parent sync. Any
    runtime SHA change requires renewed relevant verification.

## L. Teardown procedure (future authorized target only)

Close test ingress/disable QA gate, terminate/revoke isolated sessions and remove
QA bindings first. Preserve sanitized results/SHAs/migration hashes, not raw tokens,
cookies or user data. Verify exact isolated project/branch IDs against approval;
if an ephemeral branch was created for this run, delete THAT branch through the
approved control plane and confirm deletion/billing stop. Do not delete a recovered
shared environment without its owner's explicit teardown approval. Remove only
new run-specific test credentials/configuration under the same approval; do not
alter production or reused secrets. Close test browsers, clear run-specific local
data, and confirm both previews fail closed. No main merge or force-reset rollback.

## M. Current estimated hourly cost

Checked 2026-09-19: Supabase default Micro preview branch starts at **USD 0.01344/h**;
4 hours about $0.05376, 24 hours about $0.32256, plus actual disk/egress/storage or
other applicable usage/tax/plan charges. Not a spending authorization or capped
quote. Branches are not protected by Spend Cap. One branch is the minimum parent
backend; a separately required Move database would add its own cost.
Source: https://supabase.com/docs/guides/platform/manage-your-usage/branching

## N. Founder laptop recovery checklist

Recover identifiers/approval records first, not secret values into chat: any still
active isolated project/branch and ownership; schema ledger/dumps/checksums;
scoped-role design; approved local BFF/session/assertion adapter; test origin pairs;
Auth callback/CAPTCHA/inbox configuration; test-user identifiers; sanitized P11–P13
SQL harnesses/results; TLS CA source; fixture mappings; receipt recovery work;
preview access and teardown receipts. Credentials found there must be verified for
current scope/expiry/target through an approved secret channel, never assumed safe.
Historical P12/P13/P20 branches were deleted and are references only. The staging
and localhost registry entries are allowlists, NOT backend-existence evidence.

Environment is the external execution blocker. Binding, permission-design and
receipt-recovery code preparation remain active work, not evidence of live sync.
