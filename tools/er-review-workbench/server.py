"""Local-only ER review workbench. Bind 127.0.0.1. Not for production deploy."""
from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from review_core import (
    ReviewError,
    candidate_index,
    is_locked,
    load_reviews,
    load_training,
    lock_review,
    next_unreviewed_index,
    ordered_cases,
    official_lookups,
    progress,
    reviewer_case_payload,
    save_review,
    validate_review,
    verify_frozen,
)

STATIC = Path(__file__).resolve().parent / "static"
HOST = "127.0.0.1"
PORT = 8765

TRAINING_REVIEWS = Path(__file__).resolve().parents[2] / "data" / "academic-internal" / "entity-resolution-v1" / "reviews"


def training_path(role: str) -> Path:
    TRAINING_REVIEWS.mkdir(parents=True, exist_ok=True)
    return TRAINING_REVIEWS / f"{role}-training.json"


def load_training_reviews(role: str) -> dict:
    p = training_path(role)
    if not p.exists():
        return {}
    return json.loads(p.read_text(encoding="utf-8"))


def save_training_review(role: str, rec: dict) -> dict:
    store = load_training_reviews(role)
    store[rec["training_case_id"]] = rec
    training_path(role).write_text(json.dumps(store, indent=2), encoding="utf-8")
    n = len(load_training())
    return {"reviewed": len(store), "remaining": n - len(store), "percent": round(100 * len(store) / n, 1), "total": n}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def _json(self, code: int, obj: dict):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict:
        n = int(self.headers.get("Content-Length") or 0)
        if not n:
            return {}
        return json.loads(self.rfile.read(n).decode("utf-8"))

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path in ("/", "/index.html"):
            html = (STATIC / "index.html").read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(html)))
            self.end_headers()
            self.wfile.write(html)
            return
        q = parse_qs(parsed.query)
        role = (q.get("role") or ["REVIEWER_A"])[0]
        if parsed.path == "/api/health":
            self._json(200, {"ok": True, "frozen": verify_frozen(), "bind": f"{HOST}:{PORT}"})
            return
        if parsed.path == "/api/progress":
            self._json(200, progress(role))
            return
        if parsed.path == "/api/next":
            mode = (q.get("mode") or ["benchmark"])[0]
            if mode == "training":
                done = load_training_reviews(role)
                cases = load_training()
                idx = 0
                for i, c in enumerate(cases):
                    if c["training_case_id"] not in done:
                        idx = i
                        break
                self._json(200, {"index": idx})
                return
            self._json(200, {"index": next_unreviewed_index(role)})
            return
        if parsed.path == "/api/training":
            cases = load_training()
            index = int((q.get("index") or ["0"])[0])
            index = max(0, min(index, len(cases) - 1))
            case = cases[index]
            existing = load_training_reviews(role).get(case["training_case_id"])
            payload = {
                "training_case_id": case["training_case_id"],
                "vertical": case["vertical"],
                "record_a": {**case["record_a"], "lookups": official_lookups(case["record_a"]["system"], case["record_a"]["identifier"]), "missing_second_usdot": case["record_a"]["system"] == "move_existing_profile"},
                "record_b": {**case["record_b"], "lookups": official_lookups(case["record_b"]["system"], case["record_b"]["identifier"]), "missing_second_usdot": case["record_b"]["system"] == "move_existing_profile"},
                "your_review": existing,
                "progress": {
                    "reviewed": len(load_training_reviews(role)),
                    "remaining": len(cases) - len(load_training_reviews(role)),
                    "percent": round(100 * len(load_training_reviews(role)) / len(cases), 1),
                },
            }
            self._json(200, payload)
            return
        if parsed.path == "/api/case":
            try:
                rows = ordered_cases()
                index = int((q.get("index") or ["0"])[0])
                index = max(0, min(index, len(rows) - 1))
                row = rows[index]
                existing = load_reviews(role).get(row["benchmark_case_id"])
                payload = reviewer_case_payload(row, existing)
                payload["progress"] = progress(role)
                payload["index"] = index
                self._json(200, payload)
            except ReviewError as exc:
                self._json(400, {"error": str(exc)})
            return
        self._json(404, {"error": "not found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        body = self._read_json()
        role = body.get("role") or "REVIEWER_A"
        try:
            if parsed.path == "/api/review":
                if body.get("mode") == "training":
                    if body.get("review_label") not in {"MATCH", "NON_MATCH", "AMBIGUOUS"}:
                        raise ReviewError("label must be MATCH, NON_MATCH, or AMBIGUOUS")
                    if not (body.get("review_notes") or "").strip() or not (body.get("evidence_checked") or "").strip():
                        raise ReviewError("notes and evidence_checked required")
                    rec = {
                        "training_case_id": body.get("case_id"),
                        "reviewer_role": role,
                        "review_label": body["review_label"],
                        "review_notes": body["review_notes"].strip(),
                        "evidence_checked": body["evidence_checked"].strip(),
                    }
                    self._json(200, save_training_review(role, rec))
                    return
                rec = validate_review(
                    role,
                    body.get("case_id") or "",
                    body.get("review_label") or "",
                    body.get("review_notes") or "",
                    body.get("evidence_checked") or "",
                    body.get("evidence_strength") or None,
                )
                self._json(200, save_review(role, rec))
                return
            if parsed.path == "/api/lock":
                self._json(200, lock_review(role, body.get("attestation") or ""))
                return
            self._json(404, {"error": "not found"})
        except ReviewError as exc:
            self._json(400, {"error": str(exc)})


def main():
    frozen = verify_frozen()
    if not frozen["sha_unchanged"] or frozen["labels_populated"]:
        raise SystemExit(f"refusing to start: frozen set check failed {frozen}")
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"ER review workbench http://{HOST}:{PORT}/  (local only)")
    print("Do not deploy. Do not label with an LLM.")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
