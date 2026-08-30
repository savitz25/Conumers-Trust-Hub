/**
 * Parent adapter for LenderTrustHub production Ask (lender-ask-v1).
 * Ask constructs the specialist URL / may read the public JSON contract.
 * It does not query the Lender database or invent HMDA / CFPB facts.
 */

export const LENDER_ASK_CONTRACT = 'lender-ask-v1' as const;
export const LENDER_ASK_ROUTE = 'https://www.lendertrusthub.com/ask';
export const LENDER_ASK_API = 'https://www.lendertrusthub.com/api/ask';

export type LenderAskMode =
  | 'entity'
  | 'count'
  | 'aggregate'
  | 'comparison'
  | 'evidence'
  | 'definition'
  | 'fail_closed';

export const LENDER_SUPPORTED_MODES: LenderAskMode[] = [
  'entity',
  'count',
  'aggregate',
  'comparison',
  'evidence',
  'definition',
  'fail_closed',
];

export type LenderAskPayload = {
  contract?: string;
  query?: {
    mode?: string;
    failReason?: string;
    failClosedKind?: string;
    loanType?: string[];
    actionTaken?: string[];
    geography?: { grain?: string; state?: string; county?: string; note?: string };
  };
  headline?: string;
  body?: string;
  grain?: string;
  period?: string;
  geographyWarning?: string;
  failClosed?: boolean;
  facts?: Array<{ label?: string; value?: string }>;
  rows?: Array<{
    displayName?: string;
    metric?: number;
    lei?: string;
    identityStatus?: string;
    metricLabel?: string;
  }>;
  caveats?: string[];
  trace?: { grain?: string; period?: string; method?: string; publicationGate?: string };
  denominator?: { label?: string; value?: number };
};

export function lenderAskUrl(query: string): string {
  const params = new URLSearchParams();
  params.set('q', query);
  return `${LENDER_ASK_ROUTE}?${params.toString()}`;
}

export function lenderAskApiUrl(query: string): string {
  const params = new URLSearchParams();
  params.set('q', query);
  return `${LENDER_ASK_API}?${params.toString()}`;
}

export function isLenderClassQuery(q: string): boolean {
  return /\b(lenders?|mortgage|hmda|fha|nmls|loan officers?|mortgage brokers?|originat|loan estimate)\b/i.test(q);
}

export function lenderGeographyMeaning(q: string): string {
  if (/\bbroward\b|\bpalm beach\b|\bcounty\b/i.test(q)) {
    return 'HMDA mortgaged-property county — not lender branch county, headquarters, license jurisdiction, or service territory.';
  }
  if (/\bflorida\b|\bfl\b/i.test(q)) {
    return 'HMDA mortgaged-property state = Florida — not lender headquarters, branch geography, or service territory.';
  }
  return 'HMDA geography is the property/census location tied to the application — not lender HQ, branch, or service territory.';
}

export function lenderFailClosedReason(q: string): string | undefined {
  if (/\b(best|top lender|recommended|safest|most trustworthy|trust score)\b/i.test(q)) {
    return 'LenderTrustHub does not rank “best,” safest, or most trustworthy lenders. Most is a raw volume count, not a recommendation.';
  }
  if (/\b(cheapest|lowest (current )?(rate|apr)|current (mortgage )?rate|live rate|interest rates? today)\b/i.test(q)) {
    return 'HMDA is a 2025 reporting vintage, not today’s advertised rate sheet. There is no consumer pricing dataset on this Ask layer.';
  }
  if (/\bdiscriminat/i.test(q)) {
    return 'Denial counts are not a finding of discrimination.';
  }
  if (/\bwhy .{0,40}den(?:y|ies|ial)|denial reasons?\b/i.test(q)) {
    return 'Denial-reason taxonomy is not stored on current HMDA observation rows. Denial counts are not reasons.';
  }
  if (/\bhighest denial rate\b|\bdenial rates?\b|\bcomplaint rates?\b|\bhighest share\b|\bpercentage\b/i.test(q) && !/\bmost\b/i.test(q)) {
    return 'A rate or share requires a controlled denominator. LenderTrustHub does not silently substitute a raw count.';
  }
  if (/\bserv(e|es|ing) florida\b|\bservice (area|territory)\b|\bwho serves\b/i.test(q)) {
    return 'HMDA property geography is not a lender service territory or license footprint.';
  }
  if (
    /\bheadquartered\b|\blenders (headquartered|based) in florida\b/i.test(q) &&
    !/\boriginat|\bapplication|\bproperties in\b|\bhmda\b|\bcomplaint\b|\bcfpb\b/i.test(q)
  ) {
    return 'This Ask layer does not rank lenders by headquarters. Property-geography questions must say originated/applied for properties in that place.';
  }
  return undefined;
}

export function isLenderComparisonQuery(q: string): boolean {
  const places = /broward.*palm beach|palm beach.*broward|compare .*(broward|palm beach)/i.test(q);
  if (!places) return false;
  return /\b(mortgage|hmda|fha|origination|loan applications?|lenders?)\b/i.test(q);
}

export function isAmbiguousBrokerQuery(q: string): boolean {
  if (!/\bbrokers?\b/i.test(q)) return false;
  if (/\bmortgage brokers?\b|\bloan brokers?\b|\bloan officers?\b/i.test(q)) return false;
  if (/\bmoving brokers?\b|\bhousehold-?goods brokers?\b|\bhhg brokers?\b/i.test(q)) return false;
  if (/\binsurance brokers?\b|\b(npn|naic|underwrit|agency)\b/i.test(q)) return false;
  if (/\bbroker-?dealers?\b/i.test(q)) return false;
  if (isLenderClassQuery(q)) return false;
  return true;
}

export function lenderAskMode(q: string): LenderAskMode {
  if (lenderFailClosedReason(q)) return 'fail_closed';
  if (/\bwhat (is|does) (an? )?(nmls|hmda|origination|fha)\b/i.test(q)) return 'definition';
  if (isLenderComparisonQuery(q) || /\bcompar(e|ison)\b|\bversus\b|\b vs\.? \b/i.test(q)) return 'comparison';
  if (/\bcomplaint\b|\bcfpb\b/i.test(q)) return 'evidence';
  if (/\bhow many\b|\bcount of\b/i.test(q)) return 'count';
  if (/\bwhich lenders?\b|\bmost\b/i.test(q)) return 'entity';
  return 'entity';
}

export async function fetchLenderAsk(query: string, timeoutMs = 8000): Promise<LenderAskPayload | null> {
  if (process.env.NODE_TEST_CONTEXT) return null;
  if (process.env.LENDER_ASK_FETCH === '0') return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(lenderAskApiUrl(query), {
      signal: controller.signal,
      headers: { accept: 'application/json' },
      next: { revalidate: 60 },
    } as RequestInit);
    if (!res.ok) return null;
    const json = (await res.json()) as LenderAskPayload;
    if (json?.contract !== LENDER_ASK_CONTRACT) return null;
    return json;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
