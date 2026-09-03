#!/usr/bin/env python3
"""ATH-TX-001 — acquire SMALL official files only. Giant dumps stay gitignored."""
from __future__ import annotations

import csv
import io
import json
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "texas"
OUT = ROOT / "data" / "network" / "texas"
UA = "AskTrustHub/ath-tx-001-research"
RAW.mkdir(parents=True, exist_ok=True)


def request(url: str, timeout: int = 120) -> tuple[int, bytes, dict]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.read(), dict(resp.headers)


def head_or_get_meta(url: str) -> dict:
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            headers = dict(resp.headers)
            return {
                "url": url,
                "status": resp.status,
                "content_type": headers.get("Content-Type"),
                "content_length": headers.get("Content-Length"),
                "last_modified": headers.get("Last-Modified"),
            }
    except Exception as exc:  # noqa: BLE001
        try:
            code, body, headers = request(url, timeout=60)
            return {
                "url": url,
                "status": code,
                "content_type": headers.get("Content-Type"),
                "content_length": headers.get("Content-Length") or str(len(body)),
                "last_modified": headers.get("Last-Modified"),
                "got_body": True,
                "bytes": len(body),
            }
        except Exception as exc2:  # noqa: BLE001
            return {"url": url, "error": f"{exc} / {exc2}"}


def soda(url_path: str, params: dict) -> object:
    url = url_path + "?" + urllib.parse.urlencode(params)
    _, body, _ = request(url)
    return json.loads(body.decode("utf-8"))


def download_csv(url: str, dest: Path, max_bytes: int = 8_000_000) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = resp.read(max_bytes + 1)
        headers = dict(resp.headers)
    truncated = len(data) > max_bytes
    if truncated:
        data = data[:max_bytes]
    else:
        dest.write_bytes(data)
    text = data.decode("utf-8", "replace")
    # TDLR files are comma-delimited, quoted.
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    header = rows[0] if rows else []
    body_rows = rows[1:]
    # If truncated mid-file, drop last incomplete row.
    if truncated and body_rows:
        body_rows = body_rows[:-1]
    return {
        "url": url,
        "status": 200,
        "saved": str(dest) if not truncated else None,
        "truncated": truncated,
        "content_length_header": headers.get("Content-Length"),
        "bytes_read": len(data),
        "header": header,
        "row_count_complete": None if truncated else max(0, len(rows) - 1),
        "sample": body_rows[:3],
    }


def main() -> int:
    report: dict = {"retrieved_at": datetime.now(timezone.utc).isoformat()}

    print("HEAD CMBL / TDLR bulk files", flush=True)
    report["heads"] = {}
    for key, url in {
        "cmbl_web_name": "https://comptroller.texas.gov/auto-data/purchasing/web_name.csv",
        "cmbl_vnr_name": "https://comptroller.texas.gov/auto-data/purchasing/vnr_name.csv",
        "cmbl_vnr_clas": "https://comptroller.texas.gov/auto-data/purchasing/vnr_clas.csv",
        "cmbl_hub_name": "https://comptroller.texas.gov/auto-data/purchasing/hub_name.csv",
        "cmbl_web_all": "https://comptroller.texas.gov/auto-data/purchasing/web_all_name.csv",
        "cmbl_layout": "https://comptroller.texas.gov/purchasing/downloads/web_name_doc.txt",
        "tdlr_all": "https://www.tdlr.texas.gov/dbproduction2/ltlicfile.csv",
        "tdlr_ac_contractor": "https://www.tdlr.texas.gov/dbproduction2/ltairref.csv",
        "tdlr_electrical_contractor": "https://www.tdlr.texas.gov/dbproduction2/Lteecele.csv",
        "tdlr_tow_companies": "https://www.tdlr.texas.gov/dbproduction2/TowCompanies.csv",
        "tdlr_format": "https://www.tdlr.texas.gov/dbproduction2/lrformat.txt",
        "tdlr_tow_format": "https://www.tdlr.texas.gov/dbproduction2/ttvsfformat.txt",
    }.items():
        print(f"  {key}", flush=True)
        report["heads"][key] = head_or_get_meta(url)
        print(f"    {report['heads'][key]}", flush=True)

    print("download small TDLR contractor files", flush=True)
    report["files"] = {}
    for key, url, name in [
        ("tdlr_ac_contractor", "https://www.tdlr.texas.gov/dbproduction2/ltairref.csv", "ltairref.csv"),
        ("tdlr_electrical_contractor", "https://www.tdlr.texas.gov/dbproduction2/Lteecele.csv", "Lteecele.csv"),
        ("tdlr_tow_companies", "https://www.tdlr.texas.gov/dbproduction2/TowCompanies.csv", "TowCompanies.csv"),
        ("sml_enforcement", "https://www.sml.texas.gov/wp-content/uploads/2025/10/sml_enforcement_orders_data_10_16_2025.csv", "sml_enforcement.csv"),
        ("cmbl_layout", "https://comptroller.texas.gov/purchasing/downloads/web_name_doc.txt", "web_name_doc.txt"),
        ("tdlr_format", "https://www.tdlr.texas.gov/dbproduction2/lrformat.txt", "lrformat.txt"),
        ("tdlr_tow_format", "https://www.tdlr.texas.gov/dbproduction2/ttvsfformat.txt", "ttvsfformat.txt"),
    ]:
        print(f"  GET {key}", flush=True)
        try:
            report["files"][key] = download_csv(url, RAW / name)
            rc = report["files"][key].get("row_count_complete")
            print(f"    rows={rc} header={report['files'][key]['header'][:8]}", flush=True)
        except Exception as exc:  # noqa: BLE001
            report["files"][key] = {"url": url, "error": str(exc)}
            print(f"    ERR {exc}", flush=True)

    print("stream first 4 CMBL rows only", flush=True)
    try:
        req = urllib.request.Request(
            "https://comptroller.texas.gov/auto-data/purchasing/web_name.csv",
            headers={"User-Agent": UA},
        )
        with urllib.request.urlopen(req, timeout=90) as resp:
            chunk = resp.read(32_000)
            clen = resp.headers.get("Content-Length")
        text = chunk.decode("utf-8", "replace")
        reader = csv.reader(io.StringIO(text))
        rows = []
        for i, row in enumerate(reader):
            rows.append(row)
            if i >= 3:
                break
        report["cmbl_sample"] = {"content_length": clen, "header": rows[0] if rows else [], "rows": rows[1:4]}
        print(f"  CMBL header={report['cmbl_sample']['header'][:12]} len={clen}", flush=True)
    except Exception as exc:  # noqa: BLE001
        report["cmbl_sample"] = {"error": str(exc)}
        print(f"  ERR {exc}", flush=True)

    print("SODA unique identity counts", flush=True)
    try:
        report["tdi_agency_unique_npn"] = soda(
            "https://data.texas.gov/resource/3yqc-fcdt.json",
            {"$select": "count(distinct npn) as n"},
        )
        report["tdi_agency_tx"] = soda(
            "https://data.texas.gov/resource/3yqc-fcdt.json",
            {"$select": "count(*) as n", "$where": "state='TX'"},
        )
        report["tdi_agency_appt_unique_npn"] = soda(
            "https://data.texas.gov/resource/avjc-7u2m.json",
            {"$select": "count(distinct npn) as n"},
        )
        report["tdi_agency_appt_unique_naic"] = soda(
            "https://data.texas.gov/resource/avjc-7u2m.json",
            {"$select": "count(distinct naic_id) as n"},
        )
        print("  unique counts ok", report.get("tdi_agency_unique_npn"), flush=True)
    except Exception as exc:  # noqa: BLE001
        report["unique_error"] = str(exc)
        print(f"  ERR {exc}", flush=True)

    print("TSBPE CSV links", flush=True)
    try:
        _, body, _ = request("https://tsbpe.texas.gov/free-licensee-list/")
        html = body.decode("utf-8", "replace")
        hrefs = sorted(set(re.findall(r'https?://[^"\']+\.csv', html, flags=re.I)))
        hrefs += sorted(set(re.findall(r'href="([^"]+\.csv)"', html, flags=re.I)))
        report["tsbpe_csv_hrefs"] = hrefs
        report["tsbpe_text_hits"] = re.findall(r"(Responsible Master Plumber[^<]{0,80}|Master Plumber List[^<]{0,80})", html)
        print(f"  hrefs={hrefs[:12]}", flush=True)
    except Exception as exc:  # noqa: BLE001
        report["tsbpe"] = {"error": str(exc)}
        print(f"  ERR {exc}", flush=True)

    print("CMS NH TX count", flush=True)
    try:
        url = (
            "https://data.cms.gov/provider-data/api/1/datastore/query/4pq5-n9py/0?"
            + urllib.parse.urlencode(
                {
                    "conditions[0][property]": "state",
                    "conditions[0][operator]": "=",
                    "conditions[0][value]": "TX",
                    "limit": "0",
                    "count": "true",
                }
            )
        )
        _, body, _ = request(url)
        report["cms_nh_tx"] = json.loads(body.decode("utf-8"))
        print(f"  cms={str(report['cms_nh_tx'])[:200]}", flush=True)
    except Exception as exc:  # noqa: BLE001
        report["cms_nh_tx"] = {"error": str(exc)}
        print(f"  ERR {exc}", flush=True)

    (OUT / "probe-acquire.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print("WROTE", OUT / "probe-acquire.json", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
