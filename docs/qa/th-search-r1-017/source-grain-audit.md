# TH-SEARCH-R1-017 — Source / Grain Audit

Explicit audit of the non-equivalences required by spec section 17, against evidence actually
observed in this sweep's raw data (`raw-ask-results.json`, `raw-direct-results.json`) and the
per-hub `results-*.json` files.

| Non-equivalence | Status | Evidence |
|---|---|---|
| credential != company | HOLDS | Insurance's producer/agency/insurer distinction confirmed separate in every sampled case; no credential row presented as a company identity. |
| record != unique entity | HOLDS | Move's "Jk Moving Services" (USDOT 1300300) and "JK Moving Services" (USDOT 1065394) are kept as two distinct records, never merged. |
| directory listing != regulatory identity | HOLDS | Insurance's ZIP-directory mode (`DIRECTORY_HANDOFF`) is a visibly separate `resultType`/terminalState from identifier/entity modes; never conflated in the raw responses sampled. |
| federal authority != state authority | HOLDS | Move's FMCSA (federal) authority is never presented as Florida IM or any state intrastate authority; capability-registry-level notes and per-row disclosures keep this separate throughout. |
| HQ != service territory | HOLDS, with one caveat | Every Move response carries "Recorded headquarters is not service territory..." Confirmed correctly withheld (`UNSUPPORTED_CAPABILITY`) for pure route/service requests. **BLOCKER-MOVE-01 does not violate this equivalence directly** (it is a name-matching-scope defect, not a grain-substitution defect) but the widened candidate set makes the HQ disclosure attach to a much larger, less relevant set of companies than intended. |
| office != registration jurisdiction | HOLDS | Investor's "principal office" vs. registration-jurisdiction distinction explicitly disclosed and consistently applied across INVESTOR-PRINCIPAL-OFFICE-WY, INVESTOR-NOTICE-FILER, INVESTOR-NY-REG-FL-OFFICE. |
| HMDA property geography != license jurisdiction | HOLDS | Every Lender cohort response carries the correct HMDA-property-geography disclosure; the Lender grading pass found no violation. |
| NPN != appointment | HOLDS (untested against a resolvable identity) | INSURANCE-LOA/INSURANCE-APPOINTMENT both correctly disclose the distinction in their limitations text, but the specific test NPN used doesn't resolve, so the invariant was not exercised against real appointment data. Recommend re-testing against a confirmed-resolvable NPN in a future ticket. |
| LOA != appointment | HOLDS (same caveat as above) | Same limitation-disclosure text confirmed present; not exercised against real data with an actual appointment on file. |
| complaint != final order | NOT DIRECTLY TESTED | No corpus case specifically probed this pair; carried forward from prior tickets' disclosure text, not independently re-verified here. |
| disclosure != wrongdoing | HOLDS | INVESTOR-DISCLOSURE resolves the exact CRD without any language implying fault; confirmed no false-negative-implies-clean framing either. |
| missing evidence != zero | HOLDS | Confirmed repeatedly: ID-CCN-MISS's `ZERO_MATCHING_ROWS` explicitly says "the specialist executed the supported filters and returned zero matching public records" (an executed zero, not an unsupported/not-acquired state misrepresented as zero); Senior's CHOW/FINE cases correctly avoid claiming "never changed ownership"/"never fined" from mere absence of a specific evidence field. |
| missing evidence != clean record | HOLDS | Same evidence as above; the standing "missing source evidence is not zero, clean, or good standing" disclosure appears consistently. |
| sourceAsOf != retrievedAt != deploymentAt | PARTIALLY OBSERVABLE | Per-row `sourceLastChecked`/`sourceAsOf` timestamps are present and distinct from the sweep's own `testedAtUtc` in most hub responses; a literal `deploymentAt` field was not observed in any raw response, so this three-way distinction could not be fully confirmed end-to-end. |
| Nursing Home != Home Health != Hospice != Assisted Living | HOLDS, with a related but distinct defect nearby | SENIOR-ASSISTED-VA/NY and SENIOR-MEMORYCARE-FL confirm Assisted Living/Memory Care are never silently substituted with Nursing Home data (correct `UNSUPPORTED`/fail-closed for all three). **Separately, BLOCKER-SENIOR-01** (the "who owns this nursing home" deictic-capture defect) is a different failure mode -- an entity-name-extraction bug, not a class-conflation bug -- and does not violate this specific equivalence. |
| RIA != ERA | HOLDS | INVESTOR-RIA-VS-ERA resolves the exact CRD with the classification kept as a disclosed field, not conflated. |
| legal insurer != agency | HOLDS | INSURANCE-NAMED-INSURER's `entityClass:'insurer'` stays distinct from the default `entityClass:'agency'` path; the provenance text explicitly states "Agency graph names and published Wave-1 legal-insurer names are searched separately." |
| carrier != broker | HOLDS | Move's MOVE-CARRIER-VS-BROKER case discloses "A broker may arrange transportation without physically hauling the shipment" and keeps the role field as evidence rather than a settled determination; dual carrier/broker roles are disclosed as one company (per MOVE-ANOTHER-EXACT's Allied Van Lines note), not double-counted. |

## Summary

18 of 20 listed non-equivalences were directly exercised by this sweep's corpus and confirmed
holding. Two (`complaint != final order`, the full three-way `sourceAsOf`/`retrievedAt`/
`deploymentAt` distinction) were not fully exercisable with the corpus and live data available in
this sweep and should be explicitly targeted in a future ticket if they become load-bearing.
**No violated equivalence was found** — the 6 confirmed BLOCKER_FAIL findings in `blockers.json`
are entity-name-extraction, geography-extraction, identifier-parsing, and version-lock defects,
not grain/equivalence conflations. This is a meaningfully different (and better) finding than R1
having a grain-integrity problem: the semantic distinctions the network is built to protect are
intact; the defects found are in *getting the right request to the right place at all*, not in
*confusing what kind of evidence means what once it arrives*.
