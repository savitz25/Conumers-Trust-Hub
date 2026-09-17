/**
 * Parent adapter for InvestorTrustHub production Ask (investor-ask-v1).
 * Ask constructs the specialist URL / may read the public JSON contract.
 * It does not query the Investor database or invent Form ADV facts.
 */

export const INVESTOR_ASK_CONTRACT = 'investor-ask-v1' as const;
export const INVESTOR_ASK_ROUTE = 'https://www.investortrusthub.com/ask';
export const INVESTOR_ASK_API = 'https://www.investortrusthub.com/api/ask';

export type InvestorFirmType = 'ria' | 'era' | 'all';

export type InvestorAskMode =
  | 'entity'
  | 'identifier'
  | 'count'
  | 'aggregate'
  | 'comparison'
  | 'evidence'
  | 'definition'
  | 'fail_closed';

export const INVESTOR_SUPPORTED_MODES: InvestorAskMode[] = [
  'entity',
  'identifier',
  'count',
  'aggregate',
  'comparison',
  'evidence',
  'definition',
  'fail_closed',
];

export const INVESTOR_FIRM_TYPE_LABEL: Record<InvestorFirmType, string> = {
  ria: 'RIA',
  era: 'ERA',
  all: 'RIA + ERA (kept separate)',
};

export type InvestorAskPayload = {
  contract: string;
  query?: {
    mode?: string;
    firmType?: string;
    failReason?: string;
    geography?: { type?: string; value?: string; meaning?: string };
  };
  resultType?: string;
  provenance?: {
    sourceFamily?: string;
    officialAsOf?: string | null;
    geographyMeaning?: string;
    metric?: string;
    raumUnits?: string;
    compensationTaxonomy?: string;
    identifierMethod?: string;
  };
  limitations?: string[];
  results?: Array<{
    firmName?: string;
    crd?: string;
    firmType?: string;
    principalOffice?: string;
    raum?: string;
    compensationMethods?: string[];
    href?: string | null;
    publicationNote?: string;
    whyMatched?: string;
  }>;
  pagination?: { total?: number };
};

export function investorAskUrl(query: string): string {
  const params = new URLSearchParams();
  params.set('q', query);
  return `${INVESTOR_ASK_ROUTE}?${params.toString()}`;
}

export function investorAskApiUrl(query: string): string {
  const params = new URLSearchParams();
  params.set('q', query);
  return `${INVESTOR_ASK_API}?${params.toString()}`;
}

export function detectInvestorFirmType(q: string): InvestorFirmType | undefined {
  const ria = /\brias?\b|\bregistered investment advisers?\b|\bsec-registered\b/i.test(q);
  const era = /\beras?\b|\bexempt reporting advisers?\b/i.test(q);
  if (ria && era) return 'all';
  if (ria) return 'ria';
  if (era) return 'era';
  if (/\binvestment advisers?\b|\badviser firms?\b|\badvisory firms?\b/i.test(q)) return 'all';
  return undefined;
}

export function isInvestorClassQuery(q: string): boolean {
  return Boolean(
    detectInvestorFirmType(q) ||
      /\b(?:form\s+adv|iard|crd\s*#?\s*\d{1,10}|raum|regulatory assets|asset-based|fixed fees?|hourly (charges|fees)|compensation methods?)\b/i.test(q) ||
      /\b(investment firm|investment compan(?:y|ies)|investment adviser|investments?|wealth management|financial adviser|financial advisor|broker-?dealers?)\b/i.test(q) ||
      isInvestorAdviserSeekingQuery(q) ||
      isInvestorRankingQuery(q) ||
      isInvestorAdviceQuery(q)
  );
}

export function isInvestorRankingQuery(q: string): boolean {
  return (
    /\b(best|safest|most trustworthy|trustworthiest|lowest fees?|cheapest|best returns?|highest (returns?|performance)|performs best|most money|most trusted|top[- ]rated)\b/i.test(q) &&
    /\b(adviser|advisor|ria|era|investment firm)\b/i.test(q)
  );
}

const SECURITIES_INSTRUMENT =
  /\b(?:stocks?|etfs?|e\.?\s*t\.?\s*f\.?s?|exchange[-\s]?traded funds?|mutual funds?|index funds?|equities|securities|tickers?)\b/i;
const ADVISER_REGISTRATION_RESEARCH =
  /\b(?:investment advis(?:er|or)s?|financial advis(?:er|or)s?|registered investment|exempt reporting advis(?:er|or)|form\s+adv|\biard\b|\bcrd\b|\brias?\b|\beras?\b|sec[-\s]?registered|disciplinary|disclosures?|principal office)\b/i;
const NON_SECURITIES_PURCHASE =
  /\b(?:houses?|homes?|housing|propert(?:y|ies)|mortgages?|condos?|apartments?|insurance|polic(?:y|ies)|lenders?|loans?|contractors?|roofers?|movers?|nursing|cars?|vehicles?|autos?)\b/i;

/** Adviser-seeking research (not personal securities picking). */
export function isInvestorAdviserSeekingQuery(q: string): boolean {
  return /\b(?:who can help me invest|i need (?:an? )?(?:investment|financial) advis(?:er|or))\b/i.test(q);
}

/**
 * Category B: personal stock/ETF/allocation advice. Intent gate for live `/ask`.
 * Must not fire on InvestorTrustHub firm/adviser research or housing "buy" journeys.
 */
export function isUnsupportedSecuritiesAdviceQuery(q: string): boolean {
  const text = q.trim();
  if (!text) return false;
  if (ADVISER_REGISTRATION_RESEARCH.test(text) && !SECURITIES_INSTRUMENT.test(text)) return false;
  const instrument = SECURITIES_INSTRUMENT.test(text);
  const allocation =
    /\bwhere (?:should|do|can|would) i invest\b/i.test(text) ||
    /\binvest\s+(?:my\s+)?(?:money|savings)?\s*\$?\d/i.test(text);
  const pickList =
    /\b(?:give me|pick|recommend|name|list|suggest)\b[^?.!]{0,50}\b(?:\d+|a few|three|some|a|an)?\s*(?:stocks?|etfs?|funds?|securities)\b/i.test(text) ||
    /\b(?:stocks?|etfs?|funds?)\b[^?.!]{0,40}\b(?:outperform|beat the market|right now|for retirement|today|to buy|to sell)\b/i.test(text);
  const adviceVerb =
    /\b(?:should i (?:buy|sell|hold|invest)|what .{0,40}(?:buy|sell|pick|invest)|which (?:stocks?|etfs?|funds?)|best .{0,20}(?:stocks?|etfs?|funds?)|(?:stocks?|etfs?|funds?).{0,20}(?:best|buy|invest)|outperform|right now|for retirement|invest in)\b/i.test(
      text,
    );
  const tickerAdvice = /\bshould i (?:buy|sell|hold)\b/i.test(text) && !NON_SECURITIES_PURCHASE.test(text);
  const recommendInstrument = instrument && /\b(?:recommend|suggest|pick|buy|sell|invest)\b/i.test(text);
  const portfolio =
    /\b(?:portfolio recommendation|pick (?:an? )?investments?|move my ira)\b/i.test(text);
  return Boolean(allocation || pickList || portfolio || (instrument && adviceVerb) || recommendInstrument || (tickerAdvice && !ADVISER_REGISTRATION_RESEARCH.test(text)));
}

export function isInvestorAdviceQuery(q: string): boolean {
  return isUnsupportedSecuritiesAdviceQuery(q) || /\b(?:move my ira|portfolio recommendation|pick (an? )?investments?|who should i hire)\b/i.test(q);
}

export const UNSUPPORTED_SECURITIES_ADVICE_STATUS =
  'TrustHub does not recommend stocks, ETFs, or personal investments.';

export function investorGeographyMeaning(q: string): string {
  if (/\bserv(e|es|ing)\b|\bclients in\b|\bnotice-?filed\b/i.test(q)) {
    return 'InvestorTrustHub current Ask geography is principal office on the SEC/IARD roster — not client geography, service territory, or notice-filing. We interpreted location as principal-office state.';
  }
  return 'Principal-office state/city/ZIP on the SEC/IARD roster — not client geography, service territory, or notice-filing footprint.';
}

export function investorAskMode(q: string, opts?: { identifier?: boolean }): InvestorAskMode {
  if (opts?.identifier) return 'identifier';
  if (isInvestorRankingQuery(q) || isInvestorAdviceQuery(q)) return 'fail_closed';
  if (/\bwhat (is|does)\b.*\b(raum|ria|era|crd|form adv|asset-based)\b/i.test(q)) return 'definition';
  if (/\b(how many|count of|number of)\b/i.test(q)) return 'count';
  if (/\bcompar(e|ison)\b/i.test(q)) return 'comparison';
  if (/\bdistributed by raum\b|\braum bands?\b|compensation methods are most commonly/i.test(q)) return 'aggregate';
  if (/\b(ownership|affiliat|filing|evidence)\b/i.test(q) && /\bcrd\b/i.test(q)) return 'evidence';
  return 'entity';
}

export function investorFailClosedReason(q: string): string | undefined {
  if (isInvestorAdviceQuery(q)) {
    return 'InvestorTrustHub researches adviser regulatory records rather than recommending investments or personal portfolio decisions.';
  }
  if (isInvestorRankingQuery(q)) {
    return 'InvestorTrustHub does not rank advisers, predict returns, price advice, or recommend hiring decisions. RAUM is not performance. Item 5.E methods are not fee amounts.';
  }
  return undefined;
}

export async function fetchInvestorAsk(query: string, timeoutMs = 4000): Promise<InvestorAskPayload | null> {
  if (process.env.NODE_TEST_CONTEXT) return null;
  if (process.env.INVESTOR_ASK_FETCH === '0') return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(investorAskApiUrl(query), {
      signal: controller.signal,
      headers: { accept: 'application/json' },
      next: { revalidate: 60 },
    } as RequestInit);
    if (!res.ok) return null;
    const json = (await res.json()) as InvestorAskPayload;
    if (json?.contract !== INVESTOR_ASK_CONTRACT) return null;
    return json;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
