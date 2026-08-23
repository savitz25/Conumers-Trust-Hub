export type {
  TrustHubSearchIntent,
  SearchHubId,
  SearchEntityType,
  SearchConfidence,
  SearchParseMethod,
  TrustHubSearchLocation,
  SearchAmbiguity,
  SearchFilters,
  ConsumerSearchIntent,
  SupportStatus,
  GeoPrecision,
} from './types';

export { parseUniversalSearchQuery } from './parser';
export { normalizeQuery } from './normalize';

export type {
  SearchHandoffContext,
  SearchHandoffType,
  HubSearchHandoffResult,
  HubEntityHandoffResult,
  SearchHandoffAnalytics,
  SearchDestinationOutcome,
} from './handoff';

export {
  SEARCH_HANDOFF_KEYS,
  intentToHandoffContext,
  sanitizeHandoffContext,
  serializeHandoffContext,
  parseHandoffContext,
  withHandoffParams,
  buildSearchBackLabel,
  analyticsFromContext,
} from './handoff';

export {
  HUB_SEARCH_ADAPTERS,
  getHubSearchAdapter,
  listHubSearchAdapters,
  buildViewMoreHandoff,
  buildEntityHandoff,
  evaluateSearchDestination,
  resolveViewMoreDestination,
  resolveEntityDestination,
} from './adapters';

export type { HubSearchAdapter, NetworkDiscoveryEntity } from './adapters';

export {
  createDiscoveryIndex,
  createFixtureDiscoveryIndex,
  loadDiscoveryFixtureCorpus,
  validateDiscoveryCorpus,
  validateDiscoveryEntity,
  buildNetworkEntityId,
  parseNetworkEntityId,
  getTopMatchesPreviewCap,
  isPreviewEligible,
} from './discovery';

export type {
  DiscoveryStatus,
  DiscoveryServiceArea,
  DiscoveryMatchReason,
  DiscoverySearchMatch,
  DiscoverySearchResult,
} from './discovery';

export { createRealDiscoveryIndex, loadActiveDiscoveryBundle } from './feeds';
