"""Academic 001C.1 — unlabeled ER candidate set (deterministic, internal only).

No MATCH/NON_MATCH labels. No Google. No production writes.
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path

ASK = Path(__file__).resolve().parents[1]
MOVE = Path(r"C:\Users\makei\Move-trust-Hub")
CONTRACTOR = Path(r"C:\Users\makei\contractor-trust-hub")
OUT = ASK / "data" / "academic-internal" / "entity-resolution-v1"
VERSION = "trusthub-er-candidate-v1"
SEED = VERSION

SUFFIX_RE = re.compile(
    r"\b(llc|l l c|inc|incorporated|corp|corporation|co|company|ltd|limited|lp|llp|pllc|plc|dba)\b",
    re.I,
)
BUSINESS_RE = re.compile(
    r"\b(llc|inc|corp|ltd|llp|company|construction|services|enterprises|holdings|group|contractors?)\b",
    re.I,
)
NOT_DBA = {
    "sole owner",
    "corporation",
    "partnership",
    "individual",
    "llc",
    "limited liability company",
}
GENERIC_NAME = re.compile(r"^(a-?1|aaa|ace|best|quality|premier|pro|allied|united|national)$", re.I)

COLUMNS = [
    "benchmark_case_id",
    "vertical",
    "source_a_system",
    "source_a_identifier",
    "source_a_name",
    "source_a_dba",
    "source_a_city",
    "source_a_state",
    "source_a_address",
    "source_b_system",
    "source_b_identifier",
    "source_b_name",
    "source_b_dba",
    "source_b_city",
    "source_b_state",
    "source_b_address",
    "case_type",
    "difficulty",
    "candidate_reason",
    "available_authoritative_evidence",
    "review_source_hints",
    "label",
    "reviewer_a_label",
    "reviewer_b_label",
    "adjudicated_label",
    "review_status",
    "notes_internal",
    "snapshot_version",
]

REVIEWER_EXTRA = ["review_label", "review_notes", "evidence_checked", "reviewed_at"]

LEAKAGE_EXCLUDED = [
    "resolution / original_disposition from Move 008b",
    "resolution_confidence",
    "match_method / confidence / contractor_entities.confidence",
    "shared contractor_id or entity_id",
    "auto_merge / eligible_for_canonicalization",
    "Google enrichment / place_id",
    "phone and email from source files",
    "raw_payload JSON",
    "user/family workspace data",
]


def sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def norm_name(value: str | None) -> str:
    s = SUFFIX_RE.sub(" ", (value or "").lower())
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def norm_addr(street: str | None, city: str | None, state: str | None) -> str:
    s = f"{street or ''} {city or ''} {state or ''}".lower()
    s = re.sub(r"\b(street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|lane|ln|suite|ste|unit|#)\b", " ", s)
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def clean_dba(value: str | None) -> str:
    v = (value or "").strip()
    if not v or v.lower() in NOT_DBA:
        return ""
    return v


def case_id(vertical: str, a_sys: str, a_id: str, b_sys: str, b_id: str) -> str:
    a = (a_sys, a_id)
    b = (b_sys, b_id)
    if a > b:
        a, b = b, a
    payload = f"{VERSION}|{vertical}|{a[0]}|{a[1]}|{b[0]}|{b[1]}"
    return "er1_" + sha(payload)


def ordered_pair(a: dict, b: dict) -> tuple[dict, dict]:
    ka = (a["system"], a["identifier"])
    kb = (b["system"], b["identifier"])
    return (a, b) if ka <= kb else (b, a)


def make_case(vertical: str, rec_a: dict, rec_b: dict, case_type: str, difficulty: str, reason: str, evidence: str, hint: str) -> dict | None:
    if rec_a["identifier"] == rec_b["identifier"] and rec_a["system"] == rec_b["system"]:
        return None
    a, b = ordered_pair(rec_a, rec_b)
    cid = case_id(vertical, a["system"], a["identifier"], b["system"], b["identifier"])
    return {
        "benchmark_case_id": cid,
        "vertical": vertical,
        "source_a_system": a["system"],
        "source_a_identifier": a["identifier"],
        "source_a_name": a.get("name") or "",
        "source_a_dba": a.get("dba") or "",
        "source_a_city": a.get("city") or "",
        "source_a_state": a.get("state") or "",
        "source_a_address": a.get("address") or "",
        "source_b_system": b["system"],
        "source_b_identifier": b["identifier"],
        "source_b_name": b.get("name") or "",
        "source_b_dba": b.get("dba") or "",
        "source_b_city": b.get("city") or "",
        "source_b_state": b.get("state") or "",
        "source_b_address": b.get("address") or "",
        "case_type": case_type,
        "difficulty": difficulty,
        "candidate_reason": f"NON_EVIDENCE candidate generation: {reason}",
        "available_authoritative_evidence": evidence,
        "review_source_hints": hint,
        "label": "",
        "reviewer_a_label": "",
        "reviewer_b_label": "",
        "adjudicated_label": "",
        "review_status": "CANDIDATE",
        "notes_internal": "Labels must remain empty until dual human review (001C.2).",
        "snapshot_version": VERSION,
    }


def move_cases() -> list[dict]:
    path = MOVE / "docs" / "task-008b-identity-review-pilot.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    out = []
    seen = set()
    cat_map = {
        "SAME_NAME_DIFFERENT_LOCATION": ("SIMILAR_NAME_DIFFERENT_STATE", "MODERATE"),
        "NAME_SIMILAR_TO_EXISTING_USDOT_DIFFERENT": ("NAME_VARIATION", "HARD"),
        "BRAND_FRANCHISE_VAN_LINE": ("FRANCHISE_OR_BRANCH", "HARD"),
        "SAME_NAME_SAME_LOCATION_DIFFERENT_USDOT": ("SAME_ADDRESS_DIFFERENT_ENTITY", "VERY_HARD"),
        "POSSIBLE_DUPLICATE_INGEST": ("DUPLICATE_SOURCE_RECORD", "VERY_HARD"),
        "LEGAL_NAME_DBA_CONFLICT": ("LEGAL_NAME_DBA", "EASY"),
    }
    for row in data.get("candidates", []):
        usdot = str(row.get("usdot") or "").strip()
        if not usdot:
            continue
        b_usdot = str(row.get("matched_existing_usdot") or "").strip()
        slug = str(row.get("matched_existing_company_slug") or row.get("matched_existing_company_id") or "").strip()
        if b_usdot:
            b_id, b_sys = b_usdot, "fmcsa_li"
        elif slug:
            b_id, b_sys = f"move-profile:{slug}", "move_existing_profile"
        else:
            continue
        cat = row.get("current_review_category") or ""
        dba = clean_dba(row.get("dba_name"))
        if dba and norm_name(dba) != norm_name(row.get("legal_name")):
            case_type, difficulty = "LEGAL_NAME_DBA", "EASY"
        else:
            case_type, difficulty = cat_map.get(cat, ("AMBIGUOUS_REGULATORY_IDENTITY", "HARD"))
        if cat == "BRAND_FRANCHISE_VAN_LINE":
            case_type, difficulty = "FRANCHISE_OR_BRANCH", "HARD"
        hq = row.get("matched_existing_hq") or ""
        hq_city = hq_state = hq_addr = ""
        if hq:
            hq_addr = hq
            sm = re.search(r",\s*([A-Za-z]{2})\s*$", hq.strip())
            if sm:
                hq_state = sm.group(1).upper()
            cm = re.search(r"([A-Za-z][A-Za-z .'-]+),\s*[A-Za-z]{2}\s*$", hq.strip())
            if cm:
                hq_city = cm.group(1).strip()
        rec_a = {
            "system": "fmcsa_li",
            "identifier": usdot,
            "name": row.get("legal_name") or "",
            "dba": dba,
            "city": row.get("city") or "",
            "state": row.get("state") or "",
            "address": "",
        }
        rec_b = {
            "system": b_sys,
            "identifier": b_id,
            "name": row.get("matched_existing_public_name") or "",
            "dba": "",
            "city": hq_city,
            "state": hq_state,
            "address": hq_addr,
        }
        case = make_case(
            "move",
            rec_a,
            rec_b,
            case_type,
            difficulty,
            f"Move 008b identity-review overlay category={cat}; name similarity is not a label",
            "FMCSA L&I (USDOT/MC, legal name, DBA, city/state); existing Move public profile identity if present",
            "Review official FMCSA L&I records for both USDOT/MC identities (or the named existing profile). Do not treat name similarity or the prior review queue as a MATCH/NON_MATCH label.",
        )
        if not case or case["benchmark_case_id"] in seen:
            continue
        seen.add(case["benchmark_case_id"])
        out.append(case)
    out.sort(key=lambda c: (c["benchmark_case_id"], c["source_a_identifier"]))
    return out[:200]


def is_business_license(row: dict) -> bool:
    name = row.get("licensee_name_raw") or ""
    secondary = (row.get("secondary_status") or "").lower()
    dba = (row.get("dba_name_raw") or "").lower()
    if "sole owner" in secondary or "sole owner" in dba:
        return False
    if "individual" in (row.get("occupation_description") or "").lower():
        return False
    return bool(BUSINESS_RE.search(name))


def load_contractor_licenses() -> list[dict]:
    roots = [
        CONTRACTOR / "data" / "staging" / name / "licenses_normalized.csv"
        for name in (
            "az_roc",
            "ca_cslb",
            "nj_dca",
            "nv_nscb",
            "ok_cib",
            "ky_dhbc",
            "tn_blc",
            "id_dopl",
            "mn_dli",
            "va_dpor",
            "ct_dcp",
        )
    ]
    rows = []
    for path in roots:
        if not path.exists():
            continue
        with path.open("r", encoding="utf-8", newline="") as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                if not is_business_license(row):
                    continue
                key = (row.get("external_key") or "").strip()
                if not key:
                    continue
                name = (row.get("licensee_name_raw") or "").strip()
                core = norm_name(name)
                if len(core) < 8 or GENERIC_NAME.match(core):
                    continue
                rec = {
                    "system": row.get("source_system") or "",
                    "identifier": key,
                    "name": name,
                    "dba": clean_dba(row.get("dba_name_raw")),
                    "city": (row.get("city") or "").strip(),
                    "state": re.sub(r"[^A-Za-z]", "", (row.get("state") or "").strip().upper())[:2],
                    "address": (row.get("address_line_1") or "").strip(),
                    "core": core,
                    "addr": norm_addr(row.get("address_line_1"), row.get("city"), row.get("state")),
                }
                rows.append(rec)
    return rows


def contractor_cases(licenses: list[dict]) -> list[dict]:
    by_name: dict[str, list[dict]] = defaultdict(list)
    by_addr: dict[str, list[dict]] = defaultdict(list)
    by_dba_core: dict[str, list[dict]] = defaultdict(list)
    for rec in licenses:
        by_name[rec["core"]].append(rec)
        if rec["addr"] and len(rec["addr"]) >= 12:
            by_addr[rec["addr"]].append(rec)
        if rec["dba"]:
            by_dba_core[norm_name(rec["dba"])].append(rec)

    pool: dict[str, dict] = {}

    def add(case: dict | None) -> None:
        if not case:
            return
        pool.setdefault(case["benchmark_case_id"], case)

    for core, group in by_name.items():
        if len(group) < 2 or len(group) > 40:
            continue
        uniq = {}
        for rec in group:
            uniq[rec["identifier"]] = rec
        items = list(uniq.values())
        if len(items) < 2:
            continue
        items.sort(key=lambda r: r["identifier"])
        a, b = items[0], items[1]
        if a["state"] == b["state"]:
            add(
                make_case(
                    "contractor",
                    a,
                    b,
                    "MULTI_LICENSE_ENTITY",
                    "MODERATE",
                    "same normalized business name, different official license keys, same state",
                    "State licensing-board records (license number/external_key, legal name, DBA, city/state)",
                    "Compare official board records for both license keys. Same name is not by itself MATCH.",
                )
            )
        else:
            add(
                make_case(
                    "contractor",
                    a,
                    b,
                    "CROSS_STATE_ENTITY",
                    "HARD",
                    "same normalized business name across different states/boards",
                    "Official board records in each state; no name-only join",
                    "Inspect each state's official license record. Cross-state same name is not MATCH without an official entity key.",
                )
            )

    for addr, group in by_addr.items():
        names = {norm_name(r["name"]) for r in group}
        if len(names) < 2:
            continue
        uniq = {}
        for rec in group:
            uniq[rec["identifier"]] = rec
        items = sorted(uniq.values(), key=lambda r: r["identifier"])
        picked = None
        for i in range(len(items) - 1):
            if items[i]["core"] != items[i + 1]["core"]:
                picked = (items[i], items[i + 1])
                break
        if not picked:
            continue
        a, b = picked
        add(
            make_case(
                "contractor",
                a,
                b,
                "SAME_ADDRESS_DIFFERENT_ENTITY",
                "VERY_HARD",
                "shared normalized street/city/state with different business names",
                "Official board address and license identity for each record",
                "Review both official licenses. Shared address is not MATCH.",
            )
        )

    for dba_core, holders in by_dba_core.items():
        if not dba_core or dba_core not in by_name:
            continue
        others = by_name[dba_core]
        if not holders or not others:
            continue
        a = sorted(holders, key=lambda r: r["identifier"])[0]
        b = None
        for rec in sorted(others, key=lambda r: r["identifier"]):
            if rec["identifier"] != a["identifier"]:
                b = rec
                break
        if not b:
            continue
        add(
            make_case(
                "contractor",
                a,
                b,
                "LEGAL_NAME_DBA",
                "MODERATE",
                "one record's DBA normalizes to another record's legal name; not a label",
                "Official DBA and legal-name fields on each board record",
                "Check whether an official DBA filing or shared license/entity key connects the names. Do not infer from string overlap.",
            )
        )

    prefix_index: dict[str, list[dict]] = defaultdict(list)
    for rec in licenses:
        toks = rec["core"].split()
        if len(toks) >= 2:
            prefix_index[" ".join(toks[:2])].append(rec)
    for prefix, group in prefix_index.items():
        if len(group) < 2:
            continue
        uniq = {r["identifier"]: r for r in group}
        items = sorted(uniq.values(), key=lambda r: r["identifier"])
        a, b = items[0], items[-1]
        if a["core"] == b["core"] or a["addr"] == b["addr"]:
            continue
        add(
            make_case(
                "contractor",
                a,
                b,
                "FALSE_POSITIVE_TRAP",
                "HARD",
                "shared leading name tokens with different remaining name and address",
                "Official names and license identifiers on each board record",
                "Treat as a false-positive trap candidate. Similar strings are not NON_MATCH until official records are reviewed, and not MATCH either.",
            )
        )

    ranked = sorted(pool.values(), key=lambda c: sha(f"{SEED}|{c['benchmark_case_id']}"))
    # Prefer harder strata without padding easy duplicates.
    buckets = {"EASY": [], "MODERATE": [], "HARD": [], "VERY_HARD": []}
    for case in ranked:
        buckets[case["difficulty"]].append(case)
    selected = []
    # ~10% easy, 32% moderate, 38% hard, 20% very hard of 200
    quotas = {"EASY": 20, "MODERATE": 64, "HARD": 76, "VERY_HARD": 40}
    used = set()
    for diff, n in quotas.items():
        for case in buckets[diff]:
            if len([c for c in selected if c["difficulty"] == diff]) >= n:
                break
            if case["benchmark_case_id"] in used:
                continue
            selected.append(case)
            used.add(case["benchmark_case_id"])
    for case in ranked:
        if len(selected) >= 200:
            break
        if case["benchmark_case_id"] not in used:
            selected.append(case)
            used.add(case["benchmark_case_id"])
    selected = selected[:200]
    selected.sort(key=lambda c: c["benchmark_case_id"])
    return selected


def privacy_scan(rows: list[dict]) -> dict:
    email = 0
    google = 0
    for row in rows:
        blob = " ".join(str(row.get(c) or "") for c in COLUMNS)
        if "@" in blob and re.search(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", blob, re.I):
            email += 1
        if re.search(r"googleapis|googleusercontent|maps\.google|ChIJ", blob, re.I):
            google += 1
    return {"email_rows": email, "google_rows": google}


def write_csv(path: Path, rows: list[dict], fields: list[str]) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for row in rows:
            w.writerow(row)
    h = hashlib.sha256(path.read_bytes()).hexdigest()
    return h


def reviewer_rows(rows: list[dict]) -> list[dict]:
    hide = {
        "label",
        "reviewer_a_label",
        "reviewer_b_label",
        "adjudicated_label",
        "notes_internal",
    }
    out = []
    for row in rows:
        rec = {k: ("" if k in hide else row.get(k, "")) for k in COLUMNS}
        rec["review_label"] = ""
        rec["review_notes"] = ""
        rec["evidence_checked"] = ""
        rec["reviewed_at"] = ""
        rec["candidate_reason"] = "NON_EVIDENCE: generation method only; ignore as a conclusion."
        out.append(rec)
    return out


def validate(rows: list[dict]) -> dict:
    ids = [r["benchmark_case_id"] for r in rows]
    pairs = [
        tuple(
            sorted(
                [
                    (r["source_a_system"], r["source_a_identifier"]),
                    (r["source_b_system"], r["source_b_identifier"]),
                ]
            )
        )
        for r in rows
    ]
    labels = sum(
        1
        for r in rows
        if r["label"] or r["reviewer_a_label"] or r["reviewer_b_label"] or r["adjudicated_label"]
    )
    return {
        "duplicate_case_ids": len(ids) - len(set(ids)),
        "duplicate_pairs": len(pairs) - len(set(pairs)),
        "reverse_duplicates": 0,
        "prepopulated_labels": labels,
        "n": len(rows),
    }


def summarize(rows: list[dict]) -> dict:
    by_v = defaultdict(int)
    by_type = defaultdict(int)
    by_diff = defaultdict(int)
    by_sys = defaultdict(int)
    states = set()
    for r in rows:
        by_v[r["vertical"]] += 1
        by_type[r["case_type"]] += 1
        by_diff[r["difficulty"]] += 1
        by_sys[r["source_a_system"]] += 1
        by_sys[r["source_b_system"]] += 1
        if r["source_a_state"]:
            states.add(r["source_a_state"])
        if r["source_b_state"]:
            states.add(r["source_b_state"])
    return {
        "total": len(rows),
        "by_vertical": dict(by_v),
        "by_case_type": dict(sorted(by_type.items())),
        "by_difficulty": dict(by_diff),
        "by_source_system": dict(sorted(by_sys.items())),
        "states": sorted(states),
        "state_count": len(states),
    }


def generate() -> tuple[list[dict], dict]:
    move = move_cases()
    licenses = load_contractor_licenses()
    contractor = contractor_cases(licenses)
    rows = move + contractor
    rows.sort(key=lambda r: r["benchmark_case_id"])
    return rows, {"move_source_rows": len(move), "contractor_source_pairs_selected": len(contractor)}


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    hashes = {}
    summaries = []
    for label in ("run-a", "run-b"):
        dest = OUT / label
        dest.mkdir(parents=True, exist_ok=True)
        rows, meta = generate()
        h = write_csv(dest / "candidate_cases.csv", rows, COLUMNS)
        write_csv(dest / "reviewer-a.csv", reviewer_rows(rows), COLUMNS + REVIEWER_EXTRA)
        write_csv(dest / "reviewer-b.csv", reviewer_rows(rows), COLUMNS + REVIEWER_EXTRA)
        val = validate(rows)
        summ = summarize(rows)
        priv = privacy_scan(rows)
        hashes[label] = h
        summaries.append({"label": label, "sha256": h, "validation": val, "summary": summ, "privacy": priv, "meta": meta})
        (dest / "candidate_summary.json").write_text(json.dumps(summaries[-1], indent=2), encoding="utf-8")
    match = hashes["run-a"] == hashes["run-b"]
    manifest = {
        "snapshot_version": VERSION,
        "seed": SEED,
        "case_id_algorithm": "er1_ + sha256(version|vertical|canon_a_sys|canon_a_id|canon_b_sys|canon_b_id) with lexicographic A/B order",
        "labels": "all empty",
        "google_places_requests": 0,
        "dual_run_match": match,
        "run_a_sha256": hashes["run-a"],
        "run_b_sha256": hashes["run-b"],
        "leakage_excluded": LEAKAGE_EXCLUDED,
        "runs": summaries,
        "published": False,
    }
    (OUT / "candidate_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))
    ok = match and summaries[0]["validation"]["duplicate_case_ids"] == 0 and summaries[0]["validation"]["prepopulated_labels"] == 0
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
