import type { MetadataRoute } from 'next';
import { BRAND } from '@/lib/brand';
import { ARTICLES } from '@/lib/resources/articles';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? BRAND.url;

const STATIC_ROUTES = [
  '',
  '/moving',
  '/insurance',
  '/lending',
  '/dashboard',
  '/onboarding',
  '/concierge',
  '/checklist',
  '/vault',
  '/account',
  '/pricing',
  '/community',
  '/resources',
  '/about',
  '/trust',
  '/contact',
  '/privacy',
  '/terms',
  '/moving/companies',
  '/moving/calculator',
  '/lending/lenders',
  '/lending/calculators',
  '/insurance/directory',
  '/insurance/calculators',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries = STATIC_ROUTES.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: (route === '' ? 'weekly' : 'monthly') as 'weekly' | 'monthly',
    priority: route === '' ? 1 : 0.8,
  }));

  const articles = ARTICLES.map((a) => ({
    url: `${siteUrl}/resources/${a.slug}`,
    lastModified: new Date(a.publishedAt),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [...staticEntries, ...articles];
}