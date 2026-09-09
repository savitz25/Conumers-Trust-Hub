# Product telemetry retention

`ath_product_events` contains typed, privacy-safe observations rather than raw questions or consumer records.

Recommended V1 policy:

- raw product events: 90 days;
- longer history: aggregate-only reports when a later volume/retention job is approved;
- activation epoch marker: retained with the contract history;
- Admin audit and operational claim records: governed separately and are not product telemetry.

Automatic deletion is **not implemented in ATH-ADMIN-003**. Current traffic is small and deletion without an approved aggregate/verification job could destroy the first baseline. ADMIN-003 records the recommendation; a later retention job must be bounded, audited, tested on a branch, and must never delete Admin audit, claim truth, management grants, Watches, or alerts.

No generic metadata JSON column exists. Raw Search questions, email, phone, names, addresses, tokens, secrets, private notes, and private decisions are prohibited by contract and recorder validation.
