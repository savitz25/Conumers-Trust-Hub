# TH-SEARCH-R1-018 — Count / False-Zero Audit Rerun

Spec section 22 requires confirming no repair introduced a new false-zero, unscoped-cohort-as-
local-result, broad-Move-result-count-as-identity-match-count, or similar counting defect. This
rerun checks the full 150-case post-fix corpus (`full-r1017-rerun-ask.json`,
`full-r1017-rerun-direct.json`) against each pattern named in the spec.

| Pattern to rule out | R1-017 finding | R1-018 rerun finding |
|---|---|---|
| Incompatible-class total addition (e.g. credentials counted as companies) | Not observed | Not observed. No rerun case sums heterogeneous record types into one total. |
| Credential rows presented/counted as companies | Not observed | Not observed. Insurance's `local_directory_handoff` mode (new in R1-018) returns zero rows and a destination link, never a credential-as-company count. |
| Page-length used as cohort total | Not observed | Not observed. `pagination.total` and `counts[].value` remain distinct fields throughout; no rerun response conflates `pageSize`/`rows.length` with the disclosed total. |
| National count substituted for a state-scoped query | Not observed directly; closest analog (Insurance's 82,071 unscoped total) was a scope-loss defect, not a literal national-for-state substitution | **Resolved.** INSURANCE-ZIP-33441 now returns `total: 0` / `UNSUPPORTED_CAPABILITY` instead of the prior unscoped 82,071 national-agency total. CROSS-NAME-MULTI-HUB, which shared the same underlying unscoped-cohort defect, also now returns `total: 0` / `ZERO_MATCHING_ROWS` rather than 82,071. |
| Unscoped Insurance cohort rendered as a "local" result | This was BLOCKER-INSURANCE-01 itself | **Resolved and re-verified.** Both ZIP- and city-scoped insurance requests in the rerun either resolve to a real identity search (`identity_name` mode, when an entity name is present) or correctly hand off to the local directory (`local_directory_handoff`, when only geography is present) — never silently returned as an unscoped national/agency-wide cohort mislabeled as local. |
| Broad Move name-candidate count presented as an identity-match count | This was the core of BLOCKER-MOVE-01 | **Resolved and re-verified.** MOVE-JK-BARE went from `total: 34` (34 loosely-fuzzy-matched candidates presented as if they were JK Moving matches) to `total: 2` (2 genuine identity-tier matches). The parent-specialist-differential rerun additionally confirms the *direct* move-ask-v1 candidate-browse total (5, intentionally broader, individually disclosed per-row) is never conflated with the parent's tighter identity-match total (2) — the two numbers appear in separate surfaces with separate documented meanings, never combined or substituted for each other. |
| `NOT_ACQUIRED`/`REQUEST_ONLY` states rendered as zero | Not observed (`ID-CCN-MISS` zero was an explicitly-labeled executed zero) | Not observed in rerun. ID-MC-CONFLICT's `ZERO_MATCHING_ROWS` on both surfaces is likewise an executed, disclosed zero for a disputed/under-review MC association (see `identifierIntegrity` block), not a masked `NOT_ACQUIRED` state. |
| A capability-gate false-zero (i.e., a real answer suppressed and reported as zero because a stale check misfired) | This was the shape of BLOCKER-CONTRACTOR-01 | **Resolved and re-verified.** CONTRACTOR-BROWARD-ROOFERS and CONTRACTOR-BROWRD-PARAPHRASE went from `total: 0` / `BACKEND_UNAVAILABLE` (a false zero caused by the stale `contractFingerprint` check) to `total: 924` / `SUPPORTED_RESULTS`, matching the direct specialist. CONTRACTOR-TXGC-PARAPHRASE correctly remains a genuine (non-false) zero-capability case: `UNSUPPORTED_TRADE_CAPABILITY`, a real specialist-side limitation reached only because the false-zero gate was removed. |
| A new false-zero introduced by any of the six repairs themselves | N/A (pre-fix) | **None found.** The full-corpus large-total-drift scan (69 ask-surface cases) flagged exactly the 6 known blocker cases and zero others; no previously-nonzero case dropped to zero, and no previously-PASS case's total changed unexpectedly in either direction. |

## Summary

Every count/false-zero pattern named in the spec was checked against the full post-fix rerun.
Six patterns that were previously violated (the six original blockers) are now confirmed resolved.
No pattern shows a new violation, and the large-total-drift scan independently corroborates that
no case outside the six known blockers experienced any count change at all. `BLOCKER_FAIL = 0`
for this audit category.
