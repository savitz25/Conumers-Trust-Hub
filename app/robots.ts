import type { MetadataRoute } from 'next';
import { BRAND } from '@/lib/brand';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? BRAND.url).replace(/\/$/, '');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/search'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
