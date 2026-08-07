/** Parent network brand — asktrusthub.com */

import { ASK_BRAND, ASK_TAGLINE } from '@/lib/design/ask-design-system';

/** Bump when replacing public brand logo assets (CDN/browser cache). */
export const BRAND_LOGO_VERSION = '20260807ath3';

export const BRAND = {
  name: 'Ask Trust Hub',
  shortName: 'ATH',
  legalName: 'Ask Trust Hub',
  domain: 'asktrusthub.com',
  url: 'https://www.asktrusthub.com',
  tagline: ASK_TAGLINE,
  description:
    'Ask Trust Hub is the discovery and trust layer for Move Trust Hub, Insurance Trust Hub, and Lender Trust Hub. Situation routing, independence policy, and methodology — not a provider directory.',
  email: 'hello@asktrusthub.com',
  foundingYear: 2025,
  /** Design tokens (Phase 1) */
  colors: ASK_BRAND,
} as const;

/** Site logo paths — official multi-node transparent lockup. */
export const BRAND_LOGO = {
  src: `/brand/logo.png?v=${BRAND_LOGO_VERSION}`,
  headerSrc: `/brand/logo-header.png?v=${BRAND_LOGO_VERSION}`,
  lightSrc: `/brand/logo-light.png?v=${BRAND_LOGO_VERSION}`,
  transparentSrc: `/brand/logo-transparent.png?v=${BRAND_LOGO_VERSION}`,
  alt: 'Ask Trust Hub',
  width: 720,
  height: 243,
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
