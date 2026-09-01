# ATH-COHORT-001 pre-implementation audit

Date: 2026-09-01

## Baseline

- Ask accepted main: `9aa6a58466a4bc1554f2db5af41a2e1b1e58e3cd`
- Accepted search, homepage, customer, typecheck, lint, and production-build gates pass.
- `investment company in New Jersey` plans an Investor research cohort and the live `investor-ask-v1` API returns source-ordered firm rows.
- `moving company in Dallas Texas` initially plans Move entity research, but `isSpecificIdentityRequest` then treats every short Move query of eight words or fewer as a company identity. The canonical name resolver receives the full class/geography phrase and the cohort is discarded as an identity mismatch.

## Root cause

The identity decision is not shared across hubs. It combines partial cohort keywords with a Move-only word-count fallback. Word count is not evidence of a company name, and the fallback runs after the parser has already recognized Move terminology and Texas geography.

## Accepted specialist behavior

- Move `move-ask-v1` executes `moving company in Dallas Texas` as a Texas recorded-headquarters carrier cohort and returns rows. Headquarters is not service territory.
- Investor `investor-ask-v1` executes `investment company in New Jersey` as RIA + ERA principal-office research and returns rows.
- Insurance classifies `insurance company in Texas` as legal-insurer/credential-jurisdiction research but its current API returns a structured fail-closed capability response rather than directory rows.
- Lender currently returns a structured fail-closed response for bare `lenders in Texas`; HMDA geography is property-market geography, not lender HQ or service territory.
- Senior and Contractor remain governed by their existing class/geography capabilities. Ask must not fabricate rows when a specialist contract cannot return them.

## Architecture decision

Introduce one deterministic `UniversalQueryClassification` contract shared by all hubs. It consumes exact identifiers, generic entity-class phrases, recognized geography, syntax/filler terms, and ranking modifiers, then examines only the residual name candidate. A known generic class plus recognized geography with no residual name is always `COHORT`. Exact identifiers always win. Residual names remain identity requests and continue to use specialist-owned resolution.

No session engine, database, LLM classifier, specialist data copy, ranking, score, paid ordering, or service-territory inference is introduced.
