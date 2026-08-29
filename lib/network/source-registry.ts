import { getTrustHubNetworkState } from './aggregator.ts';
import type { ManifestSourceFamily, TrustHubNetworkManifest } from './manifest.ts';

export type NetworkSourceRow = ManifestSourceFamily & {
  hubId: string;
  hubName: string;
};

export function listNetworkSourceRows(): NetworkSourceRow[] {
  const state = getTrustHubNetworkState();
  return state.hubs.flatMap((hub) =>
    hub.sourceFamilies.map((fam) => ({
      ...fam,
      hubId: hub.hub.id,
      hubName: hub.hub.name,
    }))
  );
}

export function publicSourceRegistryPayload() {
  const state = getTrustHubNetworkState();
  return {
    contract: 'trusthub-network-source-registry-v1',
    generatedAt: state.generatedAt,
    sourceFamilyCount: state.sourceFamilyCount,
    sourceOrganizationCount: state.sourceOrganizationCount,
    regulatorOrAgencyCount: state.regulatorCount,
    note: 'Source-family, source-organization, and regulator counts are separate. Do not add them.',
    families: listNetworkSourceRows().map((row) => ({
      hubId: row.hubId,
      hubName: row.hubName,
      sourceOrganization: row.sourceOrganization,
      organizationKind: row.organizationKind,
      regulatorOrAgency: row.regulatorOrAgency ?? null,
      sourceSystem: row.sourceSystem ?? null,
      datasetName: row.datasetName,
      grain: row.grain,
      geography: row.geography ?? null,
      officialAsOf: row.officialAsOf ?? null,
      retrievedAt: row.retrievedAt ?? null,
      publicSourceUrl: row.publicSourceUrl ?? null,
      limitation: row.limitation ?? null,
    })),
  };
}

export function previewSourceOrganizations(limit = 8): string[] {
  const names = [...new Set(listNetworkSourceRows().map((r) => r.sourceOrganization))];
  return names.slice(0, limit);
}

export function hubById(id: string): TrustHubNetworkManifest | undefined {
  return getTrustHubNetworkState().hubs.find((h) => h.hub.id === id);
}
