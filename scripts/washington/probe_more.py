#!/usr/bin/env python3
"""ATH-WA-001 — extra official counts: public works, principals, ArcGIS, debar, UTC, DFI."""
from __future__ import annotations

import csv
import json
import ssl
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "wa_lni"
OUT = ROOT / "data" / "network" / "washington"
UA = "AskTrustHub/ath-wa-001-research (https://www.asktrusthub.com)"
CTX = ssl.create_default_context()


def get_json(url: str, timeout: int = 90) -> object:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout, context=CTX) as resp:
        return json.loads(resp.read().decode("utf-8"))


def soda_count(dataset: str) -> int | dict:
    url = "https://data.wa.gov/resource/{}.json?".format(dataset) + urllib.parse.urlencode(
        {"$select": "count(*)"}
    )
    try:
        payload = get_json(url)
    except Exception as e:  # noqa: BLE001
        return {"error": f"{type(e).__name__}: {e}"}
    if isinstance(payload, list) and payload:
        row = payload[0]
        return int(next(iter(row.values())))
    return {"error": payload}


def soda_group(dataset: str, field: str, limit: int = 20) -> object:
    url = "https://data.wa.gov/resource/{}.json?".format(dataset) + urllib.parse.urlencode(
        {"$select": f"{field},count(*) as n", "$group": field, "$order": "n DESC", "$limit": str(limit)}
    )
    try:
        return get_json(url)
    except Exception as e:  # noqa: BLE001
        return {"error": f"{type(e).__name__}: {e}"}


def request_head_text(url: str, timeout: int = 45, max_bytes: int = 80_000) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=CTX) as resp:
            raw = resp.read(max_bytes)
            text = raw.decode("utf-8", errors="replace")
            return {
                "url": url,
                "status": getattr(resp, "status", None),
                "final_url": resp.geturl(),
                "content_type": resp.headers.get("Content-Type"),
                "content_length": resp.headers.get("Content-Length"),
                "bytes_read": len(raw),
                "text_head": text[:6000],
            }
    except Exception as e:  # noqa: BLE001
        return {"url": url, "error": f"{type(e).__name__}: {e}"}


def unique_ubi() -> dict:
    path = RAW / "lni_contractor_general.csv"
    ubis: set[str] = set()
    active_ubis: set[str] = set()
    rows = 0
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            rows += 1
            u = (row.get("UBI") or "").strip()
            if u:
                ubis.add(u)
                if (row.get("ContractorLicenseStatus") or "").strip().upper() == "ACTIVE":
                    active_ubis.add(u)
    return {
        "general_rows": rows,
        "unique_ubi": len(ubis),
        "active_unique_ubi": len(active_ubis),
        "note": "UBI may have multiple contractor license records. UBI != professional license.",
    }


def fixtures() -> list[dict]:
    path = RAW / "lni_contractor_general.csv"
    out: list[dict] = []
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            if (row.get("ContractorLicenseStatus") or "").strip().upper() != "ACTIVE":
                continue
            if (row.get("ContractorLicenseTypeCodeDesc") or "").strip() != "CONSTRUCTION CONTRACTOR":
                continue
            if (row.get("State") or "").strip().upper() != "WA":
                continue
            if (row.get("BusinessTypeCodeDesc") or "").strip() != "Limited Liability Company":
                continue
            rec = {
                "BusinessName": row.get("BusinessName"),
                "ContractorLicenseNumber": row.get("ContractorLicenseNumber"),
                "ContractorLicenseTypeCodeDesc": row.get("ContractorLicenseTypeCodeDesc"),
                "City": row.get("City"),
                "State": row.get("State"),
                "Zip": row.get("Zip"),
                "PhoneNumber": "REDACTED_IN_FIXTURE",
                "UBI": row.get("UBI"),
                "SpecialtyCode1": row.get("SpecialtyCode1"),
                "ContractorLicenseStatus": row.get("ContractorLicenseStatus"),
            }
            out.append(rec)
            if len(out) >= 3:
                break
    return out


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    report: dict = {
        "ticket": "ATH-WA-001",
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "soda_counts": {},
        "soda_groups": {},
        "arcgis": {},
        "pages": {},
        "ubi": {},
    }

    datasets = {
        "lni_principal": "4xk5-x9j6",
        "lni_authorized_signer": "s7ge-wicw",
        "lni_pw_project_details": "qp8s-a5uf",
        "lni_affidavit_project": "9ncw-tqjn",
        "lni_intent_project": "t9je-9qwa",
        "lni_pw_apprentice": "ijvn-uemp",
        "dfi_state_regulated_fi": "hxpx-m5ym",
        "dfi_consumer_alerts": "8ata-k8m7",
        "wa_cpa": "6du3-3h9e",
        "sos_corps_search_page": "f9jk-mm39",
    }
    for key, ds in datasets.items():
        print(f"count {ds}")
        report["soda_counts"][key] = soda_count(ds)

    print("group principal")
    report["soda_groups"]["principal_businesstype"] = soda_group("4xk5-x9j6", "businesstypecodedesc")
    print("group pw agency")
    report["soda_groups"]["pw_agency_category"] = soda_group("qp8s-a5uf", "agency_category_type")
    print("group dfi fi")
    report["soda_groups"]["dfi_fi"] = soda_group("hxpx-m5ym", "institutiontype")

    arcgis_urls = {
        "residential_count_all": "https://services2.arcgis.com/WW3T8U6q5EkZ9U3n/arcgis/rest/services/Long_Term_Care_Residential_Care_view/FeatureServer/1/query?where=1%3D1&returnCountOnly=true&f=json",
        "residential_current": "https://services2.arcgis.com/WW3T8U6q5EkZ9U3n/arcgis/rest/services/Long_Term_Care_Residential_Care_view/FeatureServer/1/query?"
        + urllib.parse.urlencode(
            {
                "where": "GDLArchiveDate IS NULL",
                "returnCountOnly": "true",
                "f": "json",
            }
        ),
        "residential_types_current": "https://services2.arcgis.com/WW3T8U6q5EkZ9U3n/arcgis/rest/services/Long_Term_Care_Residential_Care_view/FeatureServer/1/query?"
        + urllib.parse.urlencode(
            {
                "where": "GDLArchiveDate IS NULL",
                "outStatistics": json.dumps(
                    [{"statisticType": "count", "onStatisticField": "OBJECTID", "outStatisticFieldName": "n"}]
                ),
                "groupByFieldsForStatistics": "FacilityType",
                "f": "json",
            }
        ),
        "residential_layer": "https://services2.arcgis.com/WW3T8U6q5EkZ9U3n/arcgis/rest/services/Long_Term_Care_Residential_Care_view/FeatureServer/1?f=pjson",
        "item": "https://www.arcgis.com/sharing/rest/content/items/12cacca85238434b9bf54f8e47ece35f?f=pjson",
    }
    for key, url in arcgis_urls.items():
        print(f"arcgis {key}")
        try:
            report["arcgis"][key] = get_json(url)
        except Exception as e:  # noqa: BLE001
            report["arcgis"][key] = {"error": f"{type(e).__name__}: {e}", "url": url}

    pages = [
        "https://lni.wa.gov/licensing-permits/public-works-projects/strike-and-debar/contractors-not-allowed-to-bid",
        "https://lni.wa.gov/ContractorDebarList",
        "https://secure.lni.wa.gov/debarandstrike/ContractorDebarList.aspx",
        "https://secure.lni.wa.gov/debarandstrike/ContractorStrikeList.aspx",
        "https://dfi.wa.gov/consumers/verify-license",
        "https://dfi.wa.gov/enforcement-actions",
        "https://dfi.wa.gov/securities-enforcement-actions",
        "https://www.dshs.wa.gov/altsa/residential-care-services/information-adult-family-home-providers",
        "https://geo.wa.gov/datasets/wadnr::long-term-care-residential-care/about",
        "https://www.utc.wa.gov/companies?exposed_select_industry=566&regulatory_status=1",
        "https://fortress.wa.gov/oic/consumertoolkit/HomePage.aspx",
        "https://www.insurance.wa.gov/online-services",
        "https://ccfs.sos.wa.gov/#/",
        "https://data.wa.gov/Consumer-Protection/Corporations-Search-Washington-state-/f9jk-mm39",
        "https://data.wa.gov/dataset/State-Regulated-Financial-Institutions/hxpx-m5ym",
        "https://www.utc.wa.gov/documents-and-proceedings/dockets-recent-orders/44",
    ]
    for url in pages:
        print(f"page {url}")
        report["pages"][url] = request_head_text(url)

    print("ubi")
    report["ubi"] = unique_ubi()
    print("fixtures")
    report["fixture_candidates"] = fixtures()

    dest = OUT / "probe-more.json"
    dest.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {dest}")
    print(json.dumps({"soda": report["soda_counts"], "ubi": report["ubi"]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
