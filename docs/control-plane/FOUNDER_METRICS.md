# Founder Control Center V1 metrics

Status: ATH-ADMIN-003 contract. Storage and calculations use UTC. `TODAY` begins at 00:00 UTC; other windows are rolling 7- and 30-day windows. UI timestamps are displayed in UTC so every card uses one reporting clock.

Every metric reports `LIVE`, `NOT_INSTRUMENTED`, `UNAVAILABLE`, `DEGRADED`, or `STALE`. A `LIVE` zero means the source and instrumentation epoch cover the selected window and zero observations were found. Missing instrumentation never becomes zero.

| Metric | Business question | Definition / numerator / denominator | Authority and filters | Limits and status |
|---|---|---|---|---|
| Research sessions | How many distinct research sessions occurred? | Distinct session-boundary observations | Future `product_event.v1`; window | `NOT_INSTRUMENTED`: no session-boundary contract exists. |
| Search RESULTS rate | Did Search return source-backed results? | `RESULTS` / all terminal Search outcomes | `ath_product_events`; window, Hub, jurisdiction, intent | `LIVE` only from the Migration 012 epoch. HTTP 200 is not success. |
| Effective handled rate | Did Search give results or the correct clarification? | Reserved: (`RESULTS` + validated appropriate `CLARIFICATION`) / all outcomes | Requires ADMIN-007 canary classification | Not displayed in V1; clarification is shown separately rather than assumed successful. |
| Search dead-end rate | Where did Search stop without a defensible action? | `FAIL_CLOSED_DEAD_END` / all terminal outcomes | `ath_product_events`; window and Search filters | Kept separate from fail-closed-with-action. |
| Search ERROR rate | Is execution failing technically? | `ERROR` / all terminal outcomes | `ath_product_events`; window and Search filters | Client/Vercel analytics remains parallel but is not the first-party denominator. |
| Search latency | How long does terminal execution take? | p50/p95 `duration_ms` where present | `ath_product_events`; same Search filters | p95 should be interpreted only with an adequate sample; V1 retains values in the read model even when not promoted to a top card. |
| Save → Watch | Do consumers turn saved research into monitoring? | Consumers with Watch after Save / consumers with Save | Specialist consumer stores | `UNAVAILABLE`: no unified network store. |
| Activated consumers | Are persisted researchers returning? | Authenticated identity + Project containing Save/Watch/tool or active Watch + return session | Future unified consumer contract | `UNAVAILABLE`. |
| Alert → return | Do alerts produce a research return? | Alert recipients returning / delivered alerts | Specialist monitoring + future network session attribution | `UNAVAILABLE`. |
| Claim CTA → start | Does claim interest become a durable claim? | Unique claims created / first-party CTA observations in the same window | CTA `product_event.v1` + `ath_claims`; Hub/jurisdiction when both grains support them | Before the first-party CTA epoch, `NOT_INSTRUMENTED`; events never create claims. |
| Claim completion | Do started claims reach a terminal status? | Claims created in window now in approved/rejected/withdrawn/superseded / claims created in window | `ath_claims` | Durable operational truth. Retries that return the same claim do not create another row. |
| Pending claims / age | What requires review? | Current submitted, needs-info, in-review claims; oldest elapsed age | `ath_claims` | Age is an internal operating signal, not a public SLA. |
| Activated organizations | Do approved businesses take meaningful action? | Approved management grant + Business Manager opened + qualifying post-claim action | `ath_management_grants`, `product_event.v1`, `ath_audit_events` | `NOT_INSTRUMENTED`: Manager-open observations cannot yet be safely joined to an organization. Grant or page load alone is not activation. |
| 30-day active organizations | Do activated businesses continue using the product? | Activated organization with a qualifying action in its following 30-day window | Same activation sources | `NOT_INSTRUMENTED` until Activated Business linkage exists. |

Qualifying business actions remain: business-supplied profile update/reconfirmation, team invitation, correction/record issue, business response, monitoring enablement, or meaningful insight use. Registration, claim approval, or Manager page load alone is never activation.

## Needs Attention

V1 may emit `SEARCH_ERROR_SPIKE`, `SEARCH_DEAD_END_SPIKE`, `CLAIM_VALIDATION_FAILURE_CLUSTER`, and `PENDING_CLAIM_AGE` from current sources. Pending age uses a 72-hour internal display threshold and makes no public response-time promise. Source/Watch/publication blast-radius incidents remain ADMIN-006 work.

## Growth opportunities

V1 keeps opportunities separate: incomplete claim cohorts and sufficiently sized clarification cohorts. It does not expose consumer identity, profile-level interest, Saves, or Watch membership. Campaign dimensions are retained for ADMIN-005 but do not grant authority.
