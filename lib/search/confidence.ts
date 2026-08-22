import type { SearchAmbiguity, SearchConfidence, TrustHubSearchLocation } from './types';

export function scoreConfidence(input: {
  hubUnique: boolean;
  entityClear: boolean;
  geo?: TrustHubSearchLocation;
  geoAmbiguous?: boolean;
  nearMe?: boolean;
  soft?: boolean;
  exclusionSpecial?: boolean;
  hubCandidates?: number;
  force?: SearchConfidence;
}): { confidence: SearchConfidence; confidenceScore: number } {
  if (input.force) {
    const map = { high: 0.9, medium: 0.6, low: 0.25 };
    return { confidence: input.force, confidenceScore: map[input.force] };
  }

  if (input.nearMe || (input.hubCandidates && input.hubCandidates > 1) || input.geoAmbiguous) {
    return { confidence: 'low', confidenceScore: 0.25 };
  }
  if (!input.hubUnique && (input.hubCandidates ?? 0) === 0 && !input.entityClear) {
    return { confidence: 'low', confidenceScore: 0.2 };
  }
  if (input.exclusionSpecial) {
    return { confidence: 'medium', confidenceScore: 0.55 };
  }
  if (input.soft || !input.geo || input.geo.precision === 'unknown') {
    if (input.hubUnique && input.entityClear && input.geo && input.geo.precision !== 'unknown' && !input.nearMe) {
      // soft but geo ok can still be high for some (electrician) — caller forces
      return { confidence: 'medium', confidenceScore: 0.6 };
    }
    if (input.hubUnique && input.entityClear && !input.geo) {
      return { confidence: 'medium', confidenceScore: 0.55 };
    }
  }
  if (input.hubUnique && input.entityClear && input.geo && ['zip', 'city', 'county', 'state'].includes(input.geo.precision)) {
    return { confidence: 'high', confidenceScore: 0.92 };
  }
  if (input.hubUnique && input.entityClear) {
    return { confidence: 'medium', confidenceScore: 0.58 };
  }
  return { confidence: 'low', confidenceScore: 0.3 };
}

export function buildHubAmbiguity(options: string[]): SearchAmbiguity {
  return { type: 'hub', options: options as SearchAmbiguity extends { type: 'hub'; options: infer O } ? O : never };
}
