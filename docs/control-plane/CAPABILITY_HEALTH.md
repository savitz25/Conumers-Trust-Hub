# Capability Health V1

`capability_health.v1` is additive to the frozen ADMIN-001 contracts. It records bounded metadata about one meaningful capability; it is not Layer A evidence. States are `CURRENT`, `DELAYED`, `DEGRADED`, and `UNKNOWN`. UNKNOWN is neither healthy nor zero.

The registry is typed in `lib/control-plane/capability-registry.ts`. Cadence is capability-specific. Unknown cadence remains UNKNOWN; request-only and static sources are not declared stale on a fabricated daily clock. A successful check with zero changes is CURRENT. A failed check, incompatible contract, or deterministic impairment cannot support “nothing changed.”

Clock labels are literal: source-as-of is the source's applicability clock; retrieved-at is Trust Hub fetch time; snapshot-as-of is represented vintage; accepted-at is trusted-pipeline acceptance; generated-at is artifact build; published-at is publication; detected-at and received-at remain monitoring-event clocks. Missing clocks are null/UNKNOWN and are never relabeled.

Detailed observations are recommended for 90-day retention. Automatic deletion is not enabled in ADMIN-006. Incident/resolution history may outlive raw observations.
