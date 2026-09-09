# Trust Hub Network Inventory

Read-only audit date: 2026-09-08. SHAs are fetched `origin/main`, not inferred from local working trees. Supabase refs are recorded only when committed configuration safely exposes a ref; absence below means **not safely discoverable**, not “no database.”

| Hub | Repository / main SHA | Production / Vercel project | Runtime / data ownership |
|---|---|---|---|
| Ask | `savitz25/Conumers-Trust-Hub` / `4dc1f25d432e33da52098beebd2c13e2e9113d1d` | asktrusthub.com / `conumers-trust-hub` | Next 16.3.3; network orchestration, customer/organization/claim/grant/Layer B and aggregate network contracts; Supabase integration ref `qvvxvbcdmbjzrgvwjatw` (name not exposed by the integration status). |
| Contractor | `savitz25/contractor-trust-hub` / `697052a4fd2d1ba2ced985c5373315fd16517ed8` | contractortrusthub.com / `contractor-trust-hub` | Next 16.3.3; DBPR identity/evidence, Florida contractor publication and specialist Search. Supabase-backed; ref not safely committed. |
| Move | `savitz25/Move-trust-Hub` / `bb7177cdf7eb9c26ffe8c24884212a4f16950d07` | movetrusthub.com / `move-trust-hub` | Next 15.5.19; FMCSA, FDACS and state mover evidence, publication and Search. Supabase refs are environment-selected; no single safe canonical ref in source. |
| Lender | `savitz25/Lender-Trust-Hub` / `964faacdb780d0421f7a404c6f9daecaf0af17d3` | lendertrusthub.com / `lender-trust-hub` | Next 16.2.9; lender identity, HMDA, CFPB/OFR/state evidence and Search. Supabase-backed; ref not safely committed. |
| Senior | `savitz25/care-trust-hub` / `060952b994aded2edd4e0aa41abfb9bba2fe022b` | seniortrusthub.com / `care-trust-hub` | npm workspace; Next web app; CMS/state provider identity/evidence, publication and Search; PostgreSQL pool configuration, no committed Supabase ref. |
| Insurance | `savitz25/Insurance-trust-hub` / `fca65060a9d8c27eae5ab70626ead0716a212dd5` | insurancetrusthub.com / `insurance-trust-hub` | Next 15.5.19; agency/producer/insurer identities, LOA, appointments, Marketplace and state evidence. Supabase-backed; ref not safely committed. |
| Investor | `savitz25/investor-trust-hub` / `874c8d039589021d2989db4b75c6e74524bb3961` | investortrusthub.com / local Vercel link not present (`investor-trust-hub-web` observed in release records) | npm workspace; Next web app; SEC/IARD/Form ADV identity/evidence, publication and Search; PostgreSQL URL, no committed Supabase ref. |

Audit runtime: Node `v24.19.0`, npm `11.17.0`, Supabase CLI `2.117.0`. Audit branch: `ath-admin-001-control-plane-audit`.

## Surfaces, ownership and operations

### Ask

- Internal surfaces: `/internal/review`, `/internal/record-issues`, `/internal/business-replies`, launch/QA fixture surfaces and authenticated internal APIs for review, revoke, replies, handoff minting and record issues. Privilege uses staff allowlists/operator secrets plus server database access; this is legacy/pre-RBAC and must be replaced, not silently reused as the final Control Plane.
- Claims/Business Manager: six specialist handoffs; exact hub/native-profile/entity bindings; claim states and authority review; organizations, memberships, invitations, management grants/revocation; Layer B profile, corrections, replies and monitoring. Contractor publication is the most complete currently certified path. Competing claims and review queues exist but policy is not one uniform network KYB rule.
- Consumer: passwordless account sessions; My Trust Hub is business-focused. Network Ask orchestrates specialist execution/handoffs. A unified consumer Project/Save/Watch store is not established in this repository at the level envisioned by the future Control Plane.
- Search: Search V3 planner/scope/destinations, guided sessions, multi-hub journeys, specialist adapters, exact identifier handoffs, fail-closed states. Existing Vercel client analytics are bounded and non-authoritative; ATH-ADMIN-001 adds normalized terminal outcome without raw question text.
- Operations: regulatory-monitoring cron, transactional Resend mail, specialist execution URLs and verification scripts. Search adapter errors fail closed; specialists own evidence refresh.

### Contractor

- No broad legacy admin. Account/claim handoff and monitoring endpoints exist; Ask owns claim review and grants. Claimable grain is exact contractor company/native profile with credential binding.
- Layer B publication/replies use explicit public contracts; DBPR credentials, status, qualifier, discipline and official clocks remain specialist-owned. Search supports credential/entity/trade/geography/status/evidence with structured match reasons.
- Operations include DB publication gates, profile generation, public contracts and specialist execution. Existing profiles/state/county/permit/enforcement semantics remain untouched.

### Move

- Largest legacy admin: `/admin` login plus BBB, FMCSA, My Move users, portal claims/disputes, quotes, reviews and company suggestions. The repo also retains older lender/insurance admin namespaces. Human auth includes `ADMIN_SECRET`/trusted submitters; machine refresh uses cron/revalidate secrets and service credentials.
- Claimable grain is mover company/profile with USDOT/MC and source-specific identity; Ask handoff/grant flow coexists with My Move/portal history. Consumer assets include saved quotes, saved move plans, reviews and quote requests.
- Specialist system owns FMCSA authority/role, FDACS intrastate linkage and state evidence; headquarters never means service territory. Workflows refresh FMCSA/BBB, county compliance, network metrics and production smoke. These become future adapters/queue types, not deletions.

### Lender

- Limited visible `/admin/login` plus server admin access and internal Florida profile tools; legacy `ADMIN_SECRET` remains. Exact institution identity is separate from branch/MLO; NMLS/LEI bridges and publication holds are specialist-owned.
- Ask handoff supplies claim doorway; organization/grant truth remains Ask. HMDA applications/originations/denials, property geography, CFPB/OFR/state evidence, calculators, compare and profiles stay local.
- Migrations cover identity spine, HMDA, snapshots, workspaces/handoff and state evidence. State roster gaps retain REQUEST_ONLY/NOT_ACQUIRED semantics.

### Senior

- No broad human admin found on current main; internal Florida research and claim-handoff routes exist. Claimable/public grains remain nursing home, home health and hospice classes with exact class-aware CCN binding.
- CMS provider, inspection, deficiency, penalty, staffing, ownership/CHOW, HHCAHPS/Hospice CAHPS and state assisted-living adapters remain local. Provider classes are never combined.
- Scheduled CMS refresh and CI workflows operate the source layer. Shortlist, comparison and provider discovery are consumer specialist features; they are not copied into Ask.

### Insurance

- Extensive `/admin` login/logout, provider/listing requests, enrichment, leads, license backfill and review APIs/actions. Legacy `ADMIN_SECRET` and server privileged database access require ADMIN-002 treatment.
- Identity grains are agency, producer/person and legal insurer; public people and graph-agency publication gates remain closed unless specialist policy permits. ZIP directory/listings are a separate publication grain. Claim doorway uses Ask handoff.
- Specialist owns credentials, LOA, appointments, Marketplace plan-year evidence, complaints/exams/rate filings and state ingestion. Legacy leads, listings, enrichment/reviews and provider operations are future adapters/queues, not migration targets here.

### Investor

- No broad human admin found. Internal SEC ADV/SEO gates, claim handoff and CI/metrics workflows exist. Firm CRD, person CRD, SEC file and filing IDs remain distinct.
- Specialist owns RIA/ERA, Form ADV, RAUM, compensation, affiliations, ownership/control, disclosures, state evidence and Wave-1 indexability. `/firms` remains the precision directory beside `/ask`.
- Ask owns business claim/grant workflow; Investor owns firm publication and deterministic execution. Repaired CI baseline and state publication gates remain unchanged.

## Claim and consumer boundaries

All hubs expose public claim entry/handoff appropriate to their published profile grain; Ask authenticates handoffs and stores network customer/organization/grant records. Authority evidence, automatic eligibility, holds and competing-claim behavior are not sufficiently uniform to populate a universal policy: unproven cells are `NOT_YET_DEFINED`. Business responses and corrections retain their current specialist/Ask contracts. Specialist consumer utilities (Move plans/quotes, Senior Shortlist, lender calculators/compare, Insurance directory, Investor firm search) remain local systems of record.

## Secret-name inventory (values never inspected or recorded)

Classification applies by usage: `NEXT_PUBLIC_*` = PUBLIC CLIENT; `ADMIN_SECRET`, `ATH_OPERATOR_SECRET`, staff allowlists = HUMAN LEGACY; `CRON_SECRET`, `REVALIDATE_SECRET`, handoff secrets = MACHINE; database URLs/service-role keys = SERVER PRIVILEGED; provider API keys = EXTERNAL API; Resend/Brevo/RingCentral/mail recipient settings = EMAIL/SMS; build/feature flags = UNKNOWN/operational configuration.

- Ask: `ATH_OPERATOR_SECRET`, `ATH_STAFF_EMAILS*` (HUMAN LEGACY); `CRON_SECRET`, `ATH_HANDOFF_SECRET` (MACHINE); `DATABASE_URL`, `ASK_DATABASE_URL`, `CTH_READ_DATABASE_URL`, `CARE_DATABASE_URL` (SERVER PRIVILEGED); `RESEND_API_KEY` (EMAIL); `GROK_API_KEY`, `XAI_API_KEY` (EXTERNAL API); `NEXT_PUBLIC_SITE_URL` (PUBLIC CLIENT).
- Contractor: `ATH_HANDOFF_SECRET` (MACHINE); `DATABASE_URL`, `POSTGRES_URL`, `SUPABASE_SERVICE_ROLE_KEY` (SERVER PRIVILEGED); `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, site/corrections variables (PUBLIC CLIENT); `RESEND_API_KEY`, lead/quote webhook settings (EMAIL/EXTERNAL).
- Move: `ADMIN_SECRET`, trusted submitter variables (HUMAN LEGACY); `CRON_SECRET`, `REVALIDATE_SECRET`, `ATH_HANDOFF_SECRET` (MACHINE); database URLs, multiple `*_SUPABASE_SERVICE_ROLE_KEY`, DB passwords/access token (SERVER PRIVILEGED); FMCSA/BBB/Google/GSC keys (EXTERNAL); Resend/Brevo/RingCentral variables (EMAIL/SMS); `NEXT_PUBLIC_*` (PUBLIC CLIENT).
- Lender: `ADMIN_SECRET` (HUMAN LEGACY); `ATH_HANDOFF_SECRET` (MACHINE); `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (SERVER PRIVILEGED); `FRED_API_KEY` (EXTERNAL); `NEXT_PUBLIC_*` (PUBLIC CLIENT).
- Senior: `ATH_HANDOFF_SECRET` (MACHINE); `CARE_DATABASE_URL`/pooler/SSL material (SERVER PRIVILEGED); `GOOGLE_PLACES_API_KEY` (EXTERNAL); feature/origin variables (UNKNOWN operational).
- Insurance: `ADMIN_SECRET` (HUMAN LEGACY); `ATH_HANDOFF_SECRET` (MACHINE); database URLs/password/service-role (SERVER PRIVILEGED); Marketplace, Google, ImproveMX and Vercel tokens (EXTERNAL/SERVER); Resend/mail settings (EMAIL); `NEXT_PUBLIC_*` (PUBLIC CLIENT).
- Investor: `ATH_HANDOFF_SECRET` (MACHINE); `DATABASE_URL` (SERVER PRIVILEGED); public/indexing/build flags (UNKNOWN operational).

ADMIN-002 should rotate human legacy admin secrets and any broadly shared machine/service-role secrets as part of migration to named staff identity, scoped roles and audited access—not during this audit. Rotation order must avoid breaking crons/handoffs. Static review found no intentional client import of service-role modules; the focused gate locks that boundary.

## Conflicts and gaps

- There is no single network staff identity/RBAC/audit-command layer; Ask staff allowlists/operator secrets and specialist `ADMIN_SECRET` surfaces coexist.
- Consumer Projects/Saves/Watches are not one unified cross-hub contract. “Watch” coverage and false-silence blast radius therefore require discovery in ADMIN-006.
- Specialist publication and source clocks are mature but heterogeneous; accepted-at and quarantine are not uniformly exposed.
- Claim eligibility is not a single network policy. Contractor is the most explicit end-to-end publication implementation; other profile-class/jurisdiction cells remain unproven.
- Legacy Move and Insurance operations are materially richer than Ask admin. Consolidation must be adapter-led and is deferred to ADMIN-008.
- Production deployment SHAs and Supabase refs are not reliably represented in source across all repos; future inventory should obtain them through authenticated platform APIs without exposing credentials.
