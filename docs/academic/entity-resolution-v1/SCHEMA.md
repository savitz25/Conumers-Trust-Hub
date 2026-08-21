# ER V1 candidate schema

`snapshot_version`: `trusthub-er-candidate-v1`

Internal files (gitignored): `candidate_cases.csv`, `reviewer-a.csv`, `reviewer-b.csv`.

## Candidate columns

| Field | 001C.1 value |
|-------|----------------|
| benchmark_case_id | `er1_` + SHA-256 hex of canonical pair key |
| vertical | `move` \| `contractor` |
| source_*_system | e.g. `fmcsa_li`, `move_existing_profile`, `ca_cslb`, `nj_dca` |
| source_*_identifier | USDOT, `move-profile:{slug}`, or board `external_key` |
| source_*_name / dba / city / state / address | Public regulatory identity fields |
| case_type | See selection doc |
| difficulty | EASY \| MODERATE \| HARD \| VERY_HARD (selection metadata, not a label) |
| candidate_reason | Prefixed `NON_EVIDENCE candidate generation:` |
| available_authoritative_evidence | What exists to inspect |
| review_source_hints | How to inspect; **no conclusions** |
| label, reviewer_a_label, reviewer_b_label, adjudicated_label | **empty** |
| review_status | `CANDIDATE` |
| notes_internal | Process note only |
| snapshot_version | `trusthub-er-candidate-v1` |

Allowed **future** labels only: `MATCH` \| `NON_MATCH` \| `AMBIGUOUS`. No `PROBABLE_MATCH`.

## Case ID algorithm

Canonical order: `(system, identifier)` lexicographic so A/B swap is the same case.

```
payload = trusthub-er-candidate-v1|{vertical}|{a_sys}|{a_id}|{b_sys}|{b_id}
benchmark_case_id = er1_ + sha256(payload).hexdigest()
```

## Reviewer packets

Same evidence fields. Blank: `review_label`, `review_notes`, `evidence_checked`, `reviewed_at`.  
Hidden from reviewers: any 008b resolution, confidence, matcher outcome, or proposed label.

## Leakage fields excluded from packets

- Move `resolution`, `original_disposition`, `resolution_confidence`
- `match_method`, `confidence`, shared `contractor_id` / `entity_id`
- `auto_merge`, `eligible_for_canonicalization`
- Google place ids / enrichment
- Phone, email, `raw_payload`
- User / family workspace data
