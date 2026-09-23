# ATH-CLAIM-V2-001 — Contractor Real-Owner Canary Runbook (Founder-executed)

Purpose: turn Contractor's R8 (real-owner canary) from PENDING_FOUNDER_CANARY to COMPLETE with one
legitimate, consenting Florida contractor. Nothing in this runbook is automated by the ticket; the Founder
executes it after the two draft PRs are reviewed, merged, and migration 019 is applied.

## Preconditions (all must be true)

1. Ask PR merged and deployed; **migration 019 applied** to the Ask customer database (additive; reversal file
   exists). Verify: `SELECT column_name FROM information_schema.columns WHERE table_name='ath_claims' AND
   column_name='acquisition_source'` returns a row.
2. Contractor PR merged and deployed. Verify from a browser (not curl): opening
   `https://www.contractortrusthub.com/api/claim/handoff/<any-uuid>` shows the 405 JSON, never a redirect.
3. `ATH_HANDOFF_SECRET` identical on both apps (unchanged by this ticket).
4. Contractor `ATH_CLAIM_CTA_MODE=canary` with `ATH_CLAIM_CANARY_PROFILE_IDS=<the canary contractor's UUID>`
   (a Founder-only production env change; this ticket did not touch it).
5. Staff account for the reviewer exists in `ath_admin_staff` with `TRUST_OPS` or `SUPER_ADMIN`.
6. The canary business has consented in writing to participate and knows claiming is free, is not an
   endorsement, and changes no evidence.

## Step 1 — Public profile → claim start (the business does this)

1. Business opens its own Trust Report `https://www.contractortrusthub.com/contractors/<slug>`.
2. Confirms the profile shows official DBPR evidence only and the CTA reads
   "Is this your business? Claim or manage this profile — free".
3. Presses the button. Expected: browser lands on
   `https://www.asktrusthub.com/claim/continue` showing the exact business name, credential, "Recorded state:
   FL", "what claiming means", and a **Continue** button. Nothing has been recorded yet.
   - Founder check (optional): `SELECT count(*) FROM ath_claim_intents WHERE intent_origin='explicit_continue'`
     is unchanged at this point.

## Step 2 — Explicit Continue → account → submission

1. Business presses **Continue**. Expected: same page, now asking for a work email.
   - Founder check: one new `ath_claim_intents` row with `intent_origin='explicit_continue'`,
     `acquisition_source='organic'` (or `manual_outreach` if you sent them the link by hand — ask them to use
     the profile button anyway so the funnel is measured as organic).
2. Business enters a work email, receives the magic link, returns to `/claim/continue`, chooses relationship
   (`owner` / `officer` / `qualifying_agent` / …), confirms the credential, ticks the authorization box, submits.
3. Expected: `/claim/status/<id>` shows "Submitted"; the claim appears at the top of
   `/admin/operations/claims` (filter `pending`) with Source = organic and SLA = "Within 48 business-hour target".

## Step 3 — Staff review (the Founder / TRUST_OPS reviewer does this)

1. Open the claim. Answer "Was the evidence ready at first review?" and press **Start review timer**.
2. Verify authority independently (Sunbiz officer, DBPR qualifier, callback through a pre-existing public
   number). Select the matching evidence codes. Do not rely on the company-domain email alone.
3. If something is missing: `needs_info` with a claimant message. The timer closes automatically.
4. When evidence is GREEN: `approve` with `AUTHORITY_VERIFIED`. Expected: an ACTIVE grant, `CLAIM_APPROVED`
   and `FIRST_CLAIM_ONBOARDING` emails, review timing stamped (`review_decided_at`,
   `human_review_active_seconds`), audit `claim_approved` + `grant_created`.

## Step 4 — Business-supplied publication (the business does this)

1. Business opens `/manage/<profileId>` → Business information → saves **website** and **hours** (minimum).
2. Founder verifies on the public Trust Report: a section labelled "Profile managed by an authorized
   representative" / "Information supplied by the business" appears **below** the official DBPR evidence;
   JSON-LD is unchanged; ranking/search ordering is unchanged; the discipline section (if any) is unchanged.
3. Optional: if there is a factual, non-marketing context the business wants to add, it may submit one
   business response; staff moderates it. Skip if not appropriate.

## Step 5 — Leave the grant active

Do **not** revoke the canary's grant for ceremony. Revocation was certified historically and is re-certified by
the automated suites (`ath-claim-v2-001` R). Leave the legitimate owner managing their profile.

## Step 6 — Record the canary

Update `lib/customer/claim-v2-readiness.ts` (Contractor `R8_REAL_OWNER_CANARY` → `REAL_OWNER_CANARY_COMPLETE`
with the claim id as evidence) and `R9_REVIEW_CAPACITY` once `/admin` capacity metrics show at least one
external claim. Open ATH-CLAIM-V2-002 (10–20 business handheld cohort) only after this.

## Abort conditions

- The public profile shows anything other than official evidence before approval → stop, investigate.
- The CTA link or the Ask page exposes a token in analytics or logs → stop, rotate `ATH_HANDOFF_SECRET`.
- The claim is competing with another open claim or an active grant → follow governance (HOLD), do not force.
- Any step requires editing a customer row by hand → stop; use the admin surface or file a ticket.
