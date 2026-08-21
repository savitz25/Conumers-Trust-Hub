/**
 * SHARE-002 — Ask Trust Hub social-share identity (repo-local).
 * Production canonical + default card must never drift to localhost,
 * a Vercel preview host, or another TrustHub domain.
 */

export const SHARE_HUB = {
  id: 'ask',
  brand: 'Ask Trust Hub',
  host: 'www.asktrusthub.com',
  apexHost: 'asktrusthub.com',
  origin: 'https://www.asktrusthub.com',
  ogImagePath: '/og/ask-trust-hub-social-card.png',
  ogImageVersion: '20260819',
  ogWidth: 1200,
  ogHeight: 630,
  ogAlt: 'Ask Trust Hub — independent consumer research network',
  twitterCard: 'summary_large_image',
  networkLabel: 'Ask Trust Hub Network',
} as const;

export const FOREIGN_TRUSTHUB_HOSTS = [
  'www.movetrusthub.com',
  'movetrusthub.com',
  'www.insurancetrusthub.com',
  'insurancetrusthub.com',
  'www.lendertrusthub.com',
  'lendertrusthub.com',
  'www.contractortrusthub.com',
  'contractortrusthub.com',
  'www.seniortrusthub.com',
  'seniortrusthub.com',
  'www.investortrusthub.com',
  'investortrusthub.com',
] as const;

export function isForbiddenShareHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') return true;
  if (host.endsWith('.vercel.app')) return true;
  return (FOREIGN_TRUSTHUB_HOSTS as readonly string[]).includes(host);
}

/**
 * Origin used for canonical, Open Graph, and Twitter URLs.
 * Always the Ask production host — env cannot retarget another Hub or localhost.
 */
export function resolveShareOrigin(): string {
  return SHARE_HUB.origin;
}

export function shareOgImageAbsoluteUrl(origin: string = SHARE_HUB.origin): string {
  const base = origin.replace(/\/$/, '');
  return `${base}${SHARE_HUB.ogImagePath}?v=${SHARE_HUB.ogImageVersion}`;
}
