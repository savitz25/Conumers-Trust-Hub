import type { MetadataRoute } from 'next';
import { ARTICLES } from '@/lib/resources/articles';
import { CONSUMERS_TRUST_HUB } from '@/lib/sites';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? CONSUMERS_TRUST_HUB.url;

const STATIC_ROUTES = [
  '',
  '/moving',
  '/lending',
  '/insurance',
  '/resources',
  '/about',
  '/trust',
  '/contact',
  '/privacy',
  '/terms',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : 0.8,
  }));

  const articleEntries: MetadataRoute.Sitemap = ARTICLES.map((article) => ({
    url: `${siteUrl}/resources/${article.slug}`,
    lastModified: new Date(article.publishedAt),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [...staticEntries, ...articleEntries];
}