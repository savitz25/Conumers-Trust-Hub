import { listAskNetworkStates } from '../network/published-ask-states.ts';
import { CANONICAL_ORIGINS } from '../network/registry.ts';

export function investorSecHandoff(stateCode?: string): { label: string; href: string } {
  const state = listAskNetworkStates().find(row => row.code === stateCode);
  return state
    ? { label: `InvestorTrustHub ${state.name}`, href: `${CANONICAL_ORIGINS.investor}/${state.slug}` }
    : { label: 'InvestorTrustHub', href: `${CANONICAL_ORIGINS.investor}/ask` };
}
