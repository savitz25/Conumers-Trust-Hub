/**
 * Parent adapter for MoveTrustHub production Ask (move-ask-v1).
 * Ask constructs the specialist URL / may read the public JSON contract.
 * It does not query the Move database or invent FMCSA / FDACS facts.
 */

export const MOVE_ASK_CONTRACT = 'move-ask-v1' as const;
export const MOVE_ASK_ROUTE = 'https://www.movetrusthub.com/ask';
export const MOVE_ASK_API = 'https://www.movetrusthub.com/api/ask';

export type MoveRegulatoryRole = 'carrier' | 'broker' | 'carrier_broker';

export type MoveAskMode =
  | 'entity'
  | 'identifier'
  | 'count'
  | 'aggregate'
  | 'comparison'
  | 'evidence'
  | 'definition'
  | 'fail_closed';

export const MOVE_SUPPORTED_MODES: MoveAskMode[] = [
  'entity',
  'identifier',
  'count',
  'aggregate',
  'comparison',
  'evidence',
  'definition',
  'fail_closed',
];

export const MOVE_ROLE_LABEL: Record<MoveRegulatoryRole, string> = {
  carrier: 'Carrier',
  broker: 'Broker',
  carrier_broker: 'Carrier / Broker',
};

export type MoveAskPayload = {
  contract: string;
  query?: {
    mode?: string;
    role?: string;
    failReason?: string;
    identifier?: { type?: string; value?: string };
    jurisdiction?: { state?: string; meaning?: string };
    definitionId?: string;
  };
  resultType?: string;
  results?: Array<{
    name?: string;
    usdot?: string | null;
    mc?: string | null;
    role?: string;
    whyMatched?: string;
  }>;
  counts?: Array<{ label?: string; value?: number; grain?: string }>;
  pagination?: { total?: number };
  provenance?: {
    sourceFamily?: string;
    officialAsOf?: string | null;
    geographyMeaning?: string;
    grain?: string;
  };
  limitations?: string[];
  definition?: { title?: string; body?: string };
};

export function moveAskUrl(query: string): string {
  const params = new URLSearchParams();
  params.set('q', query);
  return `${MOVE_ASK_ROUTE}?${params.toString()}`;
}

export function moveAskApiUrl(query: string): string {
  const params = new URLSearchParams();
  params.set('q', query);
  return `${MOVE_ASK_API}?${params.toString()}`;
}

export function hasInsuranceDomain(q: string): boolean {
  return /\b(insur(ance|er)|npn|naic|underwrit|homeowners|auto insurer|life insurer|polic(y|ies)|agency license|line of authority|\bloa\b)\b/i.test(
    q,
  );
}

export function isMoveClassQuery(q: string): boolean {
  return (
    /\b(movers?|moving compan(?:y|ies)|moving|household-?goods|hhg|motor carriers?|moving carriers?|moving brokers?|usdot|fmcsa|interstate movers?|operating authority|belongings|fdacs|intrastate movers?|im registration)\b/i.test(
      q,
    ) ||
    /\bdot number\b/i.test(q) ||
    /\b(?:usdot|dot)\s*#?\s*\d{3,8}\b/i.test(q) ||
    /\bmc\s*#?-?\s*\d{3,8}\b/i.test(q) ||
    /\b(haul(ing|s)?|transporters?|shipment)\b/i.test(q) ||
    /\bdifference between (a )?(carrier|mover) and (a )?broker\b/i.test(q) ||
    /\bwhat is (a )?(carrier|mover) (vs\.?|versus|or|and) (a )?broker\b/i.test(q)
  );
}

export function isAmbiguousCarrierQuery(q: string): boolean {
  if (!/\bcarriers?\b/i.test(q)) return false;
  if (isMoveClassQuery(q)) return false;
  if (hasInsuranceDomain(q)) return false;
  return true;
}

export function detectMoveRole(q: string): MoveRegulatoryRole | undefined {
  const broker = /\bbrokers?\b/i.test(q);
  const carrier = /\bcarriers?\b|\bmotor carriers?\b|\bhousehold-?goods carriers?\b/i.test(q);
  if (broker && carrier) return 'carrier_broker';
  if (broker) return 'broker';
  if (carrier || /\binterstate movers?\b|\bhhg\b|\bhousehold-?goods\b/i.test(q)) return 'carrier';
  return undefined;
}

export function moveGeographyMeaning(q: string): string {
  if (/\bserv(e|es|ing)\b|\bservice (area|territory|coverage)\b/i.test(q)) {
    return 'Headquarters and Florida IM registration are not service territory. Ask does not infer county coverage from a Florida address.';
  }
  if (/\b(fdacs|intrastate mover|im registration)\b/i.test(q)) {
    return 'Florida Intrastate Mover registration — not FMCSA interstate authority, not headquarters, not service territory.';
  }
  if (/\bheadquarter|recorded (company )?address|based in\b/i.test(q) || /\bflorida\b/i.test(q)) {
    return 'Recorded company address / headquarters state — not service territory.';
  }
  return 'Not rewritten as service territory. Interstate authority is not Florida coverage.';
}

export function moveFailClosedReason(q: string): string | undefined {
  if (
    /\bwho will actually (move|haul|transport)\b/i.test(q) ||
    /\bwho (hauls|transports) my (belongings|stuff|shipment)\b/i.test(q) ||
    /\b(is this|will this) broker\b.*\b(actually )?(transport|haul|move)\b/i.test(q) ||
    /\bbroker the company that will actually transport\b/i.test(q)
  ) {
    return 'A broker can arrange transportation without physically hauling the shipment. MoveTrustHub does not infer the transporting carrier from broker identity, shared address, similar name, website, or phone.';
  }
  if (
    (/\b(best|safest|most trustworthy|least risky|top[- ]?rated|most trusted|recommended)\b/i.test(q) &&
      /\b(mover|carrier|broker|moving compan)/i.test(q)) ||
    /\bwhich state has better movers\b/i.test(q)
  ) {
    return 'MoveTrustHub does not rank movers and does not publish a TrustHub mover score. Research identity, authority, and registration instead.';
  }
  if (/\b(cheapest|lowest price|quote|how much to move)\b/i.test(q) && /\b(mover|moving|florida|new york|ny)\b/i.test(q)) {
    return 'MoveTrustHub Ask is not a quote engine. Regulatory records do not establish the price a company would charge.';
  }
  if (/\b(scam|fraud|fraudulent|trust score)\b/i.test(q) && /\b(mover|carrier|broker|usdot|mc)\b/i.test(q)) {
    return 'MoveTrustHub does not score fraud or declare a company a scam. Missing evidence is not a clean record.';
  }
  if (
    (/\bserv(e|es|ing)\b|\bservice (area|territory|coverage)\b/i.test(q) &&
      /\b(florida|palm beach|broward|miami|county|movers?)\b/i.test(q)) ||
    /\bmovers serving\b/i.test(q)
  ) {
    return 'Headquarters or Florida registration is not service territory. Ask does not infer “serves Palm Beach County” from a Florida address.';
  }
  if (/\bhow many moving companies\b|\btotal movers\b/i.test(q)) {
    return 'Counts require a regulatory grain. Carrier, broker, dual-role, and Florida IM registrations are not added into one “moving companies” total.';
  }
  return undefined;
}

export function moveAskMode(q: string, opts?: { identifier?: boolean }): MoveAskMode {
  if (moveFailClosedReason(q)) return 'fail_closed';
  if (opts?.identifier) {
    if (/\bcomplaint/i.test(q)) return 'evidence';
    if (/\b(authorit|operating authority|status|role|carrier or (a )?broker|is .+ active|household-?goods)\b/i.test(q)) {
      return 'evidence';
    }
    if (/\bis\b[\s\S]{0,80}\b(a )?(carrier|broker)\b/i.test(q)) return 'evidence';
    return 'identifier';
  }
  if (
    /\bwhat is (a |an )?(usdot|mc|household-?goods carrier|moving broker|broker|operating authority|florida intrastate mover)\b/i.test(
      q,
    ) ||
    /\bdifference between (a )?(carrier|mover) and (a )?broker\b/i.test(q) ||
    /\bwhat does usdot( number| status)? mean\b/i.test(q)
  ) {
    return 'definition';
  }
  if (/\bhow many\b|\bcount of\b/i.test(q)) return 'count';
  if (/\bcompar(e|ison)\b/i.test(q)) return 'comparison';
  return 'entity';
}

export async function fetchMoveAsk(query: string, timeoutMs = 4000): Promise<MoveAskPayload | null> {
  if (process.env.NODE_TEST_CONTEXT) return null;
  if (process.env.MOVE_ASK_FETCH === '0') return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(moveAskApiUrl(query), {
      signal: controller.signal,
      headers: { accept: 'application/json' },
      next: { revalidate: 60 },
    } as RequestInit);
    if (!res.ok) return null;
    const json = (await res.json()) as MoveAskPayload;
    if (json?.contract !== MOVE_ASK_CONTRACT) return null;
    return json;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
