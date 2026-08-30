/**
 * Parent adapter for InsuranceTrustHub production Ask (insurance-ask-v1).
 * Ask constructs the specialist URL / may read the public JSON contract.
 * It does not query the Insurance graph or invent regulatory facts.
 */

export const INSURANCE_ASK_CONTRACT = 'insurance-ask-v1' as const;
export const INSURANCE_ASK_ROUTE = 'https://www.insurancetrusthub.com/ask';
export const INSURANCE_ASK_API = 'https://www.insurancetrusthub.com/api/ask';

export type InsuranceEntityClass = 'person' | 'agency' | 'insurer';

export type InsuranceAskMode =
  | 'entity'
  | 'identifier'
  | 'count'
  | 'aggregate'
  | 'comparison'
  | 'evidence'
  | 'definition'
  | 'fail_closed';

export const INSURANCE_SUPPORTED_MODES: InsuranceAskMode[] = [
  'entity',
  'identifier',
  'count',
  'aggregate',
  'comparison',
  'evidence',
  'definition',
  'fail_closed',
];

export const INSURANCE_ENTITY_CLASS_LABEL: Record<InsuranceEntityClass, string> = {
  person: 'Producer / individual',
  agency: 'Agency',
  insurer: 'Legal insurer',
};

export type InsuranceAskPayload = {
  contract: string;
  query?: {
    mode?: string;
    entityClass?: string;
    failReason?: string;
    jurisdiction?: { state?: string; meaning?: string };
    identifier?: { type?: string; value?: string };
    linesOfAuthority?: string[];
  };
  resultType?: string;
  entityClass?: string | null;
  results?: Array<{ name?: string; npn?: string | null; entityClass?: string }>;
  counts?: Array<{ label?: string; value?: number; grain?: string }>;
  pagination?: { total?: number };
  provenance?: {
    sourceFamily?: string;
    officialAsOf?: string | null;
    geographyMeaning?: string;
    grain?: string;
  };
  limitations?: string[];
};

export function insuranceAskUrl(query: string): string {
  const params = new URLSearchParams();
  params.set('q', query);
  return `${INSURANCE_ASK_ROUTE}?${params.toString()}`;
}

export function insuranceAskApiUrl(query: string): string {
  const params = new URLSearchParams();
  params.set('q', query);
  return `${INSURANCE_ASK_API}?${params.toString()}`;
}

export function detectInsuranceEntityClass(q: string): InsuranceEntityClass | undefined {
  if (
    /\b(legal insurers?|insurers?|carriers?|insurance compan(?:y|ies))\b/i.test(q) &&
    !/\bagenc/i.test(q) &&
    !/\b(producer|agent|person)/i.test(q)
  ) {
    return 'insurer';
  }
  if (/\b(producers?|individual|persons?|agents?)\b/i.test(q) && !/\bagenc/i.test(q)) return 'person';
  if (/\bagenc(y|ies)\b/i.test(q)) return 'agency';
  return undefined;
}

export function isInsuranceClassQuery(q: string): boolean {
  return Boolean(
    detectInsuranceEntityClass(q) ||
      /\binsur(ance|er)|agency license|\bnpn\b|\bnaic\b|line of authority|\bloa\b/i.test(q) ||
      isInsuranceRankingQuery(q) ||
      isInsuranceAdviceQuery(q),
  );
}

export function isInsuranceRankingQuery(q: string): boolean {
  return (
    /\b(best|safest|most trustworthy|cheapest|top[- ]?rated|most trusted|recommended|trust score)\b/i.test(q) &&
    /\b(insurance|insurer|agenc|agent|producer|carrier|policy|homeowners)\b/i.test(q)
  );
}

export function isInsuranceAdviceQuery(q: string): boolean {
  return /\b(which agent should i hire|who should i hire.*(agent|producer|agency)|how much homeowners|should i buy (ho-3|ho-5|insurance|homeowners)|cheapest homeowners policy)\b/i.test(
    q,
  );
}

export function insuranceGeographyMeaning(q: string): string {
  if (/\bdomicil/i.test(q)) {
    return 'Regulatory domicile is not currently a complete national Insurance Ask field. It is not inferred from address, market activity, or authorization.';
  }
  if (/\bserv(e|es|ing)\b|\bservice territory\b/i.test(q)) {
    return 'Credential jurisdiction is not service territory. InsuranceTrustHub does not treat “serves Florida” as a credential filter.';
  }
  if (/\blocated|office|headquarter|address|physical\b/i.test(q) && !/\blicensed|credentialed\b/i.test(q)) {
    return 'Recorded office/address is not credential jurisdiction. InsuranceTrustHub does not rewrite office geography as a license state.';
  }
  if (/\b(broward|palm beach|miami[-\s]?dade).*(appoint|authorized to (sell|write)|service (area|territory))\b/i.test(q) ||
    /\bcounty appointment\b/i.test(q)) {
    return 'Florida county appointment records are not service territory.';
  }
  return 'Credential jurisdiction — not office location, not domicile, and not service territory.';
}

export function insuranceAskMode(q: string, opts?: { identifier?: boolean }): InsuranceAskMode {
  if (opts?.identifier) {
    if (/\b(appoint|sell policies for|allowed to sell|authorized to sell)\b/i.test(q)) return 'evidence';
    if (/\bmarketplace\b/i.test(q)) return 'evidence';
    return 'identifier';
  }
  if (insuranceFailClosedReason(q)) return 'fail_closed';
  if (/\bwhat (is|does)\b.*\b(npn|line of authority|appointment|domicile|agency|insurer)\b/i.test(q)) {
    return 'definition';
  }
  if (/\b(how many|count of|number of)\b/i.test(q)) return 'count';
  if (/\bcompar(e|ison)\b/i.test(q)) return 'comparison';
  if (/\bmarketplace\b/i.test(q) || /\bappoint/i.test(q)) return 'evidence';
  return 'entity';
}

export function insuranceFailClosedReason(q: string): string | undefined {
  if (isInsuranceAdviceQuery(q) && /hire/i.test(q)) {
    return 'InsuranceTrustHub does not recommend an agent or insurer. It researches regulatory records.';
  }
  if (isInsuranceRankingQuery(q) || /\bcheapest homeowners policy\b/i.test(q)) {
    return 'InsuranceTrustHub does not rank agencies, agents, or insurers and does not publish a TrustHub insurance score or quotes.';
  }
  if (/\bclean record\b/i.test(q)) {
    return 'Missing evidence is not a clean record. InsuranceTrustHub does not infer a complaint-free status from absence.';
  }
  if (/\bhow many insurance providers\b/i.test(q)) {
    return 'Counts require an entity class. Agencies, individual producers, and legal insurers are not added into one “insurance providers” total.';
  }
  if (/\bdomicil/i.test(q) && /\binsurer/i.test(q)) {
    return 'Legal-insurer domicile is not currently a complete national Ask field. Domicile is not inferred from address, market activity, or authorization.';
  }
  if (/\bserv(e|es|ing)\b|\bservice territory\b/i.test(q) && /\b(florida|agency|agencies|insurer|producer)\b/i.test(q)) {
    return 'Credential jurisdiction is not service territory. Ask does not rewrite “serves” as a license state.';
  }
  if (
    /\b(broward|palm beach|miami[-\s]?dade)\b/i.test(q) &&
    /\b(appoint|authorized to (sell|write)|service (area|territory)|sell insurance in)\b/i.test(q)
  ) {
    return 'Florida county appointment records are not treated as service territory or as county-level authorization to write insurance.';
  }
  if (/\bcounty appointment\b/i.test(q)) {
    return 'Florida county appointment records are not treated as service territory or as county-level authorization to write insurance.';
  }
  if (
    /\b(appoint|sell policies for|allowed to sell|authorized to sell)\b/i.test(q) &&
    !/\bnpn\s*#?\s*\d/i.test(q) &&
    !/\bevery insurer/i.test(q)
  ) {
    return 'Appointment answers require a labeled NPN and indexed appointment evidence. A license or line of authority does not prove an appointment. Missing evidence is not “not appointed.”';
  }
  if (/\bevery insurer'?s products|authorized to sell every\b/i.test(q)) {
    return 'A state credential or line of authority does not establish appointment with every insurer.';
  }
  if (
    /\b(show|list|find)\b/i.test(q) &&
    /\b(producers?|individuals?|persons?|agents?)\b/i.test(q) &&
    !/\bhow many\b/i.test(q) &&
    !/\bnpn\b/i.test(q) &&
    !/\bagenc/i.test(q)
  ) {
    return 'Public producer profile pages are not published. Ask can count credentialed persons or look up a labeled NPN. It will not mass-publish people.';
  }
  if (/^\d{4,12}$/.test(q.trim())) {
    return 'Bare digits are ambiguous. Use a labeled NPN or NAIC company code.';
  }
  return undefined;
}

export async function fetchInsuranceAsk(query: string, timeoutMs = 4000): Promise<InsuranceAskPayload | null> {
  if (process.env.NODE_TEST_CONTEXT) return null;
  if (process.env.INSURANCE_ASK_FETCH === '0') return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(insuranceAskApiUrl(query), {
      signal: controller.signal,
      headers: { accept: 'application/json' },
      next: { revalidate: 60 },
    } as RequestInit);
    if (!res.ok) return null;
    const json = (await res.json()) as InsuranceAskPayload;
    if (json?.contract !== INSURANCE_ASK_CONTRACT) return null;
    return json;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
