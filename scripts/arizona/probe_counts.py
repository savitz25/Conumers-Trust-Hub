#!/usr/bin/env python3
"""Bounded official-API counts. No portal scrape. No paid purchase."""
from __future__ import annotations

import json
import ssl
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

CTX = ssl.create_default_context()
UA = "AskTrustHub-ATH-AZ-001/1.0 (official API count only)"
OUT = Path(__file__).resolve().parents[2] / "data" / "raw" / "arizona"
OUT.mkdir(parents=True, exist_ok=True)


def get(url: str, timeout: int = 60) -> tuple[int, bytes]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json,*/*"})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=CTX) as resp:
            return resp.status, resp.read()
    except Exception as e:  # noqa: BLE001
        return getattr(e, "code", 0) or 0, str(e).encode()


def main() -> None:
    out: dict = {"ticket": "ATH-AZ-001", "retrieved_at": datetime.now(timezone.utc).isoformat(), "queries": {}}

    # data.az.gov CKAN
    ckan = "https://data.az.gov/api/3/action/package_search?" + urllib.parse.urlencode(
        {"q": "insurance OR mortgage OR mover OR securities OR license", "rows": "20"}
    )
    st, body = get(ckan)
    out["queries"]["ckan"] = {"http": st, "bytes": len(body)}
    if st == 200:
        try:
            payload = json.loads(body.decode())
            results = payload.get("result", {}).get("results", [])
            out["queries"]["ckan"]["count"] = payload.get("result", {}).get("count")
            out["queries"]["ckan"]["titles"] = [
                {"name": r.get("name"), "title": r.get("title"), "org": (r.get("organization") or {}).get("title")}
                for r in results[:20]
            ]
        except json.JSONDecodeError:
            out["queries"]["ckan"]["error"] = "json"

    # FMCSA MCMIS census Socrata — counts only
    census = "https://data.transportation.gov/resource/az4n-8mr2.json"
    for label, params in {
        "az_phy_all": {"$select": "count(*)", "phy_state": "AZ"},
        "az_phy_active": {"$select": "count(*)", "phy_state": "AZ", "status_code": "A"},
        "az_mail_all": {"$select": "count(*)", "mail_state": "AZ"},
    }.items():
        url = census + "?" + urllib.parse.urlencode(params)
        st, body = get(url)
        parsed = None
        try:
            parsed = json.loads(body.decode())
        except json.JSONDecodeError:
            parsed = body[:200].decode("utf-8", "replace")
        out["queries"][label] = {"http": st, "result": parsed}
        print(label, st, parsed)

    # try household goods field variants
    probe = census + "?" + urllib.parse.urlencode({"$limit": "1", "phy_state": "AZ"})
    st, body = get(probe)
    if st == 200:
        row = json.loads(body.decode())[0]
        keys = [k for k in row if "hhg" in k.lower() or "house" in k.lower() or "ship" in k.lower() or "cargo" in k.lower()]
        out["queries"]["az_sample_keys"] = sorted(row.keys())[:80]
        out["queries"]["az_hhg_like_keys"] = keys
        print("hhg_like", keys)

    (OUT / "probe-counts.json").write_text(json.dumps(out, indent=2), encoding="utf-8")
    print("wrote", OUT / "probe-counts.json")


if __name__ == "__main__":
    main()
