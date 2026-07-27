export type HubStatus = 'live' | 'coming_soon';

export interface TrustHub {
  id: 'move' | 'insurance' | 'lender';
  name: string;
  shortName: string;
  domain: string;
  url: string;
  status: HubStatus;
  verification: string;
  dataSources: string[];
  description: string;
  /** Hub accent for cards only — restrained, not playful */
  accent: string;
  accentSoft: string;
}

export const TRUST_HUBS: TrustHub[] = [
  {
    id: 'move',
    name: 'MoveTrustHub',
    shortName: 'Moving',
    domain: 'movetrusthub.com',
    url: 'https://www.movetrusthub.com',
    status: 'live',
    verification: 'FMCSA licensing & complaint data',
    dataSources: ['FMCSA', 'SAFER', 'Attributed reviews'],
    description:
      'Independent research directory for FMCSA-licensed interstate and local movers. Transparent scoring, no paid placements.',
    accent: '#1D4ED8',
    accentSoft: '#EFF6FF',
  },
  {
    id: 'insurance',
    name: 'InsuranceTrustHub',
    shortName: 'Insurance',
    domain: 'insurancetrusthub.com',
    url: 'https://www.insurancetrusthub.com',
    status: 'live',
    verification: 'State DOI / NAIC licensing',
    dataSources: ['State DOI', 'NAIC', 'Attributed reviews'],
    description:
      'Compare state-licensed insurance agencies and brokers with public licensing checks and clear methodology.',
    accent: '#0F766E',
    accentSoft: '#F0FDFA',
  },
  {
    id: 'lender',
    name: 'LenderTrustHub',
    shortName: 'Lending',
    domain: 'lendertrusthub.com',
    url: 'https://www.lendertrusthub.com',
    status: 'coming_soon',
    verification: 'NMLS Consumer Access',
    dataSources: ['NMLS', 'CFPB', 'FDIC / public records'],
    description:
      'NMLS-verified lender research for mortgage and consumer lending decisions. Launching soon under the same independence standards.',
    accent: '#4338CA',
    accentSoft: '#EEF2FF',
  },
];

export function getLiveHubs() {
  return TRUST_HUBS.filter((h) => h.status === 'live');
}

export function getHubById(id: TrustHub['id']) {
  return TRUST_HUBS.find((h) => h.id === id);
}
