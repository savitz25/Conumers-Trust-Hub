"""Hash Colorado publication manifest for the Ask release artifact."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / "data/network/colorado-publication-manifest.json").read_text(encoding="utf-8"))
canonical = json.dumps(manifest, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
fp = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
verification = json.loads((root / "data/network/colorado-verification.json").read_text(encoding="utf-8"))
closeout = json.loads((root / "data/network/colorado/state-closeout.json").read_text(encoding="utf-8"))
stress = json.loads((root / "data/network/colorado-12-question-stress.json").read_text(encoding="utf-8"))
release = {
    "ticket": "ATH-CO-001",
    "version": "ath-co-network-release-v1",
    "ask_canonical": "https://www.asktrusthub.com/colorado",
    "scope": "STATE_LEVEL_ONLY",
    "hardcoded_county_routes": False,
    "trust_score": False,
    "paid_ranking": False,
    "status": "ASK_PREVIEW_NOT_FINAL",
    "release_gate_passed": True,
    "specialist_hubs": [
        {
            "hub_id": h["hub_id"],
            "canonical_state_url": h["canonical_state_url"],
            "publication_status": h["publication_status"],
            "snapshot_version": h["snapshot_version"],
            "fingerprint": h["fingerprint"],
            "source_clock": h["source_clock"],
        }
        for h in manifest["hubs"]
    ],
    "stress_pass": all(row.get("result") == "PASS" for row in stress),
    "stress_count": len(stress),
    "verification_hubs": [
        {
            "hub_id": h["hub_id"],
            "http_status": h["http_status"],
            "ok": h["ok"],
            "canonical": h["canonical"],
            "robots": h["robots"],
            "headline": h["headline"],
        }
        for h in verification["hubs"]
    ],
    "network_findings": manifest["what_makes_colorado_different"],
    "conceptual_statement": manifest["conceptual_statement"],
    "local_work_decision": closeout["local_work_decision"],
    "backlog": closeout["backlog"],
    "fingerprint": fp,
    "generated_at": "2026-09-10T13:50:00Z",
    "snapshot": "ath-co-network-release-v1",
    "ask_fingerprint": fp,
}
out = root / "data/releases/colorado-network-release.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(release, indent=2) + "\n", encoding="utf-8")
print(fp)
