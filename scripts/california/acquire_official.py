"""ATH-CA-001 — official California source acquisition.

Allowed: OPEN_BULK_DOWNLOAD form postbacks, CKAN datastore/dump, simple HTML tables.
Forbidden: CAPTCHA bypass, session search scraping, browser automation, huge git commits.
"""

from __future__ import annotations

import csv
import io
import json
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

UA = "AskTrustHub-ATH-CA-001/1.0 (research; official bulk only)"
CTX = ssl.create_default_context()
ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "california"
FIX = ROOT / "data" / "network" / "california"
RAW.mkdir(parents=True, exist_ok=True)


def fetch(
    url: str,
    data: bytes | None = None,
    timeout: int = 120,
    extra: dict | None = None,
) -> tuple[int, bytes, dict]:
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


def hidden(html: str, name: str) -> str:
    m = re.search(rf'id="{re.escape(name)}" value="([^"]*)"', html)
    return m.group(1) if m else ""


def ckan_sql(base: str, sql: str) -> dict:
    url = f"{base}/api/3/action/datastore_search_sql?sql={urllib.parse.quote(sql)}"
    status, body, _ = fetch(url, timeout=90)
    out: dict = {"url": url, "http_status": status}
    if status != 200:
        out["snippet"] = body[:400].decode("utf-8", "replace")
        return out
    payload = json.loads(body.decode("utf-8"))
    if not payload.get("success"):
        out["error"] = payload.get("error")
        return out
    out["records"] = payload.get("result", {}).get("records", [])
    return out


def ckan_search(base: str, resource_id: str, limit: int = 0, filters: dict | None = None) -> dict:
    params = {"resource_id": resource_id, "limit": str(limit)}
    if filters:
        params["filters"] = json.dumps(filters)
    url = f"{base}/api/3/action/datastore_search?{urllib.parse.urlencode(params)}"
    status, body, _ = fetch(url, timeout=60)
    out: dict = {"url": url, "http_status": status}
    if status != 200:
        out["snippet"] = body[:300].decode("utf-8", "replace")
        return out
    payload = json.loads(body.decode("utf-8"))
    result = payload.get("result", {})
    out["total"] = result.get("total")
    out["fields"] = [f.get("id") for f in result.get("fields", [])]
    out["sample"] = result.get("records", [])[:2]
    return out


def dump_csv(url: str, dest: Path, max_bytes: int = 120_000_000) -> dict:
    status, body, headers = fetch(url, timeout=180)
    info = {
        "url": url,
        "http_status": status,
        "content_type": headers.get("content-type"),
        "bytes": len(body),
        "saved": False,
    }
    if status != 200 or len(body) < 80:
        info["snippet"] = body[:400].decode("utf-8", "replace")
        return info
    if body.lstrip().startswith(b"<") or body.lstrip().startswith(b"<?xml"):
        info["snippet"] = body[:300].decode("utf-8", "replace")
        return info
    if len(body) > max_bytes:
        info["blocker"] = "larger than local cap"
        return info
    dest.write_bytes(body)
    info["saved"] = True
    info["path"] = str(dest)
    return info


def profile_csv(path: Path, phone_re=r"phone|tel", email_re=r"email|e-mail", web_re=r"web|url|website") -> dict:
    text = path.read_text(encoding="utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    cols = reader.fieldnames or []
    phone_keys = [c for c in cols if re.search(phone_re, c, re.I)]
    email_keys = [c for c in cols if re.search(email_re, c, re.I)]
    web_keys = [c for c in cols if re.search(web_re, c, re.I)]
    addr_keys = [c for c in cols if re.search(r"address|addr|street|city|zip", c, re.I)]
    status_keys = [c for c in cols if re.search(r"status", c, re.I)]
    type_keys = [c for c in cols if re.search(r"type|class|category|fac_fdr|fac_type", c, re.I)]
    n = 0
    phone = email = web = addr = 0
    status_counts: Counter[str] = Counter()
    type_counts: Counter[str] = Counter()
    samples: list[dict] = []
    for row in reader:
        n += 1
        if any((row.get(k) or "").strip() for k in phone_keys):
            phone += 1
        if any((row.get(k) or "").strip() for k in email_keys):
            email += 1
        if any((row.get(k) or "").strip() for k in web_keys):
            web += 1
        if any((row.get(k) or "").strip() for k in addr_keys):
            addr += 1
        if status_keys:
            status_counts[(row.get(status_keys[0]) or "").strip() or "(blank)"] += 1
        if type_keys:
            type_counts[(row.get(type_keys[0]) or "").strip() or "(blank)"] += 1
        if len(samples) < 3:
            samples.append({k: row.get(k) for k in cols[:18]})
    return {
        "rows": n,
        "columns": cols,
        "phone_nonempty": phone,
        "email_nonempty": email,
        "website_nonempty": web,
        "address_nonempty": addr,
        "phone_keys": phone_keys,
        "email_keys": email_keys,
        "web_keys": web_keys,
        "status_counts": dict(status_counts.most_common(25)),
        "type_counts": dict(type_counts.most_common(40)),
        "samples": samples,
    }


def cslb_download(file_code: str, event_target: str, dest: Path) -> dict:
    url = "https://www.cslb.ca.gov/onlineservices/dataportal/ContractorList"
    st, body, _ = fetch(url)
    html = body.decode("utf-8", "replace")
    payload = {
        "__VIEWSTATE": hidden(html, "__VIEWSTATE"),
        "__VIEWSTATEGENERATOR": hidden(html, "__VIEWSTATEGENERATOR"),
        "__EVENTVALIDATION": hidden(html, "__EVENTVALIDATION"),
        "__EVENTTARGET": "ctl00$MainContent$ddlStatus",
        "__EVENTARGUMENT": "",
        "ctl00$MainContent$ddlStatus": file_code,
    }
    st2, body2, _ = fetch(
        url,
        data=urllib.parse.urlencode(payload).encode(),
        extra={"Content-Type": "application/x-www-form-urlencoded", "Referer": url},
        timeout=90,
    )
    html2 = body2.decode("utf-8", "replace")
    if f"lb{event_target.split('lb')[-1]}" not in html2 and event_target not in html2:
        (RAW / f"cslb_{file_code}_step2.html").write_text(html2, encoding="utf-8")
    payload2 = {
        "__VIEWSTATE": hidden(html2, "__VIEWSTATE"),
        "__VIEWSTATEGENERATOR": hidden(html2, "__VIEWSTATEGENERATOR"),
        "__EVENTVALIDATION": hidden(html2, "__EVENTVALIDATION"),
        "__EVENTTARGET": event_target,
        "__EVENTARGUMENT": "",
        "ctl00$MainContent$ddlStatus": file_code,
    }
    st3, body3, hdr3 = fetch(
        url,
        data=urllib.parse.urlencode(payload2).encode(),
        extra={"Content-Type": "application/x-www-form-urlencoded", "Referer": url},
        timeout=180,
    )
    info = {
        "http_status": st3,
        "content_type": hdr3.get("content-type"),
        "disposition": hdr3.get("content-disposition"),
        "bytes": len(body3),
        "step1_status": st,
        "step2_status": st2,
        "file_code": file_code,
        "event_target": event_target,
    }
    if st3 == 200 and not body3.lstrip().startswith(b"<") and len(body3) > 500:
        dest.write_bytes(body3)
        info["saved"] = True
        info["path"] = str(dest)
        info.update(profile_csv(dest, phone_re=r"phone|tel", email_re=r"email", web_re=r"web|url|website"))
        # fixture: header + 3 rows, redacted beyond business fields
        text = dest.read_text(encoding="utf-8-sig", errors="replace")
        lines = text.splitlines()
        fixture = "\n".join(lines[:4]) + "\n"
        (FIX / "contractor" / "fixtures").mkdir(parents=True, exist_ok=True)
        (FIX / "contractor" / "fixtures" / f"cslb-{file_code.lower()}-header-sample.csv").write_text(
            fixture, encoding="utf-8"
        )
        info["as_of"] = re.search(r"Updated as of ([^<]+)", html2)
        info["as_of"] = info["as_of"].group(1).strip() if info["as_of"] else None
        # do not keep huge raw in git; keep locally only
        return info
    info["saved"] = False
    info["snippet"] = body3[:400].decode("utf-8", "replace")
    (RAW / f"cslb_{file_code}_download.bin").write_bytes(body3[:8000])
    return info


def parse_debarment() -> dict:
    url = "https://www.dir.ca.gov/dlse/debar.html"
    st, body, _ = fetch(url)
    html = body.decode("utf-8", "replace")
    (RAW / "dir_debar.html").write_text(html, encoding="utf-8")
    tables = re.findall(r"<table[\s\S]*?</table>", html, flags=re.I)
    rows = re.findall(r"<tr[\s\S]*?</tr>", html, flags=re.I)
    # current debarments often in first data table
    current = 0
    names = []
    for tr in rows:
        cells = re.findall(r"<t[dh][^>]*>([\s\S]*?)</t[dh]>", tr, flags=re.I)
        texts = [re.sub(r"<[^>]+>", " ", c).replace("&nbsp;", " ").strip() for c in cells]
        texts = [re.sub(r"\s+", " ", t) for t in texts if t]
        if len(texts) >= 2 and not re.match(r"name of|contractor|debar", texts[0], re.I):
            current += 1
            if len(names) < 5:
                names.append(texts[:4])
    return {
        "url": url,
        "http_status": st,
        "bytes": len(body),
        "table_count": len(tables),
        "tr_count": len(rows),
        "parsed_data_rows": current,
        "sample_rows": names,
        "note": "HTML table parse of DLSE debarment page. Local debarments are a separate DIR portal list.",
    }


def soap_probe() -> dict:
    url = "https://www.cslb.ca.gov/onlineservices/DataPortalAPI/GetbyClassification.asmx"
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
        url,
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
            return {"http_status": resp.status, "bytes": len(sb), "body": sb.decode("utf-8", "replace")[:1500]}
    except urllib.error.HTTPError as e:
        sb = e.read() if e.fp else b""
        return {"http_status": e.code, "bytes": len(sb), "body": sb.decode("utf-8", "replace")[:1500]}
    except Exception as e:
        return {"error": str(e)}


def package_search(base: str, q: str) -> dict:
    url = f"{base}/api/3/action/package_search?q={urllib.parse.quote(q)}&rows=20"
    st, body, _ = fetch(url)
    if st != 200:
        return {"http_status": st, "q": q}
    payload = json.loads(body.decode("utf-8"))
    result = payload.get("result", {})
    return {
        "q": q,
        "count": result.get("count"),
        "titles": [
            {"name": r.get("name"), "title": r.get("title"), "org": (r.get("organization") or {}).get("title")}
            for r in result.get("results", [])[:12]
        ],
    }


def probe_urls(pairs: list[tuple[str, str]]) -> dict:
    out = {}
    for key, url in pairs:
        st, body, hdr = fetch(url, timeout=40)
        out[key] = {
            "url": url,
            "http_status": st,
            "content_type": hdr.get("content-type"),
            "bytes": len(body),
            "title": (re.search(r"<title>([^<]+)</title>", body.decode("utf-8", "replace"), re.I) or [None, None])[1],
            "incapsula": b"Incapsula" in body or b"_Incapsula_Resource" in body,
            "captcha": bool(re.search(rb"captcha|recaptcha|hcaptcha", body, re.I)),
        }
    return out


def main() -> None:
    summary: dict = {"ticket": "ATH-CA-001", "checked": "2026-09-03"}

    chhs = "https://data.chhs.ca.gov"
    ca = "https://data.ca.gov"

    loc_id = "f0ae5731-fef8-417f-839d-54a0ed3a126e"
    list_id = "641c5557-7d65-4379-8fea-6b7dedbda40b"
    beds_id = "3ce26934-6cd0-4fb9-8092-4fd96ef4dcbe"
    svc_id = "96d94608-e9d7-4fa8-b818-db848432360f"
    ecu_id = "291bacb8-2fdb-4d9c-a330-113781ce2f59"
    trainee_id = "f0b9e36d-32be-408d-8dd9-4d539becfdc8"
    enf_id = "bf9fdab6-76cf-4ee0-82ad-3c0f3e218a46"
    imr_id = "3340c5d7-4054-4d03-90e0-5f44290ed095"

    summary["ckan_totals"] = {
        "health_facility_locations": ckan_search(chhs, loc_id),
        "current_healthcare_listing": ckan_search(chhs, list_id),
        "certified_electrician": ckan_search(ca, ecu_id),
        "electrician_trainee": ckan_search(ca, trainee_id),
        "enforcement_actions_trend": ckan_search(chhs, enf_id),
        "imr_trend": ckan_search(chhs, imr_id),
        "facility_beds": ckan_search(chhs, beds_id),
        "facility_services": ckan_search(chhs, svc_id),
    }

    summary["chhs_sql"] = {
        "locations_occupancy": ckan_sql(
            chhs,
            'SELECT COUNT(*) AS n, '
            'COUNT(CONTACT_PHONE_NUMBER) AS phone, '
            'COUNT(CONTACT_EMAIL) AS email, '
            'COUNT(ADDRESS) AS address, '
            'COUNT(BUSINESS_NAME) AS business_name '
            f'FROM "{loc_id}"',
        ),
        "locations_status": ckan_sql(
            chhs,
            f'SELECT LICENSE_STATUS_DESCRIPTION AS status, COUNT(*) AS n FROM "{loc_id}" GROUP BY LICENSE_STATUS_DESCRIPTION ORDER BY n DESC',
        ),
        "locations_open_status": ckan_sql(
            chhs,
            f'SELECT FAC_STATUS_TYPE_CODE AS status, COUNT(*) AS n FROM "{loc_id}" GROUP BY FAC_STATUS_TYPE_CODE ORDER BY n DESC',
        ),
        "locations_type": ckan_sql(
            chhs,
            f'SELECT FAC_FDR AS type, COUNT(*) AS n FROM "{loc_id}" GROUP BY FAC_FDR ORDER BY n DESC',
        ),
        "listing_status": ckan_sql(
            chhs,
            f'SELECT FACILITY_STATUS_DESC AS status, COUNT(*) AS n FROM "{list_id}" GROUP BY FACILITY_STATUS_DESC ORDER BY n DESC',
        ),
        "listing_category": ckan_sql(
            chhs,
            f'SELECT LICENSE_CATEGORY_DESC AS category, COUNT(*) AS n FROM "{list_id}" GROUP BY LICENSE_CATEGORY_DESC ORDER BY n DESC',
        ),
        "listing_occupancy": ckan_sql(
            chhs,
            'SELECT COUNT(*) AS n, COUNT(DBA_ADDRESS1) AS address, COUNT(LICENSE_NUM) AS license_num, COUNT(OSHPD_ID) AS oshpd '
            f'FROM "{list_id}"',
        ),
    }

    # CKAN dump (not signed S3 URL)
    dump_dir = RAW / "dumps"
    dump_dir.mkdir(exist_ok=True)
    summary["ckan_dumps"] = {
        "locations": dump_csv(f"{chhs}/datastore/dump/{loc_id}", dump_dir / "health_facility_locations.csv"),
        "listing": dump_csv(f"{chhs}/datastore/dump/{list_id}", dump_dir / "hcai_listing.csv"),
        "electrician": dump_csv(f"{ca}/datastore/dump/{ecu_id}", dump_dir / "certified_electrician.csv"),
        "trainee": dump_csv(f"{ca}/datastore/dump/{trainee_id}", dump_dir / "electrician_trainee.csv"),
        "enforcement": dump_csv(f"{chhs}/datastore/dump/{enf_id}", dump_dir / "dmhc_enforcement_trend.csv"),
        "imr": dump_csv(f"{chhs}/datastore/dump/{imr_id}", dump_dir / "dmhc_imr_trend.csv"),
    }
    for key, dest_name in [
        ("locations", "health_facility_locations.csv"),
        ("listing", "hcai_listing.csv"),
        ("electrician", "certified_electrician.csv"),
        ("trainee", "electrician_trainee.csv"),
        ("enforcement", "dmhc_enforcement_trend.csv"),
        ("imr", "dmhc_imr_trend.csv"),
    ]:
        p = dump_dir / dest_name
        if p.exists() and summary["ckan_dumps"][key].get("saved"):
            summary["ckan_dumps"][key]["profile"] = profile_csv(p)

    print("CKAN dumps done; starting CSLB master postback")
    (FIX / "contractor" / "fixtures").mkdir(parents=True, exist_ok=True)
    summary["cslb"] = {
        "master_csv": cslb_download("M", "ctl00$MainContent$lbMasterCSV", RAW / "cslb_master.csv"),
    }
    # personnel/WC only if master succeeded quickly enough
    if summary["cslb"]["master_csv"].get("saved"):
        summary["cslb"]["personnel_csv"] = cslb_download(
            "P", "ctl00$MainContent$lbPersonnelCSV", RAW / "cslb_personnel.csv"
        )
        summary["cslb"]["wc_csv"] = cslb_download("W", "ctl00$MainContent$lbWCCSV", RAW / "cslb_wc.csv")

    summary["cslb_soap"] = soap_probe()
    summary["dir_debarment"] = parse_debarment()

    summary["package_search"] = {
        "ca_contractor": package_search(ca, "contractor"),
        "ca_mortgage": package_search(ca, "mortgage"),
        "ca_insurance": package_search(ca, "insurance"),
        "ca_mover": package_search(ca, "mover"),
        "ca_investment": package_search(ca, "investment adviser"),
        "ca_debarment": package_search(ca, "debarment"),
        "ca_cslb": package_search(ca, "CSLB"),
        "chhs_rcfe": package_search(chhs, "residential care facility elderly"),
        "chhs_home_health": package_search(chhs, "home health"),
        "chhs_hospice": package_search(chhs, "hospice"),
        "chhs_pace": package_search(chhs, "PACE"),
        "chhs_ccrc": package_search(chhs, "continuing care"),
        "chhs_ombudsman": package_search(chhs, "ombudsman"),
        "chhs_dmhc": package_search(chhs, "DMHC"),
    }

    summary["url_probes"] = probe_urls(
        [
            ("cslb_dataportal", "https://www.cslb.ca.gov/onlineservices/dataportal"),
            ("cslb_classifications", "https://www.cslb.ca.gov/About_Us/Library/Licensing_Classifications/"),
            ("cslb_forms", "https://www.cslb.ca.gov/about_us/library/forms_and_applications.aspx"),
            ("cslb_discipline", "https://www.cslb.ca.gov/Consumers/Complaints/Disciplinary_Actions.aspx"),
            ("cslb_check", "https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx"),
            ("dir_pw", "https://www.dir.ca.gov/Public-Works/Contractors.html"),
            ("dir_pwcr", "https://www.dir.ca.gov/public-works/contractor-registration.html"),
            ("dir_services_pw", "https://services.dir.ca.gov/pw"),
            ("dir_debar", "https://www.dir.ca.gov/dlse/debar.html"),
            ("bhgs_home", "https://bhgs.dca.ca.gov/"),
            ("bhgs_search", "https://search.dca.ca.gov/"),
            ("dfpi_home", "https://dfpi.ca.gov/"),
            ("dfpi_crmla", "https://dfpi.ca.gov/regulated-industries/california-residential-mortgage-lending-act/"),
            ("dfpi_search", "https://dfpi.ca.gov/licensee-and-financial-service-provider-search/"),
            ("docqnet", "https://docqnet.dfpi.ca.gov/licensesearch"),
            ("nmls", "https://www.nmlsconsumeraccess.org/"),
            ("cdi_home", "https://www.insurance.ca.gov/"),
            ("cdi_lookup", "https://www.insurance.ca.gov/01-consumers/120-company/lookup/index.cfm"),
            ("cdss_ccld", "https://www.cdss.ca.gov/inforesources/community-care-licensing"),
            ("ccld_search", "https://www.ccld.dss.ca.gov/carefacilitysearch/"),
            ("calhfa", "https://www.calhfa.ca.gov/"),
            ("dre_home", "https://www.dre.ca.gov/"),
            ("dre_lookup", "https://www2.dre.ca.gov/PublicASP/pplinfo.asp"),
            ("sos_bizfile", "https://bizfileonline.sos.ca.gov/search/business"),
            ("dgs_fiscal", "https://www.dgs.ca.gov/PD/About/Page-Content/PD-Branch-Intro-Folder/FISCal"),
            ("caleprocure", "https://caleprocure.ca.gov/pages/index.aspx"),
            ("dca_data", "https://www.dca.ca.gov/data/"),
            ("dca_public_info", "https://www.dca.ca.gov/consumers/public_info/"),
            ("fairplan", "https://www.fairplan.org/"),
            ("hcai", "https://hcai.ca.gov/"),
        ]
    )

    (RAW / "acquire-official.json").write_text(json.dumps(summary, indent=2, default=str), encoding="utf-8")
    # compact print
    compact = {
        "cslb_master": {
            k: summary["cslb"]["master_csv"].get(k)
            for k in [
                "http_status",
                "saved",
                "bytes",
                "rows",
                "columns",
                "phone_nonempty",
                "email_nonempty",
                "website_nonempty",
                "status_counts",
                "as_of",
                "snippet",
            ]
            if k in summary["cslb"]["master_csv"] or True
        },
        "cslb_personnel_rows": (summary["cslb"].get("personnel_csv") or {}).get("rows"),
        "cslb_wc_rows": (summary["cslb"].get("wc_csv") or {}).get("rows"),
        "soap_status": summary["cslb_soap"].get("http_status"),
        "debar_rows": summary["dir_debarment"].get("parsed_data_rows"),
        "chhs_sql": {
            k: v.get("records") or v.get("http_status") for k, v in summary["chhs_sql"].items()
        },
        "ckan_totals": {k: v.get("total") for k, v in summary["ckan_totals"].items()},
        "dumps_saved": {k: v.get("saved") for k, v in summary["ckan_dumps"].items()},
        "dump_profiles": {
            k: (v.get("profile") or {}).get("rows") for k, v in summary["ckan_dumps"].items()
        },
    }
    print(json.dumps(compact, indent=2, default=str)[:20000])


if __name__ == "__main__":
    main()
