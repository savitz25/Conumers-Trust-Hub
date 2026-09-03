#!/usr/bin/env python3
"""ATH-TX-001 — probe official Texas bulk sources. No /texas UI. No scraping."""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "network" / "texas"
UA = "AskTrustHub/ath-tx-001-research"


def get_json(url: str, timeout: int = 90) -> object:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def soda_count(dataset: str) -> int | None:
    url = f"https://data.texas.gov/resource/{dataset}.json?" + urllib.parse.urlencode({"$select": "count(*)"})
    payload = get_json(url)
    if isinstance(payload, list) and payload:
        return int(payload[0].get("count") or payload[0].get("count_1") or 0)
    return None


def soda_group(dataset: str, field: str, limit: int = 80) -> list[dict]:
    url = (
        f"https://data.texas.gov/resource/{dataset}.json?"
        + urllib.parse.urlencode(
            {"$select": f"{field},count(*) as n", "$group": field, "$order": "n DESC", "$limit": str(limit)}
        )
    )
    payload = get_json(url)
    assert isinstance(payload, list)
    return payload


def soda_sample(dataset: str, select: str, limit: int = 3) -> list[dict]:
    url = f"https://data.texas.gov/resource/{dataset}.json?" + urllib.parse.urlencode(
        {"$select": select, "$limit": str(limit)}
    )
    payload = get_json(url)
    assert isinstance(payload, list)
    return payload


def views_meta(dataset: str) -> dict:
    meta = get_json(f"https://data.texas.gov/api/views/{dataset}.json")
    assert isinstance(meta, dict)
    cols = [
        {
            "name": c.get("name"),
            "field": c.get("fieldName"),
            "type": c.get("dataTypeName"),
        }
        for c in meta.get("columns", [])
        if not str(c.get("fieldName", "")).startswith(":@")
    ]
    return {
        "id": meta.get("id"),
        "name": meta.get("name"),
        "attribution": meta.get("attribution"),
        "description": (meta.get("description") or "")[:500],
        "rowsUpdatedAt": meta.get("rowsUpdatedAt"),
        "viewLastModified": meta.get("viewLastModified"),
        "downloadCount": meta.get("downloadCount"),
        "columns": cols,
    }


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    report: dict = {"retrieved_at": datetime.now(timezone.utc).isoformat(), "datasets": {}}

    datasets = {
        "tdlr_all": "7358-krk7",
        "tsbpe_plumbers": "qced-zkby",
        "tdi_agencies": "3yqc-fcdt",
        "tdi_agent_appointments": "ft7p-v8a7",
        "tdi_surplus": "7isd-ex6t",
        "tdi_title_appts": "y9ze-ft94",
        "tdi_agents": "kxv3-diwf",
        "hhsc_ccl": "bc5r-88dy",
    }

    for key, ds in datasets.items():
        print(f"probing {key} {ds}", flush=True)
        try:
            meta = views_meta(ds)
            count = soda_count(ds)
            report["datasets"][key] = {"ok": True, "count": count, "meta": meta}
            print(f"  count={count} cols={len(meta['columns'])}", flush=True)
        except Exception as exc:  # noqa: BLE001
            report["datasets"][key] = {"ok": False, "error": str(exc)}
            print(f"  ERR {exc}", flush=True)

    if report["datasets"].get("tdlr_all", {}).get("ok"):
        print("grouping TDLR license types", flush=True)
        try:
            report["tdlr_license_types"] = soda_group("7358-krk7", "license_type", 100)
            report["tdlr_sample"] = soda_sample(
                "7358-krk7",
                "license_type,license_number,business_name,business_county,business_telephone,owner_name",
                5,
            )
        except Exception as exc:  # noqa: BLE001
            report["tdlr_license_types_error"] = str(exc)

    if report["datasets"].get("tdi_agencies", {}).get("ok"):
        print("grouping TDI agency license types", flush=True)
        try:
            report["tdi_agency_license_types"] = soda_group("3yqc-fcdt", "license_type", 40)
            report["tdi_agency_sample"] = soda_sample(
                "3yqc-fcdt",
                "npn,agency_license_number,org_name,license_type,qualification,city,state",
                3,
            )
        except Exception as exc:  # noqa: BLE001
            report["tdi_agency_group_error"] = str(exc)

    if report["datasets"].get("tdi_agents", {}).get("ok"):
        print("grouping TDI person license types", flush=True)
        try:
            report["tdi_person_license_types"] = soda_group("kxv3-diwf", "license_type", 40)
        except Exception as exc:  # noqa: BLE001
            report["tdi_person_group_error"] = str(exc)

    # Catalog remaining TDI / HHSC / TxDOT datasets by keyword.
    print("catalog search", flush=True)
    for q in [
        "insurance appointment agency",
        "authorized insurance company",
        "nursing facility",
        "assisted living",
        "home health",
        "motor carrier",
        "household goods",
        "mortgage",
        "CMBL",
        "TxDOT contract",
        "securities",
        "complaint insurance",
    ]:
        try:
            cat = get_json(
                "https://api.us.socrata.com/api/catalog/v1?"
                + urllib.parse.urlencode({"domains": "data.texas.gov", "q": q, "only": "datasets", "limit": "8"})
            )
            hits = []
            if isinstance(cat, dict):
                for row in cat.get("results") or []:
                    res = row.get("resource") or {}
                    hits.append(
                        {
                            "id": res.get("id"),
                            "name": res.get("name"),
                            "updated": res.get("data_updated_at"),
                        }
                    )
            report.setdefault("catalog", {})[q] = hits
            print(f"  {q}: {len(hits)}", flush=True)
        except Exception as exc:  # noqa: BLE001
            report.setdefault("catalog", {})[q] = {"error": str(exc)}

    (OUT / "probe-live.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print("WROTE", OUT / "probe-live.json", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
