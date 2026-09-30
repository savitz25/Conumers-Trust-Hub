# ATH-MTH-ARCH-001 — My TrustHub identity and environment map

Status: documentation only. Audited 2026-09-30 from repository `origin/main`, the unmerged V2 branches named below, Vercel project and environment metadata, GitHub deployment records, and live public responses. No Vercel setting, Supabase Auth setting, SQL, RLS policy, redirect, password, or production header was changed. Secret values were not printed and are not in this document.

This file is the canonical location for the map. Current Ask `main` has no `docs/my-trusthub/v2/` tree. The flat `docs/my-trusthub-*.md` files are Phase 2 cutover records. `docs/control-plane/` is the research and claim inventory, not the consumer identity map. This path is the V2 architecture series this ticket starts.

Governing decision, founder-adopted, not reopened here:

ONE IDENTITY. SPECIALIST TOOLS. PARENT SAVED/PROJECTS. SAVE ≠ WATCH.

Generation 1 was one intended shared consumer identity with vertical workspaces. Move was the temporary Auth UX bridge. V2 completes the handoff to Ask. This ticket does not implement the continuation contract. It records the contract so later tickets cannot mix the projects below.

PR #185 (`mth-v2-3-parent-runtime`, head `b885a651d1b229f8c6acbc5888733af08f4a5e5d` at audit time) stays draft and unmerged. This map is not part of that pull request. Move PR #169 (`mth-v2-3-move-current-main`, head `73bc86e503a57fc52d420a1c339c7fd8b912e2af`) was read and was not modified.

## 1. Executive summary

Seven names that must not be swapped:

| Layer | Project ref | What it is |
| --- | --- | --- |
| Legacy production consumer identity | `arepfylnilkjmyduhwbz` | Live Move browser and service Supabase project. Historical shared Gen1 IdP. Not Insurance. Not Lender. Not Ask. |
| New Ask production identity | `qvvxvbcdmbjzrgvwjatw` | Intended permanent My TrustHub consumer authority. Production source admits only this host. The production env value is encrypted and was not read. |
| Isolated Ask QA | `xkkiicsassizmakcvxml` | Ask preview branch `mth-v2-3-parent-runtime` only. QA. Never a production IdP. |
| Specialist preview isolation | `zvoijbohtyuhqfuvteoy` | Move preview branch `mth-v2-3-move-current-main` browser project. Not Ask. Not User A. |
| Production specialist Auth | Move `arepfylnilkjmyduhwbz`; Insurance `gojyhmbojbwbpiamoktq`; Lender `hidcrbexurginnuqgipx` | Three different live projects. Docs that still say they share `arepfyl` are stale. |
| Business claim Auth | No separate Supabase ref verified | Claim handoff uses `ATH_HANDOFF_SECRET` and Ask `/manage`. It is not My TrustHub consumer Auth. |
| Consumer Auth | Ask `/my` on the Ask consumer project | Target owner is Ask. Live Gen1 workspaces still sign in on the specialist projects above. |

The live network is already split. A Move session does not create an Ask session. An Insurance session is not a Move session. Lender's handoff health check succeeds on `hidcrbexurginnuqgipx`, which is a different project from Move. Insurance's live host is `gojyhmbojbwbpiamoktq`, and its handoff consume function is missing. Move's handoff table probe fails on `arepfylnilkjmyduhwbz`.

Ask production code at `057ac969f7e016b742fd3d42789e65b488e2c938` will build a My TrustHub client only when `NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL` is exactly `https://qvvxvbcdmbjzrgvwjatw.supabase.co`. The V2 branch replaces that pin with a pair check: production must be that host plus `https://www.asktrusthub.com`; preview must be a matched non-production origin and a backend that is not `qvvxvb`. The reviewed preview pair is `xkkiicsassizmakcvxml` on the Ask preview alias, with Move isolated at `zvoijbohtyuhqfuvteoy`.

User A belongs only to the Ask isolated project and the Ask preview deployment in section 13. This ticket does not log in, reset that user, or run P13.

## 2. Canonical project registry

| Ref | Name in source or dashboard docs | Region evidence | Live role verified this audit | Status | Fate |
| --- | --- | --- | --- | --- | --- |
| `qvvxvbcdmbjzrgvwjatw` | `Conumers-Trust-Hub` in older control-plane docs | `us-east-1` in those docs; V2 preview pooler host `aws-0-us-east-1.pooler.supabase.com` is set on the Ask preview branch | Production source allowlist. Preview V2 code treats it as `PARENT_BACKEND` and refuses it off production. Plaintext production env not read. | CANONICAL intended | KEEP. Permanent My TrustHub consumer Auth owner. |
| `xkkiicsassizmakcvxml` | Isolated V2 parent | Preview env `MY_TRUSTHUB_V23_SUPAVISOR_SESSION_HOST=aws-0-us-east-1.pooler.supabase.com` | Plain `NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL` and `MY_TRUSTHUB_TEST_SUPABASE_URL` on Ask preview branch only. `MY_TRUSTHUB_V23_ISOLATED_PROJECT` equals this ref. | QA_ONLY | KEEP as QA. Never production identity authority. |
| `arepfylnilkjmyduhwbz` | Move-Trust-Hub | `us-west-2` in older docs | Live Move production health: `projectRef` and `supabaseHost` are this ref. Move `main` canonical constant. | LEGACY consumer IdP; CANONICAL Move data plane | BRIDGE, then retire as consumer IdP. Move evidence data stays specialist-owned. |
| `zvoijbohtyuhqfuvteoy` | Reviewed Move V2 preview branch | Not read from a database connection this audit | Plain `NEXT_PUBLIC_SUPABASE_URL` on Move preview branch `mth-v2-3-move-current-main`. Build guard admits only this exact URL outside production, and only with the isolation flag. | PREVIEW_ISOLATED | KEEP for isolated Move QA. Not a consumer IdP. |
| `gojyhmbojbwbpiamoktq` | Not named in the old shared-IdP note | Not verified | Live Insurance `/api/auth/network-handoff/health` host, and the host in the `/my-insurance` JavaScript bundle. | CANONICAL for current Insurance browser and service client | MIGRATE consumer Auth to Ask. KEEP the specialist database. |
| `hidcrbexurginnuqgipx` | Not named in the old shared-IdP note | Not verified | Live Lender health host, and the host in the `/my-lending` JavaScript bundle. Handoff table and consume RPC both succeed there. | CANONICAL for current Lender browser and service client | MIGRATE consumer Auth to Ask. KEEP the specialist database. |
| `ghjhcxfirxnszfnymdxb` | Investor-Trust-Hub | Pooler `aws-0-us-east-2.pooler.supabase.com` in current Investor docs | Source constant in `scripts/export_investor_metric_inputs.py` and current docs. Vercel `NEXT_PUBLIC_SUPABASE_URL` is encrypted and was not read. No Supabase Auth SDK in the web app. | Source-declared data plane. Deployed URL UNVERIFIED. | KEEP as specialist evidence. No local consumer IdP to retire. |
| `jhjztnisugdsuliriajp` | Named in Contractor QA preflight `docs/qa/th-search-r1-019b/PHASE1-PREFLIGHT.md` | Pooler `aws-0-ca-central-1.pooler.supabase.com` in that document | Not re-connected this audit. Vercel `DATABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL` are encrypted. | UNKNOWN as the current production ref | INVESTIGATE before any identity work. Do not copy the QA note into a new env. |
| `uvqkyupfnpswdozmuzih` | Legacy free Move project | Not applicable | Forbidden by Move `canonical-project.ts`. Live Move health reports `isForbidden: false` and the canonical ref. | RETIRED as a browser target | RETIRE. Do not point any hub at it. |
| `tzzcogaricohtezsugjr` | Named only inside the unmerged Move local SQL harness forbidden list | Not applicable | No live deployment mapped. | UNKNOWN live role | INVESTIGATE only if a later ticket finds it in an env URL. Do not use it. |

Ask also has Vercel variables `neon_tech_database` and `CTH_READ_DATABASE_URL`. Current `docs/control-plane/` says Neon is the Ask customer and research data plane and that `qvvxvb` was not that database. Those URLs were not read. Neon is not consumer Auth.

## 3. Domain, environment, and repository matrix

Team slug `savitz25-s-projects`. Production deployment SHAs below match GitHub Production deployments and `origin/main` on 2026-09-30.

| Hub | Environment | Public domain | Repository | Vercel project | Branch | Deployed SHA | Stable alias |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Ask | PRODUCTION | `https://www.asktrusthub.com` (also `asktrusthub.com`, `consumerstrusthub.com`, `www.consumerstrusthub.com`) | `savitz25/Conumers-Trust-Hub` | `conumers-trust-hub` `prj_925ZdSHjPhPU7pH9WiwyNOK1MrZB` | `main` | `057ac969f7e016b742fd3d42789e65b488e2c938` | Production aliases above. Deployment `dpl_FTk9wfXvQsax1cX9NWMtoUJkkUBR`. |
| Ask | PREVIEW | V2 branch alias only | same | same | `mth-v2-3-parent-runtime` | `b885a651d1b229f8c6acbc5888733af08f4a5e5d` | `https://conumers-trust-hub-git-mth-v2-3-pare-3127df-savitz25-s-projects.vercel.app` equals deployment `dpl_3g13PFDAbKEN8tRoUDY4wb4eUifj` (`conumers-trust-jx8y1lcfp`). |
| Move | PRODUCTION | `https://www.movetrusthub.com` (also apex) | `savitz25/Move-trust-Hub` | `move-trust-hub` `prj_gudPGeW9SZBkgiL8zxvi3Swfo6T0` | `main` | `62b2cdd0a9cefb9255e3b09548795a351b9279f2` | Deployment `dpl_EZzAWqL6yTxLfM2obQXpxyJkPMm5`. |
| Move | PREVIEW | V2 branch alias only | same | same | `mth-v2-3-move-current-main` | `73bc86e503a57fc52d420a1c339c7fd8b912e2af` | `https://move-trust-hub-git-mth-v2-3-move-cur-0a05f1-savitz25-s-projects.vercel.app` equals deployment `dpl_6uXvZfQDzAydDUasWTgkWU2C76n4` (`move-trust-l09zneao4`). |
| Insurance | PRODUCTION | `https://www.insurancetrusthub.com` (also apex) | `savitz25/Insurance-trust-hub` | `insurance-trust-hub` `prj_ARBlfWYNhpJWBtaPO4vUJlraa5BK` | `main` | `33c176213aeb02651c91c48fdd82215bf3e57e14` | Deployment `dpl_5TPvNwiXLM22BnBrBWUSwqMgf9W6`. |
| Lender | PRODUCTION | `https://www.lendertrusthub.com` (also apex) | `savitz25/Lender-Trust-Hub` | `lender-trust-hub` `prj_Il28Mv0ebRiIrumFO7iBX6JrSbdD` | `main` | `38b91f316d6902543035ff152f6a172e61254c0f` | Deployment `dpl_CZ3jnmTRCoZHRV5z5u3VCTxTMTca`. |
| Lender extra | PRODUCTION | No custom domain. `lender-trust-hub-ask-search-009.vercel.app` | same repo | `lender-trust-hub-ask-search-009` `prj_FjFslauzgDtdqZay7AvzhaZirhSx` | `main` | GitHub recorded the same SHA `38b91f31` as a second Production deployment. Vercel production deployment id `dpl_9QqyWrBXsD2UkP28DxK4B6nSwiod`. | None on the canonical domain. Zero env vars. |
| Contractor | PRODUCTION | `https://www.contractortrusthub.com` (also apex) | `savitz25/contractor-trust-hub` | `contractor-trust-hub` `prj_OYmhfgBxZvRAKBPJv5zqshJnJwgq` | `main` | `8575bc3fd10fb3751bf7cd2952410458e8db3b2c` | Deployment `dpl_5mX3Lb4xXbux4uEUNWnXwyyrssou`. |
| Senior | PRODUCTION | `https://seniortrusthub.com` and `https://www.seniortrusthub.com` | `savitz25/care-trust-hub` | `care-trust-hub` `prj_k9GyyXn28JZkyYKqLhBJ4rUQcpUb` | `main` | `9b35178e40b054783ba4b655fc7fb03d3286239e` | Deployment `dpl_6fq94ApweNRawg937SSZGrR1Gpuz`. App root is `apps/web`. |
| Investor | PRODUCTION | `https://www.investortrusthub.com` (also apex) | `savitz25/investor-trust-hub` | `investor-trust-hub-web` `prj_Qu2DT0AIy8R7XYTQiHgNcDYjE9i8` | `main` | `9a6681377e442151e969e1ea8422ac5f7c6e2a5d` | Deployment `dpl_Gr39SLWWByLN7mUHd54ZYzaHanh3`. App root is `apps/web`. |
| Move stale | none | No production URL | `savitz25/Move-trust-Hub` was not linked | `move-trust-hub-mdc-prod-003` `prj_NPTwOcY4BFHmuinaSZpKwiaLZszm` | none | none | No deployment, no env, no git link. |

Other preview deployments exist for ordinary pull requests. They were not inventoried one by one. Only the V2 branch aliases above were checked against the branch tips.

Development is not a separate deployed identity surface. Vercel development targets exist for some variables and are listed in section 5. No local `.env` file was read.

## 4. Supabase project matrix

| Surface | Consumer Auth ref | Public browser ref | Service-side ref | How verified |
| --- | --- | --- | --- | --- |
| Ask production `/my` | Code admits only `qvvxvbcdmbjzrgvwjatw`. Env value encrypted. | Same client. Server-only module, so the host is not in the sign-in HTML. | `SUPABASE_SERVICE_ROLE_KEY` is set for development, preview, and production. Target host not read. Separate `MY_TRUSTHUB_P13_DATABASE_URL`, `P15`, `P17`, `P19_EXPORT`, `P19_DELETE` exist on production and were not read. | Source `lib/my-trusthub/runtime-config.ts` on `057ac969`. Env names and scopes from Vercel. |
| Ask V2 preview | `xkkiicsassizmakcvxml` | Same, branch-scoped public URL | `MY_TRUSTHUB_V23_PARENT_DATABASE_URL` set sensitive on that branch. Host not read. Pooler host plain: `aws-0-us-east-1.pooler.supabase.com`. Mode `SUPAVISOR_SESSION`. | Plain env values on `mth-v2-3-parent-runtime`. |
| Move production | `arepfylnilkjmyduhwbz` | Same | Health reports admin configured on that same `projectRef`. | `GET /api/health/local-movers` and `GET /api/auth/network-handoff/health` on 2026-09-30. |
| Move V2 preview | Not the consumer IdP. Browser project `zvoijbohtyuhqfuvteoy` | Same branch URL | `MTH_MOVE_PARENT_SAVE_DATABASE_URL` sensitive on that branch. Host not read. `SUPABASE_SERVICE_ROLE_KEY` remains on the shared production+preview+development variable. V2 source refuses a service-role client while isolated browser auth is admitted. | Plain branch URL. Source `lib/supabase/canonical-project.ts` and `scripts/supabase-project-guard.ts` at `73bc86e5`. |
| Insurance production | `gojyhmbojbwbpiamoktq` | Same. `getSupabaseUrl()` prefers `NEXT_PUBLIC_SUPABASE_URL`. | Service role validates against the host that function returns. A separate `SUPABASE_URL` exists and is unused while the public URL is set. Its host was not compared. | Live health plus page bundle. |
| Lender production | `hidcrbexurginnuqgipx` | Same | Service role validates there. `TARGET_DATABASE_URL` is an additional production variable. Host not read. | Live health plus page bundle. |
| Contractor production | No Supabase Auth consumer session. Local account cookie `cth_session` on `app_users`. | `NEXT_PUBLIC_SUPABASE_URL` is set and encrypted. Host UNKNOWN. | `DATABASE_URL` production and preview, encrypted. Historical QA note names `jhjztnisugdsuliriajp`. Not re-verified. | Source `lib/auth/session.ts`. Env names only. |
| Senior production | No consumer Auth SDK and no `/my-*` account. | `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set. No `NEXT_PUBLIC_SUPABASE_URL` name was in the filtered inventory. | `CARE_DATABASE_URL` production and preview, encrypted. Host UNKNOWN. | Route inventory. Env names only. |
| Investor production | No consumer Auth SDK. | `NEXT_PUBLIC_SUPABASE_URL` encrypted for production, preview, and development. Host UNKNOWN. Source expectation `ghjhcxfirxnszfnymdxb`. | `DATABASE_URL` same scopes, encrypted. `SUPABASE_SERVICE_ROLE_KEY` is preview-only in the inventory. | Source constant plus env names. |
| Business claim | No claim-specific Supabase ref verified | Not a browser Supabase session | `ATH_HANDOFF_SECRET` on every hub | Env inventory and route inventory. |

## 5. Vercel deployment and environment inventory

Scopes are the Vercel targets and git branch returned by the API. "Value" is recorded only when it is a non-secret flag or an origin/host. Keys, JWTs, database URLs, invited ids, and PEM material are withheld.

### Ask `conumers-trust-hub`

Production site URL verified plain: `https://www.asktrusthub.com`.

| Variable | Scope | Purpose | Expected target | Risk if wrong | Verified |
| --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL` | production, encrypted | My TrustHub browser and server Auth URL | `qvvxvbcdmbjzrgvwjatw` | Preview QA or another hub becomes production identity, or the client fail-closes | Name and scope. Value not read. Source allowlist is that host. |
| `NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_PUBLISHABLE_KEY` | production, encrypted | Public client key for that project | anon or publishable key of `qvvxvb` | Key from `xkkiics` or `arepfyl` pairs with the wrong URL | Present. Value withheld. |
| `NEXT_PUBLIC_MY_TRUSTHUB_TURNSTILE_SITE_KEY` | production, plain but withheld | Captcha site key | Ask production widget | Missing key blocks human sign-in | Present. Value withheld. |
| `NEXT_PUBLIC_SITE_URL` | production, plain | Canonical origin | `https://www.asktrusthub.com` | Auth redirects and cookies bind to the wrong host | Verified. |
| `NEXT_PUBLIC_SUPABASE_URL` | development + preview + production, encrypted | No TypeScript reader found on Ask `main` | UNKNOWN | A future reader could attach research traffic to the consumer project or the reverse | Name and scope only. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | development + preview + production, encrypted | Pair for the variable above | UNKNOWN | Cross-project key | Present. Value withheld. |
| `SUPABASE_SERVICE_ROLE_KEY` | development + preview + production, encrypted | Privileged server key | Must match whichever server client is constructed | Service role sent to the wrong project | Present. Value withheld. |
| `MY_TRUSTHUB_ENABLED` and the feature siblings `SIGNUP`, `SAVED`, `PROJECTS`, `SESSIONS`, `WATCH`, `ALERTS`, `EMAIL`, `EXPORT`, `DELETE`, `SPECIALIST_HANDOFF`, `SOURCE_MONITORING` | production, encrypted | Master gate. Code enables a flag only when the value is exactly `true`, and child flags also require the master | Production stays fail-closed until an explicit launch | A `true` value opens that surface on production | Names present. Values not read. |
| `MY_TRUSTHUB_CANARY_ONLY`, `MY_TRUSTHUB_CANARY_EMAILS` | production, encrypted | Legacy canary admission | Approved canary identities only | Broad admission | Present. Values withheld. |
| `MY_TRUSTHUB_P13_DATABASE_URL`, `P15`, `P17`, `P19_EXPORT`, `P19_DELETE`, `MY_TRUSTHUB_DATABASE_CA` | production, sensitive or encrypted | Phase pipeline database URLs | UNKNOWN. Must not be the QA project during a production launch, and must not be used as the isolated proof target | Pipeline writes to the wrong generation | Names present. Values not read. |
| `MY_TRUSTHUB_P13_CONTRACTOR_SECRET` | production, sensitive | Shared secret for the Contractor issue route | Ask production verifier | Forged specialist save handoff | Present. Value withheld. |
| `ATH_HANDOFF_SECRET` | production and, separately, preview | Business claim handoff | Claim verifier, not consumer session | Claim token accepted as a consumer session | Present. Value withheld. |
| `neon_tech_database`, `CTH_READ_DATABASE_URL`, `ATH_PREVIEW_DB_*` | production and/or preview, sensitive | Research or preview Postgres | Not consumer Auth | Research DSN used as the identity database | Present. Values withheld. |
| `ASK_AUTH_FROM_EMAIL` | production + preview, sensitive | Mail from-address | Ask domain | Auth mail from the wrong brand | Present. Value withheld. |

Ask preview branch `mth-v2-3-parent-runtime` overrides, all target `preview` and that git branch:

| Variable | Recorded value | Risk if this leaks onto production |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL`, `MY_TRUSTHUB_TEST_ORIGIN`, `MY_TRUSTHUB_V23_PARENT_ORIGIN` | `https://conumers-trust-hub-git-mth-v2-3-pare-3127df-savitz25-s-projects.vercel.app` | Production origin check fails closed, or a preview origin is trusted in production |
| `NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL`, `MY_TRUSTHUB_TEST_SUPABASE_URL` | `https://xkkiicsassizmakcvxml.supabase.co` | QA identities become the production IdP |
| `MY_TRUSTHUB_V23_ISOLATED_PROJECT` | `xkkiicsassizmakcvxml` | Isolated runtime binds the production ref |
| `MY_TRUSTHUB_V23_MOVE_ORIGIN` | `https://move-trust-hub-git-mth-v2-3-move-cur-0a05f1-savitz25-s-projects.vercel.app` | Parent save calls production Move |
| `MY_TRUSTHUB_V23_SUPAVISOR_SESSION_HOST` | `aws-0-us-east-1.pooler.supabase.com` | Session connects to the wrong pooler |
| `MY_TRUSTHUB_V23_DATABASE_CONNECTION_MODE` | `SUPAVISOR_SESSION` | Transaction pooling breaks the session-affinity contract |
| `MY_TRUSTHUB_V23_SESSION_AFFINITY` | `dedicated` | Runtime refuses or attaches to the wrong session |
| `MY_TRUSTHUB_ACCESS_MODE` | `invitation` | Public admission of every confirmed user |
| `MY_TRUSTHUB_ENABLED`, `SAVED`, `SPECIALIST_HANDOFF`, `PREVIEW_ACCOUNT_ACCESS`, `NONPRODUCTION_APPROVED`, `V23_PROFILE_SAVE_ENABLED` | `true` | Opening these on production is a launch, which this program forbids |
| `MY_TRUSTHUB_SIGNUP_ENABLED`, `EMAIL`, `WATCH`, `ALERTS`, `SOURCE_MONITORING` | `false` | Isolated preview starts creating accounts, mail, watches, or alerts |
| `MY_TRUSTHUB_INVITED_USER_IDS` | present, withheld | Extra or missing ids change who can sign in |
| `NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_PUBLISHABLE_KEY`, Turnstile site key, signing PEMs, key ids, parent database URL, CA PEM, Move protection bypass | present, withheld | Cross-project or production credentials inside QA |

A general preview `NEXT_PUBLIC_SITE_URL` also exists, encrypted, with no git branch. The branch-scoped value wins on `mth-v2-3-parent-runtime`. Other Ask previews were not probed.

### Move `move-trust-hub`

| Variable | Scope | Purpose | Expected target | Risk if wrong | Verified |
| --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | production + preview + development, encrypted | Browser and server project URL | Production runtime is `arepfylnilkjmyduhwbz` | Preview isolation or `qvvxvb` served on `www.movetrusthub.com` | Production host verified live. Shared variable plaintext not read. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same scopes, encrypted | Public key | Anon key for `arepfyl` | Key ref does not match the URL | Present. Value withheld. |
| `SUPABASE_SERVICE_ROLE_KEY` | same scopes, encrypted | Privileged server | `arepfyl` when isolation is off | Service role sent to `zvoijboht` | Present. Value withheld. V2 source blocks that pairing while isolation is admitted. |
| `ATH_HANDOFF_SECRET` | production + preview, encrypted | Claim handoff | Claim channel | Confused with consumer SSO | Present. Value withheld. |
| `ATH_CLAIM_CANARY_PROFILE_IDS`, `ATH_CLAIM_CTA_MODE` | production, encrypted; also preview branch `ath-cust-net-001a-move`, sensitive | Claim canary | Claim profiles only | Claim CTA opens for the wrong profiles | Present. Values withheld. |
| `NEXT_PUBLIC_MOVE_ISOLATED_AUTH_APPROVED` | preview branch `mth-v2-3-move-current-main`, plain | Isolation admission | `1` only on that preview | Production build must ignore this. The guard does when `VERCEL_ENV=production`. | Verified `1`. |
| `NEXT_PUBLIC_MOVE_ISOLATED_AUTH_ORIGIN` | that branch, plain | Callback origin | The Move preview alias above | Callback returns to `www.movetrusthub.com` | Verified that alias. |
| `NEXT_PUBLIC_SUPABASE_URL` | that branch, plain | Overrides the shared URL on this branch | `https://zvoijbohtyuhqfuvteoy.supabase.co` | Branch preview silently uses production `arepfyl` | Verified. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | that branch, encrypted | Must be an anon JWT whose ref is `zvoijboht` | That project only | Mismatched key fails the build guard, or admits the wrong project if the guard is bypassed | Present. Value withheld. Claims not re-decoded. |
| `NEXT_PUBLIC_MOVE_PARENT_SAVE_ENABLED` | that branch, plain | Shows the parent-save control only when exactly `1` and the runtime gates match | Isolated pair | UI offers a save the runtime must refuse | Verified `1`. |
| `MTH_MOVE_PARENT_SAVE_MODE` | that branch | Runtime mode | `isolated` | Production mode | Verified. |
| `MTH_MOVE_PARENT_SAVE_ISOLATED_APPROVED` | that branch | Second approval | `true` | Runtime opens without approval | Verified. |
| `MTH_MOVE_PARENT_SAVE_SOURCE_BACKEND`, `MTH_V23_MOVE_ISOLATED_SOURCE` | that branch | Backend name | `isolated-move-reader` | Name points at `arepfyl` or `qvvxvb` | Verified. |
| `MTH_V23_MOVE_ISOLATED_SOURCE_APPROVED` | that branch | Approval flag | `true` | Unapproved source | Verified. |
| `MTH_MOVE_PARENT_SAVE_FORM_PATH` | that branch | Parent form | `/my/profile-save` | Posts to a Gen1 path | Verified. |
| `MTH_MOVE_PARENT_SAVE_PARENT_ORIGIN` | that branch | Ask preview | Ask alias in section 3 | Calls production Ask | Verified. |
| `MTH_MOVE_PARENT_SAVE_MOVE_ORIGIN` | that branch | This preview | Move alias in section 3 | Advertises production Move | Verified. |
| `MTH_MOVE_PARENT_SAVE_DATABASE_URL`, CA, protection bypass, signing PEMs, key ids | that branch, sensitive or withheld | Isolated source database and assertion keys | `zvoijboht` login, not production | Production data or production keys in the preview | Present. Values withheld. |

`AUTH_OAUTH_DIRECT` and `MOVE_AUTH_BRIDGE_URL` are not set on this project. Move is the bridge host, so those names are not required here.

`move-trust-hub-mdc-prod-003` has no variables and no deployment.

### Insurance `insurance-trust-hub`

| Variable | Scope | Purpose | Expected target | Risk if wrong | Verified |
| --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | production + preview, encrypted | Browser project | Live effective host `gojyhmbojbwbpiamoktq` | Reverting the URL to `arepfyl` merges Insurance into Move identity | Effective runtime host verified. Ciphertext not read. |
| `SUPABASE_URL` | production + preview, encrypted | Fallback only if the public URL is empty | Same project if used | Silent split between admin scripts and the browser | Present. Not the host the health route selected while the public URL exists. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | production + preview, encrypted | Public and service keys | `gojyhmbo` | Keys from `arepfyl` | Present. Values withheld. |
| `ATH_HANDOFF_SECRET` | production + preview | Claim | Claim channel | Consumer SSO substitute | Present. Value withheld. |
| `ATH_CLAIM_CANARY_PROFILE_IDS`, `ATH_CLAIM_CTA_MODE` | production; preview branch `ath-cust-net-002c-insurance` | Claim canary | Claim profiles | Wrong profiles | Present. Values withheld. |

`AUTH_OAUTH_DIRECT` and `MOVE_AUTH_BRIDGE_URL` are absent. Source default is the Move bridge. See section 12.

### Lender `lender-trust-hub`

| Variable | Scope | Purpose | Expected target | Risk if wrong | Verified |
| --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | production + preview + development, encrypted | Browser project | Live effective host `hidcrbexurginnuqgipx` | Pointing it at `arepfyl` or `gojyhmbo` | Effective runtime host verified. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | those scopes, encrypted | Keys | `hidcrbex` | Cross-project key | Present. Values withheld. |
| `TARGET_DATABASE_URL` | production, encrypted | Extra server database | UNKNOWN | Writes lender evidence into Move or Ask | Present. Value not read. |
| `ATH_HANDOFF_SECRET` | production + preview | Claim | Claim channel | Confused with My Lending SSO | Present. Value withheld. |
| `ATH_CLAIM_*` | production; preview branch `ath-cust-net-001b-lender` | Claim canary | Claim profiles | Wrong profiles | Present. Values withheld. |

`AUTH_OAUTH_DIRECT` and `MOVE_AUTH_BRIDGE_URL` are absent. Source default is `https://www.movetrusthub.com/auth/callback`.

`lender-trust-hub-ask-search-009` has zero environment variables. It is not an identity authority.

### Contractor `contractor-trust-hub`

| Variable | Scope | Purpose | Expected target | Risk if wrong | Verified |
| --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | production; preview; and one preview branch override | Specialist Postgres, session pooler in docs | UNKNOWN live ref | Identity tables created in the evidence database, or the reverse | Name and scope. Value not read. |
| `NEXT_PUBLIC_SUPABASE_URL`, anon key, service role | preview + production, encrypted | Public Supabase client if a caller exists | UNKNOWN | Consumer Auth pointed at the evidence project | Present. Values not read. No Auth SDK consumer session in `lib/auth`. |
| `NEXT_PUBLIC_SITE_URL` | preview + production, encrypted | Site origin | `https://www.contractortrusthub.com` | Magic links leave the hub | Present. Value not read. |
| `MY_TRUSTHUB_CONTRACTOR_SAVE_ENABLED` | production, encrypted | Opens `POST /api/my-trusthub/issue` only when exactly `true` | Must stay off until V2, and V2 must not reuse this route | Gen1 P13 save starts against production Ask | Present. Value not read. Route fail-closes otherwise. |
| `MY_TRUSTHUB_P13_CONTRACTOR_SECRET` | production, sensitive | HMAC or shared secret for that issue route | Ask production | Forged handoff | Present. Value withheld. |
| `ATH_HANDOFF_SECRET`, `ATH_CLAIM_ENABLED_STATES`, `ATH_CLAIM_CTA_MODE`, `ATH_CLAIM_CANARY_PROFILE_IDS` | production and/or preview | Business claim | Claim, not `cth_session` | Claim session becomes the research account | Present. Values withheld. |

### Senior `care-trust-hub`

No consumer Auth URL variable was identified. `CARE_DATABASE_URL` is the server database for production and preview. Its host was not read. `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are set for preview and production without a matching `NEXT_PUBLIC_SUPABASE_URL` in the filtered list. `NEXT_PUBLIC_SITE_URL` is sensitive for production and preview; value not read. The live canonical hosts are `seniortrusthub.com` and `www.seniortrusthub.com`. `ATH_HANDOFF_SECRET` is set. Claim canary variables exist for production and for preview branch `ath-cust-net-002a-senior`. Many `CARE_ENABLE_*` flags exist and are product switches, not identity. They are omitted here.

### Investor `investor-trust-hub-web`

| Variable | Scope | Purpose | Expected target | Risk if wrong | Verified |
| --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | production + preview + development, encrypted | Public project URL | Source expectation `ghjhcxfirxnszfnymdxb` | Another hub's project | Name and scope. Value not read. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | those scopes, encrypted | Public key | Same project | Cross-project key | Present. Value withheld. |
| `DATABASE_URL` | those scopes, encrypted | Server Postgres | Same project, per current docs | Evidence written elsewhere | Present. Value not read. |
| `SUPABASE_SERVICE_ROLE_KEY` | preview only, encrypted | Privileged key on preview | Preview of the same project | Production service role missing, or preview key reused | Present on preview. Not listed on production. |
| `NEXT_PUBLIC_SITE_URL`, `CANONICAL_HOST` | preview + production, encrypted | Origin | `www.investortrusthub.com` | Claim links leave the hub | Present. Values not read. |
| `ATH_HANDOFF_SECRET` | production; preview branch `ath-cust-net-002b-investor` | Claim | Claim channel | No consumer IdP should be invented here | Present. Value withheld. |

## 6. Auth-owner matrix

| Surface | Consumer identity owner today | Workspace owner today | Current Auth UX | Target Auth UX under AD-0 | Status | Fate |
| --- | --- | --- | --- | --- | --- | --- |
| Ask production `/my` | Intended `qvvxvb`. Binding plaintext UNVERIFIED. | Ask Saved and Projects, flag-gated | Ask `/my/sign-in`. Page is live and says My TrustHub. | Ask | CANONICAL intended | KEEP |
| Ask V2 preview | `xkkiics` | Ask preview Saved, flag-gated. Watch and alerts forced false. | Ask preview `/my/sign-in` | Ask, QA only | QA_ONLY | KEEP for proof. Never promote the project. |
| Move production My Move | `arepfyl` | My Move cloud plus device shortlist | Move `/my-move` and `/auth/*` | Ask | LEGACY | BRIDGE, then retire the consumer IdP UX |
| Move V2 preview | `zvoijboht` for that browser only | Device shortlist plus isolated parent-save runtime | Isolated preview callbacks. Network handoff refused while isolation is admitted, per V2 source. | Ask parent. Move remains the tool. | PREVIEW_ISOLATED | KEEP until certification. Not an IdP. |
| Insurance My Insurance | `gojyhmbo` | My Insurance local and cloud | Insurance `/my-insurance` and `/auth/*`, with source still able to send OAuth through Move | Ask | LEGACY, already a separate project | MIGRATE consumer Auth. KEEP evidence. |
| Lender My Lending | `hidcrbex` | My Lending local and cloud | Lender `/my-lending` and `/auth/*`, same Move-bridge default | Ask | LEGACY, already a separate project | MIGRATE consumer Auth. KEEP evidence. |
| Contractor account | Specialist `app_users` in its own database. Ref UNKNOWN. | `user_workspace` in that database | `/account` magic link, cookie `cth_session` | Ask for the person. Contractor keeps the tool. | SPECIALIST_LOCAL | MIGRATE the person. KEEP evidence. |
| Senior | None found | None found | No consumer sign-in. Claim handoff only. | Ask when a person account is required | No consumer IdP | KEEP evidence. Do not create a second IdP. |
| Investor | None found | None found | No consumer sign-in. Claim handoff only. | Ask | No consumer IdP | KEEP evidence. Do not create a second IdP. |
| Business `/manage` and claim | UNKNOWN user store. Secret is `ATH_HANDOFF_SECRET`. | Organization and profile claim, not Saved | Specialist claim routes and Ask `/manage` | Stays business claim. Never the consumer IdP. | BUSINESS_ONLY | KEEP separate |

## 7. Auth-route matrix

Routes below exist on the production SHA unless marked V2-only. V2-only routes are on Ask `b885a651` or Move `73bc86e5` and are not on production `main`.

### Ask production `main`

| Path | Role |
| --- | --- |
| `/my`, `/my/saved`, `/my/projects`, `/my/projects/[projectId]`, `/my/watches`, `/my/alerts`, `/my/alerts/[alertId]`, `/my/you`, `/my/sessions/[sessionId]` | Consumer workspace. Feature-gated. |
| `/my/sign-in` | Consumer sign-in. Live HTTP 200. |
| `/auth/callback` | Supabase return for the My TrustHub client. |
| `/my/handoff/prepare`, `/start`, `/arrive`, `/finish` | Cross-hub handoff routes in the Ask app. |
| `/api/my-trusthub/handoff/issue` | Server handoff issue. |
| `/api/my-trusthub/export/[exportRef]` | Export fetch. |
| `/my-trust-journey` | Journey page. Not the V2 profile-save continuation. |
| `/manage`, `/manage/[profileId]`, `/manage/organization/[orgId]`, `/manage/invitations/accept`, `/manage/notifications` | Business claim and organization. Not `/my`. |
| `lib/supabase/server.ts`, `lib/supabase/middleware.ts` | My TrustHub server client. Null unless the `qvvxvb` host pin matches. |
| `lib/my-trusthub/runtime-config.ts`, `feature-flags.ts` | Host pin and `true`-only flags. |

Ask `main` does not contain `/my/profile-save`, `/my/create-account`, `/my/reset-password`, or `lib/my-trusthub/account-policy.ts`.

### Ask V2 branch only

| Path | Role |
| --- | --- |
| `/my/sign-in`, `/my/create-account`, `/my/email-link`, `/my/recover`, `/my/reset-password` | Account forms. Isolated mode admits login only. |
| `/my/profile-save`, `/my/profile-save/current-grant` | Parent confirmation and current-grant. |
| `/api/my-trusthub/profile-save`, `/api/my-trusthub/profile-save/current-grant` | Parent runtime. |
| `lib/my-trusthub/account-policy.ts` | Production pair versus preview pair. |
| `lib/my-trusthub/account-service.ts` | Account operations behind that policy. |
| `lib/my-trusthub/profile-save/*` | Continuation, receipt, isolated adapters. Not deployed to production. |

### Move production

| Path | Role |
| --- | --- |
| `/my-move`, `/my-move/create-password`, `/my-move/plans/[planId]`, `/my-move/reports` | My Move workspace. Live HTTP 200. |
| `/auth/callback`, `/auth/confirm`, `/auth/network-handoff` | Magic link, OAuth, password confirm, one-time network handoff. |
| `/api/auth/magic-link`, `/api/auth/google`, `/api/auth/facebook` | Start methods. |
| `/api/auth/network-handoff/start`, `/api/auth/network-handoff/health` | Handoff issue and probe. Health is live and not ok. |
| `/api/save-my-move/*` | Cloud save mail and inventory. |
| `components/save-my-move/save-my-move-provider.tsx` | Guest plus cloud provider. |
| `actions/my-move-password.ts`, `lib/save-my-move/password.ts` | Password. |
| `lib/auth/request-magic-link.ts` | Magic link. |
| `actions/account.ts`, My Move dashboard and reports | `supabase.auth.signOut`, including `scope: 'global'` on the dashboard and reports. |

### Move V2 branch

Same Gen1 routes, plus the isolation guard. Parent-save routes under the Move `lib/my-trusthub` tree are on this branch and are not production. Network handoff is refused while isolated browser auth is admitted. This ticket does not change those routes.

### Insurance production

`/my-insurance`, `/my-insurance/plans`, `/my-insurance/compare`, `/my-insurance/report`, `/my-insurance/setup`. Auth routes mirror Move: `/auth/callback`, `/auth/confirm`, `/auth/network-handoff`, `/api/auth/magic-link`, `/api/auth/google`, `/api/auth/facebook`, `/api/auth/network-handoff/start`, `/api/auth/network-handoff/health`. Provider: `components/my-insurance/my-insurance-provider.tsx`. Live page HTTP 200 and contains "My Insurance".

### Lender production

`/my-lending`, `/my-lending/plans`, `/my-lending/report`, `/my-lending/setup`. The same auth route set as Insurance. Provider: `components/my-lending/my-lending-provider.tsx`. Live page HTTP 200 and contains "My Lending". `lib/my-lending/auth-constants.ts` defaults the external redirect to the Move bridge.

### Contractor production

`/account`, `/account/verify`. `/api/auth/request-link`, `/api/auth/verify`, `/api/auth/me`, `/api/auth/logout`. These are the specialist magic-link account, not Supabase Auth. `/api/my-trusthub/issue` posts toward `https://www.asktrusthub.com` and returns 404 unless `MY_TRUSTHUB_CONTRACTOR_SAVE_ENABLED` is exactly `true` and the P13 secret is set. That flag's value was not read. Claim UI includes `components/contractor/ManageProfileCta.tsx`.

### Senior production

No `app/auth` consumer tree. Claim route: `apps/web/src/app/api/claim/handoff/[providerClass]/[ccn]/route.ts`.

### Investor production

No consumer auth tree. Claim routes: `apps/web/src/app/api/claim/handoff/[slug]/route.ts` and `apps/web/src/app/api/customer-claim-validation/v1/route.ts`.

## 8. Session and cookie map

Supabase SSR clients in Ask, Move, Insurance, and Lender do not set a parent `Domain`. The library cookie name is `sb-<project-ref>-auth-token`, with chunked `.0`, `.1` names. Move's `hasSupabaseAuthCookies` looks for that prefix. Anonymous loads of the production pages did not set those cookies, so the live `Set-Cookie` attributes were not observed. The code path passes the library options through and never sets a shared parent domain.

| Cookie or session | Set by | Project that issues it | Domain scope | Logout |
| --- | --- | --- | --- | --- |
| `sb-<ref>-auth-token` | Ask `/my` when the client is non-null | `qvvxvb` if the production pin matches; `xkkiics` on the V2 preview | Host-only on the Ask host. Not sent to Move, Insurance, or Lender. | Ask `signOut` clears this host. It does not clear specialist cookies. |
| `sb-arepfylnilkjmyduhwbz-auth-token` | `www.movetrusthub.com` | `arepfyl` | Host-only | `signOut({ scope: 'global' })` revokes refresh tokens in `arepfyl` only. |
| `sb-gojyhmbojbwbpiamoktq-auth-token` | `www.insurancetrusthub.com` | `gojyhmbo` | Host-only | Not the Move session. A Move global sign-out does not revoke it. |
| `sb-hidcrbexurginnuqgipx-auth-token` | `www.lendertrusthub.com` | `hidcrbex` | Host-only | Same split. Lender health says this project's handoff RPC works. It cannot redeem an `arepfyl` code. |
| `sb-zvoijbohtyuhqfuvteoy-auth-token` | Move V2 preview alias only | `zvoijboht` | Host-only on that preview host. V2 source forbids the production origin. | Preview sign-out must not be pointed at production. |
| `mth-pathname` | Move HTML responses | Not an Auth cookie | Observed on `www.movetrusthub.com` | Unrelated to identity. |
| `cth_session` | Contractor `/api/auth` | Contractor `auth_sessions`, not Supabase Auth | `httpOnly`, `sameSite=lax`, `path=/`, `secure` in production, no `Domain` | `POST` logout deletes the server row and sets `maxAge: 0`. |

There is no cross-domain SSO cookie. Gen1 "SSO" is a one-time `network_auth_handoffs` code. That code is meaningful only inside the Supabase project that issued it.

Split-brain cases that are true today:

- Ask can be signed out while a Move `arepfyl` session still exists on `www.movetrusthub.com`. The cookies do not share a domain or a project.
- A Move, Insurance, or Lender session can exist with no Ask My TrustHub session. Nothing in those hubs writes the Ask `sb-qvvxvb…` cookie.
- An Insurance session and a Lender session and a Move session are three sessions even if the person typed the same email. Email is not an identity join. See the hard invariants.
- Contractor `cth_session` is a fourth account. Signing into Contractor does not sign anyone into Ask, Move, Insurance, or Lender.
- Ask `/manage` claim state is not the `/my` consumer session.

V2 continuation does not copy these cookies. The parent receipt path is Ask preview `/my/profile-save` and `/my/profile-save/current-grant`, called from the Move preview origin that the isolated config pins. The specialist object is not the session.

## 9. Legacy Generation 1 pathways

Nothing in this section was removed.

### My Move

Live on `https://www.movetrusthub.com/my-move` at production SHA `62b2cdd0`. Header and dashboard entry points include `components/save-my-move/my-move-nav-link.tsx` and the My Move dashboard. Auth UI is magic link, Google, Facebook, and password, through the routes in section 7. Device storage key is `mth-local-saved-movers` (`lib/save-my-move/local-shortlist.ts`). Cloud saves go through `/api/save-my-move/*` and the Save My Move provider into `arepfyl`. Migration files on `main` include `20260712190000_save_my_move.sql`, `20260713210000_my_move_admin_activity.sql`, and `20260805120000_network_auth_handoffs.sql`. The live handoff health check reports the handoff table missing or inaccessible and the consume RPC timed out. Dependent routes are `/my-move/*`, `/auth/*`, `/api/auth/*`, and `/api/save-my-move/*`. Network SSO is implemented and not healthy.

### My Insurance

Live on `https://www.insurancetrusthub.com/my-insurance`. Auth UI matches the Move route shape. Guest storage keys: `ith:my-insurance:v1`, `ith-my-insurance-compare-tray-v1`, `ith:my-insurance-drug-basket:v1`, `ith:research-wallet:v1`. The provider syncs guest and cloud and does not clear local storage on sign-out. Cloud data is in `gojyhmbojbwbpiamoktq`, not `arepfyl`. Handoff table probe succeeds. `consume_network_auth_handoff` is missing from the schema cache. Source comments and `docs/NETWORK-AUTH.md` still say the project must match Move. That comment is false for production.

### My Lending

Live on `https://www.lendertrusthub.com/my-lending`. Guest key `lth:my-lending:v1`. Signed-in device key `lth:my-lending:v1:user:{userId}` plus an optional cloud push. That user id is the Gen1 id from `hidcrbex`, not an Ask id. Handoff health is ok on that project: table and consume RPC both succeed. The external OAuth and magic-link redirect still defaults to `https://www.movetrusthub.com/auth/callback` with `hub=lending`. `AUTH_OAUTH_DIRECT` is unset, so the source default applies. The initial HTML of `/my-lending` did not contain that bridge URL; the redirect is built in the auth constants when a sign-in starts.

### Shared-IdP assumption

Older Ask and specialist docs describe one project, `arepfylnilkjmyduhwbz`, for Move, Insurance, and Lender, with Move as the Site URL. Production no longer matches that description. Move is on `arepfyl`. Insurance is on `gojyhmbo`. Lender is on `hidcrbex`. Treat the shared-project paragraphs as historical. Do not "fix" Insurance or Lender by pointing them back at `arepfyl`.

## 10. V2 pathways

Ask owns identity, admission, the Saved index, Projects, receipts, the Watch registry, and export or delete. Those tables exist in Ask migrations as `consumer.consumer_profiles`, `consumer.consumer_saved_entities`, `consumer.consumer_projects`, `consumer.consumer_watches`, `consumer.consumer_alerts`, and the `ops.consumer_*handoff*` tables. Whether those migrations are applied to `qvvxvb` was not re-queried. Older cutover docs said they were not yet applied. That application state is UNKNOWN on 2026-09-30.

Specialists own evidence, entity identity, guest and device state, and the private tool runtime. Move's device shortlist, Insurance's `ith:*` keys, and Lender's `lth:*` keys stay on the device. They are not Ask rows.

The mandatory tool-state chain, recorded and not implemented here:

```
Ask consumer
  -> Ask Saved, and an optional Project
    -> opaque specialist object reference
      -> specialist private object
```

Conceptual reference fields: `hub`, `object_class`, `schema_version`, `opaque_object_id`, `source_revision`, `receipt_id`.

The specialist private object must not be keyed by a Generation 1 consumer UUID or by Ask `auth.users.id`. Lender's current device key `lth:my-lending:v1:user:{userId}` is Gen1 behavior. It is not the V2 key. Continue, when it is built, uses a short-TTL single-use capability. The current-grant route on the unmerged Ask branch is the parent side of that future capability. This ticket does not change it.

Save does not create Watch. On the Ask preview branch, Saved and specialist handoff are `true`, and Watch, alerts, and source monitoring are `false`. The isolated config returns null if those three are not the string `false`.

Parent profile-save on the unmerged branch is enabled only when `VERCEL_ENV` is not production, the preview pair matches `xkkiics` and the Ask preview alias, the Move origin matches the Move preview alias, and the invitation and flag gates in `isolated-config.ts` pass. Production deployment of Ask `main` does not contain this runtime.

## 11. Business `/manage` separation

Consumer Auth is `/my` on the Ask consumer project. Business claim is a different surface:

- Ask routes under `/manage`, including organization, invitation accept, and notifications.
- `ATH_HANDOFF_SECRET` on Ask, Move, Insurance, Lender, Contractor, Senior, and Investor.
- Specialist claim routes, including Senior and Investor `api/claim/handoff`, Contractor `ManageProfileCta`, and `ATH_CLAIM_*` canary variables.
- Claim canary branches (`ath-cust-net-001a-move`, `001b-lender`, `002a-senior`, `002b-investor`, `002c-insurance`, `ath-cust-003`) carry their own claim variables and are not the V2 consumer preview.

No Supabase project ref was verified as a business-only Auth tenant. Do not put claim users into `xkkiics`, and do not treat a claim handoff as a My TrustHub session. If a later audit finds the claim user store, attach it here. Until then the claim user store is UNKNOWN.

## 12. Wrong-project hazard matrix

| Source | Expected target | Possible wrong target | Protection present | Gap |
| --- | --- | --- | --- | --- |
| Ask production `getMyTrustHubSupabaseUrl` on `057ac969` | `qvvxvbcdmbjzrgvwjatw` | `arepfyl`, `xkkiics`, `gojyhmbo`, `hidcrbex` | Function returns null unless the host is exactly `qvvxvbcdmbjzrgvwjatw.supabase.co` | The production env value is encrypted and was not read. A mismatch fail-closes. It does not silently follow another project. A runtime probe that prints only the host is still undone. |
| Ask V2 `accountRuntime` on preview | `xkkiics` plus the Ask preview alias | `qvvxvb` | Preview returns null when the backend is `PARENT_BACKEND` or the test URL does not match | Protection is on the unmerged branch only. Production `main` does not contain this pair check. |
| Ask V2 `accountRuntime` on production | `qvvxvb` plus `https://www.asktrusthub.com` | `xkkiics` | Production returns null for any other pair | That code is not what production runs today. Production is protected by the older host pin instead. The branch env that holds `xkkiics` is `preview` plus git branch, not production. |
| Move production browser | `arepfyl` | `zvoijboht`, `qvvxvb`, `uvqkyup` | Live health is `arepfyl`. Production build guard admits only `arepfyl`. `uvqkyup` is forbidden. | The shared `NEXT_PUBLIC_SUPABASE_URL` is also attached to preview and development. Non-V2 previews were not probed and might be that production URL. |
| Move V2 preview browser | `zvoijboht` | `arepfyl`, Ask `xkkiics`, Ask `qvvxvb` | Branch URL is exactly `zvoijboht`. Guard admits that URL only with `NEXT_PUBLIC_MOVE_ISOLATED_AUTH_APPROVED=1` and an anon JWT for that ref. Production `VERCEL_ENV` cannot take that path. | Anon JWT claims were not re-decoded. Service-role refusal depends on the unmerged source. Do not merge it from this ticket. |
| Ask preview calling Move | Move preview alias and `zvoijboht` as the specialist | Move production `arepfyl`, or using the Move preview as the Ask user store | `isolated-config.ts` pins both origins and refuses production `VERCEL_ENV` | Two preview aliases are easy to transpose. They are different projects. User A is not a `zvoijboht` user. |
| Insurance sign-in redirect | `gojyhmbo` callback on `www.insurancetrusthub.com` | Move `arepfyl` via `www.movetrusthub.com/auth/callback` | `AUTH_OAUTH_DIRECT=1` would keep the redirect on Insurance | That variable is unset. Source default is the Move bridge. Docs still say the project must equal Move. |
| Lender sign-in redirect | `hidcrbex` callback on `www.lendertrusthub.com` | Move `arepfyl` via the same bridge default | Same `AUTH_OAUTH_DIRECT` switch | Unset. `lib/my-lending/auth-constants.ts` hard-defaults the bridge. |
| Builder following `docs/NETWORK-AUTH.md` or Lender `docs/LEND-NAT-002B` | Current live hosts | `arepfyl` for Insurance and Lender | None in those docs | The docs contradict the live health hosts. |
| Contractor `POST /api/my-trusthub/issue` | Closed until a later contract | Production Ask `qvvxvb` through the Gen1 P13 route | Returns 404 unless the enable flag is exactly `true` and the secret is present | The production flag is encrypted, so the live closed state was not re-read. Do not turn it on to test User A. |
| `lender-trust-hub-ask-search-009` | Unused, or investigated | A second production Lender with empty env | It does not own `www.lendertrusthub.com` | GitHub still records Production deployments for it. Empty env can fail open or fail closed depending on code paths. Not probed. |
| Email match across hubs | No join | Merging `arepfyl` and `qvvxvb` users because the email matches | AD-0 forbids email-only merge. Separate projects make the cookies unable to alias each other. | `ops.consumer_identity_links` exists in Ask migrations. This audit did not re-prove the SQL predicate. |

## 13. Current User A test boundary

This boundary is recorded. It was not re-tested. No password was used. No user was reset. No login probe was sent.

| Fact | Boundary |
| --- | --- |
| Isolated project | `xkkiicsassizmakcvxml` |
| User A | Exists, confirmed, not banned, not deleted |
| Password identity | Exists |
| Human Turnstile | Passes |
| Password grant | Currently returns `invalid_credentials` |
| P13 | Has not executed |

The deployment that may participate in a later test:

- Ask Vercel preview `mth-v2-3-parent-runtime`
- SHA `b885a651d1b229f8c6acbc5888733af08f4a5e5d`
- Deployment `dpl_3g13PFDAbKEN8tRoUDY4wb4eUifj`
- Alias `https://conumers-trust-hub-git-mth-v2-3-pare-3127df-savitz25-s-projects.vercel.app`
- Env pair `NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL` = `https://xkkiicsassizmakcvxml.supabase.co`

Do not use these for that test:

- `https://www.asktrusthub.com` and project `qvvxvbcdmbjzrgvwjatw`
- Move production `arepfylnilkjmyduhwbz`
- Move preview `zvoijbohtyuhqfuvteoy` and alias `move-trust-hub-git-mth-v2-3-move-cur-0a05f1`
- Insurance `gojyhmbojbwbpiamoktq` or Lender `hidcrbexurginnuqgipx`

Move preview is the specialist on the other side of a later parent-save proof. It is not where User A's password lives.

## 14. Target-state identity diagram

```
AD-0 TARGET

                    Ask consumer identity
                    qvvxvbcdmbjzrgvwjatw
                    www.asktrusthub.com
                    /my  sign-in, admission, export, delete
                              |
          +-------------------+-------------------+
          |                   |                   |
       Saved               Projects            Watch registry
       (Ask rows)          (Ask rows)          (Ask rows)
          |
          |  hub, object_class, schema_version,
          |  opaque_object_id, source_revision, receipt_id
          |  short-TTL single-use capability
          v
   specialist private object
   not keyed by Gen1 UUID
   not keyed by Ask auth.users.id

   Move evidence -------- arepfylnilkjmyduhwbz
   Insurance evidence --- gojyhmbojbwbpiamoktq
   Lender evidence ------ hidcrbexurginnuqgipx
   Contractor evidence -- specialist database (live ref UNKNOWN)
   Senior evidence ------ CARE_DATABASE_URL (live ref UNKNOWN)
   Investor evidence ---- ghjhcxfirxnszfnymdxb (source-declared)

   QA, never production IdP
   Ask preview  xkkiicsassizmakcvxml
                alias ...mth-v2-3-pare-3127df...
   Move preview zvoijbohtyuhqfuvteoy
                alias ...mth-v2-3-move-cur-0a05f1...

   Business claim stays off this drawing.
   ATH_HANDOFF_SECRET and Ask /manage are not /my.
```

Gen1 Move, Insurance, and Lender sign-in boxes stay up until a later migration ticket. They are not deleted by this map.

## 15. Migration and fate

| Layer | Current | Fate |
| --- | --- | --- |
| `qvvxvb` Ask consumer project | Intended production IdP. Plaintext env unread. | KEEP |
| Ask `/my` UX | Live shell on production. Flags encrypted. | KEEP and become the only consumer Auth UX |
| `xkkiics` | Ask V2 QA | KEEP as QA. Never promote. |
| `arepfyl` as consumer IdP | Live My Move | BRIDGE, then RETIRE as consumer IdP |
| `arepfyl` as Move evidence | Live directory and company data | KEEP specialist-owned |
| `zvoijboht` | Move preview isolation | KEEP for the isolated proof. RETIRE the browser project when the proof is done, by a later ticket. |
| `gojyhmbo` consumer Auth | Live My Insurance | MIGRATE the person to Ask. KEEP the database. |
| `hidcrbex` consumer Auth | Live My Lending | MIGRATE the person to Ask. KEEP the database. |
| Move Auth UX bridge | Still the source default for Insurance and Lender | BRIDGE, then RETIRE |
| Gen1 network handoff | Move unhealthy, Insurance RPC missing, Lender healthy on a different project | BRIDGE only where it still works. RETIRE as the SSO plan. |
| `uvqkyupfnpswdozmuzih` | Forbidden, not the live Move host | RETIRE |
| `tzzcogaricohtezsugjr` | Forbidden name in unmerged Move harness only | INVESTIGATE if it appears in an env URL. Otherwise leave it alone. |
| Contractor `cth_session` / `app_users` | Live specialist account | MIGRATE the person to Ask. KEEP tool data. |
| Contractor P13 issue route | Present, flag unread | Do not enable. V2 must not reuse it. Fate of the route is RETIRE after the parent receipt exists. |
| Senior consumer IdP | None | Do not create one. Persons use Ask. |
| Investor consumer IdP | None | Do not create one. Persons use Ask. |
| Investor `ghjhcx` | Source-declared evidence project. Env unread. | KEEP evidence. INVESTIGATE the unread URL before relying on the ref. |
| Contractor database ref | Historical QA note only | INVESTIGATE |
| Senior `CARE_DATABASE_URL` | Set, unread | INVESTIGATE the ref. KEEP as evidence. |
| Ask Neon and `CTH_READ_DATABASE_URL` | Research data plane, per control-plane docs | KEEP out of consumer Auth |
| Ask `NEXT_PUBLIC_SUPABASE_URL` | Set on all environments, no `main` TypeScript reader found | INVESTIGATE, then remove or bind deliberately |
| Extra phase database URLs on Ask production | `P13`, `P15`, `P17`, `P19` | INVESTIGATE hosts before any apply |
| Lender `TARGET_DATABASE_URL` | Production, unread | INVESTIGATE |
| `lender-trust-hub-ask-search-009` | Second production project, zero env | INVESTIGATE |
| `move-trust-hub-mdc-prod-003` | No deployment, no env, no git link | INVESTIGATE, then retire the empty project in a later ticket |
| Email-only identity merge | Forbidden by AD-0 | Do not build. |
| PR #185 and PR #169 | Open, unmerged | Do not merge from this ticket |

## 16. Unknowns and unresolved evidence

- Plaintext of production `NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL` on Ask. Source will accept only `qvvxvb`. The ciphertext was not decrypted.
- Whether Ask production feature flags are `true` or not. They exist and are encrypted. The code treats anything other than `true` as off.
- Whether `consumer.*` migrations are applied on `qvvxvb`. Not queried.
- Hosts inside `MY_TRUSTHUB_P13_DATABASE_URL`, `P15`, `P17`, `P19_*`, `MY_TRUSTHUB_DATABASE_CA`, `neon_tech_database`, and `CTH_READ_DATABASE_URL`.
- Ask `NEXT_PUBLIC_SUPABASE_URL` target and why it has no reader on `main`.
- Insurance `SUPABASE_URL` host, which is unused while the public URL is set.
- Lender `TARGET_DATABASE_URL` host.
- Contractor live database ref and live `NEXT_PUBLIC_SUPABASE_URL` host.
- Senior `CARE_DATABASE_URL` project ref, and why anon and service-role keys exist without a public URL in the filtered list.
- Investor deployed URL versus the source constant `ghjhcxfirxnszfnymdxb`. Production service-role key was not in the inventory.
- Whether non-V2 Move previews use the shared encrypted URL, which production proves is `arepfyl` for the production target.
- Anon JWT `ref` claim on the Move preview key. The guard requires `zvoijboht` and role `anon`. The token was not decoded.
- Live `Set-Cookie` Domain and Path for Supabase auth cookies. Inferred as host-only from code, not from an authenticated response.
- Rendered Insurance and Lender sign-in buttons. The bridge URL is the source default and the override env is absent. The initial HTML did not contain the bridge string.
- `lender-trust-hub-ask-search-009` purpose.
- `move-trust-hub-mdc-prod-003` purpose.
- `tzzcogaricohtezsugjr` beyond the forbidden list in the unmerged Move harness.
- Claim user store behind `/manage`.
- User A password-grant failure. Recorded, not reproduced.
- Whether the two invited preview ids satisfy the V2 two-UUID gate. The value was withheld and not parsed.

## 17. Hard invariants

1. `qvvxvbcdmbjzrgvwjatw` is the intended production consumer authority.
2. `arepfylnilkjmyduhwbz` is a migration bridge, not the long-term consumer IdP.
3. `xkkiicsassizmakcvxml` is QA only.
4. Email-only identity merge is forbidden. The same email in two projects is two identities until an explicit, reviewed link says otherwise.
5. A specialist browser never chooses the Ask consumer UUID.
6. Save is not Watch.
7. Specialist tools remain specialist-owned.
8. Ask owns Saved and Projects.
9. No production mutation during the isolated V2 proof.
10. No merge of PR #185 yet.

Also binding for anyone using this map:

- Do not point Insurance or Lender back at `arepfyl` to recreate Generation 1.
- Do not use `zvoijbohtyuhqfuvteoy` as an Ask user pool.
- Do not use `xkkiicsassizmakcvxml` on `www.asktrusthub.com`.
- Do not send a production service-role key to a preview project.
- Do not reset User A or run credentialed login probes from documentation work.
- Do not treat business claim as consumer Auth.
- The specialist private object is not keyed by a Generation 1 UUID or by Ask `auth.users.id`.
- Continuation uses a short-TTL single-use capability. This document does not implement it.
