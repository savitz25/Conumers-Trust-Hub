# ASK-HOME-001 — state-of-the-record audit

Status: pre-implementation audit, 2026-08-31. This artifact records the accepted inputs used to build `ask-network-intel-v1`; specialist source artifacts and production state remain authoritative.

## Release baseline

- Ask accepted main and Production: `e13d59e08b0949bd9d4b4f1503df9e31e3a04afe`.
- Isolated branch: `ask-home-001-network-intel`.
- Pre-change gates: `check:ath-search-002` 84/84, `check:ath-search-001` 77/77, `check:ath-cust-009` 40/40.
- Existing `/`, `/ask`, `/manage`, claim, authentication, search, Concierge, and customer implementation are locked. This task does not mount a new homepage presentation.

## Canonical specialist repositories

| Hub | Repository | Accepted main | Primary accepted audit input |
|---|---|---|---|
| Move | `savitz25/Move-trust-Hub` | `34113ce1c35333b802a31c4a4fc693083fce4afd` | `artifacts/move-profile-001/census.json` |
| Lender | `savitz25/lender-trust-hub` | `3f859953bd6962ff85db26735a3b93f47904c270` | `lib/home-intel/accepted-snapshot.json`, Florida accepted snapshot |
| Insurance | `savitz25/Insurance-trust-hub` | `a758a34812dc47a119156ce12d3be74cd8552e0b` | `data/reports/fl-ins-006-*.json` |
| Senior | `savitz25/care-trust-hub` | `b8204392deb42074cdb4beffcea50c94f7880270` | CMS contracts and `docs/task-021b-coverage.json` |
| Contractor | `savitz25/contractor-trust-hub` | `c82f3494a28f4511c8a7b36cb456eb9b511bf51e` | `data/home/contractor-hub-intel-v2.json` |
| Investor | `savitz25/investor-trust-hub` | `44f531f81d5912bbc831439f5500bc48a9bf5d15` | `docs/inv-home-001-census.json` and audit |

## Reconciled grains

- Move: 5,022 published mover identities. Role counts and authority observations describe that publication cohort. Recorded headquarters is not service territory.
- Lender: 14,623 canonical institutions, 6,682 branch entities, and 135,230 person/MLO entities are separate grains. The file-backed public render cohort (181), index cohort (180), and Florida public cohort (130) are also separate. HMDA applications/originations and CFPB complaints are observations, not institutions.
- Insurance: 82,071 canonical agencies, 1,029,860 canonical persons, 6,185 legal insurers, credentials, appointments, and CMS observations are different populations. Bail-only rows remain excluded from a consumer-agency claim. Public legal-insurer and person profile counts are zero in the accepted snapshot.
- Senior: Nursing Home, Home Health, and Hospice remain separate CMS provider classes. State assisted-living work in CA/NY/TX is a distinct state-regulatory cohort and is not added to the CMS classes.
- Contractor: 644,421 public live credential records across 10 states, of which 499,997 are active/current. Credentials are not contractor entities; 1,392,730 research-graph identity rows are not current public coverage. Recorded address/county is not service territory.
- Investor: the current SEC/IARD roster is 23,622 firms: 17,018 RIA facts and 6,604 ERA facts. An additional 2,155 canonical firms are excluded from that roster. The 1,000 indexable Trust Reports are the public profile cohort. RAUM is filer-reported RIA evidence, not performance.

## Current Ask homepage claim audit

| Current claim/input | Classification | Finding / ASK-HOME-002 treatment |
|---|---|---|
| 5,022 published Move profiles | `VALID_CURRENT` | Retain only with published mover identity grain and trace. |
| 4,227 Move carriers | `VALID_CURRENT` | Cohort subtype, not an additional entity total. |
| 180 Lender profiles | `NEEDS_RELABELING` | Accepted snapshot distinguishes 181 renderable, 180 indexable, and 130 Florida-public records. |
| 23,622 SEC/IARD firms | `VALID_CURRENT` | RIA+ERA roster only; do not add the 2,155 extra canonical firms. |
| 17,018 RIA / 6,604 ERA | `VALID_CURRENT` | Separate regulatory classes; ERA is not an RIA. |
| “14 public-source families from 13 source organizations” | `AMBIGUOUS_GRAIN` | Recalculate from the normalized ledger; organization, family, and dataset are different metrics. |
| Any cross-hub “providers researched” total | `UNSUPPORTED` | Unlike entity and publication grains cannot be added. |
| `SOURCE → VERIFY → EXPLAIN → DISCLOSE → UPDATE → YOU DECIDE` | `VALID_CURRENT` | No top-level SCORE step found. Future copy should prefer Identify/Organize/Trace while retaining evidence-first meaning. |

## Semantic firewalls

- Examination is not enforcement; complaint is not violation; registration or credential is not endorsement.
- Authority status is not recommendation; RAUM is not performance; public publication is not quality.
- Headquarters, mailing address, facility location, complaint location, and market geography retain source-specific meanings.
- Paid, claimed, managed, subscribed, or advertised status cannot affect evidence, publication gates, ordering, counts, or source inclusion.

## Gaps and freshness

- Source clocks vary by regulator. The network must show source as-of, retrieval, and contract-generation clocks rather than “updated today.”
- Some accepted sources report no source observation date; that absence is explicit and is not converted into an inferred freshness date.
- Route existence is not proof of enhanced geographic depth. Coverage cells require an evidence family and a research route.
- Missing evidence is not a clean record. Lack of a deterministic identity join remains a limitation, not an implied zero.

## Architecture decision

The future homepage will read a source-controlled deterministic snapshot, not fan out to six databases at request time. Each metric carries its grain, scope, source contract, clock, limitation, and optional additive group. Additive groups default to null. Refresh is initially release-time/manual: generate into a candidate snapshot, validate all six manifests, compare fingerprints/diffs, and only then replace the last accepted contract.

