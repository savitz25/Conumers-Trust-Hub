/**
 * Local in-memory fixture-backed discovery index (ASK-SEARCH-005).
 * Pure/local — no DB, network, AI, or vector search.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TrustHubSearchIntent } from '../types';
import { validateDiscoveryCorpus } from './schema';
import { rankMatches, scoreEntity, sliceTopMatches } from './ranking';
import type { DiscoverySearchResult, NetworkDiscoveryEntity } from './types';

export type DiscoveryIndex = {
  size: () => number;
  getAll: () => NetworkDiscoveryEntity[];
  search: (intent: TrustHubSearchIntent) => DiscoverySearchResult;
};

export function createDiscoveryIndex(entities: NetworkDiscoveryEntity[]): DiscoveryIndex {
  const validation = validateDiscoveryCorpus(entities);
  if (!validation.ok) {
    const msg = validation.issues
      .slice(0, 8)
      .map((i) => `${i.path}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid discovery corpus: ${msg}`);
  }

  return {
    size: () => entities.length,
    getAll: () => [...entities],
    search(intent: TrustHubSearchIntent): DiscoverySearchResult {
      // Preserve parser ambiguity / unsupported — do not override
      if (intent.requiresClarification && intent.hubCandidates && intent.hubCandidates.length > 1) {
        return {
          matches: [],
          total: 0,
          topMatches: [],
          supported: false,
          status: 'needs_clarification',
          reason: 'Hub ambiguous — clarification required before discovery search',
        };
      }
      if (intent.requiresClarification && !intent.hub && !intent.primaryHub) {
        return {
          matches: [],
          total: 0,
          topMatches: [],
          supported: false,
          status: 'needs_clarification',
          reason: 'Clarification required before discovery search',
        };
      }
      if (intent.supported === false || intent.entityType === 'memory_care') {
        return {
          matches: [],
          total: 0,
          topMatches: [],
          supported: false,
          status: 'unsupported',
          reason: intent.unsupportedReason || 'unsupported_entity_or_category',
        };
      }
      if (intent.location?.precision === 'near_me') {
        return {
          matches: [],
          total: 0,
          topMatches: [],
          supported: false,
          status: 'needs_clarification',
          reason: 'near_me_unresolved',
        };
      }

      const scored: ReturnType<typeof scoreEntity>[] = [];
      for (const entity of entities) {
        const m = scoreEntity(entity, intent);
        if (m) scored.push(m);
      }
      const matches = rankMatches(scored as NonNullable<(typeof scored)[number]>[]);
      const topMatches = sliceTopMatches(matches);
      return {
        matches,
        total: matches.length,
        topMatches,
        supported: true,
        status: matches.length ? 'ok' : 'empty',
        reason: matches.length ? undefined : 'no_matching_entities',
      };
    },
  };
}

/** Load fixture corpus from docs/fixtures (Node/test path). */
export function loadDiscoveryFixtureCorpus(rootDir = process.cwd()): NetworkDiscoveryEntity[] {
  const path = join(rootDir, 'docs/fixtures/ask-universal-search-discovery-entities.v1.json');
  const raw = JSON.parse(readFileSync(path, 'utf8')) as {
    entities: NetworkDiscoveryEntity[];
  };
  return raw.entities;
}

export function createFixtureDiscoveryIndex(rootDir = process.cwd()): DiscoveryIndex {
  return createDiscoveryIndex(loadDiscoveryFixtureCorpus(rootDir));
}

export type {
  NetworkDiscoveryEntity,
  DiscoveryStatus,
  DiscoveryServiceArea,
  DiscoveryMatchReason,
  DiscoverySearchMatch,
  DiscoverySearchResult,
} from './types';
export { buildNetworkEntityId, parseNetworkEntityId, NETWORK_IDENTITY_NOTES } from './identity';
export {
  validateDiscoveryEntity,
  validateDiscoveryCorpus,
  isPreviewEligible,
} from './schema';
export { getTopMatchesPreviewCap, scoreEntity, rankMatches, sliceTopMatches } from './ranking';
