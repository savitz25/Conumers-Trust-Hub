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
} from './handoff';

export {
  SEARCH_HANDOFF_KEYS,
  intentToHandoffContext,
  sanitizeHandoffContext,
  serializeHandoffContext,
  parseHandoffContext,
  withHandoffParams,
  buildSearchBackLabel,
} from './handoff';

export {
  HUB_SEARCH_ADAPTERS,
  getHubSearchAdapter,
  listHubSearchAdapters,
  buildViewMoreHandoff,
  buildEntityHandoff,
} from './adapters';

export type { HubSearchAdapter, NetworkDiscoveryEntity } from './adapters';