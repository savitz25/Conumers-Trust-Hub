# My TrustHub control plane and P11B implementation

**Phase:** 2 / Prompt 11

**Date:** September 7, 2026

**Status:** Complete. P11B passed on an ephemeral Supabase branch, the branch was deleted, and the permanent Consumer project remains unapplied.

**Parent architecture:** `docs/my-trusthub-production-architecture.md`

## 1. Audit result

The Prompt 10 assumption that Move, Insurance, and Lender currently share one Supabase Auth tenant is not supported by the live topology. They have separate active Supabase projects in different regions. Move has five Auth users, Insurance has two, and Lender's separate project has none. A privacy-preserving comparison found one matching normalized email across Move and Insurance, but the two records have different `auth.users.id` values. No literal UUID collision was observed; the material problem is that one person can already have multiple incompatible auth subjects.

That finding triggered Prompt 11's original stop condition. The founder has now resolved it: `Conumers-Trust-Hub` is the dedicated parent control plane; its `auth.users.id` is canonical for My TrustHub; vertical subjects are linked explicitly and are never copied, reused, or merged by email. This document retains the original topology evidence and supersedes its former blocked conclusion.

The approved control plane is the existing empty Supabase project named `Conumers-Trust-Hub` (`qvvxvbcdmbjzrgvwjatw`) in `us-east-1`. It has no Auth users, no application tables, no custom schemas, no applied migrations, and no current Security Advisor findings. P11B is validated on an isolated development branch; deployment to this permanent project remains a separate approval.

## 2. Audit method and limits

The audit used:

- the full Prompt 10 architecture and Phase 1 handoffs;
- local production repositories, migration histories, auth/handoff code, environment-variable names, and configuration documentation;
- live read-only Supabase project, organization, schema/table, Auth aggregate, policy, and Security Advisor inspection;
- live read-only Vercel project/deployment metadata;
- privacy-preserving email-hash comparison across the two tenants that contain Auth users; hashes, emails, user IDs, JWTs, and keys were not retained or printed;
- official Supabase documentation for backup, RLS, custom-schema, redirect, and production-security behavior.

Available connectors do not expose Vercel environment values, Supabase Auth redirect allowlists/provider configuration, PITR enablement, network restrictions, SSL enforcement, compute sizing, SMTP configuration, or organization MFA enforcement. The local repositories are not Vercel-linked on this machine and the Vercel CLI is not installed. These settings therefore remain unverified rather than assumed.

## 3. Current Supabase and application topology

All listed Supabase projects are active/healthy and belong to the same Pro organization. Being in one billing organization does not make them one Auth tenant.

| Surface | Supabase project | Region | Observed Auth users | Current identity/data finding |
| --- | --- | --- | ---: | --- |
| Ask / Consumer candidate | `Conumers-Trust-Hub` (`qvvxvbcdmbjzrgvwjatw`) | `us-east-1` | 0 | No app tables or current Supabase runtime in the Ask repository. Candidate parent control plane only. |
| Move | `Move-Trust-Hub` (`arepfylnilkjmyduhwbz`) | `us-west-2` | 5 | Email and Google identities observed. Contains Move personal/business data, live handoff rows, Move evidence, and copied Lender identity/evidence tables. |
| Lender | `Lender-Trust-Hub` (`hidcrbexurginnuqgipx`) | `us-east-2` | 0 | Separate Lender evidence project and empty handoff table. Checked-in docs intend deployed Auth to point to Move; deployed env is unverified. |
| Insurance | `Insurance-trust-hub` (`gojyhmbojbwbpiamoktq`) | `ca-central-1` | 2 | Google identities observed plus consumer research tables. Local env targets this project; docs intend shared Move Auth for deployment. No live handoff table in this project. |
| Contractor | `contractor-trust-hub` (`jhjztnisugdsuliriajp`) | `ca-central-1` | 0 Supabase Auth | The app uses separate `app_users`, `auth_magic_links`, and `auth_sessions` tables. They currently contain no users, but their UUID semantics are independent of `auth.users`. |
| Senior | `care-trust-hub` (`wiuiwgbablgyssuxrjho`) | `us-east-1` | 0 | Evidence/identity store; no established consumer Auth model. |
| Investor | `Investor-Trust-Hub` (`ghjhcxfirxnszfnymdxb`) | `us-east-2` | 0 | Evidence store plus empty future consumer tables keyed to its own Auth tenant. |

The Vercel team contains distinct production-target projects for Ask, Move, Insurance, Lender, Contractor, Senior, and Investor. Project/domain linkage is visible, but secret/environment values are not available through the connector. It is therefore not possible to prove whether the deployed Insurance and Lender applications currently override their own data-project URLs with Move's Auth project.

### 3.1 Auth-subject collision result

- Literal UUID intersection between current Move and Insurance Auth users: **0**.
- Same normalized email present in both tenants: **1**.
- Same email represented by different UUIDs: **1**.
- Ask candidate, Lender, Contractor Supabase Auth, Senior, and Investor Auth currently have zero users.

The architecture cannot treat email as the durable cross-network subject. Email can change and must not be used as an authorization key. A controlled account-link/migration process must choose one canonical `auth.users.id` and record legacy subject mappings before any cross-hub import.

## 4. Current Business Manager boundary

Business/company authorization is already fragmented and must remain separate from the new consumer root:

- Move uses `company_claims` and `company_owners`; ownership is keyed by an Auth user UUID and managed through service-role policies.
- Contractor's account/passport work is keyed to its separate `app_users` and custom session tables.
- Insurance has agency-listing intake and consumer research tables but no shared network business-role model was found.
- Senior and Investor evidence systems do not establish a common Business Manager authorization model.

The same future canonical auth subject may be referenced by both `consumer.consumer_profiles` and a vertical business-role mapping, but neither relationship grants the other. Existing business rows must be migrated or linked independently; they must not be copied into the consumer schema or used in consumer RLS.

## 5. Region, backup, capacity, and security posture

The organization is on Supabase Pro. Supabase documents daily backups with seven days of availability for Pro projects. Actual per-project backup success, restore drills, PITR enablement, compute size/capacity, network restrictions, SSL enforcement, Auth SMTP, redirect configuration, and organization MFA enforcement were not visible in the available tooling.

The candidate Consumer project is active/healthy on Postgres 17 in `us-east-1`, has no branches, and reports zero current Security Advisor findings. This is a clean starting point, not evidence that production controls are complete. Before migration creation, the project owner must verify:

1. daily backup visibility and a successful restore drill plan;
2. PITR requirement and recovery-point/recovery-time objectives;
3. US East region acceptance for consumer privacy and latency;
4. compute/capacity and connection-pooling plan;
5. SSL enforcement and database network restrictions;
6. project and organization MFA/owner recovery;
7. custom SMTP, OTP expiry/rate limits, session duration, and abuse controls;
8. exact Site URL and explicit production/preview/local redirect allowlists;
9. enabled Auth providers and account-linking policy;
10. separate production and non-production migration/test environments.

The vertical data projects are not suitable substitutes for the parent control plane. Current Security Advisor counts are: Move 122, Lender 28, Insurance 55, Contractor 39, Senior 96, and Investor 58. Many findings concern RLS-disabled public-schema evidence/staging tables, RLS-enabled tables without policies, mutable function search paths, or broadly executable security-definer functions. Those findings require their own vertical remediation, but placing private consumer state beside them would unnecessarily widen the privacy blast radius.

Official references:

- [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase Production Checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase custom schemas](https://supabase.com/docs/guides/api/using-custom-schemas)
- [Supabase Auth redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)

## 6. Current RLS and schema posture

The candidate Consumer project currently contains only Supabase-managed schemas/tables. It has no `public` application tables and no `network`, `consumer`, or `ops` schemas.

Existing vertical consumer tables generally enable RLS but use inconsistent policy styles. Examples include `roles={public}` ownership policies in Insurance and Investor, and service-role-wide policies in Move. Many public evidence/staging tables in Move, Lender, Contractor, Senior, and Investor have RLS disabled. This is acceptable only where the Data API grants and API surface are independently constrained; it is not acceptable as the foundation for My TrustHub private state.

No browser-facing consumer table should be created in `public`. Future migrations must explicitly create custom schemas, revoke default access, grant only required schema usage, and expose narrow views/RPCs or the parent BFF. RLS and grants are independent controls; both must deny access by default.

## 7. Existing canonical identities by hub

No previously missed universal cross-hub entity table was found. The parent registry must point to these authoritative vertical keys:

| Hub | Authoritative identity/key candidates | Binding note |
| --- | --- | --- |
| Move | `providers.id`; legacy `companies.id`; authority rows and USDOT/source keys | Choose `providers.id` as the forward canonical hub key after Move identity-governance review; bridge legacy company IDs. |
| Lender | `lender_national_entities.id` plus typed `lender_identifiers` | Strong national identity spine with conflict quarantine and source links. |
| Insurance | `national_entities.id`, identifiers, provider bridge, and legacy `providers.id` | Bind the national entity where resolved; unresolved provider rows remain review-required. |
| Contractor | `contractors.id`, `licenses.id`, regulatory `entities.id`, and contractor/entity links | Entity type must distinguish company, license, and regulatory party. Namespaced state/source license identifiers are mandatory. |
| Senior | `provider.id` plus versioned `provider_identifier` | Already models validity ranges; provider class must remain explicit. |
| Investor | `firms.id`/`people.id` plus versioned typed identifiers | Network entity type must distinguish firm and professional. |

The new registry is a thin pointer layer. It does not copy evidence, scores, source snapshots, complaints, or regulatory rows.

## 8. Existing cross-domain handoff audit

### 8.1 Current design

The checked-in Lender and Insurance implementation uses:

- 32 random bytes encoded as a browser-visible opaque code;
- SHA-256 storage as `code_hash`;
- a 90-second expiry;
- target-hub binding;
- atomic one-time consumption through a security-definer RPC;
- relative destination-path sanitization and origin checks;
- a per-user rate limit of 10 new handoffs per minute;
- service-role lookup of the user, server-generated magic-link token hash, and destination-host `verifyOtp` to establish a host-scoped cookie.

The Move project contains 24 handoff rows. The separate Lender project contains an empty handoff table. The Insurance project does not contain the table even though its repository includes the migration. This pattern works only when every participating deployment reads the same Auth and handoff database. That premise is unverified and contradicted by local configuration plus divergent live Auth users.

### 8.2 Security gaps

The design has useful replay controls, but P13 must address these gaps before extension:

- no browser/session-bound state or nonce, leaving a login-CSRF/session-swapping risk;
- issuer/audience and origin intent are implicit rather than recorded and verified;
- live destination redirect allowlists and deployed project refs are unverified;
- the implementation requires broad service-role credentials in each participating application;
- handoff records/functions live in `public` instead of a private `ops` boundary;
- the raw one-time code is necessarily in the URL and therefore needs strict referrer/log redaction and immediate removal after consumption;
- rate counting fails open to zero when its query errors;
- identity lookup assumes the same `auth.users.id` exists at the destination.

No handoff code was changed in P11. Until P13 binds all handoffs to the selected identity authority and adds browser state/nonce, existing handoffs must not be expanded to Ask, Contractor, Senior, or Investor. Cross-tenant handoff is not an identity-linking mechanism.

## 9. Control-plane decision and gate

### 9.1 Decision reached

The Prompt 10 recommendation to reuse a presumed Move/Insurance/Lender shared tenant is **rejected**. There is no proven shared tenant, and Move is also a large vertical data/business store with a materially broader Security Advisor surface.

The recommended control plane is the existing dedicated `Conumers-Trust-Hub` project in `us-east-1`. It will own the canonical consumer auth subject, `network`, `consumer`, and `ops` schemas, and cross-hub state. Vertical projects remain evidence authorities.

### 9.2 Decision authorized for non-production P11B validation

The founder approved the dedicated Consumer project and the following identity rules for P11B:

1. parent `auth.users.id` is the canonical My TrustHub subject;
2. vertical subject IDs are opaque legacy identifiers linked through verified evidence;
3. email alone is never a link or merge method;
4. Business Manager authorization stays independent;
5. Parent/Ask owns network identity governance;
6. only an isolated non-production branch may receive P11B during this prompt.

Auth redirect/provider, SMTP, network restriction, PITR, and restore settings remain explicit launch gates where the available tooling cannot inspect them. They do not authorize a production migration. P12 must not begin until the isolated P11B SQL matrices pass.

## 10. Schema boundary implementation

The migration `supabase/migrations/20260907160000_my_trusthub_identity_foundation.sql` creates only:

- private schemas `network`, `consumer`, and `ops`;
- `network.network_entities`;
- `network.network_entity_bindings`;
- `network.network_entity_redirects`;
- `network.identity_governance_events`;
- `consumer.consumer_profiles`;
- narrowly scoped database roles/grants and RLS policies;
- helper functions needed for deterministic canonical resolution and redirect-cycle prevention;
- `ops.consumer_identity_links` and its append-only link audit events for explicit canonical-to-legacy mapping.

P11 must not create Saves, Projects, memberships, sessions, Watches, capabilities, observations, changes, Alerts, notifications, decisions, snapshots, export jobs, or deletion jobs.

### 10.1 Planned registry constraints

`network.network_entities` uses UUID IDs, constrained `entity_type`, closed Network V2 `primary_hub`, optional normalized jurisdiction, `active/review_required/merged/retired` status, canonical name, and timestamps. It contains no score, ranking, review, claim, or regulator payload.

`network.network_entity_bindings` stores the hub-local entity ID, identifier namespace/value, jurisdiction, status (`accepted/review_required/superseded/invalid`), confidence/resolution metadata, validity interval, and provenance. Planned constraints include:

- only a parent identity governor may mark a binding accepted/superseded/invalid;
- a specialist proposal service may create only `review_required` bindings for its own hub;
- overlapping accepted validity intervals for the same `(hub, identifier_namespace, normalized jurisdiction, source_identifier)` are rejected;
- non-overlapping intervals permit legitimate identifier reuse without moving the earlier entity;
- one current accepted hub-local specialist ID cannot bind to two active network entities;
- review-required/invalid bindings are distinguishable in resolution and can never return `watch_identity_eligible=true`;
- direct browser writes are revoked.

`network.network_entity_redirects` rejects self-redirects. A privileged insertion function resolves the complete target chain inside a transaction and rejects cycles or ambiguous multiple active redirects. Canonical resolution follows redirects to one terminal active entity with a bounded recursion guard.

## 11. Network identity governance — closed

The governance ownership decision is closed as recommended in Prompt 10:

- **Parent/Ask Trust Hub owns network identity governance and the registry.**
- Specialist hubs remain authoritative for their vertical IDs/evidence and may propose bindings.
- A specialist-scoped service can create or refresh only review-required proposals for its hub.
- An approved parent identity-governor service or reviewed operator accepts/supersedes bindings and creates redirects.
- Canonical merges require provenance, reason, actor identity, before/after IDs, transaction ID, and an append-only governance event.
- No arbitrary specialist browser or server may create an accepted binding or redirect.

Later merge processing must reconcile consumer references transactionally without silently expanding Watch coverage. No real entities were merged in P11.

## 12. Consumer root and Business Manager boundary

`consumer.consumer_profiles` will contain only:

- `user_id uuid primary key references auth.users(id)`;
- `preferred_zip text null` with format validation;
- `research_memory_enabled boolean not null default true`;
- `created_at` and `updated_at`;
- optional `deleted_at` only if the deletion-orchestration design proves it necessary.

Creating a profile means the auth user has a consumer workspace. It does not create or infer a business role. A business role does not create a consumer profile. A dual-role user is authorized as a consumer only through their own `auth.uid()` and as a business user only through the independent vertical company-role mapping.

No ranking/public-profile table has a foreign key or trigger from `consumer_profiles`. No consumer write role receives privileges on ranking, claim, public profile, or vertical evidence tables.

## 13. RLS and explicit grants

The initial consumer policy contract is:

| Operation | Role | Policy |
| --- | --- | --- |
| SELECT own profile | `authenticated` | `(select auth.uid()) = user_id` and not deleted |
| INSERT own profile | `authenticated` | `WITH CHECK ((select auth.uid()) = user_id)` |
| UPDATE own profile | `authenticated` | same ownership in both `USING` and `WITH CHECK`; column grant limits updates to `preferred_zip` and `research_memory_enabled` |
| DELETE profile | browser roles | denied; deletion will use a separately reviewed server workflow |
| Any profile access | `anon` | denied; no table/schema grant |
| Network registry mutation | `anon`/`authenticated` | denied; no table mutation grant and no public mutation RPC |

Future migration requirements:

- enable and force RLS where compatible on every `consumer` table;
- revoke schema/table/function privileges from `PUBLIC`, `anon`, and `authenticated` before adding narrow grants;
- keep `network`/`ops` base tables outside the browser Data API or grant no browser schema usage;
- qualify all function names, set a fixed safe `search_path`, revoke default function execute, and avoid security-definer functions unless a reviewed cross-row invariant requires one;
- use `TO authenticated`, `(select auth.uid())`, and indexed ownership columns;
- never derive authorization from `user_metadata` or the presence of a Business Manager role.

## 14. Service identities

Do not distribute one universal Supabase service-role credential to all hubs. The intended least-privilege identities are:

| Identity | Intended rights | Explicit denial |
| --- | --- | --- |
| `identity_proposer_<hub>` | Propose/update review-required bindings for one hub | Cannot accept bindings, redirect entities, or read consumer profiles |
| `identity_governor` | Accept/supersede bindings, create redirects, append governance events | No consumer-private content or vertical evidence mutation |
| `source_ingestor_<hub>` | Later publish accepted minimal observation envelopes/checkpoints for one source scope | No consumer enumeration or identity merges |
| `change_detector` | Later read accepted observations/capabilities and write idempotent changes | No Auth/admin or notification rights |
| `alert_fanout` | Later match active coverage and create Alerts through a constrained operation | No source mutation or private notes access |
| `notification_delivery` | Later read delivery-ready Alert projection and update delivery ledger | No Projects/Saves/notes enumeration |
| `export_worker` | Later read one authorized user's export projection for one job | No cross-user/background browsing |
| `deletion_worker` | Later execute one approved user deletion and reconciliation | Cannot delete network/public/business data |

Where Supabase's service role is temporarily unavoidable, only the parent control-plane backend may hold it; it must be server-only, separately rotated, excluded from browser bundles/logs, and wrapped in narrow audited code paths. Hub applications receive hub-scoped credentials or signed parent API access, never the parent service role.

## 15. Historical Prompt 11 stop-state test status

> This section through Section 21 records the original Prompt 11 stop state. It is superseded by the completed P11B result in Sections 22–28 and the P11B handoff.

Automated P11 RLS/entity tests were **not created or run** because the required stop condition prohibited creating the target schemas. Claiming pass results without a selected identity authority and isolated test database would be false assurance.

The required suite is preserved as the resume gate:

| Test | Expected | Current result |
| --- | --- | --- |
| Consumer A reads own profile | Allow | Blocked — table intentionally absent |
| Consumer A updates own research-memory flag | Allow | Blocked |
| Consumer A reads/updates Consumer B | Deny | Blocked |
| Anonymous reads/writes profile | Deny | Blocked |
| Business-only user reads unrelated profile | Deny | Blocked |
| Dual-role user reads own profile | Allow | Blocked |
| Dual-role user reads another profile | Deny | Blocked |
| Browser inserts accepted binding | Deny | Blocked |
| Browser creates redirect | Deny | Blocked |
| Approved identity service creates binding | Allow | Blocked |
| Specialist service enumerates profiles | Deny | Blocked |
| Consumer writes ranking/public profile | Deny | Blocked |
| Service secret absent from client bundle | Verify | Parent code scan passed; no service-role reference in current Ask runtime |
| Accepted binding resolves | Resolve terminal entity | Blocked |
| Review-required binding remains ineligible | Distinguishable/false | Blocked |
| Invalid binding does not resolve accepted | Deny accepted resolution | Blocked |
| Exact duplicate accepted binding | Reject | Blocked |
| Non-overlapping validity permits reuse | Allow without reassignment | Blocked |
| Overlapping accepted validity | Reject | Blocked |
| Redirect resolves terminal canonical entity | Resolve | Blocked |
| Redirect loop | Reject transaction | Blocked |
| Cross-hub bindings share one entity | Allow | Blocked |

## 16. Migration status and rollback

- Migration files created: **none**.
- Migrations applied to local, branch, staging, or production: **none**.
- Production database writes: **none**.
- Persistent test fixtures: **none**.
- Rollback validation: not applicable because nothing was applied.

The candidate project has no development branches. Creating one can incur cost and requires the separate Supabase cost-confirmation workflow. Once the control-plane gate closes, create or designate a non-production environment before authoring/applying the P11 migration, validate forward and compensating/down behavior there, then run the complete allow/deny matrix. Production application remains a separately approved step.

## 17. Risks and blockers before P12

### P0 blockers

1. **Canonical auth subject undecided:** same human already has different Move and Insurance UUIDs.
2. **Deployed Auth topology unverified:** checked-in intention and local/live database evidence disagree.
3. **Candidate security configuration incomplete:** redirect/provider, PITR, network, SSL, SMTP, MFA, session, and capacity settings are not visible/approved.
4. **No isolated migration test target:** the candidate has no branch and no local Supabase test harness.

### P1 risks

- Existing handoff is not browser-state/nonce bound and assumes a shared Auth user ID.
- Broad vertical Security Advisor findings make vertical databases poor control-plane hosts.
- Existing Business Manager roles use different stores and require deliberate legacy-subject mapping.
- Move contains copied Lender identity data, so network binding ownership must choose authoritative hub records explicitly.
- Ask's package lock contains Supabase packages absent from `package.json`; dependency reconciliation is required before runtime work.

## 18. Deferred work

P12 remains responsible for Saved entities, Projects, Project memberships, private notes, and explicit guest import. P13 remains responsible for full specialist BFF/API integration, auth handoff hardening, opaque Project-context handoffs, and signed return flows.

Paused-Watch behavior, guest/recent retention, deletion retention, and Watch capability/freshness governance remain deferred to their scheduled prompts. No Watch, observation, Alert, session, decision, export, or deletion model was created here.

## 19. P12 readiness answer

1. **Is the control plane safe enough to build Saves and Projects?** No. The dedicated candidate is structurally appropriate, but its auth/configuration/migration gate is still open.
2. **Can one auth subject safely support Consumer and Business Manager?** The architecture supports it, but existing subjects/roles have not been linked to the candidate. Separation must be proved with dual-role RLS tests first.
3. **Is the registry safe enough for Saved-row references?** The constraint/governance design is ready; the registry does not exist and its tests have not run.
4. **Are review-required bindings prevented from becoming Watch identities?** The contract explicitly requires this, but enforcement cannot be claimed until the schema/resolution tests pass.
5. **Any reason not to proceed to P12?** Yes: all four P0 blockers above. Resume and complete P11 before P12.

## 20. Exact P11 continuation scope

After explicit approval of the dedicated Consumer control plane and identity migration direction, resume P11 with this bounded sequence:

1. verify live Auth/redirect/provider/PITR/network/SMTP/session controls;
2. establish a non-production branch/project and migration workflow;
3. reconcile Ask's Supabase dependencies;
4. author one reversible namespaced migration for the P11-only objects in Section 10;
5. create least-privilege grants/RLS and governance functions;
6. run every authorization and entity-resolution test in Section 15;
7. run security/performance advisors and migration rollback validation;
8. generate safe types/contracts and document the canonical subject/linking procedure;
9. leave production unapplied pending explicit deployment approval;
10. reassess P12 readiness.

Only after that continuation passes should P12 implement Saved entities, Projects, multi-Project memberships, private notes, and consent-based guest import.

## 21. Validation performed

- Production Next.js build: **passed**; all 55 static/dynamic route entries generated. Two pre-existing unused-variable warnings remain.
- TypeScript `tsc --noEmit`: **passed**.
- Existing Network V2 and SHARE-002 assertion scripts: **passed**.
- Full raw `eslint .`: **failed** because the repository's ESLint configuration traverses generated `.next` output and other existing generated/test artifacts (6,696 reported problems). The Next production build's source lint/type phase passed with the two warnings above. P11 changed no TypeScript/JavaScript source file.
- Documentation structure, UTF-8, balanced fences, trailing whitespace, and embedded-secret scan: **passed**.
- `git diff --check`: **passed**.
- Candidate control-plane recheck: no `public`, `network`, `consumer`, or `ops` application tables; no applied project migrations.
- Migration/RLS/entity-registry tests: **not run**, because the stop condition correctly prevented creating their subject schemas.

## 22. P11B completion result

The isolated branch ran 31 SQL assertions twice: after the initial forward migration and after a complete rollback plus clean reapplication. Both runs passed.

- Authorization: 15/15 passed, including own-row allow, cross-user/anonymous/business-only denies, dual-role isolation, browser network-mutation denial, hub-scoped proposal allow, specialist self-accept denial, and specialist consumer-enumeration denial.
- Entity resolution: 10/10 passed, including accepted/review/invalid states, exact duplicates, non-overlapping identifier reuse, overlap rejection, deterministic redirects, loop rejection, cross-hub canonicalization, and governance audit events.
- Identity links: 6/6 passed, including one canonical subject with multiple vertical links, legacy-subject uniqueness, email-only rejection, audit events, and browser enumeration denial.
- Service-role secret scan passed; no public service-role environment variable or client-bundle marker exists.

All deterministic fixtures were deleted. Final branch row counts were zero for profiles, entities, bindings, and identity links.

## 23. Migration and rollback result

- Forward migration: `supabase/migrations/20260907160000_my_trusthub_identity_foundation.sql`.
- Compensating rollback: `supabase/rollback/20260907160000_my_trusthub_identity_foundation.down.sql`.
- SQL matrix: `supabase/tests/p11_identity_foundation.sql`.
- Applied only to ephemeral branch `p11b-identity-foundation-validation`.
- Rollback removed all P11 schemas, tables, functions, policies, and `myth_*` roles.
- The final consolidated migration reapplied cleanly and passed the complete matrix again.
- The ephemeral branch was deleted immediately after validation.
- The permanent project has no P11 application tables and no P11 migration. Supabase Branching initialized its system `remote_schema` baseline migration when the first branch was created; no application DDL was applied to main.

## 24. Advisor and configuration result

The permanent project remains `ACTIVE_HEALTHY`, Postgres 17.6 in `us-east-1`. It has no application tables and Security Advisor reports no findings. The final clean branch also had no Security Advisor findings. Performance Advisor reports only the existing informational Auth fixed-connection allocation (`10` connections); three foreign-key-index findings from the first run were fixed before clean reapplication.

Available tooling does not expose Site URL/redirect allowlists, enabled providers, SMTP, OTP/session policy, network restrictions, SSL policy, backup-run history, PITR enablement, or restore drills. Those remain deployment gates rather than inferred settings. Pro plan documentation provides daily-backup expectations, but it does not prove this project's restore readiness.

## 25. P11B remaining risks

There is no new P0 blocker in the P11 schema or authorization foundation.

- P1: Auth redirect/provider, SMTP, session, network, PITR, and restore controls require dashboard/management verification before production application.
- P1: existing cross-domain handoffs lack the P13 browser-state/nonce and parent-subject link contract.
- P1: legacy Business Manager roles require explicit, separate subject linking; no user was migrated in P11B.
- P1: hub binding proposals require an operational parent review process before any accepted production binding.
- P2: the fixed Auth connection allocation must be revisited when compute size or traffic changes.

## 26. Deferred work

P12 remains responsible for Saved entities, Projects, Project memberships, private notes, and explicit guest import. P13 remains responsible for the specialist BFF/API, hardened auth/context handoffs, and signed returns. No P12 table, legacy-user migration, Watch, capability, observation, Alert, session, decision, export, or deletion job was created.

## 27. P12 readiness

1. **Is the control plane safe enough to build Saves and Projects?** Yes at the reviewed migration-contract level; permanent application remains separately approved.
2. **Can one auth subject safely support Consumer and Business Manager?** Yes. RLS keys consumer access only to the canonical subject, and simulated business metadata grants no additional consumer rights.
3. **Is the registry safe enough for Saved-row references?** Yes. Accepted identity, validity, redirect, overlap, and cross-hub invariants passed twice.
4. **Are review-required bindings prevented from becoming Watch identities?** Yes. The function returns false and hub proposer RLS prevents self-acceptance.
5. **Any reason not to proceed to P12?** No P11 data-model blocker remains. P12 must still stay non-production until the permanent migration is separately reviewed and authorized.

## 28. Final P11B validation

- Next.js production build: passed; 55 routes generated.
- TypeScript `tsc --noEmit`: passed.
- Changed-file ESLint: passed.
- Existing Network V2 and SHARE-002 assertions: passed.
- P11 static contract: passed.
- SQL authorization/entity/link matrix: 31/31 passed twice.
- Migration rollback and clean reapplication: passed.
- Branch Security Advisor: no findings.
- Branch Performance Advisor: only the existing Auth fixed-connection informational notice after index fixes.
- `git diff --check`: passed.
- Ephemeral branch: deleted.
- Permanent Consumer project: P11 unapplied; no application tables.
