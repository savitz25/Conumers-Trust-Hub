# Identity Operations

`/admin/identity` is the exact-grain review queue introduced by ATH-ADMIN-008. It never merges specialist evidence. Ask detects deterministic conflicts, records review and recommendation history, and leaves regulator identity correction with the owning specialist Hub.

The supported review types are `POSSIBLE_DUPLICATE`, `IDENTIFIER_REUSED`, `REVIEW_REQUIRED_BINDING`, `PROFILE_REDIRECT`, `MERGE_CANDIDATE`, `SPLIT_CANDIDATE`, `HUB_PROFILE_ORPHAN`, and `ORGANIZATION_PROFILE_RELATIONSHIP_REVIEW`. Candidate creation requires an exact identifier/native-profile conflict or a broken exact claim/grant binding. Names, addresses, websites, phones, and email domains are never sufficient.

Profiles remain distinct across Hub and entity class. Senior provider classes, Insurance agency/producer/legal-insurer, Lender institution/branch/MLO, Investor firm/individual, Move mover/USDOT, and Contractor credential grains never collapse. An organization may legitimately manage multiple exact profiles.

`DATA_OPS` handles specialist/source identity recommendations. `TRUST_OPS` handles organization/grant relationship reviews through `CLAIM_OPS`. `GROWTH` and `READ_ONLY` cannot resolve reviews. Events and Admin audit preserve decisions; no action mutates Layer A. When dependency health is DEGRADED or UNKNOWN, an apparent orphan is held for source recovery rather than triggering destructive action.
