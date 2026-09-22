# V2-3-FINAL-PARENT-WIRING — Builder 4

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
