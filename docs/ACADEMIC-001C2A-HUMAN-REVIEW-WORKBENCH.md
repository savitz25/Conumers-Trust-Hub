# Academic 001C.2A — Entity Resolution human review workbench

**Status:** Internal tool ready. Frozen 400 remain **unlabeled**. Not deployed publicly.  
**Starting Ask SHA:** `6172abe51b3caa242639288e40f216fd022ff1f6`  
**Frozen candidate SHA (unchanged):** `b049015026ea5efe4c3d836bd94b1f81db138be8ef64c80f1bec21633cd60d56`

Builder/Codex does **not** assign MATCH / NON_MATCH / AMBIGUOUS on the benchmark.

---

## Workbench

Local only (`127.0.0.1:8765`), outside Next.js production routing:

```
python tools/er-review-workbench/server.py
```

Open http://127.0.0.1:8765/ as **REVIEWER_A** or **REVIEWER_B** (separate browsers/profiles).

UX (001C.2A.2): real training cases (not synthetic USDOTs); SAFER as primary Move evidence (SMS Overview removed); copy identifier / copy legal name; frozen vs live official source; training answer key only after submit. Restart the local server after pulling this change.

CLI:

```
python scripts/academic-001c2a-er-review-cli.py verify-frozen
python scripts/academic-001c2a-er-review-cli.py progress --role REVIEWER_A
python scripts/academic-001c2a-er-review-cli.py lock --role REVIEWER_A
python scripts/academic-001c2a-er-review-cli.py agreement
python scripts/academic-001c2a-er-review-cli.py adjudication-queue
python scripts/academic-001c2a-er-review-cli.py leakage-test
```

Tests: `python scripts/academic-001c2a-workbench-test.py`

---

## Blindness

Reviewer payloads omit `case_type`, `difficulty`, `candidate_reason`, 008b resolution, confidence, match_method, entity/contractor IDs, and the other reviewer’s file.

Each role reads/writes only `data/academic-internal/entity-resolution-v1/reviews/{ROLE}.jsonl` (gitignored).

---

## Training / calibration

12 synthetic cases in `tools/er-review-workbench/training_cases.json` (`train-er-01` … `train-er-12`). **Zero overlap** with the frozen 400.

Both reviewers complete training first, then may discuss **definitions only**, never the frozen 400.

---

## Storage and locking

Progress is saved per case (resume supported). Before lock, a reviewer may revise their own row.

Lock requires all 400 rows plus the exact attestation. Writes `{ROLE}-completed.csv` and `{ROLE}.lock.json` with SHA-256, counts, timestamp. The other reviewer cannot read that lock.

---

## Agreement / adjudication (not run)

`agreement` and `adjudication-queue` **refuse** until both reviews are locked. No fabricated metrics. No adjudicated labels in 001C.2A.

---

## How two humans start 001C.2B

1. Each reviewer reads `HUMAN-REVIEW-GUIDE.md` and `REVIEW-PROTOCOL.md`.  
2. Run the local server; select **Training**; finish 12 cases independently.  
3. Optionally discuss protocol (not the 400).  
4. Switch to **Frozen benchmark**; work as REVIEWER_A or REVIEWER_B only.  
5. Resume anytime; lock only when 400 are done and attested.  
6. Do not share files across reviewers. Do not use Google. Do not ask an AI for the label.
