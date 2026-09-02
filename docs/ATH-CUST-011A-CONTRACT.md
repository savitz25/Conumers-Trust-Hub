# ATH-CUST-011A multi-hub customer contract

Ask owns the customer plane. Specialist evidence and publication remain read-only and source-owned.

Profile identity is the exact pair `hub_id + native_profile_id`. Names, addresses, brands and owners never merge identities. Supported claim hubs are Contractor, Move and Lender. Unknown hubs fail closed.

The signed handoff binds the hub, native pointer, stable source identifier, canonical slug, entity class, source, issue/expiry times and nonce. Validation order is signature, expiry, replay, supported hub, specialist exact-profile revalidation, publication eligibility, identifier equality and entity-class eligibility. No customer profile is persisted before those checks pass.

Move claims require an already-published exact USDOT profile. Lender claims require an already-published institution NMLS profile. Branches, MLOs/people, collisions, research-only identities, fuzzy candidates and publication holds are not claimable. Contractor validation retains the accepted Florida DBPR rules.

Layer C and approved-response public DTOs require both hub and native profile ID. Their allowlists exclude customer email, organization/team data, verification evidence, moderation notes and auth data.

Monitoring is supported for Contractor only. Move and Lender render `UNAVAILABLE`; this is not inferred from hub strings.

Migration 007 is additive and preserves Contractor rows and grants. Its rollback deliberately refuses to run while Move or Lender pointers exist, preventing silent identity loss.
