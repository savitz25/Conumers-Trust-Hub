# Trust Hub Specialist Search Network V1

Certification: `TH-SEARCH-NETWORK-CERT-001`

Contract: `trusthub-specialist-search-network-v1`

Certified: 2026-09-08

## Product boundary

AskTrustHub knows the journey. Each specialist owns its industry facts. Consumers encounter one recognizable research product without collapsing six different regulatory models.

Ask is the network orchestrator: it identifies the relevant specialist, preserves the question, explains scope, and hands off to the specialist's canonical `/ask` route. A specialist may interpret natural language, but regulatory facts and match reasons must come from bounded, source-backed execution. Search ordering is identity/relevance ordering, never provider quality.

## Shared experience contract

Every specialist homepage makes Specialist Search the primary research entry and uses this hierarchy:

1. `RESEARCH [DOMAIN]`;
2. “What do you want to find out?”;
3. one bounded natural-language/identifier input;
4. one primary `Research` action;
5. domain examples;
6. accessible, collapsible `Advanced filters`;
7. a short source/coverage explanation.

The canonical result route is `/ask`. It visibly presents “We interpreted your question as,” removable/refinable criteria, source-backed results, “Why this matched,” “Evidence available,” a primary “Research this [entity]” action, and result-level “Trace this result” when an entity result exists. A supported no-match may omit result-level Trace because there is no result; query-level trace and a bounded explanation remain required.

Brand palette, typography details, domain vocabulary, filter fields, evidence families, and result visualizations may differ. Tables remain appropriate for source-native aggregates. These are not contract drift.

## Domain adapter contract

Each adapter owns:

- entity and identifier grains;
- ontology and interpretation rules;
- geography meaning;
- classification/status/evidence filters;
- parameterized execution and ordering;
- evidence provenance, source clocks, and limitations;
- publication/profile eligibility;
- domain-specific result fields and secondary utilities.

The shared layer must never infer one grain from another. An identifier is resolved only through the domain's canonical identity relationship. Search never creates a public profile.

## Evidence and epistemic contract

All specialists use the following states with the same meaning:

| State | Meaning |
| --- | --- |
| `KNOWN` | The requested capability is available from an accepted source. |
| `UNKNOWN` | Current evidence cannot establish the requested state. |
| `PARTIAL` | Relevant evidence exists, but coverage or attribution is incomplete. |
| `NOT_ACQUIRED` | A known source/universe is not acquired in the current corpus. |
| `REQUEST_ONLY` | The source is available through a request/search process, not a complete acquired bulk universe. |
| `UNSUPPORTED` | The product cannot defensibly perform the requested operation. |

None of these states becomes numerical zero unless zero is itself an observed, source-valid value. Not found in a published corpus does not prove an identifier is invalid. Missing evidence does not establish a clean history. A recorded address does not establish service territory. Evidence does not create a Trust Hub score, recommendation, endorsement, price, safety, or quality judgment.

## Domain locks

- Contractor: credential ≠ company; permits/enforcement ≠ endorsement or wrongdoing; headquarters ≠ service territory.
- Move: USDOT ≠ MC; carrier ≠ broker; FMCSA authority ≠ FDACS registration; NJ is `REQUEST_ONLY`; CA is `NOT_ACQUIRED`.
- Lender: institution ≠ branch ≠ MLO; NMLS ≠ LEI; application ≠ origination ≠ denial; HMDA property geography ≠ lender location.
- Senior: Nursing Home ≠ Home Health ≠ Hospice ≠ Assisted Living; CMS metrics remain class-specific; no combined provider denominator.
- Insurance: agency ≠ producer ≠ legal insurer; NPN ≠ NAIC; LOA ≠ appointment; Marketplace evidence ≠ state license.
- Investor: RIA ≠ ERA; firm CRD ≠ person CRD ≠ SEC file; RAUM ≠ performance; Item 5.E method ≠ fee amount; principal office ≠ client geography.

## Trace contract

Result-level Trace exposes, where applicable: identity method, structure-derived match reason, source system and clock, geography meaning, evidence family, coverage limitation, and publication state. Domain adapters add credential classification, authority/FDACS linkage, HMDA grain, CMS class/metric, LOA/appointment source, or Form ADV/RAUM detail. Trace must not reveal SQL, secrets, private people, or internal credentials.

## Empty and failure states

Specialists distinguish identifier-not-found, entity-not-found, supported zero matches, source/database unavailable, partial coverage, and unsupported requests. A source failure fails closed as unavailable, not zero. Malformed and overlong input is bounded. Unsupported `best`, `safest`, `cheapest`, `most trusted`, `clean record`, `no complaints`, and service-address conclusions receive an explicit safe limitation rather than replacement results.

## Analytics and privacy

The network vocabulary is:

`specialist_search_submit`, `specialist_search_interpreted`, `specialist_search_results`, `specialist_search_zero_results`, `specialist_search_refine`, `specialist_search_trace_open`, and `specialist_search_profile_open`.

Each event includes a bounded `hub` value. Permitted dimensions are normalized intent, entity/class token, broad geography, identifier presence/type, evidence/filter presence, coverage state, and result-count bucket. Raw questions, exact identifiers, names, email, street addresses, private profile state, and credentials are excluded by default.

## Security and performance

Queries submit explicitly; typing does not query production. Each adapter bounds input, page, page size, candidate sets, filters, sorts, wildcards, and execution time. Database access uses parameterized or repository-native safe methods. Client responses exclude service-role credentials, secrets, restricted people, and stack traces. Deliberate input limits may vary: Investor uses 400 characters; the other reference shells use 180.

## Accessibility and responsive contract

The search region has an explicit label and appropriate `role=search`; Enter submits; tab order and focus indicators are visible. Advanced filters and criteria removal are keyboard/touch accessible. Results use semantic headings and accessible links; Trace uses accessible disclosure semantics. State is never color-only. Layouts support 320, 375/390, 768, and 1280+ widths without page-level horizontal overflow; chips and long names/identifiers wrap, and tables contain their own overflow.

## SEO contract

Specialist homepages remain indexable under their local policy. `/ask` and query URLs are `noindex,follow` and excluded from sitemap expansion. Profile, state, directory, and secondary-utility indexing remains locally governed. Investor deliberately keeps WebSite SearchAction on `/firms`; Insurance's ZIP directory retains its separate listing grain.

## Secondary utilities

Useful precision surfaces remain visibly secondary: Contractor Verify, Move Verify DOT, lender directory/identity utilities, Senior provider-class discovery, Insurance ZIP directory, and Investor `/firms`. They must not masquerade as the same data universe as Specialist Search.

## Certification and rerun policy

`npm run check:th-search-network-cert` validates the static certificate, the 84-question network corpus, zero-failure requirement, six canonical Ask handoffs, and drift-sensitive invariants. `npm run cert:th-search-network-live` is an explicit network-dependent HTTP smoke and is intentionally outside normal deterministic CI.

Rerun certification after a major search/homepage change, identifier or evidence-family addition, state-coverage expansion, publication-policy change, or Specialist Search V2 work. A difference is classified as expected domain difference, acceptable brand difference, non-blocking UX drift, blocking contract drift, epistemic safety defect, security defect, accessibility defect, or SEO defect. Only genuine defects warrant repo changes.

## Certified matrix

| Hub | Certified SHA | Primary | Secondary | Input | Result |
| --- | --- | --- | --- | ---: | --- |
| Contractor | `697052a4fd2d1ba2ced985c5373315fd16517ed8` | `/ask` | `/verify` | 180 | CERTIFIED |
| Move | `bb7177cdf7eb9c26ffe8c24884212a4f16950d07` | `/ask` | `/verify-dot` | 180 | CERTIFIED |
| Lender | `964faacdb780d0421f7a404c6f9daecaf0af17d3` | `/ask` | directory/identity lookup | 180 | CERTIFIED |
| Senior | `060952b994aded2edd4e0aa41abfb9bba2fe022b` | `/ask` | provider discovery | 180 | CERTIFIED_WITH_DOCUMENTED_DIFFERENCE |
| Insurance | `fca65060a9d8c27eae5ab70626ead0716a212dd5` | `/ask` | `/directory` | 180 | CERTIFIED |
| Investor | `874c8d039589021d2989db4b75c6e74524bb3961` | `/ask` | `/firms` | 400 | CERTIFIED |

Senior's documented difference is data, not contract drift: CCN `105502` currently returns the correct safe corpus-miss state rather than a fabricated provider. AskTrustHub is certified as the orchestrator after its legacy destination registry was corrected to offer all six intent-preserving `/ask?q=…` handoffs. Exact-purpose utilities and official sources may precede `/ask` when they are more precise; they remain distinct from the homepage's primary Specialist Search experience.
