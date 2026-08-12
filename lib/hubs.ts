export type HubStatus = 'live' | 'coming_soon';

export interface TrustHub {
  id: 'move' | 'insurance' | 'lender' | 'contractor';
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
    name: 'Move Trust Hub',
    shortName: 'Moving',
    domain: 'movetrusthub.com',
    url: 'https://www.movetrusthub.com',
    status: 'live',
    verification: 'FMCSA licensing & complaint data',
    dataSources: ['FMCSA', 'SAFER', 'Attributed reviews'],
    description:
      'Research destination for FMCSA-licensed movers. Provider directories and tools are hosted on this domain.',
    accent: '#FF5A1F',
    accentSoft: '#FFF4EF',
  },
  {
    id: 'insurance',
    name: 'Insurance Trust Hub',
    shortName: 'Insurance',
    domain: 'insurancetrusthub.com',
    url: 'https://www.insurancetrusthub.com',
    status: 'live',
    verification: 'State DOI / NAIC licensing',
    dataSources: ['State DOI', 'NAIC', 'Attributed reviews'],
    description:
      'Research destination for state-licensed insurance agencies and brokers. Provider directories and tools are hosted on this domain.',
    accent: '#0D9488',
    accentSoft: '#F0FDFA',
  },
  {
    id: 'lender',
    name: 'Lender Trust Hub',
    shortName: 'Lending',
    domain: 'lendertrusthub.com',
    url: 'https://www.lendertrusthub.com',
    status: 'live',
    verification: 'NMLS Consumer Access',
    dataSources: ['NMLS', 'CFPB', 'FDIC / public records'],
    description:
      'Research destination for NMLS-verified lenders. Provider directories and tools are hosted on this domain.',
    accent: '#16A34A',
    accentSoft: '#F0FDF4',
  },
  {
    id: 'contractor',
    name: 'Contractor Trust Hub',
    shortName: 'Contractors',
    domain: 'contractortrusthub.com',
    url: 'https://www.contractortrusthub.com',
    status: 'live',
    verification: 'Florida DBPR licensing & Sunbiz entity links',
    dataSources: ['Florida DBPR', 'Sunbiz', 'Board discipline extracts'],
    description:
      'Research destination for Florida contractor license verification, project cost planning, and verified trade matches. Evidence only — not a marketplace.',
    accent: '#0A2540',
    accentSoft: '#EEF2FF',
  },
];

export function getLiveHubs() {
  return TRUST_HUBS.filter((h) => h.status === 'live');
}

export function getHubById(id: TrustHub['id']) {
  return TRUST_HUBS.find((h) => h.id === id);
}
