/** Parent network brand — asktrusthub.com */

/** Bump when replacing public brand logo assets (CDN/browser cache). */
export const BRAND_LOGO_VERSION = '20260727ath';

export const BRAND = {
  name: 'Ask Trust Hub',
  shortName: 'ATH',
  legalName: 'Ask Trust Hub',
  domain: 'asktrusthub.com',
  url: 'https://www.asktrusthub.com',
  tagline: 'Independent verification. Transparent methodology. Zero paid placements.',
  description:
    'Independent consumer research network and trust infrastructure behind MoveTrustHub, InsuranceTrustHub, and LenderTrustHub. Methodology, independence standards, and discovery—not a provider directory.',
  email: 'hello@asktrusthub.com',
  foundingYear: 2025,
} as const;

/** Site logo paths — transparent PNG wordmark + dark-bg variant. */
export const BRAND_LOGO = {
  src: `/brand/logo.png?v=${BRAND_LOGO_VERSION}`,
  lightSrc: `/brand/logo-light.png?v=${BRAND_LOGO_VERSION}`,
  alt: 'Ask Trust Hub',
  /** Stacked wordmark + mark after trim (actual asset ~713×271) */
  width: 713,
  height: 271,
} as const;

export function brandLogoAbsoluteUrl(baseUrl: string = BRAND.url): string {
  return `${baseUrl.replace(/\/$/, '')}/brand/logo.png?v=${BRAND_LOGO_VERSION}`;
}

export const FOUNDER = {
  name: 'Michael Henry',
  role: 'Founder',
  bio: 'Founder of Ask Trust Hub. Responsible for network standards, independence policy, and the specialist research sites covering regulated consumer markets—moving, insurance, and lending—where paid placement commonly substitutes for verification.',
  location: 'United States',
} as const;
