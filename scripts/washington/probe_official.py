#!/usr/bin/env python3
"""ATH-WA-001 — probe official Washington bulk/search sources. No scraping of search tools."""
from __future__ import annotations

import json
import ssl
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "network" / "washington"
UA = "AskTrustHub/ath-wa-001-research (https://www.asktrusthub.com)"
CTX = ssl.create_default_context()


def request(url: str, timeout: int = 60, method: str = "GET", max_bytes: int = 200_000) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=CTX) as resp:
            raw = resp.read(max_bytes)
            return {
                "url": url,
                "status": getattr(resp, "status", None),
                "final_url": resp.geturl(),
                "content_type": resp.headers.get("Content-Type"),
                "content_length_header": resp.headers.get("Content-Length"),
                "last_modified": resp.headers.get("Last-Modified"),
                "bytes_read": len(raw),
                "text_head": raw[:4000].decode("utf-8", errors="replace") if method == "GET" else "",
            }
    except urllib.error.HTTPError as e:
        body = e.read(2000) if e.fp else b""
        return {
            "url": url,
            "status": e.code,
            "error": str(e.reason),
            "text_head": body[:1500].decode("utf-8", errors="replace"),
        }
    except Exception as e:  # noqa: BLE001 — probe must record network failures
        return {"url": url, "status": None, "error": f"{type(e).__name__}: {e}"}


def get_json(url: str, timeout: int = 90) -> object | dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=CTX) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:  # noqa: BLE001
        return {"_error": f"{type(e).__name__}: {e}", "url": url}


def soda_count(dataset: str) -> int | None:
    url = "https://data.wa.gov/resource/{}.json?".format(dataset) + urllib.parse.urlencode(
        {"$select": "count(*)"}
    )
    payload = get_json(url)
    if isinstance(payload, list) and payload:
        row = payload[0]
        for k in ("count", "count_1"):
            if k in row:
                return int(row[k])
        if len(row) == 1:
            return int(next(iter(row.values())))
    return None


def views_meta(dataset: str) -> dict:
    meta = get_json(f"https://data.wa.gov/api/views/{dataset}.json")
    if not isinstance(meta, dict) or meta.get("_error"):
        return {"id": dataset, "error": meta}
    cols = [
        {
            "name": c.get("name"),
            "field": c.get("fieldName"),
            "type": c.get("dataTypeName"),
            "non_null": ((c.get("cachedContents") or {}).get("non_null")),
        }
        for c in meta.get("columns", [])
        if not str(c.get("fieldName", "")).startswith(":@")
    ]
    return {
        "id": meta.get("id"),
        "name": meta.get("name"),
        "attribution": meta.get("attribution"),
        "attributionLink": meta.get("attributionLink"),
        "description": (meta.get("description") or "")[:800],
        "category": meta.get("category"),
        "license": (meta.get("license") or {}).get("name") or meta.get("licenseId"),
        "rowsUpdatedAt": meta.get("rowsUpdatedAt"),
        "viewLastModified": meta.get("viewLastModified"),
        "createdAt": meta.get("createdAt"),
        "downloadCount": meta.get("downloadCount"),
        "columns": cols,
    }


def catalog_search(query: str, limit: int = 20) -> list[dict]:
    url = "https://api.us.socrata.com/api/catalog/v1?" + urllib.parse.urlencode(
        {
            "domains": "data.wa.gov",
            "search_context": "data.wa.gov",
            "q": query,
            "limit": str(limit),
        }
    )
    payload = get_json(url)
    results = []
    if isinstance(payload, dict):
        for item in payload.get("results") or []:
            res = item.get("resource") or {}
            per = item.get("permalink")
            results.append(
                {
                    "id": res.get("id"),
                    "name": res.get("name"),
                    "attribution": res.get("attribution"),
                    "description": (res.get("description") or "")[:280],
                    "type": res.get("type"),
                    "updatedAt": res.get("updatedAt") or res.get("data_updated_at"),
                    "permalink": per,
                    "columns": (res.get("columns_name") or [])[:18],
                }
            )
    return results


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    report: dict = {
        "ticket": "ATH-WA-001",
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "note": "Probes only. No search-form scraping. No county/city work.",
        "socrata_known": {},
        "socrata_counts": {},
        "catalog": {},
        "official_pages": {},
    }

    known = {
        "lni_general": "m8qx-ubtq",
        "lni_bond": "bzff-4fmt",
        "lni_insurance": "ciwg-agsx",
    }
    extra_candidates = {
        "lni_trades": None,  # filled from catalog
    }

    for key, ds in known.items():
        print(f"meta {ds}")
        report["socrata_known"][key] = views_meta(ds)
        print(f"count {ds}")
        report["socrata_counts"][key] = soda_count(ds)

    queries = [
        "contractor license",
        "contractor bond",
        "debarred",
        "prevailing wage",
        "public works",
        "household goods",
        "utilities transportation",
        "adult family home",
        "assisted living",
        "nursing home",
        "residential care",
        "DFI",
        "securities",
        "mortgage",
        "consumer loan",
        "UBI",
        "corporations",
        "insurance commissioner",
        "OIC",
        "complaint",
        "enforcement order",
        "HMDA",
        "contractor insurance",
        "elevator",
        "electrical contractor",
        "apprentice",
    ]
    for q in queries:
        print(f"catalog {q}")
        report["catalog"][q] = catalog_search(q, limit=12)

    pages = [
        "https://data.wa.gov/",
        "https://www.lni.wa.gov/",
        "https://secure.lni.wa.gov/verify/",
        "https://www.lni.wa.gov/licensing-permits/contractors/",
        "https://www.lni.wa.gov/licensing-permits/public-works-projects/debarred-contractors",
        "https://lni.wa.gov/licensing-permits/public-works-projects/debarred-contractors",
        "https://www.lni.wa.gov/licensing-permits/public-works-projects/",
        "https://secure.lni.wa.gov/debarandstrike/ContractorDebarList.aspx",
        "https://www.utc.wa.gov/MovingCompanies",
        "https://www.utc.wa.gov/companies",
        "https://www.utc.wa.gov/regulated-industries/transportation/household-goods-carriers",
        "https://www.utc.wa.gov/documents-and-proceedings/dockets-recent-orders",
        "https://www.insurance.wa.gov/agent-and-company-lookup-tool",
        "https://www.insurance.wa.gov/about-us/request-public-records/request-list-individuals",
        "https://www.insurance.wa.gov/about-us/request-public-records",
        "https://fortress.wa.gov/dshs/adsaapps/lookup/AFHAdvLookup.aspx",
        "https://fortress.wa.gov/dshs/adsaapps/lookup/BHPubLookup.aspx",
        "https://fortress.wa.gov/dshs/adsaapps/lookup/NHPubLookup.aspx",
        "https://www.dshs.wa.gov/altsa/residential-care-services",
        "https://www.dfi.wa.gov/",
        "https://dfi.wa.gov/consumers/check-license",
        "https://www.dfi.wa.gov/consumers/check-license",
        "https://www.dfi.wa.gov/securities",
        "https://ccfs.sos.wa.gov/",
        "https://www.sos.wa.gov/corporations-charities",
        "https://dor.wa.gov/open-business/apply-business-license",
        "https://secure.dor.wa.gov/gteunauth/_/",
        "https://data.wa.gov/browse?q=contractor",
        "https://www.arcgis.com/home/item.html?id=12cacca85238434b9bf54f8e47ece35f",
        "https://www.insurance.wa.gov/orders-search",
        "https://fortress.wa.gov/oic/onlineorderssearch/",
        "https://www.dfi.wa.gov/enforcement",
        "https://dfi.wa.gov/enforcement-actions",
        "https://www.lni.wa.gov/licensing-permits/contractors/hiring-a-contractor",
        "https://www.utc.wa.gov/regulatedIndustries/transportation/householdGoods/Pages/PermittedCarriersHouseholdGoods.aspx",
    ]
    for url in pages:
        print(f"page {url}")
        report["official_pages"][url] = request(url, timeout=45)

    # UTC company directory probes — industry filter IDs, no pagination scrape
    utc_probes = [
        "https://www.utc.wa.gov/companies?exposed_select_industry=566&regulatory_status=1",
        "https://www.utc.wa.gov/companies?exposed_select_industry=568&regulatory_status=1",
        "https://www.utc.wa.gov/companies?combine=&usdot=&exposed_select_industry=Household%20Goods%20Carriers&regulatory_status=1",
        "https://www.utc.wa.gov/companies?_format=json",
        "https://www.utc.wa.gov/companies/csv",
        "https://www.utc.wa.gov/companies?exposed_select_industry=566&regulatory_status=1&_format=json",
    ]
    report["utc_probes"] = {}
    for url in utc_probes:
        print(f"utc {url}")
        report["utc_probes"][url] = request(url, timeout=45)

    # ArcGIS item data URL
    report["arcgis_item"] = get_json(
        "https://www.arcgis.com/sharing/rest/content/items/12cacca85238434b9bf54f8e47ece35f?f=pjson"
    )

    dest = OUT / "probe-official.json"
    dest.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {dest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
