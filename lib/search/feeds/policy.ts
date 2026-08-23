/**
 * ASK-SEARCH-006B real-index activation policy.
 * Does not mutate stored snapshots.
 */

import type { TrustHubSearchIntent } from '../types';
import type { DiscoverySearchResult, NetworkDiscoveryEntity } from '../discovery/types';

export const CONTRACTOR_FL_READY = [
  'roofing',
  'plumbing',
  'hvac',
  'pool',
  'general_contractor',
] as const;

export const CONTRACTOR_UNSUPPORTED_TRADES = new Set([
  'electrical',
  'solar',
  'painting',
  'flooring',
  'kitchen_remodel',
  'kitchen_remodeling',
  'bathroom_remodel',
  'bathroom_remodeling',
  'home_inspector',
]);

export function isContractorFlReadyEntity(e: NetworkDiscoveryEntity): boolean {
  if (e.hub !== 'contractor') return true;
  if ((e.state || '').toUpperCase() !== 'FL') return false;
  const cats = (e.categories || []).map((c) => c.toLowerCase());
  return cats.some((c) => (CONTRACTOR_FL_READY as readonly string[]).includes(c));
}

export function realPolicyOverride(intent: TrustHubSearchIntent): DiscoverySearchResult | null {
  const hub = intent.hub || intent.primaryHub;
  const cat = (intent.category || '').toLowerCase();

  if (intent.entityType === 'medicare_agent' || cat === 'medicare') {
    return empty('unsupported', 'medicare_agent_unsupported');
  }
  if (intent.entityType === 'loan_officer') {
    return empty('unsupported', 'loan_officer_unsupported');
  }
  if (cat === 'refinance' || cat === 'jumbo' || cat === 'arm') {
    return empty('unsupported', `lender_category_unsupported:${cat}`);
  }
  if (hub === 'contractor' && CONTRACTOR_UNSUPPORTED_TRADES.has(cat)) {
    return empty('unsupported', 'contractor_trade_not_ready');
  }
  if (hub === 'contractor' && intent.location?.stateCode === 'NJ') {
    return empty('unsupported', 'contractor_nj_not_ready');
  }
  return null;
}

function empty(
  status: DiscoverySearchResult['status'],
  reason: string
): DiscoverySearchResult {
  return {
    matches: [],
    total: 0,
    topMatches: [],
    supported: status !== 'unsupported',
    status,
    reason,
  };
}
