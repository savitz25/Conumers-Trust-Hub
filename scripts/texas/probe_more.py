#!/usr/bin/env python3
"""ATH-TX-001 — second-pass official probes. No scraping, no /texas UI."""
from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "network" / "texas"
UA = "AskTrustHub/ath-tx-001-research"


def get(url: str, timeout: int = 90) -> tuple[int, bytes, dict]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read(), dict(resp.headers)
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read() if exc.fp else b"", dict(exc.headers or {})


def get_json(url: str, timeout: int = 90) -> object:
    code, body, _ = get(url, timeout)
    if code != 200:
        raise RuntimeError(f"HTTP {code} {url}")
    return json.loads(body.decode("utf-8"))


def soda_count(dataset: str) -> int | None:
    url = f"https://data.texas.gov/resource/{dataset}.json?" + urllib.parse.urlencode({"$select": "count(*)"})
    payload = get_json(url)
    if isinstance(payload, list) and payload:
        return int(payload[0].get("count") or payload[0].get("count_1") or 0)
    return None


def views_meta(dataset: str) -> dict:
    meta = get_json(f"https://data.texas.gov/api/views/{dataset}.json")
    assert isinstance(meta, dict)
    cols = [
        {"name": c.get("name"), "field": c.get("fieldName"), "type": c.get("dataTypeName")}
        for c in meta.get("columns", [])
        if not str(c.get("fieldName", "")).startswith(":@")
    ]
    return {
        "id": meta.get("id"),
        "name": meta.get("name"),
        "attribution": meta.get("attribution"),
        "description": (meta.get("description") or "")[:400],
        "rowsUpdatedAt": meta.get("rowsUpdatedAt"),
        "downloadCount": meta.get("downloadCount"),
        "columns": cols,
    }


def soda_sample(dataset: str, select: str, limit: int = 2) -> list:
    url = f"https://data.texas.gov/resource/{dataset}.json?" + urllib.parse.urlencode(
        {"$select": select, "$limit": str(limit)}
    )
    payload = get_json(url)
    assert isinstance(payload, list)
    return payload


def headish(url: str) -> dict:
    code, body, headers = get(url, timeout=45)
    return {
        "url": url,
        "status": code,
        "content_type": headers.get("Content-Type") or headers.get("content-type"),
        "content_length": headers.get("Content-Length") or headers.get("content-length"),
        "bytes": len(body),
        "snippet": body[:400].decode("utf-8", "replace"),
    }


def main() -> int:
    report: dict = {"retrieved_at": datetime.now(timezone.utc).isoformat(), "datasets": {}, "pages": {}}

    datasets = {
        "tdi_agency_appointments": "avjc-7u2m",
        "tdi_agent_appointments_alt": "bupb-23s9",
        "tdi_business_relationships": "kvqi-vsrr",
        "tdi_rate_filings": "iubg-btfs",
        "tdi_complaints_all": "ubdr-4uff",
        "tdi_complaints_one": "jjc8-mxkg",
        "tdi_complaint_index": "pa9u-9s9w",
        "txdot_bid_tabs": "de7b-7dna",
        "txdot_project_info": "drau-zphx",
        "txdot_plan_holders": "jd6h-b87p",
        "dir_coop_contracts": "vipt-h4ye",
        "comptroller_sales_tax": "jrea-zgmq",
        "hhsc_ccl_again": "bc5r-88dy",
    }

    for key, ds in datasets.items():
        print(f"probing {key} {ds}", flush=True)
        try:
            meta = views_meta(ds)
            count = soda_count(ds)
            report["datasets"][key] = {"ok": True, "count": count, "meta": meta}
            print(f"  count={count} cols={len(meta['columns'])} name={meta['name']}", flush=True)
        except Exception as exc:  # noqa: BLE001
            report["datasets"][key] = {"ok": False, "error": str(exc)}
            print(f"  ERR {exc}", flush=True)

    if report["datasets"].get("tdi_agency_appointments", {}).get("ok"):
        try:
            report["tdi_agency_appt_sample"] = soda_sample(
                "avjc-7u2m", "naic_id,company,npn,agency_name,appointment_type,city,state", 3
            )
        except Exception as exc:  # noqa: BLE001
            report["tdi_agency_appt_sample_error"] = str(exc)

    if report["datasets"].get("dir_coop_contracts", {}).get("ok"):
        try:
            report["dir_sample"] = soda_sample(
                "vipt-h4ye", "contract_number,primary_vendor_name,vendor_contact_email,reseller_name", 2
            )
        except Exception as exc:  # noqa: BLE001
            report["dir_sample_error"] = str(exc)

    pages = {
        "cmbl_downloads": "https://comptroller.texas.gov/purchasing/downloads",
        "tdlr_download_index": "https://www.tdlr.texas.gov/dbproduction2/",
        "tdlr_all_licenses_file": "https://www.tdlr.texas.gov/dbproduction2/TDLR_All_Licenses.csv",
        "tsbpe_licensee_list": "https://tsbpe.texas.gov/free-licensee-list/",
        "sml_enforcement_csv": "https://www.sml.texas.gov/wp-content/uploads/2025/10/sml_enforcement_orders_data_10_16_2025.csv",
        "sml_enforcement_page": "https://www.sml.texas.gov/consumers/enforcement/",
        "tdi_agentlists": "https://tdi.texas.gov/agent/agentlists.html",
        "tdi_company_lists": "https://www.tdi.texas.gov/webinfo/colists.html",
        "tdi_reports": "https://appscenter.tdi.texas.gov/tdireports/p/externalReports",
        "txdmv_txmccs": "https://txmccs.txdmv.gov",
        "ssb_certificate_search": "https://www.ssb.texas.gov/securities-professionals/certificate-search",
        "hhsc_tulip": "https://tulip.hhs.texas.gov/TULIP/s/ltc-provider-information",
        "tceq_irrigator": "https://www.tceq.texas.gov/licensing/licenses/li_lic.html",
        "cms_nh_tx": "https://data.cms.gov/provider-data/api/1/datastore/query/4pq5-n9py/0?conditions%5B0%5D%5Bproperty%5D=state&conditions%5B0%5D%5Boperator%5D=%3D&conditions%5B0%5D%5Bvalue%5D=TX&limit=1",
        "nmls_consumer": "https://www.nmlsconsumeraccess.org/",
        "sos_sosdirect": "https://direct.sos.state.tx.us/",
        "tdhca_lenders": "https://www.tdhca.texas.gov/homebuyers/approved-lenders",
    }
    for key, url in pages.items():
        print(f"page {key}", flush=True)
        try:
            report["pages"][key] = headish(url)
            print(f"  {report['pages'][key]['status']} bytes={report['pages'][key]['bytes']}", flush=True)
        except Exception as exc:  # noqa: BLE001
            report["pages"][key] = {"url": url, "error": str(exc)}
            print(f"  ERR {exc}", flush=True)

    # CMBL likely has specific CSV filenames; harvest hrefs from downloads page.
    downloads = report["pages"].get("cmbl_downloads", {})
    snippet = downloads.get("snippet") or ""
    report["cmbl_snippet"] = snippet

    (OUT / "probe-more.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print("WROTE", OUT / "probe-more.json", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
