"""Academic 001B.2B.1 — QA closeout on the frozen Open V1 extract.

SELECT-only warehouse comparison for a deterministic 40-CCN sample.
Does not rewrite CSVs or commit sample rows.
"""
from __future__ import annotations

import csv
import hashlib
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

from academic_open_v1_qa import CRITICAL_KINDS, EXPECTED_ROWS, EXPECTED_SHA256, scan_field

import importlib.util

EXTRACT_PATH = Path(__file__).with_name("academic-001b2b-open-v1-extract.py")
spec = importlib.util.spec_from_file_location("academic_001b2b_extract", EXTRACT_PATH)
extract_mod = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(extract_mod)
OUT_ROOT = extract_mod.OUT_ROOT
connect = extract_mod.connect
sha256_file = extract_mod.sha256_file

SAMPLE_SEED = "academic-001b2b1-v1"
SAMPLE_N = 40
RUN_DIR = OUT_ROOT / "run-a"


def load_csv(name: str) -> list[dict[str, str]]:
    path = RUN_DIR / f"{name}.csv"
    with path.open("r", encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


def file_sha(name: str) -> str:
    return sha256_file(RUN_DIR / f"{name}.csv")


def pick_sample(
    facilities: list[dict[str, str]],
    ratings: dict[str, dict[str, str]],
    chain_ccns: set[str],
    insp_ccns: set[str],
    def_ccns: set[str],
    enf_ccns: set[str],
) -> list[str]:
    rows = []
    for rec in facilities:
        ccn = rec["ccn"]
        rows.append(
            {
                "ccn": ccn,
                "state": rec.get("state_code") or "",
                "rating": (ratings.get(ccn) or {}).get("overall_rating") or "",
                "chain": ccn in chain_ccns,
                "insp": ccn in insp_ccns,
                "defn": ccn in def_ccns,
                "enf": ccn in enf_ccns,
                "key": hashlib.sha256(f"{SAMPLE_SEED}|{ccn}".encode()).hexdigest(),
            }
        )
    rows.sort(key=lambda r: r["key"])
    selected: list[dict] = []
    seen: set[str] = set()
    states: set[str] = set()
    rating_n: Counter[str] = Counter()
    n_chain = n_non = n_def = n_enf = n_insp = 0

    def add(row: dict) -> None:
        nonlocal n_chain, n_non, n_def, n_enf, n_insp
        selected.append(row)
        seen.add(row["ccn"])
        if row["state"]:
            states.add(row["state"])
        rating_n[row["rating"] or "null"] += 1
        n_chain += int(row["chain"])
        n_non += int(not row["chain"])
        n_def += int(row["defn"])
        n_enf += int(row["enf"])
        n_insp += int(row["insp"])

    def needed(row: dict) -> bool:
        if len(selected) >= SAMPLE_N:
            return False
        if len(states) < 8 and row["state"] and row["state"] not in states:
            return True
        bucket = row["rating"] or "null"
        if rating_n[bucket] < 2:
            return True
        if row["chain"] and n_chain < 10:
            return True
        if not row["chain"] and n_non < 10:
            return True
        if row["defn"] and n_def < 10:
            return True
        if row["enf"] and n_enf < 8:
            return True
        if row["insp"] and n_insp < 10:
            return True
        return False

    for row in rows:
        if len(selected) >= SAMPLE_N:
            break
        if needed(row):
            add(row)
    for row in rows:
        if len(selected) >= SAMPLE_N:
            break
        if row["ccn"] not in seen:
            add(row)
    return [r["ccn"] for r in selected]


def privacy_scan(tables: dict[str, list[dict[str, str]]]) -> dict:
    counts: Counter[str] = Counter()
    bounded: list[dict[str, str]] = []
    for name, records in tables.items():
        for rec in records:
            for field, value in rec.items():
                if not value:
                    continue
                kinds = scan_field(name, field, value)
                for kind in kinds:
                    counts[kind] += 1
                    if len(bounded) < 8:
                        bounded.append({"table": name, "field": field, "pattern": kind})
                    # Do not record values. Official CMS description text is not sampled into git.
    critical = {k: v for k, v in counts.items() if k in CRITICAL_KINDS}
    return {
        "counts": dict(counts),
        "critical_counts": critical,
        "bounded_hits_field_only": bounded,
        "email_fail": counts.get("email", 0) > 0,
        "critical_fail": any(counts.get(k, 0) > 0 for k in CRITICAL_KINDS),
    }


def warehouse_compare(ccns: list[str], export: dict) -> dict:
    conn = connect()
    if conn is None:
        return {"error": "database_unreachable"}
    placeholders = ",".join(["%s"] * len(ccns))
    mismatches = []
    try:
        cur = conn.cursor()
        cur.execute("BEGIN")
        cur.execute("SET TRANSACTION READ ONLY")
        cur.execute("SET LOCAL timezone = 'UTC'")
        cur.execute("SET LOCAL extra_float_digits = 3")

        cur.execute(
            f"""
            WITH current_ingest AS (
              SELECT ir.id AS ingest_run_id, sr.id AS source_release_id, sr.release_key
              FROM source_dataset sd
              JOIN source_release sr ON sr.source_dataset_id = sd.id
              JOIN ingest_run ir ON ir.source_release_id = sr.id AND ir.status = 'succeeded'
              WHERE sd.dataset_key = 'nursing-home-provider-information'
              ORDER BY sr.source_modified_at DESC NULLS LAST,
                       sr.source_release_date DESC NULLS LAST, sr.release_key DESC,
                       ir.completed_at DESC, ir.transformation_version DESC, ir.id DESC
              LIMIT 1
            )
            SELECT pi.identifier_value, fs.provider_name, fs.state_code,
                   fs.certified_beds::text, fs.overall_rating::text,
                   fs.health_inspection_rating::text, fs.staffing_rating::text,
                   fs.quality_measure_rating::text
            FROM current_ingest ci
            JOIN facility_snapshot fs
              ON fs.source_release_id = ci.source_release_id AND fs.ingest_run_id = ci.ingest_run_id
            JOIN provider_identifier pi
              ON pi.provider_id = fs.provider_id AND pi.issuer='CMS' AND pi.identifier_type='CCN'
             AND pi.valid_from IS NULL
            WHERE pi.identifier_value IN ({placeholders})
            """,
            ccns,
        )
        fac_src = {r[0]: r for r in cur.fetchall()}

        cur.execute(
            f"""
            SELECT pi.identifier_value, COUNT(*)::bigint, MIN(ie.survey_date)::text, MAX(ie.survey_date)::text
            FROM inspection_event ie
            JOIN provider_identifier pi ON pi.provider_id = ie.provider_id
             AND pi.issuer='CMS' AND pi.identifier_type='CCN' AND pi.valid_from IS NULL
            WHERE pi.identifier_value IN ({placeholders})
            GROUP BY pi.identifier_value
            """,
            ccns,
        )
        insp_src = {r[0]: r for r in cur.fetchall()}

        cur.execute(
            f"""
            SELECT pi.identifier_value, COUNT(*)::bigint,
                   COUNT(*) FILTER (WHERE ie.id IS NULL)::bigint
            FROM deficiency_finding df
            JOIN provider_identifier pi ON pi.provider_id = df.provider_id
             AND pi.issuer='CMS' AND pi.identifier_type='CCN' AND pi.valid_from IS NULL
            LEFT JOIN inspection_event ie ON ie.id = df.inspection_event_id
            WHERE pi.identifier_value IN ({placeholders})
            GROUP BY pi.identifier_value
            """,
            ccns,
        )
        def_src = {r[0]: r for r in cur.fetchall()}

        cur.execute(
            f"""
            SELECT pi.identifier_value, COUNT(*)::bigint,
                   COUNT(*) FILTER (WHERE pe.penalty_type='Fine')::bigint
            FROM penalty_enforcement pe
            JOIN provider_identifier pi ON pi.provider_id = pe.provider_id
             AND pi.issuer='CMS' AND pi.identifier_type='CCN' AND pi.valid_from IS NULL
            WHERE pi.identifier_value IN ({placeholders})
            GROUP BY pi.identifier_value
            """,
            ccns,
        )
        enf_src = {r[0]: r for r in cur.fetchall()}

        cur.execute(
            f"""
            SELECT btrim(cp.provider_identifier), COUNT(*)::bigint
            FROM cms_chain_provider cp
            JOIN ingest_run ir ON ir.id = cp.ingest_run_id
            WHERE ir.transformation_version = 'cms-chain-membership-v1'
              AND btrim(cp.provider_identifier) IN ({placeholders})
            GROUP BY 1
            """,
            ccns,
        )
        chain_src = {r[0]: r[1] for r in cur.fetchall()}
        conn.rollback()
    finally:
        conn.close()

    fac_exp = {r["ccn"]: r for r in export["facilities"] if r["ccn"] in ccns}
    rat_exp = {r["ccn"]: r for r in export["facility_ratings"] if r["ccn"] in ccns}
    insp_exp = defaultdict(list)
    for r in export["facility_inspections"]:
        if r["ccn"] in ccns:
            insp_exp[r["ccn"]].append(r)
    def_exp = defaultdict(list)
    for r in export["facility_deficiencies"]:
        if r["ccn"] in ccns:
            def_exp[r["ccn"]].append(r)
    enf_exp = defaultdict(list)
    for r in export["facility_enforcement"]:
        if r["ccn"] in ccns:
            enf_exp[r["ccn"]].append(r)
    chain_exp = Counter(
        r["ccn"] for r in export["facility_chains"] if r["ccn"] in ccns
    )

    comparisons = 0
    for ccn in ccns:
        src = fac_src.get(ccn)
        exp = fac_exp.get(ccn)
        rat = rat_exp.get(ccn)
        if not src or not exp or not rat:
            mismatches.append({"ccn_hashed": hashlib.sha256(ccn.encode()).hexdigest()[:12], "kind": "missing_row"})
            continue
        pairs = [
            ("provider_name", src[1], exp.get("provider_name")),
            ("state_code", src[2], exp.get("state_code")),
            ("certified_beds", src[3] or "", exp.get("certified_beds") or ""),
            ("overall_rating", src[4] or "", rat.get("overall_rating") or ""),
            ("health_inspection_rating", src[5] or "", rat.get("health_inspection_rating") or ""),
            ("staffing_rating", src[6] or "", rat.get("staffing_rating") or ""),
            ("quality_measure_rating", src[7] or "", rat.get("quality_measure_rating") or ""),
        ]
        for field, a, b in pairs:
            comparisons += 1
            if (a or "") != (b or ""):
                mismatches.append({"kind": "field", "field": field})

        isrc = insp_src.get(ccn)
        irows = insp_exp.get(ccn, [])
        comparisons += 3
        icount = int(isrc[1]) if isrc else 0
        if icount != len(irows):
            mismatches.append({"kind": "inspection_count"})
        if isrc and irows:
            dates = sorted(r["survey_date"] for r in irows if r.get("survey_date"))
            if dates and (dates[0] != isrc[2] or dates[-1] != isrc[3]):
                mismatches.append({"kind": "inspection_date_range"})

        dsrc = def_src.get(ccn)
        drows = def_exp.get(ccn, [])
        comparisons += 2
        dcount = int(dsrc[1]) if dsrc else 0
        dunl = int(dsrc[2]) if dsrc else 0
        if dcount != len(drows):
            mismatches.append({"kind": "deficiency_count"})
        if dunl != sum(1 for r in drows if not r.get("academic_inspection_id")):
            mismatches.append({"kind": "deficiency_unlinked_count"})

        esrc = enf_src.get(ccn)
        erows = enf_exp.get(ccn, [])
        comparisons += 1
        ecount = int(esrc[1]) if esrc else 0
        if ecount != len(erows):
            mismatches.append({"kind": "enforcement_count"})

        comparisons += 1
        if int(chain_src.get(ccn, 0)) != int(chain_exp.get(ccn, 0)):
            mismatches.append({"kind": "chain_membership_count"})

    return {
        "comparisons": comparisons,
        "mismatches": len(mismatches),
        "mismatch_kinds": dict(Counter(m["kind"] for m in mismatches)),
        "unexplained_mismatches": len(mismatches),
    }


def main() -> int:
    if not RUN_DIR.exists():
        print(json.dumps({"status": "BLOCKED", "reason": "frozen extract missing"}))
        return 2

    hash_ok = {}
    rows_ok = True
    schema_ok = True
    tables = {}
    for name, expected_hash in EXPECTED_SHA256.items():
        digest = file_sha(name)
        hash_ok[name] = digest == expected_hash
        records = load_csv(name)
        tables[name] = records
        if len(records) != EXPECTED_ROWS[name]:
            rows_ok = False
        if not records:
            schema_ok = False

    fac = tables["facilities"]
    ratings = {r["ccn"]: r for r in tables["facility_ratings"]}
    chain_ccns = {r["ccn"] for r in tables["facility_chains"]}
    insp_ccns = {r["ccn"] for r in tables["facility_inspections"]}
    def_ccns = {r["ccn"] for r in tables["facility_deficiencies"]}
    enf_ccns = {r["ccn"] for r in tables["facility_enforcement"]}

    sample = pick_sample(fac, ratings, chain_ccns, insp_ccns, def_ccns, enf_ccns)
    sample_set = set(sample)
    states = sorted({r["state_code"] for r in fac if r["ccn"] in sample_set})
    rating_dist = Counter((ratings[c]["overall_rating"] or "null") for c in sample)
    n_chain = sum(1 for c in sample if c in chain_ccns)
    n_non = len(sample) - n_chain
    n_insp = sum(1 for c in sample if c in insp_ccns)
    n_def = sum(1 for c in sample if c in def_ccns)
    n_enf = sum(1 for c in sample if c in enf_ccns)

    privacy = privacy_scan(tables)
    compare = warehouse_compare(sample, tables)

    unlinked = sum(1 for r in tables["facility_deficiencies"] if not r.get("academic_inspection_id"))
    chain_outside = sum(1 for r in tables["facility_chains"] if r["ccn"] not in {f["ccn"] for f in fac})

    status = (
        "PASS"
        if all(hash_ok.values())
        and rows_ok
        and compare.get("unexplained_mismatches") == 0
        and not privacy["critical_fail"]
        and not privacy["email_fail"]
        else "FAIL"
    )
    report = {
        "status": status,
        "sample": {
            "facilities": len(sample),
            "states": states,
            "state_count": len(states),
            "overall_rating_distribution": dict(rating_dist),
            "chain": n_chain,
            "non_chain": n_non,
            "with_inspections": n_insp,
            "with_deficiencies": n_def,
            "with_enforcement": n_enf,
            "seed": SAMPLE_SEED,
        },
        "source_to_export": compare,
        "privacy": {
            "counts": privacy["counts"],
            "critical_fail": privacy["critical_fail"],
            "email_fail": privacy["email_fail"],
            "bounded_hits_field_only": privacy["bounded_hits_field_only"],
            "note": "Regex QA aid only; not a proof of absence of PII. CMS official_description wording is retained.",
        },
        "reproducibility": {
            "sha256_match_001b2b": hash_ok,
            "all_hashes_unchanged": all(hash_ok.values()),
            "row_counts_unchanged": rows_ok,
        },
        "explained": {
            "unlinked_deficiencies": unlinked,
            "chain_ccns_outside_current_facilities": chain_outside,
        },
        "published": False,
    }
    out = OUT_ROOT / "001b2b1-closeout-aggregate.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0 if status == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
