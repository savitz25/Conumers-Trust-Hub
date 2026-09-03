"""ATH-CA-001 — official California source probe. No CAPTCHA, no session scrape."""

from __future__ import annotations

import json
import re
import ssl
import urllib.error
import urllib.request
from pathlib import Path

UA = "AskTrustHub-ATH-CA-001/1.0 (research; official-source probe)"
CTX = ssl.create_default_context()
OUT = Path("data/raw/california")
OUT.mkdir(parents=True, exist_ok=True)


def fetch(url: str, timeout: int = 45) -> tuple[int, bytes, dict]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=CTX) as resp:
            body = resp.read()
            headers = {k.lower(): v for k, v in resp.headers.items()}
            return resp.status, body, headers
    except urllib.error.HTTPError as e:
        return e.code, e.read() if e.fp else b"", dict(e.headers.items()) if e.headers else {}
    except Exception as e:
        return 0, str(e).encode(), {}


def head_or_get(url: str) -> dict:
    status, body, headers = fetch(url)
    ct = headers.get("content-type", "")
    cl = headers.get("content-length", "")
    snippet = body[:400].decode("utf-8", "replace").replace("\n", " ")
    return {
        "url": url,
        "http_status": status,
        "content_type": ct,
        "content_length": cl or str(len(body)),
        "bytes": len(body),
        "snippet": snippet[:240],
    }


def main() -> None:
    results = []

    # CSLB portal pages
    for url in [
        "https://www.cslb.ca.gov/onlineservices/dataportal",
        "https://www.cslb.ca.gov/onlineservices/dataportal/ContractorList",
        "https://www.cslb.ca.gov/About_Us/Library/Licensing_Classifications/",
        "https://www.cslb.ca.gov/About_Us/Library/Reports/",
        "https://www.cslb.ca.gov/Consumers/Complaints/Disciplinary_Actions.aspx",
    ]:
        results.append(("cslb_page", head_or_get(url)))

    status, body, _ = fetch("https://www.cslb.ca.gov/onlineservices/dataportal/ContractorList")
    html = body.decode("utf-8", "replace")
    (OUT / "cslb_contractor_list.html").write_text(html, encoding="utf-8")
    hrefs = sorted(set(re.findall(r'href=["\']([^"\']+)["\']', html, flags=re.I)))
    options = re.findall(r'<option[^>]*value=["\']([^"\']+)["\'][^>]*>([^<]*)</option>', html, flags=re.I)
    results.append(("cslb_hrefs", {"count": len(hrefs), "hrefs": hrefs[:80], "options": options[:40]}))

    # Guess common download patterns
    guesses = [
        "https://www.cslb.ca.gov/onlineservices/dataportal/LicenseMaster.csv",
        "https://www.cslb.ca.gov/onlineservices/dataportal/LicenseMaster.xls",
        "https://www.cslb.ca.gov/onlineservices/dataportal/Download.aspx",
        "https://www.cslb.ca.gov/OnlineServices/DataPortal/LicenseMaster",
        "https://www.cslb.ca.gov/media/cslb_website/documents/dataportal/LicenseMaster.csv",
    ]
    for url in guesses:
        results.append(("cslb_guess", head_or_get(url)))

    # CHHS / CDPH healthcare facilities — known CSV
    chhs = [
        "https://data.chhs.ca.gov/dataset/3b5b80e8-6b8d-4715-b3c0-2699af6e72e5/resource/f0ae5731-fef8-417f-839d-54a0ed3a126e/download/health_facility_locations.csv",
        "https://data.chhs.ca.gov/dataset/59d9abe7-2664-407a-a5aa-f89a866f3381/resource/641c5557-7d65-4379-8fea-6b7dedbda40b/download/current-healthcare-facility-listing20260901.csv",
        "https://data.chhs.ca.gov/dataset/licensed-healthcare-facility-listing",
        "https://data.chhs.ca.gov/dataset/healthcare-facility-locations",
        "https://data.chhs.ca.gov/dataset/licensed-facility-crosswalk",
        "https://data.chhs.ca.gov/api/3/action/package_show?id=healthcare-facility-locations",
        "https://data.chhs.ca.gov/api/3/action/package_show?id=licensed-healthcare-facility-listing",
    ]
    for url in chhs:
        r = head_or_get(url)
        results.append(("chhs", r))
        if r["http_status"] == 200 and "csv" in (r["content_type"] or "").lower() and int(r["bytes"]) > 1000:
            dest = OUT / Path(url.split("?")[0]).name
            if not dest.exists() or dest.stat().st_size < 1000:
                _, body2, _ = fetch(url, timeout=90)
                dest.write_bytes(body2)
                results.append(("chhs_saved", {"path": str(dest), "bytes": len(body2)}))

    # DIR electrician
    dir_ecu = [
        "https://data.ca.gov/dataset/dir-electrician-certification-unit-ecu",
        "https://data.ca.gov/api/3/action/package_show?id=dir-electrician-certification-unit-ecu",
        "https://www.dir.ca.gov/dlse/debar.html",
        "https://www.dir.ca.gov/dlse/debarment.htm",
        "https://www.dir.ca.gov/dlse/debarment.html",
        "https://www.dir.ca.gov/dlse/Debarment_List.htm",
        "https://www.dir.ca.gov/Public-Works/Debarment.html",
        "https://www.dir.ca.gov/dlse/DBA_Debarment_List.htm",
        "https://www.dir.ca.gov/dlse/ecu/ElectricalTrade.html",
        "https://cadir.my.salesforce-sites.com/ContractorSearch",
        "https://www.dir.ca.gov/databases/dba/pwc102.html",
        "https://www.dir.ca.gov/Public-Works/Contractors.html",
    ]
    for url in dir_ecu:
        results.append(("dir", head_or_get(url)))

    # BHGS movers, CDI, DFPI, SOS, Cal eProcure, CalHFA, DSS
    others = [
        "https://bhgs.dca.ca.gov/",
        "https://bhgs.dca.ca.gov/consumers/index.shtml",
        "https://bhgs.dca.ca.gov/licensee/hhm_faqs.shtml",
        "https://search.dca.ca.gov/",
        "https://www.insurance.ca.gov/",
        "https://www.insurance.ca.gov/01-consumers/120-company/lookup/index.cfm",
        "https://interactive.web.insurance.ca.gov/apex_extprd/f?p=111:50",
        "https://www.insurance.ca.gov/01-consumers/101-help/index.cfm",
        "https://dfpi.ca.gov/",
        "https://dfpi.ca.gov/licensee-and-financial-service-provider-search/",
        "https://dfpi.ca.gov/enforcement-actions/",
        "https://dfpi.ca.gov/regulated-industries/california-residential-mortgage-lending-act/",
        "https://bizfileonline.sos.ca.gov/",
        "https://bizfileonline.sos.ca.gov/search/business",
        "https://caleprocure.ca.gov/pages/index.aspx",
        "https://caleprocure.ca.gov/pages/public-search.aspx",
        "https://www.dgs.ca.gov/PD/About/Page-Content/PD-Branch-Intro-Folder/FISCal",
        "https://www.calhfa.ca.gov/",
        "https://www.cdss.ca.gov/inforesources/community-care-licensing",
        "https://www.ccld.dss.ca.gov/carefacilitysearch/",
        "https://www.cdph.ca.gov/Programs/CHCQ/LCP/Pages/LandC.aspx",
        "https://www.dre.ca.gov/",
        "https://www2.dre.ca.gov/PublicASP/pplinfo.asp",
        "https://www.fairplan.org/",
        "https://data.ca.gov/api/3/action/package_search?q=contractor",
        "https://data.ca.gov/api/3/action/package_search?q=CSLB",
        "https://data.ca.gov/api/3/action/package_search?q=household+mover",
        "https://data.ca.gov/api/3/action/package_search?q=investment+adviser",
        "https://data.ca.gov/api/3/action/package_search?q=debarment",
        "https://www.dir.ca.gov/dlse/ECU/CertifiedElectrician.pdf",
    ]
    for url in others:
        results.append(("other", head_or_get(url)))

    report = OUT / "probe-results.json"
    report.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"wrote {report} n={len(results)}")
    for kind, row in results:
        if isinstance(row, dict) and row.get("http_status") in (200, 301, 302, 303):
            print(f"{kind} {row.get('http_status')} {row.get('bytes')} {row.get('url','')[:90]}")


if __name__ == "__main__":
    main()
