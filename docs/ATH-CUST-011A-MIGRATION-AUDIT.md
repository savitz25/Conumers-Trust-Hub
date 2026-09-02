# ATH-CUST-011A migration audit

Production customer database audit and migration date: 2026-09-02.

Before migration: 3 exact Contractor profile pointers, 4 claims, 3 grants, and 0 duplicate `(hub_id, native_profile_id)` pairs. All 30 `ath_*` customer tables had row-level security enabled and forced.

After migration: the same 3 profile pointers, 4 claims and 3 grants; 0 duplicate identities. All 30 customer tables remained RLS-enabled and RLS-forced. The `ath_hub_profiles` constraint now permits only `contractor`, `move`, and `lender`. Existing Contractor rows were backfilled with `credential`, `contractor`, and their existing canonical ContractorTrustHub destination.

The first migration attempt encountered a transactional SQL parsing error and rolled back. A second attempt encountered a database deadlock and rolled back. The final bounded migration executed migration 007 only, in one transaction with a lock timeout, and committed successfully. No row loss or partial schema state occurred.

Rollback is documented in `007_ath_multi_hub_customer_foundation.down.sql`; it refuses to remove the multi-hub schema while any Move or Lender customer pointer exists.
