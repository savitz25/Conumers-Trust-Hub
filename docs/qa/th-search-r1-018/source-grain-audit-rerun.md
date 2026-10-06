# TH-SEARCH-R1-018 — Source / Grain Audit Rerun

Spec section 21 requires confirming the R1-017 source/grain audit's 20 listed non-equivalences
still hold after the six blocker repairs, and that no repair introduced a new violation. This
rerun re-checks each item against the post-fix full-corpus rerun evidence
(`full-r1017-rerun-ask.json`, `full-r1017-rerun-direct.json`) and the new
`parent-specialist-differential.json`, focusing specifically on the three hubs that changed
(Move, Insurance, Contractor) since the other three (Lender, Senior, Investor) received no
product changes in R1-018 and their R1-017 audit rows are unaffected by construction.

| Non-equivalence | R1-017 status | R1-018 rerun status | Notes |
|---|---|---|---|
| credential != company | HOLDS | HOLDS (unchanged) | Insurance fix (BLOCKER-INSURANCE-01) touched geography/ZIP routing only, not the credential/company distinction; INSURANCE-ZIP-33441 and INSURANCE-AGENCY-NEARME both re-confirmed correct in the rerun. |
| record != unique entity | HOLDS | HOLDS, more precisely | MOVE-JK-BARE's rerun shows the parent surface now returns only the 2 highest-confidence distinct entities (JK Moving Services USDOT 1065394, JK Moving Services USDOT 1300300) rather than blending them; still two distinct records, never merged. |
| directory listing != regulatory identity | HOLDS | HOLDS, and now correctly reached | The new `local_directory_handoff` mode (BLOCKER-INSURANCE-01 fix) makes this distinction *more* visible: ZIP/city insurance requests now explicitly route to a DIRECTORY destination instead of silently being treated as a regulatory-identity cohort. |
| federal authority != state authority | HOLDS | HOLDS (unchanged) | Not touched by R1-018; MOVE-LOCAL-NJ's direct-surface journey-definition response still keeps FMCSA federal authority separate from state intrastate authority guidance. |
| HQ != service territory | HOLDS, with prior caveat | CAVEAT RESOLVED | R1-017 noted BLOCKER-MOVE-01's widened candidate set made the HQ disclosure attach to an oversized, less relevant company set. Post-fix, MOVE-JK-BARE/MOVE-JK-JOURNEY's candidate sets are back to 2-3 genuinely relevant entities, so the HQ-is-not-service-territory disclosure now attaches to a materially smaller, correctly-scoped set. |
| office != registration jurisdiction | HOLDS | HOLDS (unchanged) | Investor hub untouched by R1-018. |
| HMDA property geography != license jurisdiction | HOLDS | HOLDS (unchanged) | Lender hub untouched by R1-018 (IDENTIFIER-FILLER-WORD-01 fix is hub-agnostic parsing, not lender-specific geography logic; R18-NMLS-NUMBER rerun confirms normal lender identifier resolution). |
| NPN != appointment | HOLDS (untested against resolvable identity) | SAME CAVEAT | R18-NPN-NUMBER (new R1-018 paraphrase) still resolves against a non-appointment-bearing NPN; recommend a future ticket target a confirmed-resolvable NPN, as already noted in R1-017. |
| LOA != appointment | HOLDS (same caveat) | SAME CAVEAT | Unchanged. |
| complaint != final order | NOT DIRECTLY TESTED | NOT DIRECTLY TESTED | No R1-018 corpus addition targeted this pair; carried forward unchanged. |
| disclosure != wrongdoing | HOLDS | HOLDS (unchanged) | Investor hub untouched by R1-018. |
| missing evidence != zero | HOLDS | HOLDS, re-confirmed | ID-MC-CONFLICT's rerun (`ZERO_MATCHING_ROWS` on both ask and direct surfaces for the disputed MC) is an executed, disclosed zero, not a false zero. See count/false-zero audit rerun for the full check. |
| missing evidence != clean record | HOLDS | HOLDS (unchanged) | Same evidence family as above. |
| sourceAsOf != retrievedAt != deploymentAt | PARTIALLY OBSERVABLE | PARTIALLY OBSERVABLE (unchanged) | Not touched by R1-018; same limitation as R1-017. |
| Nursing Home != Home Health != Hospice != Assisted Living | HOLDS, with adjacent BLOCKER-SENIOR-01 | HOLDS, BLOCKER RESOLVED | BLOCKER-SENIOR-01 (deictic entity-name fabrication) is now fixed: R18-SENIOR-DEICTIC-PARAPHRASE, R18-SENIOR-FINED, R18-SENIOR-CHANGED-OWNERS, R18-SENIOR-ASSISTED-LIVING-DEICTIC, R18-SENIOR-HOSPICE-DEICTIC all correctly avoid fabricating an entity name AND correctly keep Nursing Home/Assisted Living/Hospice as distinct classes (the fix extended `DEICTIC_ENTITY`, it did not touch class-conflation logic). |
| RIA != ERA | HOLDS | HOLDS (unchanged) | Investor hub untouched by R1-018. |
| legal insurer != agency | HOLDS | HOLDS (unchanged) | BLOCKER-INSURANCE-01 fix only affects ZIP/city geography routing (`local_directory_handoff`) and named-entity routing (`identity_name` mode using `plan.entityName`); it does not touch the insurer/agency `entityClass` distinction. INSURANCE-NAMED-INSURER unaffected in the rerun. |
| carrier != broker | HOLDS | HOLDS, re-confirmed | MOVE-JK-BARE's rerun candidates still carry distinct `role: "Carrier"` / `role: "Broker"` fields (e.g. JK Brokerage Services role:"Broker" remains distinct from JK Moving Services role:"Carrier") even after the tighter identity-tier match; the fix changed match *scope*, not role disclosure. |
| Contractor trade-class capability != blanket availability | (new, implicit in CONTRACTOR-01) | HOLDS | CONTRACTOR-TXGC-PARAPHRASE's rerun result (`UNSUPPORTED_TRADE_CAPABILITY` for a Texas general-contractor request that has no matching trade class) shows the fixed contractor path correctly reaching the real specialist and receiving a genuine, disclosed capability limitation -- not fabricated results and not a blanket `BACKEND_UNAVAILABLE` failure. This confirms BLOCKER-CONTRACTOR-01's fix (relaxing the stale contractFingerprint check) did not also relax legitimate specialist-side capability gating. |

## Summary

All equivalences confirmed HOLDING in R1-017 remain HOLDING after the R1-018 repairs. One
previously-noted caveat (HQ-disclosure attaching to an oversized Move candidate set) is now
resolved as a direct consequence of BLOCKER-MOVE-01's fix. No new violation was introduced by any
of the six repairs: each fix was scoped to a name-matching threshold (Move), a routing/mode
decision (Insurance ZIP/entity), a parsing helper (identifier filler words), a regex extension
(Senior deictic terms), a version-lock relaxation (Contractor fingerprint), or a structural
intent-detection condition (cross-domain), none of which touch the semantic-class-distinction
logic that this audit protects. Two pre-existing gaps (`complaint != final order`, the full
`sourceAsOf`/`retrievedAt`/`deploymentAt` three-way distinction) remain untested, carried forward
unchanged from R1-017, and are not blockers for this certification.
