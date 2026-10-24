# ENB-001 — Accepted-extract baseline persistence

**Scope:** the six specialist publications AskTrustHub consumes (`lib/network-metrics/sources.ts`,
`SPECIALIST_SOURCES`). **Owner job:** `.github/workflows/specialist-network-health.yml` (daily 13:17 UTC).
**Status after this ticket:** the daily report can distinguish *source endpoint alive* from *accepted extract
actually changed*. Nothing in the scheduled path writes the baseline.

## Root gap

Before ENB-001 the daily job persisted only each hub's upstream-declared `sourceFingerprint` (pinned in
`FALLBACK_SPECIALIST_FINGERPRINTS`). That fingerprint moves whenever a specialist regenerates — including for
clock-only rebuilds — and it carries no record counts, no source clocks and no content hash of our own. So the
report could say "upstream reachable and schema-compatible" and "fingerprint differs from the bundled fallback",
but not *what* changed, nor whether the accepted extract's content had changed at all.

## Accepted-extract identity rule

One baseline entry per hub (`data/network-metrics/accepted-extract-baseline-v1.json`, schema
`accepted-extract-baseline-v1`, parser `ath-accepted-extract-parser-v1`):

| Block | Fields | Meaning |
|---|---|---|
| `identity` | `publicationUrl`, `schemaVersion` | Which source, which schema family. Changing either is `SOURCE_IDENTITY_CHANGED`. |
| `content` | `contentHash` | sha256 over the canonical (key-sorted) payload with **every clock-valued key removed** and the upstream identity keys (`schemaVersion`, `sourceFingerprint`, `contractRevision`) excluded. |
| | `metrics[]` = `{key, grain, unit, value}` sorted by key; `metricCount` | Record counts at the publication's own declared grain. Any value/grain/add/remove is `RECORD_COUNT_CHANGED`. |
| | `contractRevision` | Upstream generator/contract version — `PARSER_VERSION_CHANGED`. |
| | `sourceFingerprint` | Upstream-declared provenance, tracked but **not** part of our content identity. A fingerprint change with an unchanged `contentHash` is informational (`UPSTREAM_FINGERPRINT_CHANGED`). |
| `clocks` | `generatedAt`, `newestSourceAsOf`, `clockHash`, `clockLeafCount`, `metricSourceAsOf[]` | Retrieval / source clocks. A change here alone is `SOURCE_CLOCK_CHANGED` and is **not** content drift. |
| `acceptance` | `state` (`ACCEPTED` \| `NOT_AVAILABLE`), `acceptedFrom`, `acceptedAt`, `note` | Provenance. `NOT_AVAILABLE` entries carry `content: null` — never a fabricated hash or a zero count. |

A key is a clock when it ends in `At`, `AsOf`, `Date`, `Timestamp`, `Clock` (or the snake-case equivalents), or is
`asOf`/`as_of`, **and** its value is a string or null. Numeric counters that merely end in `Date` stay in the content.

## Drift categories

`NO_CHANGE`, `CONTENT_HASH_CHANGED`, `RECORD_COUNT_CHANGED`, `SOURCE_CLOCK_CHANGED`, `PARSER_VERSION_CHANGED`
(baseline parser version differs from the code, or upstream `contractRevision` changed), `SOURCE_IDENTITY_CHANGED`,
`SOURCE_MISSING` (fetch failed / not JSON / failed `validate.ts`), `BASELINE_MISSING` (no entry, or entry
`NOT_AVAILABLE`), `UNKNOWN` (malformed baseline or comparator error), plus informational
`UPSTREAM_FINGERPRINT_CHANGED`. Each entry reports every applicable category and a `primary` chosen by severity
(missing > identity > parser > count > content > clock > fingerprint > none). Only identity/parser/count/content
count as `contentDrift`.

Overall: `MISSING_BASELINE` (file absent or malformed) › `DRIFT` (any content drift) › `INCOMPLETE_BASELINE`
(some hub has no accepted entry) › `SOURCE_UNAVAILABLE` (nothing drifted but a source could not be read) › `SAME`
(clock-only changes are listed but do not change the verdict).

## Commands

```
npm run metrics:check-accepted-baseline              # --check --from=upstream (read-only; used by the daily job)
node --experimental-strip-types scripts/accepted-extract-baseline.mjs --check --from=bundled [--json] [--strict]
npm run metrics:propose-accepted-baseline            # --propose --from=bundled → *.proposal.json (accepted file untouched)
node --experimental-strip-types scripts/accepted-extract-baseline.mjs --replace --from=bundled --confirm=REPLACE-ACCEPTED-EXTRACT-BASELINE
```

Lifecycle: compute candidate → compare to accepted → report `SAME` / `DRIFT` / `MISSING_BASELINE` … → a replacement
is produced only by the explicit `--replace --confirm=…` command on a branch and lands through a normal reviewed
PR. No npm script and no workflow step runs `--replace`; the workflow keeps `contents: read`.

## Initial baseline

Generated from the already-accepted bundled fallback snapshots (`--from=bundled`), i.e. the same extracts pinned by
`FALLBACK_SPECIALIST_FINGERPRINTS`. No source was downloaded to populate it. Coverage: 6 / 6 hubs `ACCEPTED`.

## Out of scope (unchanged by this ticket)

INC-001 (registry clock), source policy, registry clocks, fallback refresh policy (ATH-METRICS-R2-06), and any
Production data.
