import type { SpecialistHubId } from './registry.ts';
import { browardPlaceLens, palmBeachPlaceLens, type PlaceHubCard } from './place-lens.ts';

export type GeographyRef = {
  type: 'state' | 'county';
  code: string;
  label: string;
};

export type NetworkPlaceComparison = {
  left: GeographyRef;
  right: GeographyRef;
  hubs: Array<{
    hubId: SpecialistHubId;
    comparisonStatus: 'comparable' | 'partial' | 'not_comparable';
    metrics?: Array<{ label: string; note: string }>;
    limitation?: string;
  }>;
};

function card(hubs: PlaceHubCard[], id: SpecialistHubId) {
  return hubs.find((h) => h.hubId === id);
}

/** Broward vs Palm Beach — only equivalent metrics inside the same hub. */
export function compareBrowardPalmBeach(): NetworkPlaceComparison {
  const left = browardPlaceLens();
  const right = palmBeachPlaceLens();
  const ids: SpecialistHubId[] = ['contractor', 'lender', 'insurance', 'move', 'senior', 'investor'];
  return {
    left: { type: 'county', code: 'FL-Broward', label: 'Broward County, Florida' },
    right: { type: 'county', code: 'FL-PalmBeach', label: 'Palm Beach County, Florida' },
    hubs: ids.map((hubId) => {
      const a = card(left.hubs, hubId);
      const b = card(right.hubs, hubId);
      if (hubId === 'contractor') {
        return {
          hubId,
          comparisonStatus: 'comparable' as const,
          metrics: [
            {
              label: 'County Intelligence OS pages',
              note: 'Both counties have dedicated ContractorTrustHub county pages using DBPR mailing/HQ county grain.',
            },
          ],
          limitation:
            'Only HQ/base credential definitions are comparable. Permit volume is not compared. Ask does not copy Broward counts onto Palm Beach.',
        };
      }
      if (hubId === 'move') {
        return {
          hubId,
          comparisonStatus: 'partial' as const,
          limitation:
            'Both have local-movers landings. MoveTrustHub marks both as not Enhanced Local Research. Palm Beach notes internal county credential rows; Broward does not claim a validated county census. That difference is coverage, not quality.',
        };
      }
      const same =
        a?.capability === b?.capability &&
        (a?.metrics.length ?? 0) === 0 &&
        (b?.metrics.length ?? 0) === 0;
      return {
        hubId,
        comparisonStatus: same ? ('not_comparable' as const) : ('partial' as const),
        limitation: `${a?.name ?? hubId} currently has state/federal research for both counties, not comparable county Intelligence OS metrics. Do not compare unlike grains across hubs.`,
      };
    }),
  };
}
