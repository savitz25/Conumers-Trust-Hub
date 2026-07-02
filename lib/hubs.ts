import type { ServiceVertical } from '@/lib/sites';

/** Hub accent colors — professional base + fun vertical accents (v1.0 blueprint) */
export const HUB_ACCENTS = {
  moving: {
    id: 'moving' as const,
    label: 'Moving',
    subBrand: 'MoveTrust Hub',
    poweredBy: 'powered by ConsumerTrust Hub',
    accent: '#2563EB',
    accentLight: '#DBEAFE',
    accentGradient: 'from-blue-500/20 via-blue-400/10 to-transparent',
    emoji: '🚚',
    path: '/moving',
    verification: 'FMCSA Verified',
    coachLine: "Let's find movers you can actually trust!",
  },
  insurance: {
    id: 'insurance' as const,
    label: 'Insurance',
    subBrand: 'InsuranceTrust Hub',
    poweredBy: 'powered by ConsumerTrust Hub',
    accent: '#0D9488',
    accentLight: '#CCFBF1',
    accentGradient: 'from-teal-500/20 via-teal-400/10 to-transparent',
    emoji: '🛡️',
    path: '/insurance',
    verification: 'DOI Verified',
    coachLine: 'Coverage that travels with you — nice!',
  },
  lending: {
    id: 'lending' as const,
    label: 'Lending',
    subBrand: 'LenderTrust Hub',
    poweredBy: 'powered by ConsumerTrust Hub',
    accent: '#4F46E5',
    accentLight: '#E0E7FF',
    accentGradient: 'from-indigo-500/20 via-indigo-400/10 to-transparent',
    emoji: '🏡',
    path: '/lending',
    verification: 'NMLS Verified',
    coachLine: 'Your dream home starts with the right lender.',
  },
} as const;

export type HubConfig = (typeof HUB_ACCENTS)[ServiceVertical];

export const HUB_LIST: HubConfig[] = [
  HUB_ACCENTS.moving,
  HUB_ACCENTS.insurance,
  HUB_ACCENTS.lending,
];

export function getHub(vertical: ServiceVertical): HubConfig {
  return HUB_ACCENTS[vertical];
}

export function getHubFromPath(pathname: string): HubConfig | null {
  if (pathname.startsWith('/moving')) return HUB_ACCENTS.moving;
  if (pathname.startsWith('/insurance')) return HUB_ACCENTS.insurance;
  if (pathname.startsWith('/lending')) return HUB_ACCENTS.lending;
  return null;
}

/** Internal search paths on master domain (pre-redirect) */
export const HUB_SEARCH_PATHS: Record<ServiceVertical, string> = {
  moving: '/moving/companies',
  lending: '/lending/lenders',
  insurance: '/insurance/directory',
};

export const HUB_CALCULATOR_PATHS: Record<ServiceVertical, string> = {
  moving: '/moving/calculator',
  lending: '/lending/calculators',
  insurance: '/insurance/calculators',
};