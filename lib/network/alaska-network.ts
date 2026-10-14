import manifest from "../../data/network/alaska-publication-manifest.json" with { type: "json" };
import type { SpecialistHubId } from "./registry.ts";

export const AK_PUBLICATION_MANIFEST = manifest;
export const AK_HUBS = [
  "move",
  "contractor",
  "lender",
  "insurance",
  "senior",
  "investor",
] as const;
const EXPECTED_SPECIALIST_URLS: Record<SpecialistHubId, string> = {
  move: "https://www.movetrusthub.com/alaska",
  contractor: "https://www.contractortrusthub.com/alaska",
  lender: "https://www.lendertrusthub.com/alaska",
  insurance: "https://www.insurancetrusthub.com/alaska",
  senior: "https://www.seniortrusthub.com/alaska",
  investor: "https://www.investortrusthub.com/alaska",
};

export function akSpecialistUrl(hub: SpecialistHubId): string {
  return EXPECTED_SPECIALIST_URLS[hub];
}

export function akReleaseGatePassed(value = manifest): boolean {
  return (
    value.state === "Alaska" &&
    value.code === "AK" &&
    value.slug === "alaska" &&
    value.scope === "STATE_LEVEL_ONLY" &&
    value.ask_canonical === "https://www.asktrusthub.com/alaska" &&
    value.hubs.length === 6 &&
    new Set(value.hubs.map((hub) => hub.hub_id)).size === 6 &&
    AK_HUBS.every((hubId) => {
      const hub = value.hubs.find((entry) => entry.hub_id === hubId);
      return (
        hub?.url === akSpecialistUrl(hubId) &&
        hub.production_sha.length === 40 &&
        hub.summary.length > 0 &&
        hub.clock.length > 0 &&
        hub.grain.length > 0 &&
        hub.gap.length > 0 &&
        hub.sources.length > 0 &&
        hub.sources.every(
          (source) =>
            source.url.startsWith("https://") && source.label.length > 0,
        )
      );
    }) &&
    value.publication_limits.cross_hub_record_total === null &&
    value.publication_limits.cross_hub_record_total_status === "REJECTED" &&
    value.publication_limits.ratings === "NOT_ESTABLISHED" &&
    value.publication_limits.trust_score === "NOT_ESTABLISHED" &&
    value.publication_limits.county_or_local_routes === "NONE" &&
    value.publication_limits.claim_eligibility_broadened === false &&
    value.publication_limits.ask_graph_writes === 0
  );
}
