import { BRAND, FOUNDER, brandLogoAbsoluteUrl } from '@/lib/brand';
import { TRUST_HUBS } from '@/lib/hubs';
import { siteUrl } from '@/lib/seo/metadata';

const orgId = `${siteUrl}/#organization`;
const websiteId = `${siteUrl}/#website`;
const founderId = `${siteUrl}/who-we-are#founder`;

export function buildOrganizationSchema() {
  return {
    '@type': 'Organization',
    '@id': orgId,
    name: BRAND.name,
    legalName: BRAND.legalName,
    url: siteUrl,
    logo: brandLogoAbsoluteUrl(siteUrl),
    email: BRAND.email,
    description: BRAND.description,
    foundingDate: String(BRAND.foundingYear),
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
    sameAs: TRUST_HUBS.map((h) => h.url),
    // Explicit sub-organizations (prose names) for the three live hubs
    subOrganization: TRUST_HUBS.map((hub) => {
      const proseName =
        hub.id === 'move'
          ? 'Move Trust Hub'
          : hub.id === 'insurance'
            ? 'Insurance Trust Hub'
            : 'Lender Trust Hub';
      return {
        '@type': 'Organization',
        '@id': `${hub.url}/#organization`,
        name: proseName,
        url: hub.url,
        description: hub.description,
        parentOrganization: { '@id': orgId },
      };
    }),
  };
}

/** Guarantees schema includes all three network hubs (used in tests / sanity checks). */
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
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${siteUrl}${item.path}`,
    })),
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

export { orgId };
