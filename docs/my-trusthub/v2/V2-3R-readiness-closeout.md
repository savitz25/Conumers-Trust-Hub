# V2-3R integration readiness and independent QA

Parent starting head: `bc29677694bb65ec3d86ff20f46809a4cc6bb8f3` (PR185).
No production/backend connection, provisioning, migration application, credential
creation or specialist runtime edit. Recovered laptop environment is not ruled out.

## Independent specialist review

Move PR157 exact `f317fd87847e4ba27e7d0d74ca9eb99207ea11b5`: **ACCEPTED FOR
ISOLATED INTEGRATION**, conditional on supplying the documented isolated ports.
Read `selection.ts`, adapter, HTTP handler, facade, server binding, UI and tests;
reran all 16 adapter tests PASS. No concrete specialist defect found.

| Contract boundary | Evidence |
| --- | --- |
| Guest Save versus conversion | Existing local action default unchanged; separate explicit Keep control behind absent/off flag |
| Minimal transfer | Strict slug/savedAt/revision/digest projection; rejects extra fields, notes/tools/consumer IDs; no raw research in form |
| Identity | Server exact Company.id/class/publication/binding mapper; missing binding local/review-only, no slug-as-network UUID |
| Staging | 50-item/count/body bounds, exact same-origin/Fetch-Metadata, CSRF cookie/header, opaque browser-bound ticket/TTL, durable-store port |
| Success | Receipt lookup plus exact verification, context/item/digest/Project match, current grant rechecked after async calls |
| Failure/races | Device copy retained, unavailable distinct, owner changes cannot rebind ticket; separate Project outcome |
| No Watch | No Watch call surface; default deployed binding returns null, unconditional production deny |

This accepts the specialist contract implementation, not a live sync claim. The
parent must reconcile its browser-initiated request keys with the source ticket's
request prefix through the authorized acknowledgment port. That mapping is still
an integration binding dependency, not permission to infer success from a query.

## Parent code delta

- Concrete fixed form target `/my/profile-save` (GET/POST Route Handler), strict
  form size/fields, opaque cookie, source-origin check plus independently verified
  source-channel port, explicit selected-profile/account confirmation and optional
  server-authorized Project choices. Sign-in preserves this allowlisted path.
- Actual parent runtime consume/commit invoked after confirmation; receipt-backed
  result, bounded profile return, `/my/saved`, local-copy/no-Watch disclosure.
  Session/owner changes before/after async work deny current-context success.
- `receiptRecovery` is a fresh server-authenticated capability for ONE exact
  accountContextRef/requestKey. Lookup uses current verified owner, stored receipt
  owner/hub and 30-day recovery bound. Five-minute reauth proof does not revive
  grants, permit commits or replay P13. Browser JSON cannot set this capability.
- Source retrieval and acknowledgment are explicit S2S ports. Browser tests fetch
  a separate mocked source snapshot rather than reading parent's staging tables.
  Production/deployed bindings remain null; no SQLite fixture attached to Next.
- Prepared bounded metadata-only cleanup batches: stage/continuation/grant one
  hour (authority still expires at ten minutes), receipts 30 days, quota one day.
  No consumer Saved/Project/notes deletion. No cleanup worker invoked or deployed.

## Transaction model — PARTIAL, not falsely declared finalized

P12 Save and optional Project savepoint plus receipt must share one serializable
connection/transaction. Existing owner-checking P12 functions remain authoritative;
no service_role/BYPASSRLS shortcut. Proposed exact receipt-consumer capability,
forward/rollback and forced-RLS/negative assertions are in
`V2-3R-permission-{forward,rollback,assertions}.sql`, UNAPPLIED and UNRUN.
The proposal grants only required P12 routines and owner-filtered receipt access,
no login/membership, no base research writes or new SECURITY DEFINER function.

It deliberately does **not** grant this role broker/stage/grant access. The final
broker-to-consumer transactional authorization and verified subject installation
still need a reviewed implementation; the current generic PostgreSQL backend
cannot be wired with this role alone. Do not treat this partial proposal as a
ready migration. Real PostgreSQL locking, grants and RLS tests remain NOT RUN.
Browser durable confirmation store, cross-service receipt mapping, current-session
reauth verification and quota ports also remain unbound. Parent verdict PARTIAL.

## Minimal environment reconciliation

The A–N recipe and Move spec agree on recovery-first isolation. Corrected the
recipe's founder-canary wording to ordinary invitation eligibility (not a new
product decision). No new registration/pilot activation in production.

| Classification | Dependency |
| --- | --- |
| REQUIRED; ALREADY IN REPOSITORY | Managed isolated Auth + P11/P12/P13 exact migrations/tests; published profile mapper and one reviewed exact network binding |
| REQUIRED; ALREADY IN REPOSITORY as proposal/ports | V2-3 source/parent/confirmation storage, receipt RLS, scoped BFF, browser path, owner reauth, retention |
| REQUIRED | Two ordinary approved isolated consumers, exact Ask/Move origins/callbacks, safe mail/CAPTCHA where tested, session/CSRF and source identity |
| NOT REQUIRED | P14–P19 Watch/Alerts/observations/notifications/export/delete; no later migration is included without a demonstrated dependency |
| NOT REQUIRED for first Save | Project assignment, legacy-account linking, calculators/inventory/comparison transfer, second hosted DB if approved local source can serve isolated profile/store |
| REQUIRED for optional Project QA | P12 owned Project fixtures and membership success/failure/isolation |
| NEEDS LAPTOP VERIFICATION | Active approved environment, schema/role state, safe endpoint bindings, ordinary-user/inbox availability, approval/lifetime evidence |
| NEEDS NEW EPHEMERAL ENVIRONMENT | NOT ESTABLISHED. Only if recovery proves unsuitable and founder separately authorizes provisioning |

Full Move page may have additional read-model dependencies; map them in isolated
fixtures, never attach production to satisfy a build. Existing canonical build
guard needs an approved isolated path, not disabling. Parent browser route is now
concrete, but flags do not install missing runtime bindings.

## Independent legacy re-QA

Insurance PR55 `84f54f5ac1fce816d58d9934650e17d3dc1ea806`: **PASS** for the scoped
legacy Save matrix. Full browser fixture PASS reload accessible device disclosure,
owner-confirmed legacy distinction, duplicates, loading, storage/error recovery,
cloud failure honesty, navigation/account race, 1440/390/320 keyboard/focus.
48 controls yielded ONE shared confirmation read. Independent extra check: 48
guest controls zero reads; failed owner tenure one read; logout/re-entry retry one
new read; expanding to 60 controls zero extra reads. Source review confirms actual
provider owns the hook. This is not a claim that provider/navbar perform zero other
reads. Thread `PRRT_kwDOTJsMfc6kCgcl` was already resolved when independently queried;
exact-head PASS comment posted, no redundant resolve mutation. N+1 **CLOSED**.

Lender PR52 `2b836356871694441e39daf867e490d58a3ebef4`: **PASS** for scoped legacy
Save. Default browser matrix passed; actual provider/control/storage/sync fixture
passed delayed auth/pull, owner-confirmed reload, signout stale pull and A→B late
push without B success/research write. Seven actual sync/storage deterministic
tests passed same-owner success, A→B/guest/away-and-back, stale error and queued
push. No calculator/comparison schema touched; preservation covered by storage
fixtures and unchanged-state assertions. Separate localhost incident untouched.

Evidence: BROWSER + LOCAL INTEGRATION; Auth/cloud MOCKED. No real provider/backend
QA performed. Move legacy PASS at corrected PR156 is prior independent evidence;
this run reviewed PR157's default-off separation. Three-hub scoped legacy QA
**CLOSED**; no claim of three-hub parent synchronization or six-hub certification.

## Laptop checklist (no secrets)

Please identify only names/status/provenance, not raw .env files or secret values:

1. Documentation identifying an active approved isolated Supabase project/branch
   or local stack; approval, owner and expiration/deletion status.
2. Whether old nonproduction .env files exist; variable NAMES and intended
   environment identity only. No passwords, keys, tokens, links or allowlist values.
3. Ask nonproduction Auth/backend binding and Move nonproduction BFF/source-store
   binding; classify each as active, expired, unknown or deleted.
4. Test-only callback/origin allowlist and BFF public key identifiers/service scope
   names; do not share private signing material.
5. Existing isolated ordinary Auth users and approved inbox/mail sink availability.
6. Evidence environment remains active and is not production-connected. Recovered
   files alone are not proof. Verify suitability before creating anything else.

First Move binding remains BLOCKED; see `V2-3R-first-move-binding-review.md` for
exact missing source provenance/network conflict lookup/steward decision.

Production mutations NONE. Real Move → My TrustHub sync NOT YET VERIFIED.

## Validation actually run

- `check:my-trusthub-v2-3-runtime`: 17 tests + local HTTP harness PASS.
- `check:my-trusthub-v2-3r`: 5 new browser-handler/retention tests PASS using real
  runtime + SQLite and mocked Auth/source service. Initial fixture incorrectly
  posted expiresAt alongside continuationRef; strict parser correctly denied it.
  Fixture corrected to frozen one-field form; security assertions retained.
- `check:my-trusthub-v2-2`, `check:my-trusthub-v2-3`: PASS.
- `npm test`: PASS, repository script exit 0; not a live-provider suite.
- Typecheck PASS; lint PASS with seven unchanged warnings; build PASS (102 static
  pages, concrete dynamic `/my/profile-save` route); diff whitespace PASS.
- Local parent HTML browser fixture: labeled unchecked explicit consent, optional
  Project, keyboard submission to honest unavailable state; no overflow at
  1440/390/320; no console errors. Provider ports MOCKED/unavailable. This does not
  certify real Auth cookies, cross-domain POST or a successful browser account Save.
- Extra independent browser storage checks preserved Insurance plan notes/tool
  payload and Lender plan notes/calculator inputs/outputs/comparison after Save.
- PostgreSQL permission/cleanup scripts NOT RUN; real Auth/BFF/provider integration
  NOT RUN. No production credentials, URLs or secrets loaded for tests.

Browser store crash consistency is still a binding gate: persisting the consumed
context/receipts must survive lost responses and cannot roll back external parent
commits. The port requires durable locking; the test Map is not deployable storage.
The partial transaction proposal is not a substitute for final security review.
Supabase least-privilege and Next/browser skills informed these boundaries.
