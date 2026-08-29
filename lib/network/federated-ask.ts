import type { SpecialistHubId } from './registry.ts';

/**
 * Future federated Ask handoff. Prompt 1 defines the contract.
 * Ask does not query specialist production databases here.
 */
export type NetworkAskMode =
  | 'entity'
  | 'count'
  | 'aggregate'
  | 'comparison'
  | 'evidence'
  | 'journey'
  | 'definition';

export type NetworkAskRoute = {
  hubId: SpecialistHubId;
  mode: NetworkAskMode;
  query: string;
  structuredFilters?: Record<string, unknown>;
  capabilityStatus: 'live' | 'partial' | 'unsupported';
  destination?: string;
};

export const FEDERATED_ASK_CONTRACT = 'network-ask-route-v1';
