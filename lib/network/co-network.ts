import manifestJson from '../../data/network/colorado-publication-manifest.json' with { type: 'json' };
import type { SpecialistHubId } from './registry.ts';
import { CANONICAL_ORIGINS, NETWORK_PUBLIC_NAMES, SPECIALIST_HUB_IDS } from './registry.ts';

export const CO_NETWORK_CONTRACT = 'ath-co-network-release-v1' as const;

export type CoHubManifest = (typeof manifestJson)['hubs'][number];

export const CO_PUBLICATION_MANIFEST = manifestJson;

export function listCoHubs(): CoHubManifest[] {
  return CO_PUBLICATION_MANIFEST.hubs;
}

export function coHubById(id: SpecialistHubId): CoHubManifest | undefined {
  return CO_PUBLICATION_MANIFEST.hubs.find((h) => h.hub_id === id);
}

export function coSpecialistUrl(id: SpecialistHubId): string {
  return coHubById(id)?.canonical_state_url ?? `${CANONICAL_ORIGINS[id]}/colorado`;
}

export function coSixHubIdsComplete(): boolean {
  const ids = CO_PUBLICATION_MANIFEST.hubs.map((h) => h.hub_id);
  return SPECIALIST_HUB_IDS.every((id) => ids.includes(id)) && new Set(ids).size === 6;
}

export function coReleaseGatePassed(): boolean {
  return CO_PUBLICATION_MANIFEST.release_gate.passed === true;
}

const CO_CITY_RE =
  /\b(denver|colorado springs|boulder|fort collins|lakewood|pueblo|grand junction)\b/i;
const CO_COUNTY_RE =
  /\b(jefferson|arapahoe|el paso|douglas|adams|boulder|denver|larimer|weld)\s+county\b/i;

export function detectCoCity(query: string): string | undefined {
  const m = query.match(CO_CITY_RE);
  if (!m) return undefined;
  return m[1].replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function queryLooksLikeColorado(query: string): boolean {
  if (/\bcolorado\b|\bcolo\.?\b/i.test(query)) return true;
  if (/\bdenver\b|\bcolorado springs\b/i.test(query)) return true;
  if (/\bdora\b/i.test(query) && /\b(contractor|license|electrician|plumber|electrical|plumbing)\b/i.test(query)) {
    return true;
  }
  if (/\bpuc\b/i.test(query) && /\b(mover|moving|household|hhg|permit)\b/i.test(query)) return true;
  if (CO_CITY_RE.test(query) || CO_COUNTY_RE.test(query)) return true;
  if (/\bin\s+CO\b/.test(query) || /\bCO\s+(contractor|mover|lender|insur|senior|advis|broker)/i.test(query)) {
    return true;
  }
  return false;
}

export const CO_SEMANTIC_GUARDRAILS = {
  missing_ne_zero: 'Unavailable official evidence is unknown, not zero.',
  search_only_ne_zero: 'Search-only official evidence is unknown, not zero.',
  no_trust_score: 'AskTrustHub does not publish a Trust Score.',
  no_ranking: 'AskTrustHub does not publish paid rankings or best/safest/worst conclusions.',
  no_county_routes:
    'Colorado is state-level only. AskTrustHub does not publish Colorado city or county gateways in this release.',
  contractor_ec_pc_ne_gc:
    '7,936 is active electrical/plumbing contractor credentials, not unique contractors and not general contractors. Colorado has no statewide general-contractor license. Person electrician/plumber credentials are not the business denominator. 1,606,852 professional-license rows are not contractor businesses.',
  move_puc_ne_fmcsa:
    '203 active Colorado PUC household-goods permits are a state permit grain. A Colorado HHG permit is not USDOT, not MC authority, and not federal interstate authority.',
  senior_classes_separate:
    '210 nursing homes, 222 home health agencies, and 88 hospice providers are separate CMS classes. Do not add them into one Colorado senior-providers denominator. A CMS CCN is not a state facility license.',
  lender_mlo_ne_company:
    'An MLO person license is not a lender company. HMDA applications are not a license roster and not a lender count. The current Colorado mortgage-company bulk roster remains search-only — unknown, not zero. A complaint is not a violation.',
  investor_740_ne_office_ne_notice:
    '740 APPROVED Colorado state-registered IA firms are the relevant state-RIA measure. They are not 589 principal-office firms, not 209 state ERA firms, and not 3,673 notice filings. Grain distinction does not rely on numeric inequality. Six CRDs may appear in both approved state IA and notice-filed sets.',
  insurance_1839_ne_authorized:
    '1,839 NAIC company rows in Colorado DOI’s 2025 market directory are dated market evidence as of 2025-12-31, not currently authorized insurers. 259 surplus identities are eligible non-admitted, not admitted. DOI Complaint Ratio/Index is not a TrustHub score. Producer, agency, and current authorized-company bulk remain search-only — unknown, not zero.',
} as const;

export function coCaveatForHub(id: SpecialistHubId): string {
  switch (id) {
    case 'contractor':
      return CO_SEMANTIC_GUARDRAILS.contractor_ec_pc_ne_gc;
    case 'senior':
      return CO_SEMANTIC_GUARDRAILS.senior_classes_separate;
    case 'move':
      return CO_SEMANTIC_GUARDRAILS.move_puc_ne_fmcsa;
    case 'lender':
      return CO_SEMANTIC_GUARDRAILS.lender_mlo_ne_company;
    case 'investor':
      return CO_SEMANTIC_GUARDRAILS.investor_740_ne_office_ne_notice;
    case 'insurance':
      return CO_SEMANTIC_GUARDRAILS.insurance_1839_ne_authorized;
    default:
      return CO_SEMANTIC_GUARDRAILS.missing_ne_zero;
  }
}

export type CoRoute = {
  hubId: SpecialistHubId;
  stateCode: 'CO';
  intentFamily: string;
  destination: string;
  caveat: string;
};

function earlierStateNamed(query: string, other: RegExp): boolean {
  const co = query.search(/\bcolorado\b/i);
  const otherAt = query.search(other);
  if (otherAt < 0) return false;
  if (co < 0) return true;
  return otherAt < co;
}

export function classifyCoHub(query: string): SpecialistHubId | undefined {
  const q = query.toLowerCase();
  if (/\b(mover|movers|moving|household[- ]goods|usdot|fmcsa|puc|hhg|move from|move to)\b/.test(q)) return 'move';
  if (/\b(mortgage|hmda|nmls|homebuyer|mlo|lender company|mortgage lender|mortgage broker)\b/.test(q) && !/\badvis|securit|iard|ria\b/.test(q)) {
    return 'lender';
  }
  if (
    /\b(nursing homes?|nursing facility|home health|hospice|assisted[- ]living|cdphe|senior[- ]?(care|resources?|housing))\b/.test(q)
  ) {
    return 'senior';
  }
  if (/\b(contractor|electrician|plumber|electrical contractor|plumbing contractor|general contractor|dora)\b/.test(q)) {
    return 'contractor';
  }
  if (
    /\b(insurance|insurer|authorized|naic|producer|agency roster|surplus[- ]lines|complaint index|complaint ratio|sircon)\b/.test(q)
  ) {
    return 'insurance';
  }
  if (
    /investment advis(?:er|or)s?|state[- ]registered advis(?:er|or)s?|\badvis(?:er|or)s?\b|form adv|\biard\b|\bcrd\b|\brias?\b|\bera\b|principal office/.test(
      q,
    )
  ) {
    return 'investor';
  }
  return undefined;
}

export function routeCoAsk(query: string): CoRoute | undefined {
  if (earlierStateNamed(query, /\bcalifornia\b|\bcalif\b/i)) return undefined;
  if (earlierStateNamed(query, /\btexas\b|\btexan\b/i)) return undefined;
  if (earlierStateNamed(query, /\bnew\s+jersey\b/i)) return undefined;
  if (earlierStateNamed(query, /\bflorida\b/i)) return undefined;
  if (earlierStateNamed(query, /\bwashington\b/i)) return undefined;
  if (earlierStateNamed(query, /\barizona\b/i)) return undefined;
  if (!queryLooksLikeColorado(query)) return undefined;
  const hubId = classifyCoHub(query);
  if (!hubId) return undefined;
  return {
    hubId,
    stateCode: 'CO',
    intentFamily: hubId,
    destination: coSpecialistUrl(hubId),
    caveat: coCaveatForHub(hubId),
  };
}

export function coConciergeContext(): string {
  const live = listCoHubs().filter((h) => h.publication_status === 'live');
  const cards = listCoHubs()
    .map((h) => `- ${NETWORK_PUBLIC_NAMES[h.hub_id as SpecialistHubId]} (${h.canonical_state_url}): ${h.coverage_summary}`)
    .join('\n');
  const gate = coReleaseGatePassed();
  return `## Colorado network context
AskTrustHub /colorado is the network gateway. Specialist /colorado pages own detailed evidence.
Colorado is STATE LEVEL ONLY. Do not invent Colorado city or county Ask pages. Denver, Colorado Springs, Aurora, Boulder, Jefferson County, Arapahoe County, El Paso County, and Douglas County stay on specialist /colorado.
Hub intent remains primary. Do not route every Colorado question to Contractor.
Live CO specialist pages: ${live.map((h) => h.hub_id).join(', ') || 'none'}.
Six-hub release gate passed: ${gate ? 'yes' : 'no'}. Blocker: ${CO_PUBLICATION_MANIFEST.release_gate.blocker ?? 'none'}.
Do not invent Colorado license, roster, or count facts. Route to the specialist page.
Do not copy Washington, Texas, California, or New Jersey metrics into Colorado.
Do not answer “is this contractor licensed in Colorado?” as if a statewide general-contractor roster exists.
Do not answer “how many investment advisers are registered in Colorado?” as 589 principal-office firms or 3,673 notice filings. The relevant state-RIA measure is 740 APPROVED firms.
Do not answer “which insurance companies are authorized in Colorado?” as 1,839 live authorized companies.
Do not add 210+222+88 into one senior-providers total.
Do not treat 260,212 HMDA applications as a lender count.
${cards}
Guardrails:
- ${CO_SEMANTIC_GUARDRAILS.contractor_ec_pc_ne_gc}
- ${CO_SEMANTIC_GUARDRAILS.senior_classes_separate}
- ${CO_SEMANTIC_GUARDRAILS.move_puc_ne_fmcsa}
- ${CO_SEMANTIC_GUARDRAILS.lender_mlo_ne_company}
- ${CO_SEMANTIC_GUARDRAILS.investor_740_ne_office_ne_notice}
- ${CO_SEMANTIC_GUARDRAILS.insurance_1839_ne_authorized}
- Missing, restricted, and search-only evidence is unknown, not zero. No Trust Score. No paid ranking. No Colorado county routes.`;
}
