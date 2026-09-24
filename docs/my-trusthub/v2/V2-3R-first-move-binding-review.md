# First Move binding review — BLOCKED, no binding created

Candidate evidence supplied by Builder 3 (historical read-only observation, not
rechecked against production in V2-3R): Company.id `usdot-1002530`, slug
`hindman-isaacs-moving-storage-inc`, publication_state `PUBLISHABLE`.

Reviewed adapter tuple candidate: `{hub: move, nativeId: usdot-1002530,
profileClass: mover}`. The native ID is Company.id, not the slug or a parent UUID.
Public route is `/companies/hindman-isaacs-moving-storage-inc` on Move's reviewed
origin. Isolated QA must substitute its approved origin, never navigate production.

## Missing control-plane evidence

1. Authoritative source row/provenance linking that Company.id to the exact
   regulated/business identity (USDOT prefix alone is not provenance), source
   identifier namespace, source record/version and verified current publication.
2. Current exact network entity lookup by reviewed source identifiers and existing
   bindings/redirects, including retired/effective records. Historical zero current
   Move bindings does NOT prove no network entity already represents this company.
3. Identity steward decision: reuse an exact existing entity or create a new one;
   neither can be selected by name/email/location similarity. No DB access is
   authorized to establish this in the current run.
4. Review of conflicts/overlapping validity periods, one-to-many branch/legal-entity
   versus profile grain, class eligibility and identifier reuse.
5. Signed approval reference, effective valid_from, revocation rule and source
   snapshot freshness bound for the isolated publication mapper.

Required acceptance: unique current exact tuple/binding, active terminal entity,
published supported class, valid_from <= commit time and valid_to absent/future.
Ambiguous candidates fail closed. Revoked/unpublished bindings deny new commits;
research already saved is retained. Redirects require reviewed identity governance,
cycle-safe terminal resolution and no inferred merge. Save eligibility is separate
from Watch; approval grants no Watch or notification rights.

No network UUID is nominated, no binding is seeded, no new network entity is
asserted necessary. A synthetic isolated fixture remains valid protocol evidence
only, not this identity approval. Verdict: **BLOCKED — exact provenance, current
network identity/conflict lookup and steward decision are missing**.
