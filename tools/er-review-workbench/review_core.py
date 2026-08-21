"""Internal ER review store, validation, lock, agreement, adjudication-queue.

Does not assign MATCH/NON_MATCH/AMBIGUOUS. Humans only.
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ASK_ROOT = Path(__file__).resolve().parents[2]
FROZEN_DIR = ASK_ROOT / "data" / "academic-internal" / "entity-resolution-v1" / "run-a"
FROZEN_CSV = FROZEN_DIR / "candidate_cases.csv"
EXPECTED_SHA = "b049015026ea5efe4c3d836bd94b1f81db138be8ef64c80f1bec21633cd60d56"
REVIEWS_DIR = ASK_ROOT / "data" / "academic-internal" / "entity-resolution-v1" / "reviews"
TRAINING_PATH = Path(__file__).resolve().parent / "training_cases.json"

ALLOWED_LABELS = {"MATCH", "NON_MATCH", "AMBIGUOUS"}
ROLES = ("REVIEWER_A", "REVIEWER_B")
HIDDEN_FROM_REVIEWER = {
    "case_type",
    "difficulty",
    "candidate_reason",
    "label",
    "reviewer_a_label",
    "reviewer_b_label",
    "adjudicated_label",
    "review_status",
    "notes_internal",
    "review_source_hints",
}
LEAKAGE_KEYS = {
    "case_type",
    "difficulty",
    "candidate_reason",
    "confidence",
    "match_method",
    "entity_id",
    "contractor_id",
    "auto_merge",
    "eligible_for_canonicalization",
    "original_disposition",
    "resolution",
    "resolution_confidence",
    "adjudicated_label",
    "reviewer_a_label",
    "reviewer_b_label",
    "label",
    "google",
    "place_id",
}
BOARD_LOOKUPS = {
    "fmcsa_li": {
        "name": "FMCSA SAFER snapshot",
        "home": "https://safer.fmcsa.dot.gov/",
        "id_param": "USDOT",
    },
    "move_existing_profile": {
        "name": "FMCSA search by legal name (no second USDOT frozen)",
        "home": "https://safer.fmcsa.dot.gov/",
        "id_param": None,
    },
    "ca_cslb": {
        "name": "CA CSLB Instant License Check",
        "home": "https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx",
    },
    "az_roc": {
        "name": "AZ ROC contractor search",
        "home": "https://azroc.my.site.com/AZRoc/s/contractor-search",
    },
    "nj_dca": {
        "name": "NJ MyLicense verification",
        "home": "https://newjersey.mylicense.com/verification",
    },
    "nv_nscb": {
        "name": "NV NSCB license search",
        "home": "https://app.nvcontractorsboard.com/Clients/NVSCB/Public/ContractorLicenseSearch/ContractorLicenseSearch.aspx",
    },
    "ok_cib": {
        "name": "OK CIB licensee / roofing search",
        "home": "https://oklahoma.gov/cib/consumers/are-they-licensed.html",
    },
    "tn_blc": {
        "name": "TN Commerce license search",
        "home": "https://search.cloud.commerce.tn.gov/",
    },
    "id_dopl": {
        "name": "ID DOPL public license search",
        "home": "https://edopl.idaho.gov/OnlineServices/?link=PubSearch",
    },
    "mn_dli": {
        "name": "MN DLI license lookup",
        "home": "https://secure.doli.state.mn.us/lookup/licensing.aspx",
    },
    "va_dpor": {
        "name": "VA DPOR",
        "home": "https://www.dpor.virginia.gov/",
    },
    "ct_dcp": {
        "name": "CT eLicense",
        "home": "https://www.elicense.ct.gov/",
    },
}


class ReviewError(ValueError):
    pass


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def verify_frozen() -> dict:
    if not FROZEN_CSV.exists():
        raise ReviewError("frozen candidate CSV missing")
    digest = sha256_file(FROZEN_CSV)
    rows = load_candidates()
    labels = 0
    move = sum(1 for r in rows if r["vertical"] == "move")
    contractor = sum(1 for r in rows if r["vertical"] == "contractor")
    for r in rows:
        if r.get("label") or r.get("reviewer_a_label") or r.get("reviewer_b_label") or r.get("adjudicated_label"):
            labels += 1
    pairs = [
        tuple(sorted([(r["source_a_system"], r["source_a_identifier"]), (r["source_b_system"], r["source_b_identifier"])]))
        for r in rows
    ]
    ids = [r["benchmark_case_id"] for r in rows]
    return {
        "sha256": digest,
        "sha_unchanged": digest == EXPECTED_SHA,
        "n": len(rows),
        "move": move,
        "contractor": contractor,
        "duplicate_ids": len(ids) - len(set(ids)),
        "duplicate_pairs": len(pairs) - len(set(pairs)),
        "labels_populated": labels,
    }


def load_candidates() -> list[dict]:
    with FROZEN_CSV.open("r", encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


def candidate_index() -> dict[str, dict]:
    return {r["benchmark_case_id"]: r for r in load_candidates()}


def _usdot_links(identifier: str) -> list[dict]:
    usdot = identifier.strip()
    if not usdot.isdigit():
        return [{"title": "FMCSA SAFER home (search by name)", "url": "https://safer.fmcsa.dot.gov/"}]
    return [
        {
            "title": "FMCSA SAFER snapshot (USDOT)",
            "url": (
                "https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY"
                "&query_type=queryCarrierSnapshot&query_param=USDOT"
                f"&query_string={usdot}"
            ),
        },
        {
            "title": "FMCSA SMS carrier overview",
            "url": f"https://ai.fmcsa.dot.gov/SMS/Carrier/{usdot}/Overview.aspx",
        },
    ]


def official_lookups(system: str, identifier: str) -> list[dict]:
    if system == "fmcsa_li":
        return _usdot_links(identifier)
    if system == "move_existing_profile":
        return [
            {
                "title": "No second USDOT is frozen. Search FMCSA SAFER by the legal name shown.",
                "url": "https://safer.fmcsa.dot.gov/",
            }
        ]
    meta = BOARD_LOOKUPS.get(system, {"name": "Official board search", "home": ""})
    url = meta.get("home") or ""
    license_hint = identifier.split(":")[-1] if ":" in identifier else identifier
    items = []
    if url:
        items.append({"title": meta["name"], "url": url})
    items.append({"title": f"Search the official board for identifier {license_hint}", "url": url or "https://www.usa.gov/"})
    return items


def record_view(prefix: str, row: dict) -> dict:
    system = row[f"source_{prefix}_system"]
    ident = row[f"source_{prefix}_identifier"]
    return {
        "system": system,
        "identifier": ident,
        "name": row[f"source_{prefix}_name"],
        "dba": row[f"source_{prefix}_dba"],
        "city": row[f"source_{prefix}_city"],
        "state": row[f"source_{prefix}_state"],
        "address": row[f"source_{prefix}_address"],
        "lookups": official_lookups(system, ident),
        "missing_second_usdot": system == "move_existing_profile" or ident.startswith("move-profile:"),
    }


def reviewer_case_payload(row: dict, existing: dict | None) -> dict:
    payload = {
        "benchmark_case_id": row["benchmark_case_id"],
        "vertical": row["vertical"],
        "record_a": record_view("a", row),
        "record_b": record_view("b", row),
        "evidence_hierarchy": [
            "official regulator identifier",
            "official regulator legal/DBA record",
            "official state board record",
            "official regulatory cross-reference",
            "official registered address / filing evidence",
            "other authoritative public government evidence",
        ],
        "forbidden_evidence": [
            "Google Places / Reviews",
            "Yelp / BBB / social media",
            "commercial people-search or company aggregators",
            "name or address similarity alone",
        ],
        "definitions": {
            "MATCH": "Authoritative public evidence supports that Record A and Record B represent the same underlying regulated business/entity for this identity question.",
            "NON_MATCH": "Authoritative public evidence supports that they are distinct regulated businesses/entities.",
            "AMBIGUOUS": "The available authoritative public evidence is insufficient, conflicting, or does not support a defensible binary conclusion.",
        },
        "already_reviewed": bool(existing),
        "your_review": existing,
    }
    leakage = leakage_violations(payload)
    if leakage:
        raise ReviewError(f"leakage in reviewer payload: {leakage}")
    return payload


def leakage_violations(obj, prefix="") -> list[str]:
    hits = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            key = k.lower()
            if k in LEAKAGE_KEYS or key in LEAKAGE_KEYS or any(
                x in key for x in ("confidence", "match_method", "place_id", "case_type", "candidate_reason")
            ):
                hits.append(f"{prefix}{k}")
            hits.extend(leakage_violations(v, prefix + k + "."))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            hits.extend(leakage_violations(v, prefix + f"[{i}]."))
    elif isinstance(obj, str):
        low = obj.lower()
        if "recommended label" in low or "auto-label" in low:
            hits.append(prefix + "<text>")
    return hits


def reviews_path(role: str) -> Path:
    if role not in ROLES:
        raise ReviewError("invalid role")
    REVIEWS_DIR.mkdir(parents=True, exist_ok=True)
    return REVIEWS_DIR / f"{role}.jsonl"


def lock_path(role: str) -> Path:
    return REVIEWS_DIR / f"{role}.lock.json"


def is_locked(role: str) -> bool:
    return lock_path(role).exists()


def load_reviews(role: str) -> dict[str, dict]:
    path = reviews_path(role)
    out: dict[str, dict] = {}
    if not path.exists():
        return out
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        rec = json.loads(line)
        out[rec["benchmark_case_id"]] = rec
    return out


def write_reviews(role: str, store: dict[str, dict]) -> None:
    path = reviews_path(role)
    rows = [store[k] for k in sorted(store)]
    with path.open("w", encoding="utf-8", newline="\n") as fh:
        for rec in rows:
            fh.write(json.dumps(rec, ensure_ascii=True) + "\n")


def validate_review(role: str, case_id: str, label: str, notes: str, evidence_checked: str, evidence_strength: str | None) -> dict:
    if role not in ROLES:
        raise ReviewError("invalid reviewer_role")
    if is_locked(role):
        raise ReviewError("review file is locked")
    idx = candidate_index()
    if case_id not in idx:
        raise ReviewError("benchmark_case_id is not in the frozen 400")
    if label not in ALLOWED_LABELS:
        raise ReviewError("label must be MATCH, NON_MATCH, or AMBIGUOUS")
    if not (notes or "").strip():
        raise ReviewError("review_notes must not be empty")
    if not (evidence_checked or "").strip():
        raise ReviewError("evidence_checked must not be empty")
    if evidence_strength and evidence_strength not in {"STRONG", "MODERATE", "INSUFFICIENT"}:
        raise ReviewError("evidence_strength must be STRONG, MODERATE, INSUFFICIENT, or omitted")
    return {
        "benchmark_case_id": case_id,
        "reviewer_role": role,
        "review_label": label,
        "review_notes": notes.strip(),
        "evidence_checked": evidence_checked.strip(),
        "evidence_strength": evidence_strength or "",
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
        "official_sources_consulted": evidence_checked.strip(),
    }


def save_review(role: str, rec: dict) -> dict:
    store = load_reviews(role)
    store[rec["benchmark_case_id"]] = rec
    write_reviews(role, store)
    return progress(role)


def progress(role: str) -> dict:
    n = len(candidate_index())
    done = len(load_reviews(role))
    return {
        "role": role,
        "reviewed": done,
        "remaining": n - done,
        "percent": round(100.0 * done / n, 1) if n else 0,
        "locked": is_locked(role),
        "total": n,
    }


def ordered_cases() -> list[dict]:
    rows = load_candidates()
    rows.sort(key=lambda r: r["benchmark_case_id"])
    return rows


def next_unreviewed_index(role: str) -> int:
    done = load_reviews(role)
    for i, row in enumerate(ordered_cases()):
        if row["benchmark_case_id"] not in done:
            return i
    return 0


def lock_review(role: str, attestation: str) -> dict:
    if role not in ROLES:
        raise ReviewError("invalid role")
    if is_locked(role):
        raise ReviewError("already locked")
    required = (
        "I reviewed these cases using the TrustHub Entity Resolution Benchmark review "
        "protocol and did not use an automatic proposed benchmark label."
    )
    if attestation.strip() != required:
        raise ReviewError("attestation text does not match the required statement")
    store = load_reviews(role)
    n = len(candidate_index())
    if len(store) != n:
        raise ReviewError(f"incomplete: {len(store)} of {n} reviewed")
    csv_path = REVIEWS_DIR / f"{role}-completed.csv"
    fields = [
        "benchmark_case_id",
        "reviewer_role",
        "review_label",
        "review_notes",
        "evidence_checked",
        "evidence_strength",
        "reviewed_at",
        "official_sources_consulted",
    ]
    with csv_path.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for cid in sorted(store):
            w.writerow(store[cid])
    digest = sha256_file(csv_path)
    counts = Counter(r["review_label"] for r in store.values())
    meta = {
        "role": role,
        "sha256": digest,
        "row_count": len(store),
        "label_counts": dict(counts),
        "locked_at": datetime.now(timezone.utc).isoformat(),
        "attestation": required,
        "other_reviewer_hidden": True,
    }
    lock_path(role).write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return meta


def both_locked() -> bool:
    return is_locked("REVIEWER_A") and is_locked("REVIEWER_B")


def agreement_report() -> dict:
    if not both_locked():
        raise ReviewError("agreement tool refuses to run until both REVIEWER_A and REVIEWER_B reviews are locked")
    a = load_reviews("REVIEWER_A")
    b = load_reviews("REVIEWER_B")
    labels = ["MATCH", "NON_MATCH", "AMBIGUOUS"]
    agree = 0
    n = 0
    table = Counter()
    by_vertical = Counter()
    disagree = 0
    idx = candidate_index()
    for cid in sorted(a):
        if cid not in b:
            continue
        n += 1
        la, lb = a[cid]["review_label"], b[cid]["review_label"]
        table[(la, lb)] += 1
        vert = idx[cid]["vertical"]
        if la == lb:
            agree += 1
            by_vertical[f"{vert}_agree"] += 1
        else:
            disagree += 1
            by_vertical[f"{vert}_disagree"] += 1
    po = agree / n if n else 0
    pa = Counter(r["review_label"] for r in a.values())
    pb = Counter(r["review_label"] for r in b.values())
    pe = sum((pa[l] / n) * (pb[l] / n) for l in labels) if n else 0
    kappa = None if pe == 1 else (po - pe) / (1 - pe)
    return {
        "n": n,
        "raw_agreement": po,
        "cohen_kappa": kappa,
        "agree": agree,
        "disagree": disagree,
        "label_distribution_a": dict(pa),
        "label_distribution_b": dict(pb),
        "by_vertical": dict(by_vertical),
        "confusion": {f"{x}_{y}": table[(x, y)] for x in labels for y in labels},
    }


def adjudication_queue() -> list[dict]:
    if not both_locked():
        raise ReviewError("adjudication tool refuses to run before two locked reviews")
    a = load_reviews("REVIEWER_A")
    b = load_reviews("REVIEWER_B")
    idx = candidate_index()
    queue = []
    for cid in sorted(a):
        if a[cid]["review_label"] != b[cid]["review_label"]:
            row = idx[cid]
            queue.append(
                {
                    "benchmark_case_id": cid,
                    "vertical": row["vertical"],
                    "reviewer_a_label": a[cid]["review_label"],
                    "reviewer_b_label": b[cid]["review_label"],
                    "adjudicated_label": "",
                    "adjudicator_must_be_new_session": True,
                }
            )
    return queue


def load_training() -> list[dict]:
    return json.loads(TRAINING_PATH.read_text(encoding="utf-8"))


def training_overlap() -> list[str]:
    bench = {r["benchmark_case_id"] for r in load_candidates()}
    return [t["training_case_id"] for t in load_training() if t["training_case_id"] in bench]


def reviewer_payload_leakage_scan() -> list[str]:
    hits = []
    for row in load_candidates()[:5]:
        payload = reviewer_case_payload(row, None)
        hits.extend(leakage_violations(payload))
        blob = json.dumps(payload).lower()
        for token in ("case_type", "difficulty", "candidate_reason", "false_positive_trap", "multi_license_entity"):
            if token in blob:
                hits.append(token)
    return sorted(set(hits))
