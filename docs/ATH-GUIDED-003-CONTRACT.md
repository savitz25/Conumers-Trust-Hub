# ATH-GUIDED-003 Guided Research expansion

ATH-GUIDED-003 extends `ask-guided-research-session-v1` to InvestorTrustHub, InsuranceTrustHub, and LenderTrustHub without changing the accepted phase machine, history snapshots, tab-scoped storage, Back/Resume behavior, or the Senior, Contractor, and Move adapters.

## Orchestration

Broad need statements are local clarifications and make zero specialist calls. Complete cohorts and exact identifiers execute immediately against only the selected specialist. The server validates every transition, filter, specialist version, and specialist result state. Specialist evidence rows are never stored in session storage.

Added identity states are `NO_CONFIDENT_MATCH`, `AMBIGUOUS_IDENTITIES`, and `IDENTITY_COLLISION`. They remain distinct from zero records, invalid input, publication restriction, backend failure, and timeout. Result-bearing states are reconstructed through specialist re-execution on Resume or Back; local clarification remains local.

## Source semantics

- Investor geography means principal office, not clients or service territory. RIA and ERA remain separate. Filer-reported RAUM is not performance, return, safety, or quality.
- Insurance agency, producer, and legal insurer remain separate. Credential jurisdiction is not office, domicile, appointment, service territory, or product availability. Mass producer publication is restricted.
- Lender HMDA geography describes financed-property markets, not headquarters, branches, licensing, or service territory. Complaint observations are consumer-submitted evidence, not wrongdoing findings or a size-adjusted quality score.

Only specialist-provided HTTPS destinations on the selected specialist or accepted official-source origin are rendered. A null destination is valid. Ask never synthesizes a profile URL.

## Privacy and publication

The existing 30-minute, tab-scoped session remains unchanged. No raw query telemetry, persistent anonymous history, database session store, private person publication, paid ordering, universal score, or profile creation is added.

## Timeout and recovery

Investor uses a six-second deadline. Insurance and Lender use eight seconds. Timeout and backend unavailability preserve session state and provide retryable consumer states; neither is presented as a no-match.

## Regression contract

`npm run check:ath-guided-003` covers the audited 45-journey matrix and shared Back/Resume/publication rules. All ATH-GUIDED-001, Search, Homepage, Network Intelligence, and Customer gates remain mandatory before Preview acceptance and merge.
