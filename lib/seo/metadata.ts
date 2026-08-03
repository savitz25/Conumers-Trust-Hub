import type { Metadata } from 'next';
import { BRAND, BRAND_LOGO, BRAND_LOGO_VERSION, brandLogoAbsoluteUrl } from '@/lib/brand';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? BRAND.url;

export const rootLayoutMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: BRAND.name,
  title: {
    default: `${BRAND.name} — Independent Consumer Research Network`,
    template: `%s | ${BRAND.name}`,
  },
  description: BRAND.description,
  keywords: [
    'Ask Trust Hub',
    'independent consumer research',
    'MoveTrustHub',
    'InsuranceTrustHub',
    'LenderTrustHub',
    'zero paid placements',
    'FMCSA',
    'NMLS',
    'DOI verification',
  ],
  authors: [{ name: BRAND.name }],
  icons: {
    icon: [
      { url: `/favicon-16.png?v=${BRAND_LOGO_VERSION}`, sizes: '16x16', type: 'image/png' },
      { url: `/favicon-32.png?v=${BRAND_LOGO_VERSION}`, sizes: '32x32', type: 'image/png' },
      { url: `/icon-192.png?v=${BRAND_LOGO_VERSION}`, sizes: '192x192', type: 'image/png' },
      { url: BRAND_LOGO.src, type: 'image/png' },
    ],
    apple: [
      {
        url: `/apple-touch-icon.png?v=${BRAND_LOGO_VERSION}`,
        sizes: '180x180',
        type: 'image/png',
      },
    ],
    shortcut: [`/favicon-32.png?v=${BRAND_LOGO_VERSION}`],
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: BRAND.name,
    title: `${BRAND.name} — Independent Consumer Research Network`,
    description: BRAND.tagline,
    images: [
      {
        url: brandLogoAbsoluteUrl(siteUrl),
        width: BRAND_LOGO.width,
        height: BRAND_LOGO.height,
        alt: BRAND_LOGO.alt,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: BRAND.name,
    description: BRAND.tagline,
    images: [brandLogoAbsoluteUrl(siteUrl)],
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
    openGraph: {
      title,
      description,
      url,
      siteName: BRAND.name,
      images: [
        {
          url: brandLogoAbsoluteUrl(siteUrl),
          width: BRAND_LOGO.width,
          height: BRAND_LOGO.height,
          alt: BRAND_LOGO.alt,
        },
      ],
    },
  };
}

export { siteUrl };
