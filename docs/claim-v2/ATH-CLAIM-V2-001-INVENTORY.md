# ATH-CLAIM-V2-001 — Claim System Inventory (pre-implementation read)

Ticket: ATH-CLAIM-V2-001 (Claim Biz V2 — Phase 1). Builder 2. Read-only survey of the claim system across
AskTrustHub, ContractorTrustHub and the five other specialist Hubs (Move, Lender, Senior=care-trust-hub,
Insurance, Investor). Starting SHAs: Ask `06a4c614db32348869a5d9c5bd255e2b54aa97a9`, Contractor
`b947a8e2ba3258784d194f1930df8e3a7119cbc3`.

## 1. Existing shared behavior (Ask-owned, all Hubs)

| Concern | Where | Behavior at starting main |
| --- | --- | --- |
| Signed handoff wire contract | `lib/customer/handoff.ts`, `lib/customer/types.ts` | `body.sig`; body = base64url JSON `HandoffPayload` (`v: 1|2`, `aud: 'asktrusthub'`, `hub_id`, `native_profile_id`, `slug`, `external_key`, `source_system`, `home_state`, optional `identifier_namespace` / `entity_class` / `provider_class` / `canonical_profile_url` / `display_name`, `iat`, `exp`, `nonce`); sig = HMAC-SHA256(`ATH_HANDOFF_SECRET`, body). TTL 15 min (`HANDOFF_TTL_SECONDS`). Nonce = 24 random bytes. Unknown extra fields are ignored by the parser. **The contract already carries `v: 2` for Contractor and every other Hub; the "V2" program name does not require a wire bump.** |
| Handoff receipt | `app/api/customer/claim/accept/route.ts` → `CustomerPlatform.acceptHandoff()` (`lib/customer/store.ts`) | `GET /api/customer/claim/accept?handoff=…` (reached by `/claim/continue?handoff=…` redirect). Rate-limits `handoff_ip` 30/15 min (durable, `ath_rate_events`), authenticates signature/audience/expiry, rejects a nonce already present in `ath_claim_intents`, revalidates the exact profile through the directory, **then immediately INSERTs `ath_claim_intents`**, writes audit `handoff_accepted`, sets the 15-minute httpOnly `ath_claim_intent` cookie, and redirects to `/claim/continue`. This is the root cause of Section 4: a passive page load by a crawler is recorded as a durable intent. |
| Continue page | `app/claim/continue/page.tsx`, `claim-continue-form.tsx` | Reads the intent cookie, loads `intentPreview()`, renders identity + what-claiming-means copy + either the magic-link form (unauthenticated) or the submit form (authenticated). Fires client analytics `claim_handoff_received`, `claim_auth_required` / `claim_auth_returned`. No explicit "Continue" step exists today. |
| Auth | `requestMagicLink` / `consumeMagicLink` / `sessionUser`; `app/api/customer/auth/*` | Email magic link (30 min), session cookie 30 days. `next` path preserved (`/claim/continue`). Durable rate limits `auth_link_email` 5/15m, `auth_link_ip` 20/15m. |
| Submission | `submitClaim()`; `POST /api/customer/claim/submit` | Requires confirmed session, unconsumed intent (from cookie), exact credential attestation, `authorized` checkbox. Upserts `ath_hub_profiles`, creates org+membership (or attaches an owned org), inserts `ath_claims` (`submitted`, or `in_review` when an active grant exists → competing), consumes the intent, inserts `ath_review_queue`, audits `claim_created`, sends `CLAIM_STARTED` lifecycle email. Rate limit `claim_submit_user` 8/h. Same claimant+profile returns the existing claim (idempotent). |
| Authority governance | `lib/customer/claim-governance.ts` (`evaluateAuthority`), `lib/control-plane/claim-policy.ts` | Two corroborating signals minimum; independent authority + control/contact; conflicts fail closed; competing claims / active grant → CONFLICT/HOLD; company-domain email is SUPPORTING only; credential knowledge is WEAK; free email is step-up not rejection; `automatic_approval` is schema-constrained to `false`. |
| Staff decision | `staffDecide()` (platform) wrapped by `ClaimOperationsService.decide()` (control plane) | approve / reject / needs_info with evidence codes, evidence note, internal rationale, claimant message, reason category; idempotency key + advisory lock; policy evaluation persisted (`ath_claim_policy_evaluations`); ops case state machine (`ath_ops_cases`, migration 014) with a 72-hour internal target. |
| Grant | `ath_management_grants` (one active per hub profile), `revokeGrant()` | Approval activates membership + grant; revocation stops monitoring, emails ACCESS_REMOVED, invalidates the public read cache. |
| Business-supplied publication | `publicBusinessProfile()`, `publicBusinessReplies()`, `lib/customer/public-profile.ts`, `public-replies.ts`, `public-read-layer.ts` | Only projected while an ACTIVE grant + active org + active owner/manager/staff membership exists. Revocation therefore withdraws the business layer automatically. Public field allowlist enforced. |
| Corrections | `createRecordIssue()` etc., public `/corrections` | Available with or without a claim; never mutates evidence (`RESOLVED_CORRECTED` creates a remediation task). |
| Staff surfaces | `/admin/operations/claims` (control plane). `/internal/review` and `/internal/launch-ops` are permanent redirects to `/admin/operations/claims` and `/admin`. | Queue shows age band (<24h/24-48h/48-72h/>72h), hub/class, identity, status, policy, conflicts, reviewer, next action. Default filter `pending`. Aging text: "72-hour internal operating target". No acquisition source column, no SLA state, no review timing. |
| Launch ops snapshot | `launchOpsSnapshot()` + `lib/customer/launch-ops.ts` | Already defines `ACQUISITION_SOURCES = organic/manual_outreach/email_campaign/internal_test/unknown` and reads `attestation->>'acquisition_source'` — but nothing writes that key today, so every claim reports `unknown`. `median_review_hours` is wall-clock submission→decision, not human handling time. |
| Attribution | `ath_claim_attribution` (migration 015), `attributeClaim()` | Only written for email-campaign tokens (`EMAIL_CAMPAIGN`). Upper-case enum `ORGANIC/MANUAL_OUTREACH/EMAIL_CAMPAIGN/INTERNAL_TEST/UNKNOWN`. |
| First-party telemetry | `ath_product_events` (migration 012), `lib/control-plane/product-events.ts`, `/api/product-events` | Allow-listed browser events (`claim_cta_clicked`, `claim_handoff_received`, `claim_auth_required`, `claim_auth_returned`, `claim_validation_*`, `claim_started`, `claim_completed`, …) with bounded dimensions; prohibited fields rejected. Persisted server-side. |
| Browser analytics | `components/customer/ClaimFunnelAnalytics.tsx`, `lib/customer/claim-launch.ts` (`safeClaimFunnelProperties`), `lib/analytics/privacy.ts` | Vercel Analytics + PostHog. Key-name blocklist strips name/email/identifier/credential/profile_id/token/handoff/payload; URL sanitizer strips `handoff`, `auth_error`, tokens. |
| Recovery | `lib/customer/claim-recovery.ts`, `auth-error-code.ts` | Bounded enum on `/claim/continue?auth_error=`; every code has primary/alternative/support actions. |
| Durable rate limiting | `ath_rate_events` + `CustomerPlatform.hitRateLimit(bucket,key,max,windowMs)` | Ask has a real, durable, Postgres-backed limiter. Buckets today: handoff_ip, auth_link_*, claim_submit_user, review_staff, record_issue_*, business_reply_*, organization_invite_*. |
| Test convention | `lib/customer/*.test.ts` with `@electric-sql/pglite`, `applyCustomerMigrations`, `enableAppRole`, `node --experimental-strip-types --test` | All mutation tests run on an in-memory Postgres; no production connection. |
| Internal mint tool | `app/api/internal/handoff/mint` + `/internal/handoff` | Staff/operator-only mint of a handoff for any Hub (used for proofs). Not a public surface. |

## 2. Contractor-specific behavior (ContractorTrustHub)

| Concern | Where | Behavior at starting main |
| --- | --- | --- |
| Eligibility | `lib/claim/eligibility.ts`, `lib/claim/server.ts#loadEligibleClaimProfile` | Exact UUID; `is_thin_profile = FALSE`; slug present; one `fl_dbpr` licence with non-empty `external_key`; `home_state='FL'` or licence `state='FL'`. |
| Rollout gate | `claimCtaEnabledFor()` reading `ATH_CLAIM_CTA_MODE` (`off` / `canary` + `ATH_CLAIM_CANARY_PROFILE_IDS` / `all`) and requiring `ATH_HANDOFF_SECRET` ≥ 32 chars | Env-driven. **Not changed by this ticket.** |
| Mint route | `app/api/claim/handoff/[profileId]/route.ts` | **`GET` mints** a fresh v2 signed token and 302s to `https://www.asktrusthub.com/claim/continue?handoff=…` with `no-store` + `noindex`. No same-origin check, no rate limit, no human-intent requirement. Logs `claim_handoff_minted` and a `claim_cta_clicked` line with `acquisition_source: "organic"` hard-coded. |
| CTA | `components/contractor/ManageProfileCta.tsx` | Plain `<a href="/api/claim/handoff/{id}">` (crawlable). gtag/dataLayer events `manage_profile_cta_view` / `manage_profile_cta_click`. When a business profile is published the CTA becomes a link to `asktrusthub.com/manage` and the label reads "Profile managed by an authorized representative". |
| Profile page wiring | `app/contractors/[slug]/page.tsx` L198-206, L615 | `showClaimCta = customerRolloutEnabled`; publication (`getPublicContractorState`) is decoupled from the CTA flag (pinned by `test_ath_claim_publish_001.tsx`). |
| Publication + response | `components/contractor/BusinessSuppliedProfile.tsx`, `BusinessResponses`, `lib/business-profile/*`, `lib/business-replies/*` | Fetched from Ask public read endpoints, parsed against strict contracts (exact UUID, allowlist, no private keys), rendered with "Profile managed by an authorized representative" / "Information supplied by the business"; JSON-LD stays source-derived. Ask outage → `null` → Trust Report unaffected. |
| Analytics / privacy | gtag/dataLayer only; no PostHog in Contractor | Payload is hub/profile_class/state/source_system only. |
| Rate limiting | none | No limiter library, no KV/Redis, no rate table. `lib/db.ts` is the DBPR evidence Postgres (Supabase session pooler, statement timeout 8 s). |
| Robots | `app/robots.ts` | `/api/` disallowed for crawlers that honour robots; route also sends `X-Robots-Tag: noindex, nofollow`. Does not stop non-compliant crawlers or link prefetchers. |
| Tests | `scripts/test_ath_cust_003.ts` (eligibility + token compatibility with Ask verifier), `test_ath_cust_005.tsx`, `test_ath_cust_007.tsx`, `test_ath_claim_publish_001.tsx`; `npx tsx --test` | No test covers the route handler itself. |
| Known pre-existing failure | `npm run check:con-search-001` | Coordinator reports one stale UI-copy assertion in HomeDiscoverySearch on clean main; to be A/B proven in Section 14. |

## 3. Behavior in the five other Hubs (read-only inspection via `gh api`)

| Hub | Mint route | Method | Identity in payload | Notes |
| --- | --- | --- | --- | --- |
| Move (`Move-trust-Hub`) | `app/api/claim/handoff/[profileId]/route.ts` | **GET** → 302 | USDOT, mover, `canonical_profile_url` | CTA (`components/portal/claim-cta.tsx`) links to an in-hub `/portal/claim/[companySlug]` page first (human page before mint). Has generic rate-limit helpers (`lib/reviews/rate-limit.ts`, `lib/save-my-move/magic-link-rate-limit.ts`) but none on the claim route. |
| Lender (`Lender-Trust-Hub`) | `app/api/claim/handoff/[profileId]/route.ts` | **GET** → 302 | NMLS institution only (branch/MLO excluded) | No rate limiting. |
| Senior (`care-trust-hub`) | `apps/web/src/app/api/claim/handoff/[providerClass]/[ccn]/route.ts` | **GET** → 302 | CMS CCN + provider class; Ask re-validates via `/api/customer-profile-validation/v1` (locked fingerprints) | No rate limiting. |
| Insurance (`Insurance-trust-hub`) | `app/api/claim/handoff/[slug]/route.ts` | **GET** → 302 | NAIC legal insurer; local validation contract v1 before mint; recovery page `/claim-insurer/unavailable` | No rate limiting. Ask re-validates via `/api/customer-claim-validation/v1`. |
| Investor (`investor-trust-hub`) | `apps/web/src/app/api/claim/handoff/[slug]/route.ts` | **GET** → 302 | CRD firm only | No rate limiting. Ask re-validates via `/api/customer-claim-validation/v1`. |

All five share the same defect as Contractor: a crawlable GET mints a signed artifact. All five are consumed by
the same Ask `acceptHandoff()` path, so the Ask-side Section 4 change (passive receipt vs explicit
Continue) protects every Hub immediately; the specialist-side Section 3 change (POST start + abuse gate) is
implemented for Contractor only in this ticket and becomes a portable requirement (readiness item 7).

## 4. Portable behavior (safe to make the shared contract)

- Signed handoff parse/verify/replay/expiry logic and the `HandoffPayload` shape (unchanged).
- Exact-profile revalidation through `CustomerProfileDirectory.getExact` (per-Hub adapters already exist).
- Intent creation, auth return, submission, review queue, governance, grant, revocation, publication gating.
- The new Ask "receipt → explicit Continue → durable intent" boundary (works for any Hub because it sits after
  signature verification and before `ath_claim_intents`).
- Acquisition-source attribution (Ask-side, out-of-band of the signed token).
- Readiness certification model (`lib/customer/claim-v2-readiness.ts`, new).

## 5. Known Hub-specific differences (do not manufacture symmetry)

- Contractor is FLORIDA-FIRST (`fl_dbpr`, `home_state='FL'`); other Hubs are national public-profile.
- Contractor identity is a licence credential; Ask can read the Contractor evidence DB directly
  (`CTH_READ_DATABASE_URL`, read-only SQL assertion). Other Hubs are validated over HTTPS contracts.
- Contractor is the only Hub with monitoring `SUPPORTED`.
- Senior carries `provider_class`; Lender excludes branch/MLO; Insurance excludes producers; Investor excludes
  representatives. Move's CTA already goes through a human-facing portal page before mint.
- Only Ask has a durable limiter (`ath_rate_events`). Contractor (and Lender/Senior/Insurance/Investor) have no
  durable per-IP store; Move has ad-hoc helpers for other features.

## 6. Current production rollout assumptions

- Contractor `ATH_CLAIM_CTA_MODE` is an env var (mode `off`/`canary`/`all`); Ask does not gate intake per Hub
  beyond adapter validation. This ticket does not read or change production env vars.
- Prior audit: 5 Contractor claims (3 approved historical proof claims with all grants deliberately revoked; 2
  submitted still open), 0 active grants, 0 responses, 0 monitoring subscriptions, 5,997 intents (4 consumed).
  Section 2 recomputes from the live DB (read-only).
- Adverse/discipline publication state is untouched (Section 11).

## 7. Things that would make the proposed V2 design unsafe (and how the design avoids them)

1. **Bumping the wire contract.** Not needed: the passive-receipt/explicit-Continue split lives entirely on the
   Ask side after signature verification. Acquisition source travels out-of-band (allow-listed query string,
   never inside the signed body). No `v: 3`.
2. **Treating an in-memory limiter as durable.** Contractor has no durable store. The Contractor gate is shipped
   as an explicitly bounded, per-isolate, fail-closed-on-error limiter with a pluggable store interface, and the
   durable network backstop is Ask's `ath_rate_events` on receipt/confirm. A proposed (unapplied) Contractor
   migration and the Vercel-WAF alternative are documented for Founder decision (Section 3E).
3. **Breaking existing deep links / auth return.** `/claim/continue?handoff=` and `/api/customer/claim/accept`
   keep working; the intent cookie flow after Continue is byte-identical to today, so magic-link `next=`
   returns still land on the same intent.
4. **Refresh / double-click creating multiple intents.** `ath_claim_intents.nonce` is UNIQUE; Continue is
   implemented as insert-or-return-existing, so the boundary is idempotent by construction.
5. **Existing tests that call `acceptHandoff()` expecting an intent.** `acceptHandoff` is preserved as the
   composition `receiveHandoff` + `confirmClaimIntent` so no existing gate is weakened; the routes use the split.
6. **Existing historical intents.** No migration touches `ath_claim_intents` rows; new columns are additive with
   defaults; the 5,997 rows remain as they are.
7. **Automatic approval.** Untouched; `ath_claim_policy_evaluations.automatic_approval` remains CHECK false.
8. **Analytics leakage.** New events reuse `safeClaimFunnelProperties` and the product-event allow-list; no new
   identifier-bearing property is introduced.
