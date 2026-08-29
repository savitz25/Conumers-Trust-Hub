import type { SpecialistHubId } from './registry.ts';

export type NetworkAskMode =
  | 'entity'
  | 'count'
  | 'aggregate'
  | 'comparison'
  | 'evidence'
  | 'journey'
  | 'definition'
  | 'identifier'
  | 'place'
  | 'name_check';

export type NetworkAskRoute = {
  hubId: SpecialistHubId;
  mode: NetworkAskMode;
  query: string;
  structuredFilters?: Record<string, unknown>;
  capabilityStatus: 'execute' | 'handoff' | 'unsupported';
  destination?: string;
};

export const FEDERATED_ASK_CONTRACT = 'network-ask-route-v1';
export const SAVE_TO_RESEARCH_CONTRACT = 'save-to-research-handoff-v1';

export type SaveToResearchEvent = {
  contract: typeof SAVE_TO_RESEARCH_CONTRACT;
  query: string;
  intent: string;
  destinations: string[];
  createdAt: string;
};

export function saveToResearchPayload(query: string, intent: string, destinations: string[]): SaveToResearchEvent {
  return {
    contract: SAVE_TO_RESEARCH_CONTRACT,
    query,
    intent,
    destinations,
    createdAt: new Date().toISOString(),
  };
}
