import { BRAND } from '@/lib/brand';
import { HUB_ACCENTS, HUB_CALCULATOR_PATHS, HUB_SEARCH_PATHS } from '@/lib/hubs';

export type ServiceVertical = 'moving' | 'lending' | 'insurance';

export interface HubSite {
  id: ServiceVertical;
  name: string;
  shortName: string;
  subBrand: string;
  poweredBy: string;
  path: string;
  tagline: string;
  verificationBadge: string;
  accent: string;
  searchPath: string;
  calculatorPath: string;
  directoryPath: string;
  ctaLabel: string;
  coachLine: string;
  emoji: string;
  stats: { label: string; value: string }[];
  features: string[];
}

export const CONSUMER_TRUST_HUB = BRAND;

export const HUB_SITES: Record<ServiceVertical, HubSite> = {
  moving: {
    id: 'moving',
    name: 'MoveTrust Hub',
    shortName: 'Moving',
    subBrand: HUB_ACCENTS.moving.subBrand,
    poweredBy: HUB_ACCENTS.moving.poweredBy,
    path: '/moving',
    tagline: 'Compare FMCSA-licensed interstate movers with verified reviews.',
    verificationBadge: HUB_ACCENTS.moving.verification,
    accent: HUB_ACCENTS.moving.accent,
    searchPath: HUB_SEARCH_PATHS.moving,
    calculatorPath: HUB_CALCULATOR_PATHS.moving,
    directoryPath: '/moving/companies',
    ctaLabel: 'Explore Movers',
    coachLine: HUB_ACCENTS.moving.coachLine,
    emoji: HUB_ACCENTS.moving.emoji,
    stats: [
      { label: 'Directory Movers', value: '25+' },
      { label: 'Reviews Analyzed', value: '9+' },
      { label: 'Avg Rating', value: '4.3★' },
    ],
    features: [
      'FMCSA licensing checks',
      'Free moving calculator',
      'Side-by-side comparison',
      'Interstate quote matching',
    ],
  },
  lending: {
    id: 'lending',
    name: 'LenderTrust Hub',
    shortName: 'Lending',
    subBrand: HUB_ACCENTS.lending.subBrand,
    poweredBy: HUB_ACCENTS.lending.poweredBy,
    path: '/lending',
    tagline: 'Discover honest lenders in your county with NMLS verification.',
    verificationBadge: HUB_ACCENTS.lending.verification,
    accent: HUB_ACCENTS.lending.accent,
    searchPath: HUB_SEARCH_PATHS.lending,
    calculatorPath: HUB_CALCULATOR_PATHS.lending,
    directoryPath: '/lending/lenders',
    ctaLabel: 'Find Lenders',
    coachLine: HUB_ACCENTS.lending.coachLine,
    emoji: HUB_ACCENTS.lending.emoji,
    stats: [
      { label: 'Verified Lenders', value: '12,450+' },
      { label: 'Reviews Analyzed', value: '2.8M' },
      { label: 'Counties Covered', value: '3,142' },
    ],
    features: [
      'NMLS license verification',
      'County-level insights',
      'Mortgage calculators',
      'Zero paid placements',
    ],
  },
  insurance: {
    id: 'insurance',
    name: 'InsuranceTrust Hub',
    shortName: 'Insurance',
    subBrand: HUB_ACCENTS.insurance.subBrand,
    poweredBy: HUB_ACCENTS.insurance.poweredBy,
    path: '/insurance',
    tagline: 'Compare state-licensed insurance agents with DOI verification.',
    verificationBadge: HUB_ACCENTS.insurance.verification,
    accent: HUB_ACCENTS.insurance.accent,
    searchPath: HUB_SEARCH_PATHS.insurance,
    calculatorPath: HUB_CALCULATOR_PATHS.insurance,
    directoryPath: '/insurance/directory',
    ctaLabel: 'Compare Insurance',
    coachLine: HUB_ACCENTS.insurance.coachLine,
    emoji: HUB_ACCENTS.insurance.emoji,
    stats: [
      { label: 'Verified Agents', value: '8,200+' },
      { label: 'States Covered', value: '50' },
      { label: 'Market Hubs', value: '54+' },
    ],
    features: [
      'State DOI license verification',
      'Health insurance hubs',
      'Premium calculators',
      'No paid placements',
    ],
  },
};

/** @deprecated Use HUB_SITES */
export const SISTER_SITES = HUB_SITES;
/** @deprecated Use CONSUMER_TRUST_HUB */
export const CONSUMERS_TRUST_HUB = CONSUMER_TRUST_HUB;

export function getInternalSearchUrl(vertical: ServiceVertical, zip?: string): string {
  const base = HUB_SEARCH_PATHS[vertical];
  if (!zip) return base;
  return `${base}?zip=${encodeURIComponent(zip)}`;
}

export function getVerticalFromQuery(q: string): ServiceVertical | null {
  const normalized = q.toLowerCase();
  if (normalized.includes('mov') || normalized.includes('relocat')) return 'moving';
  if (normalized.includes('lend') || normalized.includes('mortgage') || normalized.includes('loan')) return 'lending';
  if (normalized.includes('insur') || normalized.includes('health') || normalized.includes('medicare')) return 'insurance';
  return null;
}