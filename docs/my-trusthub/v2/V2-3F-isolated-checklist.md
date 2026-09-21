# Single isolated integration checklist — NOT AUTHORIZED TO EXECUTE

Supersedes setup portions of the A–N recipe for this vertical slice. Recover an
approved laptop environment before proposing a new one. No active environment has
been identified on this computer; this is not evidence that none exists elsewhere.

## 0. Approval and immutable inputs

- [ ] Founder names exact isolated project/branch, owner, budget (if new) and permitted
  setup/teardown. NEW EPHEMERAL ENVIRONMENT is conditional, not currently authorized.
- [ ] Ask PR185: pin the immutable commit containing this checklist; `git rev-parse
  HEAD` must equal the reviewed PR head and deployed revision. Starting base:
  `203c24d1d5597641bcbc1a130d9fe7e363392c3c`. Record the new exact SHA in QA evidence.
- [ ] Move157 exact `f317fd87847e4ba27e7d0d74ca9eb99207ea11b5` or newly reviewed revision.
- [ ] Resolve remaining concrete parent deployment-port code in V2-3F-hardening.md.
- [ ] Approved exact Move binding/provenance packet. Synthetic binding alone does
  not certify `usdot-1002530`.

## 1. Minimum DB — REQUIRED, scripts ALREADY IN REPOSITORY

Verify empty/schema-only isolated Supabase Auth + PostgreSQL, extensions pgcrypto
and btree_gist, TLS CA, no copied customers, production callbacks or outbound jobs.
Use only this order (not repository-wide db push):

1. `20260907160000_my_trusthub_identity_foundation.sql` (P11)
2. `20260907190000_my_trusthub_saved_projects_guest_import.sql` (P12)
3. `20260907220000_my_trusthub_cross_hub_handoffs.sql` (P13)
4. `20260919205200_my_trusthub_v23_transaction_capability.sql` (UNAPPLIED V2-3F)

- [ ] Record checksums/ledger; reconcile existing migrations rather than replaying.
- [ ] Do not apply older V2-3/V2-3R proposal SQL alongside step 4.
- [ ] P14–P19 NOT REQUIRED. Watch/Alert/notification jobs NOT REQUIRED and must not
  be activated. Inventory/calculator schemas NOT REQUIRED.
- [ ] Apply narrow role grants from step 4 only after approval. Parent-only approved
  login needs SET ROLE capability for authorizer/executor/browser_store, no admin
  option, no ownership or BYPASSRLS. Never grant foundation membership. Specialist
  BFF receives no parent DB credential. Cleanup has a separate approved operator.
- [ ] Verify role membership semantics on target engine; negative-access tests with
  actual role credentials, FORCE RLS and no direct P12/P13 runtime grant.
- [ ] Browser store requires dedicated/session-affine pool, not transaction pooler.

## 2. Auth, BFF and origins — REQUIRED / NEEDS LAPTOP VERIFICATION

- [ ] Two ordinary confirmed isolated users A/B, invitation eligibility without
  founder claims; signup remains OFF. A/B each own a test Project. Fresh guest
  browser is not a third Auth identity. No copied production identity/research.
- [ ] Ask browser origin -> callback -> Auth issuer/backend -> DB all name the
  same approved isolated environment. Exact callback allowlist, PKCE, host cookies,
  session refresh/logout and required CAPTCHA. No production fallback.
- [ ] Move source/browser/P13 intent and Ask target origins registered for isolated
  environment only. Fixed-target POST; state/nonce/browser proof; issuer Move,
  audience Ask; service `svc:trusthub:move:bff:v1`; stage/saved/receipt scopes only.
- [ ] Move owns bounded staged manifests and request prefix. Parent uses narrow
  authenticated S2S retrieval/ack, not shared fixture storage. No notes/tools sent.
- [ ] OPTIONAL: separate Move DB only if required by approved publication resolver;
  profile fixtures can prove protocol but not real identity provenance.

## 3. Names-only configuration inventory

Existing account/gate names (values and credentials stay out of chat/artifacts):

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
MY_TRUSTHUB_PREVIEW_ACCOUNT_ACCESS
MY_TRUSTHUB_ACCESS_MODE
MY_TRUSTHUB_INVITED_USER_IDS
MY_TRUSTHUB_INVITED_EMAILS
MY_TRUSTHUB_SIGNUP_ENABLED
MY_TRUSTHUB_AUTH_SECURITY_READY
MY_TRUSTHUB_SAVED_ENABLED
MY_TRUSTHUB_PROJECTS_ENABLED
MY_TRUSTHUB_SPECIALIST_HANDOFF_ENABLED
MY_TRUSTHUB_V23_PROFILE_SAVE_ENABLED
MY_TRUSTHUB_DATABASE_CA
```

Reserved adapter names, NOT evidence of deployed readers or existing credentials:

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

NEEDS LAPTOP VERIFICATION: active environment identity/status, approved bindings,
current scoped key identifiers, callback configuration, users and permissions.
Do not paste .env files, private keys, tokens, passwords or authentication URLs.
No legacy P13 connection or service_role fallback. Exact Move env mapping remains
its published adapter handoff; do not invent synonymous variables during setup.

## 4. Execute only after approval and remaining code closure

- [ ] Local `check:my-trusthub-v2-3f`, V2-3r/runtime/contracts, V2-2, typecheck,
  lint/build; target SQL security suite, rollback rehearsal and engine parity.
- [ ] Guest Save -> reload device disclosure -> explicit Keep action -> staging
  -> parent login A -> confirmation/optional Project -> P13 -> exact binding ->
  P12 + receipt -> verified source acknowledgment -> bounded Move return -> /my/saved.
- [ ] Prove one Saved row, retained device copy, no notes/tool changes and zero
  Watch/Project (unless explicitly selected) or signup side effects.
- [ ] A Project succeeds; B Project fails separately while Save survives. Retry
  and lost response return the same receipt. Changed manifest/Project conflicts.
- [ ] Expired grant + fresh A session recovers own receipt, never renewed write
  permission. B cannot retrieve A receipt. Expired/replayed/forged P13 denied.
- [ ] Crash before/after P13/checkpoint/receipt; restart; stale owner response,
  logout, account switch; publication/revocation recheck and missing binding.
- [ ] Keyboard/status at 1440/390/320; privacy-safe evidence tied to both SHAs.

## 5. Exact teardown — separate authorized isolated target only

- [ ] Close test ingress/gates; revoke isolated sessions and approved login
  memberships; remove only run-specific preview bindings. No production changes.
- [ ] Preserve sanitized SHAs, migration checksums, counts and outcomes; no tokens.
- [ ] Recovered/shared environment: use revocation rollback only if approved; do
  not delete environment or identities/research. Newly authorized ephemeral branch:
  verify exact ID against written approval, delete only that branch, confirm status
  and billing stop. Never use stale backup/force reset as rollback.
- [ ] Clear only disposable test browser/local fixture data; verify routes closed.

Checklist READY for founder environment decision; execution still blocked on
concrete adapter ports, approved binding, target verification and separate authority.
