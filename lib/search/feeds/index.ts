import { createDiscoveryIndex, type DiscoveryIndex } from '../discovery';
import type { TrustHubSearchIntent } from '../types';
import type { DiscoverySearchResult } from '../discovery/types';
import { loadSpecialistFeed } from './load';
import { isContractorFlReadyEntity, realPolicyOverride } from './policy';
import type { ActiveDiscoveryBundle, LoadedFeed } from './types';

const HUBS = ['move', 'lender', 'insurance', 'contractor', 'senior', 'investor'] as const;

export function loadActiveDiscoveryBundle(rootDir = process.cwd()): ActiveDiscoveryBundle {
  const feeds: LoadedFeed[] = HUBS.map((h) => loadSpecialistFeed(h, rootDir));
  const entities = feeds.flatMap((f) => (f.status === 'ok' ? f.entities : []));
  const contractor = feeds.find((f) => f.hub === 'contractor');
  const contractorImported = contractor?.status === 'ok' ? contractor.entities.length : 0;
  const active = entities.filter(isContractorFlReadyEntity);
  const contractorFlActive = active.filter((e) => e.hub === 'contractor').length;
  const counts: Record<string, number> = {};
  for (const e of active) counts[e.hub] = (counts[e.hub] || 0) + 1;
  return {
    feeds,
    entities: active,
    counts,
    contractor_imported: contractorImported,
    contractor_fl_active: contractorFlActive,
  };
}

export function createRealDiscoveryIndex(rootDir = process.cwd()): DiscoveryIndex & {
  bundle: ActiveDiscoveryBundle;
} {
  const bundle = loadActiveDiscoveryBundle(rootDir);
  const inner = createDiscoveryIndex(bundle.entities);
  return {
    bundle,
    size: inner.size,
    getAll: inner.getAll,
    search(intent: TrustHubSearchIntent): DiscoverySearchResult {
      const blocked = realPolicyOverride(intent);
      if (blocked) return blocked;
      return inner.search(intent);
    },
  };
}

export { loadSpecialistFeed, loadProvenance } from './load';
export { realPolicyOverride, isContractorFlReadyEntity, CONTRACTOR_FL_READY } from './policy';
export type { ActiveDiscoveryBundle, LoadedFeed, FeedProvenance } from './types';
