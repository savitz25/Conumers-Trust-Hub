import { SPECIALIST_HUB_IDS, type SpecialistHubId } from './registry.ts';
import { allHubManifests } from './adapters.ts';
import {
  validateManifest,
  type ManifestWarning,
  type TrustHubNetworkManifest,
} from './manifest.ts';
import { NAME_IS_NOT_IDENTITY } from './vocabulary.ts';

export type NetworkState = {
  generatedAt: string;
  hubs: TrustHubNetworkManifest[];
  warnings: ManifestWarning[];
  sourceFamilyCount: number;
  sourceOrganizationCount: number;
  regulatorCount: number;
  latestOfficialAsOf: string | null;
  latestRetrievedAt: string | null;
  latestManifestGeneratedAt: string;
};

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function getTrustHubNetworkState(): NetworkState {
  const hubs = allHubManifests();
  const warnings: ManifestWarning[] = [];
  const ids = hubs.map((h) => h.hub.id);
  if (ids.length !== 6) warnings.push({ code: 'hub_count', message: 'Expected six hubs' });
  for (const id of SPECIALIST_HUB_IDS) {
    if (!ids.includes(id as SpecialistHubId)) {
      warnings.push({ code: 'missing_hub', message: `Missing ${id}` });
    }
  }
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) warnings.push({ hubId: id, code: 'dup_hub', message: `Duplicate hub ${id}` });
    seen.add(id);
  }
  for (const hub of hubs) warnings.push(...validateManifest(hub));

  const families = hubs.flatMap((h) => h.sourceFamilies);
  const orgs = unique(families.map((f) => f.sourceOrganization));
  const regulators = unique(
    families.filter((f) => f.organizationKind === 'regulator' && f.regulatorOrAgency).map((f) => f.regulatorOrAgency as string)
  );
  const officialDates = families.map((f) => f.officialAsOf).filter(Boolean) as string[];
  const retrievedDates = families.map((f) => f.retrievedAt).filter(Boolean) as string[];
  officialDates.sort();
  retrievedDates.sort();

  return {
    generatedAt: hubs[0]?.snapshot.generatedAt ?? new Date().toISOString().slice(0, 10),
    hubs,
    warnings,
    sourceFamilyCount: unique(families.map((f) => f.id)).length,
    sourceOrganizationCount: orgs.length,
    regulatorCount: regulators.length,
    latestOfficialAsOf: officialDates.at(-1) ?? null,
    latestRetrievedAt: retrievedDates.at(-1) ?? null,
    latestManifestGeneratedAt: hubs[0]?.snapshot.generatedAt ?? '',
  };
}

export const NETWORK_INVARIANTS = {
  noMegaCount: 'AskTrustHub does not publish a summed network entity or observation total.',
  noTrustScore: 'There is no network Trust Score, grade, or ranking.',
  nameIsNotIdentity: NAME_IS_NOT_IDENTITY,
} as const;
