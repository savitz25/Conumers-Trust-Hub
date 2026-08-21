import type { MetadataRoute } from 'next';
import { BRAND } from '@/lib/brand';
import { getAllGuideSlugs } from '@/lib/growth/guides';
import { getAllJourneySlugs } from '@/lib/growth/journeys';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? BRAND.url).replace(/\/$/, '');

const CORE: {
  path: string;
  priority: number;
  changeFrequency: 'weekly' | 'monthly' | 'yearly';
  lastmod: string;
}[] = [
  { path: '', priority: 1.0, changeFrequency: 'weekly', lastmod: '2026-08-07' },
  { path: '/network', priority: 0.85, changeFrequency: 'weekly', lastmod: '2026-08-07' },
  { path: '/trust', priority: 0.85, changeFrequency: 'monthly', lastmod: '2026-08-07' },
  { path: '/promise', priority: 0.8, changeFrequency: 'monthly', lastmod: '2026-08-07' },
  { path: '/methodology', priority: 0.9, changeFrequency: 'monthly', lastmod: '2026-08-07' },
  { path: '/how-we-make-money', priority: 0.7, changeFrequency: 'monthly', lastmod: '2026-08-07' },
  { path: '/about', priority: 0.7, changeFrequency: 'monthly', lastmod: '2026-08-07' },
  { path: '/who-we-are', priority: 0.75, changeFrequency: 'monthly', lastmod: '2026-08-07' },
  { path: '/editorial-standards', priority: 0.55, changeFrequency: 'monthly', lastmod: '2026-08-07' },
  { path: '/data-sources', priority: 0.75, changeFrequency: 'monthly', lastmod: '2026-08-07' },
  { path: '/academic', priority: 0.7, changeFrequency: 'monthly', lastmod: '2026-08-10' },
  { path: '/corrections', priority: 0.5, changeFrequency: 'monthly', lastmod: '2026-08-07' },
  { path: '/journeys', priority: 0.85, changeFrequency: 'weekly', lastmod: '2026-08-07' },
  { path: '/guides', priority: 0.85, changeFrequency: 'weekly', lastmod: '2026-08-07' },
  // Personal overview is noindex; omit from sitemap
  { path: '/contact', priority: 0.4, changeFrequency: 'monthly', lastmod: '2026-07-01' },
  { path: '/privacy', priority: 0.25, changeFrequency: 'yearly', lastmod: '2026-06-01' },
  { path: '/terms', priority: 0.25, changeFrequency: 'yearly', lastmod: '2026-06-01' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const journeys = getAllJourneySlugs().map((slug) => ({
    url: `${siteUrl}/journeys/${slug}`,
    lastModified: new Date('2026-08-07'),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));
  const guides = getAllGuideSlugs().map((slug) => ({
    url: `${siteUrl}/guides/${slug}`,
    lastModified: new Date('2026-08-07'),
    changeFrequency: 'monthly' as const,
    priority: 0.75,
  }));

  return [
    ...CORE.map((route) => ({
      url: `${siteUrl}${route.path}`,
      lastModified: new Date(route.lastmod),
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...journeys,
    ...guides,
  ];
}
