/**
 * Bounded offline geography stub for ASK-SEARCH-003.
 * Replace/extend with full gazetteer later without changing parser call sites.
 */

import { normalizeState, normalizeCountySlug, US_STATES } from '../orchestration/journey-links';
import type { GeoPrecision, TrustHubSearchLocation } from './types';

export type GeoHit = TrustHubSearchLocation & {
  ambiguous?: boolean;
  consumed: string;
};

/** Fixture ZIP → state (+ optional city). Not a national ZIP DB. */
const ZIP_STUB: Record<string, { stateCode: string; cityName?: string }> = {
  '07734': { stateCode: 'NJ', cityName: 'Keansburg' },
  '33101': { stateCode: 'FL', cityName: 'Miami' },
  '33432': { stateCode: 'FL', cityName: 'Boca Raton' },
  '46204': { stateCode: 'IN', cityName: 'Indianapolis' },
  '78701': { stateCode: 'TX', cityName: 'Austin' },
};

/** Well-known cities used by the acceptance corpus (unique or default state). */
const CITY_STUB: Record<string, { stateCode: string; cityName: string }> = {
  keansburg: { stateCode: 'NJ', cityName: 'Keansburg' },
  miami: { stateCode: 'FL', cityName: 'Miami' },
  tampa: { stateCode: 'FL', cityName: 'Tampa' },
  orlando: { stateCode: 'FL', cityName: 'Orlando' },
  'fort lauderdale': { stateCode: 'FL', cityName: 'Fort Lauderdale' },
  'boca raton': { stateCode: 'FL', cityName: 'Boca Raton' },
  austin: { stateCode: 'TX', cityName: 'Austin' },
  houston: { stateCode: 'TX', cityName: 'Houston' },
  dallas: { stateCode: 'TX', cityName: 'Dallas' },
  phoenix: { stateCode: 'AZ', cityName: 'Phoenix' },
  seattle: { stateCode: 'WA', cityName: 'Seattle' },
  chicago: { stateCode: 'IL', cityName: 'Chicago' },
  indianapolis: { stateCode: 'IN', cityName: 'Indianapolis' },
};

/** Multi-state cities — never guess without state/ZIP. */
const AMBIGUOUS_CITIES = new Set(['springfield']);

const COUNTY_STUB: Record<string, { stateCode: string; countySlug: string }> = {
  'bergen county': { stateCode: 'NJ', countySlug: 'bergen' },
  'monmouth county': { stateCode: 'NJ', countySlug: 'monmouth' },
  'palm beach county': { stateCode: 'FL', countySlug: 'palm-beach' },
  'miami-dade county': { stateCode: 'FL', countySlug: 'miami-dade' },
  'miami dade county': { stateCode: 'FL', countySlug: 'miami-dade' },
};

function locFromState(code: string, precision: GeoPrecision, extra: Partial<TrustHubSearchLocation> = {}): TrustHubSearchLocation {
  const meta = normalizeState(code)!;
  return {
    stateCode: meta.stateCode,
    stateSlug: meta.stateSlug,
    stateName: meta.stateName,
    precision,
    ...extra,
  };
}

export function detectNearMe(q: string): boolean {
  return /\b(near me|nearby|around me|close to me)\b/.test(q);
}

/**
 * Extract geography from normalized query. Returns remaining query with geo spans removed.
 */
export function extractGeography(normalized: string): {
  location?: TrustHubSearchLocation;
  origin?: TrustHubSearchLocation;
  destination?: TrustHubSearchLocation;
  remainder: string;
  locationAmbiguous?: boolean;
} {
  let q = normalized;
  let location: TrustHubSearchLocation | undefined;
  let origin: TrustHubSearchLocation | undefined;
  let destination: TrustHubSearchLocation | undefined;
  let locationAmbiguous = false;

  // Origin/destination: moving from X to Y
  const fromTo = q.match(
    /\b(?:moving\s+)?from\s+([a-z\s]+?)\s+to\s+([a-z\s]+?)(?:\s+and\b|$)/i
  );
  if (fromTo) {
    const o = normalizeState(fromTo[1].trim());
    const d = normalizeState(fromTo[2].trim());
    if (o) origin = locFromState(o.stateCode, 'state', { raw: fromTo[1].trim() });
    if (d) {
      destination = locFromState(d.stateCode, 'state', { raw: fromTo[2].trim() });
      location = destination;
    }
    q = q.replace(fromTo[0], ' ').replace(/\s+/g, ' ').trim();
  }

  // moving to Florida ...
  const movingTo = q.match(/\bmoving to\s+([a-z\s]+?)(?:\s+and\b|$)/);
  if (movingTo && !destination) {
    const d = normalizeState(movingTo[1].trim());
    if (d) {
      destination = locFromState(d.stateCode, 'state');
      location = destination;
      q = q.replace(movingTo[0], ' ').replace(/\s+/g, ' ').trim();
    }
  }

  // ZIP first
  const zipM = q.match(/\b(\d{5})\b/);
  if (zipM) {
    const zip = zipM[1];
    const stub = ZIP_STUB[zip];
    if (stub) {
      const meta = normalizeState(stub.stateCode)!;
      location = {
        zip,
        stateCode: meta.stateCode,
        stateSlug: meta.stateSlug,
        stateName: meta.stateName,
        cityName: stub.cityName,
        citySlug: stub.cityName?.toLowerCase().replace(/\s+/g, '-'),
        precision: 'zip',
        raw: zip,
      };
    } else {
      location = { zip, precision: 'zip', raw: zip };
    }
    q = q.replace(zipM[0], ' ').replace(/\s+/g, ' ').trim();
  }

  // County + optional state
  for (const [phrase, info] of Object.entries(COUNTY_STUB)) {
    if (q.includes(phrase)) {
      const meta = normalizeState(info.stateCode)!;
      // allow trailing state after county
      const re = new RegExp(`${phrase}(?:\\s+(?:nj|fl|new jersey|florida))?`, 'i');
      q = q.replace(re, ' ').replace(/\s+/g, ' ').trim();
      location = {
        countySlug: info.countySlug,
        stateCode: meta.stateCode,
        stateSlug: meta.stateSlug,
        stateName: meta.stateName,
        precision: 'county',
        raw: phrase,
      };
      break;
    }
  }
  // Generic "X County ST"
  if (!location?.countySlug) {
    const cm = q.match(/\b([a-z][a-z\s-]+?)\s+county(?:\s+([a-z]{2}|[a-z\s]+))?\b/);
    if (cm) {
      const countySlug = normalizeCountySlug(cm[1]);
      const st = cm[2] ? normalizeState(cm[2]) : null;
      if (countySlug) {
        location = {
          countySlug,
          stateCode: st?.stateCode,
          stateSlug: st?.stateSlug,
          stateName: st?.stateName,
          precision: st ? 'county' : 'county',
          raw: cm[0],
        };
        q = q.replace(cm[0], ' ').replace(/\s+/g, ' ').trim();
      }
    }
  }

  // City + state patterns (longest city names first)
  const cityNames = Object.keys(CITY_STUB).sort((a, b) => b.length - a.length);
  for (const key of cityNames) {
    const cityRe = new RegExp(
      `\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s+(fl|florida|tx|texas|nj|new jersey|az|arizona|wa|washington|il|illinois|in|indiana))?\\b`
    );
    const m = q.match(cityRe);
    if (!m) continue;
    const stub = CITY_STUB[key];
    const explicit = m[1] ? normalizeState(m[1]) : null;
    const meta = normalizeState(explicit?.stateCode || stub.stateCode)!;
    location = {
      cityName: stub.cityName,
      citySlug: key.replace(/\s+/g, '-'),
      stateCode: meta.stateCode,
      stateSlug: meta.stateSlug,
      stateName: meta.stateName,
      precision: 'city',
      raw: m[0],
    };
    q = q.replace(m[0], ' ').replace(/\s+/g, ' ').trim();
    break;
  }

  // Ambiguous city without state
  for (const amb of AMBIGUOUS_CITIES) {
    const re = new RegExp(`\\b${amb}\\b`);
    if (re.test(q) && !location?.stateCode) {
      const m = q.match(re);
      if (m) {
        location = {
          cityName: amb.charAt(0).toUpperCase() + amb.slice(1),
          citySlug: amb,
          precision: 'city',
          raw: m[0],
        };
        locationAmbiguous = true;
        q = q.replace(m[0], ' ').replace(/\s+/g, ' ').trim();
      }
      break;
    }
  }

  // Bare state (name or code) — avoid eating "new" from other phrases after city removed
  if (!location?.stateCode) {
    // Prefer full state names first
    const byLen = [...US_STATES].sort((a, b) => b.name.length - a.name.length);
    for (const s of byLen) {
      const nameRe = new RegExp(`\\b${s.name.toLowerCase()}\\b`);
      if (nameRe.test(q)) {
        location = locFromState(s.code, 'state', { raw: s.name });
        q = q.replace(nameRe, ' ').replace(/\s+/g, ' ').trim();
        break;
      }
    }
  }
  if (!location?.stateCode) {
    // Trailing/leading 2-letter codes as whole tokens
    const codeM = q.match(/(?:^|\s)([a-z]{2})(?:\s|$)/);
    if (codeM) {
      const st = normalizeState(codeM[1]);
      if (st) {
        location = locFromState(st.stateCode, 'state', { raw: codeM[1] });
        q = q.replace(new RegExp(`(?:^|\\s)${codeM[1]}(?:\\s|$)`), ' ').replace(/\s+/g, ' ').trim();
      }
    }
  }

  // near/in/around/serving already consumed with geo spans above via inclusion in city match;
  // strip leftover prepositions
  q = q
    .replace(/\b(in|near|around|serving)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { location, origin, destination, remainder: q, locationAmbiguous };
}

export { ZIP_STUB, CITY_STUB };
