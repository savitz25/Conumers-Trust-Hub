#!/usr/bin/env python3
"""ATH-AZ-001 official-page probes. No search-portal scrape. No paid purchase."""
from __future__ import annotations

import hashlib
import json
import ssl
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "arizona"
RAW.mkdir(parents=True, exist_ok=True)
CTX = ssl.create_default_context()
UA = "AskTrustHub-ATH-AZ-001/1.0 (+https://www.asktrusthub.com; official-page research)"

URLS = {
    "dps_moving": "https://www.azdps.gov/content/basic-page/94/hhg",
    "difi_enforcement": "https://difi.az.gov/enforcement-actions",
    "acc_list_request": "https://www.azcc.gov/docs/default-source/securities-files/pubreq2.pdf",
    "acc_home": "https://www.azcc.gov/",
    "acc_ecorp": "https://ecorp.azcc.gov/EntitySearch/Index",
    "acc_securities": "https://www.azcc.gov/securities",
    "acc_broker_adviser": "https://www.azcc.gov/securities/research",
    "acc_forms": "https://www.azcc.gov/securities/forms",
    "acc_enforcement": "https://www.azcc.gov/securities/enforcements/actions",
    "difi_home": "https://difi.az.gov/",
    "difi_license_search": "https://difi.az.gov/license-search",
    "difi_mortgage": "https://difi.az.gov/licensing/mortgage-lending",
    "difi_financial_enterprises": "https://difi.az.gov/licensing/financial-enterprises",
    "sbs": "https://www.statebasedsystems.com/",
    "sbs_support": "https://www.statebasedsystems.com/solar/support.html",
    "open_data": "https://data.az.gov/",
    "ckan_search": "https://data.az.gov/api/3/action/package_search?q=insurance%20OR%20mortgage%20OR%20mover%20OR%20securities",
    "roc_posting": "https://roc.az.gov/posting-list",
    "senior_az": "https://www.seniortrusthub.com/arizona",
}


def now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def fetch(url: str, timeout: int = 45) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=CTX) as resp:
            body = resp.read()
            return {
                "url": url,
                "http_status": resp.status,
                "bytes": len(body),
                "content_type": resp.headers.get("Content-Type"),
                "sha256": hashlib.sha256(body).hexdigest() if body else None,
                "sample": body[:800].decode("utf-8", "replace"),
            }
    except urllib.error.HTTPError as e:
        body = e.read() if e.fp else b""
        return {"url": url, "http_status": e.code, "bytes": len(body), "error": str(e)}
    except Exception as e:
        return {"url": url, "http_status": 0, "error": str(e)}


def main() -> None:
    out = {"ticket": "ATH-AZ-001", "retrieved_at": now(), "probes": {}}
    for key, url in URLS.items():
        row = fetch(url)
        out["probes"][key] = {k: v for k, v in row.items() if k != "sample"}
        (RAW / f"probe-{key}.json").write_text(json.dumps(row, indent=2), encoding="utf-8")
        print(f"{key:24} {row.get('http_status')} {row.get('bytes', 0)}")
    (RAW / "probe-index.json").write_text(json.dumps(out, indent=2), encoding="utf-8")
    print("wrote", RAW / "probe-index.json")


if __name__ == "__main__":
    main()
