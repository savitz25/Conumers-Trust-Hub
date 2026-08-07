import type { MetadataRoute } from 'next';
import { BRAND } from '@/lib/brand';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? BRAND.url).replace(/\/$/, '');

/**
 * Indexable Ask Trust Hub URLs only — no specialist domains, no params, no staging.
 * lastmod is staggered by content maturity (not identical timestamps).
 */
const ROUTES: {
  path: string;
  priority: number;
  changeFrequency: 'weekly' | 'monthly' | 'yearly';
  lastmod: string;
}[] = [
  { path: '', priority: 1.0, changeFrequency: 'weekly', lastmod: '2026-08-07' },
  { path: '/network', priority: 0.85, changeFrequency: 'weekly', lastmod: '2026-08-06' },
  { path: '/trust', priority: 0.8, changeFrequency: 'monthly', lastmod: '2026-08-06' },
  { path: '/promise', priority: 0.8, changeFrequency: 'monthly', lastmod: '2026-08-06' },
  { path: '/methodology', priority: 0.8, changeFrequency: 'monthly', lastmod: '2026-08-05' },
  { path: '/how-we-make-money', priority: 0.65, changeFrequency: 'monthly', lastmod: '2026-07-20' },
  { path: '/about', priority: 0.65, changeFrequency: 'monthly', lastmod: '2026-08-01' },
  { path: '/who-we-are', priority: 0.55, changeFrequency: 'monthly', lastmod: '2026-07-15' },
  { path: '/editorial-standards', priority: 0.5, changeFrequency: 'monthly', lastmod: '2026-07-10' },
  { path: '/data-sources', priority: 0.5, changeFrequency: 'monthly', lastmod: '2026-07-10' },
  { path: '/corrections', priority: 0.4, changeFrequency: 'monthly', lastmod: '2026-07-01' },
  { path: '/contact', priority: 0.4, changeFrequency: 'monthly', lastmod: '2026-07-01' },
  { path: '/privacy', priority: 0.25, changeFrequency: 'yearly', lastmod: '2026-06-01' },
  { path: '/terms', priority: 0.25, changeFrequency: 'yearly', lastmod: '2026-06-01' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((route) => ({
    url: `${siteUrl}${route.path}`,
    lastModified: new Date(route.lastmod),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
