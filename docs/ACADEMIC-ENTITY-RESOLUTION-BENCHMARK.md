# TrustHub Entity Resolution Benchmark (specification)

**Status:** Specification only (Academic 001A)  
**Code id:** `trusthub-entity-resolution-benchmark` (`lib/academic/benchmark.ts`)

This document describes a **future** research asset. It does **not** publish production matching data, labeled pairs, or performance claims.

---

## 1. Purpose

Measure how well identity-matching methods distinguish:

- the same business across noisy public records, versus
- different businesses that merely look similar

The unit of analysis is **business identity in public registries**, not consumers.

---

## 2. Example classes (future labeled pairs)

- Legal name versus DBA
- Same entity, different location strings
- Company rename / successor–predecessor
- Duplicated regulatory records
- Corporate-family members that should **not** collapse
- Ambiguous near-matches
- False-positive traps (similar names, unrelated firms)

---

## 3. Metrics (when a labeled file exists)

- Precision
- Recall
- False-positive rate
- False-negative rate
- Confidence calibration (reliability diagrams, Brier score)

Do not reduce the benchmark to a single “accuracy” marketing number.

---

## 4. Guardrails

- No production matcher dump in 001A
- No synthetic precision/recall invented to fill the catalog
- No consumer PII
- Hand-reviewed labels, when they exist, follow the same immutability rules as other academic snapshots (`docs/ACADEMIC-DATASET-RELEASE-STANDARD.md`)
- Internal confidence scores stay `INTERNAL_RESEARCH` until a controlled or public benchmark file is released

---

## 5. Relationship to Academic 001A projects

Project briefs in `lib/academic/projects.ts` may **cite** this specification. They must not claim that results already exist.
