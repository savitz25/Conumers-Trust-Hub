import type { Metadata } from 'next';
import { CONSUMERS_TRUST_HUB } from '@/lib/sites';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? CONSUMERS_TRUST_HUB.url;

export const rootLayoutMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Consumers Trust Hub • Moving, Lending & Insurance – Shop with Confidence',
    template: '%s | Consumers Trust Hub',
  },
  description:
    'One trusted hub to discover, compare, and shop for moving companies, mortgage lenders, and insurance agents. FMCSA, NMLS & DOI verified. Zero paid placements.',
  keywords: [
    'consumers trust hub',
    'moving companies',
    'mortgage lenders',
    'insurance agents',
    'FMCSA verified movers',
    'NMLS lenders',
    'compare insurance',
  ],
  authors: [{ name: 'Consumers Trust Hub' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: CONSUMERS_TRUST_HUB.name,
    title: 'Consumers Trust Hub – One Trusted Hub for Moving, Lending & Insurance',
    description: CONSUMERS_TRUST_HUB.tagline,
    images: [{ url: '/brand/og-image.png', width: 1200, height: 630, alt: 'Consumers Trust Hub' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Consumers Trust Hub',
    description: CONSUMERS_TRUST_HUB.tagline,
    images: ['/brand/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: {
    canonical: siteUrl,
  },
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
    openGraph: {
      title,
      description,
      url,
    },
  };
}