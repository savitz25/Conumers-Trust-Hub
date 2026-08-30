/**
 * network-entity-destination-v1
 *
 * Parent navigation contract for federated Ask result cards.
 * Does not change specialist evidence, publication eligibility, or ranking.
 * A research identity is never treated as a published profile.
 */

import { CANONICAL_ORIGINS, NETWORK_PUBLIC_NAMES, type SpecialistHubId } from './registry.ts';

export const ENTITY_DESTINATION_CONTRACT = 'network-entity-destination-v1' as const;

export type PublicationState = 'public_profile' | 'research_identity';

export type StableIdentifierType =
  | 'crd'
  | 'npn'
  | 'naic'
  | 'usdot'
  | 'mc'
  | 'nmls'
  | 'lei'
  | 'cms_ccn'
  | 'license';

export type StableIdentifier = {
  type: StableIdentifierType;
  value: string;
};

export type EntityDestination = {
  contract: typeof ENTITY_DESTINATION_CONTRACT;
  hub: SpecialistHubId;
  entityType: string;
  stableIdentifier?: StableIdentifier;
  publicationState: PublicationState;
  canonicalProfileUrl?: string;
  specialistHandoffUrl: string;
  href: string;
  ctaLabel: string;
};

export type DestinationContext = {
  originalQuery: string;
  searchQuery?: string;
  geography?: string;
};

export type EntityNavInput = {
  hubId: SpecialistHubId;
  name: string;
  entityType: string;
  identifier?: StableIdentifier;
  specialistHref?: string | null;
  publicationNote?: string | null;
  identityStatus?: string | null;
};

const PROFILE_PATH: Record<SpecialistHubId, RegExp> = {
  investor: /^\/firm\//i,
  contractor: /^\/contractors\//i,
  move: /^\/companies\//i,
  lender: /^\/lenders?\//i,
  senior: /^\/facility\//i,
  insurance: /^\/(agenc(?:y|ies)|carriers?|producers?|insurers?|directory)\//i,
};

export function isUnpublishedResearchIdentity(input: Pick<EntityNavInput, 'publicationNote' | 'identityStatus' | 'specialistHref'>): boolean {
  const status = (input.identityStatus ?? '').toLowerCase();
  if (/(unpublished|research_identity|lei_only|identity_hold)/.test(status) && status !== 'public_profile') {
    return true;
  }
  if (/not currently published|unpublished|research identity/i.test(input.publicationNote ?? '')) {
    return true;
  }
  return false;
}

export function absoluteSpecialistUrl(hubId: SpecialistHubId, href?: string | null): string | undefined {
  if (!href) return undefined;
  if (/^https?:\/\//i.test(href)) return href;
  if (!href.startsWith('/')) return undefined;
  return `${CANONICAL_ORIGINS[hubId]}${href}`;
}

function isCanonicalProfileUrl(hubId: SpecialistHubId, url: string): boolean {
  try {
    const parsed = new URL(url);
    const origin = CANONICAL_ORIGINS[hubId];
    if (parsed.origin !== new URL(origin).origin) return false;
    return PROFILE_PATH[hubId].test(parsed.pathname);
  } catch {
    return false;
  }
}

function applyAskAttribution(url: URL, ctx: DestinationContext, input: EntityNavInput): void {
  url.searchParams.set('src', 'asktrusthub');
  if (ctx.originalQuery) url.searchParams.set('from_q', ctx.originalQuery.slice(0, 200));
  if (ctx.geography) url.searchParams.set('geo', ctx.geography);
  if (input.entityType) url.searchParams.set('entity', input.entityType);
  if (input.identifier) {
    url.searchParams.set('id_type', input.identifier.type);
    url.searchParams.set('id', input.identifier.value);
  }
}

function identifierQuery(id: StableIdentifier): string {
  switch (id.type) {
    case 'crd':
      return `Find CRD ${id.value}`;
    case 'npn':
      return `Find NPN ${id.value}`;
    case 'naic':
      return `Find insurer NAIC code ${id.value}`;
    case 'usdot':
      return `Find USDOT ${id.value}`;
    case 'mc':
      return `Find MC ${id.value}`;
    case 'cms_ccn':
      return `Find CMS CCN ${id.value}`;
    case 'nmls':
      return `NMLS ${id.value}`;
    case 'lei':
      return `LEI ${id.value}`;
    case 'license':
      return id.value;
  }
}

export function specialistHandoffUrl(input: EntityNavInput, ctx: DestinationContext): string {
  const origin = CANONICAL_ORIGINS[input.hubId];
  const q =
    (input.identifier ? identifierQuery(input.identifier) : undefined) ||
    ctx.searchQuery ||
    input.name ||
    ctx.originalQuery;

  if (input.hubId === 'senior') {
    const url = new URL('/search', origin);
    url.searchParams.set('q', q);
    applyAskAttribution(url, ctx, input);
    return url.toString();
  }

  if (input.hubId === 'contractor' && input.identifier?.type === 'license' && !input.specialistHref) {
    const url = new URL('/verify', origin);
    url.searchParams.set('q', input.identifier.value);
    applyAskAttribution(url, ctx, input);
    return url.toString();
  }

  const url = new URL('/ask', origin);
  url.searchParams.set('q', q);
  applyAskAttribution(url, ctx, input);
  return url.toString();
}

export function resolveEntityDestination(input: EntityNavInput, ctx: DestinationContext): EntityDestination {
  const unpublished = isUnpublishedResearchIdentity(input);
  const supplied = unpublished ? undefined : absoluteSpecialistUrl(input.hubId, input.specialistHref);
  const canonicalProfileUrl = supplied && isCanonicalProfileUrl(input.hubId, supplied) ? supplied : undefined;
  const publicationState: PublicationState = canonicalProfileUrl ? 'public_profile' : 'research_identity';
  const specialistHandoff = specialistHandoffUrl(input, ctx);
  const href = canonicalProfileUrl
    ? (() => {
        const url = new URL(canonicalProfileUrl);
        applyAskAttribution(url, ctx, input);
        return url.toString();
      })()
    : specialistHandoff;
  const hubName = NETWORK_PUBLIC_NAMES[input.hubId];
  return {
    contract: ENTITY_DESTINATION_CONTRACT,
    hub: input.hubId,
    entityType: input.entityType,
    stableIdentifier: input.identifier,
    publicationState,
    canonicalProfileUrl,
    specialistHandoffUrl: specialistHandoff,
    href,
    ctaLabel: publicationState === 'public_profile' ? `View in ${hubName} →` : `Research in ${hubName} →`,
  };
}
