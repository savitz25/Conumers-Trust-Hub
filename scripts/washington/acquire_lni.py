#!/usr/bin/env python3
"""ATH-WA-001 — acquire L&I contractor general / bond / insurance CSVs.

Official Socrata CSV downloads only. Raw files stay gitignored under data/raw/.
Exact join on ContractorLicenseNumber. Do not hide orphans.
CURRENT registration != current bond/insurance unless the source proves it.
"""
from __future__ import annotations

import csv
import hashlib
import json
import urllib.request
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "wa_lni"
NET = ROOT / "data" / "network" / "washington"
UA = "AskTrustHub/ath-wa-001-research (https://www.asktrusthub.com)"
TODAY = date(2026, 9, 4)

DATASETS = {
    "general": {
        "id": "m8qx-ubtq",
        "name": "L&I Contractor License Data - General",
        "url": "https://data.wa.gov/api/views/m8qx-ubtq/rows.csv?accessType=DOWNLOAD",
        "portal": "https://data.wa.gov/Labor/L-I-Contractor-License-Data-General/m8qx-ubtq",
        "filename": "lni_contractor_general.csv",
    },
    "bond": {
        "id": "bzff-4fmt",
        "name": "L&I Contractor License Data - Bond",
        "url": "https://data.wa.gov/api/views/bzff-4fmt/rows.csv?accessType=DOWNLOAD",
        "portal": "https://data.wa.gov/Labor/L-I-Contractor-License-Data-Bond/bzff-4fmt",
        "filename": "lni_contractor_bond.csv",
    },
    "insurance": {
        "id": "ciwg-agsx",
        "name": "L&I Contractor License Data - Insurance",
        "url": "https://data.wa.gov/api/views/ciwg-agsx/rows.csv?accessType=DOWNLOAD",
        "portal": "https://data.wa.gov/Labor/L-I-Contractor-License-Data-Insurance/ciwg-agsx",
        "filename": "lni_contractor_insurance.csv",
    },
}


def download(url: str, dest: Path) -> dict:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    hasher = hashlib.sha256()
    nbytes = 0
    with urllib.request.urlopen(req, timeout=300) as resp, dest.open("wb") as out:
        status = getattr(resp, "status", None)
        last_mod = resp.headers.get("Last-Modified")
        content_type = resp.headers.get("Content-Type")
        while True:
            chunk = resp.read(1024 * 256)
            if not chunk:
                break
            out.write(chunk)
            hasher.update(chunk)
            nbytes += len(chunk)
    return {
        "path": str(dest).replace("\\", "/"),
        "bytes": nbytes,
        "sha256": hasher.hexdigest(),
        "http_status": status,
        "last_modified": last_mod,
        "content_type": content_type,
        "downloaded_at": datetime.now(timezone.utc).isoformat(),
    }


def nonempty(v: str | None) -> bool:
    return bool(v and str(v).strip() and str(v).strip().upper() not in {"NA", "N/A", "NULL", "NONE"})


def parse_date(v: str | None) -> date | None:
    if not nonempty(v):
        return None
    s = str(v).strip()
    if s.lower() in {"until canceled", "until cancelled"}:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y"):
        try:
            return datetime.strptime(s[:26], fmt).date()
        except ValueError:
            continue
    if "T" in s:
        try:
            return datetime.fromisoformat(s.replace("Z", "+00:00")).date()
        except ValueError:
            return None
    return None


def until_canceled(v: str | None) -> bool:
    return bool(v and "until cancel" in str(v).strip().lower())


def profile_csv(path: Path, key_field: str) -> dict:
    csv.field_size_limit(10_000_000)
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fields = list(reader.fieldnames or [])
        rows = 0
        keys: set[str] = set()
        dup_keys = 0
        occupancy: Counter[str] = Counter()
        status: Counter[str] = Counter()
        types: Counter[str] = Counter()
        biz: Counter[str] = Counter()
        spec: Counter[str] = Counter()
        states: Counter[str] = Counter()
        bond_amt: Counter[str] = Counter()
        ins_amt: Counter[str] = Counter()
        impaired: Counter[str] = Counter()
        samples: list[dict] = []
        for row in reader:
            rows += 1
            key = (row.get(key_field) or "").strip()
            if key:
                if key in keys:
                    dup_keys += 1
                keys.add(key)
            for k, v in row.items():
                if nonempty(v):
                    occupancy[k] += 1
            st = (row.get("ContractorLicenseStatus") or row.get("Status") or "").strip()
            if st:
                status[st] += 1
            t = (row.get("ContractorLicenseTypeCodeDesc") or "").strip()
            if t:
                types[t] += 1
            b = (row.get("BusinessTypeCodeDesc") or "").strip()
            if b:
                biz[b] += 1
            s1 = (row.get("SpecialtyCode1") or "").strip()
            if s1:
                spec[s1] += 1
            stt = (row.get("State") or "").strip().upper()
            if stt:
                states[stt] += 1
            ba = (row.get("BondAmt") or "").strip()
            if ba:
                bond_amt[ba] += 1
            ia = (row.get("InsuranceAmt") or "").strip()
            if ia:
                ins_amt[ia] += 1
            imp = (row.get("BondImpaired") or "").strip()
            if imp:
                impaired[imp] += 1
            if len(samples) < 3:
                samples.append({k: row.get(k) for k in fields[:20]})
    return {
        "rows": rows,
        "fields": fields,
        "unique_license_numbers": len(keys),
        "duplicate_key_rows": dup_keys,
        "occupancy": dict(occupancy),
        "status": dict(status.most_common()),
        "license_types": dict(types.most_common()),
        "business_types": dict(biz.most_common()),
        "specialty1": dict(spec.most_common(20)),
        "states": dict(states.most_common(15)),
        "bond_amounts": dict(bond_amt.most_common(10)),
        "insurance_amounts": dict(ins_amt.most_common(10)),
        "bond_impaired": dict(impaired.most_common()),
        "sample_headers_only": True,
    }


def load_keys_and_current(path: Path, kind: str) -> tuple[set[str], set[str], dict]:
    """Return (all keys, current-evidence keys, extra stats)."""
    all_keys: set[str] = set()
    current: set[str] = set()
    multi: Counter[str] = Counter()
    extra = {
        "current_rule": "",
        "current_rows": 0,
        "licenses_with_multiple_rows": 0,
    }
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            key = (row.get("ContractorLicenseNumber") or "").strip()
            if not key:
                continue
            all_keys.add(key)
            multi[key] += 1
            if kind == "general":
                extra["current_rule"] = "ContractorLicenseStatus == ACTIVE"
                if (row.get("ContractorLicenseStatus") or "").strip().upper() == "ACTIVE":
                    current.add(key)
                    extra["current_rows"] += 1
            elif kind == "bond":
                extra["current_rule"] = (
                    "BondCancelDate empty AND (BondExpirationDate empty OR until-canceled OR expiration >= 2026-09-04)"
                )
                cancel = row.get("BondCancelDate")
                exp_raw = row.get("BondExpirationDate")
                exp = parse_date(exp_raw)
                is_current = (not nonempty(cancel)) and (
                    not nonempty(exp_raw) or until_canceled(exp_raw) or (exp is not None and exp >= TODAY)
                )
                if is_current:
                    current.add(key)
                    extra["current_rows"] += 1
            elif kind == "insurance":
                extra["current_rule"] = (
                    "CancelDate empty AND (ExpirationDate empty OR expiration >= 2026-09-04)"
                )
                cancel = row.get("CancelDate")
                exp = parse_date(row.get("ExpirationDate"))
                exp_raw = row.get("ExpirationDate")
                is_current = (not nonempty(cancel)) and (
                    not nonempty(exp_raw) or (exp is not None and exp >= TODAY)
                )
                if is_current:
                    current.add(key)
                    extra["current_rows"] += 1
    extra["licenses_with_multiple_rows"] = sum(1 for n in multi.values() if n > 1)
    extra["max_rows_per_license"] = max(multi.values()) if multi else 0
    return all_keys, current, extra


def main() -> int:
    RAW.mkdir(parents=True, exist_ok=True)
    NET.mkdir(parents=True, exist_ok=True)
    report: dict = {
        "ticket": "ATH-WA-001",
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "as_of": "2026-09-04",
        "files": {},
        "profiles": {},
        "join": {},
        "semantics": [
            "CONTRACTOR REGISTRATION != QUALITY",
            "BOND != ENDORSEMENT",
            "INSURANCE RECORD != SAFETY",
            "EXPIRED POLICY != DISCIPLINE",
            "UBI != PROFESSIONAL LICENSE",
            "CURRENT REGISTRATION != CURRENT BOND/INSURANCE unless source proves it",
            "MISSING != ZERO",
            "CreatedBy_WAOIC_ID is L&I submitter/staff, not a producer roster",
        ],
    }

    for kind, meta in DATASETS.items():
        dest = RAW / meta["filename"]
        print(f"GET {meta['url']}")
        file_info = download(meta["url"], dest)
        file_info.update({"dataset_id": meta["id"], "portal": meta["portal"], "name": meta["name"]})
        report["files"][kind] = file_info
        print(f"  {dest.name} {file_info['bytes']} bytes sha256={file_info['sha256'][:12]}...")
        prof = profile_csv(dest, "ContractorLicenseNumber")
        # drop bulky occupancy of empty-only cols later; keep all
        report["profiles"][kind] = {
            "rows": prof["rows"],
            "fields": prof["fields"],
            "unique_license_numbers": prof["unique_license_numbers"],
            "duplicate_key_rows": prof["duplicate_key_rows"],
            "status": prof["status"],
            "license_types": prof["license_types"],
            "business_types": prof["business_types"],
            "specialty1": prof["specialty1"],
            "states": prof["states"],
            "bond_amounts": prof["bond_amounts"],
            "insurance_amounts": prof["insurance_amounts"],
            "bond_impaired": prof["bond_impaired"],
            "occupancy_selected": {
                k: prof["occupancy"].get(k, 0)
                for k in [
                    "BusinessName",
                    "ContractorLicenseNumber",
                    "PhoneNumber",
                    "Address1",
                    "City",
                    "State",
                    "Zip",
                    "UBI",
                    "PrimaryPrincipalName",
                    "ContractorLicenseStatus",
                    "BondFirmName",
                    "BondAccountID",
                    "BondAmt",
                    "BondEffectiveDate",
                    "BondExpirationDate",
                    "BondCancelDate",
                    "BondImpaired",
                    "InsuranceCompany",
                    "InsurancePolicyNo",
                    "InsuranceAmt",
                    "EffectiveDate",
                    "ExpirationDate",
                    "CancelDate",
                    "InsuranceAgencyName",
                    "CreatedBy_WAOIC_ID",
                    "UpdatedBy_WAOIC_ID",
                ]
                if k in prof["fields"] or prof["occupancy"].get(k)
            },
        }

    g_all, g_active, g_extra = load_keys_and_current(RAW / DATASETS["general"]["filename"], "general")
    b_all, b_cur, b_extra = load_keys_and_current(RAW / DATASETS["bond"]["filename"], "bond")
    i_all, i_cur, i_extra = load_keys_and_current(RAW / DATASETS["insurance"]["filename"], "insurance")

    join = {
        "general_unique": len(g_all),
        "general_active": len(g_active),
        "bond_unique": len(b_all),
        "bond_current_evidence": len(b_cur),
        "insurance_unique": len(i_all),
        "insurance_current_evidence": len(i_cur),
        "general_with_any_bond_row": len(g_all & b_all),
        "general_with_any_insurance_row": len(g_all & i_all),
        "general_with_bond_and_insurance_row": len(g_all & b_all & i_all),
        "general_without_bond_row": len(g_all - b_all),
        "general_without_insurance_row": len(g_all - i_all),
        "bond_orphan_not_in_general": len(b_all - g_all),
        "insurance_orphan_not_in_general": len(i_all - g_all),
        "active_with_current_bond_evidence": len(g_active & b_cur),
        "active_with_current_insurance_evidence": len(g_active & i_cur),
        "active_with_current_bond_and_insurance": len(g_active & b_cur & i_cur),
        "active_without_current_bond_evidence": len(g_active - b_cur),
        "active_without_current_insurance_evidence": len(g_active - i_cur),
        "general_extra": g_extra,
        "bond_extra": b_extra,
        "insurance_extra": i_extra,
        "notes": [
            "Join is exact ContractorLicenseNumber only.",
            "Bond/insurance files are evidence rows, not 1:1 roster copies. Multiple rows per license are expected.",
            "Orphans are preserved. Missing bond/insurance row is not zero coverage and is not discipline.",
            "Current-evidence flags are date/cancel heuristics on the published file, not a quality or safety claim.",
            "Do not mint insured-forever or recommended-contractor labels.",
        ],
    }
    report["join"] = join

    out = NET / "lni-three-layer-join.json"
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {out}")
    print(json.dumps(join, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
