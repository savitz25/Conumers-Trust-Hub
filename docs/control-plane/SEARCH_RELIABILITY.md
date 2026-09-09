# Search Reliability Control Plane

ATH-ADMIN-007 separates real-user telemetry (`ath_product_events`) from synthetic reliability evidence (`ath_search_canary_runs`). Synthetic probes call the same checked-in planner, scope, destination, and Guided orchestration code as product Search, but the runner never invokes product-event persistence. Search code receives no canary key and contains no canary-specific behavior.

`SEARCH_CANARY_SUITE_VERSION` is `search-canary-suite.v1`. Material expectation changes require a visible version increment, rationale, and test update. The six frozen regression seeds remain mandatory. Raw questions live only in the reviewed registry and tests; the database stores only canary keys, bounded outcomes/assertion codes, dependency state, latency, and normalized SHA-256 fingerprints. Raw responses are never stored.

## Suites and schedule

- QUICK: highest-value deterministic safety probes, hourly at minute 23.
- FULL: all enabled probes, selected by the same cron every sixth UTC hour.
- RELEASE: all blocker probes plus exact serving-build identity, invoked for controlled release proof.

The runner uses a transaction-scoped advisory lock, a five-minute manual-run limit, bounded per-suite work, and no unbounded retries. Manual execution requires `DATA_OPS`; `ADMIN_VIEW` can read `/admin/search`. Cron uses the existing Authorization bearer convention with `CRON_SECRET`.

Presentation browser canaries are `NOT_INSTRUMENTED` in V1. The runner validates the UI data contract but does not mislabel API assertions as browser rendering proof. Concierge remains outside blocker comparison because generative prose is nondeterministic.

## Gates and dependency policy

Release states are `READY`, `WARN`, `BLOCKED`, and `UNKNOWN`. Evidence is build-specific and expires after six hours. A new or mismatched build is never approved by old evidence. Deployment identity mismatch, routing/grain regressions, unintended broad results, missing required provenance, unsafe destinations, malformed responses, and critical fail-closed regressions block.

An exact-result miss may be `DEPENDENCY_BLOCKED` when its declared ADMIN-006 capability is DEGRADED or UNKNOWN. Routing safety, identity-grain, destination, and broad-dump failures are never excused by dependency health. Dependency blocks produce WARN rather than a false Search-code failure where the safety contract remains intact.

Incidents deduplicate by canary plus bounded failure code. One blocker failure is SUSPECT; two consecutive failures open P1. Recovery requires two fresh passes before RECOVERABLE. Operators cannot force PASS. Automatic rollback and the `SEARCH_FEATURE_DISABLED` flag remain unconnected.

## Retention and privacy

Detailed canary runs should be retained for 90 days; release evaluations and incident history may be retained longer. Automatic deletion is deferred. No question, response body, consumer identity, token, email, secret, claim, business activity, or Layer A record enters the canary store.
