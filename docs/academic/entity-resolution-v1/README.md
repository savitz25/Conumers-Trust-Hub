# TrustHub Entity Resolution Benchmark (internal V1 candidates)

**Status:** Documentation / internal candidate construction. **No public file. No labels. No DOI.**  
**Snapshot version:** `trusthub-er-candidate-v1`  
**Task:** Academic 001C.1

This is **not** a labeled benchmark yet. 001C.1 only builds an unlabeled candidate set and the dual-review system.

Senior Academic V1 is a separate flagship and is not modified here.

---

## Purpose

Help future researchers evaluate entity-resolution methods on **difficult regulated-business identities** (FMCSA household-goods carriers/brokers and state contractor licenses).

A similarity score, matcher confidence, shared address, shared phone, or Google match is **not** ground truth.

---

## What 001C.1 produced

| Item | Status |
|------|--------|
| ~400 unlabeled candidate pairs | Internal, gitignored |
| Dual-run identical artifacts | Yes |
| Reviewer A / B packets | Designed and generated internally; reviews **not** performed |
| Ground-truth labels | **None** |
| Public download / DOI | **None** |

---

## Companion documents

- `SCHEMA.md` — candidate and reviewer fields
- `CANDIDATE-SELECTION.md` — generation, sampling, IDs, difficulty
- `REVIEW-PROTOCOL.md` — MATCH / NON_MATCH / AMBIGUOUS evidence rules
- `LIMITATIONS.md`
- `docs/ACADEMIC-001C1-ENTITY-RESOLUTION-CANDIDATE-SET.md`

---

## Next (001C.2)

Independent dual human review using the protocol. Do not auto-label. Do not publish.
