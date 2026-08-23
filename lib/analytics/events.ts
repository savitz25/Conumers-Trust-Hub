/**
 * Named analytics events for Ask Trust Hub (Vercel Analytics custom events).
 * Keep property values primitives for the Analytics API.
 */

export const ANALYTICS_EVENTS = {
  CONCIERGE_OPEN: 'concierge_open',
  CONCIERGE_SUBMIT: 'concierge_submit',
  OUTBOUND_HUB: 'outbound_hub_click',
  INTERNAL_NAV: 'internal_nav_click',
  JOURNEY_HANDOFF: 'journey_handoff_click',
  SEARCH_SUBMITTED: 'search_submitted',
  SEARCH_RESOLVED: 'search_resolved',
  TOP_MATCHES_RENDERED: 'top_matches_rendered',
  RESULT_CLICKED: 'result_clicked',
  VIEW_MORE_CLICKED: 'view_more_clicked',
  CLARIFICATION_SHOWN: 'clarification_shown',
  CLARIFICATION_SELECTED: 'clarification_selected',
  UNSUPPORTED_SEARCH: 'unsupported_search',
  ZERO_RESULTS: 'zero_results',
} as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export type HubOutboundId =
  | 'ask'
  | 'move'
  | 'lender'
  | 'insurance'
  | 'contractor'
  | 'senior'
  | 'investor';

export function hubIdFromHostname(hostname: string): HubOutboundId | null {
  const host = hostname.replace(/^www\./, '').toLowerCase();
  if (host === 'asktrusthub.com') return 'ask';
  if (host === 'movetrusthub.com') return 'move';
  if (host === 'lendertrusthub.com') return 'lender';
  if (host === 'insurancetrusthub.com') return 'insurance';
  if (host === 'contractortrusthub.com') return 'contractor';
  if (host === 'seniortrusthub.com') return 'senior';
  if (host === 'investortrusthub.com') return 'investor';
  return null;
}

/** Paths we care about for knowledge-layer discovery measurement. */
export function internalNavKeyFromPath(pathname: string): string | null {
  const path = pathname.split('?')[0].replace(/\/+$/, '') || '/';
  if (path === '/methodology' || path.startsWith('/methodology/')) return 'standard';
  if (path === '/data-sources' || path.startsWith('/data-sources/')) return 'data_sources';
  if (path === '/journeys' || path.startsWith('/journeys/')) return 'journeys';
  if (path === '/guides' || path.startsWith('/guides/')) return 'guides';
  return null;
}

/**
 * Qualitative measurement baseline (Phase 5).
 * Recorded 2026-08-07 so later organic growth can be compared.
 * Metrics that require Search Console / Analytics dashboards remain manual.
 */
export const MEASUREMENT_BASELINE = {
  asOf: '2026-08-07',
  note:
    'Pre-growth-content baseline: Phase 4 journeys/guides shipped same day as Phase 5 measurement hooks. Compare organic landings on /journeys/* and /guides/* after GSC indexing against this ship date.',
  indexableSurfaces: [
    '/',
    '/journeys',
    '/guides',
    '/methodology',
    '/data-sources',
    '/network',
    '/who-we-are',
    '/promise',
  ],
  sitemapPath: '/sitemap.xml',
  events: Object.values(ANALYTICS_EVENTS),
} as const;
