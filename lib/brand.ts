/** Parent network brand — consumerstrusthub.com */

/** Bump when replacing public brand logo assets (CDN/browser cache). */
export const BRAND_LOGO_VERSION = '20260727';

export const BRAND = {
  name: 'ConsumerTrust Hub',
  shortName: 'CTH',
  legalName: 'ConsumerTrust Hub',
  domain: 'consumerstrusthub.com',
  url: 'https://www.consumerstrusthub.com',
  tagline: 'Independent verification. Transparent methodology. Zero paid placements.',
  description:
    'Independent consumer research network and trust infrastructure behind MoveTrustHub, InsuranceTrustHub, and LenderTrustHub. Methodology, independence standards, and discovery—not a provider directory.',
  email: 'hello@consumerstrusthub.com',
  foundingYear: 2025,
} as const;

/** Site logo paths — transparent PNG wordmark + dark-bg variant. */
export const BRAND_LOGO = {
  src: `/brand/logo.png?v=${BRAND_LOGO_VERSION}`,
  lightSrc: `/brand/logo-light.png?v=${BRAND_LOGO_VERSION}`,
  alt: 'ConsumerTrust Hub',
  /** Intrinsic aspect ~3.7:1 after trim */
  width: 714,
  height: 192,
} as const;

export function brandLogoAbsoluteUrl(baseUrl: string = BRAND.url): string {
  return `${baseUrl.replace(/\/$/, '')}/brand/logo.png?v=${BRAND_LOGO_VERSION}`;
}

export const FOUNDER = {
  name: 'Michael Henry',
  role: 'Founder',
  bio: 'Founder of ConsumerTrust Hub. Responsible for network standards, independence policy, and the specialist research sites covering regulated consumer markets—moving, insurance, and lending—where paid placement commonly substitutes for verification.',
  location: 'United States',
} as const;
