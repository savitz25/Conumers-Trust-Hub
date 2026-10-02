# ATH-CLAIM-V2-001R4 — Final Reconciliation + First-Owner Readiness

Owner: C-B1 (Claude Opus 5.5). Date: 2026-09-24. Scope: Ask PR #199 + Contractor PR #92, both kept DRAFT.
No merge, no Production migration, no Production flag or cron change, no customer contact, no claim touched.

## 1. Source control

| Repo | origin/main | V2 branch head before R4 | Action |
| --- | --- | --- | --- |
| Ask `savitz25/Conumers-Trust-Hub` | `fd21da1b` | `be7fd202` (0 behind main) | No rewrite; R4 commits on top |
| Contractor `savitz25/contractor-trust-hub` | `9b6ee8e4` (GA-CON-001 #93) | `670aff50` (1 behind main) | `git merge origin/main` (no rewrite, no force-push); zero file overlap with #93 |

After the merge the Contractor diff vs main is exactly the 9 V2 files plus the R4 files below. Georgia (#93),
name parity (#91), post-R1 search/performance and state-rollout files are byte-identical to main (see the
regression matrix in the PR body).

## 2. P0 — first-approval publication latency

### Root cause (four stacked 6-hour caches + one silent no-op)

A first approval / first owner save could stay invisible for hours because the Contractor public page read
the Ask business layer through **four** caches, each holding "no business layer" for ~6h, and the invalidation
that was meant to clear them usually reached none:

1. **Invalidator registered only in reader bundles.** `invalidatePublicContractorRead()` dispatches to
   listeners, and the only listener (with the `revalidateTag` calls) was registered as a side effect of
   importing `public-read-server.ts` — which only the three public GET routes import. The writer routes
   (admin approve, owner save, reply moderation, revoke) never import it, so in the instance that performed the
   write the listener set was empty: **the shared cache was never expired.**
2. **`revalidateTag(tag, 'max')`.** Even when it did run, Next 16's `'max'` profile is stale-while-revalidate
   with a one-year window: the next read is *served the pre-write value* while revalidating
   (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md`).
3. **Per-ID negative memo.** The in-process layer stored the "none" answer per ID for 6h and checked it
   *before* the existence set, so a warm instance kept answering "none" regardless of any refresh; and a write
   on one instance cannot clear another instance's memory.
4. **Edge + consumer caches.** Ask public responses carried `s-maxage=21600, stale-while-revalidate=86400`,
   and Contractor fetched them with `next: { revalidate: 21600 }`.

The previous claim that revocation was "already immediate" held only on the writer instance: warm readers
(positive payload memo), the Ask CDN and the Contractor data cache delayed revocation by the same mechanism.
It was fail-safe on first approval (under-disclosure) but not on revocation (a revoked layer could linger).

### Fix

| Layer | Before | After |
| --- | --- | --- |
| Invalidator wiring | registered only by public GET routes | registered in `lib/customer/server.ts`, which every writer route loads through `withPlatform` / admin services |
| Timing | fired inside the DB transaction (pre-COMMIT) | deferred until after COMMIT (`withAskTx` → `withDeferredPublicReadInvalidation`); a rolled-back write invalidates nothing |
| Shared data cache (Neon guard) | `unstable_cache` list, 6h, `'max'` | list + **per-ID state** entries, tagged, expired with `{ expire: 0 }`; 3600s backstop only if an invalidation is lost |
| In-process memo | existence 6h, per-ID payload 6h incl. negatives | existence 30s (single-flight), positive payload 30s, **negatives never stored per ID** |
| Write scope | every write flushed everything | **change-kinded**: `granted`/`revoked` patch the writer's existence set incrementally (add/remove one ID) and expire the shared list; `content` (profile save/reconfirm, reply publish/withdraw) expires only that profile's state entry — existence is never flushed by content writes |
| Ask edge | `s-maxage=21600, swr=86400` | `s-maxage=60, stale-while-revalidate=60` |
| Ask outage | profile route 404 **edge-cached 6h**; replies 404 cached | 503 `no-store` on all three routes (fail closed, never cached) |
| Contractor fetch | `revalidate: 21600`, untagged | `revalidate: 60` (`ASK_PUBLIC_REVALIDATE_S`; still a cache, per ATH-NEON-001) + per-profile tag `ask-public-state:<id>` (precisely purgeable by a future trusted path; no public purge route exists by design) |

No client-controlled invalidation: nothing under `app/` imports the invalidator (asserted by test). Unknown-ID
Neon protection is unchanged in kind and improved in memory: **5,000** random UUIDs across two instances →
≤1 shared list load per cold instance, 0 payload loads, 0 per-ID memory entries (test R4-7 / acceptance H).
Negative answers: never cached per ID; the in-process existence set is at most 30 s old and is patched
immediately on the writer; a negative can never be re-cached from a stale list (single-flight generation guard +
post-COMMIT invalidation). Bounded fallback: if an invalidation is lost, the shared list self-heals within
3600 s — kept at 3600 s rather than 60 s deliberately, because a 60 s shared revalidation would issue a Neon
list query every minute per region under crawler traffic (compute-hours pressure; see the Ask Neon quota
incident).

### Measured visibility window (normal owner save → public)

| Hop | Bound |
| --- | --- |
| Ask shared data cache | 0 s (expired post-COMMIT) |
| Ask instance that handled the write | 0 s |
| Any other warm Ask instance | ≤ 30 s (`EXISTENCE_TTL_MS`) |
| Ask edge response age | ≤ 120 s (60 max-age + 60 SWR) |
| **Ask public endpoint, worst case** | **≤ 150 s** (`PUBLIC_VISIBILITY_WORST_CASE_S`) |
| Contractor data cache | + ≤ 60 s |
| **Contractor public page, worst case** | **≤ 210 s (3.5 min)**; typical 0–120 s |

Caveat, stated honestly: Contractor's `revalidate: 60` is stale-while-revalidate, so the *single* render that
finds an expired entry may show the prior state while it refreshes in the background; the next render is fresh.
Revocation now has the same ≤ 210 s bound. If an invalidation is ever lost (e.g. the Next cache API throws),
the mutation still succeeds and the shared backstop recovers within 3600 s + the window above (test R4-8).

### Tests (Ask `lib/customer/ath-claim-v2-001r4.test.ts`, in `check:ath-claim-v2-001` and `check:ath-neon-001`)

Real store on PGlite + a shared tag-expiring cache + two independent instances (writer, warm reader):
1 unknown → none, nothing stored · 2 approval + first save → invalidation fired · 3 writer sees owner layer
immediately; warm reader within 30 s with **zero** extra Neon queries · 4 field update fresh · 5 approved reply
appears · 6 revoke withdraws · 7 1,000 unknown IDs bounded · 8 invalidation failure → mutation OK, backstop
recovery · post-COMMIT deferral + rollback · outage fails closed (503 no-store) · wiring (writer registration,
`{ expire: 0 }`, no `'max'`, no client invalidation, window constants). Contractor:
`scripts/test_ath_claim_v2_001.tsx` "R4" + `scripts/test_ath_neon_001.ts`.

## 3. Migration 019 — final release check

Final files (LF, as committed): up `a82b9e5b58fda527edbafb5592155f6ed38b99821f816319fb6506756d7a5475`,
down `ffdb27dcf729ab2ea3f8c8476bb019b5a689ea95f47dff97ce46c6aaef85f358`. Unchanged by R4.

Verified on a **real, isolated PostgreSQL 16.15** (throwaway cluster on 127.0.0.1, throwaway database created
and dropped by the test; non-localhost URLs refused) and on PGlite, by the same lifecycle in
`lib/customer/ath-claim-v2-001r-migration.test.ts` (`ATH_019_REAL_PG_URL=… node --experimental-strip-types
--test lib/customer/ath-claim-v2-001r-migration.test.ts`):

pre-019 fixture (legacy intent **and legacy submitted claim**) → V2 code fails closed (`schema_not_ready`, no
partial write) → apply 019 **twice** → legacy intent = `legacy_passive`/`unknown`, legacy claim =
`acquisition_source='unknown'`, all review timestamps NULL, `human_review_active_seconds=0`,
`needs_info_paused_business_hours=0`, both byte-identical in every original column; 0 rows with invented
source/origin → CHECK constraints enforced → full V2 flow (Continue → auth → submit → review timer → governed
approval → active grant → revoke) → one-open-session unique index blocks a second open session for the same
and for a different reviewer → down → V2 columns and table gone, legacy + V2-era rows survive, legacy rows
byte-identical → re-apply → exactly one one-open-session index → second V2 flow → legacy still byte-identical.

No runtime path applies migrations in Production (the only runtime caller is a fixture route that runs only on
an empty schema behind a fixture-environment assertion). Applying 019 is a manual Founder step.

### Narrow Production apply path (C-B2 #6)

Do not use the broad `applyCustomerMigrations` replay for Production. Use `scripts/claim-v2-019-apply.ts`
(single file, one transaction, `SET LOCAL lock_timeout='3s'` + `statement_timeout='60s'`, file hash pinned to
`a82b9e5b…`, schema verified before COMMIT):

1. `ATH_019_TARGET_URL=… node --experimental-strip-types scripts/claim-v2-019-apply.ts verify` → expect exit 3 (absent).
2. `… rehearse` → applies, verifies, **ROLLBACK** (no change; proves locks are obtainable within 3 s).
3. `… apply --confirm=APPLY-019-a82b9e5b58fd` → applies, verifies, COMMIT.
4. `… verify` → exit 0 (`intentColumns 4, claimColumns 7, reviewSessions, oneOpenIndex, checks 5, rlsForced`).

Exercised on the isolated PG 16.15 (verify absent → rehearse leaves absent → apply refused without confirm →
apply commits → verify complete → re-apply idempotent) and in the permanent suite (R4 Section 6, PGlite).

**MIGRATION_019 = READY_FOR_FOUNDER_APPLY. MIGRATION_019_APPLY_PATH = READY.**

## 4. Contractor abuse gate

Unchanged truth: `MemoryRateLimitStore` is per-isolate and non-durable. No code-side change can make it
fleet-wide without a store, and a per-profile global cap would let an attacker lock the canary owner out, so
none was added. What makes ONE canary safe today: in `canary` mode only the single allow-listed profile can
mint at all (`claimCtaEnabledFor`, checked before the DB), a minted token creates nothing on Ask, and Ask's
durable limiters (`ath_rate_events`: receipt 30/15 min, Continue 10/15 min per keyed IP) front every durable
write.

Durable backstop = **one Vercel Firewall custom rule** (Vercel-native, no vendor, no schema, no credentials).
Founder applies it in the Contractor project (Firewall → Configure → New rule); this ticket changed no
Production configuration.

| Field | Value |
| --- | --- |
| Name | `claim-start-canary-backstop` |
| If | Request Path **starts with** `/api/claim/handoff/` **AND** Method **equals** `POST` |
| Then | **Rate Limit** — Fixed window, **600 s**, **6 requests**, key **IP address** |
| On limit | **Deny** (429) for the remainder of the window |
| Exceptions | None needed: no server-to-server or monitoring POSTs hit this route; GET is already a cheap 405 |
| Expected false positives | A single IP starting >6 claims in 10 min. For one consenting owner (1–2 presses) ≈ 0 |
| Rollout | Publish in **Log** mode first; confirm 0 matches from normal traffic for ~1 h; switch action to Rate Limit |
| Rollback | Disable or delete the rule in the dashboard — no deploy; takes effect immediately |

(If the plan's rate-limit window options differ, keep the ratio ~6 per 10 min; the local gate stays 5/15 min
per IP, 3/15 min per IP+profile, 20/60 min per IP.)

- **CANARY_ABUSE_GATE = CONDITIONAL** → becomes sufficient for ONE canary once the rule above is live.
- **ALL_ABUSE_GATE = BLOCKED** (unchanged; needs the WAF rule made mandatory **and** a Founder decision on a
  durable Contractor-side or Ask-preflight gate for unrestricted traffic).

## 5. Claim review reminder cron

Route `GET /api/cron/claim-review-reminders` — **still dormant** (no `vercel.json` entry; unchanged).

| Check | Result |
| --- | --- |
| Auth | `CRON_SECRET` bearer, ≥32 chars, timing-safe compare; else 401 |
| Recipients | Staff only (`ATH_STAFF_EMAILS` ∪ `ATH_STAFF_EMAILS_EXTRA`); no claimant address is ever read |
| Idempotency | Deterministic notification id = hash(claim, UTC day); `ON CONFLICT DO NOTHING` → max 1 per claim per day |
| needs_info | Open pause → never `OVER_TARGET` → never reminded |
| PII | Email: hub, status, admin link. No names, emails, evidence, notes |
| Storm | ≤ 20 claims per run × staff list; daily idempotency caps repeats |
| internal_test | **Excluded** (R4) — synthetic QA claims never page staff |
| Cap fairness | **Fixed** (R4): already-reminded-today claims are dropped *before* the per-run cap |
| No destination | Returns before any write when the staff list is empty |
| Pre-019 | `assertClaimV2Schema` throws → 500, no writes |

Target semantics (code and docs agree): **time-to-decision** — from submission to the final staff decision
(approve/reject), excluding every needs_info pause while the claimant is responsible. First staff action is
recorded separately (`review_started_at`, evidence-ready flag) but is not the target.

Activation rule: keep UNSCHEDULED until the two historical open Contractor claims are dispositioned
(FOUNDER_ACTION_REQUIRED).

Founder note: when scheduled, the first run **will email staff** (only) about the two historical submitted
Contractor claims (they are past the target) and write a notification + audit row referencing them. It does
not change their state and does not email the claimants. Schedule only after C-B2's audit of those claims.

Recommended schedule (Founder approval): `15 14 * * 1-5` — weekdays 14:15 UTC (10:15 ET in summer), once a day.

## 6. Claim state machine (unchanged by R4)

Passive receipt (cookie only, 0 rows) → **Continue** → intent `explicit_continue` (1 row, nonce-unique,
receipt-bound) → auth (magic link; expired auth-return fails closed) → **submitted** → review session
(one open per claim) → **needs_info** (target clock paused) ⇄ **in_review** → **approved** (governed evidence;
ACTIVE grant; public layer within the window above) | **rejected** | withdrawn | superseded. Grant **revoked** →
owner tools 403, public layer withdrawn within the window, business rows retained.

## 7. Review governance (unchanged; re-verified by `check:ath-claim-governance-001` + V2 O/P/Q)

Human authority review mandatory; no auto-approval path exists. Company-domain email alone, credential
knowledge alone, and both together are insufficient; ≥2 corroborating signals with independent authority and
control/contact evidence required; conflicts and competing claims block; free email → enhanced review; every
decision is a staff action with rationale and audit.

## 8. Historical claims

Read-only. R4 code touches no claim row and adds no automatic mail. The only path that could email about them
is the dormant reminder cron (staff-only), which stays unscheduled.

## 9. Contractor IPv6 rate limiting (C-B2 P1-2)

Bug: `MemoryRateLimitStore` parsed `ip-profile:<ip>:<uuid>` at the FIRST colon, so every IPv6 client sharing a
first hextet shared one 64-slot profile map (65th client → 429 for up to 24 h).

Fix: a **structured key API** — `hit({ kind: 'agg'|'hourly'|'profile', bucket, profileId? })`; the route never
builds or parses a string. Legacy string keys still parse, now from the fixed UUID suffix (regex anchored on the
UUID), rejecting anything else. **Normalisation policy** (`abuseBucket`): IPv4 = full address; IPv4-mapped IPv6 =
its IPv4; other IPv6 = the **/64** prefix, because a subscriber/device is normally delegated a whole /64 (RFC 6177;
per-device /64 on mobile) and rotating inside it is free — per-address buckets were bypassable. Trade-off (same
as IPv4 NAT): unrelated users behind one shared /64 share a bucket.

Tests: IPv4; `::1`; full vs compressed forms of one address → same bucket; mapped IPv4; embedded-IPv4 tail;
5 addresses in one /64 exhaust one bound together, a 6th address in that /64 → 429, a neighbouring /64 → allowed;
spoofed rotating `x-forwarded-for` with a stable `x-vercel-forwarded-for` stays one bucket; 65+ distinct profile
ids fail closed without resetting the aggregate; 20,000 adversarial requests rotating addresses and profiles
inside one /64 → ≤ 5 mints; existing 20,000-request churn test still passes. **IPV6_RATE_LIMIT = PASS.**

## 10. Synthetic paired E2E (local, isolated) — 2026-09-24

Stack: Contractor `next start` :3921 (canary mode, allow-list = one public FL profile, synthetic handoff secret,
evidence DB read-only) + Ask `next start` :3910 on the isolated PG 16.15 (`ask_r4_e2e`, all migrations incl.
019) with a synthetic CTH read DB holding only that profile's public identity. No `.env.local`, no Resend key
(mail = preview only). Contractor's production-mode Ask origin is fixed to www.asktrusthub.com, so the CTA POST
was issued with the same Origin via curl and the minted token handed to local Ask (the 303 was never followed to
Production).

| Step | Result |
| --- | --- |
| Contractor public profile | Official DBPR evidence only; CTA = same-origin POST form, 0 crawlable mint links |
| POST mint | 303, `no-store`, exactly one 15-min token, signed `acquisition_source: organic` |
| Ask receipt (+ refresh) | Exact identity shown, token stripped from URL; **0 durable intents** |
| Continue | **Exactly 1** intent, `explicit_continue` / `organic` |
| Auth | Email step shown; magic link (preview) signs in and returns to the claim |
| Submit | `submitted`, organic, not free-email, no competing claim |
| Review queue | Row present, within 2-business-day target, AMBER, Start review |
| Governance | Company-domain + licence knowledge → `policy_blocks_approval`, no grant; wrong decision category → `invalid_decision_category` |
| Approve | Officer match + public callback + domain control → approved, ACTIVE grant, timer closed (80 s), evidence-ready = true, audit `claim_approved`/`grant_created`/`membership_activated` |
| First save (website + Mon–Fri hours) | Ask `public-state`: owner layer **immediately** (`neon_load`, not a cached `existence_miss`) |
| Contractor page | Owner layer visible at **+40 s** (first poll at ~+35 s was the one expected SWR render); labels "Profile managed by an authorized representative" / "Information supplied by the business" / "Availability provided by the business"; official evidence above it and unchanged; JSON-LD unchanged; no endorsement wording |
| Synthetic revoke | Grant `revoked`; Ask withdrew immediately; Contractor page withdrawn within ~35 s; business rows retained |
| Owner after revoke | My Trust Hub shows 0 managed profiles; `/manage/<id>` → 404 |

Measured windows on this stack: publish ≤ 40 s, withdraw ≤ ~35 s (bound: 210 s).

**Re-run at the final combined heads** (Ask `d06039b`, Contractor `4fb78d2`, fresh builds, fresh DB): GET 405 /
POST 303 from an IPv6 client; receipt → 0 intents; Continue → 1 intent (`explicit_continue`/`organic`,
**60-min lifetime from Continue**); magic-link sign-in; submit; staff timer + governed approve → ACTIVE grant
(no schema banner, 019 present); owner saves website + Mon–Fri hours → Ask `public-state` true immediately,
Contractor page **+62 s** (its cached entry had just been refreshed by earlier polls, so the full 60 s window
applied); synthetic revoke → Ask false immediately, Contractor page withdrawn **+45 s**. Admin queue and claim
review re-checked at 1440/390/320: no overflow.

**CACHE_FIRST_PUBLICATION_WINDOW = ≤ 210 s worst case (measured 40–62 s). CACHE_REVOCATION_WINDOW = ≤ 210 s
worst case (measured 35–45 s).**

Browser QA (1440 / 390 / 320): Contractor profile, Ask claim landing / invalid-link state, claim status,
admin queue, claim review, My Trust Hub, revoked manage route — **no page-level horizontal overflow** at any
width; CTA 262×44 (1440/390) and 198×44 (320). Back/refresh create no new state. Notes: (a) the automation tab
was `visibilityState: hidden`, so React's rAF-batched Suspense reveals had to be applied manually for layout
measurement (not a product defect; the swap scripts are in the server HTML) and live key presses were unreliable
— keyboard access verified structurally (native buttons in forms, focusable, not disabled); (b) pre-existing,
outside V2: the Contractor "Print" toolbar button extends to 352 px at 320 px (clipped, no page scroll); (c)
pre-existing, outside V2: after a revocation `/claim/status/<id>` still reads "You can manage this profile"
because revocation does not change `claim.status`.


## 11. C-B2 audit punch list — disposition (folded into R4)

| # | Finding | Disposition | Evidence |
| --- | --- | --- | --- |
| P1-1 | Cache chain can hide first publication / delay revocation for hours | **Fixed** (§2): writer-registered, post-COMMIT, `{expire:0}`, change-kinded incremental existence, no per-ID negatives, 60 s edge + 60 s Contractor window, tagged Contractor fetch, 503 no-store outages | `ath-claim-v2-001r4.test.ts` R4 1–8 + wiring; E2E §10 (publish 40 s, withdraw ~35 s) |
| P1-2 | IPv6 rate key | **Fixed** (§9): structured keys + /64 policy | Contractor `test_ath_claim_v2_001.tsx` R4 IPV6_* |
| P2-3 | DB rate-limit before HMAC | **Fixed**: `receiveHandoff`/`confirmClaimIntent` now size-check → secret check → HMAC/expiry → then schema/durable rate accounting | R4 #3: 1,000 forged/malformed tokens → 0 rate rows, 0 intents; legit 30/15 min bound still enforced |
| P2-4 | Empty/short secret verifies | **Fixed**: handoff verify throws `misconfigured` (<32 chars) → user sees "temporarily unavailable"; receipt encode throws / decode returns null | R4 #4 |
| P2-5 | Ask client IP trusts client XFF | **Fixed**: `lib/customer/client-ip.ts` (trusted `x-vercel-forwarded-for`; malformed → `unknown`; on Vercel no XFF fallback; bounded + IPv4/IPv6-validated) used by customer and admin contexts | R4 #5 |
| P2-6 | Broad migration replay for Production | **Fixed** (§3): `scripts/claim-v2-019-apply.ts` verify/rehearse/apply | R4 Section 6 + isolated PG run |
| P2-7 | Admin queue breaks pre-019 | **Fixed**: `claimV2SchemaReady()` probe; queue selects typed literals instead of V2 columns; timer/SLA hidden with a staff banner; decisions and revocation still work (V2 timing/pause writes skipped) | R4 #7 (pre-019 needs_info decision succeeds) |
| P2-8 | Unstable multi-license order | **Fixed**: final `external_key ASC` on both sides; Ask also excludes blank keys like Contractor (a blank key can never match a signed credential, so eligibility is unchanged in effect) | R4 #8 + Contractor server.ts |
| P3-9 | Reminders | internal_test excluded; cap fairness fixed; target = time-to-decision documented; stays unscheduled until the historical claims are dispositioned | R4 #9, existing reminder test |
| P3-10 | manual_outreach attribution | **Implemented**: `/api/internal/handoff/mint` (operator secret or staff session only) accepts `acquisitionSource: manual_outreach \| internal_test`, signed into the token; never from a claimant's browser. Note: the token is still 15 min, so use it in an assisted live session; for the canary the runbook keeps the organic profile CTA | R4 #8/#10 static + mint route |
| P3-11 | Intent lifetime tied to 15-min token | **Fixed**: explicit Continue creates an intent valid 60 min from Continue (`CLAIM_INTENT_CONTINUATION_SECONDS`); intent cookie matches; handoff token stays 15 min and single-use | R4 #11 (Continue at minute 14, submit at minute 40 OK; expires after 60 min) |
