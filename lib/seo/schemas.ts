import { BRAND } from '@/lib/brand';
import { HUB_SITES } from '@/lib/sites';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? BRAND.url;

export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRAND.name,
    url: siteUrl,
    logo: `${siteUrl}/brand/logo.svg`,
    description: BRAND.tagline,
    sameAs: Object.values(HUB_SITES).map((h) => `${siteUrl}${h.path}`),
  };
}

export function buildWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: BRAND.name,
    url: siteUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${siteUrl}/moving/companies?zip={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function buildHomepageGraph() {
  return { '@context': 'https://schema.org', '@graph': [buildOrganizationSchema(), buildWebSiteSchema()] };
}

export function buildArticleSchema(slug: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: slug,
    publisher: { '@type': 'Organization', name: BRAND.name },
    mainEntityOfPage: `${siteUrl}/resources/${slug}`,
  };
}

export function buildBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}