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
      'Research destination for FMCSA-licensed movers. Provider directories and tools are hosted on this domain.',
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
      'Research destination for state-licensed insurance agencies and brokers. Provider directories and tools are hosted on this domain.',
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
      'Research destination for NMLS-verified lenders. Planned launch under the same independence standards as the live hubs.',
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
