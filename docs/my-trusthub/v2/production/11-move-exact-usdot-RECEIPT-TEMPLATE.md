# Receipt — Move exact-USDOT binding batch (packet 11)

Fill every field. A blank field means the step was not done. Attach the three
CSV files named below; the forward receipt CSV is the rollback target.

## 1. Candidate manifest (Move side, read-only)

| Field | Value |
| --- | --- |
| Move project | `arepfylnilkjmyduhwbz` (anonymous `public.companies`) |
| Enumerated at (UTC) | |
| Manifest sha256 (`v23bulk.manifest_sha256`) | |
| Candidate rows (`v23bulk.manifest_rows`) | |
| PUBLISHABLE rows | |
| PUBLISHABLE_SUPPORTED_MOVERS | |
| Held on the Move side: MISSING_REQUIRED_IDENTITY | |
| Held on the Move side: MOVE_NAME_COLLISION_HOLD (colliding legal-name label; not an Ask class) | |
| Held on the Move side: USDOT on more than one Move row | |
| Evidence file | `11-move-exact-usdot-evidence.csv` |

## 2. Reconciliation (Ask production, read-only)

| Field | Value |
| --- | --- |
| Ask project pinned outside SQL | `qvvxvbcdmbjzrgvwjatw` |
| Operator / session start (UTC) | |
| `reconciled_at` | |
| ALREADY_ACCEPTED | |
| SAFE_NEW_BINDING | |
| CONFLICT | |
| REVIEW_REQUIRED | |
| AMBIGUOUS | |
| Sum equals candidate rows | yes / no |
| Hindman (USDOT 1002530) is ALREADY_ACCEPTED | yes / no |
| Row-level export | `11-reconciliation-<date>.csv` |

## 3. Batch forward

| Field | Value |
| --- | --- |
| Mutation authorization (who, when, reference) | |
| `v23bulk.evidence_ref` used | |
| `v23bulk.expected_safe_new` typed | |
| Marker `V23_PROD_MOVE_EXACT_USDOT_BATCH_APPLIED <n> bindings` | |
| `created` / `valid_from` / `provenance_ref` (final result row) | |
| COMMIT time (UTC) | |
| Receipt export | `11-receipt-<date>.csv` — header `usdot,slug,legal_name,binding_id,network_entity_id,provenance_ref,valid_from` |
| Receipt rows equal `created` | yes / no |
| sha256 of the receipt CSV | |
| `myth_identity_governor` membership revoked after COMMIT | yes / no, time |
| Session authorization settings cleared | yes / no |

## 4. Post-apply verification (read-only)

| Check | Result |
| --- | --- |
| Three receipt USDOTs through `v23_private.prod_move_binding_for('usdot-<n>')`: one row, accepted, mover, fmcsa.usdot, US, entity active | |
| Hindman still resolves to its original binding id | |
| Reconciliation re-run in a fresh session: SAFE_NEW_BINDING = 0, ALREADY_ACCEPTED = previous ALREADY_ACCEPTED + created | |
| CONFLICT / REVIEW_REQUIRED / AMBIGUOUS counts unchanged | |

## 5. Rollback (only if performed)

| Field | Value |
| --- | --- |
| Retirement authorization (who, when, reference) | |
| Receipt file loaded / rows (`v23bulk.rollback_expected_rows`) | |
| Marker `V23_PROD_MOVE_EXACT_USDOT_BATCH_RETIRED <n> bindings at <time>` | |
| Sample USDOT through the resolver returns zero rows | |
| Hindman still resolves | |
| `myth_identity_governor` membership revoked | |

## Result

`PACKET_11 = APPLIED / NOT APPLIED / ROLLED BACK` — operator, date.
