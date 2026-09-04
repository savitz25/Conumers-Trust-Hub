import type { CoverageLevel } from './coverage-atlas.ts';
import type { SpecialistHubId } from './registry.ts';
import { NETWORK_PUBLIC_NAMES } from './registry.ts';
import { hubById } from './source-registry.ts';
import { caReleaseGatePassed } from './ca-network.ts';
import { txReleaseGatePassed } from './tx-network.ts';
import { waReleaseGatePassed } from './wa-network.ts';
import { azReleaseGatePassed } from './az-network.ts';

export type PlaceMetric = {
  label: string;
  value: string;
  grain: string;
  officialAsOf?: string;
  limitation: string;
  sourceFamilyId?: string;
};

export type PlaceHubCard = {
  hubId: SpecialistHubId;
  name: string;
  capability: CoverageLevel;
  capabilityLabel: string;
  geographyMeaning: string;
  metrics: PlaceMetric[];
  destination: string;
  destinationLabel: string;
  limitation: string;
  researchAvailable: boolean;
};

export type PlaceLens = {
  slug: string;
  title: string;
  kicker: string;
  summary: string;
  geographyType: 'state' | 'county';
  stateCode: 'FL';
  countySlug?: 'broward' | 'palm-beach';
  hubs: PlaceHubCard[];
  indexable: boolean;
};

function capLabel(level: CoverageLevel): string {
  switch (level) {
    case 'enhanced_state_intelligence':
      return 'Enhanced state intelligence';
    case 'enhanced_county_intelligence':
      return 'Enhanced county intelligence';
    case 'state_research':
      return 'State research';
    case 'federal_core':
      return 'Federal core';
    case 'basic_discovery':
      return 'Basic discovery';
    default:
      return 'Not yet researched';
  }
}

function src(hubId: SpecialistHubId, familyId: string) {
  const hub = hubById(hubId);
  return hub?.sourceFamilies.find((f) => f.id === familyId);
}

export function floridaPlaceLens(): PlaceLens {
  const fdacs = src('move', 'fdacs-florida');
  const hmda = src('lender', 'hmda');
  const doi = src('insurance', 'state-doi');
  const dbpr = src('contractor', 'fl-dbpr');
  const cms = src('senior', 'cms-care-compare');
  const adv = src('investor', 'sec-iard-adv');

  return {
    slug: 'florida',
    title: 'What can TrustHub research in Florida?',
    kicker: 'Florida Place Lens',
    summary:
      'Six specialist hubs, six evidence models. Florida is the current enhanced-state geography for Move, Lender, Insurance, Contractor, and Senior. Investor search can filter principal office — that is not Florida client geography.',
    geographyType: 'state',
    stateCode: 'FL',
    indexable: true,
    hubs: [
      {
        hubId: 'move',
        name: NETWORK_PUBLIC_NAMES.move,
        capability: 'enhanced_state_intelligence',
        capabilityLabel: capLabel('enhanced_state_intelligence'),
        geographyMeaning: 'Florida IM registration and Florida-headquartered directory profiles. Headquarters is not service territory.',
        metrics: [
          {
            label: 'Active Florida IM registrations',
            value: '1,099',
            grain: 'FDACS intrastate mover registration rows (active). Not all Florida movers.',
            officialAsOf: fdacs?.officialAsOf ?? '2026-08-21',
            limitation: 'A registration is not automatically a public directory profile.',
            sourceFamilyId: 'fdacs-florida',
          },
          {
            label: 'Publishable directory profiles headquartered in Florida',
            value: '483',
            grain: 'Consumer-visible directory profiles with stored Florida HQ.',
            officialAsOf: '2026-08-21',
            limitation: 'HQ is not operating geography or FDACS registration.',
            sourceFamilyId: 'fmcsa-directory-cohort',
          },
        ],
        destination: 'https://www.movetrusthub.com/florida',
        destinationLabel: 'Open Florida Moving Intelligence',
        limitation: 'County pages are statewide research, not Enhanced Local Research.',
        researchAvailable: true,
      },
      {
        hubId: 'lender',
        name: NETWORK_PUBLIC_NAMES.lender,
        capability: 'enhanced_state_intelligence',
        capabilityLabel: capLabel('enhanced_state_intelligence'),
        geographyMeaning: 'Florida OFR company credentials and HMDA Florida state-grain activity. Property county is not lender HQ.',
        metrics: [
          {
            label: 'Approved Florida company NMLS identities',
            value: '6,325',
            grain: 'Unique Chapter 494 company NMLS identities. Not 6,435 lenders.',
            officialAsOf: '2026-08-27',
            limitation: 'Credentials (6,435) are not companies. Dual MBR+MLD exists.',
          },
          {
            label: 'Florida HMDA applications (state grain)',
            value: '927,616',
            grain: 'HMDA 2025 state-grain LEI application counts for Florida.',
            officialAsOf: hmda?.officialAsOf ?? '2025-12-31',
            limitation: 'HMDA reporters only. Not an approval rate or ranking.',
            sourceFamilyId: 'hmda',
          },
        ],
        destination: 'https://www.lendertrusthub.com/florida',
        destinationLabel: 'Open Florida Mortgage Intelligence',
        limitation: 'Structured Ask (lender-ask-v1) is live. Place Lens Florida is state intelligence. Property county is not lender HQ or service territory.',
        researchAvailable: true,
      },
      {
        hubId: 'insurance',
        name: NETWORK_PUBLIC_NAMES.insurance,
        capability: 'enhanced_state_intelligence',
        capabilityLabel: capLabel('enhanced_state_intelligence'),
        geographyMeaning: 'Florida DFS credentials and OIR company identity. No county market inference from addresses.',
        metrics: [
          {
            label: 'Florida-credentialed agencies',
            value: '56,939',
            grain: 'Distinct agencies with at least one Florida credential record.',
            officialAsOf: doi?.officialAsOf,
            limitation: 'Credential universe, not a public agency-profile directory.',
            sourceFamilyId: 'state-doi',
          },
        ],
        destination: 'https://www.insurancetrusthub.com/florida',
        destinationLabel: 'Open Florida Insurance Intelligence',
        limitation: 'Public people pages remain 0. Do not add agencies + persons + legal insurers.',
        researchAvailable: true,
      },
      {
        hubId: 'contractor',
        name: NETWORK_PUBLIC_NAMES.contractor,
        capability: 'enhanced_state_intelligence',
        capabilityLabel: capLabel('enhanced_state_intelligence'),
        geographyMeaning: 'Florida DBPR / CILB credentials. Mailing county is not service territory.',
        metrics: [
          {
            label: 'Enhanced county pages currently published',
            value: 'Broward · Palm Beach',
            grain: 'County Intelligence OS pages, not a 67-county census.',
            officialAsOf: dbpr?.officialAsOf ?? '2026-08-28',
            limitation: 'Other Florida counties vary. Permit exports are pending on county pages.',
            sourceFamilyId: 'fl-dbpr',
          },
        ],
        destination: 'https://www.contractortrusthub.com/florida',
        destinationLabel: 'Open Florida Contractor Intelligence',
        limitation: 'Structured Ask is live on ContractorTrustHub /ask.',
        researchAvailable: true,
      },
      {
        hubId: 'senior',
        name: NETWORK_PUBLIC_NAMES.senior,
        capability: 'enhanced_state_intelligence',
        capabilityLabel: capLabel('enhanced_state_intelligence'),
        geographyMeaning: 'Florida AHCA overlays plus CMS class counts. Classes are not summed.',
        metrics: [
          {
            label: 'AHCA identities',
            value: '6,983',
            grain: 'Current AHCA identities on Florida intelligence.',
            officialAsOf: '2026-08-26',
            limitation: 'AHCA is not a CMS class total.',
          },
          {
            label: 'CMS Florida class directories',
            value: 'Nursing homes 694 · Home health 1,146 · Hospice 61',
            grain: 'Separate CMS directories. Do not add into one senior-care total.',
            officialAsOf: cms?.officialAsOf,
            limitation: 'Directory volume is not quality.',
            sourceFamilyId: 'cms-care-compare',
          },
        ],
        destination: 'https://www.seniortrusthub.com/florida',
        destinationLabel: 'Open Florida senior-care intelligence',
        limitation:
          'Structured Ask is live on SeniorTrustHub /ask (senior-ask-v1). Assisted living is state-regulated and is not a CMS national directory class. Classes stay separate.',
        researchAvailable: true,
      },
      {
        hubId: 'investor',
        name: NETWORK_PUBLIC_NAMES.investor,
        capability: 'basic_discovery',
        capabilityLabel: capLabel('basic_discovery'),
        geographyMeaning: 'Principal-office state on Form ADV. Not client geography and not a Florida Intelligence OS page.',
        metrics: [
          {
            label: 'Roster firms with principal office in Florida',
            value: '1,284',
            grain: 'SEC/IARD roster firms with a resolved FL principal-office region.',
            officialAsOf: adv?.officialAsOf ?? '2026-08-27',
            limitation: 'A firm may serve clients elsewhere. Unresolved office rows exist nationally.',
            sourceFamilyId: 'sec-iard-adv',
          },
        ],
        destination: 'https://www.investortrusthub.com/firms?state=FL',
        destinationLabel: 'Search firms with Florida principal office',
        limitation: 'No enhanced Florida investor intelligence page is published.',
        researchAvailable: true,
      },
    ],
  };
}

export function browardPlaceLens(): PlaceLens {
  const dbpr = src('contractor', 'fl-dbpr');
  return {
    slug: 'broward',
    title: 'What does TrustHub know about Broward County?',
    kicker: 'Broward County Place Lens',
    summary:
      'ContractorTrustHub publishes Broward county credential intelligence. Other hubs currently have state or federal research — not Broward-specific Intelligence OS pages. Missing county capability is not zero activity.',
    geographyType: 'county',
    stateCode: 'FL',
    countySlug: 'broward',
    indexable: true,
    hubs: [
      {
        hubId: 'contractor',
        name: NETWORK_PUBLIC_NAMES.contractor,
        capability: 'enhanced_county_intelligence',
        capabilityLabel: capLabel('enhanced_county_intelligence'),
        geographyMeaning: 'Florida DBPR mailing/HQ county_code 16 (Broward). Not service territory, not local authorization, not permit activity.',
        metrics: [
          {
            label: 'Credentials with Broward mailing/base county',
            value: '11,568',
            grain: 'Florida contractor credentials whose DBPR license mailing county_code is 16.',
            officialAsOf: '2026-08-10',
            limitation: 'Credentials, not companies. HQ county is not jobsites.',
            sourceFamilyId: 'fl-dbpr',
          },
          {
            label: 'Active credentials, same county grain',
            value: '8,414',
            grain: 'Active is DBPR secondary status Active on that mailing-county universe.',
            officialAsOf: '2026-08-10',
            limitation: 'Not an active-business count and not local authorization.',
            sourceFamilyId: 'fl-dbpr',
          },
          {
            label: 'Active roofing credentials (CCC + RC)',
            value: '924',
            grain: 'Certified CCC and registered RC. RR is residential, not roofing.',
            officialAsOf: dbpr?.officialAsOf ?? '2026-08-10',
            limitation: '924 matching credential records on the county page. Ask does not rewrite this as trusted roofers.',
            sourceFamilyId: 'fl-dbpr',
          },
        ],
        destination: 'https://www.contractortrusthub.com/florida/broward',
        destinationLabel: 'Open Broward Contractor Intelligence',
        limitation: 'Local permit and local credential exports are pending. Missing export is not zero events.',
        researchAvailable: true,
      },
      {
        hubId: 'lender',
        name: NETWORK_PUBLIC_NAMES.lender,
        capability: 'state_research',
        capabilityLabel: 'State-level research available; county-specific intelligence not currently published.',
        geographyMeaning: 'HMDA property geography is not lender headquarters. Florida intelligence does not publish county market pages.',
        metrics: [],
        destination: 'https://www.lendertrusthub.com/florida',
        destinationLabel: 'Open Florida Mortgage Intelligence',
        limitation: 'County mortgage intelligence pages are not published. Ask can execute county HMDA property-geography queries separately. Do not invent Broward HMDA rankings on this lens.',
        researchAvailable: true,
      },
      {
        hubId: 'insurance',
        name: NETWORK_PUBLIC_NAMES.insurance,
        capability: 'state_research',
        capabilityLabel: 'State-level research available; county-specific intelligence not currently published.',
        geographyMeaning: 'Florida DFS/OIR research is statewide. No county inference from addresses or appointments.',
        metrics: [],
        destination: 'https://www.insurancetrusthub.com/florida',
        destinationLabel: 'Open Florida Insurance Intelligence',
        limitation: 'Directory ZIP search is not Broward Intelligence OS.',
        researchAvailable: true,
      },
      {
        hubId: 'move',
        name: NETWORK_PUBLIC_NAMES.move,
        capability: 'state_research',
        capabilityLabel: 'Statewide research only — not Enhanced Local Research.',
        geographyMeaning: 'Broward local-movers landing. No validated county credential census in production.',
        metrics: [],
        destination: 'https://www.movetrusthub.com/local-movers/florida/broward',
        destinationLabel: 'Open Broward moving landing',
        limitation: 'A landing page is not a mover count and is not quality.',
        researchAvailable: true,
      },
      {
        hubId: 'senior',
        name: NETWORK_PUBLIC_NAMES.senior,
        capability: 'federal_core',
        capabilityLabel: 'State-level research available; county-specific intelligence not currently published.',
        geographyMeaning: 'CMS directories are national; Florida AHCA overlays are state-level.',
        metrics: [],
        destination: 'https://www.seniortrusthub.com/florida',
        destinationLabel: 'Open Florida senior-care intelligence',
        limitation: 'No Broward SeniorTrustHub Intelligence OS page is published.',
        researchAvailable: true,
      },
      {
        hubId: 'investor',
        name: NETWORK_PUBLIC_NAMES.investor,
        capability: 'basic_discovery',
        capabilityLabel: 'State-level research available; county-specific intelligence not currently published.',
        geographyMeaning: 'Principal office is not county service territory.',
        metrics: [],
        destination: 'https://www.investortrusthub.com/firms?state=FL',
        destinationLabel: 'Search Florida principal-office firms',
        limitation: 'No Broward investor intelligence page.',
        researchAvailable: true,
      },
    ],
  };
}

export function palmBeachPlaceLens(): PlaceLens {
  return {
    slug: 'palm-beach',
    title: 'What does TrustHub know about Palm Beach County?',
    kicker: 'Palm Beach County Place Lens',
    summary:
      'ContractorTrustHub publishes a Palm Beach county intelligence page with the same mailing-county grain as Broward. Other hubs remain state or federal. Counts are not copied from Broward — open the specialist page for Palm Beach metrics.',
    geographyType: 'county',
    stateCode: 'FL',
    countySlug: 'palm-beach',
    indexable: true,
    hubs: [
      {
        hubId: 'contractor',
        name: NETWORK_PUBLIC_NAMES.contractor,
        capability: 'enhanced_county_intelligence',
        capabilityLabel: capLabel('enhanced_county_intelligence'),
        geographyMeaning: 'Florida DBPR mailing/HQ county for Palm Beach. Same grain as Broward — not service territory.',
        metrics: [
          {
            label: 'County Intelligence OS page',
            value: 'Published',
            grain: 'Dedicated /florida/palm-beach research page. Metrics live on the specialist hub.',
            officialAsOf: '2026-08-28',
            limitation: 'Ask does not invent Palm Beach counts. Permit volume is not compared to Broward here.',
            sourceFamilyId: 'fl-dbpr',
          },
        ],
        destination: 'https://www.contractortrusthub.com/florida/palm-beach',
        destinationLabel: 'Open Palm Beach Contractor Intelligence',
        limitation: 'Comparable to Broward on HQ/base credential definitions only. Permit metrics are not treated as equivalent coverage.',
        researchAvailable: true,
      },
      {
        hubId: 'lender',
        name: NETWORK_PUBLIC_NAMES.lender,
        capability: 'state_research',
        capabilityLabel: 'State-level research available; county-specific intelligence not currently published.',
        geographyMeaning: 'HMDA property geography is not lender HQ.',
        metrics: [],
        destination: 'https://www.lendertrusthub.com/florida',
        destinationLabel: 'Open Florida Mortgage Intelligence',
        limitation: 'No Palm Beach lender Intelligence OS page.',
        researchAvailable: true,
      },
      {
        hubId: 'insurance',
        name: NETWORK_PUBLIC_NAMES.insurance,
        capability: 'state_research',
        capabilityLabel: 'State-level research available; county-specific intelligence not currently published.',
        geographyMeaning: 'Florida state research only.',
        metrics: [],
        destination: 'https://www.insurancetrusthub.com/florida',
        destinationLabel: 'Open Florida Insurance Intelligence',
        limitation: 'No Palm Beach insurance Intelligence OS page.',
        researchAvailable: true,
      },
      {
        hubId: 'move',
        name: NETWORK_PUBLIC_NAMES.move,
        capability: 'state_research',
        capabilityLabel: 'Statewide research only — not Enhanced Local Research.',
        geographyMeaning: 'County credentials exist as research rows. Not Enhanced Local Research.',
        metrics: [],
        destination: 'https://www.movetrusthub.com/local-movers/florida/palm-beach',
        destinationLabel: 'Open Palm Beach moving landing',
        limitation: 'Different from Broward only in that county credential research rows exist internally — still not Enhanced.',
        researchAvailable: true,
      },
      {
        hubId: 'senior',
        name: NETWORK_PUBLIC_NAMES.senior,
        capability: 'federal_core',
        capabilityLabel: 'State-level research available; county-specific intelligence not currently published.',
        geographyMeaning: 'CMS + Florida AHCA are not Palm Beach Intelligence OS.',
        metrics: [],
        destination: 'https://www.seniortrusthub.com/florida',
        destinationLabel: 'Open Florida senior-care intelligence',
        limitation: 'No Palm Beach SeniorTrustHub page.',
        researchAvailable: true,
      },
      {
        hubId: 'investor',
        name: NETWORK_PUBLIC_NAMES.investor,
        capability: 'basic_discovery',
        capabilityLabel: 'State-level research available; county-specific intelligence not currently published.',
        geographyMeaning: 'Principal office is not county geography.',
        metrics: [],
        destination: 'https://www.investortrusthub.com/firms?state=FL',
        destinationLabel: 'Search Florida principal-office firms',
        limitation: 'No Palm Beach investor intelligence page.',
        researchAvailable: true,
      },
    ],
  };
}

export function placeLensBySlug(slug: string): PlaceLens | undefined {
  if (slug === 'florida') return floridaPlaceLens();
  if (slug === 'broward') return browardPlaceLens();
  if (slug === 'palm-beach') return palmBeachPlaceLens();
  return undefined;
}

export const PLACE_LENS_INDEX = [
  { href: '/places/florida', label: 'Florida', detail: 'What can TrustHub research in Florida?' },
  { href: '/places/florida/broward', label: 'Broward County', detail: 'County lens — contractor enhanced; others state/federal.' },
  { href: '/places/florida/palm-beach', label: 'Palm Beach County', detail: 'County lens — same contractor grain, different page, no copied Broward counts.' },
  { href: '/new-jersey', label: 'New Jersey', detail: 'Network gateway to specialist New Jersey research pages. Not a county page.' },
] as const;

const CALIFORNIA_PLACE = {
  href: '/california',
  label: 'California',
  detail: 'Network gateway to specialist California research pages. State-level only — not a county page.',
} as const;

const TEXAS_PLACE = {
  href: '/texas',
  label: 'Texas',
  detail: 'Network gateway to specialist Texas research pages. State-level only — not a city or county page.',
} as const;

const WASHINGTON_PLACE = {
  href: '/washington',
  label: 'Washington',
  detail: 'Network gateway to specialist Washington research pages. State-level only — not a city or county page.',
} as const;

const ARIZONA_PLACE = {
  href: '/arizona',
  label: 'Arizona',
  detail: 'Network gateway to specialist Arizona research pages. State-level only — not a city or county page.',
} as const;

export function listPlaceLensIndex(): Array<{ href: string; label: string; detail: string }> {
  const extra = [
    ...(caReleaseGatePassed() ? [CALIFORNIA_PLACE] : []),
    ...(txReleaseGatePassed() ? [TEXAS_PLACE] : []),
    ...(waReleaseGatePassed() ? [WASHINGTON_PLACE] : []),
    ...(azReleaseGatePassed() ? [ARIZONA_PLACE] : []),
  ];
  return [...PLACE_LENS_INDEX, ...extra];
}
