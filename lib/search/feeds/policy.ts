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
  const entity = (intent.entityType || '').toLowerCase();

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

  // Senior — nursing/SNF only; never substitute AL / memory / home care
  if (
    entity === 'memory_care' ||
    entity === 'assisted_living' ||
    cat === 'memory_care' ||
    cat === 'assisted_living' ||
    cat === 'home_care' ||
    cat === 'home_health' ||
    entity === 'home_care' ||
    entity === 'home_health'
  ) {
    return empty('unsupported', `senior_care_type_not_ready:${entity || cat}`);
  }

  // Investor products — never substitute advisers
  if (
    cat === 'etf' ||
    cat === 'mutual_fund' ||
    cat === 'stock' ||
    cat === 'crypto' ||
    cat === 'hedge_fund' ||
    entity === 'etf' ||
    entity === 'mutual_fund'
  ) {
    return empty('unsupported', `investor_product_unsupported:${entity || cat}`);
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
