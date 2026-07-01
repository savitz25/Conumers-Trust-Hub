import { ARTICLES } from '@/lib/resources/articles';
import { CONSUMERS_TRUST_HUB, SISTER_SITES } from '@/lib/sites';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? CONSUMERS_TRUST_HUB.url;

export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: CONSUMERS_TRUST_HUB.name,
    url: siteUrl,
    logo: `${siteUrl}/brand/logo.svg`,
    description: CONSUMERS_TRUST_HUB.tagline,
    sameAs: Object.values(SISTER_SITES).map((s) => s.url),
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: CONSUMERS_TRUST_HUB.email,
      availableLanguage: 'English',
    },
  };
}

export function buildWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: CONSUMERS_TRUST_HUB.name,
    url: siteUrl,
    description: CONSUMERS_TRUST_HUB.tagline,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/?zip={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function buildHomepageGraph() {
  return {
    '@context': 'https://schema.org',
    '@graph': [buildOrganizationSchema(), buildWebSiteSchema()],
  };
}

export function buildArticleSchema(slug: string) {
  const article = ARTICLES.find((a) => a.slug === slug);
  if (!article) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.excerpt,
    datePublished: article.publishedAt,
    author: {
      '@type': 'Organization',
      name: CONSUMERS_TRUST_HUB.name,
    },
    publisher: {
      '@type': 'Organization',
      name: CONSUMERS_TRUST_HUB.name,
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/brand/logo.svg`,
      },
    },
    mainEntityOfPage: `${siteUrl}/resources/${article.slug}`,
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