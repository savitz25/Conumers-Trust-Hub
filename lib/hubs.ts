import {
  CANONICAL_ORIGINS,
  NETWORK_PUBLIC_NAMES,
  SPECIALIST_HUB_IDS,
  type SpecialistHubId,
} from '@/lib/network/registry';

export type HubStatus = 'live' | 'coming_soon';

export type HubId = SpecialistHubId;

export interface TrustHub {
  id: HubId;
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
    name: NETWORK_PUBLIC_NAMES.move,
    shortName: 'Moving',
    domain: 'movetrusthub.com',
    url: CANONICAL_ORIGINS.move,
    status: 'live',
    verification: 'FMCSA licensing & complaint data',
    dataSources: ['FMCSA', 'SAFER', 'Attributed reviews'],
    description:
      'Research destination for FMCSA-licensed movers. Provider directories and tools are hosted on this domain.',
    accent: '#FF5A1F',
    accentSoft: '#FFF4EF',
  },
  {
    id: 'lender',
    name: NETWORK_PUBLIC_NAMES.lender,
    shortName: 'Lending',
    domain: 'lendertrusthub.com',
    url: CANONICAL_ORIGINS.lender,
    status: 'live',
    verification: 'NMLS Consumer Access',
    dataSources: ['NMLS', 'CFPB', 'FDIC / public records'],
    description:
      'Research destination for NMLS-verified lenders. Provider directories and tools are hosted on this domain.',
    accent: '#16A34A',
    accentSoft: '#F0FDF4',
  },
  {
    id: 'insurance',
    name: NETWORK_PUBLIC_NAMES.insurance,
    shortName: 'Insurance',
    domain: 'insurancetrusthub.com',
    url: CANONICAL_ORIGINS.insurance,
    status: 'live',
    verification: 'State DOI / NAIC licensing',
    dataSources: ['State DOI', 'NAIC', 'Attributed reviews'],
    description:
      'Research destination for state-licensed insurance agencies and brokers. Provider directories and tools are hosted on this domain.',
    accent: '#0D9488',
    accentSoft: '#F0FDFA',
  },
  {
    id: 'contractor',
    name: NETWORK_PUBLIC_NAMES.contractor,
    shortName: 'Contractors',
    domain: 'contractortrusthub.com',
    url: CANONICAL_ORIGINS.contractor,
    status: 'live',
    verification: 'State licensing-board research with state-specific evidence depth',
    dataSources: ['State licensing boards', 'Official registration extracts'],
    description:
      'Multi-state contractor license and registration research with state-specific evidence depth. Evidence only — not a marketplace.',
    accent: '#0A2540',
    accentSoft: '#EEF2FF',
  },
  {
    id: 'senior',
    name: NETWORK_PUBLIC_NAMES.senior,
    shortName: 'Senior care',
    domain: 'seniortrusthub.com',
    url: CANONICAL_ORIGINS.senior,
    status: 'live',
    verification: 'CMS and supported state regulatory evidence',
    dataSources: ['CMS', 'Supported state regulators'],
    description:
      'Government-sourced senior care research. Not a placement agency, referral marketplace, or lead-generation service.',
    accent: '#7C3AED',
    accentSoft: '#F5F3FF',
  },
  {
    id: 'investor',
    name: NETWORK_PUBLIC_NAMES.investor,
    shortName: 'Investing',
    domain: 'investortrusthub.com',
    url: CANONICAL_ORIGINS.investor,
    status: 'live',
    verification: 'SEC / IARD firm filings',
    dataSources: ['SEC', 'IARD'],
    description:
      'Investment firm research using SEC/IARD regulatory evidence. Research before you invest — not stock recommendations or portfolio advice.',
    accent: '#001F52',
    accentSoft: '#EEF4FF',
  },
];

const HUB_BY_ID = Object.fromEntries(TRUST_HUBS.map((h) => [h.id, h])) as Record<
  HubId,
  TrustHub
>;

export function getLiveHubs() {
  return TRUST_HUBS.filter((h) => h.status === 'live');
}

export function getHubById(id: HubId) {
  return HUB_BY_ID[id];
}

export function assertCompleteSpecialistRegistry(): void {
  const ids = TRUST_HUBS.map((h) => h.id);
  if (ids.length !== SPECIALIST_HUB_IDS.length) {
    throw new Error('TRUST_HUBS must contain exactly six specialists');
  }
  for (const id of SPECIALIST_HUB_IDS) {
    if (!ids.includes(id)) throw new Error(`Missing specialist hub: ${id}`);
  }
}
