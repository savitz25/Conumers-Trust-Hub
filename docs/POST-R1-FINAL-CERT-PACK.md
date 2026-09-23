# POST-R1-FINAL-CERT-PREP-001 — Cross-Hub Closeout Pack

**Status:** PREPARED — not yet executed as final certification
**Scope:** AskTrustHub (`savitz25/Conumers-Trust-Hub`) certification harness + frozen query pack for closing the Post-R1 consistency sprint
**Harness:** `lib/network/post-r1-final-cert/pack.ts`, `lib/network/post-r1-final-cert/runner.ts`, `lib/network/post-r1-final-cert.test.ts`, `scripts/cert-post-r1-final.mjs`
**Evidence output:** `docs/qa/post-r1-final-cert/<mode>-latest.{json,md}`

This pack does **not** certify anything GREEN. It is run for real only after Ask PR #194 (Contractor timeout/fallback) and Contractor cold-path stabilization are released (§7).

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
| CON-01 | Contractor | cohort_local | general contractor in miami | A | pending: CONTRACTOR_COLD_PATH_STABILIZATION |
| CON-02 | Contractor | cohort_local | roofers in broward | A | pending: CONTRACTOR_COLD_PATH_STABILIZATION |
| CON-03 | Contractor | cohort_local | plumber in miami | A | pending: CONTRACTOR_COLD_PATH_STABILIZATION |
| CON-04 | Contractor | identifier | verify contractor license CBC015082 | A | pending: CONTRACTOR_COLD_PATH_STABILIZATION; known: CONTRACTOR_IDENTIFIER_TIMEOUT_FOLLOWUP |
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

Non-gating observations (recorded every run, never asserted): `OBS-01` "I need a mover and a mortgage lender in New Jersey"; the deeper multi-hub step `is state farm licensed in texas → hub:insurance → insurance_class:legal_insurer`.

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

Status per record: `PASS` (acceptable, disclosed), `KNOWN_LIMITATION` (tolerated under §5 while disclosed), `PENDING_RELEASE` (prep mode only), `FAIL`.

---

## 3. Harness

`runCertQuery(entry)` mirrors `app/ask/page.tsx` decision order exactly — route + execution decision → network name-candidate search → securities refusal / journey / place lens → guided session (executed only when the client would execute it) → federated fallthrough — and records per query:

query · selected vertical · offered hubs · extracted entity · extracted identifier · product/trade/class · geography (requested → executed → session, with meaning) · capability selected · result state + shape · destinations/handoffs · next actions · timeout/failure state · disclosures · outcome class · violations · status.

Counts (`total`) are recorded for evidence but never asserted.

Commands:

```
npm run check:post-r1-final-cert            # gate, prep mode (default)
POST_R1_CERT_MODE=final npm run check:post-r1-final-cert   # gate, final mode
npm run cert:post-r1-final:prep             # reporter -> docs/qa/post-r1-final-cert/prep-latest.{json,md}
npm run cert:post-r1-final                  # reporter, final mode (exit 1 on FAIL or any PENDING_RELEASE)
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
| CONTRACTOR_IDENTIFIER_TIMEOUT_FOLLOWUP | Tracked separately — **not** tolerated in final mode because the final pack explicitly targets Contractor supported paths (§7 step 6) | — |

Pending releases (prep-mode tolerance only): `CONTRACTOR_COLD_PATH_STABILIZATION`, `ASK_PR_194_TIMEOUT_FALLBACK`.

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

## 7. Final Production certification procedure (run only after PR #194 is released)

1. **Confirm Ask main SHA.** `git fetch origin main && git rev-parse origin/main`; confirm the Vercel production status for that SHA is `success` (`gh api repos/savitz25/Conumers-Trust-Hub/commits/<sha>/status --jq '.statuses[] | select(.context=="Vercel")'`). Record it as `askSha`.
2. **Confirm Contractor production SHA / index state.** `git -C ~/contractor-trust-hub fetch origin main && git rev-parse origin/main`; confirm its Vercel production deployment; confirm the Contractor cold-path stabilization commit is included; record the live index/source clock shown on a `https://www.contractortrusthub.com/contractors/<slug>` page.
3. **Run the machine certification pack in final mode.** `POST_R1_CERT_MODE=final npm run check:post-r1-final-cert` then `npm run cert:post-r1-final`. Exit code must be 0: no FAIL, no PENDING_RELEASE. Commit `docs/qa/post-r1-final-cert/final-latest.{json,md}` as evidence.
4. **Browser spot checks (Production, `https://www.asktrusthub.com/ask`).** At minimum: LEN-01, INS-02, CON-04, SEN-02, MOV-01, INV-02, NET-01, plus one query per frozen limitation (CON-05, SEN-03, SEN-05, NET-05). Verify the rendered class matches the machine record.
5. **Multi-hub choice flow.** `is state farm licensed in texas` → choose InsuranceTrustHub → choose an entity class; `electrician mortgage lender New Jersey` → choose each offered hub. No invalid-session error at any step; geography retained.
6. **Contractor supported-path first-touch checks.** With a cold Contractor path (first request after ≥15 minutes idle): `general contractor in miami`, `roofers in broward`, `plumber in miami`, `verify contractor license CBC015082`. Each must complete within Ask's specialist budget on first touch (class A) — if any returns TIMEOUT, the on-timeout state must show the direct-Contractor fallback link (PR #194) and the hub is BLOCKED, not GREEN. Repeat once warm and record both latencies.
7. **Confirm no console errors.** `read_console_messages` (errors only) after a fresh page load plus one query per hub. Zero attributable errors.
8. **Produce the final six-hub matrix** (§8) from `final-latest.md`, adding browser and first-touch evidence, and close the sprint only if all six rows are GREEN.

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

Column semantics: *Specialist status* = RESPONDING / TIMEOUT / UNAVAILABLE from the machine records; *Ask routing* = CORRECT or the WRONG_VERTICAL ids; *Identity* = worst status across identity+identifier entries; *Local / geography* = worst status across cohort/product entries; *Handoff* = SAFE or the BROKEN ids; *GREEN* only when every gating record for the hub is PASS or KNOWN_LIMITATION in a **final**-mode run **and** §7 steps 4–7 are clean.

The reporter prints this matrix automatically; in prep mode the verdict column always reads `NOT CERTIFIED (prep; would be …)`.

---

## 9. Prep-run snapshot and findings (informational — nothing fixed here)

`docs/qa/post-r1-final-cert/prep-latest.md` / `.json` hold the committed prep run against Ask `06a4c614` and live production specialists. Across three prep runs the only non-PASS records were Contractor first-touch timeouts (PENDING_RELEASE); every other query landed in an acceptable class with its source-grain and handoff rules intact.

Findings observed while freezing the pack (pre-existing behavior, outside every released Post-R1 ticket, recorded for Founder triage):

| # | Finding | Where | Class today | Blocking? |
|---|---|---|---|---|
| F1 | Contractor first-touch requests exceed Ask's 8000 ms specialist budget (`general contractor in miami`, `roofers in broward`, `verify contractor license CBC015082` → `TIMEOUT`); the same queries complete in 3–6 s once warm. | `lib/guided-research/specialists.ts` budget; ContractorTrustHub cold path | TECHNICAL_TIMEOUT (PENDING_RELEASE in prep) | Yes for final cert — covered by PR #194 + Contractor cold-path work. |
| F2 | `I need a mover and a mortgage lender in New Jersey` plans as `MULTI_HUB_JOURNEY` but the journey planner returns null, so the guided session lands in CLARIFY with **no choices and no next actions** ("The requested local scope is not executable by this specialist."). | `lib/network/ask-multi-hub-journey.ts` / `lib/guided-research/session.ts` | BROKEN_HANDOFF (observation, non-gating) | No — not in the frozen pack; recommend a bounded follow-up ticket. |
| F3 | `is state farm licensed in texas` → InsuranceTrustHub → *Legal insurer* ends in CLARIFY "The requested scope cannot be executed safely." with **no choices and no next actions** (Texas is outside Insurance's supported jurisdictions, but no handoff/official-source action is offered). | `lib/guided-research/orchestrator.ts` scope gate | dead end after the released multi-hub fix (observation) | No — the released MULTIHUB-001 step (hub choice) is valid; recommend adding the standard specialist/official next actions to this state. |
| F4 | At the guided layer an Investor firm name only becomes `identity_name` via the literal form "… named X"; `Vanguard Advisers Inc` / `research adviser Edward Jones` execute as an unscoped `firm_cohort` returning the whole IARD roster (23,622). The live page pre-empts this with the network name-candidate search for name-shaped input, so exposure is limited to `interpret=category` and sentence-shaped names. | `lib/guided-research/session.ts` investorIntent | not in pack (INV-01 uses `Fisher Investments`, which resolves via name candidates) | No — recommend a bounded follow-up mirroring the Lender/Insurance `plan.entityName` precedent. |
| F5 | InsuranceTrustHub's OFFICE_LOCATION directory backend flaps: INS-02 returned 7,936 RECORDED_COUNTY rows in one run and the fail-closed local-directory-unavailable state minutes later. Both are honest (A / C). | InsuranceTrustHub backend | A or C | No — already tracked as INSURANCE_OFFICE_LOCATION_BACKEND_UNAVAILABLE. |
| F6 | `restaurant health inspections in miami` yields the deterministic four-hub picker rather than an explicit "no TrustHub source owns this" disclosure. Nothing is fabricated. | `lib/guided-research/session.ts` multi-hub branch | B | No — Founder call whether class C wording is preferred. |
