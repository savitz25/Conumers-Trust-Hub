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
| Ask edge | `s-maxage=21600, swr=86400` | `s-maxage=60, stale-while-revalidate=60` |
| Ask outage | profile route 404 **edge-cached 6h**; replies 404 cached | 503 `no-store` on all three routes (fail closed, never cached) |
| Contractor fetch | `revalidate: 21600` | `revalidate: 60` (`ASK_PUBLIC_REVALIDATE_S`; still a cache, per ATH-NEON-001) |

No client-controlled invalidation: nothing under `app/` imports the invalidator (asserted by test). Unknown-ID
Neon protection is unchanged in kind and improved in memory: 1,000 random UUIDs → ≤1 shared list load per
cold instance, 0 payload loads, 0 per-ID memory entries (test R4-7).

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

**MIGRATION_019 = READY_FOR_FOUNDER_APPLY.**

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
| No destination | Returns before any write when the staff list is empty |
| Pre-019 | `assertClaimV2Schema` throws → 500, no writes |

Known, non-blocking limitation: the 20-claim cap is applied before already-reminded claims are filtered, so
with more than 20 over-target claims the 21st+ are not reminded that day. Irrelevant at canary scale.

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

## 9. Contractor IPv6 rate-key fix (C-B2 finding)

`MemoryRateLimitStore` parsed `ip-profile:<ip>:<uuid>` at the FIRST colon, so every IPv6 client sharing a first
hextet (e.g. all `2600:*`) shared one 64-slot profile map; the 65th distinct address got a 429 for up to 24 h —
a real risk for a mobile (IPv6) canary owner. Fixed by splitting at the LAST colon (profile UUIDs never contain
one). Test: 200 distinct `2600:1f18:*` clients on one profile each get their own counter; one client's own bound
still applies; 20,000-request churn test still passes. Normalisation policy unchanged: full address per bucket
(no /64 aggregation in this ticket).

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

Browser QA (1440 / 390 / 320): Contractor profile, Ask claim landing / invalid-link state, claim status,
admin queue, claim review, My Trust Hub, revoked manage route — **no page-level horizontal overflow** at any
width; CTA 262×44 (1440/390) and 198×44 (320). Back/refresh create no new state. Notes: (a) the automation tab
was `visibilityState: hidden`, so React's rAF-batched Suspense reveals had to be applied manually for layout
measurement (not a product defect; the swap scripts are in the server HTML) and live key presses were unreliable
— keyboard access verified structurally (native buttons in forms, focusable, not disabled); (b) pre-existing,
outside V2: the Contractor "Print" toolbar button extends to 352 px at 320 px (clipped, no page scroll); (c)
pre-existing, outside V2: after a revocation `/claim/status/<id>` still reads "You can manage this profile"
because revocation does not change `claim.status`.
