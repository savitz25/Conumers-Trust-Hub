"""Hash New York publication manifest, excluding volatile verification clocks."""
from __future__ import annotations

import hashlib
import json
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path

root = Path(__file__).resolve().parents[1]
VOLATILE = {
    "verified_at",
    "verifiedAt",
    "generated_at",
    "generatedAt",
    "live_route_verified_at",
    "live_route_verifiedAt",
}


def strip(obj):
    if isinstance(obj, dict):
        return {k: strip(v) for k, v in sorted(obj.items()) if k not in VOLATILE}
    if isinstance(obj, list):
        return [strip(x) for x in obj]
    return obj


def fingerprint(manifest: dict) -> str:
    canonical = json.dumps(strip(manifest), sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


manifest = json.loads((root / "data/network/new-york-publication-manifest.json").read_text(encoding="utf-8"))
verification = json.loads((root / "data/network/new-york-verification.json").read_text(encoding="utf-8"))
closeout_path = root / "data/network/new-york/state-closeout.json"
closeout = json.loads(closeout_path.read_text(encoding="utf-8"))

first = fingerprint(manifest)
mutated_clock = deepcopy(manifest)
mutated_clock["release_gate"]["verified_at"] = "2099-01-01T00:00:00.000Z"
second = fingerprint(mutated_clock)
if first != second:
    raise SystemExit("generation/verification clocks must be excluded from the semantic hash")

nested = deepcopy(manifest)
nested["hub_expansion_ledgers"]["move"]["hhgApplicationObservations"] = 109
if fingerprint(nested) == first:
    raise SystemExit("nested grain mutation must change the semantic hash")

fp = first
closeout["publication_manifest_fingerprint"] = fp
closeout_path.write_text(json.dumps(closeout, indent=2) + "\n", encoding="utf-8")

release = {
    "ticket": "ATH-NY-NET-001",
    "version": "ath-ny-network-release-v1",
    "ask_canonical": "https://www.asktrusthub.com/new-york",
    "scope": "STATE_LEVEL_ONLY",
    "hardcoded_county_routes": False,
    "hardcoded_nyc_routes": False,
    "new_york_local_phase": "APPROVED_AFTER_STATEWIDE_CLOSEOUT",
    "new_york_local_phase_status": "NOT_STARTED",
    "trust_score": False,
    "paid_ranking": False,
    "status": "ASK_PREVIEW_READY",
    "ask_production": None,
    "release_gate_passed": True,
    "specialist_hubs": [
        {
            "hub_id": h["hub_id"],
            "canonical_state_url": h["canonical_state_url"],
            "publication_status": h["publication_status"],
            "snapshot_version": h["snapshot_version"],
            "fingerprint": h["fingerprint"],
            "certified_release_sha": h["certified_release_sha"],
            "source_clock": h["source_clock"],
        }
        for h in manifest["hubs"]
    ],
    "verification_hubs": [
        {
            "hub_id": h["hub_id"],
            "http_status": h["http_status"],
            "ok": h["ok"],
            "canonical": h["canonical"],
            "robots": h["robots"],
        }
        for h in verification["hubs"]
    ],
    "network_findings": manifest["what_makes_new_york_different"],
    "conceptual_statement": manifest["conceptual_statement"],
    "local_work_decision": closeout["local_work_decision"],
    "fingerprint": fp,
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "snapshot": "ath-ny-network-release-v1",
    "ask_fingerprint": fp,
}
out = root / "data/releases/new-york-network-release.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(release, indent=2) + "\n", encoding="utf-8")
print(fp)
