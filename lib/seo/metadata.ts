import type { Metadata } from 'next';
import { BRAND, BRAND_LOGO, BRAND_LOGO_VERSION, brandLogoAbsoluteUrl } from '@/lib/brand';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? BRAND.url).replace(/\/$/, '');

/** Homepage — entity-rich title & description (Phase 1 integrity). */
export const HOMEPAGE_TITLE =
  'Ask Trust Hub | Independent Consumer Research Network';

export const HOMEPAGE_DESCRIPTION =
  'Independent consumer research network. We help you understand verified public sources and route you to specialist hubs — no paid placements, no lead fees.';

/** Default share image (1200×630) — prefer dedicated OG art over logo crop. */
export function brandOgImageAbsoluteUrl(baseUrl: string = siteUrl): string {
  return `${baseUrl.replace(/\/$/, '')}/og-default.png?v=${BRAND_LOGO_VERSION}`;
}

export const rootLayoutMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: BRAND.name,
  title: {
    default: HOMEPAGE_TITLE,
    template: `%s | ${BRAND.name}`,
  },
  description: HOMEPAGE_DESCRIPTION,
  keywords: [
    'Ask Trust Hub',
    'independent consumer research',
    'Move Trust Hub',
    'Insurance Trust Hub',
    'Lender Trust Hub',
    'Contractor Trust Hub',
    'SeniorTrustHub',
    'InvestorTrustHub',
    'no paid placements',
    'FMCSA',
    'NMLS',
    'DOI verification',
  ],
  authors: [{ name: BRAND.name }],
  icons: {
    icon: [
      { url: `/favicon.ico?v=${BRAND_LOGO_VERSION}`, sizes: 'any' },
      { url: `/favicon-16.png?v=${BRAND_LOGO_VERSION}`, sizes: '16x16', type: 'image/png' },
      { url: `/favicon-32.png?v=${BRAND_LOGO_VERSION}`, sizes: '32x32', type: 'image/png' },
      { url: `/favicon-48.png?v=${BRAND_LOGO_VERSION}`, sizes: '48x48', type: 'image/png' },
      { url: `/icon-192.png?v=${BRAND_LOGO_VERSION}`, sizes: '192x192', type: 'image/png' },
      { url: `/icon-512.png?v=${BRAND_LOGO_VERSION}`, sizes: '512x512', type: 'image/png' },
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
  manifest: `/manifest.webmanifest?v=${BRAND_LOGO_VERSION}`,
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: BRAND.name,
    title: HOMEPAGE_TITLE,
    description: HOMEPAGE_DESCRIPTION,
    images: [
      {
        url: brandOgImageAbsoluteUrl(siteUrl),
        width: 1200,
        height: 630,
        alt: 'Ask Trust Hub — independent consumer research network',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: HOMEPAGE_TITLE,
    description: HOMEPAGE_DESCRIPTION,
    images: [brandOgImageAbsoluteUrl(siteUrl)],
  },
  robots: { index: true, follow: true },
  alternates: { canonical: siteUrl },
};

/**
 * Per-page metadata with unique title, description, self-referencing canonical,
 * and matching Open Graph + Twitter tags.
 */
export function createPageMetadata({
  title,
  description,
  path,
  type = 'website',
  noIndex = false,
}: {
  title: string;
  description: string;
  path: string;
  type?: 'website' | 'article';
  noIndex?: boolean;
}): Metadata {
  const withSlash = path.startsWith('/') ? path : `/${path}`;
  // Canonical consistency: no trailing slash (matches next.config trailingSlash: false)
  const normalized =
    withSlash === '/' ? '/' : withSlash.replace(/\/+$/, '').replace(/\/+/g, '/');
  const url = `${siteUrl}${normalized === '/' ? '' : normalized}`;
  const ogImage = brandOgImageAbsoluteUrl(siteUrl);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type,
      locale: 'en_US',
      siteName: BRAND.name,
      title,
      description,
      url,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

export { siteUrl, brandLogoAbsoluteUrl };
