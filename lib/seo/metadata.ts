import type { Metadata } from 'next';
import { BRAND } from '@/lib/brand';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? BRAND.url;

export const rootLayoutMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${BRAND.name} — Independent Consumer Research Network`,
    template: `%s | ${BRAND.name}`,
  },
  description: BRAND.description,
  keywords: [
    'ConsumerTrust Hub',
    'independent consumer research',
    'MoveTrustHub',
    'InsuranceTrustHub',
    'LenderTrustHub',
    'zero paid placements',
    'FMCSA',
    'NMLS',
    'DOI verification',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: BRAND.name,
    title: `${BRAND.name} — Independent Consumer Research Network`,
    description: BRAND.tagline,
  },
  twitter: {
    card: 'summary_large_image',
    title: BRAND.name,
    description: BRAND.tagline,
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
    openGraph: { title, description, url, siteName: BRAND.name },
  };
}

export { siteUrl };
