# Academic 001C.1 — Entity Resolution Benchmark candidate set

**Status:** Internal unlabeled candidates + review system. **Not published.**  
**Starting Ask SHA:** `636456eddaa23e79a86e0448ad49624a9b240ebd`  
**Snapshot:** `trusthub-er-candidate-v1`  
**Senior Academic V1:** unchanged.

Generator: `scripts/academic-001c1-er-candidates.py`  
Internal artifacts (gitignored): `data/academic-internal/entity-resolution-v1/`

---

## Guardrails held

Production writes **0** · Google Places **0** · public benchmark **0** · DOI **0** · universities **0** · labels populated **0**.

---

## Candidate set (aggregates only)

| | |
|--|--|
| Total cases | **400** |
| Move | **200** |
| Contractor | **200** |
| Duplicate case IDs | **0** |
| Duplicate / reversed pairs | **0** |
| Pre-populated labels | **0** |
| Email / Google field hits | **0** |
| Dual-run SHA-256 | `b049015026ea5efe4c3d836bd94b1f81db138be8ef64c80f1bec21633cd60d56` (run A = run B) |

### Case types

| case_type | n |
|-----------|--:|
| SIMILAR_NAME_DIFFERENT_STATE | 160 |
| MULTI_LICENSE_ENTITY | 83 |
| FALSE_POSITIVE_TRAP | 51 |
| SAME_ADDRESS_DIFFERENT_ENTITY | 41 |
| LEGAL_NAME_DBA | 40 |
| CROSS_STATE_ENTITY | 25 |

### Difficulty (selection metadata)

| | n | share |
|--|--:|------:|
| EASY | 40 | 10% |
| MODERATE | 243 | 61% |
| HARD | 76 | 19% |
| VERY_HARD | 41 | 10% |

Guidance mix was not forced. Move 008b is dominated by same-name-different-location overlays (MODERATE). Contractor selection supplied most HARD / VERY_HARD traps.

### Coverage

Source systems: `fmcsa_li`, `move_existing_profile`, `az_roc`, `ca_cslb`, `ct_dcp`, `id_dopl`, `mn_dli`, `nj_dca`, `nv_nscb`, `ok_cib`, `tn_blc`, `va_dpor`.  
Jurisdictions in the pair fields: 58 (US states/DC plus some FMCSA Canadian HQ codes as published).

---

## Review system

Reviewer A and B packets generated internally with blank review fields. Protocol and adjudication spec: `docs/academic/entity-resolution-v1/REVIEW-PROTOCOL.md`. **No reviews run in 001C.1.**

---

## Registry

ER catalog status: **DOCUMENTATION**. `downloadHref` null. `doi` null.

---

## Next — Academic 001C.2

Exact scope: independent dual human review of these 400 candidates under the frozen protocol; record labels and agreement; adjudicate disagreements; still no auto-labels, no Google, no publication.
