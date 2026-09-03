import manifestJson from '../../data/network/new-jersey-county-publication-manifest.json' with { type: 'json' };
import type { SpecialistHubId } from './registry.ts';
import { CANONICAL_ORIGINS } from './registry.ts';

export const NJ_COUNTY_NETWORK_CONTRACT = 'ath-nj-county-network-v1' as const;

export type NjPilotCountySlug =
  | 'monmouth-county'
  | 'middlesex-county'
  | 'somerset-county'
  | 'union-county';

export const NJ_COUNTY_MANIFEST = manifestJson;

export const NJ_PILOT_COUNTY_SLUGS: readonly NjPilotCountySlug[] = [
  'monmouth-county',
  'middlesex-county',
  'somerset-county',
  'union-county',
] as const;

export type NjCountyRecord = (typeof NJ_COUNTY_MANIFEST)['counties'][number];

export function listNjPilotCounties(): NjCountyRecord[] {
  return NJ_COUNTY_MANIFEST.counties;
}

export function njCountyBySlug(slug: string): NjCountyRecord | undefined {
  return NJ_COUNTY_MANIFEST.counties.find((c) => c.county_slug === slug);
}

export function seniorCountyGatePassed(): boolean {
  return NJ_COUNTY_MANIFEST.release_gate.senior === true;
}

export function njCountyPilotComplete(): boolean {
  const g = NJ_COUNTY_MANIFEST.release_gate;
  return g.contractor && g.lender && g.senior && g.ask_gateways && g.passed;
}

const NAME_TO_SLUG: Record<string, NjPilotCountySlug> = {
  monmouth: 'monmouth-county',
  middlesex: 'middlesex-county',
  somerset: 'somerset-county',
  union: 'union-county',
};

export function detectNjPilotCountySlug(query: string): NjPilotCountySlug | undefined {
  const m = query.match(/\b(monmouth|middlesex|somerset|union)\s+county\b/i);
  if (!m) return undefined;
  return NAME_TO_SLUG[m[1].toLowerCase()];
}

export function withCountyIntent(url: string, slug: NjPilotCountySlug): string {
  const dest = new URL(url);
  dest.searchParams.set('src', 'ask');
  dest.searchParams.set('state', 'NJ');
  dest.searchParams.set('county', slug.replace(/-county$/, ''));
  return dest.toString();
}

export function njCountySpecialistUrl(hubId: SpecialistHubId, slug?: NjPilotCountySlug): string {
  const stateUrl = `${CANONICAL_ORIGINS[hubId]}/new-jersey`;
  if (!slug) return stateUrl;
  const county = njCountyBySlug(slug);
  if (!county) return stateUrl;
  const route = county.specialist_routes[hubId];
  if (hubId === 'senior' && !seniorCountyGatePassed()) {
    return withCountyIntent(stateUrl, slug);
  }
  if (route.dedicated_county_page) return route.url;
  return withCountyIntent(route.url, slug);
}

export function dedicatedCountyPage(hubId: SpecialistHubId, slug?: NjPilotCountySlug): boolean {
  if (!slug) return false;
  if (hubId === 'contractor' || hubId === 'lender') return true;
  if (hubId === 'senior') return seniorCountyGatePassed();
  return false;
}

export function njCountyAskPath(slug: NjPilotCountySlug): string {
  return `/new-jersey/${slug}`;
}

export function isNjPilotCountySlug(value: string): value is NjPilotCountySlug {
  return (NJ_PILOT_COUNTY_SLUGS as readonly string[]).includes(value);
}

export const NJ_COUNTY_CARD_FACTS: Record<
  NjPilotCountySlug,
  {
    contractor: string[];
    lender: string[];
    senior: string[];
    insurance: string[];
    move: string[];
    investor: string[];
    starters: Array<{ q: string; hub: string }>;
  }
> = {
  'monmouth-county': {
    contractor: [
      '260,591 construction source records on the live Contractor county page.',
      '53 of 53 municipalities reporting in that extract.',
      'NJSAVI certified-vendor research is available there. Certified vendor is not a state contractor license.',
      'Construction source records are not permits or projects.',
    ],
    lender: [
      '26,425 HMDA 2025 applications for properties in Monmouth County.',
      '16.43% denial rate (denials ÷ applications). Denial rate is not a quality score.',
      'Eligible borrowers may qualify for up to $22,000 potential NJHMFA DPA. County does not establish eligibility.',
    ],
    senior: [
      'NJDOH county projections include 86 All_LTC records and 99 All_Acute records. These are separate licensed universes, not one senior-provider total.',
      'County aging resources include ADRC, 12 senior centers, and meal programs. A county resource is not a licensed facility. BoldAge PACE Oceanport is listed as operating; a center address is not a service area.',
    ],
    insurance: [
      'Flood, hazard, and property context can inform consumer research. Insurer authorization and regulatory evidence remain primarily state-level.',
      'InsuranceTrustHub does not publish a dedicated county regulatory database. No hazard score is created here.',
    ],
    move: [
      'New Jersey intrastate PM/PW/PC authority remains state-level. FMCSA interstate authority remains federal.',
      'County Consumer Affairs complaint lookup may exist; bulk history is not currently acquired. County data absence is not zero complaints. There is no county-licensed mover claim.',
    ],
    investor: [
      'Adviser and securities regulation remains state and federal. County property or business context can add local research context.',
      'Exact adviser and firm research belongs in InvestorTrustHub New Jersey. This page does not imply county adviser licensing.',
    ],
    starters: [
      { q: 'Show construction activity in Monmouth County', hub: 'Contractor' },
      { q: 'Find senior-care information in Monmouth County', hub: 'Senior' },
      { q: 'Research investment advisers in Monmouth County', hub: 'Investor' },
    ],
  },
  'middlesex-county': {
    contractor: [
      '252,664 construction source records on the live Contractor county page.',
      '25 of 25 municipalities reporting in that extract, with county zoning and redevelopment context.',
      'NJSAVI certified-vendor research is available there. Certified vendor is not a state contractor license.',
      'Construction source records are not permits or projects.',
    ],
    lender: [
      '26,149 HMDA 2025 applications for properties in Middlesex County.',
      '18.29% denial rate (denials ÷ applications). Denial rate is not a quality score.',
      'Same current NJHMFA 12-county DPA group: eligible borrowers may qualify for up to $22,000. County does not establish eligibility.',
    ],
    senior: [
      'NJDOH county projections include 81 All_LTC records and 109 All_Acute records. These universes stay separate.',
      'Official county pages list congregate meal sites and municipal senior centers. A listed center is a county resource, not a licensed facility. BoldAge PACE East Brunswick is listed as operating; a center address is not a service area.',
    ],
    insurance: [
      'Flood, hazard, and property context can inform consumer research. Insurer authorization and regulatory evidence remain primarily state-level.',
      'InsuranceTrustHub does not publish a dedicated county regulatory database. No hazard score is created here.',
    ],
    move: [
      'New Jersey intrastate PM/PW/PC authority remains state-level. FMCSA interstate authority remains federal.',
      'County Consumer Affairs complaint lookup may exist; bulk history is not currently acquired. County data absence is not zero complaints.',
    ],
    investor: [
      'Adviser and securities regulation remains state and federal. Exact adviser and firm research belongs in InvestorTrustHub New Jersey.',
      'This page does not imply county adviser licensing.',
    ],
    starters: [
      { q: 'Find contractor research in Middlesex County', hub: 'Contractor' },
      { q: 'What down payment assistance applies in Middlesex County?', hub: 'Lender' },
      { q: 'How do I verify a mover for a move inside Middlesex County?', hub: 'Move' },
    ],
  },
  'somerset-county': {
    contractor: [
      '135,311 construction source records on the live Contractor county page.',
      '21 of 21 municipalities reporting, with sewer and GIS context on ContractorTrustHub.',
      'NJSAVI certified-vendor research is available there. Certified vendor is not a state contractor license.',
      'Construction source records are not permits or projects.',
    ],
    lender: [
      '11,584 HMDA 2025 applications for properties in Somerset County.',
      '15.48% denial rate (denials ÷ applications). Denial rate is not a quality score.',
      'Same current NJHMFA 12-county DPA group: eligible borrowers may qualify for up to $22,000.',
    ],
    senior: [
      'NJDOH county projections include 45 All_LTC records and 51 All_Acute records. These universes stay separate.',
      'A separate May 2023 Somerset County planning inventory lists 58 senior-related Housing Options records. Planning inventory is not NJDOH licensure. Senior LIFE Bridgewater is listed as in development, not operating.',
    ],
    insurance: [
      'Flood, hazard, and property context can inform consumer research. Insurer authorization remains primarily state-level.',
      'No dedicated Insurance county page and no hazard score.',
    ],
    move: [
      'New Jersey mover authority remains state-level. FMCSA interstate authority remains federal.',
      'County data absence is not zero complaints. There is no county-licensed mover claim.',
    ],
    investor: [
      'Adviser and securities regulation remains state and federal. County property data is not securities regulation.',
      'Exact firm research belongs in InvestorTrustHub New Jersey.',
    ],
    starters: [
      { q: 'What does mortgage activity look like in Somerset County?', hub: 'Lender' },
      { q: 'What senior housing does Somerset County list?', hub: 'Senior' },
      { q: 'Show construction activity in Somerset County', hub: 'Contractor' },
    ],
  },
  'union-county': {
    contractor: [
      '153,910 construction source records on the live Contractor county page.',
      '20 of 21 municipalities reporting; Winfield Township is a known non-reporter (coverage gap, not zero activity).',
      'Home Improvement Program context is on the Contractor page and is not a Union County contractor license.',
      'NJSAVI certified-vendor research is available there. Certified vendor is not a state contractor license.',
    ],
    lender: [
      '16,330 HMDA 2025 applications for properties in Union County.',
      '18.73% denial rate (denials ÷ applications). Denial rate is not a quality score.',
      'Same current NJHMFA 12-county DPA group: eligible borrowers may qualify for up to $22,000.',
    ],
    senior: [
      'NJDOH county projections include 46 All_LTC records and 74 All_Acute records. These universes stay separate.',
      'Union County ADRC and dated Senior Home Improvement Grant information (ages 62+, cap $10,000 as of 2026-01-14) are county programs, not licensed facilities. Lutheran Senior LIFE at Union is listed as operating; a center address is not a service area.',
    ],
    insurance: [
      'Flood, hazard, and property context can inform consumer research. Insurer authorization remains primarily state-level.',
      'InsuranceTrustHub does not publish a dedicated county regulatory database.',
    ],
    move: [
      'New Jersey mover authority remains state-level. FMCSA interstate authority remains federal.',
      'County Consumer Affairs complaint lookup may exist; bulk history is not currently acquired. A county consumer complaint is not a violation.',
    ],
    investor: [
      'Adviser and securities regulation remains state and federal. Exact firm research belongs in InvestorTrustHub New Jersey.',
      'This page does not imply county adviser licensing.',
    ],
    starters: [
      { q: 'What does Union County show about construction?', hub: 'Contractor' },
      { q: 'What insurance research is available for Union County?', hub: 'Insurance' },
      { q: 'What does mortgage activity look like in Union County?', hub: 'Lender' },
    ],
  },
};

export const HUB_CARD_ORDER: SpecialistHubId[] = [
  'contractor',
  'lender',
  'senior',
  'insurance',
  'move',
  'investor',
];

export const HUB_CARD_TITLES: Record<SpecialistHubId, string> = {
  contractor: 'Contractor',
  lender: 'Lender',
  senior: 'Senior',
  insurance: 'Insurance',
  move: 'Move',
  investor: 'Investor',
};

export function specialistCtaLabel(hubId: SpecialistHubId, dedicated: boolean, countyName: string): string {
  if (dedicated) return `Open ${HUB_CARD_TITLES[hubId]} ${countyName} County`;
  return `Open ${HUB_CARD_TITLES[hubId]} New Jersey`;
}

