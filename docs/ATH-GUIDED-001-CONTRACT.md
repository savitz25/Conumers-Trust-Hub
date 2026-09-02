# ATH-GUIDED-001 — Guided Research contract

## Contract and scope

ask-guided-research-session-v1 is the ephemeral Ask-facing orchestration contract for the SeniorTrustHub, ContractorTrustHub, and MoveTrustHub pilot. Insurance, Lender, and Investor retain their accepted Federated Ask behavior.

The universal classifier remains authoritative. Guided Research collects missing slots and executes specialists; it does not replace identity resolution, query classification, or specialist evidence.

## Session and phases

The session carries a version, random session ID, original question, phase, universal query type, pilot hub, source-native class/trade/role, identifier or identity name, recorded geography, selected filters, missing fields, action choices, returned refinements, bounded history, timestamps, and result count. Each history entry is a deep-copied, nonrecursive snapshot derived from the session type; it includes every mutable consumer-visible and execution field while excluding identity, immutable question, timestamps, and history itself.

The browser uses sessionStorage under a query-derived key. Sessions expire after 30 minutes. No evidence rows are stored. The server validates version, phase, hub, action, choice, geography, filters, and expiry on every request.

Phases are UNDERSTAND, CLARIFY, COLLECT, EXECUTE, REFINE, DEEP_LINK, and ERROR_RECOVERY. Complete supported queries move directly to EXECUTE. Back restores a bounded prior snapshot. Changing class, trade, or mode clears dependent state.

## Actions and orchestration

Actions are START, RESUME, SELECT_CHOICE, SET_GEOGRAPHY, SET_FILTER, CLEAR_FILTER, CLEAR_ALL_FILTERS, BACK, RESET, and EXECUTE. RESUME returns an incomplete session to its current focused question and re-executes evidence only for a prior result/recovery phase. BACK restores a complete snapshot and re-executes only when the restored state bears results. Refinement fields and values are checked against server-owned, class-specific capability allowlists and the last advertised specialist refinements. Choices are actions rather than navigation links.

POST /api/guided-research accepts the session and one action. The server calls at most one selected specialist. Evidence-producing actions re-execute the specialist; client rows are never trusted. Timeout is five seconds.

Normalized states remain distinct: SUPPORTED_RESULTS, ZERO_MATCHING_ROWS, UNSUPPORTED_CAPABILITY, INVALID_QUERY, BACKEND_UNAVAILABLE, and TIMEOUT.

## Pilot scope

- Senior: life situations, Nursing Home, Home Health, Hospice, current CMS CCN, supported geography and class-native ratings.
- Contractor: consumer-labeled Roofing, Air conditioning / HVAC, Plumbing, Electrical, General / building construction, Pool / spa, Mechanical, and Other / I’m not sure choices; supported Florida DBPR execution; credential status; supported county mapping; and the exact electrical-source limitation. Electrical remains selectable because coverage is jurisdiction-specific. The Other path uses bounded deterministic mapping and explicit confirmation, never an LLM trade guess.
- Contractor state integrity: Ask sends the validated consumer state instead of substituting Florida, and a generic contractor class never implies the General trade. Unsupported state execution remains distinct from invalid geography and zero matching rows. If a specialist supports statewide but not local execution, Ask may offer an explicit statewide action without claiming county or service-area coverage. Geography conflicts return to clarification: Summit is a city in Union County, New Jersey, so “Summit County, New Jersey” is never silently accepted.
- Contractor V2.1 capability ownership: New Jersey class choices come from the locked Contractor response, not Ask's Florida menu. Ask preserves `CLARIFICATION_REQUIRED`, `INVALID_GEOGRAPHY`, `UNSUPPORTED_TRADE_CAPABILITY`, publication/backend/timeout states before inspecting rows. Statewide broadening requires the source-owned confirmation action. Public rows retain source-native class, board, clock, geography and destination; null public destinations stay null.
- Result-bearing clarification resume: session storage retains only a typed, non-row `lastExecution` marker. `RESUME` and `BACK` re-execute specialist-generated clarification states so limitations and choices are reconstructed from the source; local care/trade/move clarification remains zero-call. Rows and explanations are never trusted from session storage.
- Contractor geography: a New Jersey credential cohort describes credential jurisdiction, not physical headquarters or service territory. Cards display credential jurisdiction separately from the source-recorded address, including publication-safe registrants whose recorded address is outside New Jersey.
- Move: household mover and Auto Transport cohorts, recorded-HQ state, role, USDOT/MC, company identity, and service-territory fail-closed behavior.

## Privacy and recovery

No Redis, database table, Supabase write, permanent anonymous history, lead capture, or raw-query analytics was added. Diagnostics contain request ID, hub, phase, result state, latency, count, and specialist-call count—not raw narratives.

Malformed, expired, or incompatible sessions restart from the original URL query. Timeout and backend failure never become no-match. Unsupported capability never becomes zero-match.

## Refinements and destinations

Only specialist-returned or contract-declared source-native refinements appear. No ranking, price, reputation, paid, claimed, or subscription refinement exists.

Only specialist-returned HTTPS profile, directory, Verify, state, or county destinations are rendered. Ask does not invent paths or fragment anchors.

## Safe analytics vocabulary

Reserved events for a future established analytics system: guided_started, clarification_shown, clarification_selected, first_useful_result, refinement_used, specialist_deep_link, guided_reset, unsupported_capability, specialist_unavailable.

No tracking platform is added. Raw questions and personal narratives are prohibited event properties.

## Future persistence

Any future authenticated saving must persist explicit user-selected structured plans and destinations—not anonymous raw narratives or trusted copies of evidence rows. It requires a separate privacy and retention contract.
