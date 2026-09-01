# ATH-GUIDED-001 — Guided Research contract

## Contract and scope

ask-guided-research-session-v1 is the ephemeral Ask-facing orchestration contract for the SeniorTrustHub, ContractorTrustHub, and MoveTrustHub pilot. Insurance, Lender, and Investor retain their accepted Federated Ask behavior.

The universal classifier remains authoritative. Guided Research collects missing slots and executes specialists; it does not replace identity resolution, query classification, or specialist evidence.

## Session and phases

The session carries a version, random session ID, original question, phase, universal query type, pilot hub, source-native class/trade/role, identifier or identity name, recorded geography, selected filters, missing fields, action choices, returned refinements, bounded history, timestamps, and result count.

The browser uses sessionStorage under a query-derived key. Sessions expire after 30 minutes. No evidence rows are stored. The server validates version, phase, hub, action, choice, geography, filters, and expiry on every request.

Phases are UNDERSTAND, CLARIFY, COLLECT, EXECUTE, REFINE, DEEP_LINK, and ERROR_RECOVERY. Complete supported queries move directly to EXECUTE. Back restores a bounded prior snapshot. Changing class, trade, or mode clears dependent state.

## Actions and orchestration

Actions are START, RESUME, SELECT_CHOICE, SET_GEOGRAPHY, SET_FILTER, CLEAR_FILTER, BACK, RESET, and EXECUTE. RESUME returns an incomplete session to its current focused question and re-executes evidence only for a prior result/recovery phase. Choices are actions rather than navigation links.

POST /api/guided-research accepts the session and one action. The server calls at most one selected specialist. Evidence-producing actions re-execute the specialist; client rows are never trusted. Timeout is five seconds.

Normalized states remain distinct: SUPPORTED_RESULTS, ZERO_MATCHING_ROWS, UNSUPPORTED_CAPABILITY, INVALID_QUERY, BACKEND_UNAVAILABLE, and TIMEOUT.

## Pilot scope

- Senior: life situations, Nursing Home, Home Health, Hospice, current CMS CCN, supported geography and class-native ratings.
- Contractor: supported Florida DBPR construction trades, credential status, supported county mapping, and the exact electrical-source limitation.
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
