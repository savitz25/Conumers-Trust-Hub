#!/usr/bin/env python3
"""ATH-AZ-001: write Arizona six-hub source-foundation artifacts. No /arizona publish."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "network" / "arizona"
TICKET = "ATH-AZ-001"
CHECKED = "2026-09-04"
U = "UNKNOWN"

PHONE = {"present": False, "count": 0}
EMAIL = {"present": False, "count": 0}
WEB = {"present": False, "count": 0}
ADDR_U = {"present": U, "count": U}
NONE_CONTACT = {
    "BUSINESS_PHONE": PHONE,
    "BUSINESS_EMAIL": EMAIL,
    "WEBSITE": WEB,
    "PHYSICAL_BUSINESS_ADDRESS": {"present": False, "count": 0},
    "MAILING_BUSINESS_ADDRESS": {"present": False, "count": 0},
}
UNKNOWN_CONTACT = {
    "BUSINESS_PHONE": ADDR_U,
    "BUSINESS_EMAIL": EMAIL,
    "WEBSITE": WEB,
    "PHYSICAL_BUSINESS_ADDRESS": ADDR_U,
    "MAILING_BUSINESS_ADDRESS": ADDR_U,
}


def dump(path: Path, obj: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def src(**kwargs: object) -> dict:
    row = {
        "ticket": TICKET,
        "last_checked": CHECKED,
        "source_as_of": CHECKED,
        "contact_rank": "OFFICIAL_REGULATOR",
        "contact_fields": NONE_CONTACT,
    }
    row.update(kwargs)
    return row


HUB_NONE = {
    "ASK": "NONE",
    "CONTRACTOR": "NONE",
    "LENDER": "NONE",
    "INSURANCE": "NONE",
    "SENIOR": "NONE",
    "MOVE": "NONE",
    "INVESTOR": "NONE",
}


def hub(**overrides: str) -> dict:
    out = dict(HUB_NONE)
    out.update(overrides)
    return out


SCORES_NONE = {
    "IDENTITY_VALUE": "NONE",
    "CONTACT_VALUE": "NONE",
    "REGULATORY_VALUE": "NONE",
    "ENFORCEMENT_VALUE": "NONE",
    "MARKET_INTELLIGENCE_VALUE": "NONE",
    "ACQUISITION_EASE": "NONE",
    "REFRESHABILITY": "NONE",
}


def scores(**overrides: str) -> dict:
    out = dict(SCORES_NONE)
    out.update(overrides)
    return out


SOURCES = [
    src(
        source_id="az-ag-mover-no-license",
        hub_home="MOVE",
        source_family="regulatory_gap",
        source_name="Arizona AG: no mover registration or professional licensing requirement",
        regulator="Arizona Attorney General",
        source_url="https://www.azag.gov/press-release/attorney-general-mayes-and-bbb-warn-moving-scams-arizona-0",
        access_class="NO_STATE_ROSTER",
        identity_bar="NONE",
        identity_field=None,
        grain="absence_of_state_mover_license",
        record_count=0,
        unique_companies=0,
        count_notes=(
            "Official AG Mayes / BBB PSA 2025-07-07: 'Arizona does not have a registration law "
            "or a professional licensing requirement for movers.' A.R.S. §§ 44-1611–44-1616 is "
            "hostage-load consumer protection, not a license roster. 0 here is proven absence of "
            "a statewide HHG roster, not a missing scrape. ACC eCorp ≠ mover license. ROC R-22 "
            "House Moving ≠ household goods. STATE AUTHORITY does not exist in Arizona. "
            "USDOT ≠ interstate by itself. Entity growth from an Arizona mover roster is not available."
        ),
        identifier_fields=[],
        hub_value=hub(ASK="HIGH", MOVE="HIGH"),
        value_scores=scores(
            IDENTITY_VALUE="NONE",
            REGULATORY_VALUE="HIGH",
            ENFORCEMENT_VALUE="MEDIUM",
            MARKET_INTELLIGENCE_VALUE="HIGH",
            ACQUISITION_EASE="HIGH",
            REFRESHABILITY="HIGH",
        ),
        acquisition_status="DOCUMENTED_NO_ROSTER",
        entity_growth="NONE",
        intelligence_growth="HIGH",
        recommended_next_action="AZ-MOVE-001 publishes the consumer path (AG/DPS/FMCSA). Do not invent a roster.",
    ),
    src(
        source_id="az-ars-hostage-load",
        hub_home="MOVE",
        source_family="consumer_protection_statute",
        source_name="A.R.S. §§ 44-1611 to 44-1616 hostage-load law",
        regulator="Arizona Legislature / DPS peace officers",
        source_url="https://www.azleg.gov/arsDetail/?title=44",
        access_class="STATUTE_NOT_ROSTER",
        identity_bar="NONE",
        grain="statute",
        record_count=0,
        count_notes=(
            "Intrastate hostage-load prohibition. Peace officers may direct delivery after the "
            "total estimated price is paid (A.R.S. § 44-1614). Not a company list. Not a license."
        ),
        hub_value=hub(ASK="HIGH", MOVE="HIGH"),
        value_scores=scores(
            REGULATORY_VALUE="HIGH",
            ENFORCEMENT_VALUE="HIGH",
            MARKET_INTELLIGENCE_VALUE="MEDIUM",
            ACQUISITION_EASE="HIGH",
            REFRESHABILITY="HIGH",
        ),
        acquisition_status="DOCUMENTED_STATUTE",
        entity_growth="NONE",
        intelligence_growth="HIGH",
    ),
    src(
        source_id="az-dps-hostage-load-hotline",
        hub_home="MOVE",
        source_family="consumer_complaint_path",
        source_name="Arizona DPS hostage-load consumer hotline",
        regulator="Arizona Department of Public Safety",
        source_url="https://www.azdps.gov/content/basic-page/94/hhg",
        access_class="CONSUMER_PATH",
        identity_bar="NONE",
        grain="hotline",
        record_count=U,
        count_notes=(
            "AG PSA: DPS 602-223-2212 / 602-223-5000 for hostage-load help. "
            "DPS HHG consumer page: interstate = FMCSA; in-state verify = ACC Entity Search "
            "(business registration, not a mover license). Legacy URL "
            "https://www.azdps.gov/services/public/moving returned HTTP 404 on 2026-09-04. "
            "Not a roster. Do not scrape DPS."
        ),
        probe_http_status=404,
        hub_value=hub(ASK="MEDIUM", MOVE="HIGH"),
        value_scores=scores(
            REGULATORY_VALUE="MEDIUM",
            ENFORCEMENT_VALUE="HIGH",
            MARKET_INTELLIGENCE_VALUE="LOW",
            ACQUISITION_EASE="HIGH",
            REFRESHABILITY="MEDIUM",
        ),
        acquisition_status="DOCUMENTED_HOTLINE",
        entity_growth="NONE",
        intelligence_growth="MEDIUM",
    ),
    src(
        source_id="az-roc-r22-house-moving",
        hub_home="MOVE",
        source_family="contractor_classification_not_hhg",
        source_name="ROC R-22 House Moving (building relocation, not household goods)",
        regulator="Arizona Registrar of Contractors",
        source_url="https://roc.az.gov/license-classifications",
        access_class="WRONG_UNIVERSE",
        identity_bar="EXACT",
        identity_field="ROC license number (R-22 class)",
        grain="contractor_classification",
        record_count=U,
        count_notes=(
            "R-22 allows disconnecting utilities to relocate a house. Connection of utilities and "
            "foundations are not permitted. This is building moving, not household-goods carriage. "
            "ROC R-22 ≠ HHG mover. Builder 3 owns ROC in AZ-CON-001. Do not harvest R-22 as movers."
        ),
        identifier_fields=["ROC license number"],
        hub_value=hub(CONTRACTOR="MEDIUM", MOVE="NONE"),
        value_scores=scores(
            IDENTITY_VALUE="HIGH",
            REGULATORY_VALUE="HIGH",
            ACQUISITION_EASE="LOW",
        ),
        acquisition_status="OWNED_BY_AZ_CON_001_WRONG_UNIVERSE_FOR_MOVE",
        entity_growth="NONE_FOR_MOVE",
        intelligence_growth="NONE_FOR_MOVE",
        recommended_next_action="Leave to AZ-CON-001. Do not treat R-22 as a mover roster.",
    ),
    src(
        source_id="az-fmcsa-mcmis-census-az-physical",
        hub_home="MOVE",
        source_family="federal_motor_carrier_census",
        source_name="FMCSA MCMIS Company Census (AZ physical state)",
        regulator="FMCSA / U.S. DOT",
        source_url="https://data.transportation.gov/d/az4n-8mr2",
        download_url="https://data.transportation.gov/resource/az4n-8mr2.json",
        dataset_id="az4n-8mr2",
        access_class="OPEN_SODA_API",
        contact_rank="FEDERAL_OVERLAY",
        identity_bar="EXACT",
        identity_field="USDOT",
        grain="all_motor_carriers_not_household_goods",
        record_count=60519,
        active_count=31875,
        count_notes=(
            "Live Socrata 2026-09-04: phy_state=AZ count(*)=60519; status_code=A count(*)=31875. "
            "mail_state filter HTTP 400. carship is present; this extract has no H/HHG cargo flag. "
            "60519 is ALL Arizona-physical motor carriers, not movers. Do not publish 60,519 as "
            "Arizona moving companies. USDOT ≠ interstate authority by itself. STATE AUTHORITY ≠ FMCSA."
        ),
        identifier_fields=["dot_number"],
        contact_fields={
            "BUSINESS_PHONE": {"present": False, "count": 0},
            "BUSINESS_EMAIL": EMAIL,
            "WEBSITE": WEB,
            "PHYSICAL_BUSINESS_ADDRESS": {"present": True, "count": U},
            "MAILING_BUSINESS_ADDRESS": {"present": True, "count": U},
        },
        hub_value=hub(ASK="LOW", MOVE="LOW"),
        value_scores=scores(
            IDENTITY_VALUE="HIGH",
            CONTACT_VALUE="LOW",
            REGULATORY_VALUE="MEDIUM",
            MARKET_INTELLIGENCE_VALUE="LOW",
            ACQUISITION_EASE="HIGH",
            REFRESHABILITY="HIGH",
        ),
        acquisition_status="COUNTED_NOT_INGESTED",
        entity_growth="UNSAFE_IF_TREATED_AS_MOVERS",
        intelligence_growth="LOW",
        recommended_next_action="Do not ingest the full census as movers. HHG subset is not in this extract.",
    ),
    src(
        source_id="az-move-national-directory-overlay",
        hub_home="MOVE",
        source_family="existing_national_graph",
        source_name="MoveTrustHub national publishable directory — Arizona HQ overlay (not yet partitioned)",
        regulator="FMCSA (directory already in MoveTrustHub)",
        source_url="https://safer.fmcsa.dot.gov/",
        access_class="EXISTING_NATIONAL_GRAPH",
        contact_rank="FEDERAL_OVERLAY",
        identity_bar="EXACT",
        identity_field="USDOT",
        grain="publishable_federal_mover_profile",
        record_count=5022,
        az_hq_publishable=U,
        count_notes=(
            "Ask move-v1-fallback: national publishableProfiles=5022. HQ partitions exist for "
            "FL=483, NJ=269, CA=403. Arizona HQ partition is not published in Ask (UNKNOWN). "
            "Overlaying AZ HQ onto the existing 5022 is intelligence on existing companies, not "
            "net-new canonical organizations and not an Arizona state identity. HQ ≠ service territory."
        ),
        identifier_fields=["USDOT"],
        hub_value=hub(ASK="MEDIUM", MOVE="HIGH"),
        value_scores=scores(
            IDENTITY_VALUE="HIGH",
            CONTACT_VALUE="MEDIUM",
            REGULATORY_VALUE="MEDIUM",
            MARKET_INTELLIGENCE_VALUE="HIGH",
            ACQUISITION_EASE="HIGH",
            REFRESHABILITY="HIGH",
        ),
        acquisition_status="PRE_EXISTING_NATIONAL_GRAPH_AZ_HQ_UNKNOWN",
        entity_growth="ZERO_NET_NEW_CANONICAL",
        intelligence_growth="HIGH",
        recommended_next_action="AZ-MOVE-001 may publish an AZ HQ overlay of the existing 5022. Do not scrape SAFER.",
    ),
    src(
        source_id="az-difi-license-search",
        hub_home="INSURANCE",
        source_family="license_verify",
        source_name="DIFI license search (points to NAIC SBS)",
        regulator="Arizona Department of Insurance and Financial Institutions",
        source_url="https://difi.az.gov/license-search",
        access_class="OPEN_SEARCH_ONLY",
        identity_bar="EXACT",
        identity_field="NPN / NAIC / DIFI license number when returned",
        grain="mixed_person_and_business_credential",
        record_count=U,
        count_notes=(
            "Official DIFI license-search page. Probe HTTP 403 Cloudflare on 2026-09-04. "
            "Lookup is free via SBS. Generate a Report is paid. Do not scrape search. "
            "Producer ≠ agency ≠ insurer. Missing ≠ zero."
        ),
        probe_http_status=403,
        identifier_fields=["NPN", "NAIC"],
        contact_fields=UNKNOWN_CONTACT,
        hub_value=hub(ASK="MEDIUM", INSURANCE="HIGH"),
        value_scores=scores(
            IDENTITY_VALUE="HIGH",
            CONTACT_VALUE="MEDIUM",
            REGULATORY_VALUE="HIGH",
            ENFORCEMENT_VALUE="MEDIUM",
            MARKET_INTELLIGENCE_VALUE="MEDIUM",
            ACQUISITION_EASE="LOW",
            REFRESHABILITY="HIGH",
        ),
        acquisition_status="BLOCKED_SEARCH_ONLY",
        entity_growth="UNKNOWN_NOT_ZERO",
        intelligence_growth="MEDIUM",
        recommended_next_action="AZ-INS-001 keep search path. Do not scrape. Do not buy reports.",
    ),
    src(
        source_id="az-sbs-lookup",
        hub_home="INSURANCE",
        source_family="license_verify",
        source_name="NAIC State Based Systems Lookup (free)",
        regulator="NAIC SBS (used by DIFI)",
        source_url="https://www.statebasedsystems.com/",
        access_class="OPEN_SEARCH_ONLY",
        identity_bar="EXACT",
        identity_field="NPN / license number / NAIC when returned",
        grain="mixed_person_and_business_credential",
        record_count=U,
        count_notes=(
            "Free Lookup for a named producer, agency, or company. Probe HTTP 403 this session. "
            "Not a bulk roster. SEARCH_ONLY ≠ zero. Do not scrape Lookup."
        ),
        probe_http_status=403,
        identifier_fields=["NPN", "license number", "NAIC"],
        contact_fields=UNKNOWN_CONTACT,
        hub_value=hub(ASK="MEDIUM", INSURANCE="HIGH"),
        value_scores=scores(
            IDENTITY_VALUE="HIGH",
            CONTACT_VALUE="MEDIUM",
            REGULATORY_VALUE="HIGH",
            ACQUISITION_EASE="LOW",
            REFRESHABILITY="HIGH",
        ),
        acquisition_status="BLOCKED_SEARCH_ONLY",
        entity_growth="UNKNOWN_NOT_ZERO",
        intelligence_growth="LOW",
        recommended_next_action="Consumer verify path only.",
    ),
    src(
        source_id="az-sbs-report-generator",
        hub_home="INSURANCE",
        source_family="license_roster",
        source_name="NAIC SBS Report Generator (paid CSV)",
        regulator="NAIC SBS (used by DIFI)",
        source_url="https://www.statebasedsystems.com/solar/support.html",
        sample_report_url="https://www.statebasedsystems.com/solar/docs/GenerateReportOfLicensees.pdf",
        access_class="OPEN_REPORT_GENERATOR_PAID",
        identity_bar="EXACT",
        identity_field="license number / NPN when present",
        grain="mixed_person_and_business_license_row",
        record_count=U,
        unique_companies=U,
        report_price_per_row_usd=0.03,
        report_minimum_usd=30.00,
        report_format="CSV",
        count_notes=(
            "Official SBS Support Center (checked 2026-09-04): purchase price is $0.03 per row "
            "with a $30.00 minimum per report; CSV; preview of row count and cost before payment. "
            "Fields include license number, license type, license status, CE compliance, full "
            "business address, email, line of authority. Grain is license rows — producers (people) "
            "and business entities mixed. One company may hold multiple licenses. License row ≠ "
            "unique company. This ticket does not purchase. STOP on paid data."
        ),
        identifier_fields=["license number", "NPN"],
        contact_fields={
            "BUSINESS_PHONE": ADDR_U,
            "BUSINESS_EMAIL": {"present": True, "count": U},
            "WEBSITE": WEB,
            "PHYSICAL_BUSINESS_ADDRESS": {"present": True, "count": U},
            "MAILING_BUSINESS_ADDRESS": ADDR_U,
        },
        hub_value=hub(ASK="HIGH", INSURANCE="HIGH"),
        value_scores=scores(
            IDENTITY_VALUE="HIGH",
            CONTACT_VALUE="HIGH",
            REGULATORY_VALUE="HIGH",
            MARKET_INTELLIGENCE_VALUE="HIGH",
            ACQUISITION_EASE="LOW",
            REFRESHABILITY="MEDIUM",
        ),
        acquisition_status="NOT_ACQUIRED_PAID",
        entity_growth="UNKNOWN_BLOCKED_PAID",
        intelligence_growth="HIGH_IF_PURCHASED_DO_NOT",
        recommended_next_action="Do not buy. AZ-INS-001 stays search + enforcement identity rules.",
        blocker="Paid report generator. Ticket forbids paid acquisition.",
    ),
    src(
        source_id="az-difi-enforcement-actions",
        hub_home="INSURANCE",
        source_family="enforcement",
        source_name="DIFI enforcement actions table",
        regulator="Arizona Department of Insurance and Financial Institutions",
        source_url="https://difi.az.gov/enforcement-actions",
        access_class="OPEN_HTML_TABLE_PAGINATED",
        identity_bar="EXACT",
        identity_field="NPN / NAIC when present on the row",
        grain="enforcement_order",
        record_count=U,
        count_notes=(
            "HTML enforcement table. NPN/NAIC may appear. Paginated. Probe HTTP 403 this session. "
            "Do not scrape pagination. Name-only attach is UNSAFE. Complaint ≠ violation. "
            "Person NPN is not a business profile."
        ),
        probe_http_status=403,
        identifier_fields=["NPN", "NAIC"],
        hub_value=hub(ASK="MEDIUM", INSURANCE="HIGH"),
        value_scores=scores(
            IDENTITY_VALUE="MEDIUM",
            REGULATORY_VALUE="HIGH",
            ENFORCEMENT_VALUE="HIGH",
            MARKET_INTELLIGENCE_VALUE="MEDIUM",
            ACQUISITION_EASE="LOW",
            REFRESHABILITY="MEDIUM",
        ),
        acquisition_status="DOCUMENTED_NOT_SCRAPED",
        entity_growth="NONE",
        intelligence_growth="MEDIUM",
        recommended_next_action="AZ-INS-001 may attach only on exact NPN/NAIC. Do not scrape.",
    ),
    src(
        source_id="az-difi-market-conduct",
        hub_home="INSURANCE",
        source_family="enforcement",
        source_name="DIFI market-conduct exam reports (PDF search)",
        regulator="Arizona Department of Insurance and Financial Institutions",
        source_url="https://difi.az.gov/",
        access_class="PDF_SEARCH_DO_NOT_CRAWL",
        identity_bar="REVIEW_REQUIRED",
        grain="exam_report_pdf",
        record_count=U,
        count_notes="PDF search, not a bulk machine file. Large PDF crawl is a stop rule. Do not crawl.",
        hub_value=hub(INSURANCE="MEDIUM"),
        value_scores=scores(
            REGULATORY_VALUE="HIGH",
            ENFORCEMENT_VALUE="HIGH",
            ACQUISITION_EASE="LOW",
        ),
        acquisition_status="SKIPPED_PDF_CRAWL",
        entity_growth="NONE",
        intelligence_growth="LOW",
    ),
    src(
        source_id="az-insurance-national-graph",
        hub_home="INSURANCE",
        source_family="existing_national_graph",
        source_name="InsuranceTrustHub national graph — no Arizona credentialsByJurisdiction partition",
        regulator="multi-state (already in Ask metrics)",
        source_url="https://www.insurancetrusthub.com/",
        access_class="EXISTING_NATIONAL_GRAPH",
        identity_bar="EXACT",
        identity_field="NPN / NAIC when already in graph",
        grain="national_agency_and_insurer",
        record_count=U,
        national_agencies=82071,
        national_legal_insurers=6185,
        az_credentials_by_jurisdiction=None,
        count_notes=(
            "Ask insurance-v1-fallback credentialsByJurisdiction lists FL=750316, TX=718894, "
            "VT, MA, OH, NJ=0, CA=0. Arizona is not a listed partition. Missing ≠ zero Arizona "
            "agencies. Do not invent an Arizona agency count from the national graph."
        ),
        identifier_fields=["NPN", "NAIC"],
        hub_value=hub(ASK="MEDIUM", INSURANCE="MEDIUM"),
        value_scores=scores(
            IDENTITY_VALUE="HIGH",
            MARKET_INTELLIGENCE_VALUE="LOW",
            ACQUISITION_EASE="HIGH",
        ),
        acquisition_status="PRE_EXISTING_NO_AZ_PARTITION",
        entity_growth="UNKNOWN_NOT_ZERO",
        intelligence_growth="LOW",
    ),
    src(
        source_id="az-difi-mortgage-lending",
        hub_home="LENDER",
        source_family="license_verify",
        source_name="DIFI mortgage lending (NMLS)",
        regulator="Arizona Department of Insurance and Financial Institutions",
        source_url="https://difi.az.gov/licensing/mortgage-lending",
        access_class="OPEN_SEARCH_ONLY",
        identity_bar="EXACT",
        identity_field="NMLS ID",
        grain="mixed_company_and_person_nmls",
        record_count=U,
        count_notes=(
            "DIFI mortgage classes via NMLS: Mortgage Banker, Mortgage Broker, Commercial "
            "Mortgage Banker, Commercial Mortgage Broker, Registered Exempt Person, Loan "
            "Originator (person). Probe HTTP 403 this session. No bulk company roster. "
            "Loan Originator is a person credential — not a business profile. Do not scrape NMLS."
        ),
        probe_http_status=403,
        identifier_fields=["NMLS ID"],
        contact_fields=UNKNOWN_CONTACT,
        hub_value=hub(ASK="MEDIUM", LENDER="HIGH"),
        value_scores=scores(
            IDENTITY_VALUE="HIGH",
            REGULATORY_VALUE="HIGH",
            ACQUISITION_EASE="LOW",
            REFRESHABILITY="HIGH",
        ),
        acquisition_status="BLOCKED_SEARCH_ONLY",
        entity_growth="UNKNOWN_NOT_ZERO",
        intelligence_growth="LOW",
        recommended_next_action="AZ-LEND-001 keep NMLS as verify-only. Do not invent a denominator.",
    ),
    src(
        source_id="az-nmls-consumer-access",
        hub_home="LENDER",
        source_family="license_verify",
        source_name="NMLS Consumer Access",
        regulator="NMLS / CSBS (used by DIFI)",
        source_url="https://www.nmlsconsumeraccess.org/",
        access_class="OPEN_SEARCH_ONLY",
        identity_bar="EXACT",
        identity_field="NMLS ID",
        grain="mixed_company_and_person",
        record_count=U,
        count_notes="Search-only. Do not scrape. SEARCH_ONLY ≠ zero companies.",
        identifier_fields=["NMLS ID"],
        hub_value=hub(ASK="MEDIUM", LENDER="HIGH", INVESTOR="LOW"),
        value_scores=scores(
            IDENTITY_VALUE="HIGH",
            REGULATORY_VALUE="HIGH",
            ACQUISITION_EASE="LOW",
            REFRESHABILITY="HIGH",
        ),
        acquisition_status="BLOCKED_SEARCH_ONLY",
        entity_growth="UNKNOWN_NOT_ZERO",
        intelligence_growth="LOW",
        blocker="No NMLS bulk. Ticket forbids search-portal scrape.",
    ),
    src(
        source_id="az-difi-financial-enterprises",
        hub_home="LENDER",
        source_family="license_verify",
        source_name="DIFI financial enterprises (money transmitter / debt management / escrow)",
        regulator="Arizona Department of Insurance and Financial Institutions",
        source_url="https://difi.az.gov/licensing/financial-enterprises",
        access_class="OPEN_SEARCH_ONLY",
        identity_bar="EXACT",
        identity_field="DIFI / NMLS identifier when returned",
        grain="financial_enterprise_license",
        record_count=U,
        count_notes=(
            "Money transmitter, debt management, escrow and related classes. Probe HTTP 403. "
            "Not a mortgage-lender roster. No bulk file found. Do not scrape."
        ),
        probe_http_status=403,
        hub_value=hub(LENDER="MEDIUM"),
        value_scores=scores(
            IDENTITY_VALUE="HIGH",
            REGULATORY_VALUE="HIGH",
            ACQUISITION_EASE="LOW",
        ),
        acquisition_status="BLOCKED_SEARCH_ONLY",
        entity_growth="UNKNOWN_NOT_ZERO",
        intelligence_growth="LOW",
    ),
    src(
        source_id="az-hmda-cfpb-overlay",
        hub_home="LENDER",
        source_family="market_observation",
        source_name="HMDA Arizona applications / originations / denials (already in Ask)",
        regulator="CFPB HMDA",
        source_url="https://ffiec.cfpb.gov/",
        access_class="ALREADY_ACQUIRED_MARKET_OBSERVATION",
        contact_rank="FEDERAL_OVERLAY",
        identity_bar="REVIEW_REQUIRED",
        identity_field="HMDA LEI / respondent when present — not a license",
        grain="mortgage_application",
        record_count=307379,
        originations=183374,
        denials=49376,
        lender_hub_slice={
            "counties": 15,
            "applications": 308338,
            "originations": 183374,
            "denials": 49721,
            "lei_state_rows": 953,
            "high_confidence_lei_maps": 123,
        },
        count_notes=(
            "Ask lender-v1-fallback Arizona: applications=307379, originations=183374, "
            "denials=49376. Lender-Trust-Hub existing slice: 15 of 15 counties, applications="
            "308338, originations=183374, denials=49721, 953 LEI state rows, 123 high-confidence "
            "LEI maps. Originations match; application/denial clocks are not reconciled this ticket. "
            "These are application rows, not lender companies. HMDA ≠ license roster. Already "
            "acquired. Do not dump a new LAR. Do not convert LEIs into net-new organizations."
        ),
        identifier_fields=["LEI"],
        hub_value=hub(ASK="HIGH", LENDER="HIGH"),
        value_scores=scores(
            IDENTITY_VALUE="LOW",
            MARKET_INTELLIGENCE_VALUE="HIGH",
            ACQUISITION_EASE="HIGH",
            REFRESHABILITY="MEDIUM",
        ),
        acquisition_status="ALREADY_ACQUIRED",
        entity_growth="ZERO",
        intelligence_growth="HIGH",
        recommended_next_action="AZ-LEND-001 publish HMDA Arizona market intelligence. Do not call applications companies.",
    ),
    src(
        source_id="az-acc-securities-research",
        hub_home="INVESTOR",
        source_family="license_verify",
        source_name="ACC Securities Broker / Adviser Search (FINRA BrokerCheck / SEC IAPD)",
        regulator="Arizona Corporation Commission — Securities Division",
        source_url="https://www.azcc.gov/securities/research",
        access_class="OPEN_SEARCH_ONLY",
        identity_bar="EXACT",
        identity_field="CRD when BrokerCheck / IAPD returns one",
        grain="federal_search_not_az_roster",
        record_count=U,
        count_notes=(
            "ACC research page points consumers to FINRA BrokerCheck and SEC IAPD. That is "
            "federal search, not an Arizona state-RIA roster. Probe HTTP 200 on 2026-09-04. "
            "Do not scrape BrokerCheck or IAPD. CRD ≠ current Arizona authority by itself."
        ),
        probe_http_status=200,
        identifier_fields=["CRD"],
        hub_value=hub(ASK="LOW", INVESTOR="HIGH"),
        value_scores=scores(
            IDENTITY_VALUE="HIGH",
            REGULATORY_VALUE="MEDIUM",
            ACQUISITION_EASE="LOW",
            REFRESHABILITY="HIGH",
        ),
        acquisition_status="BLOCKED_SEARCH_ONLY",
        entity_growth="UNKNOWN_NOT_ZERO",
        intelligence_growth="LOW",
    ),
    src(
        source_id="az-acc-securities-list-request",
        hub_home="INVESTOR",
        source_family="license_roster",
        source_name="ACC Securities dealer / IA / notice-filed firm lists (public-records request)",
        regulator="Arizona Corporation Commission — Securities Division",
        source_url="https://www.azcc.gov/securities/forms",
        request_form_url="https://www.azcc.gov/docs/default-source/securities-files/pubreq2.pdf",
        access_class="SOURCE_AVAILABLE_BY_REQUEST",
        identity_bar="EXACT",
        identity_field="CRD / ACC file number when the list includes one",
        grain="state_securities_firm_list",
        record_count=U,
        unique_companies=U,
        count_notes=(
            "ACC list-request PDF (pubreq2.pdf; A.R.S. § 39-121.03) offers CSV for: Securities "
            "Dealer Firms registered in AZ (name, CRD, address, contact name/phone); Investment "
            "Adviser Firms licensed in AZ (name, CRD, address); Investment Adviser Firms notice "
            "filed in AZ (name, CRD, address). Individual S7/S6/IAR lists are people — suppress. "
            "Commercial-purpose request requires a notary. This is the only remaining Arizona "
            "path that could add actual state-registered IA / BD firms not already in SEC IARD. "
            "This ticket does not file a PRA. STOP on PRA. UNKNOWN ≠ 0."
        ),
        commercial_purpose_requires_notary=True,
        firm_lists_available=[
            "Securities Dealer Firms registered in AZ",
            "Investment Adviser Firms licensed in AZ",
            "Investment Adviser Firms notice filed in AZ",
        ],
        identifier_fields=["CRD", "ACC file number"],
        contact_fields=UNKNOWN_CONTACT,
        hub_value=hub(ASK="MEDIUM", INVESTOR="HIGH"),
        value_scores=scores(
            IDENTITY_VALUE="HIGH",
            CONTACT_VALUE=U,
            REGULATORY_VALUE="HIGH",
            MARKET_INTELLIGENCE_VALUE="HIGH",
            ACQUISITION_EASE="LOW",
            REFRESHABILITY="LOW",
        ),
        acquisition_status="NOT_ACQUIRED_PRA",
        entity_growth="UNKNOWN_BLOCKED_PRA",
        intelligence_growth="HIGH_IF_REQUESTED_DO_NOT",
        recommended_next_action="Do not PRA this ticket. Later program decision only.",
        blocker="Public-records list request. Ticket forbids PRA.",
    ),
    src(
        source_id="az-acc-securities-enforcement",
        hub_home="INVESTOR",
        source_family="enforcement",
        source_name="ACC Securities Division enforcement actions",
        regulator="Arizona Corporation Commission — Securities Division",
        source_url="https://www.azcc.gov/securities/enforcements/actions",
        access_class="OPEN_HTML_TABLE_BOUNDED",
        identity_bar="REVIEW_REQUIRED",
        grain="securities_order",
        record_count=U,
        count_notes=(
            "HTML enforcement actions. Probe HTTP 200, 116,808 bytes on 2026-09-04. Bounded "
            "documentation only. Do not scrape. Name-only UNSAFE. CRD when present is EXACT."
        ),
        probe_http_status=200,
        identifier_fields=["CRD"],
        hub_value=hub(ASK="MEDIUM", INVESTOR="HIGH"),
        value_scores=scores(
            IDENTITY_VALUE="MEDIUM",
            REGULATORY_VALUE="HIGH",
            ENFORCEMENT_VALUE="HIGH",
            MARKET_INTELLIGENCE_VALUE="MEDIUM",
            ACQUISITION_EASE="MEDIUM",
            REFRESHABILITY="MEDIUM",
        ),
        acquisition_status="DOCUMENTED_NOT_SCRAPED",
        entity_growth="NONE",
        intelligence_growth="MEDIUM",
        recommended_next_action="AZ-INV-001 may attach only on exact CRD. Do not scrape.",
    ),
    src(
        source_id="az-sec-iard-principal-office-overlay",
        hub_home="INVESTOR",
        source_family="existing_national_graph",
        source_name="SEC IARD principal-office overlay (Arizona not yet partitioned)",
        regulator="SEC IARD (already in InvestorTrustHub)",
        source_url="https://adviserinfo.sec.gov/",
        access_class="EXISTING_NATIONAL_GRAPH",
        contact_rank="FEDERAL_OVERLAY",
        identity_bar="EXACT",
        identity_field="CRD",
        grain="sec_registered_or_era_firm",
        record_count=25777,
        ria_facts=17018,
        era_facts=6604,
        az_principal_office=213,
        count_notes=(
            "Ask investor-v1-fallback: canonicalFirms=25777, riaFacts=17018, eraFacts=6604, "
            "IA_FIRM_SEC_Feed_08_27_2026. Published Ask partitions: CA=2699, NJ=438. "
            "Existing Investor census overlay: 213 Arizona principal-office firms "
            "(investor-wa-inv-001/docs/inv-home-001-census.json, read-only). Overlay is "
            "intelligence on existing national firms, not Arizona state IA registration. "
            "CRD ≠ current Arizona authority. Zero net-new canonical organizations from this overlay."
        ),
        identifier_fields=["CRD", "SEC file number"],
        hub_value=hub(ASK="HIGH", INVESTOR="HIGH"),
        value_scores=scores(
            IDENTITY_VALUE="HIGH",
            CONTACT_VALUE="MEDIUM",
            REGULATORY_VALUE="MEDIUM",
            MARKET_INTELLIGENCE_VALUE="HIGH",
            ACQUISITION_EASE="HIGH",
            REFRESHABILITY="HIGH",
        ),
        acquisition_status="PRE_EXISTING_NATIONAL_GRAPH_AZ_HQ_UNKNOWN",
        entity_growth="ZERO_NET_NEW_CANONICAL",
        intelligence_growth="HIGH",
        recommended_next_action="AZ-INV-001 publish Arizona principal-office overlay from existing IARD. Do not scrape IAPD.",
    ),
    src(
        source_id="az-acc-ecorp-entity-search",
        hub_home="ASK",
        source_family="business_registration",
        source_name="ACC eCorp entity search",
        regulator="Arizona Corporation Commission",
        source_url="https://ecorp.azcc.gov/EntitySearch/Index",
        access_class="OPEN_SEARCH_ONLY",
        identity_bar="EXACT",
        identity_field="ACC entity ID / file number",
        grain="all_arizona_business_entities",
        record_count=U,
        count_notes=(
            "eCorp is the statewide corporations / LLC search. Probe HTTP 200 on 2026-09-04. "
            "ACC business registration ≠ professional license (ROC / DIFI / NMLS / CRD / USDOT). "
            "Do not scrape search. Not a mover, insurer, lender, or adviser roster."
        ),
        probe_http_status=200,
        identifier_fields=["ACC entity ID"],
        contact_fields=UNKNOWN_CONTACT,
        hub_value=hub(ASK="LOW", CONTRACTOR="LOW"),
        value_scores=scores(
            IDENTITY_VALUE="HIGH",
            CONTACT_VALUE=U,
            REGULATORY_VALUE="LOW",
            ACQUISITION_EASE="LOW",
        ),
        acquisition_status="BLOCKED_SEARCH_ONLY",
        entity_growth="UNKNOWN_NOT_ZERO",
        intelligence_growth="LOW",
        recommended_next_action="Do not scrape eCorp. Bulk is by request only.",
    ),
    src(
        source_id="az-acc-ecorp-bulk-request",
        hub_home="ASK",
        source_family="business_registration",
        source_name="ACC eCorp bulk business-entity extract (public records request)",
        regulator="Arizona Corporation Commission",
        source_url="https://ecorp.azcc.gov/EntitySearch/Index",
        access_class="SOURCE_AVAILABLE_BY_REQUEST",
        identity_bar="EXACT",
        identity_field="ACC entity ID",
        grain="all_arizona_business_entities",
        record_count=U,
        unique_companies=U,
        count_notes=(
            "No free bulk eCorp dump found. Public-records request path exists. Checked against "
            "the 2026-07-25 Arizona bulk note: no free bulk. Filing a PRA is a stop rule. "
            "Even if obtained, this is every Arizona corporation/LLC, not hub-licensed companies. "
            "Not Austin/LA/SF-class permit identity. Do not acquire this ticket."
        ),
        identifier_fields=["ACC entity ID"],
        hub_value=hub(ASK="LOW"),
        value_scores=scores(
            IDENTITY_VALUE="HIGH",
            CONTACT_VALUE=U,
            ACQUISITION_EASE="LOW",
            REFRESHABILITY="LOW",
        ),
        acquisition_status="NOT_ACQUIRED_PRA",
        entity_growth="UNKNOWN_BLOCKED_PRA_WRONG_UNIVERSE_FOR_HUBS",
        intelligence_growth="LOW",
        recommended_next_action="Do not PRA. Do not start an all-entity Arizona dump.",
        blocker="PRA / public-records request. Ticket forbids PRA.",
    ),
    src(
        source_id="az-roc-contractor-pointer",
        hub_home="CONTRACTOR",
        source_family="license_roster",
        source_name="Arizona ROC contractor licenses (owned by AZ-CON-001)",
        regulator="Arizona Registrar of Contractors",
        source_url="https://roc.az.gov/",
        access_class="OWNED_BY_SISTER_TICKET",
        identity_bar="EXACT",
        identity_field="ROC license number",
        grain="contractor_license",
        record_count=58408,
        az_con_001_distinct_license_no=58131,
        count_notes=(
            "Ask contractor-v1-fallback licensesBySource.az_roc=58408. AZ-CON-001 worktree ROC "
            "All Current Contractors profile (file created 2026-08-12) has 58,131 distinct License No. "
            "Two clocks, not reconciled here. License rows ≠ unique companies. This ticket does not "
            "re-acquire ROC. Cloudflare 403 on roc.az.gov/posting-list this session. Builder 3 owns AZ-CON-001."
        ),
        probe_http_status=403,
        identifier_fields=["ROC license number"],
        hub_value=hub(ASK="HIGH", CONTRACTOR="HIGH"),
        value_scores=scores(
            IDENTITY_VALUE="HIGH",
            CONTACT_VALUE=U,
            REGULATORY_VALUE="HIGH",
            ENFORCEMENT_VALUE="HIGH",
            MARKET_INTELLIGENCE_VALUE="HIGH",
            ACQUISITION_EASE="MEDIUM",
            REFRESHABILITY="HIGH",
        ),
        acquisition_status="OWNED_BY_AZ_CON_001",
        entity_growth="IN_FLIGHT_SISTER_TICKET",
        intelligence_growth="HIGH",
        recommended_next_action="Do not duplicate ROC files. Leave AZ-CON-001 to Builder 3.",
    ),
    src(
        source_id="az-senior-cms-and-state-pointer",
        hub_home="SENIOR",
        source_family="existing_specialist_page",
        source_name="SeniorTrustHub /arizona (AZ-SEN-001 accepted)",
        regulator="CMS + Arizona state overlay already published",
        source_url="https://www.seniortrusthub.com/arizona",
        access_class="ALREADY_PUBLISHED",
        identity_bar="EXACT",
        identity_field="CMS CCN / Arizona state facility identity",
        grain="senior_facility",
        record_count=U,
        cms_nursing_homes=140,
        cms_home_health=177,
        cms_hospice=237,
        accepted_ledger={
            "NET_NEW_CANONICAL_ORGANIZATIONS": 0,
            "NET_NEW_STATE_IDENTITIES": 2776,
            "EXISTING_ORGANIZATIONS_ENRICHED": 544,
            "NEW_EVIDENCE_ROWS": 2779,
        },
        count_notes=(
            "AZ-SEN-001 is closed. Ask senior-v1-fallback Arizona CMS: nursingHomes=140, "
            "homeHealth=177, hospice=237. Accepted ledger: net-new canonical=0, net-new state "
            "identities=2776, existing enriched=544, new evidence rows=2779. Do not redo Senior. "
            "CMS CCN ≠ Arizona state facility identity. Live page HTTP 200 on 2026-09-04."
        ),
        probe_http_status=200,
        identifier_fields=["CMS CCN", "Arizona state facility identity"],
        hub_value=hub(ASK="HIGH", SENIOR="HIGH"),
        value_scores=scores(
            IDENTITY_VALUE="HIGH",
            CONTACT_VALUE="HIGH",
            REGULATORY_VALUE="HIGH",
            MARKET_INTELLIGENCE_VALUE="HIGH",
            ACQUISITION_EASE="HIGH",
            REFRESHABILITY="HIGH",
        ),
        acquisition_status="ALREADY_PUBLISHED_AZ_SEN_001",
        entity_growth="ZERO_NET_NEW_CANONICAL_STATE_IDENTITIES_ALREADY_ADDED",
        intelligence_growth="ALREADY_SHIPPED",
        recommended_next_action="Do not redo Senior. Specialist page is live.",
    ),
    src(
        source_id="az-data-az-gov",
        hub_home="ASK",
        source_family="open_data_catalog",
        source_name="data.az.gov CKAN catalog",
        regulator="State of Arizona",
        source_url="https://data.az.gov/",
        access_class="UNREACHABLE_THIS_SESSION",
        identity_bar="NONE",
        grain="catalog",
        record_count=U,
        count_notes=(
            "CKAN package_search HTTP 0 / 48 bytes this session (getaddrinfo failed). No free "
            "bulk insurance, mortgage, mover, or securities roster was obtained. Unreachable ≠ "
            "proof the catalog is empty forever. No second deep crawl: stop rule keeps Arizona fast."
        ),
        probe_http_status=0,
        hub_value=hub(),
        value_scores=scores(ACQUISITION_EASE="LOW"),
        acquisition_status="UNREACHABLE_THIS_SESSION",
        entity_growth="UNKNOWN_NOT_ZERO",
        intelligence_growth="NONE",
    ),
    src(
        source_id="az-local-exception",
        hub_home="ASK",
        source_family="local_backlog",
        source_name="Arizona city/county permits and local licenses",
        regulator="cities / counties (out of scope)",
        source_url=None,
        access_class="OUT_OF_SCOPE",
        identity_bar="NONE",
        grain="local",
        record_count=0,
        count_notes=(
            "No Austin-class (~2.37M permits with contractor identity/contact), Los Angeles-class "
            "exact-license permit bulk, or San Francisco-class giant license/permit graph was found "
            "for Phoenix, Tucson, Mesa, Scottsdale, or Maricopa/Pima counties in this bounded "
            "state-level pass. 0 is 'no extraordinary local candidate recorded,' not 'zero local "
            "records exist.' ARIZONA_LOCAL_PHASE=NO. Do not start local Arizona."
        ),
        hub_value=hub(),
        value_scores=scores(),
        acquisition_status="SKIPPED_LOCAL_PHASE_NO",
        entity_growth="NOT_STARTED",
        intelligence_growth="NONE",
        recommended_next_action="Do not start Phoenix / Maricopa / Tucson / Pima.",
    ),
]


PRINCIPLES = [
    "STATE_LEVEL_ONLY",
    "missing_source_is_not_zero",
    "SEARCH_ONLY_is_not_zero",
    "UNKNOWN_is_not_zero",
    "license_row_is_not_unique_company",
    "data_row_is_not_entity_growth",
    "HMDA_is_not_license_roster",
    "HMDA_applications_are_not_lender_companies",
    "ACC_business_registration_is_not_professional_license",
    "ROC_R22_is_not_household_goods",
    "ARIZONA_HAS_NO_STATEWIDE_MOVER_LICENSE",
    "hostage_load_statute_is_not_a_roster",
    "STATE_AUTHORITY_does_not_exist_for_AZ_HHG",
    "USDOT_is_not_interstate_authority_by_itself",
    "FMCSA_census_AZ_physical_is_not_movers",
    "HQ_is_not_service_territory",
    "producer_is_not_agency",
    "agency_is_not_insurer",
    "NPN_person_is_not_business_profile",
    "SBS_Lookup_is_free_Report_Generator_is_paid",
    "do_not_buy_SBS_reports",
    "NMLS_is_search_only",
    "Loan_Originator_is_a_person_credential",
    "AZ_principal_office_is_not_ACC_state_IA_registration",
    "CRD_is_not_current_AZ_authority_by_itself",
    "IARD_overlay_is_not_new_companies",
    "CMS_is_not_Arizona_state_facility_identity",
    "do_not_scrape_search_portals",
    "do_not_PRA",
    "do_not_start_local_Arizona",
    "do_not_duplicate_ROC",
    "do_not_redo_Senior",
    "do_not_publish_Ask_arizona_this_ticket",
    "no_trust_score",
    "no_paid_ranking",
    "no_unsafe_adverse_attach",
    "person_credential_is_not_business_profile",
    "complaint_is_not_violation",
]


def main_manifest() -> dict:
    return {
        "ticket": TICKET,
        "state": "AZ",
        "scope": "STATE_LEVEL_ONLY",
        "source_as_of": CHECKED,
        "last_checked": CHECKED,
        "arizona_local_phase": "NO",
        "ask_arizona_publish": False,
        "publication": {
            "public_arizona_routes": False,
            "sitemap_changes": False,
            "trust_score": False,
            "paid_ranking": False,
            "people_publication": False,
            "county_work": False,
            "city_work": False,
            "specialist_repo_edits": False,
            "specialist_page_edits": False,
            "sbs_purchase": False,
            "pra_request": False,
            "nmls_scrape": False,
            "search_portal_scrape": False,
        },
        "principles": PRINCIPLES,
        "where_actual_companies_can_be_added": {
            "contractor": "IN_FLIGHT AZ-CON-001 (Ask az_roc license rows=58408; rows ≠ companies). Do not duplicate.",
            "senior": "ALREADY_DONE AZ-SEN-001 (net-new canonical=0; state identities=2776).",
            "move": "NONE from a state roster (NO_STATE_ROSTER). FMCSA overlay enriches existing 5022; AZ HQ UNKNOWN.",
            "insurance": "ONLY via paid SBS Report Generator ($0.03/row, $30 min). Not this ticket. Lookup cannot bulk.",
            "lender": "NONE from free bulk. NMLS search-only. HMDA is applications not companies.",
            "investor": (
                "IARD overlay = ZERO net-new canonical (existing 25777; 213 AZ principal-office already "
                "counted). ACC securities CSV by PRA could add state-RIA/BD identities including some "
                "not in SEC IARD — UNKNOWN, not this ticket."
            ),
            "acc_ecorp": "PRA bulk of all AZ entities is the wrong universe for specialist hubs. Not this ticket.",
        },
        "sources": SOURCES,
    }


def hub_manifest(hub_name: str, source_ids: list[str]) -> dict:
    chosen = [s for s in SOURCES if s["source_id"] in source_ids]
    return {
        "ticket": TICKET,
        "hub": hub_name,
        "state": "AZ",
        "source_as_of": CHECKED,
        "source_ids": source_ids,
        "sources": chosen,
    }


def expansion_ledger() -> dict:
    return {
        "ticket": TICKET,
        "checked": CHECKED,
        "note": (
            "POTENTIAL_* is a planning bound, not an ingest. UNKNOWN means the number was not obtained. "
            "UNKNOWN ≠ 0. License rows ≠ companies. Data rows ≠ entity growth. "
            "NEW_SOURCE_IDENTITIES_ACQUIRED is 0 for every remaining hub this ticket — nothing bulk-ingested."
        ),
        "semantics": {
            "CANONICAL_ORGANIZATION": "deduped company in a specialist graph",
            "STATE_IDENTITY": "Arizona-issued license / registration identifier",
            "LICENSE_ROW": "one credential row; a company may have many",
            "EVIDENCE_ROW": "enforcement, exam, overlay, or market observation attached to an identity",
            "MARKET_OBSERVATION": "HMDA applications etc. — not companies",
            "SEARCH_RESULT": "not a roster",
            "AGGREGATE": "published total that is not a harvestable list",
        },
        "hubs": {
            "MOVE": {
                "PRE_EXISTING_CANONICAL_ORGANIZATIONS": {
                    "national_publishable": 5022,
                    "arizona_hq": U,
                    "note": "FL HQ 483 / NJ HQ 269 / CA HQ 403 are partitioned; AZ HQ is not.",
                },
                "PRE_EXISTING_STATE_IDENTITIES": 0,
                "NEW_SOURCE_IDENTITIES_ACQUIRED": 0,
                "POTENTIAL_NET_NEW_CANONICAL_ORGANIZATIONS": 0,
                "POTENTIAL_NET_NEW_STATE_IDENTITIES": 0,
                "POTENTIAL_EXISTING_ORGANIZATIONS_ENRICHED": U,
                "POTENTIAL_NEW_EVIDENCE_ROWS": U,
                "proven_zeros": {
                    "POTENTIAL_NET_NEW_CANONICAL_ORGANIZATIONS": "NO_STATE_ROSTER — AG 2025-07-07",
                    "POTENTIAL_NET_NEW_STATE_IDENTITIES": "Arizona does not issue a mover license",
                    "PRE_EXISTING_STATE_IDENTITIES": "no AZ HHG identity exists to have been ingested",
                },
                "do_not_call_companies": {
                    "fmcsa_az_phy_all": 60519,
                    "fmcsa_az_phy_active": 31875,
                    "reason": "all motor carriers, not household-goods movers",
                },
                "classification": "NO_ENTITY_GROWTH_INTELLIGENCE_ONLY",
            },
            "INSURANCE": {
                "PRE_EXISTING_CANONICAL_ORGANIZATIONS": {
                    "national_agencies": 82071,
                    "national_legal_insurers": 6185,
                    "arizona_partition": U,
                    "note": "credentialsByJurisdiction has no AZ key.",
                },
                "PRE_EXISTING_STATE_IDENTITIES": 0,
                "NEW_SOURCE_IDENTITIES_ACQUIRED": 0,
                "POTENTIAL_NET_NEW_CANONICAL_ORGANIZATIONS": U,
                "POTENTIAL_NET_NEW_STATE_IDENTITIES": U,
                "POTENTIAL_EXISTING_ORGANIZATIONS_ENRICHED": U,
                "POTENTIAL_NEW_EVIDENCE_ROWS": U,
                "blocker": "SBS Report Generator $0.03/row, $30 minimum, CSV. Paid. Not purchased.",
                "classification": "ENTITY_GROWTH_BLOCKED_PAID__INTELLIGENCE_THIN_SEARCH",
            },
            "LENDER": {
                "PRE_EXISTING_CANONICAL_ORGANIZATIONS": U,
                "PRE_EXISTING_STATE_IDENTITIES": 0,
                "NEW_SOURCE_IDENTITIES_ACQUIRED": 0,
                "POTENTIAL_NET_NEW_CANONICAL_ORGANIZATIONS": U,
                "POTENTIAL_NET_NEW_STATE_IDENTITIES": U,
                "POTENTIAL_EXISTING_ORGANIZATIONS_ENRICHED": U,
                "POTENTIAL_NEW_EVIDENCE_ROWS": {
                    "hmda_applications_ask_fallback": 307379,
                    "hmda_applications_lender_slice": 308338,
                    "hmda_originations": 183374,
                    "hmda_denials_ask_fallback": 49376,
                    "hmda_denials_lender_slice": 49721,
                    "hmda_counties": 15,
                    "hmda_lei_state_rows": 953,
                    "hmda_high_confidence_lei_maps": 123,
                    "note": "Already acquired market observations. Not lender companies. Not new evidence this ticket. Do not convert 953 LEIs into organizations.",
                },
                "blocker": "NMLS Consumer Access is search-only. Do not scrape.",
                "classification": "INTELLIGENCE_GROWTH_HEAVY",
            },
            "INVESTOR": {
                "PRE_EXISTING_CANONICAL_ORGANIZATIONS": {
                    "national_canonical_firms": 25777,
                    "ria_facts": 17018,
                    "arizona_principal_office": 213,
                    "note": "213 is Arizona principal-office overlay, not Arizona state registration. CA 2699 / NJ 438 are Ask-published partitions.",
                },
                "PRE_EXISTING_STATE_IDENTITIES": 0,
                "NEW_SOURCE_IDENTITIES_ACQUIRED": 0,
                "POTENTIAL_NET_NEW_CANONICAL_ORGANIZATIONS": {
                    "from_iard_overlay": 0,
                    "from_acc_pra_list": U,
                },
                "POTENTIAL_NET_NEW_STATE_IDENTITIES": {
                    "from_iard_overlay": 0,
                    "from_acc_pra_list": U,
                    "note": "IARD CRD is federal identity, not Arizona state registration. ACC CSV would be the state identity.",
                },
                "POTENTIAL_EXISTING_ORGANIZATIONS_ENRICHED": 213,
                "POTENTIAL_NEW_EVIDENCE_ROWS": U,
                "blocker": "ACC firm lists are SOURCE_AVAILABLE_BY_REQUEST. PRA not filed.",
                "classification": "MIXED_ENTITY_AND_INTELLIGENCE",
            },
            "CONTRACTOR": {
                "PRE_EXISTING_CANONICAL_ORGANIZATIONS": U,
                "PRE_EXISTING_STATE_IDENTITIES": {
                    "az_roc_license_rows_in_ask_metrics": 58408,
                    "az_con_001_distinct_license_no": 58131,
                    "note": "Two clocks, not reconciled. License rows ≠ unique companies. Owned by AZ-CON-001.",
                },
                "NEW_SOURCE_IDENTITIES_ACQUIRED": 0,
                "POTENTIAL_NET_NEW_CANONICAL_ORGANIZATIONS": U,
                "POTENTIAL_NET_NEW_STATE_IDENTITIES": U,
                "POTENTIAL_EXISTING_ORGANIZATIONS_ENRICHED": U,
                "POTENTIAL_NEW_EVIDENCE_ROWS": U,
                "classification": "OWNED_BY_AZ_CON_001_DO_NOT_DUPLICATE",
            },
            "SENIOR": {
                "PRE_EXISTING_CANONICAL_ORGANIZATIONS": {
                    "cms_nursing_homes": 140,
                    "cms_home_health": 177,
                    "cms_hospice": 237,
                    "note": "CMS overlay already in Ask; canonical net-new from AZ-SEN-001 = 0.",
                },
                "PRE_EXISTING_STATE_IDENTITIES": 2776,
                "NEW_SOURCE_IDENTITIES_ACQUIRED": 0,
                "POTENTIAL_NET_NEW_CANONICAL_ORGANIZATIONS": 0,
                "POTENTIAL_NET_NEW_STATE_IDENTITIES": 0,
                "POTENTIAL_EXISTING_ORGANIZATIONS_ENRICHED": 0,
                "POTENTIAL_NEW_EVIDENCE_ROWS": 0,
                "accepted_az_sen_001": {
                    "NET_NEW_CANONICAL_ORGANIZATIONS": 0,
                    "NET_NEW_STATE_IDENTITIES": 2776,
                    "EXISTING_ORGANIZATIONS_ENRICHED": 544,
                    "NEW_EVIDENCE_ROWS": 2779,
                },
                "classification": "ALREADY_SHIPPED_DO_NOT_REDO",
            },
        },
    }


def value_matrix() -> dict:
    return {
        "ticket": TICKET,
        "note": "Internal prioritization, not a consumer ranking. No Trust Score. No paid ranking. HIGH/MEDIUM/LOW/NONE only.",
        "arizona_finish_fast": (
            "Remaining Arizona specialist work is intelligence pages on existing graphs plus thin "
            "consumer-truth pages. There is no remaining free bulk that adds actual companies."
        ),
        "hub_early_candidates_evaluated": {
            "CONTRACTOR": "ALREADY_ASSIGNED AZ-CON-001 — only in-flight free bulk identity path",
            "SENIOR": "ALREADY_SHIPPED AZ-SEN-001",
            "INVESTOR": "MEDIUM entity potential (ACC CSV by PRA only); HIGH intelligence from existing 213 AZ principal-office overlay",
            "LENDER": "HIGH intelligence/hour — HMDA already in hand (15 counties, 183374 originations, 953 LEIs); ZERO new companies",
            "INSURANCE": "LOW as an entity play (paid SBS); MEDIUM as a thin search/enforcement page",
            "MOVE": "LOW as an entity play (NO_STATE_ROSTER); MEDIUM as a consumer-truth page",
        },
        "sources": [
            {
                "source_id": s["source_id"],
                "hub_value": s["hub_value"],
                "scores": s["value_scores"],
                "access_class": s["access_class"],
                "entity_growth": s.get("entity_growth"),
                "intelligence_growth": s.get("intelligence_growth"),
            }
            for s in SOURCES
        ],
    }


def build_order() -> dict:
    return {
        "ticket": TICKET,
        "arizona_local_phase": "NO",
        "ask_arizona": "ATH-AZ-002 after specialist pages are sufficiently complete. Not this ticket.",
        "already_closed_or_in_flight": [
            {
                "ticket": "AZ-SEN-001",
                "repo": "care-trust-hub",
                "status": "CLOSED",
                "note": "Live https://www.seniortrusthub.com/arizona",
            },
            {
                "ticket": "AZ-CON-001",
                "repo": "contractor-trust-hub",
                "status": "IN_FLIGHT_BUILDER_3",
                "note": "Do not duplicate ROC.",
            },
        ],
        "remaining_specialist_order": [
            {
                "order": 1,
                "ticket": "AZ-LEND-001",
                "repo": "lender-trust-hub",
                "recommended_owner": "Builder 4",
                "when": "NOW_PARALLEL_WITH_AZ_CON_001",
                "why": "Highest remaining value-per-hour. Canonical HMDA Arizona partition already exists (15 counties, 183,374 originations, 953 LEIs). Live company roster is NMLS search-only. Intelligence, not entities.",
            },
            {
                "order": 2,
                "ticket": "AZ-INV-001",
                "repo": "investor-trust-hub",
                "recommended_owner": "Builder 3 after AZ-CON-001",
                "when": "AFTER_AZ_CON_001",
                "why": "Only remaining hub with a real Arizona state-registration business CSV (ACC by request). Pair with existing 213 principal-office overlay. Do not file PRA unless owner authorizes. Overlay itself is ZERO net-new canonical.",
            },
            {
                "order": 3,
                "ticket": "AZ-INS-001",
                "repo": "insurance-trust-hub",
                "why": "Thin DIFI/SBS search path + enforcement identity rules. Do not buy SBS.",
            },
            {
                "order": 4,
                "ticket": "AZ-MOVE-001",
                "repo": "move-trust-hub",
                "why": "Thin AG/DPS consumer path + optional AZ HQ overlay of existing 5022. No state roster.",
            },
            {
                "order": 5,
                "ticket": "ATH-AZ-002",
                "repo": "Conumers-Trust-Hub",
                "why": "Ask /arizona only after the four specialist pages exist. Not this ticket.",
            },
        ],
        "builder_3_next_after_az_con_001": {
            "ticket": "AZ-INV-001",
            "repo": "investor-trust-hub",
            "why": "Only remaining plausible state-registration entity path (ACC CSV by request) plus a ready 213-firm IARD overlay. Do not PRA unless owner authorizes.",
        },
        "builder_4_next": {
            "ticket": "AZ-LEND-001",
            "repo": "lender-trust-hub",
            "why": "Ready now, parallel with AZ-CON-001. HMDA already in hand. Highest remaining intelligence per hour.",
        },
        "what_the_files_actually_support": (
            "Lender first among remaining hubs because HMDA is already in hand (intelligence, not entity growth). "
            "Investor second because it is the only remaining entity-growth path, and it is request-gated. "
            "Insurance third because the roster is paid. Move last because there is no state company identity to add."
        ),
    }


def acquisition_summary() -> dict:
    return {
        "ticket": TICKET,
        "checked": CHECKED,
        "acquired_this_ticket": [],
        "counted_not_dumped": [
            {
                "source_id": "az-fmcsa-mcmis-census-az-physical",
                "rows": 60519,
                "active": 31875,
                "note": "all motor carriers, not HHG; not ingested",
            },
            {
                "source_id": "az-hmda-cfpb-overlay",
                "applications_ask_fallback": 307379,
                "applications_lender_slice": 308338,
                "originations": 183374,
                "denials_ask_fallback": 49376,
                "denials_lender_slice": 49721,
                "counties": 15,
                "lei_state_rows": 953,
                "note": "already in Ask + Lender-Trust-Hub slice; market observation",
            },
            {
                "source_id": "az-roc-contractor-pointer",
                "license_rows_ask_metrics": 58408,
                "distinct_license_no_az_con_001": 58131,
                "note": "Ask metrics vs AZ-CON-001 current-contractor profile; owned by AZ-CON-001",
            },
            {
                "source_id": "az-sec-iard-principal-office-overlay",
                "arizona_principal_office": 213,
                "national_canonical_firms": 25777,
                "note": "existing Investor census; not AZ state registration",
            },
            {
                "source_id": "az-senior-cms-and-state-pointer",
                "cms_nursing_homes": 140,
                "cms_home_health": 177,
                "cms_hospice": 237,
                "net_new_state_identities_az_sen_001": 2776,
            },
        ],
        "probes": {
            "acc_pages": "HTTP 200",
            "difi_and_sbs": "HTTP 403 Cloudflare",
            "data_az_gov": "HTTP 0 / getaddrinfo failed",
            "dps_moving": "HTTP 404",
            "roc_posting_list": "HTTP 403",
            "senior_arizona": "HTTP 200",
        },
        "not_acquired": [
            "SBS Report Generator (paid $0.03/row, $30 minimum)",
            "SBS Lookup scrape",
            "NMLS Consumer Access scrape",
            "ACC eCorp bulk (PRA)",
            "ACC Securities dealer/IA lists (PRA)",
            "DIFI enforcement HTML scrape",
            "ACC Securities enforcement HTML scrape",
            "DIFI market-conduct PDF crawl",
            "FMCSA MCMIS full AZ census ingest",
            "SAFER / FMCSA HHG search scrape",
            "data.az.gov catalog (unreachable this session)",
            "ROC contractor files (owned by AZ-CON-001)",
            "Senior state/CMS redo (owned by AZ-SEN-001)",
            "Phoenix / Tucson / Mesa / Scottsdale / Maricopa / Pima local permits",
            "Ask /arizona publication",
        ],
        "paid_report": {
            "source_id": "az-sbs-report-generator",
            "price_per_row_usd": 0.03,
            "minimum_usd": 30.00,
            "format": "CSV",
            "purchased": False,
        },
        "arizona_local_phase": "NO",
    }


def identity_map() -> dict:
    return {
        "ticket": TICKET,
        "bars": {
            "EXACT": (
                "official identifier match (ROC license, NPN, NAIC, NMLS, CRD, USDOT, ACC entity ID, "
                "CMS CCN, Arizona state facility identity)"
            ),
            "HIGH_CONFIDENCE": "exact legal name + exact official government business address, or an approved deterministic crosswalk",
            "REVIEW_REQUIRED": "name + city; DBA; person/company ambiguity; HMDA respondent to NMLS",
            "UNSAFE": "name alone; phone alone; search-engine matching",
        },
        "rules": [
            "Do not collapse unrelated IDs.",
            "ACC entity ID != ROC != NPN != NAIC != NMLS != CRD != USDOT != CMS CCN.",
            "Never auto-attach adverse evidence from unsafe identity.",
            "Preserve unmatched official evidence.",
            "Person NPN / CRD / NMLS Loan Originator is not a business profile.",
            "Arizona principal office != ACC state IA registration.",
            "CRD != current Arizona authority by itself.",
            "USDOT != interstate authority by itself.",
            "ROC R-22 != household goods.",
            "HMDA LEI != DIFI / NMLS license.",
            "FMCSA census row != mover.",
        ],
        "exact_ids": [
            {"id": "ROC license number", "source_ids": ["az-roc-contractor-pointer", "az-roc-r22-house-moving"]},
            {"id": "NPN", "source_ids": ["az-difi-license-search", "az-sbs-lookup", "az-sbs-report-generator", "az-difi-enforcement-actions"]},
            {"id": "NAIC", "source_ids": ["az-difi-license-search", "az-sbs-lookup", "az-difi-enforcement-actions"]},
            {"id": "NMLS ID", "source_ids": ["az-difi-mortgage-lending", "az-nmls-consumer-access"]},
            {"id": "CRD", "source_ids": ["az-acc-securities-research", "az-acc-securities-list-request", "az-sec-iard-principal-office-overlay", "az-acc-securities-enforcement"]},
            {"id": "USDOT", "source_ids": ["az-fmcsa-mcmis-census-az-physical", "az-move-national-directory-overlay"]},
            {"id": "ACC entity ID", "source_ids": ["az-acc-ecorp-entity-search", "az-acc-ecorp-bulk-request"]},
            {"id": "CMS CCN", "source_ids": ["az-senior-cms-and-state-pointer"]},
        ],
        "do_not_collapse": [
            ["ROC", "ACC entity ID"],
            ["ROC R-22", "household goods mover"],
            ["USDOT", "Arizona state mover license"],
            ["NPN", "NAIC"],
            ["producer", "agency"],
            ["agency", "insurer"],
            ["NMLS company", "NMLS Loan Originator"],
            ["NMLS", "HMDA LEI"],
            ["CRD", "Arizona IA registration"],
            ["SEC IARD principal office", "ACC state registration"],
            ["CMS CCN", "Arizona state facility identity"],
            ["FMCSA census AZ physical", "household goods mover"],
        ],
    }


def contact_summary() -> dict:
    return {
        "ticket": TICKET,
        "rank_order": ["OFFICIAL_REGULATOR", "OFFICIAL_STATE_BUSINESS", "FEDERAL_OVERLAY"],
        "rules": [
            "Do not overwrite stronger contact provenance with a weaker source.",
            "No person-scale publishing decisions in Ask this ticket.",
            "SBS paid report would include business address and email — not purchased.",
            "No free official contact bulk was acquired for Move, Insurance, Lender, or Investor.",
            "ACC eCorp addresses do not replace ROC / DIFI / NMLS / CRD regulator contacts.",
        ],
        "strongest_contact_files": [],
        "note": "No official contact bulk acquired this ticket. Paid SBS email/address is the strongest blocked contact file.",
        "blocked_strongest": {
            "source_id": "az-sbs-report-generator",
            "email": "present in paid CSV",
            "address": "full business address in paid CSV",
            "purchased": False,
        },
    }


def cross_hub() -> dict:
    return {
        "ticket": TICKET,
        "note": "Statewide sources live once. Do not duplicate per hub. Arizona counties and cities are out of scope.",
        "acc_entity_id_cross_hub": {
            "key": "ACC entity ID",
            "appears_in": ["eCorp", "possibly ROC / DIFI when a company also registered"],
            "rule": "ACC entity ID != professional license. An active corporation is not an active ROC/DIFI/NMLS/CRD credential.",
        },
        "sources": [
            {"source_id": s["source_id"], "access": s["access_class"], "hub_home": s["hub_home"]}
            for s in SOURCES
        ],
    }


FIXTURES = {
    "move/fixtures/ag-no-license-note.json": {
        "ticket": TICKET,
        "source_id": "az-ag-mover-no-license",
        "last_checked": CHECKED,
        "regulator": "Arizona Attorney General",
        "quote": "Arizona does not have a registration law or a professional licensing requirement for movers.",
        "quote_url": "https://www.azag.gov/press-release/attorney-general-mayes-and-bbb-warn-moving-scams-arizona-0",
        "quote_date": "2025-07-07",
        "statute": "A.R.S. §§ 44-1611 to 44-1616",
        "statute_is": "hostage-load consumer protection, not a license roster",
        "dps_hotline": ["602-223-2212", "602-223-5000"],
        "statewide_hhg_roster": False,
        "record_count": 0,
        "do_not_confuse": [
            "ACC eCorp != mover license",
            "ROC R-22 house moving != household goods",
            "USDOT != interstate authority by itself",
            "FMCSA AZ physical census != movers",
            "HQ != service territory",
        ],
    },
    "insurance/fixtures/sbs-paid-report-note.json": {
        "ticket": TICKET,
        "source_id": "az-sbs-report-generator",
        "last_checked": CHECKED,
        "lookup_free": True,
        "report_generator_paid": True,
        "price_per_row_usd": 0.03,
        "minimum_usd": 30.0,
        "format": "CSV",
        "purchased": False,
        "access_class": "OPEN_REPORT_GENERATOR_PAID",
        "support_url": "https://www.statebasedsystems.com/solar/support.html",
        "fields_include": [
            "license number",
            "license type",
            "license status",
            "CE compliance",
            "full business address",
            "email",
            "line of authority",
        ],
        "grain": "license_row_mixed_person_and_business",
        "producer_bulk": False,
        "agency_bulk": False,
        "insurer_bulk": False,
        "note": "License row != unique company. Do not buy.",
    },
    "lender/fixtures/hmda-az-already-acquired.json": {
        "ticket": TICKET,
        "source_id": "az-hmda-cfpb-overlay",
        "last_checked": CHECKED,
        "state": "AZ",
        "applications": 307379,
        "originations": 183374,
        "denials": 49376,
        "lender_hub_slice": {
            "counties": 15,
            "applications": 308338,
            "originations": 183374,
            "denials": 49721,
            "lei_state_rows": 953,
            "high_confidence_lei_maps": 123,
        },
        "grain": "mortgage_application",
        "is_lender_company_roster": False,
        "already_in_ask": True,
        "ask_file": "data/network-metrics/lender-v1-fallback.json",
        "nmls_bulk": False,
        "nmls_access": "OPEN_SEARCH_ONLY",
    },
    "investor/fixtures/iard-overlay-note.json": {
        "ticket": TICKET,
        "source_id": "az-sec-iard-principal-office-overlay",
        "last_checked": CHECKED,
        "dataset": "IA_FIRM_SEC_Feed_08_27_2026",
        "canonical_firms": 25777,
        "ria_facts": 17018,
        "era_facts": 6604,
        "arizona_principal_office": 213,
        "published_partitions": {"CA": 2699, "NJ": 438},
        "net_new_canonical_from_overlay": 0,
        "az_principal_office_is_not_state_registration": True,
        "acc_list_access": "SOURCE_AVAILABLE_BY_REQUEST",
        "pra_filed": False,
        "crd_is_not_current_az_authority": True,
    },
    "contractor/fixtures/roc-owned-by-az-con-001.json": {
        "ticket": TICKET,
        "source_id": "az-roc-contractor-pointer",
        "owned_by": "AZ-CON-001",
        "repo": "contractor-trust-hub",
        "az_roc_license_rows_in_ask_metrics": 58408,
        "license_row_is_not_unique_company": True,
        "acquired_this_ticket": False,
        "r22_is_not_household_goods": True,
    },
    "senior/fixtures/az-sen-001-accepted-ledger.json": {
        "ticket": TICKET,
        "source_id": "az-senior-cms-and-state-pointer",
        "owned_by": "AZ-SEN-001",
        "live_url": "https://www.seniortrusthub.com/arizona",
        "cms_nursing_homes": 140,
        "cms_home_health": 177,
        "cms_hospice": 237,
        "NET_NEW_CANONICAL_ORGANIZATIONS": 0,
        "NET_NEW_STATE_IDENTITIES": 2776,
        "EXISTING_ORGANIZATIONS_ENRICHED": 544,
        "NEW_EVIDENCE_ROWS": 2779,
        "redo": False,
    },
}


HUB_IDS = {
    "move": [
        "az-ag-mover-no-license",
        "az-ars-hostage-load",
        "az-dps-hostage-load-hotline",
        "az-roc-r22-house-moving",
        "az-fmcsa-mcmis-census-az-physical",
        "az-move-national-directory-overlay",
    ],
    "insurance": [
        "az-difi-license-search",
        "az-sbs-lookup",
        "az-sbs-report-generator",
        "az-difi-enforcement-actions",
        "az-difi-market-conduct",
        "az-insurance-national-graph",
    ],
    "lender": [
        "az-difi-mortgage-lending",
        "az-nmls-consumer-access",
        "az-difi-financial-enterprises",
        "az-hmda-cfpb-overlay",
    ],
    "investor": [
        "az-acc-securities-research",
        "az-acc-securities-list-request",
        "az-acc-securities-enforcement",
        "az-sec-iard-principal-office-overlay",
    ],
    "contractor": ["az-roc-contractor-pointer", "az-roc-r22-house-moving"],
    "senior": ["az-senior-cms-and-state-pointer"],
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    dump(OUT / "source-manifest.json", main_manifest())
    dump(OUT / "identity-source-map.json", identity_map())
    dump(OUT / "expansion-ledger-blueprint.json", expansion_ledger())
    dump(OUT / "value-per-hour-matrix.json", value_matrix())
    dump(OUT / "build-order.json", build_order())
    dump(OUT / "acquisition-summary.json", acquisition_summary())
    dump(OUT / "contact-source-summary.json", contact_summary())
    dump(OUT / "cross-hub-source-map.json", cross_hub())
    for hub_name, ids in HUB_IDS.items():
        dump(OUT / hub_name / "source-manifest.json", hub_manifest(hub_name, ids))
    for rel, obj in FIXTURES.items():
        dump(OUT / rel, obj)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
