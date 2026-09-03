"""ATH-CA-001 — CKAN datastore totals + CSLB SOAP smoke. No scrape."""

from __future__ import annotations

import json
import ssl
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

UA = "AskTrustHub-ATH-CA-001/1.0"
CTX = ssl.create_default_context()
RAW = Path("data/raw/california")


def get(url: str, timeout: int = 60) -> tuple[int, bytes]:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=CTX) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read() if e.fp else b""
    except Exception as e:
        return 0, str(e).encode()


def datastore_meta(base: str, resource_id: str) -> dict:
    q = urllib.parse.urlencode({"resource_id": resource_id, "limit": 5})
    url = f"{base}/api/3/action/datastore_search?{q}"
    status, body = get(url)
    out = {"url": url, "http_status": status}
    if status != 200:
        out["snippet"] = body[:300].decode("utf-8", "replace")
        return out
    payload = json.loads(body.decode("utf-8"))
    result = payload.get("result", {})
    fields = [f.get("id") for f in result.get("fields", [])]
    records = result.get("records", [])
    out.update(
        {
            "total": result.get("total"),
            "fields": fields,
            "sample": records[:2],
        }
    )
    return out


def main() -> None:
    chhs = "https://data.chhs.ca.gov"
    ca = "https://data.ca.gov"
    summary = {
        "health_facility_locations": datastore_meta(chhs, "f0ae5731-fef8-417f-839d-54a0ed3a126e"),
        "current_healthcare_listing": datastore_meta(chhs, "641c5557-7d65-4379-8fea-6b7dedbda40b"),
        "certified_electrician": datastore_meta(ca, "291bacb8-2fdb-4d9c-a330-113781ce2f59"),
        "electrician_trainee": datastore_meta(ca, "f0b9e36d-32be-408d-8dd9-4d539becfdc8"),
    }

    # more CHHS packages
    for pkg in [
        "licensed-and-certified-healthcare-facility-bed-types-and-counts",
        "healthcare-facility-services",
        "long-term-care-ombudsman-complaints-in-residential-care-facility-for-the-elderly-settings",
        "long-term-care-ombudsman-complaints-in-skilled-nursing-intermediate-care-facility-settings",
        "enforcement-actions-trend",
        "independent-medical-review-imr-determinations-trend",
    ]:
        st, body = get(f"{chhs}/api/3/action/package_show?id={pkg}")
        if st != 200:
            st2, body2 = get(f"{ca}/api/3/action/package_show?id={pkg}")
            st, body = st2, body2
        if st == 200:
            payload = json.loads(body.decode("utf-8"))
            res = payload.get("result", {}).get("resources", [])
            summary[pkg] = [
                {
                    "name": r.get("name"),
                    "format": r.get("format"),
                    "id": r.get("id"),
                    "url": r.get("url"),
                    "last_modified": r.get("last_modified"),
                    "datastore_active": r.get("datastore_active"),
                }
                for r in res
            ]
        else:
            summary[pkg] = {"http_status": st}

    # SOAP operations
    st, body = get("https://www.cslb.ca.gov/onlineservices/DataPortalAPI/GetbyClassification.asmx?WSDL")
    text = body.decode("utf-8", "replace")
    ops = sorted(set(re.findall(r'name="(Get[^"]+)"', text))) if False else None
    import re as _re

    ops = sorted(set(_re.findall(r"<s:element name=\"(Get[^\"]+)\"", text)))
    summary["cslb_soap_get_ops"] = ops

    # try SOAP GetDataByClassification with C-10, empty token
    soap = """<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetDataByClassification xmlns="http://CSLB.Ca.gov/">
      <classification>C-10</classification>
      <fileType>CSV</fileType>
      <Token></Token>
    </GetDataByClassification>
  </soap:Body>
</soap:Envelope>"""
    req = urllib.request.Request(
        "https://www.cslb.ca.gov/onlineservices/DataPortalAPI/GetbyClassification.asmx",
        data=soap.encode(),
        headers={
            "User-Agent": UA,
            "Content-Type": "text/xml; charset=utf-8",
            "SOAPAction": '"http://CSLB.Ca.gov/GetDataByClassification"',
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60, context=CTX) as resp:
            sb = resp.read()
            summary["cslb_soap_c10"] = {"http_status": resp.status, "bytes": len(sb), "snippet": sb[:400].decode("utf-8", "replace")}
    except urllib.error.HTTPError as e:
        sb = e.read() if e.fp else b""
        summary["cslb_soap_c10"] = {"http_status": e.code, "bytes": len(sb), "snippet": sb[:500].decode("utf-8", "replace")}
    except Exception as e:
        summary["cslb_soap_c10"] = {"error": str(e)}

    (RAW / "ckan-counts.json").write_text(json.dumps(summary, indent=2, default=str), encoding="utf-8")
    print(json.dumps({k: v for k, v in summary.items() if "sample" not in json.dumps(v, default=str)[:20] or True}, indent=2, default=str)[:12000])


if __name__ == "__main__":
    main()
