"""ATH-CA-001 — CCLD RCFE datastore totals. No scrape."""
from __future__ import annotations

import json
import ssl
import urllib.parse
import urllib.request

CTX = ssl.create_default_context()
UA = "AskTrustHub-ATH-CA-001/1.0"


def get(url: str, timeout: int = 90) -> tuple[int, bytes]:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
            return r.status, r.read()
    except Exception as e:
        return getattr(e, "code", 0), (
            e.read() if hasattr(e, "read") and getattr(e, "fp", None) else str(e).encode()
        )


def search(rid: str) -> dict:
    url = f"https://data.chhs.ca.gov/api/3/action/datastore_search?resource_id={rid}&limit=2"
    st, body = get(url)
    if st != 200:
        return {"id": rid, "http_status": st, "snippet": body[:300].decode("utf-8", "replace")}
    p = json.loads(body)["result"]
    recs = p.get("records") or [{}]
    return {
        "id": rid,
        "total": p.get("total"),
        "fields": [f.get("id") for f in p.get("fields", [])],
        "sample": recs[:1],
    }


def sql(q: str) -> dict:
    url = "https://data.chhs.ca.gov/api/3/action/datastore_search_sql?sql=" + urllib.parse.quote(q)
    st, body = get(url)
    if st != 200:
        return {"http_status": st, "snippet": body[:400].decode("utf-8", "replace")}
    p = json.loads(body)
    return {"records": p.get("result", {}).get("records"), "error": p.get("error")}


def main() -> None:
    ids = {
        "rcfe": "744d1583-f9eb-45b6-b0f8-b9a9dab936a6",
        "arf": "9f5d1d00-6b24-4f44-a158-9cbe4b43f117",
        "hco": "b4d78b7f-12df-4b0c-a81a-ff40b949bc75",
        "gis": "0b4a7ed1-4d91-4401-b22c-e539e22e634a",
        "child_res": "c9df723a-437f-4dcd-be37-ec73ae518bb9",
    }
    out = {k: search(v) for k, v in ids.items()}
    rid = ids["rcfe"]
    out["rcfe_occupancy"] = sql(
        f'SELECT COUNT(*) AS n, COUNT(facility_telephone_number) AS phone, COUNT(facility_address) AS address FROM "{rid}"'
    )
    out["rcfe_status"] = sql(
        f'SELECT facility_status, COUNT(*) AS n FROM "{rid}" GROUP BY facility_status ORDER BY n DESC'
    )
    out["rcfe_type"] = sql(
        f'SELECT facility_type, COUNT(*) AS n FROM "{rid}" GROUP BY facility_type ORDER BY n DESC'
    )
    print(json.dumps(out, indent=2, default=str)[:20000])


if __name__ == "__main__":
    main()
