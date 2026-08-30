/**
 * Parent adapter for SeniorTrustHub production Ask (senior-ask-v1).
 * Ask constructs the specialist URL / reads the public JSON contract.
 * It does not query Senior databases or invent provider facts.
 */

export const SENIOR_ASK_CONTRACT = 'senior-ask-v1' as const;
export const SENIOR_ASK_ROUTE = 'https://www.seniortrusthub.com/ask';
export const SENIOR_ASK_API = 'https://www.seniortrusthub.com/api/ask';

export type SeniorProviderClass = 'nursing_home' | 'home_health' | 'hospice';

export type SeniorAskMode =
  | 'entity'
  | 'identifier'
  | 'count'
  | 'aggregate'
  | 'comparison'
  | 'evidence'
  | 'definition'
  | 'fail_closed';

export const SENIOR_SUPPORTED_MODES: SeniorAskMode[] = [
  'entity',
  'identifier',
  'count',
  'aggregate',
  'comparison',
  'evidence',
  'definition',
  'fail_closed',
];

export const SENIOR_PROVIDER_CLASS_LABEL: Record<SeniorProviderClass, string> = {
  nursing_home: 'Nursing Home',
  home_health: 'Home Health',
  hospice: 'Hospice',
};

export type SeniorAskPayload = {
  contract: string;
  query?: {
    mode?: string;
    providerClass?: string;
    failReason?: string;
    geography?: { type?: string; value?: string; meaning?: string };
  };
  resultType?: string;
  provenance?: {
    providerClass?: string;
    sourceFamily?: string;
    officialAsOf?: string | null;
    geographyMeaning?: string;
    queryGrain?: string;
  };
  failClosed?: { reason?: string; alternatives?: string[] };
  limitations?: string[];
};

export function seniorAskUrl(query: string): string {
  const params = new URLSearchParams();
  params.set('q', query);
  return `${SENIOR_ASK_ROUTE}?${params.toString()}`;
}

export function seniorAskApiUrl(query: string): string {
  const params = new URLSearchParams();
  params.set('q', query);
  return `${SENIOR_ASK_API}?${params.toString()}`;
}

export function detectSeniorProviderClass(q: string): SeniorProviderClass | undefined {
  if (/\bhome\s*health\b/i.test(q)) return 'home_health';
  if (/\bhospice\b/i.test(q)) return 'hospice';
  if (/\bnursing\s*homes?\b/i.test(q)) return 'nursing_home';
  return undefined;
}

export function isSeniorClassQuery(q: string): boolean {
  return Boolean(
    detectSeniorProviderClass(q) ||
      /\b(?:cms\s+)?ccn\s*#?\s*\d{6}\b/i.test(q) ||
      /\b(senior\s+providers?|senior care|aging parent|assisted living|memory care|grandma|grandmother|grandpa|grandfather|nana|nursing home)\b/i.test(q)
  );
}

export function mentionsCountyGeography(q: string): boolean {
  return /\bcounty\b/i.test(q) || /\bmiami[-\s]?dade\b/i.test(q) || /\bbroward\b/i.test(q) || /\bpalm\s*beach\b/i.test(q);
}

export function isCombinedSeniorCountQuery(q: string): boolean {
  return /\b(how many|count|number of)\b/i.test(q) && /\bsenior\s+providers?\b/i.test(q) && !detectSeniorProviderClass(q);
}

export function isRankingQuery(q: string): boolean {
  return /\b(safest|best|worst|top[- ]rated|most trusted)\b/i.test(q);
}

export function isHospiceOverallStarQuery(q: string): boolean {
  return detectSeniorProviderClass(q) === 'hospice' && /\b(\d\s*[- ]?star|overall\s+stars?|cms\s+overall)\b/i.test(q);
}

export function isHomeHealthCountyQuery(q: string): boolean {
  return detectSeniorProviderClass(q) === 'home_health' && mentionsCountyGeography(q);
}

export function isUnsupportedChowQuery(q: string): boolean {
  const cls = detectSeniorProviderClass(q);
  return /\b(chow|change of ownership)\b/i.test(q) && cls !== 'nursing_home' && cls !== undefined;
}

export function seniorGeographyMeaning(q: string, cls?: SeniorProviderClass): string {
  if (cls === 'home_health') {
    if (mentionsCountyGeography(q)) {
      return 'Home Health county filtering is not supported. Office city/state/ZIP is not service area.';
    }
    return 'Home Health office state/city/ZIP on the CMS directory record — not a verified service area.';
  }
  if (cls === 'hospice') {
    return 'Hospice office geography (state + office-county as stored) — not a verified service area.';
  }
  if (cls === 'nursing_home') {
    if (mentionsCountyGeography(q)) {
      return 'Nursing Home address/location county on the CMS directory record — not a verified service area.';
    }
    return 'Nursing Home address/location state on the CMS directory record — not a verified service area.';
  }
  return 'SeniorTrustHub geography is provider address/office on the class directory — not service area.';
}

export function seniorAskMode(q: string, opts?: { identifier?: boolean }): SeniorAskMode {
  if (opts?.identifier) return 'identifier';
  if (isCombinedSeniorCountQuery(q) || isRankingQuery(q) || isHospiceOverallStarQuery(q) || isHomeHealthCountyQuery(q) || isUnsupportedChowQuery(q)) {
    return 'fail_closed';
  }
  if (/\b(how many|count of|number of)\b/i.test(q)) return 'count';
  if (/\bcompar(e|ison)\b/i.test(q)) return 'comparison';
  if (/\b(deficien|inspection|ownership|chow|evidence|penalty|penalties)\b/i.test(q)) return 'evidence';
  if (/\bwhat is\b|\bmean\b|\bdefinition\b/i.test(q)) return 'definition';
  if (/\baverage|aggregate|distribution\b/i.test(q)) return 'aggregate';
  return 'entity';
}

export function seniorFailClosedReason(q: string): string | undefined {
  if (isCombinedSeniorCountQuery(q)) {
    return 'Counts require a provider class. Nursing Home, Home Health, and Hospice must stay separate — Ask will not sum them into one “senior providers” total.';
  }
  if (isRankingQuery(q)) {
    return 'SeniorTrustHub does not publish a safest/best/worst ranking and does not create a safety score. CMS ratings are not TrustHub recommendations.';
  }
  if (isHospiceOverallStarQuery(q)) {
    return 'Hospice does not have an overall CMS star rating comparable to nursing homes.';
  }
  if (isHomeHealthCountyQuery(q)) {
    return 'Home Health county filtering is not supported. State, city, and ZIP are the supported Home Health geography fields.';
  }
  if (isUnsupportedChowQuery(q)) {
    return 'Change of ownership (CHOW) evidence is Nursing Home only on SeniorTrustHub.';
  }
  return undefined;
}

export async function fetchSeniorAsk(query: string, timeoutMs = 4000): Promise<SeniorAskPayload | null> {
  if (process.env.NODE_TEST_CONTEXT) return null;
  if (process.env.SENIOR_ASK_FETCH === '0') return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(seniorAskApiUrl(query), {
      signal: controller.signal,
      headers: { accept: 'application/json' },
      next: { revalidate: 60 },
    } as RequestInit);
    if (!res.ok) return null;
    const json = (await res.json()) as SeniorAskPayload;
    if (json?.contract !== SENIOR_ASK_CONTRACT) return null;
    return json;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
