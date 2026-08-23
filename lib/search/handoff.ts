/**
 * ASK-SEARCH-004 — Canonical Universal Search handoff serialization.
 * Composes Stage A′ keys with approved search extensions. No raw query / PII.
 */

import { normalizeState } from '../orchestration/journey-links';
import type { JourneyIntent, JourneyKind } from '../orchestration/journey-links';
import type { SearchEntityType, SearchHubId, TrustHubSearchIntent } from './types';

/** Allowlisted query keys for Universal Search ↔ specialist handoff. */
export const SEARCH_HANDOFF_KEYS = [
  'src',
  'journey',
  'state',
  'county',
  'intent',
  'entity',
  'category',
  'city',
  'zip',
  'sid',
] as const;

export type SearchHandoffKey = (typeof SEARCH_HANDOFF_KEYS)[number];

export type SearchHandoffType = 'view_more' | 'entity';

/**
 * Structured non-PII handoff context (Ask → specialist).
 * Does not carry free-text consumer query.
 */
export type SearchHandoffContext = {
  src: 'ask';
  journey?: JourneyKind | 'directory';
  state?: string; // prefer USPS code
  county?: string;
  intent?: JourneyIntent;
  entity?: string;
  category?: string;
  city?: string;
  zip?: string;
  /** Opaque non-PII analytics/join id (optional) */
  sid?: string;
};

export type HubSearchHandoffResult = {
  destinationHub: SearchHubId;
  handoffType: SearchHandoffType;
  /** Absolute specialist URL (canonical profile or search path) + structured context */
  url: string;
  path: string;
  context: SearchHandoffContext;
  /** Human label for future specialist “← Back to …” UI (not implemented on Hub yet) */
  backLabel?: string;
  maturity: 'ready' | 'soft_handoff' | 'disabled';
  notes?: string;
  /** Analytics-ready metadata (not necessarily serialized into the URL) */
  analytics: SearchHandoffAnalytics;
};

export type SearchHandoffAnalytics = {
  source: 'ask';
  destinationHub: SearchHubId;
  handoffType: SearchHandoffType;
  entityType?: string;
  category?: string;
  state?: string;
  county?: string;
  city?: string;
  zip?: string;
  maturity: 'ready' | 'soft_handoff' | 'disabled';
};

export type HubEntityHandoffResult = HubSearchHandoffResult & {
  handoffType: 'entity';
  networkEntityId: string;
  profilePath: string;
  /** Original specialist canonical profile URL before context params */
  canonicalProfileUrl: string;
};

/** Fail-closed / clarification outcomes — do not guess destinations. */
export type SearchDestinationOutcome =
  | { status: 'ok'; handoff: HubSearchHandoffResult }
  | {
      status: 'unsupported' | 'soft_handoff' | 'needs_clarification' | 'disabled';
      reason: string;
      hub?: SearchHubId;
      maturity?: 'ready' | 'soft_handoff' | 'disabled';
      analytics?: Partial<SearchHandoffAnalytics>;
    };

export function analyticsFromContext(
  hub: SearchHubId,
  handoffType: SearchHandoffType,
  ctx: SearchHandoffContext,
  maturity: 'ready' | 'soft_handoff' | 'disabled'
): SearchHandoffAnalytics {
  return {
    source: 'ask',
    destinationHub: hub,
    handoffType,
    entityType: ctx.entity,
    category: ctx.category,
    state: ctx.state,
    county: ctx.county,
    city: ctx.city,
    zip: ctx.zip,
    maturity,
  };
}

const ALLOW = new Set<string>(SEARCH_HANDOFF_KEYS);
const FORBIDDEN = new Set([
  'q',
  'query',
  'name',
  'email',
  'phone',
  'address',
  'ssn',
  'lat',
  'lng',
  'latitude',
  'longitude',
]);

function slugifyCity(name?: string): string | undefined {
  if (!name) return undefined;
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return s || undefined;
}

/** Map TrustHubSearchIntent → allowlisted handoff context (no raw query). */
export function intentToHandoffContext(
  intent: TrustHubSearchIntent,
  opts?: { sid?: string; journey?: JourneyKind | 'directory' }
): SearchHandoffContext {
  const loc = intent.location;
  const state =
    loc?.stateCode ||
    (loc?.stateSlug ? normalizeState(loc.stateSlug)?.stateCode : undefined) ||
    undefined;

  let journey: JourneyKind | 'directory' | undefined = opts?.journey;
  if (!journey) {
    if (intent.consumerIntent === 'find_provider' || intent.journeyKind === 'directory') {
      journey = 'directory';
    } else if (intent.journeyKind && intent.journeyKind !== 'unknown') {
      journey = intent.journeyKind as JourneyKind;
    } else if (intent.situationIdHint === 'move_buy') journey = 'relocate';
    else if (intent.situationIdHint === 'buy_local') journey = 'purchase';
    else if (intent.situationIdHint === 'refinance') journey = 'refi';
    else if (intent.situationIdHint === 'aging_parent') journey = 'senior_care';
    else if (intent.situationIdHint === 'investing_research') journey = 'investing';
    else if (intent.situationIdHint === 'hire_contractor') journey = 'contractor';
    else journey = 'directory';
  }

  const entity =
    intent.entityType && intent.entityType !== 'unknown' ? String(intent.entityType) : undefined;

  const city = loc?.citySlug || slugifyCity(loc?.cityName);

  const ctx: SearchHandoffContext = {
    src: 'ask',
    journey,
    state,
    county: loc?.countySlug,
    entity,
    category: intent.category,
    city,
    zip: loc?.zip,
    sid: opts?.sid,
  };

  // Map consumer buy/rent/refi when present on filters/notes — keep intent only for housing
  if (intent.situationIdHint === 'move_buy' || intent.situationIdHint === 'buy_local') {
    ctx.intent = 'buy';
  } else if (intent.situationIdHint === 'refinance' || intent.category === 'refinance') {
    ctx.intent = 'refi';
  } else if (intent.situationIdHint === 'move_rent') {
    ctx.intent = 'rent';
  }

  return sanitizeHandoffContext(ctx);
}

/** Drop empty/forbidden fields; keep allowlist only. */
export function sanitizeHandoffContext(raw: Partial<SearchHandoffContext> & Record<string, unknown>): SearchHandoffContext {
  const out: SearchHandoffContext = { src: 'ask' };
  for (const key of SEARCH_HANDOFF_KEYS) {
    if (key === 'src') continue;
    if (FORBIDDEN.has(key)) continue;
    const v = raw[key];
    if (v === undefined || v === null || v === '' || v === 'unknown') continue;
    if (typeof v !== 'string') continue;
    // zip must be 5 digits if present
    if (key === 'zip' && !/^\d{5}$/.test(v)) continue;
    // state prefer 2-letter
    if (key === 'state') {
      const st = normalizeState(v);
      (out as Record<string, string>)[key] = st?.stateCode ?? v.slice(0, 32);
      continue;
    }
    (out as Record<string, string>)[key] = v.slice(0, 64);
  }
  return out;
}

/** Serialize allowlisted context to query string (no leading ?). */
export function serializeHandoffContext(ctx: SearchHandoffContext): string {
  const clean = sanitizeHandoffContext(ctx);
  const p = new URLSearchParams();
  p.set('src', 'ask');
  for (const key of SEARCH_HANDOFF_KEYS) {
    if (key === 'src') continue;
    const v = clean[key];
    if (typeof v === 'string' && v) p.set(key, v);
  }
  return p.toString();
}

/** Parse URLSearchParams / query string into allowlisted context. */
export function parseHandoffContext(input: string | URLSearchParams): SearchHandoffContext {
  const params = typeof input === 'string' ? new URLSearchParams(input.replace(/^\?/, '')) : input;
  const raw: Record<string, string> = { src: 'ask' };
  for (const [k, v] of params.entries()) {
    if (FORBIDDEN.has(k)) continue;
    if (!ALLOW.has(k)) continue;
    raw[k] = v;
  }
  return sanitizeHandoffContext(raw);
}

export function withHandoffParams(path: string, ctx: SearchHandoffContext): string {
  const q = serializeHandoffContext(ctx);
  if (!q) return path;
  return path.includes('?') ? `${path}&${q}` : `${path}?${q}`;
}

/** Consumer-facing back label for specialist entity pages (future UI). */
export function buildSearchBackLabel(intent: TrustHubSearchIntent): string | undefined {
  const hub = intent.hub || intent.primaryHub;
  const loc = intent.location;
  const place =
    loc?.cityName && loc?.stateCode
      ? `${loc.cityName}, ${loc.stateCode}`
      : loc?.countySlug && loc?.stateCode
        ? `${loc.countySlug
            .split('-')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ')} County, ${loc.stateCode}`
        : loc?.stateName || loc?.stateCode || loc?.zip;

  if (!place) return undefined;

  const entity = intent.entityType;
  if (hub === 'move' || entity === 'mover' || entity === 'interstate_mover' || entity === 'intrastate_mover') {
    return `Back to movers serving ${place}`;
  }
  if (hub === 'lender' || entity === 'mortgage_company') {
    return `Back to mortgage companies in ${place}`;
  }
  if (hub === 'insurance') {
    return `Back to insurance options in ${place}`;
  }
  if (hub === 'contractor') {
    const trade = intent.category ? intent.category.replace(/_/g, ' ') : 'contractors';
    return `Back to ${trade} in ${place}`;
  }
  if (hub === 'senior' || entity === 'nursing_facility') {
    return `Back to senior care in ${place}`;
  }
  if (hub === 'investor') {
    return `Back to investment advisers in ${place}`;
  }
  return `Back to search results for ${place}`;
}

export function entityTypeForHandoff(t?: SearchEntityType | null): string | undefined {
  if (!t || t === 'unknown') return undefined;
  return String(t);
}
