#!/usr/bin/env python3
from __future__ import annotations

import csv
import io
import json
import urllib.parse
import urllib.request
from pathlib import Path

UA = "AskTrustHub/ath-tx-001-research"
RAW = Path(__file__).resolve().parents[2] / "data" / "raw" / "texas"
OUT = Path(__file__).resolve().parents[2] / "data" / "network" / "texas"


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=90) as resp:
        return resp.read()


def soda(ds: str, params: dict) -> object:
    url = f"https://data.texas.gov/resource/{ds}.json?" + urllib.parse.urlencode(params)
    return json.loads(get(url).decode("utf-8"))


def main() -> int:
    report: dict = {}
    queries = {
        "ac_all": {"$select": "count(*) as n", "$where": "license_type='A/C Contractor'"},
        "ac_phone": {
            "$select": "count(*) as n",
            "$where": "license_type='A/C Contractor' AND business_telephone IS NOT NULL AND business_telephone != ''",
        },
        "ac_addr": {
            "$select": "count(*) as n",
            "$where": "license_type='A/C Contractor' AND business_address_line1 IS NOT NULL AND business_address_line1 != ''",
        },
        "ec_phone": {
            "$select": "count(*) as n",
            "$where": "license_type='Electrical Contractor' AND business_telephone IS NOT NULL AND business_telephone != ''",
        },
        "tdlr_phone": {
            "$select": "count(*) as n",
            "$where": "business_telephone IS NOT NULL AND business_telephone != ''",
        },
        "tdlr_addr": {
            "$select": "count(*) as n",
            "$where": "business_address_line1 IS NOT NULL AND business_address_line1 != ''",
        },
    }
    for key, params in queries.items():
        print("SODA", key, flush=True)
        try:
            report[key] = soda("7358-krk7", params)
            print(" ", report[key], flush=True)
        except Exception as exc:  # noqa: BLE001
            report[key] = {"error": str(exc)}
            print("  ERR", exc, flush=True)

    for key, url in {
        "rmp": "https://tsbpe.texas.gov/wp-content/uploads/2015/03/RMP.csv",
        "mp": "https://tsbpe.texas.gov/wp-content/uploads/2015/03/MP.csv",
    }.items():
        print("GET", key, flush=True)
        body = get(url)
        (RAW / f"{key}.csv").write_bytes(body)
        rows = list(csv.reader(io.StringIO(body.decode("utf-8-sig", "replace"))))
        report[key] = {"bytes": len(body), "header": rows[0][:20], "rows": max(0, len(rows) - 1), "sample": rows[1][:12] if len(rows) > 1 else None}
        print(" ", report[key]["rows"], report[key]["header"][:8], flush=True)

    print("GET vnr_clas", flush=True)
    body = get("https://comptroller.texas.gov/auto-data/purchasing/vnr_clas.csv")
    (RAW / "vnr_clas.csv").write_bytes(body)
    rows = list(csv.reader(io.StringIO(body.decode("utf-8-sig", "replace"))))
    header = rows[0]
    report["vnr_clas"] = {"bytes": len(body), "header": header, "rows": max(0, len(rows) - 1), "sample": rows[1][:12] if len(rows) > 1 else None}
    print(" ", report["vnr_clas"]["rows"], header, flush=True)

    (OUT / "probe-occupancy.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print("WROTE occupancy", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
