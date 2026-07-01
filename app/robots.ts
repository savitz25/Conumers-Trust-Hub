import type { MetadataRoute } from 'next';
import { CONSUMERS_TRUST_HUB } from '@/lib/sites';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? CONSUMERS_TRUST_HUB.url;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}