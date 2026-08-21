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
    assert_true(len(cases) == 12, len(cases))
    bench_ids = {r["benchmark_case_id"] for r in rc.load_candidates()}
    used = set()
    with (ROOT / "data/academic-internal/entity-resolution-v1/run-a/candidate_cases.csv").open(encoding="utf-8") as fh:
        import csv as _csv
        for r in _csv.DictReader(fh):
            used.add(r["source_a_identifier"])
            used.add(r["source_b_identifier"])
    fake = 0
    for c in cases:
        assert_true(c["training_case_id"] not in bench_ids, c["training_case_id"])
        assert_true("expected" not in c, "training GET source must not include answer")
        for side in ("record_a", "record_b"):
            ident = c[side]["identifier"]
            assert_true(ident not in used or ident.startswith("move-profile:"), ident)
            if ident.startswith("900000"):
                fake += 1
            lookups = rc.official_lookups(c[side]["system"], ident, c[side].get("name") or "")
            blob = json.dumps(lookups)
            assert_true("ai.fmcsa.dot.gov/SMS" not in blob, "SMS must not be primary")
    assert_true(fake == 0, "synthetic USDOTs remain")
    key = rc.load_training_key()
    assert_true(len(key) == 12, key)
    fb = rc.training_feedback("train-er-01", "MATCH")
    assert_true(fb and fb["matched"] is True, fb)


def test_lookup_sample():
    rows = rc.ordered_cases()
    move = [r for r in rows if r["vertical"] == "move"][:20]
    contr = [r for r in rows if r["vertical"] == "contractor"][:20]
    assert_true(len(move) == 20 and len(contr) == 20, "sample size")
    broken = 0
    for r in move + contr:
        for prefix in ("a", "b"):
            sys = r[f"source_{prefix}_system"]
            ident = r[f"source_{prefix}_identifier"]
            lu = rc.official_lookups(sys, ident, r[f"source_{prefix}_name"])
            assert_true(lu, sys)
            assert_true(all("ai.fmcsa.dot.gov/SMS" not in x.get("url", "") for x in lu), "sms")
            kinds = {x.get("kind") for x in lu}
            if not kinds & {"DIRECT_RECORD", "SEARCH_PAGE"}:
                broken += 1
    assert_true(broken == 0, broken)


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
    test_lookup_sample()
    test_blindness()
    with tempfile.TemporaryDirectory() as td:
        test_validation(Path(td))
    print("001C.2A workbench tests PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
