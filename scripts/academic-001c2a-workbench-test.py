"""Tests for Academic 001C.2A workbench. Does not label the frozen 400."""
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools" / "er-review-workbench"))

import review_core as rc  # noqa: E402


def assert_true(cond, msg):
    if not cond:
        raise SystemExit(f"FAIL: {msg}")


def test_frozen():
    info = rc.verify_frozen()
    assert_true(info["sha_unchanged"], f"hash changed {info['sha256']}")
    assert_true(info["n"] == 400, info)
    assert_true(info["move"] == 200 and info["contractor"] == 200, info)
    assert_true(info["duplicate_ids"] == 0 and info["duplicate_pairs"] == 0, info)
    assert_true(info["labels_populated"] == 0, info)


def test_hidden_fields():
    row = rc.ordered_cases()[0]
    payload = rc.reviewer_case_payload(row, None)
    blob = json.dumps(payload)
    for token in ('"case_type"', '"difficulty"', "candidate_reason", "FALSE_POSITIVE_TRAP"):
        assert_true(token not in blob, f"leaked {token}")
    hits = rc.leakage_violations(payload)
    assert_true(hits == [], hits)


def test_validation(tmp: Path):
    rc.REVIEWS_DIR = tmp
    cid = rc.ordered_cases()[0]["benchmark_case_id"]
    try:
        rc.validate_review("REVIEWER_A", cid, "PROBABLE_MATCH", "notes here", "FMCSA", None)
        raise SystemExit("FAIL: probable match accepted")
    except rc.ReviewError:
        pass
    try:
        rc.validate_review("REVIEWER_A", cid, "MATCH", "", "FMCSA", None)
        raise SystemExit("FAIL: empty notes accepted")
    except rc.ReviewError:
        pass
    try:
        rc.validate_review("REVIEWER_A", cid, "MATCH", "notes here", "", None)
        raise SystemExit("FAIL: empty evidence accepted")
    except rc.ReviewError:
        pass
    try:
        rc.validate_review("REVIEWER_A", "not-a-real-id", "MATCH", "notes here", "FMCSA", None)
        raise SystemExit("FAIL: invalid id accepted")
    except rc.ReviewError:
        pass
    rec = rc.validate_review("REVIEWER_A", cid, "AMBIGUOUS", "insufficient official id on B", "opened SAFER home", "INSUFFICIENT")
    assert_true(rec["review_label"] == "AMBIGUOUS", rec)
    rc.save_review("REVIEWER_A", rec)
    rc.save_review("REVIEWER_A", rec)  # revise allowed before lock
    try:
        rc.agreement_report()
        raise SystemExit("FAIL: agreement ran incomplete")
    except rc.ReviewError:
        pass
    try:
        rc.adjudication_queue()
        raise SystemExit("FAIL: adjudication ran incomplete")
    except rc.ReviewError:
        pass
    try:
        rc.lock_review("REVIEWER_A", "wrong attestation")
        raise SystemExit("FAIL: bad attestation")
    except rc.ReviewError:
        pass
    try:
        rc.lock_review(
            "REVIEWER_A",
            "I reviewed these cases using the TrustHub Entity Resolution Benchmark review protocol and did not use an automatic proposed benchmark label.",
        )
        raise SystemExit("FAIL: lock with 1 of 400")
    except rc.ReviewError:
        pass


def test_training():
    overlap = rc.training_overlap()
    assert_true(overlap == [], overlap)
    cases = rc.load_training()
    assert_true(12 <= len(cases) <= 15, len(cases))
    bench = {r["benchmark_case_id"] for r in rc.load_candidates()}
    for c in cases:
        assert_true(c["training_case_id"] not in bench, c["training_case_id"])
        assert_true(c.get("not_in_benchmark") is True, c)


def test_blindness():
    hits = rc.reviewer_payload_leakage_scan()
    assert_true(hits == [], hits)
    html = (ROOT / "tools" / "er-review-workbench" / "static" / "index.html").read_text(encoding="utf-8")
    for token in ("case_type", "candidate_reason", "match_method", "entity_id", "googleapis", "yelp"):
        assert_true(token not in html, f"html leaked {token}")


def main() -> int:
    test_frozen()
    test_hidden_fields()
    test_training()
    test_blindness()
    with tempfile.TemporaryDirectory() as td:
        test_validation(Path(td))
    print("001C.2A workbench tests PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
