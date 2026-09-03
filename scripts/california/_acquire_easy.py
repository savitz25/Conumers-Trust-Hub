"""ATH-CA-001 — acquire easy official CSVs and profile forms. No CAPTCHA."""

from __future__ import annotations

import csv
import io
import json
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

UA = "AskTrustHub-ATH-CA-001/1.0 (research; official-source acquire)"
CTX = ssl.create_default_context()
RAW = Path("data/raw/california")
FIX = Path("data/network/california")
RAW.mkdir(parents=True, exist_ok=True)


def fetch(url: str, data: bytes | None = None, timeout: int = 90, extra: dict | None = None) -> tuple[int, bytes, dict]:
    headers = {"User-Agent": UA, "Accept": "*/*"}
    if extra:
        headers.update(extra)
    req = urllib.request.Request(url, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=CTX) as resp:
            return resp.status, resp.read(), {k.lower(): v for k, v in resp.headers.items()}
    except urllib.error.HTTPError as e:
        return e.code, e.read() if e.fp else b"", dict(e.headers.items()) if e.headers else {}
    except Exception as e:
        return 0, str(e).encode(), {}


def package_resources(api_url: str) -> list[dict]:
    status, body, _ = fetch(api_url)
    if status != 200:
        return [{"error": status, "url": api_url, "snippet": body[:200].decode("utf-8", "replace")}]
    payload = json.loads(body.decode("utf-8"))
    res = payload.get("result", {}).get("resources", [])
    out = []
    for r in res:
        out.append(
            {
                "name": r.get("name"),
                "format": r.get("format"),
                "url": r.get("url"),
                "id": r.get("id"),
                "last_modified": r.get("last_modified"),
                "created": r.get("created"),
                "size": r.get("size"),
            }
        )
    return out


def download_csv(url: str, dest: Path, max_bytes: int = 80_000_000) -> dict:
    status, body, headers = fetch(url, timeout=120)
    ct = headers.get("content-type", "")
    info = {
        "url": url,
        "http_status": status,
        "content_type": ct,
        "bytes": len(body),
        "saved": False,
        "rows": None,
        "columns": None,
        "phone_nonempty": None,
        "email_nonempty": None,
        "website_nonempty": None,
        "status_counts": None,
    }
    if status != 200 or len(body) < 200:
        info["snippet"] = body[:300].decode("utf-8", "replace")
        return info
    if len(body) > max_bytes:
        info["blocker"] = "file larger than fixture cap; not committed"
        dest.write_bytes(body[:5000])
        return info
    dest.write_bytes(body)
    info["saved"] = True
    text = body.decode("utf-8-sig", "replace")
    # skip HTML
    if text.lstrip().startswith("<"):
        info["snippet"] = text[:200]
        return info
    reader = csv.DictReader(io.StringIO(text))
    cols = reader.fieldnames or []
    info["columns"] = cols
    n = 0
    phone = email = web = 0
    status_counts: dict[str, int] = {}
    phone_keys = [c for c in cols if re.search(r"phone|tel", c, re.I)]
    email_keys = [c for c in cols if re.search(r"email|e-mail", c, re.I)]
    web_keys = [c for c in cols if re.search(r"web|url|site", c, re.I)]
    status_keys = [c for c in cols if re.search(r"status|fac_status|license_status", c, re.I)]
    type_keys = [c for c in cols if re.search(r"fac_type|facility_type|license_type|type_code", c, re.I)]
    type_counts: dict[str, int] = {}
    for row in reader:
        n += 1
        if any((row.get(k) or "").strip() for k in phone_keys):
            phone += 1
        if any((row.get(k) or "").strip() for k in email_keys):
            email += 1
        if any((row.get(k) or "").strip() for k in web_keys):
            web += 1
        if status_keys:
            sv = (row.get(status_keys[0]) or "").strip() or "(blank)"
            status_counts[sv] = status_counts.get(sv, 0) + 1
        if type_keys:
            tv = (row.get(type_keys[0]) or "").strip() or "(blank)"
            type_counts[tv] = type_counts.get(tv, 0) + 1
    info["rows"] = n
    info["phone_nonempty"] = phone
    info["email_nonempty"] = email
    info["website_nonempty"] = web
    info["status_counts"] = dict(sorted(status_counts.items(), key=lambda x: -x[1])[:20])
    info["type_counts"] = dict(sorted(type_counts.items(), key=lambda x: -x[1])[:30])
    info["phone_keys"] = phone_keys
    info["email_keys"] = email_keys
    info["web_keys"] = web_keys
    return info


def cslb_post_master() -> dict:
    url = "https://www.cslb.ca.gov/onlineservices/dataportal/ContractorList"
    status, body, _ = fetch(url)
    html = body.decode("utf-8", "replace")
    vs = re.search(r'id="__VIEWSTATE" value="([^"]+)"', html)
    ev = re.search(r'id="__EVENTVALIDATION" value="([^"]+)"', html)
    vg = re.search(r'id="__VIEWSTATEGENERATOR" value="([^"]+)"', html)
    if not (vs and ev):
        return {"error": "no viewstate", "http_status": status}
    payload = {
        "__VIEWSTATE": vs.group(1),
        "__VIEWSTATEGENERATOR": vg.group(1) if vg else "",
        "__EVENTVALIDATION": ev.group(1),
        "__EVENTTARGET": "ctl00$MainContent$ddlStatus",
        "__EVENTARGUMENT": "",
        "ctl00$MainContent$ddlStatus": "M",
    }
    data = urllib.parse.urlencode(payload).encode()
    st2, body2, headers = fetch(
        url,
        data=data,
        extra={"Content-Type": "application/x-www-form-urlencoded", "Referer": url},
    )
    html2 = body2.decode("utf-8", "replace")
    (RAW / "cslb_post_master.html").write_text(html2, encoding="utf-8")
    hrefs = re.findall(r'href=["\']([^"\']+\.(?:csv|xls|xlsx|zip))["\']', html2, flags=re.I)
    hrefs += re.findall(r'(https?://[^"\'\s]+(?:csv|xls|xlsx|zip)[^"\'\s]*)', html2, flags=re.I)
    links = re.findall(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>([^<]{0,80})</a>', html2, flags=re.I)
    return {
        "http_status": st2,
        "bytes": len(body2),
        "content_type": headers.get("content-type"),
        "file_hrefs": hrefs[:20],
        "anchors": [(h, t.strip()) for h, t in links if t.strip()][:40],
        "has_csv": "csv" in html2.lower(),
        "lbl": re.search(r'id="MainContent_lblMasterFile"[^>]*>([\s\S]{0,500})</span>', html2),
    }


def main() -> None:
    import urllib.error  # noqa: F401

    summary = {}
    summary["chhs_locations_resources"] = package_resources(
        "https://data.chhs.ca.gov/api/3/action/package_show?id=healthcare-facility-locations"
    )
    summary["chhs_listing_resources"] = package_resources(
        "https://data.chhs.ca.gov/api/3/action/package_show?id=licensed-healthcare-facility-listing"
    )
    summary["chhs_crosswalk_resources"] = package_resources(
        "https://data.chhs.ca.gov/api/3/action/package_show?id=licensed-facility-crosswalk"
    )
    summary["dir_ecu_resources"] = package_resources(
        "https://data.ca.gov/api/3/action/package_show?id=dir-electrician-certification-unit-ecu"
    )
    summary["dca_data"] = {"url": "https://www.dca.ca.gov/data/", "note": "licensee lists advertised"}
    status, body, _ = fetch("https://www.dca.ca.gov/consumers/public_info/")
    summary["dca_public_info"] = {
        "http_status": status,
        "bytes": len(body),
        "hrefs": re.findall(r'href=["\']([^"\']+)["\']', body.decode("utf-8", "replace"), flags=re.I)[:60],
    }

    # Download first CSV from each package
    downloads = {}
    for key, resources in [
        ("chhs_locations", summary["chhs_locations_resources"]),
        ("chhs_listing", summary["chhs_listing_resources"]),
        ("dir_ecu", summary["dir_ecu_resources"]),
    ]:
        csvs = [r for r in resources if isinstance(r, dict) and str(r.get("format", "")).upper() in {"CSV", "XLSX", "XLS"}]
        if not csvs:
            continue
        r0 = csvs[0]
        url = r0.get("url")
        if not url:
            continue
        dest = RAW / f"{key}.csv"
        downloads[key] = download_csv(url, dest)
        downloads[key]["resource_name"] = r0.get("name")
        downloads[key]["last_modified"] = r0.get("last_modified")

    summary["downloads"] = downloads
    try:
        summary["cslb_post"] = cslb_post_master()
        if summary["cslb_post"].get("lbl"):
            summary["cslb_post"]["lbl_text"] = summary["cslb_post"]["lbl"].group(1)
            del summary["cslb_post"]["lbl"]
    except Exception as e:
        summary["cslb_post"] = {"error": str(e)}

    # SOAP probe without token
    soap_url = "https://www.cslb.ca.gov/onlineservices/DataPortalAPI/GetbyClassification.asmx"
    st, body, hdr = fetch(soap_url + "?WSDL")
    summary["cslb_soap_wsdl"] = {"http_status": st, "bytes": len(body), "content_type": hdr.get("content-type")}
    if st == 200:
        (RAW / "cslb_wsdl.xml").write_bytes(body)
        ops = re.findall(r"<s:element name=\"([^\"]+)\"", body.decode("utf-8", "replace"))
        summary["cslb_soap_wsdl"]["elements"] = ops[:40]

    (RAW / "acquire-summary.json").write_text(json.dumps(summary, indent=2, default=str), encoding="utf-8")
    print(json.dumps({k: (v if k != "downloads" else {dk: {ik: iv for ik, iv in dv.items() if ik != "type_counts"} for dk, dv in v.items()}) for k, v in summary.items() if k not in ("chhs_locations_resources", "chhs_listing_resources", "chhs_crosswalk_resources")}, indent=2, default=str)[:8000])


if __name__ == "__main__":
    main()
