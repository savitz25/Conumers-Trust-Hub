# V2-3-FINAL-PARENT-WIRING-SQL-CLOSEOUT

## Post-Fable Gate 1 / Gate 2 remediation — prepared only

The PUBLIC net-schema revocation design described later in this historical
report is superseded. [The current review](platform-public-review.md) and
[Bot Team handoff](BOT-TEAM-HANDOFF.md) require pg_net and schema net to be
absent on the isolated preview. The packet supplies a read-only dependency and
queue preflight, disable without CASCADE, exact postcheck, and separately
authorized re-enable lifecycle. Re-enabling platform defaults deliberately makes
V2-3 Phase 5 fail. This branch-only rule is not a production architecture claim.

The runtime now models `DIRECT` and `SUPAVISOR_SESSION` explicitly. Transaction
pooling, port 6543, wrong pooler/project/user/database identity, URL options and
production fallback fail closed. Direct remains unsuitable for Vercel because
the branch endpoint is IPv6-only. Session mode stays inactive until the hosted
parity harness passes. The application pool maximum is two.

Phase 5 and closeout now account for temporary `myth_identity_governor` SET
authority and permit only the exact non-SET Supabase bookkeeping row after Phase
4. The confirmation login return canonicalizes only the bounded `auth=complete`
marker back to the bare cookie-bound path. Existing Move #156/#157 and immutable
preview browser evidence below are historical observations, not current
composition proof. Builder 3 must rebuild Move from current Move main. No hosted
mutation, Vercel change, stack rebase, merge or production action occurred.

The following PUBLIC ACL section is retained only as superseded historical
evidence and is not an activation procedure.

## Supabase PUBLIC ACL hardening — prepared only

At base `3f9c4f5e9bd720b6c49beb180add71edf1a5bfc0`, the packet proposed PUBLIC schema-USAGE revocation. That proposal was never successfully applied and is now retired; its deleted SQL must not be reconstructed or used.

Activation assertions now distinguish schema USAGE from object privileges, retain strict latent-grant checks on TrustHub schemas, and require the exact hardened net ACL. Disposable PostgreSQL ACL cases A–H, 20 hardening negatives, 15 activation negatives, 10 rollback guards, and the unchanged identity/lifecycle/receipt preservation suites passed. Full teardown restores the original platform ACL exactly after runtime removal. No runtime code, Move binding, or hosted Phases 1–4 were changed.

The sections below retain earlier ticket evidence; their readiness statements predate this newly required hardening gate.

## Hosted reverse-membership compatibility patch

Base: `e2369b812533892c084ef088c3327cf9030bbe7b`. The activation assertion now permits zero reverse memberships (disposable PostgreSQL) or exactly one with member `postgres`, granted role `myth_v23_parent_preview`, grantor `supabase_admin`, ADMIN true, INHERIT false, SET false. Any different member/grantor/flag or additional reverse row fails. The exact two outgoing memberships and their ADMIN false / INHERIT false / SET true requirements are unchanged.

This is a read-only assertion compatibility change, not a privilege change. Do not revoke the platform-managed reverse row. Runtime application code, grant/role creation SQL, the Move binding, and Phases 1–4 are unchanged by this patch. No hosted SQL or hosted inspection was performed; the hosted observation is the operator-provided input to this patch.

Disposable PostgreSQL 17.5 regression passed: the exact hosted tuple reaches `V23_PARENT_PACKET_ASSERTIONS_PASS`; zero reverse rows also pass; eleven altered reverse/outgoing cases fail. The test uses actual GRANT records in a separate disposable PGlite clone and no catalog DML. It temporarily names the local bootstrap administrator `supabase_admin`, matching PostgreSQL's grantor rules, then discards that entire clone. The original local database's roles/outgoing memberships remain unchanged. Negatives cover a different member/grantor, SET true, INHERIT true, ADMIN false, an additional reverse row, an extra/missing outgoing role, and each altered outgoing flag.

The full existing local packet suite also passed: 46 activation negatives, lifecycle teardown, 11 post-teardown negatives, and unchanged Saved/receipt/Project/FK preservation. Evidence: `C:\Users\Michael.Savitsky\.codex\tmp\v23-reverse-membership-local.log`. This patch is ready for the operator to resume Phase 5; it does not certify the hosted database or resume activation itself. PR #185 and production remain HOLD.

The remaining report records the earlier local closeout; its activation-status descriptions are historical, not a new observation of hosted state.

## Earlier local SQL closeout

Base: `4fca808a823101f2ad88e039634676b92e10cc2d`; PR #185. This closeout changes only the SQL packet, its documentation, and disposable local test coverage. Application/runtime code is unchanged.

The two reported gaps are addressed in prepared files: [exact steward retirement](move-binding-teardown.sql) and [fail-closed activation assertions](assertions.sql). [Teardown preconditions](teardown-preconditions.sql) retain same-session preservation evidence; [post-teardown assertions](teardown-assertions.sql) compare the resulting state against it. No hosted SQL, role, binding, Supabase/Vercel configuration, production operation or merge is authorized by this preparation.

**Verification status: PASS for disposable local PostgreSQL; packet ready for isolated SQL authorization review.** The clarified ticket explicitly permits disposable local SQL execution and prohibits every hosted/non-disposable database operation. Starting from local commit `65148f7513ff8892e7fc60bd341c7e5dc6e30582`, the complete packet was executed and corrected only in fresh, ephemeral PGlite instances running PostgreSQL 17.5. No database URL, hosted credentials, Supabase client, or remote database was used. Hosted application and runtime activation remain BLOCKED pending separate authorization and the ordered gates below.

## Schema and lifecycle basis

The committed certified schema in `supabase/migrations/20260907160000_my_trusthub_identity_foundation.sql` defines binding `valid_from/valid_to`, accepted-lifetime exclusions, canonical entity `retired` status, and audit triggers. It gives the identity governor SELECT/INSERT/UPDATE on identities/bindings, SELECT on redirects, and an explicit redirect function. There is no need for new privileges or a delete/merge path.

P12 in `20260907190000_my_trusthub_saved_projects_guest_import.sql` restricts entity deletion, but binding deletion would SET NULL on Saved `source_binding_id`. Project memberships and notes also have cascading dependencies on research rows. Durable V2-3 receipts retain identity/Save references in JSON as well as relational context. The retirement therefore performs no DELETE anywhere: it preserves the binding ID, entity ID, accepted historical provenance, Saved/Project links, browser confirmations and receipts. The entity becomes retired, so P12's existing eligibility check also refuses new Saves through it.

The steward must supply both exact IDs and provenance from approved forward output. The SERIALIZABLE retirement locks identity tables and exact rows, freezes redirects, rechecks the complete tuple/profile, rejects competing identities/other uses/redirects and closes the lifetime with a generated timestamp. Table locks precede the first snapshot-bearing read. The operator must already hold the required owner/lock privileges: the governor's SELECT-only redirect grant is insufficient for SHARE locking. No new grant is introduced to bypass this requirement. Reopening is a separately reviewed lifecycle action; this file does not automatically reverse retirement.

[PostgreSQL SET ROLE](https://www.postgresql.org/docs/17/sql-set-role.html) supplies the execution-context rules used by the authorizer check. [PostgreSQL locking](https://www.postgresql.org/docs/17/explicit-locking.html) supplies the lock semantics. The SQL project GUC remains only an operator attestation; independently authenticated host pinning is mandatory.

## Enforcing checks and preserved evidence

Activation assertions require exact forward IDs/provenance, one current accepted binding, one canonical profile/name, full tuple/status equality, no competing accepted lifetime (including class/jurisdiction/hub variations), no redirect, and exact agreement with `preview_move_binding()`. Missing private ports, unsafe login settings/memberships, direct or PUBLIC-derived raw table/column/sequence access, public wrapper execution, and wrong/missing origin pins fail the transaction. `preview_ports_ready()` must return true under `SET LOCAL ROLE myth_v23_authorizer`, followed by `RESET ROLE`. Only successful assertions emit the machine PASS marker.

The forward ports retain a private ACL/role baseline before modifications. Before cleanup, the same operator session captures that baseline, original origin arrays, exact identity rows and SHA-256 fingerprints/counts of every consumer table, protected ops tables and original browser confirmations. The post-check requires absence of preview login/reader/functions/tables/policies; equality with original ACLs, role attributes and memberships; exact restored origins; unchanged protected row contents/counts; and the exact recorded retirement without redirection or reassignment. Missing evidence or concurrency drift blocks success. No credentials are included in these baselines.

## Authorized activation order

Activation is strictly ordered, after separate founder authorization. Every failed or missing gate stops activation; partial success is **BLOCKED**, never READY.

1. Independently pin project `xkkiicsassizmakcvxml` and its actual TLS database host outside SQL.
2. Verify clean preconditions: reviewed P11/P12/P13/V2-3 certified objects, exactly two Ask/Move registry rows, no prior preview login/reader/wrappers/tables or preview-only grants, and the approved isolated operator. The guards at the start of `ports-forward.sql` enforce the catalog portion; a GUC does not authenticate the host.
3. Apply `ports-forward.sql`. It retains the original registry arrays and a private, non-secret ACL/role baseline before changing preview grants.
4. Create `myth_v23_parent_preview` with `runtime-role-forward.sql`.
5. Securely provision its password locally; keep all password/connection material server-only and out of SQL/output/reports.
6. Freshly reverify the exact Move identity is PUBLISHABLE within two minutes of binding apply.
7. Apply `move-binding-forward.sql`. Retain its returned `binding_id`, `network_entity_id`, and `provenance_ref` in the approved operator record.
8. Set `v23.binding_id`, `v23.network_entity_id`, and `v23.binding_provenance_ref` from that exact forward result, then run fail-closed `assertions.sql` with stop-on-error. Require `V23_PARENT_PACKET_ASSERTIONS_PASS`; inspect nothing into a PASS manually.
9. Run the separately authorized hosted V2-3 matrix. Preserve its exact evidence and cleanup boundaries.
10. Only after all prior gates pass, configure branch-scoped preview secrets/env and deploy the reviewed previews. No Production/all-preview defaults.
11. Complete Builder 3 final composition and verify both reviewed SHAs at the exact stable aliases.
12. Run the full Journey QA from the beginning, including real A/B login, consent, Save, receipt, isolation and zero Watch.

Never merge #185/#157 or promote production under this packet. Local test success does not certify hosted privileges or the browser journey.

## Separate authorized closeout

Use `teardown-preconditions.sql` -> `move-binding-teardown.sql` -> `teardown.sql` -> `teardown-assertions.sql`, with one independently pinned operator session, writers quiescent and connections drained. Require the separate retirement/teardown GUCs documented in [preview-env.md](preview-env.md), plus exact forward IDs/provenance. Preserve stop-on-error. Never reconstruct the original research baseline after failed cleanup.

## Disposable local PostgreSQL verification

`scripts/qa/v23-sql-closeout-cases.mjs` extends the existing `scripts/qa/v23-parent-wiring-postgres.mjs` disposable PGlite harness. The harness loads the actual certified PostgreSQL migrations and packet files, not SQLite or mocked SQL. It now uses the exact forward binding file and retained returned IDs, tests duplicate rejection and activation negatives, exercises the real P13/P12 Save/receipt path, and tests lifecycle retirement/full teardown/post-teardown failures while preserving research.

The local command `node --experimental-strip-types scripts/qa/v23-parent-wiring-postgres.mjs` (the command behind `npm run check:my-trusthub-v2-3-final-parent`) passed with exit code 0. Every rerun started a fresh ephemeral PostgreSQL database and closed/discarded it afterward. The existing hosted-matrix SQL file was exercised only inside that disposable local database; no hosted matrix execution is claimed. Source/Auth HTTP are fixtures, and local publication evidence is explicitly synthetic. The real hosted source must still be freshly reverified before any separately authorized binding application.

The first executions exposed three SQL defects: `operator is not unique: text || "char"` in the catalog snapshot, `ACL arrays must be one-dimensional` for empty ACLs, and `"information_schema_catalog_name" is not a sequence` when the planner evaluated a sequence privilege function before a relation-kind filter. Corrections add an explicit catalog-type cast, normalize empty ACLs to no privilege rows, and use CASE guards so object-specific privilege checks run only on valid object kinds. No authorization, identity, privilege, or preservation condition was weakened. A PUBLIC sequence-grant negative case verifies the corrected sequence check still rejects access.

| Disposable local check | Result |
|---|---|
| Clean certified baseline, ports-forward, runtime-role-forward | PASS |
| Actual Move binding forward SQL and duplicate rejection | PASS |
| Activation assertions and 46 negative cases | PASS; includes wrong binding/entity, a binding redirected to another entity, competing lifetimes, ports, resolver, origins, role/ACL and PUBLIC-access cases |
| Actual P13/P12 Save and durable receipt fixture | PASS |
| Nine retirement guard negatives plus repeat-retirement rejection | PASS |
| Exact binding lifetime closure and same-entity retirement | PASS; resolver returns zero current bindings afterward |
| Full parent teardown and post-teardown assertions | PASS |
| Eleven post-teardown failure cases | PASS; including missing/changed research, deleted receipts, residual roles/functions/tables/grants, wrong origins and reopened lifecycle |
| Zero residual preview roles/wrappers/tables/policies; original role/ACL/origin baseline restored | PASS |
| Zero Watch/Alert relations | PASS locally |
| Existing five parent wiring unit cases | PASS |

Preservation is non-vacuous: **1 Saved row -> 1; 1 durable receipt -> 1; 2 Projects -> 2; 1 Project membership -> 1; 1 additional consumer FK reference -> 1**. Full Saved/receipt query results and all protected row fingerprints remained equal. The extra FK deliberately uses ON DELETE CASCADE, so accidental identity deletion would fail preservation. Same-count research edits and receipt deletion were separately injected and correctly rejected by post-teardown assertions.

Targeted ESLint (zero errors/warnings) and `git diff --check` passed. Local evidence is `C:\Users\Michael.Savitsky\.codex\tmp\v23-sql-closeout-local.log`. The local packet harness is separate from the existing PR CI workflows; CI results for the exact pushed head are reported with publication. Embedded single-session PostgreSQL does not certify hosted managed-schema ownership, native multi-session concurrency, TCP/password login, or the browser journey. No runtime application code or hosted configuration was changed.

The implementation report below is historical evidence from the base commit. Its old local test PASS results do not validate this closeout's edited SQL.

---

# V2-3-FINAL-PARENT-WIRING — Builder 4 (historical base report)

Parent implementation and Builder 3 transport handoff are prepared on local branch `mth-v2-3-final-parent-wiring`, based on Ask `307da0b6f80f0b1635811f2b91f39b737b9f0afc`. Runtime activation remains blocked by unapplied SQL/secrets and unwired Move ports. No configuration, Supabase data/schema, Vercel environment, deployment, remote branch or PR was changed. Main and the original Ask/Move worktrees were untouched. No production database operation, production deployment or merge was performed.

The [handoff](BUILDER-3-HANDOFF.md) contains the final assertion carrier, Ed25519 algorithm, claims/scopes, exact origins, TTL, persistent nonce rules, body binding, key variable names, source callback additions and current-grant browser/BFF sequence. [Preview environment packet](preview-env.md) supplies the exact stable Ask origin correction and Save-only flags. It also pins Ask routing and transport to the existing stable Move branch alias for Builder 3's eventual packet; neither alias has been changed.

## Original observed failures preserved

Read the local JQA report at `C:\Users\Michael.Savitsky\.codex\tmp\v23-final-retest-20260922\REPORT.md`. That report and its evidence were not edited. At the requested immutable previews and SHAs, it observed:

- Ask → Move routing, guest local Save and reload passed.
- Move showed zero `Keep this in My TrustHub` controls. POST `/api/my-trusthub/profile-save` with bootstrap returned `503` and `{"state":"unavailable","localCopy":"keep"}`.
- Ask `/my/sign-in`, `/my/saved` and `/my/profile-save` returned `503`, `Account origin unavailable.` No password inputs rendered and no supplied password was submitted.
- Ask profile-save API returned `404`, `{"ok":false,"error":"disabled"}`.
- Parent browser/API deployment bindings and Move deployment ports were null. Isolated Move stage/quota tables were absent.
- No durable parent Save, authenticated A/B isolation or acknowledgment was established. The negative URL-marker test was partial proof only.
- Existing Move accessibility findings were 34 contrast nodes and one invalid definition-list node. These remain open for Builder 3; this parent change does not claim to fix them.

## Implemented locally

- Replaced the null parent API deployment binding with a strictly isolated hosted assembly. It verifies exact origin/project flags, direct TLS-pinned database host, restricted runtime login attributes and its two SET memberships, absence of raw-table access, new private-port readiness, isolated Auth service availability, authenticated source publication and the approved binding. Missing/unverified ports return unavailable. There is no admin, legacy Auth, SQLite or memory persistence fallback.
- Wired `/my/profile-save` to PostgreSQL confirmations, exact source callback retrieval, SDK-verified parent Auth plus live-session revocation, exact A/B admission, explicit consent, opaque owner-bound Project choices, real P13 creation/consume, P12 Save, receipt persistence and acknowledgment. Retry checkpoints retain the committed outcome.
- Added isolated `/my/saved` P12 list rendering without loading uninstalled Sessions/Watch objects or exposing the old canary UUID form. Added a preview-only account policy that prevents the workspace master flag from opening signup, email links, password recovery or credential changes. Production policy behavior is preserved.
- Implemented Ed25519 source authentication and a PostgreSQL nonce store. Added current-grant challenge/resolve APIs and the parent browser bridge. A fresh parent browser check, P13-derived confirmation and live session are required; acknowledgment alone is never authority. Account switch, superseded proof, copied browser binding and revoked session are denied.
- Prepared [private port SQL](ports-forward.sql), [runtime role SQL](runtime-role-forward.sql), [binding SQL](move-binding-forward.sql), [read-only assertions](assertions.sql) and [teardown](teardown.sql). Teardown preserves P12 research, original confirmations and durable runtime receipts. None was applied remotely.

## Verification

| Check | Result / limit |
|---|---|
| Parent V2-3 contracts and workspace gates | PASS: `check:my-trusthub-v2-3` |
| Existing runtime/deployment/browser suites | PASS: 23 tests, plus Move harness |
| Existing V2-3F PostgreSQL matrix | PASS locally; includes certified P11/P12/P13 and the existing hosted-matrix SQL executed in local PGlite |
| New wiring suite | PASS: five unit cases plus actual local PostgreSQL integration sequence |
| New local SQL integration | Signed staging, durable source link, explicit consent, actual P13/P12, receipts, reload/retry, replay rejection, A/B saved-list isolation, opaque Project list/foreign Project denial, browser current-grant transport, nonce replay, revoked session, role/ACL assertions and teardown preserving research |
| Account contracts after final account-policy change | PASS: 37 tests including the five new wiring unit cases |
| Exact supplied QA A/B admission | PASS locally against the supplied IDs; unconfirmed users and email-only fallback denied. No network calls or password login. The credential file remained unchanged; no values copied into artifacts |
| Stable branch origin / forgery negatives | PASS in new unit cases; immutable Ask origin, wrong pair, public mode, unsafe flags, wrong key, method, body, scope, service, timestamp and replay rejected |
| Search Reliability | PASS: `check:th-search-r1-016` and `check:search-release` |
| Full repository test command | PASS: `npm test` |
| Typecheck | PASS |
| Lint | PASS: zero errors, seven existing warnings in unchanged files |
| Build | PASS: `npm run build -- --webpack`, including 102 static pages and new dynamic routes. Default Turbopack build failed because the shared `node_modules` junction points outside its filesystem root; no build configuration changed |
| Zero Watch | PASS for local SQL/feature-gate assertions and final isolated read-only observation; no hosted successful-Save claim |
| Hosted new runtime matrix | NOT RUN: requires new SQL/login/binding authorization. The hosted connection was used read-only |
| Real browser journey | BLOCKED: new code/env/source transport is not deployed. No new browser/auth/Save PASS claim |

Local verification logs are under `C:\Users\Michael.Savitsky\.codex\tmp\v23-wiring-*.log`. These logs are not uploaded. The new suite runs with `npm run check:my-trusthub-v2-3-final-parent`. Its Auth and source HTTP are explicitly fixtures; the database routines and persistence are actual PostgreSQL. Local tests do not certify hosted managed-schema permissions, multi-process pool behavior, popup/opener behavior or real A/B password login.

## Fresh source and final hosted observation

At `2026-09-22T13:39:03.154Z`, a read from the approved immutable Move preview `/api/compare/companies?slugs=hindman-isaacs-moving-storage-inc` with a fresh cache-busting query returned HTTP 200, Vercel `MISS`, age `0`, and exactly one record:

| Field | Observed |
|---|---|
| id | `usdot-1002530` |
| slug | `hindman-isaacs-moving-storage-inc` |
| name/legal name | `Hindman & Isaacs Moving & Storage, INC.` |
| USDOT / MC | `1002530` / `421784` |
| publicationState | `PUBLISHABLE` |
| source entityType | `Carrier` |

The approved canonical entity remains `organization`, canonical name `HINDMAN & ISAACS MOVING & STORAGE INC`, with Move specialist class `mover`, `fmcsa.usdot`, accepted binding and `US` jurisdiction. The source's legacy `Carrier` label was not substituted for the approved canonical type. No binding was created. A new publication read is mandatory within two minutes of eventual mutation; this observation cannot be reused indefinitely.

Final isolated read-only SQL at `2026-09-22T13:54:30.322351Z` had `transaction_read_only=on`: two Auth users, both confirmed; zero sessions, saved entities, Projects, memberships, confirmations, runtime records, network entities or bindings; zero Watch/Alert relations. The new login and private ports were absent, and Move source stage storage remained absent. The isolated P13 Ask/Move staging-origin arrays were also empty in the earlier read. No production query was performed.

## Authorization stop and remaining gates

Per ticket sections 6–7, stopped before applying the concrete SQL. Founder authorization is needed for the private wrappers/tables, exact-session Auth RLS policy, isolated P13 registry entries, dedicated runtime login/password provisioning and exact Move binding creation. The approved runner must independently pin the host, inspect the existing managed-schema permissions, apply only the reviewed isolated packet and run hosted assertions/matrix. The SQL GUC is only an operator attestation.

Builder 3 must implement the signed `resolve` source operation and durable nonce store, wire source persistence/publication and parent service calls, and integrate the fresh parent browser current-grant bridge with real popup/CSRF/opener checks. Then provision the reviewed preview-only secrets and branch env, verify both intended deployment SHAs at their stable aliases, verify CAPTCHA at the stable Ask alias without bypass, and restart the entire Journey QA plan. Public signup, SMTP, Watches and Alerts remain closed. No message was posted to Slack/GitHub; the handoff is local.

`READY` below means the specified model/transport packet is implemented and reviewable. It does not mean it is activated or browser-certified. Runtime and confirmation remain blocked as deployed features until the listed gates are met.

```text
PARENT ORIGIN MODEL = READY
PARENT PROFILE-SAVE RUNTIME = BLOCKED
BROWSER CONFIRMATION = BLOCKED
PARENT RUNTIME ROLE = NEEDS AUTHORIZATION
MOVE TEST BINDING = NEEDS AUTHORIZATION
SOURCE ASSERTION CONTRACT = READY
CURRENT GRANT TRANSPORT = READY
READY FOR BUILDER 3 HANDOFF = YES
PR #185 = HOLD
PRODUCTION = HOLD
```

PR #157 also remains HOLD. No final synchronization, merge or production action is authorized by this report.
