import type { Metadata } from 'next';
import { BRAND } from '@/lib/brand';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? BRAND.url;

export const rootLayoutMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${BRAND.name} • ${BRAND.coachTagline}`,
    template: `%s | ${BRAND.name}`,
  },
  description:
    'One trusted home for your entire move. FMCSA, NMLS & DOI verified directories, AI concierge, checklist, and document vault.',
  keywords: [
    'consumer trust hub',
    'moving checklist',
    'FMCSA movers',
    'NMLS lenders',
    'insurance agents',
    'relocation planner',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: BRAND.name,
    title: BRAND.name,
    description: BRAND.tagline,
    images: [{ url: '/brand/og-image.png', width: 1200, height: 630, alt: BRAND.name }],
  },
  robots: { index: true, follow: true },
  alternates: { canonical: siteUrl },
};

export function createPageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const url = `${siteUrl}${path}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url },
  };
}