# Network Data Operations

`/admin/data` is the local, asynchronous health read model. `ADMIN_VIEW` permits viewing; incident acknowledgement/recheck/resolution requires `DATA_OPS`. Operators cannot mark a capability healthy: CURRENT is derived from observations, and resolution is blocked until the latest observation proves recovery.

## Specialist audit (origin/main, 2026-09-09)

| Hub | SHA | Deterministic assets | Control Plane adapter |
|---|---|---|---|
| Ask | `1ab7f213a0b360e676cbc64179896534f7bd3206` | monitoring cursor, events, notifications, deliveries | Ask database read model |
| Contractor | `58d6b4de6b36d725e1fd9f25053cb0e44ed565d8` | DBPR adapters, source observations, publication gates, signed monitoring feed | signed event feed; health heartbeat in Ask |
| Move | `ba72d609a013ed9d432975276f62c85d3e237492` | FMCSA/BBB refresh, state accepted snapshots and publication gates | not instrumented; UNKNOWN |
| Lender | `964faacdb780d0421f7a404c6f9daecaf0af17d3` | NMLS/HMDA/CFPB data, HMDA manifest, publication holds | not instrumented; UNKNOWN |
| Insurance | `fca65060a9d8c27eae5ab70626ead0716a212dd5` | NAIC/state ingestion, inventory health, publication gates | not safely machine-authenticated for Ask; UNKNOWN |
| Senior | `e893c7cf86e210741fa39895cf1dd6590c385675` | CMS/state registries, ingestion manifests, class-aware publication | not instrumented; UNKNOWN |
| Investor | `874c8d039589021d2989db4b75c6e74524bb3961` | SEC ADV archive/checksums, public snapshots, indexability reports | not instrumented; UNKNOWN |

No specialist repository is modified. Existing HTML health pages are not scraped. Later adapters should prefer signed bounded metadata and reuse scoped machine trust, never one omnipotent network secret.

Incidents use P0–P3, stable capability-plus-reason deduplication, and append-only events. P0 is reserved for network-critical evidence outage; unknown optional instrumentation does not become P0. Data incidents remain separate from growth opportunities. No publication/source/watch control flag or destructive command is connected.

Collection is asynchronous. ADMIN-006 extends the existing daily Contractor monitoring cron; a future dedicated 15–60 minute collector can collect newly signed adapters while respecting each source's own cadence. Health failures fail open for public Search, profiles, claims and Business Manager.
