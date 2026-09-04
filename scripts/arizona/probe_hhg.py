#!/usr/bin/env python3
"""FMCSA AZ household-goods counts only. Not a dump."""
from __future__ import annotations

import json
import ssl
import urllib.parse
import urllib.request

CTX = ssl.create_default_context()
UA = "AskTrustHub-ATH-AZ-001/1.0"
CENSUS = "https://data.transportation.gov/resource/az4n-8mr2.json"


def get(params: dict) -> object:
    url = CENSUS + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=60, context=CTX) as resp:
        return json.loads(resp.read().decode())


def main() -> None:
    sample = get({"$limit": "3", "phy_state": "AZ"})
    print("sample_carship", [r.get("carship") for r in sample])
    print("keys_with_h", [k for k in sample[0] if "h" in k.lower()][:40])
    for params in [
        {"$select": "count(*)", "phy_state": "AZ", "carship": "C"},
        {"$select": "count(*)", "phy_state": "AZ", "carship": "H"},
        {"$select": "count(*)", "phy_state": "AZ", "status_code": "A", "carship": "C"},
        {"$select": "carship,count(*)", "$where": "phy_state='AZ'", "$group": "carship"},
        {"$select": "count(*)", "$where": "phy_state='AZ' and upper(carship) like '%H%'"},
        {"$select": "count(*)", "$where": "phy_state='AZ' and status_code='A' and upper(carship) like '%H%'"},
    ]:
        try:
            print(params, get(params))
        except Exception as e:  # noqa: BLE001
            print("FAIL", params, e)


if __name__ == "__main__":
    main()
