/**
 * Network V2.1.1 — journey_handoff_click (Ask).
 * Best-effort. Never blocks navigation. Allowlisted fields only.
 */

import { hubIdFromHostname, type HubOutboundId } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/track';

export const JOURNEY_HANDOFF_EVENT = 'journey_handoff_click';

export const JOURNEY_HUBS = [
  'ask',
  'move',
  'lender',
  'insurance',
  'contractor',
  'senior',
  'investor',
] as const;

export type JourneyHubId = (typeof JOURNEY_HUBS)[number];

export const JOURNEY_SURFACES = [
  'situation_router',
  'journey_page',
] as const;

const HUB_SET = new Set<string>(JOURNEY_HUBS);
const FORBIDDEN_KEYS = new Set([
  'name',
  'email',
  'phone',
  'address',
  'ssn',
  'account',
  'member',
  'diagnosis',
  'holdings',
  'href',
  'url',
  'search',
]);

export type JourneyHandoffProps = {
  destination_hub: JourneyHubId;
  surface: (typeof JOURNEY_SURFACES)[number] | string;
  journey_id: string;
  context_type: string;
  intent?: string;
  state?: string;
};

export function destinationHubFromHref(href: string): JourneyHubId | null {
  try {
    const url = new URL(href, 'https://www.asktrusthub.com');
    return hubIdFromHostname(url.hostname);
  } catch {
    return null;
  }
}

export function trackJourneyHandoff(params: JourneyHandoffProps): void {
  if (!HUB_SET.has(params.destination_hub)) return;
  if (!params.surface || !params.journey_id) return;
  const payload: Record<string, string> = {
    source_hub: 'ask',
    destination_hub: params.destination_hub,
    from_hub: 'ask',
    to_hub: params.destination_hub,
    surface: params.surface,
    journey_id: params.journey_id,
    context_type: params.context_type,
  };
  if (params.intent) payload.intent = params.intent;
  if (params.state && /^[A-Za-z]{2}$/.test(params.state)) payload.state = params.state.toUpperCase();
  for (const key of Object.keys(payload)) {
    if (FORBIDDEN_KEYS.has(key)) return;
  }
  trackEvent(JOURNEY_HANDOFF_EVENT, payload);
}

export function isForbiddenAnalyticsKey(key: string): boolean {
  return FORBIDDEN_KEYS.has(key.toLowerCase());
}

export { type HubOutboundId };
