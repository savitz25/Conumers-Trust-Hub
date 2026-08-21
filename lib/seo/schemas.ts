import { BRAND, FOUNDER, brandLogoAbsoluteUrl } from '@/lib/brand';
import { TRUST_HUBS } from '@/lib/hubs';
import { ASK_NETWORK_OWNERSHIP_LINE, ASK_NETWORK_OWNERSHIP_SHORT } from '@/lib/network/standard-version';
import { siteUrl } from '@/lib/seo/metadata';

const orgId = `${siteUrl}/#organization`;
const websiteId = `${siteUrl}/#website`;
const founderId = `${siteUrl}/who-we-are#founder`;

/**
 * Parent Organization JSON-LD for Ask Trust Hub.
 * Represents common-ownership network structure; not unaffiliated companies.
 */
export function buildOrganizationSchema() {
  return {
    '@type': 'Organization',
    '@id': orgId,
    name: BRAND.name,
    legalName: BRAND.legalName,
    url: siteUrl,
    logo: brandLogoAbsoluteUrl(siteUrl),
    email: BRAND.email,
    description: `${BRAND.description} ${ASK_NETWORK_OWNERSHIP_LINE}`,
    foundingDate: String(BRAND.foundingYear),
    slogan: ASK_NETWORK_OWNERSHIP_SHORT,
    founder: {
      '@type': 'Person',
      '@id': founderId,
      name: FOUNDER.name,
      jobTitle: FOUNDER.role,
      url: `${siteUrl}/who-we-are`,
    },
    contactPoint: {
      '@type': 'ContactPoint',
      email: BRAND.email,
      contactType: 'customer service',
      areaServed: 'US',
      availableLanguage: 'English',
    },
    /** Specialist domains as related entities under the parent brand. */
    sameAs: TRUST_HUBS.map((h) => h.url),
    /**
     * Specialist research sites under common ownership.
     * Each subOrganization includes parentOrganization for reciprocal graph completeness
     * (specialist sites should later embed parentOrganization pointing here).
     */
    subOrganization: TRUST_HUBS.map((hub) => ({
      '@type': 'Organization',
      '@id': `${hub.url}/#organization`,
      name: hub.name,
      url: hub.url,
      description: `${hub.description} ${ASK_NETWORK_OWNERSHIP_SHORT}.`,
      parentOrganization: { '@id': orgId },
    })),
  };
}

/**
 * Fragment specialist hubs embed as parentOrganization (implemented on Move, Lender, Insurance).
 * Keep IDs stable: https://www.asktrusthub.com/#organization
 */
export function buildParentOrganizationReference() {
  return {
    '@type': 'Organization',
    '@id': orgId,
    name: BRAND.name,
    url: siteUrl,
  };
}

/** Guarantees schema includes all six specialist hubs (used in tests / sanity checks). */
export function getSubOrganizationNames(): string[] {
  return TRUST_HUBS.map((h) => h.name);
}

export function buildWebSiteSchema() {
  return {
    '@type': 'WebSite',
    '@id': websiteId,
    name: BRAND.name,
    url: siteUrl,
    description: BRAND.description,
    publisher: { '@id': orgId },
    inLanguage: 'en-US',
  };
}

export function buildHomepageGraph() {
  return {
    '@context': 'https://schema.org',
    '@graph': [buildOrganizationSchema(), buildWebSiteSchema()],
  };
}

export function buildBreadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => {
      const path =
        item.path === '/' ? '' : item.path.startsWith('/') ? item.path.replace(/\/+$/, '') : `/${item.path}`;
      return {
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: `${siteUrl}${path}`,
      };
    }),
  };
}

export function buildPersonSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': founderId,
    name: FOUNDER.name,
    jobTitle: FOUNDER.role,
    description: FOUNDER.bio,
    url: `${siteUrl}/who-we-are`,
    worksFor: { '@id': orgId },
  };
}

/** Ordinary WebPage for /academic — not AcademicOrganization, not fake affiliations. */
export function buildWebPageSchema(input: {
  name: string;
  description: string;
  path: string;
}): Record<string, unknown> {
  const path = input.path.startsWith('/') ? input.path.replace(/\/+$/, '') : `/${input.path}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: input.name,
    description: input.description,
    url: `${siteUrl}${path}`,
    isPartOf: { '@id': websiteId },
    about: {
      '@type': 'Thing',
      name: 'Independent academic research using public regulatory and consumer-protection data',
    },
    publisher: { '@id': orgId },
    inLanguage: 'en-US',
  };
}

export { orgId };
