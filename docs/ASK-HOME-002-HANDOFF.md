# ASK-HOME-002 handoff

Implement the Network Intelligence homepage from the accepted, static `ask-network-intel-v1` snapshot in `data/network-intelligence/`. Do not make six runtime database or cross-site requests.

## Contract inputs

- `ask-network-intel-v1.json`: methodology, freshness, limitations, safe aggregates, state-of-record card pointers, evidence-depth groups, refresh and diff policy.
- Six hub manifests: metric grain/source/clock/limitation, publication states, research routes, supported geography and gaps.
- `network-coverage-v1.json`: national and Florida six-hub cells plus forward-compatible jurisdiction keys.
- `network-source-ledger-v1.json`: deterministic definitions and traceable public sources.
- `fingerprints-v1.json`: SHA-256 over recursively key-sorted canonical JSON.

## Rendering rules

1. Render six separate state-of-record cards. Never sum unlike entities or publication cohorts.
2. Resolve each headline metric by `hub` + `metric_id`; show its grain in plain language and offer “Trace this number.”
3. Trace exposes source family, source contract, scope, source as-of, retrieval date, limitation, and calculation when derived.
4. Show per-source clocks. Contract generation time is not source freshness.
5. Florida cells display structured level (`NATIONAL_SPINE`, `STATE_VERIFY`, or `STATE_ENHANCED`) and source-native limitations; a route alone is not completeness.
6. Evidence Depth shows contributing hubs without implying uniform evidence.
7. Keep examination/enforcement, complaint/violation, credential/endorsement, HQ/service territory, and RAUM/performance distinctions.
8. Do not render a universal Trust Score, recommendation ranking, paid boost, or cross-hub “providers” total.

## Suggested homepage sections

Search the Network; State of the Trust Hub Network; What the Data Says; Evidence Depth; six research pathways; Geography Coverage; Methodology; Source Ledger; Freshness; Limitations; Trace This Number; What Changed.

## Loading and failure behavior

Import the checked-in JSON during build/SSR and validate before rendering. A bad candidate snapshot must fail CI and must not replace the last accepted snapshot. Future refreshes should generate candidates at release time, validate all six hubs, compare fingerprints and semantic diffs, then accept atomically. No scheduler is authorized by ASK-HOME-001.

## Diff semantics

Support count, source-clock, coverage, evidence-family, route, and publication changes. Describe the fact of a change only; do not infer its cause.

