"""Academic 001B.2B — SELECT-only dual extract + integrity.

Writes gitignored CSVs. No production writes, no Google, no publish.
"""
from __future__ import annotations

import csv
import hashlib
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, urlunparse

import psycopg2

ASK_ROOT = Path(__file__).resolve().parents[1]
CARE_ROOT = Path(r"C:\Users\makei\care-trust-hub")
OUT_ROOT = ASK_ROOT / "data" / "academic-internal" / "001b2b"

TS = "to_char(%s AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')"
BOOL = "CASE WHEN {c} IS TRUE THEN 'true' WHEN {c} IS FALSE THEN 'false' ELSE NULL END"

CURRENT_INGEST = """current_ingest AS (
  SELECT ir.id AS ingest_run_id, sr.id AS source_release_id, sr.release_key,
         sr.source_modified_at, sr.retrieved_at, ir.completed_at, ir.transformation_version,
         sd.dataset_key
  FROM source_dataset sd
  JOIN source_release sr ON sr.source_dataset_id = sd.id
  JOIN ingest_run ir ON ir.source_release_id = sr.id AND ir.status = 'succeeded'
  WHERE sd.dataset_key = 'nursing-home-provider-information'
  ORDER BY sr.source_modified_at DESC NULLS LAST,
           sr.source_release_date DESC NULLS LAST, sr.release_key DESC,
           ir.completed_at DESC, ir.transformation_version DESC, ir.id DESC
  LIMIT 1
)"""

PI_JOIN = """JOIN facility_snapshot fs
    ON fs.source_release_id = ci.source_release_id AND fs.ingest_run_id = ci.ingest_run_id
  JOIN provider_identifier pi
    ON pi.provider_id = fs.provider_id AND pi.issuer = 'CMS' AND pi.identifier_type = 'CCN'
   AND pi.valid_from IS NULL"""


def ccn_join(alias: str) -> str:
    return f"""JOIN provider_identifier pi
    ON pi.provider_id = {alias}.provider_id AND pi.issuer = 'CMS' AND pi.identifier_type = 'CCN'
   AND pi.valid_from IS NULL"""


def provenance(fact: str) -> str:
    return f"""
  sd.dataset_key::text AS source_dataset_key,
  sr.release_key::text AS source_release_key,
  {TS % "sr.source_modified_at"} AS source_modified_at,
  {TS % "sr.retrieved_at"} AS retrieved_at,
  {TS % "ir.completed_at"} AS ingest_completed_at,
  {fact}.transformation_version::text AS transformation_version,
  {fact}.source_record_locator::text AS source_record_locator"""


TABLES = {
    "facilities": {
        "expected": 14693,
        "pk": ["ccn"],
        "sql": f"""WITH {CURRENT_INGEST}
SELECT
  pi.identifier_value::text AS ccn,
  fs.provider_name::text AS provider_name,
  fs.legal_business_name::text AS legal_business_name,
  fs.address::text AS address,
  fs.city::text AS city,
  fs.state_code::text AS state_code,
  fs.zip_code::text AS zip_code,
  fs.county_name::text AS county_name,
  fs.ownership_type::text AS ownership_type,
  fs.certified_beds::text AS certified_beds,
  fs.participation_type::text AS participation_type,
  {BOOL.format(c="fs.participates_medicare")} AS participates_medicare,
  {BOOL.format(c="fs.participates_medicaid")} AS participates_medicaid,
  fs.source_latitude::text AS source_latitude,
  fs.source_longitude::text AS source_longitude,
  ci.dataset_key::text AS source_dataset_key,
  ci.release_key::text AS source_release_key,
  {TS % "ci.source_modified_at"} AS source_modified_at,
  {TS % "ci.retrieved_at"} AS retrieved_at,
  {TS % "ci.completed_at"} AS ingest_completed_at,
  ci.transformation_version::text AS transformation_version,
  fs.source_record_locator::text AS source_record_locator
FROM current_ingest ci
{PI_JOIN}
ORDER BY pi.identifier_value""",
    },
    "facility_ratings": {
        "expected": 14693,
        "pk": ["ccn", "source_release_key"],
        "sql": f"""WITH {CURRENT_INGEST}
SELECT
  pi.identifier_value::text AS ccn,
  ci.release_key::text AS source_release_key,
  fs.overall_rating::text AS overall_rating,
  fs.health_inspection_rating::text AS health_inspection_rating,
  fs.staffing_rating::text AS staffing_rating,
  fs.quality_measure_rating::text AS quality_measure_rating,
  ci.dataset_key::text AS source_dataset_key,
  {TS % "ci.source_modified_at"} AS source_modified_at,
  {TS % "ci.retrieved_at"} AS retrieved_at,
  {TS % "ci.completed_at"} AS ingest_completed_at,
  ci.transformation_version::text AS transformation_version,
  fs.source_record_locator::text AS source_record_locator
FROM current_ingest ci
{PI_JOIN}
ORDER BY pi.identifier_value, ci.release_key""",
    },
    "facility_inspections": {
        "expected": 149705,
        "pk": ["academic_inspection_id"],
        "sql": f"""SELECT
  ie.event_key::text AS academic_inspection_id,
  pi.identifier_value::text AS ccn,
  ie.survey_date::text AS survey_date,
  ie.survey_type::text AS survey_type,
  ie.survey_cycle::text AS survey_cycle,
  ie.processing_date::text AS processing_date,
  {provenance("ie")}
FROM inspection_event ie
{ccn_join("ie")}
JOIN source_release sr ON sr.id = ie.source_release_id
JOIN source_dataset sd ON sd.id = sr.source_dataset_id
JOIN ingest_run ir ON ir.id = ie.ingest_run_id
ORDER BY ie.event_key""",
    },
    "facility_deficiencies": {
        "expected": 418344,
        "pk": ["academic_deficiency_id"],
        "sql": f"""SELECT
  df.finding_key::text AS academic_deficiency_id,
  pi.identifier_value::text AS ccn,
  ie.event_key::text AS academic_inspection_id,
  df.survey_date::text AS survey_date,
  df.survey_type::text AS survey_type,
  df.inspection_cycle::text AS inspection_cycle,
  df.deficiency_prefix::text AS deficiency_prefix,
  df.deficiency_tag::text AS deficiency_tag,
  df.deficiency_category::text AS deficiency_category,
  df.official_description::text AS official_description,
  df.scope_severity_code::text AS scope_severity_code,
  df.deficiency_corrected::text AS deficiency_corrected,
  df.correction_date::text AS correction_date,
  {BOOL.format(c="df.standard_deficiency")} AS standard_deficiency,
  {BOOL.format(c="df.complaint_deficiency")} AS complaint_deficiency,
  {BOOL.format(c="df.infection_control_deficiency")} AS infection_control_deficiency,
  {BOOL.format(c="df.citation_under_idr")} AS citation_under_idr,
  {BOOL.format(c="df.citation_under_iidr")} AS citation_under_iidr,
  df.processing_date::text AS processing_date,
  {provenance("df")}
FROM deficiency_finding df
{ccn_join("df")}
LEFT JOIN inspection_event ie ON ie.id = df.inspection_event_id
JOIN source_release sr ON sr.id = df.source_release_id
JOIN source_dataset sd ON sd.id = sr.source_dataset_id
JOIN ingest_run ir ON ir.id = df.ingest_run_id
ORDER BY df.finding_key""",
    },
    "facility_enforcement": {
        "expected": 16166,
        "pk": ["academic_enforcement_id"],
        "sql": f"""SELECT
  pe.penalty_key::text AS academic_enforcement_id,
  pi.identifier_value::text AS ccn,
  pe.penalty_date::text AS penalty_date,
  pe.penalty_type::text AS penalty_type,
  pe.fine_id::text AS fine_id,
  pe.fine_amount::text AS fine_amount,
  pe.payment_denial_start_date::text AS payment_denial_start_date,
  pe.payment_denial_days::text AS payment_denial_days,
  pe.processing_date::text AS processing_date,
  {provenance("pe")}
FROM penalty_enforcement pe
{ccn_join("pe")}
JOIN source_release sr ON sr.id = pe.source_release_id
JOIN source_dataset sd ON sd.id = sr.source_dataset_id
JOIN ingest_run ir ON ir.id = pe.ingest_run_id
ORDER BY pe.penalty_key""",
    },
    "facility_chains": {
        "expected": 10231,
        "pk": ["chain_id", "ccn", "source_release_key"],
        "sql": f"""SELECT
  ch.cms_chain_id::text AS chain_id,
  btrim(cp.provider_identifier)::text AS ccn,
  sr.release_key::text AS source_release_key,
  cp.chain_name::text AS chain_name,
  cp.enrollment_id::text AS enrollment_id,
  sd.dataset_key::text AS source_dataset_key,
  {TS % "sr.source_modified_at"} AS source_modified_at,
  {TS % "sr.retrieved_at"} AS retrieved_at,
  {TS % "ir.completed_at"} AS ingest_completed_at,
  cp.transformation_version::text AS transformation_version,
  cp.source_record_locator::text AS source_record_locator
FROM cms_chain_provider cp
JOIN cms_chain ch ON ch.id = cp.chain_id
JOIN source_release sr ON sr.id = cp.source_release_id
JOIN source_dataset sd ON sd.id = sr.source_dataset_id
JOIN ingest_run ir ON ir.id = cp.ingest_run_id
WHERE ir.transformation_version = 'cms-chain-membership-v1'
ORDER BY ch.cms_chain_id, btrim(cp.provider_identifier), sr.release_key, cp.enrollment_id""",
    },
    "sources": {
        "expected": 5,
        "pk": ["source_dataset_key", "source_release_key", "transformation_version"],
        "sql": f"""SELECT
  sd.dataset_key::text AS source_dataset_key,
  CASE sd.dataset_key
    WHEN 'nursing-home-provider-information' THEN '4pq5-n9py'
    WHEN 'nursing-home-inspection-dates' THEN 'svdt-c123'
    WHEN 'nursing-home-health-deficiencies' THEN 'r5ix-sfxw'
    WHEN 'nursing-home-penalties' THEN 'g6vv-u9sr'
    WHEN 'skilled-nursing-facility-enrollments' THEN '5f2c306f-3b1c-42cd-b037-187b2ce22126'
  END AS cms_dataset_identifier,
  sd.display_name::text AS official_name,
  sr.official_source_url::text AS official_landing_url,
  sr.release_key::text AS source_release_key,
  sr.source_release_date::text AS source_release_date,
  {TS % "sr.source_modified_at"} AS source_modified_at,
  {TS % "sr.retrieved_at"} AS retrieved_at,
  sr.content_sha256::text AS content_sha256,
  ir.transformation_version::text AS transformation_version,
  ir.status::text AS ingest_status,
  ir.rows_read::text AS rows_read,
  ir.valid_rows::text AS valid_rows,
  ir.rejected_rows::text AS rejected_rows,
  {TS % "ir.completed_at"} AS ingest_completed_at
FROM source_dataset sd
JOIN source_release sr ON sr.source_dataset_id = sd.id
JOIN ingest_run ir ON ir.source_release_id = sr.id
WHERE ir.status = 'succeeded'
  AND (
    (sd.dataset_key = 'nursing-home-provider-information' AND ir.transformation_version = 'provider-information-v2')
    OR (sd.dataset_key = 'nursing-home-inspection-dates' AND ir.transformation_version = 'inspection-dates-v1')
    OR (sd.dataset_key = 'nursing-home-health-deficiencies' AND ir.transformation_version = 'health-deficiencies-v1')
    OR (sd.dataset_key = 'nursing-home-penalties' AND ir.transformation_version = 'penalties-v1')
    OR (sd.dataset_key = 'skilled-nursing-facility-enrollments' AND ir.transformation_version = 'cms-chain-membership-v1')
  )
ORDER BY sd.dataset_key, sr.release_key, ir.transformation_version""",
    },
}

FORBIDDEN_HEADER_SUBSTR = (
    "telephone",
    "raw_record",
    "attributes",
    "provider_id",
    "inspection_event_id",
    "google",
    "place_id",
    "confidence",
    "source_dataset_id",
)


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        t = line.strip()
        if not t or t.startswith("#") or "=" not in t:
            continue
        key, _, val = t.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        os.environ.setdefault(key, val)


def prefer_session_pooler(url: str) -> str:
    parsed = urlparse(url)
    if "pooler.supabase.com" in (parsed.hostname or "") and parsed.port == 6543:
        parsed = parsed._replace(netloc=parsed.netloc.replace(":6543", ":5432"))
        return urlunparse(parsed)
    return url


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def count_data_rows(path: Path) -> int:
    with path.open("r", encoding="utf-8", newline="") as fh:
        reader = csv.reader(fh)
        next(reader, None)
        return sum(1 for _ in reader)


def extract_one(cur, dest: Path) -> dict:
    dest.mkdir(parents=True, exist_ok=True)
    files = {}
    for name, spec in TABLES.items():
        path = dest / f"{name}.csv"
        sql = spec["sql"].strip().rstrip(";")
        copy_sql = f"COPY ({sql}) TO STDOUT WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')"
        with path.open("w", encoding="utf-8", newline="") as fh:
            cur.copy_expert(copy_sql, fh)
        files[name] = {
            "rows": count_data_rows(path),
            "bytes": path.stat().st_size,
            "sha256": sha256_file(path),
        }
    return files


def qa_run(dest: Path) -> dict:
    issues = []
    explained = []
    headers_by = {}
    pii = {"ssn": 0, "email": 0, "google_place": 0, "google_url": 0}
    ssn_re = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
    email_re = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I)
    google_url_re = re.compile(r"googleapis\.com|googleusercontent\.com|maps\.google", re.I)
    place_re = re.compile(r"\bChIJ[A-Za-z0-9_-]{20,}\b")

    facility_ccns = set()
    inspection_ids = set()
    unlinked = 0
    bad_link = 0
    chain_orphans = 0

    def open_dict(name: str):
        path = dest / f"{name}.csv"
        fh = path.open("r", encoding="utf-8", newline="")
        reader = csv.DictReader(fh)
        return fh, reader

    fh, reader = open_dict("facilities")
    headers_by["facilities"] = reader.fieldnames or []
    for rec in reader:
        facility_ccns.add(rec.get("ccn") or "")
    fh.close()

    fh, reader = open_dict("facility_inspections")
    headers_by["facility_inspections"] = reader.fieldnames or []
    for rec in reader:
        inspection_ids.add(rec.get("academic_inspection_id") or "")
    fh.close()

    for name, spec in TABLES.items():
        fh, reader = open_dict(name)
        headers = reader.fieldnames or []
        headers_by[name] = headers
        for h in headers:
            low = h.lower()
            if any(tok == low or tok in low for tok in FORBIDDEN_HEADER_SUBSTR):
                issues.append({"table": name, "kind": "excluded_header", "header": h})
        pk_seen: set[str] = set()
        dup = 0
        rows = 0
        missing_parent = 0
        for rec in reader:
            rows += 1
            key = "\x1f".join(rec.get(k) or "" for k in spec["pk"])
            if key in pk_seen:
                dup += 1
            else:
                pk_seen.add(key)
            for v in rec.values():
                if not v:
                    continue
                if ssn_re.search(v):
                    pii["ssn"] += 1
                if email_re.search(v):
                    pii["email"] += 1
                if google_url_re.search(v):
                    pii["google_url"] += 1
                if place_re.search(v):
                    pii["google_place"] += 1
            if name == "facility_deficiencies":
                insp = rec.get("academic_inspection_id") or ""
                if not insp:
                    unlinked += 1
                elif insp not in inspection_ids:
                    bad_link += 1
            if name != "facilities" and name != "sources" and "ccn" in rec:
                ccn = rec.get("ccn") or ""
                if ccn and ccn not in facility_ccns:
                    if name == "facility_chains":
                        chain_orphans += 1
                    else:
                        missing_parent += 1
            for v in rec.values():
                pass
        fh.close()
        if rows != spec["expected"]:
            issues.append(
                {"table": name, "kind": "row_count_mismatch", "expected": spec["expected"], "actual": rows}
            )
        if dup:
            issues.append({"table": name, "kind": "duplicate_pk", "count": dup})
        if missing_parent:
            issues.append({"table": name, "kind": "fk_orphan", "column": "ccn", "count": missing_parent})

    if unlinked:
        explained.append(
            {
                "table": "facility_deficiencies",
                "kind": "nullable_inspection_fk",
                "count": unlinked,
                "note": "Documented incomplete CMS join; freeze expected 30374.",
            }
        )
    if bad_link:
        issues.append(
            {"table": "facility_deficiencies", "kind": "fk_orphan", "column": "academic_inspection_id", "count": bad_link}
        )
    if chain_orphans:
        explained.append(
            {
                "table": "facility_chains",
                "kind": "fk_orphan_explained",
                "column": "ccn",
                "count": chain_orphans,
                "note": "Enrollment membership CCN not in current Provider Information snapshot.",
            }
        )
    if pii["ssn"] or pii["google_place"] or pii["google_url"]:
        issues.append({"kind": "critical_pii_or_google_leak", "pii": pii})

    return {
        "issues": issues,
        "explained": explained,
        "pii": pii,
        "unlinked_deficiencies": unlinked,
        "chain_ccn_not_in_current_facilities": chain_orphans,
        "headers": headers_by,
    }


def connect():
    for p in (
        CARE_ROOT / "apps" / "web" / ".env.local",
        CARE_ROOT / "apps" / "web" / ".env",
        CARE_ROOT / ".env.local",
        CARE_ROOT / "services" / "ingest" / ".env.local",
    ):
        load_env_file(p)
    url = os.environ.get("CARE_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not url:
        return None
    sslmode = os.environ.get("CARE_DATABASE_SSL") or "require"
    if sslmode == "disable":
        sslmode = "disable"
    elif sslmode == "verify-full":
        sslmode = "verify-full"
    else:
        sslmode = "require"
    conn = psycopg2.connect(prefer_session_pooler(url), sslmode=sslmode)
    conn.set_session(readonly=True, autocommit=False)
    return conn


def extract_run(label: str) -> dict:
    dest = OUT_ROOT / label
    conn = connect()
    if conn is None:
        return {"error": {"database_reachable": False, "query_mode": "NOT_ATTEMPTED"}}
    try:
        cur = conn.cursor()
        cur.execute("BEGIN")
        cur.execute("SET TRANSACTION READ ONLY")
        cur.execute("SET LOCAL timezone = 'UTC'")
        cur.execute("SET LOCAL extra_float_digits = 3")
        cur.execute("SET LOCAL statement_timeout = '1200000'")
        cur.execute("SELECT current_setting('transaction_read_only')")
        ro = cur.fetchone()[0]
        files = extract_one(cur, dest)
        conn.rollback()
        return {"dir": str(dest), "files": files, "transaction_read_only": ro}
    except Exception as exc:
        try:
            conn.rollback()
        except Exception:
            pass
        msg = re.sub(r"postgresql://\S+", "[redacted]", str(exc))
        return {"error": {"database_reachable": False, "query_mode": "FAILED", "message": msg}}
    finally:
        conn.close()


def main() -> int:
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    run_a = extract_run("run-a")
    if run_a.get("error"):
        report = {"status": "BLOCKED", **run_a["error"]}
        (OUT_ROOT / "integrity-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(json.dumps(report, indent=2))
        return 2
    run_b = extract_run("run-b")
    if run_b.get("error"):
        report = {"status": "BLOCKED", **run_b["error"]}
        (OUT_ROOT / "integrity-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(json.dumps(report, indent=2))
        return 2

    compare = {}
    hash_match = True
    for name in TABLES:
        a = run_a["files"][name]
        b = run_b["files"][name]
        same = a["sha256"] == b["sha256"] and a["rows"] == b["rows"] and a["bytes"] == b["bytes"]
        if not same:
            hash_match = False
        compare[name] = {
            "rows_a": a["rows"],
            "rows_b": b["rows"],
            "bytes_a": a["bytes"],
            "bytes_b": b["bytes"],
            "sha256_a": a["sha256"],
            "sha256_b": b["sha256"],
            "match": same,
        }

    qa = qa_run(Path(run_a["dir"]))
    checksums = "".join(f"{meta['sha256']}  {name}.csv\n" for name, meta in run_a["files"].items())
    (Path(run_a["dir"]) / "checksums.sha256").write_text(checksums, encoding="utf-8")
    (Path(run_b["dir"]) / "checksums.sha256").write_text(checksums, encoding="utf-8")

    status = "PASS" if hash_match and not qa["issues"] else "FAIL"
    report = {
        "status": status,
        "counted_at": datetime.now(timezone.utc).isoformat(),
        "query_mode": "SELECT_ONLY_READ_ONLY_TRANSACTION",
        "transaction_read_only": run_a["transaction_read_only"],
        "dual_extract_hash_match": hash_match,
        "compare": compare,
        "qa": {
            "issues": qa["issues"],
            "explained": qa["explained"],
            "pii": qa["pii"],
            "unlinked_deficiencies": qa["unlinked_deficiencies"],
            "chain_ccn_not_in_current_facilities": qa["chain_ccn_not_in_current_facilities"],
            "headers": qa["headers"],
        },
        "output_root": str(OUT_ROOT),
        "published": False,
    }
    (OUT_ROOT / "integrity-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0 if status == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
