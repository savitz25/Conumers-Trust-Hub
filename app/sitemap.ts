import type { MetadataRoute } from 'next';
import { BRAND } from '@/lib/brand';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? BRAND.url;

const ROUTES: { path: string; priority: number; changeFrequency: 'weekly' | 'monthly' }[] = [
  { path: '', priority: 1, changeFrequency: 'weekly' },
  { path: '/network', priority: 0.95, changeFrequency: 'weekly' },
  { path: '/trust', priority: 0.95, changeFrequency: 'monthly' },
  { path: '/promise', priority: 0.95, changeFrequency: 'monthly' },
  { path: '/methodology', priority: 0.95, changeFrequency: 'monthly' },
  { path: '/how-we-make-money', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/about', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/who-we-are', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/editorial-standards', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/data-sources', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/corrections', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/privacy', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/terms', priority: 0.4, changeFrequency: 'monthly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((route) => ({
    url: `${siteUrl}${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
