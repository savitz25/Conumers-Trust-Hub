# POST-R1 FINAL CERT — Cross-Hub Closeout Pack

**Prepared by:** POST-R1-FINAL-CERT-PREP-001 (PR #197) · **Acceptance contract approved by:** POST-R1-FINAL-CERT-001
**Scope:** AskTrustHub (`savitz25/Conumers-Trust-Hub`) certification harness + frozen query pack for closing the Post-R1 consistency sprint
**Harness:** `lib/network/post-r1-final-cert/pack.ts`, `lib/network/post-r1-final-cert/runner.ts`, `lib/network/post-r1-final-cert.test.ts`, `scripts/cert-post-r1-final.mjs`
**Evidence output:** `docs/qa/post-r1-final-cert/<mode>-latest.{json,md}`

**Founder decisions since prep.** The two "pending release" dependencies the prep pack carried — Contractor cold-path stabilization and Ask PR #194 (8s→10s budget + fallback link) — were deliberately **closed without release**: bounded investigation proved genuinely cold large Contractor cohorts take ~15–22 s (extended statistics fixed cardinality estimation but not physical I/O; a covering index achieved Index Only Scan / zero heap fetches but stayed ~14.9 s cold; set-based hydration stayed ~16.8 s cold; deeper cache/materialization/partitioning work was deferred; the ineffective covering index was removed; `licenses_geo_trade_status_stats` stays). PR #194 is closed unmerged. The behavior is frozen as the known limitation `CONTRACTOR_COLD_FIRST_TOUCH_IO_LATENCY` and accepted **only** under the strict Section 3 rule (§3a below).

---

## 1. Frozen real-consumer query pack

All queries are real Founder-testing phrasings or already-certified R1 controls. The frozen source of truth is `QUERY_PACK` in `pack.ts`; this table mirrors it.

| ID | Hub | Kind | Query | Acceptable classes | Frozen limitation / pending |
|---|---|---|---|---|---|
| LEN-01 | Lender | identity | is rocket mortgage legit | A | — |
| LEN-02 | Lender | cohort_state | banks that do helocs in ohio | B, C | — |
| LEN-03 | Lender | product_local | va loan lenders near fort bragg nc | A, B | — |
| INS-01 | Insurance | cohort_local | insurance agent in miami | C, D | — |
| INS-02 | Insurance | cohort_local | insurance agency in broward county | A, C, D | — |
| INS-03 | Insurance | product_local | medicare supplement agent in ohio | B, C | — |
| INS-04 | Insurance | multi_hub | is state farm licensed in texas | B | — |
| CON-01 | Contractor | cohort_local | general contractor in miami | A | known: CONTRACTOR_COLD_FIRST_TOUCH_IO_LATENCY (Section 3 rule) |
| CON-02 | Contractor | cohort_local | roofers in broward | A | known: CONTRACTOR_COLD_FIRST_TOUCH_IO_LATENCY (Section 3 rule) |
| CON-03 | Contractor | cohort_local | plumber in miami | A | known: CONTRACTOR_COLD_FIRST_TOUCH_IO_LATENCY (Section 3 rule) |
| CON-04 | Contractor | identifier | verify contractor license CBC015082 | A | known: CONTRACTOR_IDENTIFIER_TIMEOUT_FOLLOWUP (Section 3 rule) |
| CON-05 | Contractor | product_local | licensed electrician in boca raton | A, B, C | known: FL_ELECTRICAL_SOURCE_GAP |
| SEN-01 | Senior | identity | is abbey delray south medicare certified | A, B | — |
| SEN-02 | Senior | cohort_local | hospice care for my mom in tampa | A | — |
| SEN-03 | Senior | unsupported_source | memory care in orlando | B, C | known: CMS_MEMORY_CARE_ASSISTED_LIVING_SOURCE_GAP |
| SEN-04 | Senior | unsupported_source | assisted living facilities in new jersey | B, C | known: CMS_MEMORY_CARE_ASSISTED_LIVING_SOURCE_GAP |
| SEN-05 | Senior | cohort_local | home health agencies in miami dade county | C, B | known: HOME_HEALTH_COUNTY_SERVICE_AREA |
| MOV-01 | Move | identity | Senior Moving Services LLC | A | — |
| MOV-02 | Move | cohort_local | movers in broward county | A, B | — |
| MOV-03 | Move | identifier | USDOT 3244649 | A | — |
| INV-01 | Investor | identity | Fisher Investments | A | — |
| INV-02 | Investor | identifier | CRD 105958 | A | — |
| INV-03 | Investor | cohort_state | investment advisers in california | A | — |
| NET-01 | Network | ambiguous_name | AVANTE | A, B | known: AVANTE_SIX_CHARACTER_AMBIGUITY |
| NET-02 | Network | multi_hub | electrician mortgage lender New Jersey | B | — |
| NET-03 | Network | no_result | NPN 00000001 | A (zero), C | — |
| NET-04 | Network | unsupported_source | restaurant health inspections in miami | B, C | — |
| NET-05 | Network | identity | brightway insurance jacksonville | A (zero), C | known: INSURANCE_JACKSONVILLE_CROSSWALK_GAP |

POST-R1 backlog observations (recorded every run, never asserted, no implementation tickets): `OBS-F2` "I need a mover and a mortgage lender in New Jersey"; `OBS-F3` `is state farm licensed in texas → hub:insurance → insurance_class:legal_insurer`; `OBS-F4` "research adviser Edward Jones"; `OBS-F6` "restaurant health inspections in miami" (also gated as NET-04 in class B/C).

Why Move/Investor use these specific queries: Founder testing produced no Move/Investor phrasings, so the pack takes the already-certified R1 controls (`Senior Moving Services LLC`, `USDOT 3244649`, `CRD 105958`) plus the shortest real consumer forms that exercise the remaining path (`movers in broward county`, `Fisher Investments`, `investment advisers in california`). `Vanguard Advisers` was rejected: at the guided layer it becomes an unscoped `firm_cohort` of the whole IARD roster (see §9, finding F3).

---

## 2. Outcome classes

Every query must end in exactly one of:

| Class | Meaning | Harness rule |
|---|---|---|
| **A. SOURCE_BACKED_RESULT** | Rows / exact identity / name candidates from a specialist, or a genuine source-backed zero | `SUPPORTED_RESULTS`, `EXACT_IDENTITY`, `ZERO_MATCHING_ROWS`, `NO_CONFIDENT_MATCH` (with a next action), or `NAME_CANDIDATES` with candidates or a genuine network miss |
| **B. DETERMINISTIC_CLARIFICATION** | The consumer is asked a bounded question (hub, class, geography, name/identifier) | CLARIFY/COLLECT with choices, missing fields, or an ENTER_/SELECT_/CONSENT_ next action; multi-hub journey with step destinations |
| **C. HONEST_UNSUPPORTED_WITH_NEXT_ACTION** | A named capability gap plus a useful next action | `UNSUPPORTED_*`, `PUBLICATION_RESTRICTED`, `INVALID_QUERY`, or a CLARIFY limitation message, each with a destination/next action |
| **D. SOURCE_UNAVAILABLE_WITH_FAIL_CLOSED_NEXT_ACTION** | Specialist backend down; nothing substituted; retry/handoff offered | `BACKEND_UNAVAILABLE` with next action; name search with incomplete hubs |

Unacceptable (each maps to a concrete detector in `runner.ts`):

| Class | Detector |
|---|---|
| WRONG_VERTICAL | guided `session.hub` ≠ expected, or a multi-hub picker that omits an expected hub, or name candidates that exclude the expected hub |
| FALSE_NO_MATCH | `expectMatch` entry returns zero rows / zero candidates |
| INVALID_GUIDED_SESSION | orchestrator throws, or an unknown phase/result state |
| WHOLE_SENTENCE_AS_ENTITY | `identityName` equals the whole sentence-shaped query |
| FABRICATED_LOCAL_SCOPE | executed grain coarser than requested without "You asked / Research executed" (or equivalent) disclosure; Insurance local-directory rows without the recorded-address disclosure |
| SERVICE_TERRITORY_INFERENCE | any surface text affirmatively claiming "serves the entire/all/customers…" or "service area confirmed" |
| TECHNICAL_TIMEOUT | `resultState: TIMEOUT` |
| BROKEN_HANDOFF | dead-end with no choices and no next action; any href that is not https on an allowlisted TrustHub/official host; a specialist `/ask` handoff with no `q` |
| WRONG_IDENTIFIER_CLASS | `session.identifier.type` ≠ expected family |

Status per record: `PASS` (acceptable, disclosed), `KNOWN_LIMITATION` (tolerated under §5 while disclosed — never for false evidence), `FAIL`. There is no pending-release status.

---

## 3a. Contractor final acceptance rule (Section 3 of POST-R1-FINAL-CERT-001)

Contractor timeouts are never simply ignored. `runner.ts#evaluateColdRetry` (pure, unit-tested offline) may classify a **first-touch TIMEOUT on a supported Contractor query** as `KNOWN_LIMITATION` — still permitting GREEN — only if **all** hold:

1. vertical is Contractor;
2. trade / identifier interpretation is correct (no `PRODUCT:`/`ENTITY:` violation, identifier family recognized);
3. geography is correct (no `GEOGRAPHY:` violation);
4. the timeout was **not** converted into a zero-result (`resultState` stays `TIMEOUT`, no rows, and the retry is not `ZERO_MATCHING_ROWS`/`NO_CONFIDENT_MATCH`);
5. the UI explicitly reports the technical timeout ("took too long" / `timeout`);
6. `RETRY` (or an equivalent safe specialist next action) is present;
7. the single bounded retry (the client's "Try again" → `EXECUTE`) succeeds;
8. the retry's result semantics and source grain are correct (all §4 disclosures present, no violations);
9. no invalid session or broken handoff occurs on either attempt.

Two consecutive bounded attempts failing → **FAIL / BLOCKED**. Timeout converted to zero results → **FAIL / BLOCKED**. Wrong trade / geography → **FAIL / BLOCKED**. The exception is limited to Contractor entries frozen under `CONTRACTOR_COLD_FIRST_TOUCH_IO_LATENCY` or `CONTRACTOR_IDENTIFIER_TIMEOUT_FOLLOWUP`; every other timeout anywhere is a plain `TECHNICAL_TIMEOUT` failure. Both attempts are recorded (`attempts[]`) and printed in the reporter's "Contractor first-touch certification" table.

---

## 3. Harness

`runCertQuery(entry)` mirrors `app/ask/page.tsx` decision order exactly — route + execution decision → network name-candidate search → securities refusal / journey / place lens → guided session (executed only when the client would execute it) → federated fallthrough — and records per query:

query · selected vertical · offered hubs · extracted entity · extracted identifier · product/trade/class · geography (requested → executed → session, with meaning) · capability selected · result state + shape · destinations/handoffs · next actions · timeout/failure state · disclosures · outcome class · violations · status.

Counts (`total`) are recorded for evidence but never asserted.

Commands:

```
npm run check:post-r1-final-cert            # gate (prep = dry run; identical assertions)
POST_R1_CERT_MODE=final npm run check:post-r1-final-cert   # gate, certification run
npm run cert:post-r1-final:prep             # reporter -> docs/qa/post-r1-final-cert/prep-latest.{json,md} (verdict never GREEN)
npm run cert:post-r1-final                  # reporter, final mode (exit 1 on any FAIL)
```

---

## 4. Source-grain rules (asserted whenever a hub returns rows or candidates)

| Rule | Hub | Required disclosure pattern |
|---|---|---|
| credential geography ≠ service territory | Insurance | "credential jurisdiction does not establish office location…" / "not a confirmed service area" |
| recorded office/address ≠ availability | Contractor, Insurance | "not service territory or current availability" / "not a confirmed service area" |
| state license jurisdiction ≠ office location | Insurance | "credential jurisdiction does not establish office location" |
| CMS recorded location ≠ patient service area | Senior | "not patient service availability" / "not service area" |
| HMDA property geography ≠ lender branch/service area | Lender | "Property geography is not headquarters, branch location…" |
| missing evidence ≠ clean history | Senior (rows) + all hubs (negative) | "Missing source evidence is not zero, clean, or good standing."; no surface may say "clean record/history", "no complaints on file" |
| recorded headquarters ≠ service territory | Move | "Recorded headquarters is not service territory…" |
| principal office ≠ client geography | Investor | "Principal office is not client geography" |

Name-candidate cards additionally require a `locationMeaning` grain disclosure whenever a `recordedLocation` is shown.

---

## 5. Frozen known honest limitations (never fail while disclosed)

| ID | What stays honest | Disclosure the harness requires |
|---|---|---|
| AVANTE_SIX_CHARACTER_AMBIGUITY | Senior reports `UNSUPPORTED_OPERATION` for a bare six-character string instead of guessing CCN vs name | "six-character" |
| FL_ELECTRICAL_SOURCE_GAP | Trade choices or clearly-labeled broader general/building rows; never relabeled as electricians | "Electrical-specific … data is not available" / `unsupported_florida_electrical_source` |
| NJ_LOCAL_CONTRACTOR_MUNICIPALITY | NJ contractor research is state-grain only | (not in the frozen pack; browser spot check only) |
| CMS_MEMORY_CARE_ASSISTED_LIVING_SOURCE_GAP | Routed + labeled, fails closed | "state-specific sources" / "not a CMS…" |
| HOME_HEALTH_COUNTY_SERVICE_AREA | County unsupported; state broadening offered as consent | "not patient service availability" |
| INSURANCE_JACKSONVILLE_CROSSWALK_GAP | Name searched whole; honest network miss | (genuine network miss, all six hubs completed) |
| LENDER_MISSING_PUBLIC_DESTINATION | Destination omitted rather than loosely matched | (absence of href is allowed; presence must be allowlisted) |
| CONTRACTOR_IDENTIFIER_TIMEOUT_FOLLOWUP | Exact-identifier lookup can time out on a genuinely cold Contractor path; deferred, not fixed this sprint | §3a rule: explicit timeout + RETRY, bounded retry must succeed with the exact identity |
| CONTRACTOR_COLD_FIRST_TOUCH_IO_LATENCY | Large supported Contractor cohorts can exceed the budget on a genuinely cold first access (thousands of scattered pages); deferred performance limitation | §3a rule: explicit timeout + RETRY, bounded retry must succeed with correct trade/geography/grain |

Known limitation never means false evidence is acceptable: a wrong vertical, false no-match, fabricated local scope, service-territory claim, invalid session or broken handoff fails regardless of any limitation tag. There are no pending-release tolerances.

---

## 6. Handoff checklist (manual / browser, on Production)

For each row: open the Ask result, click the specialist handoff, and confirm (a) the destination is the named specialist on its canonical host, (b) the query context arrives (the `q` parameter or the profile/verify page for the same entity), (c) no broken URL (HTTP 200, no 404/500), (d) returning to Ask and using Back/Restart never yields "The Guided Research action or session was invalid", (e) the specialist page renders its own research shell.

| Handoff | Trigger query | Expected destination shape |
|---|---|---|
| Ask → LenderTrustHub | is rocket mortgage legit | `https://www.lendertrusthub.com/lender/rocket-mortgage` (row) and `/ask?q=is+rocket+mortgage+legit` |
| Ask → InsuranceTrustHub | insurance agency in broward county | `https://www.insurancetrusthub.com/providers/<slug>` rows; `/ask?q=…` fallback when the directory backend is down |
| Ask → ContractorTrustHub | verify contractor license CBC015082 | `https://www.contractortrusthub.com/contractors/cbc015082-…` and `/verify` |
| Ask → SeniorTrustHub | hospice care for my mom in tampa | `https://www.seniortrusthub.com/hospice/cms/<ccn>/<slug>` rows and `/ask?q=…&class=hospice&state=FL` |
| Ask → MoveTrustHub | Senior Moving Services LLC | `https://www.movetrusthub.com/companies/senior-moving-services-llc` (name-candidate card) |
| Ask → InvestorTrustHub | CRD 105958 | `https://www.investortrusthub.com/ask?q=CRD+105958` and official `https://adviserinfo.sec.gov/firm/summary/105958` |

Allowlisted hosts (anything else is BROKEN_HANDOFF): the six `www.*trusthub.com` hosts, `www.fmcsa.dot.gov`, `www.nmlsconsumeraccess.org`, `www.medicare.gov`, `adviserinfo.sec.gov`, `content.naic.org`.

---

## 7. Final Production certification procedure

1. **Confirm Ask main SHA.** `git fetch origin main && git rev-parse origin/main`; confirm the Vercel production status for that SHA is `success` (`gh api repos/savitz25/Conumers-Trust-Hub/commits/<sha>/status --jq '.statuses[] | select(.context=="Vercel")'`). Record it as `askSha`.
2. **Confirm Contractor production SHA / index state.** `git -C ~/contractor-trust-hub fetch origin main && git rev-parse origin/main`; confirm its Vercel production deployment; record the live source clock shown on a `https://www.contractortrusthub.com/contractors/<slug>` page. (No cold-path release is expected — see the Founder decisions above.)
3. **Run the machine certification pack in final mode.** `POST_R1_CERT_MODE=final npm run check:post-r1-final-cert` then `npm run cert:post-r1-final`. Exit code must be 0: no FAIL. Every query is reported; no silent exclusions. Commit `docs/qa/post-r1-final-cert/final-latest.{json,md}` as evidence.
4. **Browser spot checks (Production, `https://www.asktrusthub.com/ask`).** One strong representative success per hub (e.g. MOV-01, LEN-01, INS-02, CON-03, SEN-02, INV-02) plus one multi-hub guided choice (INS-04), one identifier flow (CON-04 or INV-02), one honest unsupported query (SEN-03 or INS-01) and one no-result query (NET-03). Verify routing, result evidence, handoff, query context, no invalid guided session, no false locality/service-area claim.
5. **Multi-hub choice flow.** `is state farm licensed in texas` → choose InsuranceTrustHub → choose an entity class; `electrician mortgage lender New Jersey` → choose each offered hub. No invalid-session error at any step; geography retained.
6. **Contractor first-touch certification (§3a).** Explicitly run `general contractor in miami`, `roofers in broward`, `plumber in miami`: attempt 1, then attempt 2 only if attempt 1 timed out. Record elapsed/result state, timeout yes/no, correct interpretation, safe next action, retry result. Apply §3a exactly — two consecutive failures, a zero-result conversion, or a wrong trade/geography is BLOCKED.
7. **Confirm no console errors.** `read_console_messages` (errors only) after a fresh page load plus one query per hub. Zero attributable errors.
8. **Produce the final six-hub matrix** (§8) from `final-latest.md`, adding browser, handoff and first-touch evidence, and close the sprint only if all six rows are GREEN (Contractor may be GREEN WITH KNOWN PERFORMANCE LIMITATION only under §3a).

---

## 8. Six-hub final matrix (template — do not fill GREEN in prep)

| Hub | Specialist status | Ask routing | Identity | Local / geography | Handoff | Known limitations | GREEN / BLOCKED |
|---|---|---|---|---|---|---|---|
| MOVE | | | | | | — | |
| LENDER | | | | | | LENDER_MISSING_PUBLIC_DESTINATION | |
| INSURANCE | | | | | | INSURANCE_JACKSONVILLE_CROSSWALK_GAP | |
| CONTRACTOR | | | | | | FL_ELECTRICAL_SOURCE_GAP, NJ_LOCAL_CONTRACTOR_MUNICIPALITY, CONTRACTOR_IDENTIFIER_TIMEOUT_FOLLOWUP | |
| SENIOR | | | | | | CMS_MEMORY_CARE_ASSISTED_LIVING_SOURCE_GAP, HOME_HEALTH_COUNTY_SERVICE_AREA, AVANTE_SIX_CHARACTER_AMBIGUITY | |
| INVESTOR | | | | | | — | |

Column semantics: *Specialist status* = RESPONDING / cold first-touch TIMEOUT recovered by bounded retry / TIMEOUT (unrecovered) / UNAVAILABLE from the machine records; *Ask routing* = CORRECT or the WRONG_VERTICAL ids; *Identity* = worst status across identity+identifier entries; *Local / geography* = worst status across cohort/product entries; *Handoff* = SAFE or the BROKEN ids; *GREEN* only when every gating record for the hub is PASS or KNOWN_LIMITATION in a **final**-mode run **and** §7 steps 4–7 are clean. Contractor reads **GREEN WITH KNOWN PERFORMANCE LIMITATION** when its only KNOWN_LIMITATION records are §3a cold-retry recoveries.

The reporter prints this matrix automatically; in prep mode the verdict column always reads `NOT CERTIFIED (prep; would be …)`.

---

## 9. POST-R1 backlog (observations only — no implementation tickets, nothing fixed)

`docs/qa/post-r1-final-cert/final-latest.md` / `.json` hold the certification run; `prep-latest.*` the earlier dry run. Pre-existing behaviors outside every released Post-R1 ticket, recorded by the reporter on every run and never asserted:

| # | Observation | Where | Class today | Disposition |
|---|---|---|---|---|
| F1 | Contractor first-touch requests exceed Ask's 8000 ms specialist budget on a genuinely cold path; the same queries complete in 3–6 s once warm. | ContractorTrustHub cold I/O | frozen `CONTRACTOR_COLD_FIRST_TOUCH_IO_LATENCY` | Closed without release (Founder decision); certified only under §3a. |
| F2 | `I need a mover and a mortgage lender in New Jersey` plans as `MULTI_HUB_JOURNEY` but the journey planner returns null, so the guided session lands in CLARIFY with **no choices and no next actions**. | `lib/network/ask-multi-hub-journey.ts` / `lib/guided-research/session.ts` | dead end (OBS-F2) | POST-R1 backlog. Not a supported core workflow; does not block closeout. |
| F3 | `is state farm licensed in texas` → InsuranceTrustHub → *Legal insurer* ends in CLARIFY "The requested scope cannot be executed safely." with a weak next action (no specialist/official handoff offered). Session stays valid. | `lib/guided-research/orchestrator.ts` scope gate | honest but weak (OBS-F3) | POST-R1 backlog. The released hub-choice step is valid and gated (INS-04). |
| F4 | At the guided layer an Investor firm name only becomes `identity_name` via "… named X"; sentence-shaped names such as `research adviser Edward Jones` execute as an unscoped firm cohort. The live page pre-empts this with the network name-candidate search for name-shaped input. | `lib/guided-research/session.ts` investorIntent | wording limitation (OBS-F4) | POST-R1 backlog. INV-01 (`Fisher Investments`) is the gated identity path. |
| F5 | InsuranceTrustHub's OFFICE_LOCATION directory backend flaps between RECORDED_COUNTY rows and the fail-closed local-directory-unavailable state. Both honest (A / C). | InsuranceTrustHub backend | A or C | Already tracked as INSURANCE_OFFICE_LOCATION_BACKEND_UNAVAILABLE. |
| F6 | `restaurant health inspections in miami` yields the deterministic four-hub picker rather than an explicit "no TrustHub source owns this" disclosure. Nothing is fabricated. | `lib/guided-research/session.ts` multi-hub branch | B (NET-04 / OBS-F6) | POST-R1 backlog; Founder call on wording. |
