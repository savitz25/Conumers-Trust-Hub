"""CLI for Academic 001C.2A ER review: verify, validate, lock, agreement, queue."""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools" / "er-review-workbench"))

from review_core import (  # noqa: E402
    ReviewError,
    adjudication_queue,
    agreement_report,
    both_locked,
    lock_review,
    progress,
    reviewer_payload_leakage_scan,
    training_overlap,
    verify_frozen,
    REVIEWS_DIR,
)


def cmd_verify(_args) -> int:
    print(json.dumps(verify_frozen(), indent=2))
    info = verify_frozen()
    return 0 if info["sha_unchanged"] and info["n"] == 400 and info["labels_populated"] == 0 else 1


def cmd_progress(args) -> int:
    print(json.dumps(progress(args.role), indent=2))
    return 0


def cmd_lock(args) -> int:
    required = (
        "I reviewed these cases using the TrustHub Entity Resolution Benchmark review "
        "protocol and did not use an automatic proposed benchmark label."
    )
    text = args.attestation or required
    try:
        print(json.dumps(lock_review(args.role, text), indent=2))
        return 0
    except ReviewError as exc:
        print(json.dumps({"error": str(exc)}))
        return 1


def cmd_agreement(_args) -> int:
    try:
        print(json.dumps(agreement_report(), indent=2))
        return 0
    except ReviewError as exc:
        print(json.dumps({"error": str(exc), "refused": True}))
        return 1


def cmd_queue(_args) -> int:
    try:
        rows = adjudication_queue()
        path = REVIEWS_DIR / "adjudication-queue.csv"
        if rows:
            with path.open("w", encoding="utf-8", newline="") as fh:
                w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
                w.writeheader()
                w.writerows(rows)
        print(json.dumps({"n": len(rows), "path": str(path)}, indent=2))
        return 0
    except ReviewError as exc:
        print(json.dumps({"error": str(exc), "refused": True}))
        return 1


def cmd_leakage(_args) -> int:
    hits = reviewer_payload_leakage_scan()
    overlap = training_overlap()
    print(json.dumps({"leakage_hits": hits, "training_benchmark_overlap": overlap}, indent=2))
    return 0 if not hits and not overlap else 1


def main() -> int:
    p = argparse.ArgumentParser(description="001C.2A ER review tools (no auto-labeling)")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("verify-frozen")
    pr = sub.add_parser("progress")
    pr.add_argument("--role", required=True, choices=["REVIEWER_A", "REVIEWER_B"])
    lk = sub.add_parser("lock")
    lk.add_argument("--role", required=True, choices=["REVIEWER_A", "REVIEWER_B"])
    lk.add_argument("--attestation", default="")
    sub.add_parser("agreement")
    sub.add_parser("adjudication-queue")
    sub.add_parser("leakage-test")
    args = p.parse_args()
    return {
        "verify-frozen": cmd_verify,
        "progress": cmd_progress,
        "lock": cmd_lock,
        "agreement": cmd_agreement,
        "adjudication-queue": cmd_queue,
        "leakage-test": cmd_leakage,
    }[args.cmd](args)


if __name__ == "__main__":
    raise SystemExit(main())
