/**
 * Consumer answer-layer helpers.
 * Does not change specialist contracts, evidence semantics, or ranking protections.
 * Judgment modifiers are notes — they do not abandon a supported entity search.
 */

import type { SpecialistHubId } from './registry.ts';
import type { ParsedNetworkAsk } from './ask-parse.ts';
import { insuranceAskUrl, insuranceFailClosedReason } from './insurance-ask.ts';
import { investorAskUrl, investorFailClosedReason } from './investor-ask.ts';
import { lenderAskUrl, lenderFailClosedReason, type LenderAskPayload } from './lender-ask.ts';
import { moveAskUrl, moveFailClosedReason, type MoveAskPayload } from './move-ask.ts';
import { seniorAskUrl, seniorFailClosedReason, type SeniorAskPayload } from './senior-ask.ts';
import { contractorAskUrlFromParsed } from './ask-plan-urls.ts';

export type FailKind = 'hard' | 'soft';

export type ConsumerOption = {
  name: string;
  hubId: SpecialistHubId;
  fields: Array<{ label: string; value: string }>;
  href?: string;
  whyMatched?: string;
};

export type ConsumerFollowUp = {
  prompt: string;
  choices: Array<{ label: string; href: string }>;
};

const JUDGMENT =
  /\b(best|better|good|top(?:[- ]rated)?|safest|most trustworthy|trustworthiest|trustworthy|cheapest|lowest fees?|lowest price|recommended|most trusted|least risky|best (?:performance|returns)|highest (?:returns?|performance)|investment returns|performs best)\b/i;

const HARD_PRICING =
  /\b(rates? tomorrow|(?:mortgage )?rates? (?:be )?tomorrow|live rate|interest rates? today|current (?:mortgage )?rates?|what will .{0,24}rates?)\b/i;

export function isJudgmentModifierQuery(q: string): boolean {
  return JUDGMENT.test(q);
}

export function isHardPricingQuery(q: string): boolean {
  return HARD_PRICING.test(q);
}

export function stripJudgmentModifiers(q: string): string {
  return q
    .replace(/\bwith (?:the )?(?:best|highest) (?:performance|returns?)\b/gi, '')
    .replace(/\b(?:best|highest) (?:performance|returns?)\b/gi, '')
    .replace(/\binvestment returns\b/gi, 'investment')
    .replace(
      /\b(?:the )?(?:very )?(?:best|better|safest|cheapest|lowest fees?|lowest price|top(?:[- ]rated)?|most trustworthy|trustworthiest|most trusted|least risky|recommended|good|trustworthy)\b/gi,
      '',
    )
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .trim();
}

export function judgmentNoteFor(hubId: SpecialistHubId): string {
  switch (hubId) {
    case 'move':
      return 'TrustHub does not designate a single mover as “best.”';
    case 'investor':
      return 'Comparable client-return data is not available. RAUM is not performance, and TrustHub does not rank advisers.';
    case 'senior':
      return 'TrustHub does not designate a single senior-care provider as “best” or “good.” CMS ratings are not TrustHub recommendations.';
    case 'insurance':
      return 'TrustHub does not rank agencies, agents, or insurers.';
    case 'lender':
      return 'TrustHub does not rank lenders. “Most” is a raw volume count, not a recommendation.';
    case 'contractor':
      return 'TrustHub does not recommend whom to hire. A credential is not a ranking.';
  }
}

export function specialistAskUrl(hubId: SpecialistHubId, query: string, parsed?: ParsedNetworkAsk): string {
  switch (hubId) {
    case 'move':
      return moveAskUrl(query);
    case 'investor':
      return investorAskUrl(query);
    case 'insurance':
      return insuranceAskUrl(query);
    case 'lender':
      return lenderAskUrl(query);
    case 'senior':
      return seniorAskUrl(query);
    case 'contractor':
      return parsed ? contractorAskUrlFromParsed(parsed, query) : `https://www.contractortrusthub.com/ask?q=${encodeURIComponent(query)}`;
  }
}

export function supportedSearchQuery(hubId: SpecialistHubId, parsed: ParsedNetworkAsk): string {
  const stripped = stripJudgmentModifiers(parsed.query);
  const place = parsed.geography?.stateName;
  switch (hubId) {
    case 'move': {
      if (place) return `Show household-goods carriers headquartered in ${place}.`;
      if (/\bmovers?|moving|household-?goods|carrier/i.test(stripped)) return stripped;
      return 'Show household-goods carriers.';
    }
    case 'investor':
      return 'Show SEC-registered RIAs.';
    case 'senior': {
      const cls = parsed.seniorProviderClass;
      const label =
        cls === 'home_health' ? 'home health agencies' : cls === 'hospice' ? 'hospice providers' : 'nursing homes';
      if (place) return `Show ${label} in ${place}.`;
      return `Show ${label}.`;
    }
    case 'insurance': {
      const cls = parsed.insuranceEntityClass;
      if (cls === 'insurer') return place ? `Show legal insurers credentialed in ${place}.` : 'Show legal insurers.';
      if (cls === 'person') return place ? `How many individual producers are credentialed in ${place}?` : 'Show insurance producers.';
      return place ? `Show insurance agencies credentialed in ${place}.` : 'Show insurance agencies.';
    }
    case 'lender': {
      if (/\bfha\b/i.test(parsed.query) && place) {
        return `Which lenders originated the most FHA mortgages in ${place}?`;
      }
      if (place) return `Which lenders originated the most mortgages in ${place}?`;
      return stripped || parsed.query;
    }
    case 'contractor': {
      if (parsed.trade?.toLowerCase() === 'roofing' && parsed.geography?.countyName) {
        return `Show active roofing contractors in ${parsed.geography.countyName}.`;
      }
      return stripped || parsed.query;
    }
  }
}

export function seniorFollowUp(parsed: ParsedNetworkAsk): ConsumerFollowUp | undefined {
  if (parsed.suggestedHubs[0] !== 'senior') return undefined;
  if (parsed.seniorProviderClass) return undefined;
  const place = parsed.geography?.stateName ?? parsed.geography?.city ?? 'this area';
  const loc = parsed.geography?.stateName ?? '';
  const q = (kind: string) => `/ask?q=${encodeURIComponent(`Show ${kind} in ${loc || place}.`)}`;
  return {
    prompt: `SeniorTrustHub researches Nursing Home, Home Health, and Hospice records — not a combined “best place.” Which type should we look up in ${place}?`,
    choices: [
      { label: 'Nursing homes', href: q('nursing homes') },
      { label: 'Home health', href: q('home health agencies') },
      { label: 'Hospice', href: q('hospice providers') },
    ],
  };
}

export function optionsFromMovePayload(payload: MoveAskPayload, limit = 10): ConsumerOption[] {
  return (payload.results ?? []).slice(0, limit).map((row) => {
    const fields: ConsumerOption['fields'] = [];
    if (row.role) fields.push({ label: 'Role', value: row.role });
    if (row.usdot) fields.push({ label: 'USDOT', value: String(row.usdot) });
    if (row.mc) fields.push({ label: 'MC', value: String(row.mc) });
    const extra = row as { headquarters?: string; fmcsaStatus?: string; href?: string };
    if (extra.headquarters) fields.push({ label: 'Recorded HQ', value: extra.headquarters });
    if (extra.fmcsaStatus) fields.push({ label: 'Authority', value: extra.fmcsaStatus });
    const href = extra.href
      ? extra.href.startsWith('http')
        ? extra.href
        : `https://www.movetrusthub.com${extra.href}`
      : undefined;
    return {
      name: row.name ?? 'Unnamed mover',
      hubId: 'move',
      fields,
      href,
      whyMatched: row.whyMatched,
    };
  });
}

export function optionsFromInvestorPayload(
  payload: {
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
  },
  limit = 10,
): ConsumerOption[] {
  return (payload.results ?? []).slice(0, limit).map((row) => {
    const fields: ConsumerOption['fields'] = [];
    if (row.firmType) fields.push({ label: 'Firm type', value: row.firmType.toUpperCase() });
    if (row.crd) fields.push({ label: 'CRD', value: row.crd });
    if (row.principalOffice) fields.push({ label: 'Principal office', value: row.principalOffice });
    if (row.raum) fields.push({ label: 'RAUM (not performance)', value: row.raum });
    if (row.compensationMethods?.length) {
      fields.push({ label: 'Compensation methods', value: row.compensationMethods.join(', ') });
    }
    if (row.publicationNote) fields.push({ label: 'Publication', value: row.publicationNote });
    const href = row.href
      ? row.href.startsWith('http')
        ? row.href
        : `https://www.investortrusthub.com${row.href}`
      : undefined;
    return {
      name: row.firmName ?? 'Unnamed firm',
      hubId: 'investor',
      fields,
      href,
      whyMatched: row.whyMatched,
    };
  });
}

export function optionsFromInsurancePayload(
  payload: {
    results?: Array<{
      name?: string;
      npn?: string | null;
      entityClass?: string;
      href?: string | null;
      credentialJurisdiction?: string;
      publicationNote?: string;
      whyMatched?: string;
    }>;
  },
  limit = 10,
): ConsumerOption[] {
  return (payload.results ?? []).slice(0, limit).map((row) => {
    const fields: ConsumerOption['fields'] = [];
    if (row.entityClass) fields.push({ label: 'Class', value: row.entityClass });
    if (row.npn) fields.push({ label: 'NPN', value: String(row.npn) });
    if (row.credentialJurisdiction) fields.push({ label: 'Credential jurisdiction', value: row.credentialJurisdiction });
    if (row.publicationNote) fields.push({ label: 'Publication', value: row.publicationNote });
    const href = row.href
      ? row.href.startsWith('http')
        ? row.href
        : `https://www.insurancetrusthub.com${row.href}`
      : undefined;
    return {
      name: row.name ?? 'Unnamed insurance identity',
      hubId: 'insurance',
      fields,
      href,
      whyMatched: row.whyMatched,
    };
  });
}

export function optionsFromLenderPayload(payload: LenderAskPayload, limit = 10): ConsumerOption[] {
  return (payload.rows ?? []).slice(0, limit).map((row) => {
    const extra = row as typeof row & { href?: string; nmls?: string; originations?: number };
    const fields: ConsumerOption['fields'] = [];
    if (typeof row.metric === 'number') {
      fields.push({ label: row.metricLabel ?? 'HMDA count', value: row.metric.toLocaleString('en-US') });
    }
    if (row.lei) fields.push({ label: 'LEI', value: row.lei });
    if (extra.nmls) fields.push({ label: 'NMLS', value: extra.nmls });
    if (row.identityStatus) fields.push({ label: 'Identity status', value: row.identityStatus });
    const href = extra.href
      ? extra.href.startsWith('http')
        ? extra.href
        : `https://www.lendertrusthub.com${extra.href}`
      : undefined;
    return { name: row.displayName ?? 'Unnamed lender', hubId: 'lender', fields, href };
  });
}

export function optionsFromSeniorPayload(payload: SeniorAskPayload, limit = 10): ConsumerOption[] {
  const results = (payload as { results?: Array<Record<string, unknown>> }).results ?? [];
  return results.slice(0, limit).map((row) => {
    const fields: ConsumerOption['fields'] = [];
    const cls = row.providerClass ?? row.class;
    const ccn = row.ccn ?? row.cmsCcn;
    const loc = [row.city, row.state].filter(Boolean).join(', ');
    if (typeof cls === 'string') fields.push({ label: 'Class', value: cls });
    if (ccn) fields.push({ label: 'CMS CCN', value: String(ccn) });
    if (loc) fields.push({ label: 'Address / office', value: loc });
    const hrefRaw = typeof row.href === 'string' ? row.href : undefined;
    const href = hrefRaw
      ? hrefRaw.startsWith('http')
        ? hrefRaw
        : `https://www.seniortrusthub.com${hrefRaw}`
      : undefined;
    return {
      name: String(row.name ?? row.providerName ?? 'Unnamed provider'),
      hubId: 'senior',
      fields,
      href,
      whyMatched: typeof row.whyMatched === 'string' ? row.whyMatched : undefined,
    };
  });
}

export function compareHrefFor(hubId: SpecialistHubId): string | undefined {
  if (hubId === 'senior') return 'https://www.seniortrusthub.com/compare';
  return undefined;
}

export function seniorSearchHref(parsed: ParsedNetworkAsk): string {
  const params = new URLSearchParams();
  if (parsed.geography?.stateCode) params.set('state', parsed.geography.stateCode);
  if (parsed.geography?.city) params.set('city', parsed.geography.city);
  const qs = params.toString();
  return `https://www.seniortrusthub.com/search${qs ? `?${qs}` : ''}`;
}

export function failReasonForHub(hubId: SpecialistHubId, q: string): string | undefined {
  switch (hubId) {
    case 'move':
      return moveFailClosedReason(q);
    case 'investor':
      return investorFailClosedReason(q);
    case 'insurance':
      return insuranceFailClosedReason(q);
    case 'lender':
      return lenderFailClosedReason(q);
    case 'senior':
      return seniorFailClosedReason(q);
    case 'contractor':
      if (
        /\b(should i hire|who should i hire|best contractor|safest contractor|most trustworthy contractor|recommended contractor|hire this contractor)\b/i.test(
          q,
        )
      ) {
        return 'ContractorTrustHub does not recommend whom to hire. It researches licensing records. A credential is not a ranking.';
      }
      return undefined;
  }
}

export type ConsumerHubFields = {
  hubId: SpecialistHubId;
  capabilityStatus: string;
  mode?: string;
  destination?: string;
  whatItCanAnswer: string;
  preview?: { headline: string; grain: string; limitation: string; officialAsOf?: string; sourceFamily?: string };
  failKind?: FailKind;
  judgmentNote?: string;
  searchQuery?: string;
  followUp?: ConsumerFollowUp;
  options?: ConsumerOption[];
  matchWhy?: string;
  compareHref?: string;
};

export function applyConsumerPresentation<T extends ConsumerHubFields>(hub: T, parsed: ParsedNetworkAsk): T {
  if (hub.capabilityStatus !== 'execute') return hub;
  if (parsed.intent === 'identifier') return hub;
  if (parsed.suggestedHubs.length !== 1) return hub;

  const compareHref = compareHrefFor(hub.hubId);
  const followUp = hub.hubId === 'senior' ? seniorFollowUp(parsed) : undefined;

  if (isHardPricingQuery(parsed.query)) {
    return {
      ...hub,
      mode: 'fail_closed',
      failKind: 'hard',
      followUp,
      compareHref,
    };
  }

  const judgment = isJudgmentModifierQuery(parsed.query);
  const searchQuery = judgment ? supportedSearchQuery(hub.hubId, parsed) : parsed.query;
  const remainingHard = failReasonForHub(hub.hubId, searchQuery);

  if (judgment && !remainingHard) {
    const note = judgmentNoteFor(hub.hubId);
    return {
      ...hub,
      mode: hub.mode === 'fail_closed' ? 'entity' : hub.mode,
      failKind: 'soft',
      judgmentNote: note,
      searchQuery,
      destination: specialistAskUrl(hub.hubId, searchQuery, parsed),
      followUp,
      compareHref,
      matchWhy: 'These identities match the supported specialist filters after dropping unsupported ranking language.',
      preview: hub.preview
        ? {
            ...hub.preview,
            headline: hub.preview.grain === 'fail_closed' ? 'Matching research identities' : hub.preview.headline,
            grain: hub.preview.grain === 'fail_closed' ? 'entity' : hub.preview.grain,
            limitation: note,
          }
        : hub.preview,
    };
  }

  if (hub.mode === 'fail_closed') {
    return { ...hub, failKind: 'hard', searchQuery: parsed.query, followUp, compareHref };
  }

  return { ...hub, searchQuery: parsed.query, followUp, compareHref };
}

export function parseContractorAskHtml(html: string, limit = 10): ConsumerOption[] {
  const articles = html.match(/<article class="cth-intel-card[\s\S]*?<\/article>/gi) ?? [];
  const options: ConsumerOption[] = [];
  for (const article of articles) {
    if (options.length >= limit) break;
    const name = article.match(/<h3[^>]*>([^<]+)<\/h3>/i)?.[1]?.trim();
    if (!name) continue;
    const license = article.match(/font-medium[^>]*">([^<]+)</i)?.[1]?.trim();
    const licenseType = article.match(/font-medium[^>]*>[^<]+<\/span>\s*([^<]+)/i)?.[1]?.replace(/^[-–—]\s*/, '').trim();
    const hrefPath = article.match(/href="(\/contractors\/[^"]+)"/i)?.[1];
    const why = article.match(/Why this matched<\/summary><p[^>]*>([^<]+)/i)?.[1]?.trim();
    const fields: ConsumerOption['fields'] = [];
    if (license) fields.push({ label: 'Credential', value: license });
    if (licenseType) fields.push({ label: 'Credential type', value: licenseType });
    const facts = [...article.matchAll(/<li class="rounded-full[^"]*"[^>]*>([\s\S]*?)<\/li>/gi)].map((m) =>
      m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
    );
    for (const fact of facts.slice(0, 3)) {
      if (fact) fields.push({ label: 'Fact', value: fact });
    }
    options.push({
      name,
      hubId: 'contractor',
      fields,
      href: hrefPath ? `https://www.contractortrusthub.com${hrefPath}` : undefined,
      whyMatched: why,
    });
  }
  return options;
}

export async function fetchContractorAskOptions(
  parsed: ParsedNetworkAsk,
  query: string,
  timeoutMs = 8000,
): Promise<ConsumerOption[] | null> {
  if (process.env.NODE_TEST_CONTEXT) return null;
  if (process.env.CONTRACTOR_ASK_FETCH === '0') return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(contractorAskUrlFromParsed(parsed, query), {
      signal: controller.signal,
      headers: { accept: 'text/html' },
      next: { revalidate: 60 },
    } as RequestInit);
    if (!res.ok) return null;
    const html = await res.text();
    const options = parseContractorAskHtml(html, 10);
    return options.length ? options : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
