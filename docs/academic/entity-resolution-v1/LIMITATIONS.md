# ER V1 candidate limitations

- **No ground truth yet.** Empty labels are intentional.
- Move pairs inherit 008b overlay pairing; many existing-profile counterparts lack a USDOT in that file (`move-profile:{slug}`). Reviewers must still open official FMCSA records.
- Contractor pairs are surfaced from **staging** board extracts, not a live production dump. Staging vintages differ by state.
- Business-only filter drops sole-owner / individual-coded licenses; some genuine firms without LLC/INC tokens are also dropped.
- Difficulty is **not** a prediction of the future label. The observed mix is heavier on MODERATE because Move 008b is mostly same-name-different-location.
- Several Move HQ strings include Canadian provinces (FMCSA can list non-US HQ). That is source geography, not a data-quality rewrite.
- Case types not populated (no supporting frozen pairs in this pass): `PUNCTUATION_SUFFIX_VARIATION`, `ADDRESS_CHANGE`, `BROKER_CARRIER_RELATIONSHIP`, `SUCCESSOR_PREDECESSOR_CANDIDATE`, `COMMON_NAME_COLLISION` as a separate code (similar-name-different-state covers much of that pool).
- Pattern privacy scans on the candidate CSV are an aid, not a proof of absence of PII.
- The candidate CSV must not be published as a research release in 001C.1.
