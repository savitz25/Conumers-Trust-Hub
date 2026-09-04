#!/usr/bin/env python3
"""ATH-WA-001 — write Washington six-hub research manifests. No /washington UI."""
from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NET = ROOT / "data" / "network" / "washington"
RAW = ROOT / "data" / "raw" / "wa_lni"
CHECKED = "2026-09-04"
TICKET = "ATH-WA-001"


def dump(path: Path, obj: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2) + "\n", encoding="utf-8")


def contact(phone=None, email=None, web=None, phys=None, mail=None):
    def field(v):
        if v is None:
            return {"present": "UNKNOWN", "count": "UNKNOWN"}
        if v is False or v == 0:
            return {"present": False, "count": 0}
        if v is True:
            return {"present": True, "count": "UNKNOWN"}
        return {"present": True, "count": v}

    return {
        "BUSINESS_PHONE": field(phone),
        "BUSINESS_EMAIL": field(email),
        "WEBSITE": field(web),
        "PHYSICAL_BUSINESS_ADDRESS": field(phys),
        "MAILING_BUSINESS_ADDRESS": field(mail),
    }


def hv(**kwargs):
    base = {
        "ASK": "LOW",
        "CONTRACTOR": "NONE",
        "LENDER": "NONE",
        "INSURANCE": "NONE",
        "SENIOR": "NONE",
        "MOVE": "NONE",
        "INVESTOR": "NONE",
    }
    base.update(kwargs)
    return base


def scores(identity="LOW", contact_v="NONE", regulatory="LOW", market="LOW", ease="LOW", refresh="LOW"):
    return {
        "IDENTITY_VALUE": identity,
        "CONTACT_VALUE": contact_v,
        "REGULATORY_VALUE": regulatory,
        "ENFORCEMENT_VALUE": regulatory if regulatory in {"HIGH", "MEDIUM", "LOW", "NONE"} else "LOW",
        "MARKET_INTELLIGENCE_VALUE": market,
        "ACQUISITION_EASE": ease,
        "REFRESHABILITY": refresh,
    }


JOIN = {
    "general_rows": 160923,
    "general_unique": 160923,
    "general_active": 75823,
    "phone_nonempty": 160850,
    "address_nonempty": 160923,
    "ubi_nonempty": 160923,
    "unique_ubi": 149153,
    "active_unique_ubi": 72822,
    "principal_name_nonempty": 160555,
    "bond_rows": 176920,
    "bond_unique": 82635,
    "bond_current_evidence": 77261,
    "bond_impaired_y": 294,
    "insurance_rows": 77005,
    "insurance_unique": 70953,
    "insurance_current_evidence": 70919,
    "general_with_any_bond_row": 82635,
    "general_with_any_insurance_row": 70953,
    "general_with_bond_and_insurance_row": 70622,
    "general_without_bond_row": 78288,
    "general_without_insurance_row": 89970,
    "bond_orphan_not_in_general": 0,
    "insurance_orphan_not_in_general": 0,
    "active_with_current_bond_evidence": 75044,
    "active_with_current_insurance_evidence": 70425,
    "active_with_current_bond_and_insurance": 69966,
    "active_without_current_bond_evidence": 779,
    "active_without_current_insurance_evidence": 5398,
    "principal_rows": 250349,
    "authorized_signer_rows": 10444,
    "pw_project_rows": 347082,
    "affidavit_rows": 1192380,
    "intent_rows": 1314773,
    "pw_apprentice_rows": 347478,
    "afh_current": 6179,
    "alf_current": 557,
    "esf_current": 16,
    "sl_current": 187,
    "gt_current": 29,
    "residential_current": 6968,
    "residential_all_including_archive": 134442,
}

FILES = {
    "general": {
        "bytes": 35382044,
        "sha256": "818c7f8df6ecb857aea6375c2b6ec884ae278cc6a89999c0bf8ad49f87285b20",
        "clock": "Last-Modified Fri, 04 Sep 2026 15:10:51 GMT; Socrata rowsUpdatedAt 1788534678",
    },
    "bond": {
        "bytes": 28382948,
        "sha256": "127d8788bc09df8774b54a2d770e38fde70633f3a7c6577a2b20f0b8f5e6d6a7",
        "clock": "Last-Modified Fri, 04 Sep 2026 14:33:15 GMT; Socrata rowsUpdatedAt 1788532403",
    },
    "insurance": {
        "bytes": 15955496,
        "sha256": "69108d87fbb6ac2eef9a3f33b36fa25296c59c2f0bcff9dd81da674971f99c35",
        "clock": "Last-Modified Fri, 04 Sep 2026 14:39:09 GMT; Socrata rowsUpdatedAt 1788532772",
    },
}


def src(**kwargs):
    kwargs.setdefault("ticket", TICKET)
    kwargs.setdefault("last_checked", CHECKED)
    kwargs.setdefault("source_as_of", CHECKED)
    return kwargs


SOURCES = [
    src(
        source_id="wa-lni-contractor-general",
        hub_home="CONTRACTOR",
        source_family="license_roster",
        source_name="L&I Contractor License Data - General",
        regulator="Washington State Department of Labor & Industries",
        source_url="https://data.wa.gov/Labor/L-I-Contractor-License-Data-General/m8qx-ubtq",
        download_url="https://data.wa.gov/api/views/m8qx-ubtq/rows.csv?accessType=DOWNLOAD",
        verify_url="https://secure.lni.wa.gov/verify/",
        dataset_id="m8qx-ubtq",
        access_class="OPEN_SODA_API",
        contact_rank="OFFICIAL_REGULATOR",
        identity_bar="EXACT",
        identity_field="WA-LNI:{ContractorLicenseNumber}",
        source_clock=FILES["general"]["clock"],
        grain="contractor_registration",
        record_count=JOIN["general_rows"],
        active_count=JOIN["general_active"],
        unique_ubi=JOIN["unique_ubi"],
        count_notes=(
            "Live CSV 160,923 rows / 160,923 unique ContractorLicenseNumber on 2026-09-04. "
            "ACTIVE 75,823; EXPIRED 61,083; SUSPENDED 9,731; RE-LICENSED 9,349; OUT OF BUSINESS 4,696. "
            "Types: CONSTRUCTION CONTRACTOR 148,557; ELECTRICAL CONTRACTOR 9,186; PLUMBING CONTRACTOR 3,059; ELEVATOR CONTRACTOR 121. "
            "SpecialtyCode1 01 (GENERAL) 117,378. UBI nonempty 160,923 on 149,153 unique UBI values. "
            "UBI may have multiple license records. UBI != professional license. "
            "Washington has a statewide contractor registration (RCW 18.27) — not a Texas-style gap. "
            "Registration != quality."
        ),
        identifier_fields=["ContractorLicenseNumber", "UBI"],
        contact_fields=contact(phone=160850, email=0, web=0, phys=160923, mail=160923),
        contact_notes="No email or website columns. PhoneNumber is official business phone. Address1 is mailing address as indicated by the contractor. PrimaryPrincipalName is a person field (160,555 nonempty) — REVIEW_ONLY, not a business profile.",
        other_fields=["BusinessName", "ContractorLicenseStatus", "LicenseEffectiveDate", "LicenseExpirationDate", "SpecialtyCode1", "BusinessTypeCodeDesc"],
        terms_notes="Open Data Commons PDDL. Updated three times daily (7:30 a.m., 12:15 p.m., 5:15 p.m.). Verify current status at secure.lni.wa.gov/verify/.",
        redistribution_notes="Do not commit the 35.4 Mb CSV. Person principal names are not published this ticket.",
        hub_value=hv(ASK="HIGH", CONTRACTOR="HIGH", MOVE="LOW", INSURANCE="LOW"),
        value_scores=scores("HIGH", "HIGH", "HIGH", "HIGH", "HIGH", "HIGH"),
        acquisition_status="ACQUIRED_LOCAL_GITIGNORED",
        acquired_rows=160923,
        sha256=FILES["general"]["sha256"],
        bytes=FILES["general"]["bytes"],
    ),
    src(
        source_id="wa-lni-contractor-bond",
        hub_home="CONTRACTOR",
        source_family="bond_evidence",
        source_name="L&I Contractor License Data - Bond",
        regulator="Washington State Department of Labor & Industries",
        source_url="https://data.wa.gov/Labor/L-I-Contractor-License-Data-Bond/bzff-4fmt",
        download_url="https://data.wa.gov/api/views/bzff-4fmt/rows.csv?accessType=DOWNLOAD",
        dataset_id="bzff-4fmt",
        access_class="OPEN_SODA_API",
        contact_rank="OFFICIAL_REGULATOR",
        identity_bar="EXACT",
        identity_field="ContractorLicenseNumber",
        source_clock=FILES["bond"]["clock"],
        grain="bond_evidence_row",
        record_count=JOIN["bond_rows"],
        unique_license_numbers=JOIN["bond_unique"],
        count_notes=(
            "176,920 evidence rows on 82,635 unique license numbers. Multiple rows per license expected (56,777 licenses have >1 row; max 9). "
            "Typical BondAmt 12,000 / 30,000 / 6,000 / 15,000. BondImpaired=Y on 294 rows. "
            "Bond != endorsement. Current registration != current bond unless this file proves an uncancelled current-evidence row. "
            "Orphans vs general: 0."
        ),
        identifier_fields=["ContractorLicenseNumber", "BondAccountID", "UBI"],
        contact_fields=contact(phone=0, email=0, web=0, phys=0, mail=0),
        other_fields=["BondFirmName", "BondAmt", "BondEffectiveDate", "BondExpirationDate", "BondCancelDate", "BondImpaired"],
        hub_value=hv(ASK="HIGH", CONTRACTOR="HIGH", INSURANCE="MEDIUM"),
        value_scores=scores("HIGH", "NONE", "HIGH", "HIGH", "HIGH", "HIGH"),
        acquisition_status="ACQUIRED_LOCAL_GITIGNORED",
        acquired_rows=176920,
        sha256=FILES["bond"]["sha256"],
        bytes=FILES["bond"]["bytes"],
    ),
    src(
        source_id="wa-lni-contractor-insurance",
        hub_home="CONTRACTOR",
        source_family="insurance_evidence",
        source_name="L&I Contractor License Data - Insurance",
        regulator="Washington State Department of Labor & Industries",
        source_url="https://data.wa.gov/Labor/L-I-Contractor-License-Data-Insurance/ciwg-agsx",
        download_url="https://data.wa.gov/api/views/ciwg-agsx/rows.csv?accessType=DOWNLOAD",
        dataset_id="ciwg-agsx",
        access_class="OPEN_SODA_API",
        contact_rank="OFFICIAL_REGULATOR",
        identity_bar="EXACT",
        identity_field="ContractorLicenseNumber",
        source_clock=FILES["insurance"]["clock"],
        grain="liability_insurance_evidence_row",
        record_count=JOIN["insurance_rows"],
        unique_license_numbers=JOIN["insurance_unique"],
        count_notes=(
            "77,005 evidence rows on 70,953 unique license numbers. Typical InsuranceAmt 1,000,000 (68,255 rows). "
            "File is smaller than general because it is currently reported policy evidence, not a 1:1 roster. "
            "Insurance record != safety. Expired policy != discipline. Missing insurance row != zero and != discipline. "
            "CreatedBy_WAOIC_ID / UpdatedBy_WAOIC_ID are L&I submitter/staff IDs — not an OIC producer roster. "
            "Orphans vs general: 0."
        ),
        identifier_fields=["ContractorLicenseNumber", "InsurancePolicyNo", "UBI"],
        contact_fields=contact(phone=0, email=0, web=0, phys=0, mail=0),
        other_fields=["InsuranceCompany", "InsuranceAmt", "EffectiveDate", "ExpirationDate", "CancelDate", "InsuranceAgencyName"],
        hub_value=hv(ASK="HIGH", CONTRACTOR="HIGH", INSURANCE="MEDIUM"),
        value_scores=scores("HIGH", "NONE", "HIGH", "HIGH", "HIGH", "HIGH"),
        acquisition_status="ACQUIRED_LOCAL_GITIGNORED",
        acquired_rows=77005,
        sha256=FILES["insurance"]["sha256"],
        bytes=FILES["insurance"]["bytes"],
    ),
    src(
        source_id="wa-lni-three-layer-join",
        hub_home="CONTRACTOR",
        source_family="derived_join",
        source_name="Exact GENERAL→BOND→INSURANCE join on ContractorLicenseNumber",
        regulator="Washington State Department of Labor & Industries",
        source_url="https://data.wa.gov/Labor/L-I-Contractor-License-Data-General/m8qx-ubtq",
        access_class="DERIVED_FROM_OFFICIAL_BULK",
        contact_rank="OFFICIAL_REGULATOR",
        identity_bar="EXACT",
        identity_field="ContractorLicenseNumber",
        grain="contractor_registration",
        record_count=JOIN["general_unique"],
        count_notes=(
            f"general∩bond {JOIN['general_with_any_bond_row']}; general∩insurance {JOIN['general_with_any_insurance_row']}; "
            f"all three {JOIN['general_with_bond_and_insurance_row']}. "
            f"ACTIVE with current bond evidence {JOIN['active_with_current_bond_evidence']}; "
            f"ACTIVE with current insurance evidence {JOIN['active_with_current_insurance_evidence']}; "
            f"ACTIVE with both current-evidence flags {JOIN['active_with_current_bond_and_insurance']}. "
            f"ACTIVE without current bond evidence {JOIN['active_without_current_bond_evidence']}; "
            f"ACTIVE without current insurance evidence {JOIN['active_without_current_insurance_evidence']}. "
            "Do not hide orphans (none vs general). Do not mint insured-forever or recommended-contractor labels. "
            "Current-evidence flags are date/cancel heuristics, not a quality or safety claim."
        ),
        identifier_fields=["ContractorLicenseNumber"],
        contact_fields=contact(phone=160850, email=0, web=0, phys=160923, mail=160923),
        hub_value=hv(ASK="HIGH", CONTRACTOR="HIGH", INSURANCE="MEDIUM"),
        value_scores=scores("HIGH", "HIGH", "HIGH", "HIGH", "HIGH", "HIGH"),
        acquisition_status="DERIVED_THIS_TICKET",
        join=JOIN,
    ),
    src(
        source_id="wa-lni-principal",
        hub_home="CONTRACTOR",
        source_family="license_personnel",
        source_name="L&I Contractor License - Principal Data",
        regulator="Washington State Department of Labor & Industries",
        source_url="https://data.wa.gov/Labor/L-I-Contractor-License-Principal-Data/4xk5-x9j6",
        dataset_id="4xk5-x9j6",
        access_class="OPEN_SODA_API",
        contact_rank="OFFICIAL_REGULATOR",
        identity_bar="EXACT",
        identity_field="ContractorLicenseNumber + PrincipalName",
        grain="person_associated_with_a_license",
        record_count=JOIN["principal_rows"],
        publication="people_suppressed",
        count_notes="250,349 principal rows counted via SODA. Person grain. Do not publish people this ticket. Not a business profile.",
        contact_fields=contact(phone=0, email=0, web=0, phys=0, mail=0),
        hub_value=hv(ASK="MEDIUM", CONTRACTOR="MEDIUM"),
        value_scores=scores("HIGH", "NONE", "MEDIUM", "LOW", "HIGH", "HIGH"),
        acquisition_status="COUNTED_NOT_DUMPED",
    ),
    src(
        source_id="wa-lni-authorized-signer",
        hub_home="CONTRACTOR",
        source_family="license_personnel",
        source_name="L&I Contractor Authorized Signer Data",
        regulator="Washington State Department of Labor & Industries",
        source_url="https://data.wa.gov/Labor/L-I-Contractor-Authorized-Signer-Data/s7ge-wicw",
        dataset_id="s7ge-wicw",
        access_class="OPEN_SODA_API",
        contact_rank="OFFICIAL_REGULATOR",
        identity_bar="EXACT",
        grain="person_authorized_signer",
        record_count=JOIN["authorized_signer_rows"],
        publication="people_suppressed",
        count_notes="10,444 rows. Person grain for permits/affidavits. Do not publish people.",
        contact_fields=contact(phone=0, email=0, web=0, phys=0, mail=0),
        hub_value=hv(ASK="LOW", CONTRACTOR="LOW"),
        value_scores=scores("MEDIUM", "NONE", "LOW", "LOW", "HIGH", "HIGH"),
        acquisition_status="COUNTED_NOT_DUMPED",
    ),
    src(
        source_id="wa-lni-verify-search",
        hub_home="CONTRACTOR",
        source_family="license_verify",
        source_name="L&I Verify a Contractor",
        regulator="Washington State Department of Labor & Industries",
        source_url="https://secure.lni.wa.gov/verify/",
        access_class="OPEN_SEARCH_ONLY",
        contact_rank="OFFICIAL_REGULATOR",
        identity_bar="EXACT",
        grain="contractor_registration",
        record_count="UNKNOWN",
        count_notes="Current-status verify tool. Do not scrape. Prefer the open-data CSVs for bulk.",
        contact_fields=contact(phone=True, email=0, web=0, phys=True, mail=True),
        hub_value=hv(ASK="HIGH", CONTRACTOR="HIGH"),
        value_scores=scores("HIGH", "MEDIUM", "HIGH", "MEDIUM", "LOW", "HIGH"),
        acquisition_status="BLOCKED_SEARCH_ONLY",
        blocker="Search form. Do not scrape.",
    ),
    src(
        source_id="wa-lni-debarment",
        hub_home="CONTRACTOR",
        source_family="enforcement",
        source_name="L&I Debarred Contractors List",
        regulator="Washington State Department of Labor & Industries",
        source_url="https://secure.lni.wa.gov/debarandstrike/ContractorDebarList.aspx",
        index_url="https://lni.wa.gov/licensing-permits/public-works-projects/strike-and-debar/contractors-not-allowed-to-bid",
        access_class="OPEN_BULK_DOWNLOAD",
        contact_rank="OFFICIAL_REGULATOR",
        identity_bar="EXACT",
        identity_field="L&I license number and/or UBI when present on the debar row",
        grain="public_works_debarment_row",
        record_count=745,
        count_notes=(
            "Official page 2026-09-04: Showing 1 to 25 of 745 records, with a 'Download all debarment data' control. "
            "This ticket did not download the export. Debarment is public-works bid ineligibility, not a consumer quality score. "
            "VENDOR/public-works debar != contractor registration status by itself. Name-only attach is UNSAFE. Principals on the list are people."
        ),
        identifier_fields=["License", "UBI"],
        contact_fields=contact(phone=0, email=0, web=0, phys=0, mail=0),
        hub_value=hv(ASK="HIGH", CONTRACTOR="HIGH"),
        value_scores=scores("HIGH", "NONE", "HIGH", "MEDIUM", "HIGH", "HIGH"),
        acquisition_status="PORTAL_LIVE_NOT_DOWNLOADED_THIS_TICKET",
        recommended_next_action="Download the official debar CSV on WA-CON-001. Join only on exact license number. Suppress principal names in public fixtures.",
    ),
    src(
        source_id="wa-lni-strikes",
        hub_home="CONTRACTOR",
        source_family="enforcement",
        source_name="L&I Contractor Strike List",
        regulator="Washington State Department of Labor & Industries",
        source_url="https://secure.lni.wa.gov/debarandstrike/ContractorStrikeList.aspx",
        access_class="OPEN_BULK_DOWNLOAD",
        contact_rank="OFFICIAL_REGULATOR",
        identity_bar="EXACT",
        grain="public_works_strike_row",
        record_count=18969,
        count_notes="Official page: Showing 1 to 25 of 18,969 records, with 'Download all strike data'. Strike != debarment. Not downloaded this ticket. Person principals on the list.",
        contact_fields=contact(phone=0, email=0, web=0, phys=0, mail=0),
        hub_value=hv(ASK="MEDIUM", CONTRACTOR="HIGH"),
        value_scores=scores("HIGH", "NONE", "HIGH", "MEDIUM", "HIGH", "HIGH"),
        acquisition_status="PORTAL_LIVE_NOT_DOWNLOADED_THIS_TICKET",
    ),
    src(
        source_id="wa-lni-public-works-project-details",
        hub_home="CONTRACTOR",
        source_family="project_letting",
        source_name="L&I Public Works Project Details",
        regulator="Washington State Department of Labor & Industries",
        source_url="https://data.wa.gov/Labor/L-I-Public-Works-Project-Details/qp8s-a5uf",
        dataset_id="qp8s-a5uf",
        access_class="OPEN_SODA_API",
        contact_rank="OFFICIAL_PROGRAM",
        identity_bar="REVIEW_REQUIRED",
        identity_field="Prime Contractor UBI — not by itself a contractor license",
        grain="public_works_project",
        record_count=JOIN["pw_project_rows"],
        count_notes="347,082 project rows. Prime Contractor UBI is present. VENDOR/public-works prime != contractor license. Join to L&I license is EXACT on UBI only as a candidate, then confirm license number. Giant file not dumped this ticket.",
        identifier_fields=["Project ID", "Prime Contractor UBI"],
        contact_fields=contact(phone=0, email=0, web=0, phys=0, mail=0),
        hub_value=hv(ASK="MEDIUM", CONTRACTOR="HIGH"),
        value_scores=scores("MEDIUM", "NONE", "LOW", "HIGH", "HIGH", "HIGH"),
        acquisition_status="COUNTED_NOT_DUMPED",
    ),
    src(
        source_id="wa-lni-affidavit-project-details",
        hub_home="CONTRACTOR",
        source_family="project_letting",
        source_name="L&I Affidavit Project Details",
        regulator="Washington State Department of Labor & Industries",
        source_url="https://data.wa.gov/Labor/L-I-Affidavit-Project-Details/9ncw-tqjn",
        dataset_id="9ncw-tqjn",
        access_class="OPEN_SODA_API",
        contact_rank="OFFICIAL_PROGRAM",
        identity_bar="EXACT",
        identity_field="primelicense (L&I contractor license) when present",
        grain="affidavit_of_wages_paid",
        record_count=JOIN["affidavit_rows"],
        count_notes="1,192,380 rows. Schema includes Contractor License and UBI. Giant file — not ingested this ticket. Public-works activity != quality.",
        contact_fields=contact(phone=True, email=0, web=0, phys=0, mail=0),
        hub_value=hv(ASK="MEDIUM", CONTRACTOR="HIGH"),
        value_scores=scores("HIGH", "LOW", "LOW", "HIGH", "MEDIUM", "HIGH"),
        acquisition_status="COUNTED_NOT_DUMPED_GIANT_FILE",
    ),
    src(
        source_id="wa-utc-household-goods-directory",
        hub_home="MOVE",
        source_family="permit_roster",
        source_name="UTC Companies directory — Household Goods Carriers",
        regulator="Washington Utilities and Transportation Commission",
        source_url="https://www.utc.wa.gov/companies",
        index_url="https://www.utc.wa.gov/MovingCompanies",
        access_class="OPEN_HTML_TABLE_BOUNDED",
        contact_rank="OFFICIAL_REGULATOR",
        identity_bar="EXACT",
        identity_field="WA-UTC:{UTC_ID}",
        grain="household_goods_carrier",
        record_count=285,
        count_notes=(
            "Official companies directory, Household Goods Carriers + Active, displayed '1 - 50 of 285' on 2026-09-04. "
            "No CSV/JSON bulk export found (companies/csv  and _format=json did not yield a roster file). "
            "This ticket did not scrape the paginated table. 285 is the public directory total, not a harvested file. "
            "UTC ID != UBI != USDOT != permit number. STATE AUTHORITY != FMCSA interstate authority. USDOT != interstate authority by itself."
        ),
        identifier_fields=["UTC ID", "UBI", "USDOT"],
        contact_fields=contact(phone=None, email=0, web=0, phys=None, mail=None),
        hub_value=hv(ASK="HIGH", MOVE="HIGH", CONTRACTOR="NONE"),
        value_scores=scores("HIGH", "UNKNOWN", "HIGH", "HIGH", "MEDIUM", "MEDIUM"),
        acquisition_status="DOCUMENTED_NOT_SCRAPED",
        blocker="No bulk CSV/API. Bounded HTML table exists; do not brute-force IDs or scrape unrelated industries.",
        recommended_next_action="WA-MOVE-001 may harvest the official 285-row Active HHG table only if a deterministic bounded export is confirmed. Do not scrape search.",
    ),
    src(
        source_id="wa-utc-dockets-orders",
        hub_home="MOVE",
        source_family="enforcement",
        source_name="UTC Recent Orders / dockets",
        regulator="Washington Utilities and Transportation Commission",
        source_url="https://www.utc.wa.gov/documents-and-proceedings/dockets-recent-orders",
        access_class="OPEN_HTML_TABLE",
        contact_rank="OFFICIAL_REGULATOR",
        identity_bar="REVIEW_REQUIRED",
        grain="docket_order",
        record_count="UNKNOWN",
        count_notes="HTML docket list with PDF orders. Household-goods permit letters appear in the feed. No bulk machine roster. Do not scrape unbounded dockets this ticket. Complaint != violation. Accusation != finding.",
        contact_fields=contact(phone=0, email=0, web=0, phys=0, mail=0),
        hub_value=hv(ASK="MEDIUM", MOVE="HIGH"),
        value_scores=scores("MEDIUM", "NONE", "HIGH", "MEDIUM", "LOW", "MEDIUM"),
        acquisition_status="DOCUMENTED_NOT_SCRAPED",
    ),
    src(
        source_id="wa-oic-agent-company-lookup",
        hub_home="INSURANCE",
        source_family="license_verify",
        source_name="OIC Agent and Company Lookup Tool",
        regulator="Washington Office of the Insurance Commissioner",
        source_url="https://www.insurance.wa.gov/agent-and-company-lookup-tool",
        access_class="OPEN_SEARCH_ONLY",
        contact_rank="OFFICIAL_REGULATOR",
        identity_bar="EXACT",
        identity_field="WAOIC / NPN / NAIC when returned by the lookup",
        grain="mixed_person_and_company",
        record_count="UNKNOWN",
        count_notes="Consumer lookup for agents, agencies, and companies. Do not scrape. OIC PRODUCER != AGENCY. No bulk producer ingest from this tool.",
        contact_fields=contact(phone=True, email=0, web=0, phys=True, mail=True),
        hub_value=hv(ASK="MEDIUM", INSURANCE="HIGH"),
        value_scores=scores("HIGH", "MEDIUM", "HIGH", "MEDIUM", "LOW", "HIGH"),
        acquisition_status="BLOCKED_SEARCH_ONLY",
        use_class="SEARCH_ONLY",
    ),
    src(
        source_id="wa-oic-lists-of-individuals",
        hub_home="INSURANCE",
        source_family="license_roster",
        source_name="OIC request for list of individuals (RCW 42.56 commercial-use bar)",
        regulator="Washington Office of the Insurance Commissioner",
        source_url="https://www.insurance.wa.gov/about-us/request-public-records/request-list-individuals",
        access_class="SOURCE_USE_RESTRICTED",
        contact_rank="OFFICIAL_REGULATOR",
        identity_bar="UNSAFE",
        grain="list_of_individuals",
        record_count="UNKNOWN",
        count_notes=(
            "RCW 42.56 prohibits providing lists of individuals requested for commercial purposes. "
            "OIC requires a commercial-use declaration. Do not bulk-ingest individual producers from lookup or PRA lists. "
            "Classify PUBLIC_BULK_OK / SEARCH_ONLY / SOURCE_USE_RESTRICTED. This source is SOURCE_USE_RESTRICTED for producer lists."
        ),
        contact_fields=contact(phone=0, email=0, web=0, phys=0, mail=0),
        hub_value=hv(ASK="LOW", INSURANCE="LOW"),
        value_scores=scores("NONE", "NONE", "HIGH", "NONE", "NONE", "NONE"),
        acquisition_status="BLOCKED_COMMERCIAL_USE_RESTRICTION",
        use_class="SOURCE_USE_RESTRICTED",
        blocker="Lists of individuals for commercial purposes are prohibited. Do not acquire a producer mailing list.",
    ),
    src(
        source_id="wa-oic-orders-search",
        hub_home="INSURANCE",
        source_family="enforcement",
        source_name="OIC Orders search (disciplinary / general orders since 2010)",
        regulator="Washington Office of the Insurance Commissioner",
        source_url="https://fortress.wa.gov/oic/consumertoolkit/HomePage.aspx",
        access_class="OPEN_SEARCH_ONLY",
        contact_rank="OFFICIAL_REGULATOR",
        identity_bar="EXACT",
        grain="enforcement_order",
        record_count="UNKNOWN",
        count_notes="Orders search is a lookup. Do not scrape. Attach only on exact WAOIC/NPN/NAIC. Name-only UNSAFE. Complaint != violation.",
        contact_fields=contact(phone=0, email=0, web=0, phys=0, mail=0),
        hub_value=hv(ASK="MEDIUM", INSURANCE="HIGH"),
        value_scores=scores("HIGH", "NONE", "HIGH", "MEDIUM", "LOW", "MEDIUM"),
        acquisition_status="BLOCKED_SEARCH_ONLY",
        use_class="SEARCH_ONLY",
    ),
    src(
        source_id="wa-oic-serff-rate-form",
        hub_home="INSURANCE",
        source_family="rate_filing",
        source_name="SERFF Filing Access (OIC rate/rule/form)",
        regulator="Washington Office of the Insurance Commissioner / NAIC SERFF",
        source_url="https://www.insurance.wa.gov/insurers-regulated-entities/rate-and-form-filing/search-company-filings-serff-filing-access",
        access_class="OPEN_SEARCH_ONLY",
        contact_rank="OFFICIAL_REGULATOR",
        identity_bar="EXACT",
        identity_field="NAIC company code on a filing",
        grain="rate_rule_form_filing",
        record_count="UNKNOWN",
        count_notes="Search tool. Not a company roster. Do not scrape SERFF.",
        contact_fields=contact(phone=0, email=0, web=0, phys=0, mail=0),
        hub_value=hv(ASK="MEDIUM", INSURANCE="HIGH"),
        value_scores=scores("MEDIUM", "NONE", "HIGH", "HIGH", "LOW", "MEDIUM"),
        acquisition_status="BLOCKED_SEARCH_ONLY",
        use_class="SEARCH_ONLY",
    ),
    src(
        source_id="wa-oic-annual-report-company-aggregates",
        hub_home="INSURANCE",
        source_family="market_aggregate",
        source_name="OIC 2025 annual report — regulated entity counts",
        regulator="Washington Office of the Insurance Commissioner",
        source_url="https://www.insurance.wa.gov/sites/default/files/2026-07/oic-annual-report-2025.pdf",
        access_class="OFFICIAL_AGGREGATE_NOT_ROSTER",
        contact_rank="OFFICIAL_REGULATOR",
        identity_bar="UNSAFE",
        grain="agency_aggregate",
        record_count=2924,
        count_notes="2025 annual report: 2,924 insurance and risk/non-risk bearing entities (263 domestic / 2,590 foreign / 71 alien). This is an aggregate, not a downloadable company roster. Do not treat 2,924 as a live company denominator.",
        contact_fields=contact(phone=0, email=0, web=0, phys=0, mail=0),
        hub_value=hv(ASK="MEDIUM", INSURANCE="MEDIUM"),
        value_scores=scores("LOW", "NONE", "MEDIUM", "HIGH", "HIGH", "LOW"),
        acquisition_status="AGGREGATE_ONLY",
        use_class="PUBLIC_BULK_OK",
    ),
    src(
        source_id="wa-dshs-gis-residential-care",
        hub_home="SENIOR",
        source_family="facility_roster",
        source_name="DSHS Long Term Care — Residential Care (ArcGIS / Geospatial Data Library)",
        regulator="Washington State Department of Social and Health Services — Residential Care Services",
        source_url="https://www.arcgis.com/home/item.html?id=12cacca85238434b9bf54f8e47ece35f",
        rest_url="https://services2.arcgis.com/WW3T8U6q5EkZ9U3n/arcgis/rest/services/Long_Term_Care_Residential_Care_view/FeatureServer/1",
        access_class="OPEN_GIS_FEATURE_SERVICE",
        contact_rank="OFFICIAL_REGULATOR",
        identity_bar="EXACT",
        identity_field="DSHS LicenseNumber / FacInstanceId",
        source_clock="ArcGIS dataLastEditDate unix 1788498054883 (~2026-09-04); nightly HCLA extract",
        grain="licensed_residential_care_location",
        record_count=JOIN["residential_current"],
        count_notes=(
            "Current (GDLArchiveDate IS NULL) 6,968: AF Adult Family Home 6,179; BH Assisted Living Facility 557; "
            "EF Enhanced Services Facility 16; SL Certified Residential Service and Supports 187; GT Group Training 29. "
            "All records including archive 134,442. Same data as RCS locators plus coordinates. "
            "DSHS != CMS. LicenseNumber is a state facility ID, not a CMS CCN. "
            "AFH/ALF bulk result is this GIS layer — locator CSV-after-search was not scraped."
        ),
        identifier_fields=["LicenseNumber", "FacInstanceId", "FacilityType"],
        contact_fields=contact(phone=True, email=0, web=0, phys=True, mail=True),
        other_fields=["FacilityName", "FacilityStatus", "LicensedBedCount", "LocationCounty"],
        hub_value=hv(ASK="HIGH", SENIOR="HIGH"),
        value_scores=scores("HIGH", "HIGH", "HIGH", "HIGH", "HIGH", "HIGH"),
        acquisition_status="COUNTED_VIA_OFFICIAL_GIS_QUERY",
        recommended_next_action="WA-SEN-001 stream current AF/BH/EF rows. Do not scrape fortress locators.",
    ),
    src(
        source_id="wa-dshs-afh-locator",
        hub_home="SENIOR",
        source_family="facility_verify",
        source_name="DSHS Adult Family Home Locator (professionals & providers)",
        regulator="Washington State Department of Social and Health Services",
        source_url="https://fortress.wa.gov/dshs/adsaapps/lookup/AFHAdvLookup.aspx",
        access_class="OPEN_SEARCH_ONLY",
        contact_rank="OFFICIAL_REGULATOR",
        identity_bar="EXACT",
        identity_field="DSHS AFH license number",
        grain="adult_family_home",
        record_count="UNKNOWN",
        count_notes="Locator can download search results as Excel/CSV after a search. That is still a search tool. Do not scrape. Prefer the GIS current layer (6,179 AF).",
        contact_fields=contact(phone=True, email=0, web=0, phys=True, mail=True),
        hub_value=hv(ASK="HIGH", SENIOR="HIGH"),
        value_scores=scores("HIGH", "HIGH", "HIGH", "HIGH", "LOW", "HIGH"),
        acquisition_status="BLOCKED_SEARCH_ONLY",
        blocker="Do not scrape the locator. GIS bulk exists.",
    ),
    src(
        source_id="wa-dshs-alf-locator",
        hub_home="SENIOR",
        source_family="facility_verify",
        source_name="DSHS Assisted Living Facility Locator",
        regulator="Washington State Department of Social and Health Services",
        source_url="https://fortress.wa.gov/dshs/adsaapps/lookup/BHPubLookup.aspx",
        access_class="OPEN_SEARCH_ONLY",
        contact_rank="OFFICIAL_REGULATOR",
        identity_bar="EXACT",
        grain="assisted_living_facility",
        record_count="UNKNOWN",
        count_notes="Locator. GIS current BH count is 557. Do not scrape.",
        contact_fields=contact(phone=True, email=0, web=0, phys=True, mail=True),
        hub_value=hv(ASK="HIGH", SENIOR="HIGH"),
        value_scores=scores("HIGH", "HIGH", "HIGH", "HIGH", "LOW", "HIGH"),
        acquisition_status="BLOCKED_SEARCH_ONLY",
    ),
    src(
        source_id="wa-dshs-nh-locator",
        hub_home="SENIOR",
        source_family="facility_verify",
        source_name="DSHS Nursing Home Locator",
        regulator="Washington State Department of Social and Health Services",
        source_url="https://fortress.wa.gov/dshs/adsaapps/lookup/NHPubLookup.aspx",
        access_class="OPEN_SEARCH_ONLY",
        contact_rank="OFFICIAL_REGULATOR",
        identity_bar="EXACT",
        grain="nursing_home",
        record_count="UNKNOWN",
        count_notes="Locator live. Separate GIS nursing-home layer exists; live current count UNKNOWN this ticket. DSHS != CMS.",
        contact_fields=contact(phone=True, email=0, web=0, phys=True, mail=True),
        hub_value=hv(ASK="HIGH", SENIOR="HIGH"),
        value_scores=scores("HIGH", "MEDIUM", "HIGH", "HIGH", "LOW", "HIGH"),
        acquisition_status="BLOCKED_SEARCH_ONLY",
    ),
    src(
        source_id="wa-cms-federal-overlay",
        hub_home="SENIOR",
        source_family="federal_overlay",
        source_name="CMS nursing home / home health / hospice overlay (plan)",
        regulator="Centers for Medicare & Medicaid Services",
        source_url="https://data.cms.gov/",
        access_class="FEDERAL_OVERLAY_PLAN",
        contact_rank="FEDERAL_OVERLAY",
        identity_bar="EXACT",
        identity_field="CMS CCN — only with an official CCN↔DSHS crosswalk",
        grain="medicare_enrolled_provider",
        record_count="UNKNOWN",
        count_notes="Do not duplicate federal raw in Ask this ticket. Ownership overlay only. CCN↔state ID only if official crosswalk. DSHS != CMS. Missing overlay != zero facilities.",
        contact_fields=contact(phone=None, email=0, web=0, phys=None, mail=None),
        hub_value=hv(ASK="HIGH", SENIOR="HIGH"),
        value_scores=scores("HIGH", "MEDIUM", "HIGH", "HIGH", "HIGH", "HIGH"),
        acquisition_status="PLANNED_NOT_ACQUIRED",
    ),
    src(
        source_id="wa-dfi-verify-license",
        hub_home="LENDER",
        source_family="license_verify",
        source_name="DFI Verify a Financial License",
        regulator="Washington Department of Financial Institutions",
        source_url="https://dfi.wa.gov/consumers/verify-license",
        access_class="OPEN_SEARCH_ONLY",
        contact_rank="OFFICIAL_REGULATOR",
        identity_bar="EXACT",
        identity_field="NMLS ID or DFI licensee identifier when the verify path returns one",
        grain="mixed_person_and_company",
        record_count="UNKNOWN",
        count_notes=(
            "Mortgage lenders/brokers/MLOs/consumer-loan companies verify through NMLS Consumer Access. "
            "Escrow, securities filings, franchises through DFI Licensee Database. "
            "Do not scrape either search. No bulk company roster acquired. "
            "Do NOT invent a live company denominator. Dec 31 2025 DFI stats (aggregates, not a roster): "
            "Mortgage Brokers 354; Consumer Loan Companies 1,104; MLOs active 20,126 (people — suppress)."
        ),
        contact_fields=contact(phone=None, email=0, web=0, phys=None, mail=None),
        hub_value=hv(ASK="MEDIUM", LENDER="HIGH", INVESTOR="MEDIUM"),
        value_scores=scores("HIGH", "UNKNOWN", "HIGH", "MEDIUM", "LOW", "HIGH"),
        acquisition_status="BLOCKED_SEARCH_ONLY",
        blocker="No bulk DFI lender roster. NMLS Consumer Access must not be scraped.",
    ),
    src(
        source_id="wa-nmls-consumer-access",
        hub_home="LENDER",
        source_family="license_verify",
        source_name="NMLS Consumer Access",
        regulator="NMLS / CSBS (used by DFI)",
        source_url="https://www.nmlsconsumeraccess.org/",
        access_class="OPEN_SEARCH_ONLY",
        contact_rank="OFFICIAL_REGULATOR",
        identity_bar="EXACT",
        identity_field="NMLS ID",
        grain="mixed_person_and_company",
        record_count="UNKNOWN",
        count_notes="SEARCH_ONLY. Do not scrape. NMLS != current Washington authority by itself without the WA license record.",
        contact_fields=contact(phone=None, email=0, web=0, phys=None, mail=None),
        hub_value=hv(ASK="MEDIUM", LENDER="HIGH"),
        value_scores=scores("HIGH", "UNKNOWN", "HIGH", "MEDIUM", "LOW", "HIGH"),
        acquisition_status="BLOCKED_SEARCH_ONLY",
    ),
    src(
        source_id="wa-dfi-consumer-services-enforcement",
        hub_home="LENDER",
        source_family="enforcement",
        source_name="DFI Division of Consumer Services Enforcement Actions",
        regulator="Washington Department of Financial Institutions",
        source_url="https://dfi.wa.gov/enforcement-actions",
        access_class="OPEN_HTML_TABLE",
        contact_rank="OFFICIAL_REGULATOR",
        identity_bar="EXACT",
        identity_field="NMLS ID when present on the order row",
        grain="enforcement_order",
        record_count="UNKNOWN",
        count_notes="HTML table of recent orders, often with NMLS IDs. Bounded page, not a full historical bulk file. Name-only UNSAFE. 2025 year aggregate: 91 enforcement actions issued — not a roster.",
        contact_fields=contact(phone=0, email=0, web=0, phys=0, mail=0),
        hub_value=hv(ASK="MEDIUM", LENDER="HIGH"),
        value_scores=scores("HIGH", "NONE", "HIGH", "MEDIUM", "MEDIUM", "MEDIUM"),
        acquisition_status="DOCUMENTED_BOUNDED_HTML",
    ),
    src(
        source_id="wa-hmda-cfpb-overlay",
        hub_home="LENDER",
        source_family="market_intelligence",
        source_name="HMDA (CFPB) Washington state/county market overlay — plan",
        regulator="CFPB / FFIEC",
        source_url="https://ffiec.cfpb.gov/",
        access_class="FEDERAL_OVERLAY_PLAN",
        contact_rank="FEDERAL_OVERLAY",
        identity_bar="REVIEW_REQUIRED",
        grain="lar_loan_application",
        record_count="UNKNOWN",
        count_notes="HMDA != license roster. Canonical state/county market intelligence for a later lender page. Do not use HMDA as a DFI licensee denominator. County work is out of scope this ticket.",
        contact_fields=contact(phone=0, email=0, web=0, phys=0, mail=0),
        hub_value=hv(ASK="MEDIUM", LENDER="HIGH"),
        value_scores=scores("LOW", "NONE", "LOW", "HIGH", "HIGH", "HIGH"),
        acquisition_status="PLANNED_NOT_ACQUIRED",
    ),
    src(
        source_id="wa-dfi-securities-enforcement",
        hub_home="INVESTOR",
        source_family="enforcement",
        source_name="DFI Division of Securities Enforcement Actions",
        regulator="Washington Department of Financial Institutions — Division of Securities",
        source_url="https://dfi.wa.gov/securities-enforcement-actions",
        access_class="OPEN_HTML_TABLE",
        contact_rank="OFFICIAL_REGULATOR",
        identity_bar="REVIEW_REQUIRED",
        grain="securities_order",
        record_count="UNKNOWN",
        count_notes="HTML table of orders (final/consent/charges). 2024 year-in-review: 92 enforcement actions — aggregate. Bounded HTML, not a bulk machine file. Name-only UNSAFE. CRD != current WA authority.",
        contact_fields=contact(phone=0, email=0, web=0, phys=0, mail=0),
        hub_value=hv(ASK="MEDIUM", INVESTOR="HIGH"),
        value_scores=scores("MEDIUM", "NONE", "HIGH", "MEDIUM", "MEDIUM", "MEDIUM"),
        acquisition_status="DOCUMENTED_BOUNDED_HTML",
    ),
    src(
        source_id="wa-dfi-securities-licensee-database",
        hub_home="INVESTOR",
        source_family="license_verify",
        source_name="DFI Licensee Database (securities / IA / BD / issuers / franchises)",
        regulator="Washington Department of Financial Institutions",
        source_url="https://dfi.wa.gov/consumers/verify-license",
        access_class="OPEN_SEARCH_ONLY",
        contact_rank="OFFICIAL_REGULATOR",
        identity_bar="EXACT",
        identity_field="CRD / DFI file number when returned",
        grain="mixed_person_and_firm",
        record_count="UNKNOWN",
        count_notes=(
            "Search only. Do not scrape. 2024 year-in-review aggregates (not a roster): Broker-dealers 1,697; "
            "Investment advisers 645; IARs 14,753 (people); securities salespersons 227,450 (people). "
            "WA principal office != Washington state registration. CRD != current Washington authority by itself. "
            "State verification may use DFI Licensee Database / IAPD / BrokerCheck — do not scrape those search tools."
        ),
        contact_fields=contact(phone=None, email=0, web=0, phys=None, mail=None),
        hub_value=hv(ASK="MEDIUM", INVESTOR="HIGH"),
        value_scores=scores("HIGH", "UNKNOWN", "HIGH", "MEDIUM", "LOW", "HIGH"),
        acquisition_status="BLOCKED_SEARCH_ONLY",
        blocker="No bulk state-RIA/BD roster. Do not scrape DFI/IAPD/BrokerCheck search.",
    ),
    src(
        source_id="wa-sec-iard-principal-office-overlay",
        hub_home="INVESTOR",
        source_family="federal_overlay",
        source_name="SEC/IARD Washington principal-office overlay — plan",
        regulator="U.S. Securities and Exchange Commission / FINRA IARD",
        source_url="https://www.adviserinfo.sec.gov/",
        access_class="FEDERAL_OVERLAY_PLAN",
        contact_rank="FEDERAL_OVERLAY",
        identity_bar="EXACT",
        identity_field="CRD",
        grain="investment_adviser_firm",
        record_count="UNKNOWN",
        count_notes="Plan: SEC/IARD WA principal-office overlay + state verification + bounded DFI enforcement/orders + issuer/securities filing framework. WA principal office != state IA registration. Do not scrape IAPD/BrokerCheck.",
        contact_fields=contact(phone=None, email=0, web=True, phys=True, mail=None),
        hub_value=hv(ASK="MEDIUM", INVESTOR="HIGH"),
        value_scores=scores("HIGH", "MEDIUM", "MEDIUM", "HIGH", "MEDIUM", "HIGH"),
        acquisition_status="PLANNED_NOT_ACQUIRED",
    ),
    src(
        source_id="wa-sos-ccfs",
        hub_home="CONTRACTOR",
        source_family="business_identity",
        source_name="Secretary of State Corporations & Charities Filing System (CCFS)",
        regulator="Washington Secretary of State",
        source_url="https://ccfs.sos.wa.gov/",
        access_class="OPEN_SEARCH_ONLY",
        contact_rank="OFFICIAL_STATE_BUSINESS",
        identity_bar="EXACT",
        identity_field="UBI",
        grain="business_entity",
        record_count="UNKNOWN",
        count_notes=(
            "Corporations Data Extract on data.wa.gov (f9jk-mm39) is retired (page updated 2024-08-30). "
            "Advanced CCFS search can export a parameter-limited Excel list. That is not a full-registry bulk dump. "
            "RCW 42.56.070(9) bars lists of individuals for commercial purposes. "
            "UBI != professional license. Do not scrape CCFS."
        ),
        contact_fields=contact(phone=0, email=0, web=0, phys=True, mail=True),
        hub_value=hv(ASK="HIGH", CONTRACTOR="MEDIUM", LENDER="LOW", INSURANCE="LOW", SENIOR="LOW", MOVE="LOW", INVESTOR="MEDIUM"),
        value_scores=scores("HIGH", "LOW", "LOW", "MEDIUM", "LOW", "MEDIUM"),
        acquisition_status="BLOCKED_SEARCH_ONLY",
        blocker="Full corporations extract no longer published. Lookup/advanced-search only.",
    ),
    src(
        source_id="wa-dor-business-lookup",
        hub_home="CONTRACTOR",
        source_family="business_identity",
        source_name="Department of Revenue business lookup",
        regulator="Washington Department of Revenue",
        source_url="https://secure.dor.wa.gov/gteunauth/_/",
        access_class="OPEN_SEARCH_ONLY",
        contact_rank="OFFICIAL_STATE_BUSINESS",
        identity_bar="EXACT",
        identity_field="UBI",
        grain="tax_registration",
        record_count="UNKNOWN",
        count_notes="Lookup by name/UBI/address. No free bulk DOR roster found this ticket. UBI != professional license.",
        contact_fields=contact(phone=None, email=0, web=0, phys=True, mail=None),
        hub_value=hv(ASK="MEDIUM", CONTRACTOR="LOW", LENDER="LOW", INSURANCE="LOW", SENIOR="LOW", MOVE="LOW", INVESTOR="LOW"),
        value_scores=scores("HIGH", "LOW", "LOW", "LOW", "LOW", "MEDIUM"),
        acquisition_status="BLOCKED_SEARCH_ONLY",
    ),
    src(
        source_id="wa-local-and-county-skipped",
        hub_home="CONTRACTOR",
        source_family="coverage_gap",
        source_name="Washington local/municipal/county sources — skipped",
        regulator="none — scope statement",
        source_url="https://data.wa.gov/",
        access_class="NOT_IN_SCOPE",
        contact_rank="OFFICIAL_PROGRAM",
        identity_bar="UNSAFE",
        grain="coverage_statement",
        record_count=0,
        count_notes="STATE FIRST. No Seattle, King County, Tacoma, Pierce County, Spokane, Snohomish, Bellevue, or municipal permits. Catalog hits for City of Asotin / City of Clarkston building permits were not acquired. Local backlog may be documented only after this state source analysis.",
        contact_fields=contact(phone=0, email=0, web=0, phys=0, mail=0),
        hub_value=hv(ASK="LOW", CONTRACTOR="LOW"),
        value_scores=scores("NONE", "NONE", "NONE", "NONE", "NONE", "NONE"),
        acquisition_status="DELIBERATELY_SKIPPED",
    ),
]


def lni_fixture_rows() -> list[dict]:
    path = RAW / "lni_contractor_general.csv"
    if not path.exists():
        return [
            {
                "BusinessName": "!ECO STAR C G CONSTRUCTION LLC",
                "ContractorLicenseNumber": "ECOSTSC758NN",
                "ContractorLicenseTypeCodeDesc": "CONSTRUCTION CONTRACTOR",
                "City": "VANCOUVER",
                "State": "WA",
                "Zip": "98661",
                "UBI": "605854613",
                "SpecialtyCode1": "01",
                "ContractorLicenseStatus": "ACTIVE",
            }
        ]
    out: list[dict] = []
    wanted = {"ECOSTSC758NN", "JUANHJH803PM", "HANDYL*845B8"}
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            key = (row.get("ContractorLicenseNumber") or "").strip()
            if key not in wanted:
                continue
            out.append(
                {
                    "BusinessName": row.get("BusinessName"),
                    "ContractorLicenseNumber": key,
                    "ContractorLicenseTypeCodeDesc": row.get("ContractorLicenseTypeCodeDesc"),
                    "City": row.get("City"),
                    "State": row.get("State"),
                    "Zip": row.get("Zip"),
                    "PhoneNumber": row.get("PhoneNumber"),
                    "UBI": row.get("UBI"),
                    "SpecialtyCode1": row.get("SpecialtyCode1"),
                    "ContractorLicenseStatus": row.get("ContractorLicenseStatus"),
                }
            )
            if len(out) >= 3:
                break
    return out


def layer_row(kind: str, license_no: str) -> dict | None:
    filename = {"bond": "lni_contractor_bond.csv", "insurance": "lni_contractor_insurance.csv"}[kind]
    path = RAW / filename
    if not path.exists():
        return None
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            if (row.get("ContractorLicenseNumber") or "").strip() == license_no:
                if kind == "bond":
                    return {
                        "ContractorLicenseNumber": license_no,
                        "BondFirmName": row.get("BondFirmName"),
                        "BondAccountID": row.get("BondAccountID"),
                        "BondAmt": row.get("BondAmt"),
                        "BondImpaired": row.get("BondImpaired") or "",
                    }
                return {
                    "ContractorLicenseNumber": license_no,
                    "InsuranceCompany": row.get("InsuranceCompany"),
                    "InsuranceAmt": row.get("InsuranceAmt"),
                    "InsuranceAgencyName": row.get("InsuranceAgencyName"),
                }
    return None


def main() -> int:
    NET.mkdir(parents=True, exist_ok=True)
    principles = [
        "STATE_LEVEL_ONLY",
        "missing_source_is_not_zero",
        "SEARCH_ONLY_is_not_zero",
        "CONTRACTOR_REGISTRATION_is_not_quality",
        "BOND_is_not_endorsement",
        "INSURANCE_RECORD_is_not_safety",
        "EXPIRED_POLICY_is_not_discipline",
        "UBI_is_not_professional_license",
        "UTC_STATE_AUTHORITY_is_not_FMCSA_interstate_authority",
        "USDOT_is_not_interstate_authority_by_itself",
        "OIC_PRODUCER_is_not_agency",
        "COMPLAINT_is_not_violation",
        "HMDA_is_not_license_roster",
        "WA_PRINCIPAL_OFFICE_is_not_state_IA_registration",
        "CRD_is_not_current_WA_authority_by_itself",
        "DSHS_is_not_CMS",
        "VENDOR_is_not_contractor_license",
        "CURRENT_REGISTRATION_is_not_current_bond_or_insurance_unless_source_proves_it",
        "CreatedBy_WAOIC_ID_is_not_a_producer_roster",
        "no_trust_score",
        "no_paid_ranking",
        "no_unsafe_adverse_attach",
        "person_credential_is_not_business_profile",
    ]
    publication = {
        "public_washington_routes": False,
        "sitemap_changes": False,
        "trust_score": False,
        "paid_ranking": False,
        "people_publication": False,
        "county_work": False,
        "city_work": False,
        "specialist_repo_edits": False,
        "specialist_page_edits": False,
    }
    dump(
        NET / "source-manifest.json",
        {
            "ticket": TICKET,
            "state": "WA",
            "scope": "STATE_LEVEL_ONLY",
            "source_as_of": CHECKED,
            "last_checked": CHECKED,
            "publication": publication,
            "principles": principles,
            "sources": SOURCES,
        },
    )

    by_hub: dict[str, list] = {h: [] for h in ["CONTRACTOR", "MOVE", "INSURANCE", "LENDER", "SENIOR", "INVESTOR"]}
    for s in SOURCES:
        by_hub[s["hub_home"]].append(s["source_id"])
    for hub, ids in by_hub.items():
        sources = [s for s in SOURCES if s["hub_home"] == hub]
        dump(
            NET / hub.lower() / "source-manifest.json",
            {
                "ticket": TICKET,
                "hub": hub.lower(),
                "state": "WA",
                "source_as_of": CHECKED,
                "source_ids": ids,
                "sources": sources,
            },
        )

    dump(
        NET / "identity-source-map.json",
        {
            "ticket": TICKET,
            "bars": {
                "EXACT": "official identifier match (WA-LNI ContractorLicenseNumber, UBI, UTC ID, USDOT, UTC permit, NPN, NAIC, WAOIC, NMLS, CRD, DSHS LicenseNumber/FacInstanceId, CMS CCN)",
                "HIGH_CONFIDENCE": "exact legal name + exact official government business address, or an approved deterministic crosswalk",
                "REVIEW_REQUIRED": "name + city; DBA; person/company ambiguity; public-works prime name to L&I",
                "UNSAFE": "name alone; phone alone; search-engine matching",
            },
            "rules": [
                "Do not collapse unrelated IDs.",
                "UBI != professional license.",
                "WA-LNI != UTC ID != USDOT != NMLS != CRD != DSHS != CMS CCN.",
                "Never auto-attach adverse evidence from unsafe identity.",
                "Preserve unmatched official evidence.",
                "Person NPN/CRD/NMLS/PrincipalName is not a business profile.",
                "WA principal office != state IA registration.",
                "CRD != current Washington authority by itself.",
            ],
            "exact_ids": [
                {"id": "WA-LNI ContractorLicenseNumber", "source_ids": ["wa-lni-contractor-general", "wa-lni-contractor-bond", "wa-lni-contractor-insurance"]},
                {"id": "UBI", "source_ids": ["wa-lni-contractor-general", "wa-sos-ccfs", "wa-dor-business-lookup", "wa-utc-household-goods-directory"]},
                {"id": "UTC ID", "source_ids": ["wa-utc-household-goods-directory"]},
                {"id": "USDOT", "source_ids": ["wa-utc-household-goods-directory"]},
                {"id": "NMLS", "source_ids": ["wa-nmls-consumer-access", "wa-dfi-consumer-services-enforcement"]},
                {"id": "NPN", "source_ids": ["wa-oic-agent-company-lookup"]},
                {"id": "NAIC", "source_ids": ["wa-oic-agent-company-lookup", "wa-oic-serff-rate-form"]},
                {"id": "WAOIC", "source_ids": ["wa-oic-agent-company-lookup"]},
                {"id": "CRD", "source_ids": ["wa-dfi-securities-licensee-database", "wa-sec-iard-principal-office-overlay"]},
                {"id": "DSHS LicenseNumber", "source_ids": ["wa-dshs-gis-residential-care"]},
                {"id": "CMS CCN", "source_ids": ["wa-cms-federal-overlay"]},
            ],
            "do_not_collapse": [
                ["WA-LNI", "UBI"],
                ["UTC ID", "USDOT"],
                ["UTC state authority", "FMCSA interstate authority"],
                ["DSHS LicenseNumber", "CMS CCN"],
                ["WAOIC", "NPN"],
                ["OIC producer", "OIC agency"],
                ["CRD", "Washington IA registration"],
                ["NMLS", "Washington DFI authority"],
            ],
        },
    )

    dump(
        NET / "contact-source-summary.json",
        {
            "ticket": TICKET,
            "rank_order": [
                "OFFICIAL_REGULATOR",
                "OFFICIAL_STATE_BUSINESS",
                "OFFICIAL_PROGRAM",
                "FEDERAL_OVERLAY",
            ],
            "rules": [
                "Do not overwrite stronger contact provenance with a weaker source.",
                "No person-scale publishing decisions in Ask this ticket.",
                "L&I PhoneNumber is official business phone (160,850 / 160,923).",
                "L&I has no email or website columns — missing != unlisted forever.",
                "SOS/DOR addresses do not replace L&I / UTC / DSHS / OIC regulator addresses.",
                "DSHS GIS TelephoneNmbr is facility business phone, not a resident or administrator personal contact.",
                "CreatedBy_WAOIC_ID is not a producer contact list.",
            ],
            "strongest_contact_files": [
                {
                    "source_id": "wa-lni-contractor-general",
                    "phone": 160850,
                    "email": 0,
                    "website": 0,
                    "address": 160923,
                    "n": 160923,
                    "rank": "OFFICIAL_REGULATOR",
                },
                {
                    "source_id": "wa-dshs-gis-residential-care",
                    "phone": True,
                    "email": 0,
                    "website": 0,
                    "address": True,
                    "n": 6968,
                    "rank": "OFFICIAL_REGULATOR",
                },
            ],
            "inventory": [
                {"source_id": s["source_id"], "contact_rank": s["contact_rank"], "fields": s["contact_fields"]}
                for s in SOURCES
            ],
        },
    )

    dump(
        NET / "cross-hub-source-map.json",
        {
            "ticket": TICKET,
            "note": "Statewide sources live once. Do not duplicate per hub. Washington counties and cities are out of scope.",
            "ubi_cross_hub": {
                "key": "UBI",
                "appears_in": ["L&I contractor", "UTC companies directory", "SOS CCFS", "DOR lookup", "public-works prime"],
                "rule": "UBI is a potentially major cross-hub key. UBI != professional license. Do not assume an active UBI means an active L&I/UTC/OIC/DFI/DSHS credential.",
            },
            "sources": [
                {"source_id": "wa-lni-contractor-general", "priority": ["business identity", "contacts", "regulatory"]},
                {"source_id": "wa-lni-contractor-bond", "priority": ["regulatory", "enforcement-adjacent"]},
                {"source_id": "wa-lni-contractor-insurance", "priority": ["regulatory"]},
                {"source_id": "wa-dshs-gis-residential-care", "priority": ["business identity", "contacts", "geography"]},
                {"source_id": "wa-utc-household-goods-directory", "priority": ["business identity"]},
                {"source_id": "wa-sos-ccfs", "priority": ["business identity"], "access": "SEARCH_ONLY"},
                {"source_id": "wa-dor-business-lookup", "priority": ["business identity"], "access": "SEARCH_ONLY"},
                {"source_id": "wa-cms-federal-overlay", "priority": ["federal overlay"], "access": "PLAN"},
                {"source_id": "wa-hmda-cfpb-overlay", "priority": ["market"], "access": "PLAN"},
                {"source_id": "wa-sec-iard-principal-office-overlay", "priority": ["federal overlay"], "access": "PLAN"},
            ],
        },
    )

    matrix_sources = []
    for s in SOURCES:
        matrix_sources.append(
            {
                "source_id": s["source_id"],
                "hub_value": s["hub_value"],
                "scores": s["value_scores"],
                "access_class": s["access_class"],
            }
        )
    dump(
        NET / "six-hub-value-matrix.json",
        {
            "ticket": TICKET,
            "note": "Internal prioritization, not a consumer ranking. No Trust Score. No paid ranking. HIGH/MEDIUM/LOW/NONE only.",
            "hub_early_candidates_evaluated": {
                "CONTRACTOR": "HIGH — statewide L&I registration bulk acquired; three-layer join exact; phones nearly complete",
                "MOVE": "MEDIUM — official 285-row Active HHG directory exists but is HTML-table/search, not a CSV",
                "SENIOR": "HIGH — GIS current AFH 6,179 + ALF 557 is real bulk",
                "INSURANCE": "LOW as an early specialist — OIC producer lists SOURCE_USE_RESTRICTED; company lookup SEARCH_ONLY",
            },
            "sources": matrix_sources,
        },
    )

    dump(
        NET / "acquisition-summary.json",
        {
            "ticket": TICKET,
            "checked": CHECKED,
            "acquired_this_ticket": [
                {
                    "source_id": "wa-lni-contractor-general",
                    "method": "official Socrata CSV",
                    "rows": 160923,
                    "unique_license": 160923,
                    "active": 75823,
                    "phone_nonempty": 160850,
                    "unique_ubi": 149153,
                    "bytes": FILES["general"]["bytes"],
                    "sha256": FILES["general"]["sha256"],
                    "committed": False,
                },
                {
                    "source_id": "wa-lni-contractor-bond",
                    "method": "official Socrata CSV",
                    "rows": 176920,
                    "unique_license": 82635,
                    "bytes": FILES["bond"]["bytes"],
                    "sha256": FILES["bond"]["sha256"],
                    "committed": False,
                },
                {
                    "source_id": "wa-lni-contractor-insurance",
                    "method": "official Socrata CSV",
                    "rows": 77005,
                    "unique_license": 70953,
                    "bytes": FILES["insurance"]["bytes"],
                    "sha256": FILES["insurance"]["sha256"],
                    "committed": False,
                },
            ],
            "counted_not_dumped": [
                {"source_id": "wa-lni-principal", "rows": 250349, "publication": "people_suppressed"},
                {"source_id": "wa-lni-authorized-signer", "rows": 10444, "publication": "people_suppressed"},
                {"source_id": "wa-lni-public-works-project-details", "rows": 347082},
                {"source_id": "wa-lni-affidavit-project-details", "rows": 1192380},
                {"source_id": "wa-dshs-gis-residential-care", "current_rows": 6968, "afh": 6179, "alf": 557, "esf": 16},
                {"source_id": "wa-utc-household-goods-directory", "active_hhg_page_total": 285, "note": "not scraped"},
            ],
            "join": JOIN,
            "giant_files_not_ingested": [
                {"source_id": "wa-lni-affidavit-project-details", "rows": 1192380, "reason": "giant public-works file"},
                {"source_id": "wa-lni-intent-project", "rows": 1314773, "reason": "giant public-works file"},
            ],
            "not_acquired": [
                "OIC individual producer lists (SOURCE_USE_RESTRICTED)",
                "OIC company bulk roster (search only; 2,924 is an annual-report aggregate)",
                "NMLS Consumer Access bulk",
                "DFI licensee database bulk",
                "UTC household-goods CSV (does not exist)",
                "SOS CCFS full extract (retired)",
                "DOR business bulk",
                "DSHS locator scrape",
                "CMS raw federal files",
                "HMDA LAR dump",
                "SEC/IARD bulk this ticket",
                "Seattle / King / Tacoma / Pierce / Spokane / Snohomish / Bellevue / municipal permits",
            ],
        },
    )

    dump(
        NET / "contractor-priority-source-map.json",
        {
            "ticket": TICKET,
            "p0": True,
            "universe": "L&I contractor registration (RCW 18.27) plus electrical/plumbing/elevator contractor types in the same general file",
            "identity": "WA-LNI:{ContractorLicenseNumber}",
            "layers": ["general", "bond", "insurance"],
            "join_field": "ContractorLicenseNumber",
            "acquired": True,
            "join": JOIN,
        },
    )

    rows = lni_fixture_rows()
    dump(
        NET / "contractor" / "fixtures" / "lni-general-sample.json",
        {
            "ticket": TICKET,
            "source_id": "wa-lni-contractor-general",
            "source_url": "https://data.wa.gov/Labor/L-I-Contractor-License-Data-General/m8qx-ubtq",
            "source_as_of": CHECKED,
            "note": "Three official ACTIVE construction-contractor rows. Exact ID is ContractorLicenseNumber. PrimaryPrincipalName omitted (person). Phone is official business phone.",
            "row_count_file": JOIN["general_rows"],
            "active_count": JOIN["general_active"],
            "rows": rows,
        },
    )
    license0 = rows[0]["ContractorLicenseNumber"] if rows else "ECOSTSC758NN"
    bond = layer_row("bond", license0)
    ins = layer_row("insurance", license0)
    dump(
        NET / "contractor" / "fixtures" / "lni-bond-sample.json",
        {
            "ticket": TICKET,
            "source_id": "wa-lni-contractor-bond",
            "note": "Bond evidence row. Bond != endorsement. Impaired flag is evidence, not a ranking.",
            "row_count_file": JOIN["bond_rows"],
            "unique_license_numbers": JOIN["bond_unique"],
            "bond_impaired_y": JOIN["bond_impaired_y"],
            "rows": [bond] if bond else [],
        },
    )
    dump(
        NET / "contractor" / "fixtures" / "lni-insurance-sample.json",
        {
            "ticket": TICKET,
            "source_id": "wa-lni-contractor-insurance",
            "note": "Insurance evidence row. Insurance record != safety. CreatedBy_WAOIC_ID omitted (not a producer roster).",
            "row_count_file": JOIN["insurance_rows"],
            "unique_license_numbers": JOIN["insurance_unique"],
            "rows": [ins] if ins else [],
        },
    )
    dump(
        NET / "contractor" / "fixtures" / "lni-three-layer-join-note.json",
        {
            "ticket": TICKET,
            "source_id": "wa-lni-three-layer-join",
            "join_field": "ContractorLicenseNumber",
            "orphans_bond": 0,
            "orphans_insurance": 0,
            "join": JOIN,
        },
    )
    dump(
        NET / "move" / "fixtures" / "utc-hhg-directory-note.json",
        {
            "ticket": TICKET,
            "source_id": "wa-utc-household-goods-directory",
            "access_class": "OPEN_HTML_TABLE_BOUNDED",
            "active_page_total": 285,
            "scraped": False,
            "identity": ["UTC ID", "UBI", "USDOT"],
            "note": "UTC ID != UBI != USDOT. STATE AUTHORITY != FMCSA. No bulk CSV. Table not scraped this ticket.",
            "rows": [],
        },
    )
    dump(
        NET / "insurance" / "fixtures" / "oic-access-note.json",
        {
            "ticket": TICKET,
            "source_id": "wa-oic-lists-of-individuals",
            "use_class": "SOURCE_USE_RESTRICTED",
            "producer_bulk": False,
            "lookup": "SEARCH_ONLY",
            "company_roster_count": "UNKNOWN",
            "annual_report_entity_aggregate_2025": 2924,
            "note": "Do not bulk-ingest individual producers. RCW 42.56 lists of individuals for commercial purposes. OIC PRODUCER != AGENCY. CreatedBy_WAOIC_ID on L&I insurance is not a producer list.",
        },
    )
    dump(
        NET / "senior" / "fixtures" / "dshs-residential-care-sample.json",
        {
            "ticket": TICKET,
            "source_id": "wa-dshs-gis-residential-care",
            "source_url": "https://services2.arcgis.com/WW3T8U6q5EkZ9U3n/arcgis/rest/services/Long_Term_Care_Residential_Care_view/FeatureServer/1",
            "source_as_of": CHECKED,
            "note": "Official GIS current rows. FacilityPOC omitted. DSHS LicenseNumber != CMS CCN.",
            "current_counts": {
                "AF": JOIN["afh_current"],
                "BH": JOIN["alf_current"],
                "EF": JOIN["esf_current"],
                "SL": JOIN["sl_current"],
                "GT": JOIN["gt_current"],
                "current_total": JOIN["residential_current"],
            },
            "rows": [
                {
                    "LicenseNumber": "754112",
                    "FacInstanceId": 45570,
                    "FacilityType": "AF",
                    "FacilityName": "Rich of Joy AFH LLC",
                    "FacilityStatus": "OP",
                    "LocationCity": "KENT",
                    "LocationState": "WA",
                    "LicensedBedCount": 5,
                },
                {
                    "LicenseNumber": "1916",
                    "FacInstanceId": 30972,
                    "FacilityType": "BH",
                    "FacilityName": "GLEED ORCHARD MANOR",
                    "FacilityStatus": "OP",
                    "LocationCity": "GLEED",
                    "LocationState": "WA",
                    "LicensedBedCount": 29,
                },
            ],
        },
    )
    dump(
        NET / "lender" / "fixtures" / "dfi-search-only.json",
        {
            "ticket": TICKET,
            "source_id": "wa-dfi-verify-license",
            "access_class": "OPEN_SEARCH_ONLY",
            "company_roster_count": "UNKNOWN",
            "do_not_invent_denominator": True,
            "aggregates_dec_31_2025": {
                "mortgage_brokers": 354,
                "consumer_loan_companies": 1104,
                "mlos_active": 20126,
                "note": "Aggregates from DFI stats, not a bulk roster. MLO count is people — suppress.",
            },
            "rows": [],
        },
    )
    dump(
        NET / "investor" / "fixtures" / "dfi-securities-search-only.json",
        {
            "ticket": TICKET,
            "source_id": "wa-dfi-securities-licensee-database",
            "access_class": "OPEN_SEARCH_ONLY",
            "state_ria_bulk_count": "UNKNOWN",
            "note": "WA principal office != state registration. CRD != current WA authority. Plan SEC/IARD overlay. Do not scrape IAPD/BrokerCheck.",
            "aggregates_2024_year_in_review": {
                "broker_dealers": 1697,
                "investment_advisers": 645,
                "iar_people": 14753,
                "salespersons_people": 227450,
            },
            "rows": [],
        },
    )
    print("wrote washington network artifacts")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
