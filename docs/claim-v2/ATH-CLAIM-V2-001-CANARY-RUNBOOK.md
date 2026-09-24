# ATH-CLAIM-V2-001 — Contractor Real-Owner Canary Runbook (Founder-executed)

Purpose: move Contractor `R8_REAL_OWNER_CANARY` to `REAL_OWNER_CANARY_COMPLETE` with ONE legitimate, consenting
Florida contractor. Nothing here is automated. Revised in ATH-CLAIM-V2-001R4 (first-approval latency fixed;
exact abuse backstop; executable checks). Roles: **Founder** (config + checks), **Reviewer** (TRUST_OPS staff),
**Owner** (the consenting business).

## 0. Preconditions — every box must be checked before inviting the owner

| # | Precondition | How to verify |
| --- | --- | --- |
| P1 | Ask PR #199 merged and deployed to Production | Vercel Ask project → Production deployment = merge commit, status Ready |
| P2 | **Migration 019 applied** to the Ask customer DB | `SELECT count(*) FROM information_schema.columns WHERE table_name='ath_claims' AND column_name IN ('acquisition_source','review_started_at','needs_info_entered_at');` → `3`, and `SELECT to_regclass('public.ath_claim_review_sessions');` not null |
| P3 | Ask healthy | `https://www.asktrusthub.com/api/public/contractor-profiles/00000000-0000-4000-8000-000000000000/public-state` → 200 JSON, `hasPublicBusinessProfile:false`, header `cache-control: public, max-age=0, s-maxage=60, stale-while-revalidate=60`. Staff sign-in at `/admin/login` works (Neon quota incident resolved) |
| P4 | Contractor PR #92 merged and deployed | Browser `GET https://www.contractortrusthub.com/api/claim/handoff/<any-uuid>` → 405 JSON "…does not start a claim", never a redirect |
| P5 | **Contractor CANARY abuse backstop present** | Vercel Contractor project → Firewall → rule `claim-start-canary-backstop` (POST `/api/claim/handoff/*`, 6 / 600 s / IP, Deny) is **Active** (not Log) — exact spec in `ATH-CLAIM-V2-001R4-FINAL-RECONCILIATION.md` §4 |
| P6 | Exact canary profile allow-listed | Contractor env `ATH_CLAIM_CTA_MODE=canary`, `ATH_CLAIM_CANARY_PROFILE_IDS=<that one UUID>`; redeployed. The CTA appears on that profile and on **no other** FL profile (spot-check one neighbour) |
| P7 | `ATH_HANDOFF_SECRET` identical in both projects (≥32 chars) | Unchanged since R1; confirm in both env panels |
| P8 | Reviewer ready | Staff user exists with `TRUST_OPS` or `SUPER_ADMIN`; can open `/admin/operations/claims`; has read `docs/claim-governance/reviewer-runbook.md`; blocks ~30 min within 2 business days of submission |
| P9 | Transactional email healthy | Resend dashboard: domain verified, no bounces in 24 h. Founder requests a magic link to their own address and receives it within 2 min |
| P10 | Consent | Owner consented in writing; knows claiming is free, is not an endorsement, changes no official evidence, and that they will enter website + hours |
| P11 | Historical claims untouched | The two historical submitted Contractor claims are not acted on as part of this canary (C-B2 owns their audit) |

Do not proceed on any unchecked box.

## 1. Public profile → explicit start (Owner)

1. Owner opens `https://www.contractortrusthub.com/contractors/<slug>`.
2. **Check:** only official DBPR evidence; no "Profile managed by an authorized representative" section yet;
   CTA button reads **"Claim or manage this profile — free"** with the free / not-an-endorsement note.
3. Owner presses the button (a same-origin POST; no link is ever minted by merely viewing the page).
4. **Expected:** lands on `https://www.asktrusthub.com/claim/continue` showing the exact business name,
   credential, "Recorded state: FL", what claiming means, and **Continue**.
5. **Founder check (receipt ≠ intent):** `SELECT count(*) FROM ath_claim_intents WHERE intent_origin='explicit_continue' AND created_at > now() - interval '10 minutes';` → `0`.

## 2. Continue → authentication → submission (Owner)

1. Owner presses **Continue**. **Founder check:** the query above → `1`; row has `acquisition_source='organic'`.
2. Owner enters a work email, opens the magic link (same browser), returns to the claim, selects relationship
   (owner / officer / qualifying agent …), confirms the credential, ticks authorization, submits.
3. **Expected:** `/claim/status/<id>` shows **Submitted**. The claim is at the top of `/admin/operations/claims`
   (pending), Source = organic, target = "Within the 2-business-day review target".

## 3. Review with authority evidence (Reviewer)

1. Open the claim; answer "Evidence ready at first review?"; press **Start review timer**.
2. Verify authority **independently**: Sunbiz officer/authorized person or DBPR qualifier match, plus
   control/contact (callback on a pre-existing public number, or verified business-domain control). Select the
   matching evidence codes. Company-domain email alone or licence knowledge alone is never enough; a free
   email address means enhanced review; any conflict or competing claim = HOLD.
3. Missing something → **needs_info** with a claimant message (target clock pauses). Otherwise **approve**
   with `AUTHORITY_VERIFIED`.
4. **Expected:** ACTIVE grant; `CLAIM_APPROVED` + `FIRST_CLAIM_ONBOARDING` emails received by the owner;
   `review_decided_at` and `human_review_active_seconds` stamped; audit `claim_approved`, `grant_created`.

## 4. My Trust Hub → business information (Owner)

1. Owner opens **My Trust Hub** (`/manage`) → the profile → **Business information**.
2. Saves **website** and **hours** (weekday opening times). Save succeeds with version 1.

## 5. Public layer appears (Founder)

1. Wait **3–4 minutes** after the save (worst case 210 s: Ask edge ≤150 s + Contractor cache ≤60 s), then
   open the public profile. If the first load still shows the prior state, **refresh once** (a single
   stale-while-revalidate render is expected by design) — this is not a failure.
2. **Check, all must hold:**
   - Section headed **"Profile managed by an authorized representative"** / **"Information supplied by the
     business"** appears **below** the official evidence, with "Provided by the business" on contact info and
     "Availability provided by the business" showing the hours; "Visit business website" links to the saved URL.
   - Official DBPR evidence (licence, status, dates, discipline if any), JSON-LD, and search ordering are
     **unchanged** versus step 1.
   - No "verified owner", "verified business" or score language anywhere.
3. Optional cross-check: `…/api/public/contractor-profiles/<uuid>/public-state` shows
   `hasPublicBusinessProfile:true` with the saved website.

## 6. Leave the grant active

No real-owner revocation for ceremony. Revocation is certified by the synthetic suites and the R4 two-instance
test; leave the legitimate owner managing their profile.

## 7. Founder success criteria (all required)

1. 0 durable intents before Continue; exactly 1 after.
2. Claim submitted and decided by a human reviewer with independent authority evidence recorded; decision
   within the 2-business-day internal target (needs_info time excluded).
3. ACTIVE grant; owner reached My Trust Hub from the approval email.
4. Website + hours visible on the public Contractor profile, correctly labelled as business-supplied by an
   authorized representative, within 4 minutes of saving (one refresh allowed).
5. Official DBPR evidence byte-for-byte unchanged in presentation; no endorsement language.
6. No token, email address or raw IP in analytics or logs; no abuse-rule false positive for the owner.
7. Owner confirms (informally) the flow was understandable without Founder hand-holding.

Then record: `lib/customer/claim-v2-readiness.ts` Contractor `R8_REAL_OWNER_CANARY` →
`REAL_OWNER_CANARY_COMPLETE` (evidence: claim id), `R9_REVIEW_CAPACITY` once capacity metrics show the claim.
Only then open ATH-CLAIM-V2-002 (10–20 business handheld cohort).

## Abort conditions

- Business-supplied content visible before approval, or official evidence changed → stop, investigate.
- Public layer not visible 10 minutes after save (well beyond the bound) → stop; capture the `public-state`
  response headers (`x-ath-public-read`, `age`, `x-vercel-cache`) before retrying anything.
- A token, email or raw IP appears in analytics/logs → stop; rotate `ATH_HANDOFF_SECRET`.
- Competing claim or existing grant → governance HOLD; never force.
- Any step needs a hand-edited customer row → stop; use the admin surface or file a ticket.
