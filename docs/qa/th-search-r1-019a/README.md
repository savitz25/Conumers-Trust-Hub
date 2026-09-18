# TH-SEARCH-R1-019A — Results-First Name Discovery (first milestone)

Status: **READY_FOR_ASTRA_REVIEW**. Pre-merge evidence only. Not merged, not deployed, not a
production receipt, not ALL_SIX_COMPLETE, not SEARCH_RELIABILITY_R1_COMPLETE.

- Baseline: `origin/main` @ `4372073` (no prior R1-019 branch, worktree, PR or AGENTS.md existed).
- Branch: `th-search-r1-019a-name-candidates`.
- The "Ask Search Zero-Results Fix Plan" and R1-019 addenda were not present on the build machine;
  this work follows the coordinator's R1-019A specification text. Historical observations in it were
  treated as leads and re-reproduced against today's code and live hubs.
- The open R1-018 final certification (PR #150, head `2e22765`) predates this work and does not
  cover the unscoped name-discovery family. It was not modified.

## What changed

An unscoped business/provider name typed into Ask is searched across the network first — no hub
selection, identifier, title case, legal suffix or repeated name required.

| Piece | File |
|---|---|
| Common candidate + coverage contract | `lib/network/name-candidates/contract.ts` |
| ONE authoritative name decision (page, name API, guided API all consult it) | `lib/network/name-candidates/decision.ts` |
| Hub adapters over already-deployed structured name operations | `lib/network/name-candidates/adapters.ts` |
| Bounded fan-out, deadline, single transient retry, coverage, ordering | `lib/network/name-candidates/orchestrator.ts` |
| Pure view-model + results-first client component | `lib/network/name-candidates/view.ts`, `components/name-candidate-results.tsx` |
| Explicit-submit / View-more API (server re-derives the decision) | `app/api/name-candidates/route.ts` |
| Privacy-safe outcome telemetry (no names, identifiers or URLs) | `lib/network/name-candidates/telemetry.ts` |
| Hypothetical five-Allied fixture (never servable in production) | `lib/network/name-candidates/fixtures.ts` |

The existing planner was not rewritten. Identifiers, cohort discovery, definitions/how-to,
comparisons, journeys, care tasks and deictic missing subjects keep their existing paths (test 10).

## Six-hub adapter / source-permission matrix

| Hub | State | Operation actually called | Proof the name filter ran | Notes |
|---|---|---|---|---|
| Move | **Enabled** | `GET /api/network/identity-resolver` (`move-network-resolver-v1`, version + schema + contract fingerprints pinned) | hub echoes `normalizedQuery` | Same engine as the native search box (`searchMovers` → `matchCompanyIdentity`). Per-row hub `matchClass`. |
| Investor | **Enabled** | `POST /api/specialist-execution/v2` `queryType:"identity"` | `appliedFilters.identityName` | Hub matching is "name contains". Research-row-only firms link to the hub-supplied SEC/IARD URL. |
| Insurance | **Enabled** | same v2 `identity` | `queryInterpretation.interpretation["Requested name"]` | Organizations only — producer (person) rows are never admitted. Hub caps at 10 with no cursor → disclosed as `10+` with a hub continuation. |
| Lender | **Enabled (exact-name only)** | same v2 `identity` | `queryInterpretation.identityName` | Hub engine is `exact_public_or_historical_name` over a controlled public corpus. See dependency L1. |
| Senior | **Enabled (when the hub confirms name mode)** | `GET /api/ask` (`senior-ask-v1` JSON — the native engine) | `query.mode === "entity"` and echoed `identityQuery` | Free-text endpoint: if it reads the text as a care category it is reported UNSUPPORTED, never a miss. See dependency S1. |
| Contractor | **Blocked — dependency C1** | — | — | v2 declares `queryType:"identity"` but rejects every name field (`unsupported_field`). |

No publication policy was expanded. Every displayed field is one the hub's own public structured
contract already returns. No policy decision is outstanding for this milestone.

### Dependencies (owners: the respective specialist repos — not edited here)

- **C1 Contractor** — thin v2 wrapper exposing `identityName` over the existing `searchContractors()`
  engine that already powers `/verify`. Until then Ask shows a Verify continuation and reports
  Contractor as "not included", never as a miss.
- **L1 Lender** — identity op matches exact accepted names only; candidate (prefix/token) matching
  and legal-suffix tolerance are needed for parity with the other hubs.
- **S1 Senior** — a structured name parameter so provider names containing care/place words
  ("Deerbrook Skilled Nursing and Rehab Center", "FFIII Houston SNF Tenant LLC",
  "A Holly Patterson Extended Care Facility", one-word "Allied") are searched as names.
- **I1 Insurance** — hub `selectionUrl` values contain literal `state=undefined&loa=undefined`
  params that break the hub's own page. Ask drops only those params from the hub-supplied URL
  (verified to load the hub's "server-revalidated selected source identity" page).
- Native parity: Move and Senior adapters call the same hub-owned operation as the native site.
  Native search-box parity for Investor/Insurance/Lender was not separately verified.

## Evidence

Baseline (starting commit, `baseline-planner.json`): `Allied`, `allied`, `Cirta`, `1-800-Pack-Rat`,
`10 East Partners` → CLARIFICATION with no hub; `Allied Van Lines`, `Abbey Delray South`,
`Tate Asset Management` recognized as names but blocked because the hub was unknown;
`Allied Moving` silently Moving-only; `Pure Moving Company` and `A Holly Patterson Extended Care
Facility` forced into category questionnaires.

Live (real hubs, `live-smoke.json`): `Allied` → 17 candidates (Move 1, Insurance 10+, Investor 6)
in 1.9 s with 5 calls. Found: Allied Van Lines (USDOT 76235), Cirta Moving LLC, Pure Moving
Company, 1-800-Pack-Rat, Abbey Delray South (CCN 105411), Tate Asset Management (CRD 160657),
Rocket Mortgage (NMLS 3030). A nonexistent name is a completed miss, not an error.

Gate: `npm run check:th-search-r1-019a` → 24/24 new + 136/136 existing R1-018 regressions.
Also green: `check:th-search-r1-016` 149/149, `check:th-arch-p0-001` 17/17, `check:ath-obs-001`,
`check:ath-metrics-001c`, `npm test`, `tsc --noEmit`, `next build`. ESLint: 0 errors (4 warnings in
files untouched by this branch).

Mutations (`mutation-report.json`): restored hub-required gate, dropped name-filter guard, and
silent omission of a responding hub are each DETECTED; tree restores byte-for-byte to 24/0.

Frozen holdout (`holdout-frozen.json`, 20 eligible records per enabled hub drawn at fixed
scope/page/row positions from each hub's own cohort operation before any matching was evaluated).
Diagnostic small sample — no statistical claim. Displayed-name recall on the candidate code:

| Hub | Displayed | Lowercase | Redundant clarifications | Notes |
|---|---|---|---|---|
| Move | 20/20 | 20/20 | 0 | one presentation variant (`C&L Movers`) is beyond the hub's first page → disclosed as partial |
| Investor | 20/20 | 20/20 | 0 | |
| Insurance | 20/20 (run 2); 17/20 (run 3) | same | 0 | run 3 had 9 transient hub timeouts at the 7 s limit, all surfaced as failures, never as misses; each succeeded on retry in ~1.5 s |
| Senior | 18/20 | 18/20 | 0 | both misses are dependency S1 (hub reports UNSUPPORTED) |
| Lender | 5/20 (6/20 by name) | 5/20 | 0 | dependency L1; the only enumerable Lender operation (HMDA LEI cohort) is a different grain than the identity corpus |

The holdout found and drove fixes for: a false name-echo failure on apostrophe names, category-word
padding (`C&L Movers LLC` → "Call The Movers"), 11 redundant clarifications for organization-shaped
names the planner read as a journey/care task/place, and a false failure on padding-only pages.
Every remaining miss is listed in `holdout-results.json`.

Browser (optimized `next build` + `next start`, real Chrome): fixture `Allied` via the real form →
6 cards in 4 hub groups, no hub selection, no repeat-name field, distractors absent; Moving chip →
the 2 Move records with the query kept; Back → all 6. Live `allied` → 17 real records; View more
5→10. True 390 px and 320 px viewports: no horizontal overflow, single column, 44 px controls.
API: revision echoed, scoped search = 1 call, identifiers/cohorts/deictic refused (422),
user-supplied URL/SQL fields rejected (400), guided START defers bare names (409).
Not exercised in a browser: a genuine in-flight stale "View more" race (no live hub currently
offers a second page for a tested name); it is covered by the revision-echo contract test.

## Budgets

Explicit submit only. One call per in-scope enabled hub (max 5); at most one retry per hub, only for
transient read failures, only with ≥2.5 s of budget left. Per-hub 7 s, overall 9 s — chosen from
bounded smoke observations (0.1–3.5 s typical), not a p95.

## Rollback

Revert this branch's commits. No schema, data, publication or specialist-repo change exists to undo.
