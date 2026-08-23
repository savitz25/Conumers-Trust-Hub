import { NETWORK_PUBLIC_NAMES } from '@/lib/network/registry';
import type { SearchHubId } from '../types';

export const ACTIVE_SEARCH_HUBS: SearchHubId[] = [
  'move',
  'lender',
  'insurance',
  'contractor',
  'senior',
  'investor',
];

export function hubPublicName(hub: SearchHubId): string {
  return NETWORK_PUBLIC_NAMES[hub];
}

export function researchCta(hub: SearchHubId): string {
  if (hub === 'move') return 'Research on MoveTrustHub';
  if (hub === 'lender') return 'View on LenderTrustHub';
  if (hub === 'insurance') return 'Research on InsuranceTrustHub';
  if (hub === 'contractor') return 'View Contractor Trust Report';
  if (hub === 'senior') return 'Research on SeniorTrustHub';
  if (hub === 'investor') return 'Research on InvestorTrustHub';
  return `Research on ${hubPublicName(hub)}`;
}

export function entityLabel(entityType: string, category?: string): string {
  if (category === 'roofing') return 'Roofing contractor';
  if (category === 'plumbing') return 'Plumbing contractor';
  if (category === 'hvac') return 'HVAC contractor';
  if (category === 'pool') return 'Pool contractor';
  if (category === 'general_contractor') return 'General contractor';
  const map: Record<string, string> = {
    mover: 'Mover',
    interstate_mover: 'Interstate mover',
    intrastate_mover: 'Local mover',
    moving_broker: 'Moving broker',
    auto_transporter: 'Auto transporter',
    mortgage_company: 'Mortgage company',
    mortgage_broker: 'Mortgage broker',
    bank: 'Bank',
    insurance_agency: 'Insurance agency',
    insurance_brokerage: 'Insurance brokerage',
    insurance_agent: 'Insurance agent',
    insurance_carrier: 'Insurance carrier',
    contractor: 'Contractor',
    nursing_facility: 'Nursing facility',
    ria: 'Registered investment adviser',
    era: 'Exempt reporting adviser',
    advisory_firm: 'Advisory firm',
    investment_adviser: 'Investment adviser',
  };
  return map[entityType] || entityType.replace(/_/g, ' ');
}

export function placeLine(opts: {
  city?: string;
  county?: string;
  state?: string;
}): string | undefined {
  const city = opts.city?.trim();
  const county = opts.county?.trim();
  const state = opts.state?.trim();
  if (city && state) return `${title(city)}, ${state}`;
  if (county && state) {
    const c = /county$/i.test(county) ? county : `${title(county)} County`;
    return `${c}, ${state}`;
  }
  if (state) return state;
  return city || undefined;
}

function title(s: string): string {
  if (s === s.toUpperCase() && s.length > 3) {
    return s
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return s;
}

export const SEARCH_EXAMPLES = [
  { label: 'Movers in Keansburg, NJ', q: 'movers in Keansburg NJ' },
  { label: 'Mortgage companies in Florida', q: 'mortgage companies in Florida' },
  { label: 'Auto insurance agencies in Texas', q: 'auto insurance agencies Texas' },
  { label: 'Roofers in Miami, FL', q: 'roofers Miami FL' },
  { label: 'Nursing homes in Miami, FL', q: 'nursing homes in Miami FL' },
  { label: 'RIAs in Boca Raton, FL', q: 'RIAs in Boca Raton FL' },
] as const;

export const INDEPENDENCE_LINE =
  'Results are ranked by relevance and source-backed match precision — not payment or sponsorship.';
