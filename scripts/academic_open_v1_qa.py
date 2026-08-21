"""Shared Open V1 QA helpers. Pattern scans are an aid, not a privacy proof."""

from __future__ import annotations

import re

EXPECTED_SHA256 = {
    "facilities": "0f80bd6de62d730564ef0752093d0aa0eb5cce50b893a3479cbbe24618c29500",
    "facility_ratings": "ce478ffb65e9c79a20386c44dff8d56000dd8ebdc78054e59bad8a35fa6adeae",
    "facility_inspections": "6dde19dc14340243fcb6e47a6a73cff39a938a3f760042b85c3e4ee834ab1e9d",
    "facility_deficiencies": "8508973f96c41675b7d3cef9b3d0ae15a06d9c10777fc9cbe3ab33fa9bdc6518",
    "facility_enforcement": "6dc59645b0f3dc7cd5002ff02914bedbccf33625f12e68a9b3d536ac152cbab1",
    "facility_chains": "3ff7813392d4b5c5bd663a6355b25aae8e2ad853820337b870079c76a005b0ac",
    "sources": "c6cbac583515977df54d9972fac631f04e3a6a463003deb7fac9b08c56e2fc35",
}

EXPECTED_ROWS = {
    "facilities": 14693,
    "facility_ratings": 14693,
    "facility_inspections": 149705,
    "facility_deficiencies": 418344,
    "facility_enforcement": 16166,
    "facility_chains": 10231,
    "sources": 5,
}

EMAIL_RE = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I)
SSN_RE = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
GOOGLE_URL_RE = re.compile(r"googleapis\.com|googleusercontent\.com|maps\.google", re.I)
PLACE_RE = re.compile(r"\bChIJ[A-Za-z0-9_-]{20,}\b")
HTTP_RE = re.compile(r"https?://", re.I)
DOB_LABEL_RE = re.compile(r"\b(d\.?o\.?b\.?|date of birth|birth ?date|born on)\b", re.I)
MRN_LABEL_RE = re.compile(
    r"\b(medical record( number)?|mrn|patient identifier|patient id|resident identifier|resident id)\b",
    re.I,
)
PHONE_RE = re.compile(
    r"(?<!\d)(?:\+?1[\s.\-]?)?(?:\(?\d{3}\)?[\s.\-])\d{3}[\s.\-]\d{4}(?!\d)"
)

ALLOWED_URL_FIELDS = {"official_landing_url"}
SKIP_PHONE_FIELDS = {
    "ccn",
    "zip_code",
    "certified_beds",
    "overall_rating",
    "health_inspection_rating",
    "staffing_rating",
    "quality_measure_rating",
    "survey_cycle",
    "inspection_cycle",
    "deficiency_tag",
    "fine_amount",
    "fine_id",
    "enrollment_id",
    "academic_inspection_id",
    "academic_deficiency_id",
    "academic_enforcement_id",
    "content_sha256",
    "source_record_locator",
    "rows_read",
    "valid_rows",
    "rejected_rows",
    "survey_date",
    "processing_date",
    "correction_date",
    "penalty_date",
    "payment_denial_start_date",
    "source_modified_at",
    "retrieved_at",
    "ingest_completed_at",
    "source_release_date",
}

CRITICAL_KINDS = {
    "email",
    "ssn",
    "google_place",
    "google_url",
    "unexpected_url",
    "dob_labeled",
    "medical_record_label",
}

REVIEW_KINDS = {"phone_like"}


def scan_field(table: str, field: str, value: str) -> list[str]:
    if not value:
        return []
    found: list[str] = []
    if EMAIL_RE.search(value):
        found.append("email")
    if SSN_RE.search(value):
        found.append("ssn")
    if GOOGLE_URL_RE.search(value):
        found.append("google_url")
    if PLACE_RE.search(value):
        found.append("google_place")
    if field not in ALLOWED_URL_FIELDS and HTTP_RE.search(value):
        found.append("unexpected_url")
    if field not in SKIP_PHONE_FIELDS and DOB_LABEL_RE.search(value):
        found.append("dob_labeled")
    if MRN_LABEL_RE.search(value):
        found.append("medical_record_label")
    if field not in SKIP_PHONE_FIELDS and field != "official_description" and PHONE_RE.search(value):
        found.append("phone_like")
    elif field == "official_description" and PHONE_RE.search(value):
        found.append("phone_like")
    return found


def is_critical(kinds: list[str]) -> bool:
    return any(k in CRITICAL_KINDS for k in kinds)
