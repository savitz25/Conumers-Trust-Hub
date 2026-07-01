export type ServiceVertical = 'moving' | 'lending' | 'insurance';

export interface SisterSite {
  id: ServiceVertical;
  name: string;
  shortName: string;
  domain: string;
  url: string;
  tagline: string;
  verificationBadge: string;
  primaryColor: string;
  searchPath: string;
  calculatorPath?: string;
  directoryPath: string;
  ctaLabel: string;
  stats: {
    label: string;
    value: string;
  }[];
  features: string[];
}

export const CONSUMERS_TRUST_HUB = {
  name: 'Consumers Trust Hub',
  domain: 'consumerstrusthub.com',
  url: 'https://www.consumerstrusthub.com',
  tagline: 'One Trusted Hub for Moving, Lending & Insurance – Shop with Confidence.',
  email: 'hello@consumerstrusthub.com',
} as const;

export const SISTER_SITES: Record<ServiceVertical, SisterSite> = {
  moving: {
    id: 'moving',
    name: 'Move Trust Hub',
    shortName: 'Moving',
    domain: 'movetrusthub.com',
    url: 'https://www.movetrusthub.com',
    tagline: 'Compare FMCSA-licensed interstate movers with verified reviews.',
    verificationBadge: 'FMCSA Verified',
    primaryColor: '#0A2540',
    searchPath: '/companies',
    calculatorPath: '/moving-calculator',
    directoryPath: '/companies',
    ctaLabel: 'Explore Movers',
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
    name: 'Lender Trust Hub',
    shortName: 'Lending',
    domain: 'lendertrusthub.com',
    url: 'https://www.lendertrusthub.com',
    tagline: 'Discover honest lenders in your county with NMLS verification.',
    verificationBadge: 'NMLS Verified',
    primaryColor: '#0A2540',
    searchPath: '/local-lenders',
    calculatorPath: '/calculators',
    directoryPath: '/local-lenders',
    ctaLabel: 'Find Lenders',
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
    name: 'Insurance Trust Hub',
    shortName: 'Insurance',
    domain: 'insurancetrusthub.com',
    url: 'https://www.insurancetrusthub.com',
    tagline: 'Compare state-licensed insurance agents with DOI verification.',
    verificationBadge: 'DOI Verified',
    primaryColor: '#0A2540',
    searchPath: '/directory',
    calculatorPath: '/calculators',
    directoryPath: '/directory',
    ctaLabel: 'Compare Insurance',
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

export const ALL_SITES = [
  CONSUMERS_TRUST_HUB,
  ...Object.values(SISTER_SITES),
];

export function getSearchUrl(vertical: ServiceVertical, zip?: string): string {
  const site = SISTER_SITES[vertical];
  const base = site.url + site.searchPath;
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