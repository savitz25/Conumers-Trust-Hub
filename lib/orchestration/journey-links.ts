/**
 * Stage B.2 / Stage A′ — shared non-PII journey param contract (Ask side).
 * Specialist hubs parse the same query keys.
 *
 * Example:
 *   ?src=ask&journey=relocate&state=FL&county=miami-dade&intent=buy
 */

export type JourneySrc =
  | 'move'
  | 'lender'
  | 'insurance'
  | 'contractor'
  | 'senior'
  | 'investor'
  | 'ask';
export type JourneyKind =
  | 'relocate'
  | 'purchase'
  | 'refi'
  | 'coverage'
  | 'senior_care'
  | 'investing'
  | 'contractor'
  | 'unknown';
export type JourneyIntent = 'buy' | 'rent' | 'refi' | 'unknown';
export type JourneyHub = 'move' | 'lender' | 'insurance' | 'contractor' | 'senior' | 'investor';

export type JourneyContext = {
  src?: JourneySrc;
  journey?: JourneyKind;
  stateSlug?: string;
  stateCode?: string;
  stateName?: string;
  county?: string;
  intent?: JourneyIntent;
  /** Optional city slug for Move city hubs when known */
  citySlug?: string;
};

const HUB_ORIGIN = {
  move: 'https://www.movetrusthub.com',
  insurance: 'https://www.insurancetrusthub.com',
  lender: 'https://www.lendertrusthub.com',
  contractor: 'https://www.contractortrusthub.com',
  senior: 'https://www.seniortrusthub.com',
  investor: 'https://www.investortrusthub.com',
  ask: 'https://www.asktrusthub.com',
} as const;

/** Insurance destination guides that exist on production (keep in sync). */
export const INSURANCE_DESTINATION_SLUGS = new Set([
  'florida',
  'texas',
  'california',
  'illinois',
  'new-york',
  'north-carolina',
]);

/** Compact US state table for destination selectors. */
export const US_STATES: { code: string; slug: string; name: string }[] = [
  { code: 'AL', slug: 'alabama', name: 'Alabama' },
  { code: 'AK', slug: 'alaska', name: 'Alaska' },
  { code: 'AZ', slug: 'arizona', name: 'Arizona' },
  { code: 'AR', slug: 'arkansas', name: 'Arkansas' },
  { code: 'CA', slug: 'california', name: 'California' },
  { code: 'CO', slug: 'colorado', name: 'Colorado' },
  { code: 'CT', slug: 'connecticut', name: 'Connecticut' },
  { code: 'DE', slug: 'delaware', name: 'Delaware' },
  { code: 'DC', slug: 'district-of-columbia', name: 'District of Columbia' },
  { code: 'FL', slug: 'florida', name: 'Florida' },
  { code: 'GA', slug: 'georgia', name: 'Georgia' },
  { code: 'HI', slug: 'hawaii', name: 'Hawaii' },
  { code: 'ID', slug: 'idaho', name: 'Idaho' },
  { code: 'IL', slug: 'illinois', name: 'Illinois' },
  { code: 'IN', slug: 'indiana', name: 'Indiana' },
  { code: 'IA', slug: 'iowa', name: 'Iowa' },
  { code: 'KS', slug: 'kansas', name: 'Kansas' },
  { code: 'KY', slug: 'kentucky', name: 'Kentucky' },
  { code: 'LA', slug: 'louisiana', name: 'Louisiana' },
  { code: 'ME', slug: 'maine', name: 'Maine' },
  { code: 'MD', slug: 'maryland', name: 'Maryland' },
  { code: 'MA', slug: 'massachusetts', name: 'Massachusetts' },
  { code: 'MI', slug: 'michigan', name: 'Michigan' },
  { code: 'MN', slug: 'minnesota', name: 'Minnesota' },
  { code: 'MS', slug: 'mississippi', name: 'Mississippi' },
  { code: 'MO', slug: 'missouri', name: 'Missouri' },
  { code: 'MT', slug: 'montana', name: 'Montana' },
  { code: 'NE', slug: 'nebraska', name: 'Nebraska' },
  { code: 'NV', slug: 'nevada', name: 'Nevada' },
  { code: 'NH', slug: 'new-hampshire', name: 'New Hampshire' },
  { code: 'NJ', slug: 'new-jersey', name: 'New Jersey' },
  { code: 'NM', slug: 'new-mexico', name: 'New Mexico' },
  { code: 'NY', slug: 'new-york', name: 'New York' },
  { code: 'NC', slug: 'north-carolina', name: 'North Carolina' },
  { code: 'ND', slug: 'north-dakota', name: 'North Dakota' },
  { code: 'OH', slug: 'ohio', name: 'Ohio' },
  { code: 'OK', slug: 'oklahoma', name: 'Oklahoma' },
  { code: 'OR', slug: 'oregon', name: 'Oregon' },
  { code: 'PA', slug: 'pennsylvania', name: 'Pennsylvania' },
  { code: 'RI', slug: 'rhode-island', name: 'Rhode Island' },
  { code: 'SC', slug: 'south-carolina', name: 'South Carolina' },
  { code: 'SD', slug: 'south-dakota', name: 'South Dakota' },
  { code: 'TN', slug: 'tennessee', name: 'Tennessee' },
  { code: 'TX', slug: 'texas', name: 'Texas' },
  { code: 'UT', slug: 'utah', name: 'Utah' },
  { code: 'VT', slug: 'vermont', name: 'Vermont' },
  { code: 'VA', slug: 'virginia', name: 'Virginia' },
  { code: 'WA', slug: 'washington', name: 'Washington' },
  { code: 'WV', slug: 'west-virginia', name: 'West Virginia' },
  { code: 'WI', slug: 'wisconsin', name: 'Wisconsin' },
  { code: 'WY', slug: 'wyoming', name: 'Wyoming' },
];

const STATE_BY_CODE = new Map(US_STATES.map((s) => [s.code, s]));
const STATE_BY_SLUG = new Map(US_STATES.map((s) => [s.slug, s]));

/** Known Move city hubs that deep-link reliably (fail soft otherwise). */
export const MOVE_CITY_HUBS: {
  citySlug: string;
  stateCode: string;
  countySlug?: string;
  label: string;
}[] = [
  { citySlug: 'miami', stateCode: 'FL', countySlug: 'miami-dade', label: 'Miami, FL' },
  {
    citySlug: 'fort-lauderdale',
    stateCode: 'FL',
    countySlug: 'broward',
    label: 'Fort Lauderdale, FL',
  },
  { citySlug: 'tampa', stateCode: 'FL', countySlug: 'hillsborough', label: 'Tampa, FL' },
  { citySlug: 'orlando', stateCode: 'FL', countySlug: 'orange', label: 'Orlando, FL' },
];

export function normalizeState(raw?: string): {
  stateSlug: string;
  stateCode: string;
  stateName: string;
} | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  if (t.length === 2) {
    const meta = STATE_BY_CODE.get(t.toUpperCase());
    if (meta) return { stateSlug: meta.slug, stateCode: meta.code, stateName: meta.name };
  }
  const slug = t.toLowerCase().replace(/\s+/g, '-');
  const bySlug = STATE_BY_SLUG.get(slug);
  if (bySlug) {
    return { stateSlug: bySlug.slug, stateCode: bySlug.code, stateName: bySlug.name };
  }
  const byName = US_STATES.find((s) => s.name.toLowerCase() === t.toLowerCase());
  if (byName) {
    return { stateSlug: byName.slug, stateCode: byName.code, stateName: byName.name };
  }
  return null;
}

export function normalizeCountySlug(raw?: string): string | undefined {
  if (!raw) return undefined;
  const s = raw
    .toLowerCase()
    .replace(/county/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return s || undefined;
}

export function placeLabel(ctx: JourneyContext): string | null {
  if (ctx.county && ctx.stateName) {
    const countyName = ctx.county
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    return `${countyName} County, ${ctx.stateName}`;
  }
  if (ctx.stateName) return ctx.stateName;
  if (ctx.stateCode) return ctx.stateCode;
  return null;
}

export function buildJourneyQuery(ctx: JourneyContext): string {
  const p = new URLSearchParams();
  p.set('src', ctx.src ?? 'ask');
  if (ctx.journey && ctx.journey !== 'unknown') p.set('journey', ctx.journey);
  if (ctx.stateCode) p.set('state', ctx.stateCode);
  else if (ctx.stateSlug) p.set('state', ctx.stateSlug);
  if (ctx.county) p.set('county', ctx.county);
  if (ctx.intent && ctx.intent !== 'unknown') p.set('intent', ctx.intent);
  return p.toString();
}

export function withJourneyParams(path: string, ctx: JourneyContext): string {
  const q = buildJourneyQuery(ctx);
  if (!q) return path;
  return path.includes('?') ? `${path}&${q}` : `${path}?${q}`;
}

export function absoluteHubUrl(hub: JourneyHub, pathWithQuery: string): string {
  const path = pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`;
  return `${HUB_ORIGIN[hub]}${path}`;
}

/** Lender: county → state → national hub. */
export function buildLenderDeepLink(ctx: JourneyContext): string {
  const base: JourneyContext = { ...ctx, src: 'ask' };
  if (base.stateSlug && base.county) {
    return absoluteHubUrl(
      'lender',
      withJourneyParams(`/local-lenders/${base.stateSlug}/${base.county}`, base)
    );
  }
  if (base.stateSlug) {
    return absoluteHubUrl(
      'lender',
      withJourneyParams(`/local-lenders/${base.stateSlug}`, base)
    );
  }
  return absoluteHubUrl('lender', withJourneyParams('/local-lenders', base));
}

/** Insurance: published destination guide or soft hub/directory entry. */
export function buildInsuranceDeepLink(ctx: JourneyContext): string {
  const base: JourneyContext = { ...ctx, src: 'ask' };
  if (base.stateSlug && INSURANCE_DESTINATION_SLUGS.has(base.stateSlug)) {
    return absoluteHubUrl(
      'insurance',
      withJourneyParams(`/destinations/${base.stateSlug}`, base)
    );
  }
  if (base.stateCode || base.stateSlug) {
    // Soft-land via destinations hub (Insurance redirects when state known)
    return absoluteHubUrl('insurance', withJourneyParams('/destinations', base));
  }
  return absoluteHubUrl('insurance', withJourneyParams('/destinations', base));
}

/**
 * Move: city hub when known, else state mover hub, else site root with params.
 */
export function buildMoveDeepLink(ctx: JourneyContext): string {
  const base: JourneyContext = { ...ctx, src: 'ask' };
  if (base.citySlug) {
    const known = MOVE_CITY_HUBS.find((c) => c.citySlug === base.citySlug);
    if (known) {
      // Nested FL paths exist for some cities; prefer short slug when published
      if (known.stateCode === 'FL' && known.citySlug === 'fort-lauderdale') {
        return absoluteHubUrl(
          'move',
          withJourneyParams(`/moving-to/florida/${known.citySlug}`, base)
        );
      }
      return absoluteHubUrl('move', withJourneyParams(`/moving-to/${known.citySlug}`, base));
    }
  }
  if (base.stateSlug && base.county) {
    return absoluteHubUrl(
      'move',
      withJourneyParams(`/local-movers/${base.stateSlug}/${base.county}`, base)
    );
  }
  if (base.stateSlug) {
    return absoluteHubUrl(
      'move',
      withJourneyParams(`/local-movers/${base.stateSlug}`, base)
    );
  }
  return absoluteHubUrl('move', withJourneyParams('/', base));
}

export function hubDisplayName(hub: JourneyHub): string {
  if (hub === 'move') return 'Move Trust Hub';
  if (hub === 'lender') return 'Lender Trust Hub';
  if (hub === 'insurance') return 'Insurance Trust Hub';
  if (hub === 'contractor') return 'Contractor Trust Hub';
  if (hub === 'senior') return 'SeniorTrustHub';
  return 'InvestorTrustHub';
}

/** Homepage-only handoff — do not invent crawlable landing pages. */
export function buildContractorDeepLink(ctx: JourneyContext): string {
  return absoluteHubUrl('contractor', withJourneyParams('/', { ...ctx, src: 'ask' }));
}

export function buildSeniorDeepLink(ctx: JourneyContext): string {
  return absoluteHubUrl('senior', withJourneyParams('/', { ...ctx, src: 'ask' }));
}

export function buildInvestorDeepLink(ctx: JourneyContext): string {
  return absoluteHubUrl('investor', withJourneyParams('/', { ...ctx, src: 'ask' }));
}
