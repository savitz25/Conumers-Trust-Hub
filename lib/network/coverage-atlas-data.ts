import type { CoverageAtlasCell, CoverageLevel } from './coverage-atlas.ts';
import { HUB_CAPABILITY_REGISTRY } from './capability-registry.ts';
import { CANONICAL_ORIGINS, NETWORK_PUBLIC_NAMES, type SpecialistHubId } from './registry.ts';
import { US_JURISDICTIONS, type UsJurisdiction } from './us-jurisdictions.ts';

/** Production-audited 2026-08-29. Do not infer from roadmap. */
export const CONTRACTOR_LIVE_STATES = ['FL', 'TX', 'NJ', 'OR', 'WA', 'CA', 'AZ', 'LA', 'MS', 'KY'] as const;
export const CONTRACTOR_SPECIALTY_ONLY = ['TX', 'NJ', 'KY'] as const;
export const INSURANCE_DIRECTORY_STATES = ['FL', 'TX', 'VT', 'MA', 'OH'] as const;
export const ENHANCED_STATE_HUBS: Record<SpecialistHubId, readonly string[]> = {
  move: ['FL'],
  lender: ['FL'],
  insurance: ['FL'],
  contractor: ['FL'],
  senior: ['FL'],
  investor: [],
};

export const ENHANCED_COUNTIES: Array<{
  hubId: SpecialistHubId;
  state: string;
  countySlug: string;
  countyName: string;
  destination: string;
}> = [
  {
    hubId: 'contractor',
    state: 'FL',
    countySlug: 'broward',
    countyName: 'Broward County',
    destination: 'https://www.contractortrusthub.com/florida/broward',
  },
  {
    hubId: 'contractor',
    state: 'FL',
    countySlug: 'palm-beach',
    countyName: 'Palm Beach County',
    destination: 'https://www.contractortrusthub.com/florida/palm-beach',
  },
];

function dest(hubId: SpecialistHubId, j: UsJurisdiction): string | undefined {
  const origin = CANONICAL_ORIGINS[hubId];
  switch (hubId) {
    case 'move':
      if (j.code === 'FL') return `${origin}/florida`;
      return `${origin}/local-movers/${j.slug}`;
    case 'lender':
      if (j.code === 'FL') return `${origin}/florida`;
      return `${origin}/lender`;
    case 'insurance':
      if (j.code === 'FL') return `${origin}/florida`;
      if ((INSURANCE_DIRECTORY_STATES as readonly string[]).includes(j.code)) {
        return `${origin}/directory?state=${j.code}`;
      }
      return undefined;
    case 'contractor':
      if (j.code === 'FL') return `${origin}/florida`;
      if ((CONTRACTOR_LIVE_STATES as readonly string[]).includes(j.code)) {
        return `${origin}/verify?state=${j.code.toLowerCase()}`;
      }
      return undefined;
    case 'senior':
      if (j.code === 'FL') return `${origin}/florida`;
      return `${origin}/search?search=1&state=${j.code}`;
    case 'investor':
      return `${origin}/firms?state=${j.code}`;
  }
}

function cellFor(hubId: SpecialistHubId, j: UsJurisdiction): CoverageAtlasCell {
  const destination = dest(hubId, j);
  const name = NETWORK_PUBLIC_NAMES[hubId];

  if (hubId === 'move') {
    if (j.code === 'FL') {
      return {
        hubId,
        geographyType: 'state',
        geographyCode: j.code,
        status: 'enhanced_state_intelligence',
        why: 'Florida Moving Intelligence (FDACS registrations + Florida-HQ directory profiles). Headquarters is not service territory.',
        destination,
        dedicatedPage: true,
      };
    }
    return {
      hubId,
      geographyType: 'state',
      geographyCode: j.code,
      status: 'basic_discovery',
      why: `${name} publishes a ${j.name} local-movers landing. That is site coverage, not enhanced state intelligence and not a mover census.`,
      destination,
      dedicatedPage: true,
    };
  }

  if (hubId === 'lender') {
    if (j.code === 'FL') {
      return {
        hubId,
        geographyType: 'state',
        geographyCode: j.code,
        status: 'enhanced_state_intelligence',
        why: 'Florida Mortgage Intelligence: OFR Chapter 494 credentials, HMDA Florida state-grain activity, CFPB Florida-reported complaints. PRIM COUNTY is not service territory.',
        destination,
        dedicatedPage: true,
      };
    }
    return {
      hubId,
      geographyType: 'state',
      geographyCode: j.code,
      status: 'federal_core',
      why: `National lender research and HMDA county-grain activity are available. ${j.name} does not currently have a dedicated state intelligence page — the map cell opens national lender research, not a unique ${j.name} report.`,
      destination,
      dedicatedPage: false,
    };
  }

  if (hubId === 'insurance') {
    if (j.code === 'FL') {
      return {
        hubId,
        geographyType: 'state',
        geographyCode: j.code,
        status: 'enhanced_state_intelligence',
        why: 'Florida Insurance Intelligence: DFS credentials, OIR company identity, MIR residential market extract. County inference from addresses is not published.',
        destination,
        dedicatedPage: true,
      };
    }
    if ((INSURANCE_DIRECTORY_STATES as readonly string[]).includes(j.code)) {
      return {
        hubId,
        geographyType: 'state',
        geographyCode: j.code,
        status: 'state_research',
        why: `${j.name} has public directory listings filtered by state. That is not an Insurance Intelligence OS page.`,
        destination,
        dedicatedPage: false,
      };
    }
    return {
      hubId,
      geographyType: 'state',
      geographyCode: j.code,
      status: 'not_yet_researched',
      why: `No ${j.name} insurance intelligence page is published. Missing is not zero licenses.`,
      dedicatedPage: false,
    };
  }

  if (hubId === 'contractor') {
    if (j.code === 'FL') {
      return {
        hubId,
        geographyType: 'state',
        geographyCode: j.code,
        status: 'enhanced_state_intelligence',
        why: 'Florida Contractor Intelligence (DBPR) plus enhanced county pages for Broward and Palm Beach. Mailing county is not service territory.',
        destination,
        dedicatedPage: true,
      };
    }
    if ((CONTRACTOR_LIVE_STATES as readonly string[]).includes(j.code)) {
      const specialty = (CONTRACTOR_SPECIALTY_ONLY as readonly string[]).includes(j.code);
      return {
        hubId,
        geographyType: 'state',
        geographyCode: j.code,
        status: 'state_research',
        why: specialty
          ? `${j.name} is live specialty Verify in this product (no statewide general-contractor class). Confirm on the official board.`
          : `${j.name} has statewide credential Verify. No Intelligence OS state/county page is published yet.`,
        destination,
        dedicatedPage: true,
      };
    }
    return {
      hubId,
      geographyType: 'state',
      geographyCode: j.code,
      status: 'not_yet_researched',
      why: `${j.name} is not a live researched contractor state in this product. Wisconsin is configured but not live. Missing is not unlicensed.`,
      dedicatedPage: false,
    };
  }

  if (hubId === 'senior') {
    if (j.code === 'FL') {
      return {
        hubId,
        geographyType: 'state',
        geographyCode: j.code,
        status: 'enhanced_state_intelligence',
        why: 'Florida senior-care intelligence: AHCA licensing overlays plus CMS class context. Nursing homes, home health, and hospice stay separate.',
        destination,
        dedicatedPage: true,
      };
    }
    return {
      hubId,
      geographyType: 'state',
      geographyCode: j.code,
      status: 'federal_core',
      why: `CMS directory search is available for ${j.name}. No SeniorTrustHub state intelligence page is published. Color on the specialist map is directory volume, not quality.`,
      destination,
      dedicatedPage: false,
    };
  }

  return {
    hubId: 'investor',
    geographyType: 'state',
    geographyCode: j.code,
    status: 'basic_discovery',
    why: `Firm search can filter principal-office state ${j.code}. Principal office is not client geography and is not an enhanced state intelligence page.`,
    destination,
    dedicatedPage: false,
  };
}

export function coverageAtlasCells(): CoverageAtlasCell[] {
  const hubs = Object.keys(HUB_CAPABILITY_REGISTRY) as SpecialistHubId[];
  return hubs.flatMap((hubId) => US_JURISDICTIONS.map((j) => cellFor(hubId, j)));
}

export function coverageCounts(): Record<CoverageLevel, number> {
  const counts: Record<CoverageLevel, number> = {
    federal_core: 0,
    basic_discovery: 0,
    state_research: 0,
    enhanced_state_intelligence: 0,
    enhanced_county_intelligence: 0,
    not_yet_researched: 0,
  };
  for (const cell of coverageAtlasCells()) counts[cell.status] += 1;
  return counts;
}

export function cellAt(hubId: SpecialistHubId, stateCode: string): CoverageAtlasCell | undefined {
  return coverageAtlasCells().find((c) => c.hubId === hubId && c.geographyCode === stateCode);
}
