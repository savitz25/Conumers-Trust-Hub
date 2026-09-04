import manifestJson from '../../data/network/arizona-publication-manifest.json' with { type: 'json' };
import type { SpecialistHubId } from './registry.ts';
import { CANONICAL_ORIGINS, NETWORK_PUBLIC_NAMES, SPECIALIST_HUB_IDS } from './registry.ts';

export const AZ_NETWORK_CONTRACT = 'ath-az-network-release-v1' as const;

export type AzHubManifest = (typeof manifestJson)['hubs'][number];

export const AZ_PUBLICATION_MANIFEST = manifestJson;

export function listAzHubs(): AzHubManifest[] {
  return AZ_PUBLICATION_MANIFEST.hubs;
}

export function azHubById(id: SpecialistHubId): AzHubManifest | undefined {
  return AZ_PUBLICATION_MANIFEST.hubs.find((h) => h.hub_id === id);
}

export function azSpecialistUrl(id: SpecialistHubId): string {
  return azHubById(id)?.canonical_state_url ?? `${CANONICAL_ORIGINS[id]}/arizona`;
}

export function azSixHubIdsComplete(): boolean {
  const ids = AZ_PUBLICATION_MANIFEST.hubs.map((h) => h.hub_id);
  return SPECIALIST_HUB_IDS.every((id) => ids.includes(id)) && new Set(ids).size === 6;
}

export function azReleaseGatePassed(): boolean {
  return AZ_PUBLICATION_MANIFEST.release_gate.passed === true;
}

const AZ_CITY_RE =
  /\b(phoenix|tucson|mesa|scottsdale|chandler|glendale|gilbert|tempe|peoria|surprise|yuma|flagstaff|goodyear|avondale|buckeye)\b/i;
const AZ_COUNTY_RE =
  /\b(maricopa|pima|pinal|yavapai|mohave|coconino|cochise|yuma|navajo|apache|gila|santa\s+cruz|graham|greenlee|la\s+paz)\s+county\b/i;
const AZ_REGULATOR_RE = /\b(roc|adhs|difi|azcc|azcarecheck)\b/i;

export function detectAzCity(query: string): string | undefined {
  const m = query.match(AZ_CITY_RE);
  if (!m) return undefined;
  return m[1].replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function queryLooksLikeArizona(query: string): boolean {
  if (/\barizona\b/i.test(query)) return true;
  if (AZ_REGULATOR_RE.test(query) && /\b(contractor|license|insur|mortgage|advis|assisted|nursing|mover)\b/i.test(query)) {
    return true;
  }
  if (AZ_CITY_RE.test(query) || AZ_COUNTY_RE.test(query)) return true;
  if (/\bin\s+AZ\b/.test(query) || /\bAZ\s+(contractor|mover|lender|insur|senior|advis|broker)/i.test(query)) {
    return true;
  }
  return false;
}

export const AZ_SEMANTIC_GUARDRAILS = {
  missing_ne_zero: 'Unavailable official evidence is unknown, not zero.',
  search_only_ne_zero: 'Search-only official evidence is unknown, not zero.',
  requestable_ne_acquired: 'A requestable list is not an acquired roster.',
  paid_ne_unavailable: 'A paid source is not proof the universe is empty.',
  no_trust_score: 'AskTrustHub does not publish a Trust Score.',
  no_ranking: 'AskTrustHub does not publish paid rankings or best/safest/worst conclusions.',
  no_county_routes:
    'Arizona is state-level only. AskTrustHub does not publish Arizona city or county gateways in this release.',
  contractor_license_ne_company:
    'ROC current posting 57,886 is not 57,886 unique companies. Commercial, Residential, and Dual files overlap. A license is not quality. Missing discipline is not a clean record. Qualifying party is not the business.',
  senior_class_ne_sum:
    'Assisted Living Home is not Assisted Living Center. Neither is a CMS nursing home. HHA is not hospice. Do not publish one Arizona senior-providers denominator. ADHS is not CMS.',
  lender_hmda_ne_roster:
    '308,338 HMDA applications are not Arizona-licensed mortgage companies. NMLS search-only is unknown, not zero. A complaint is not a violation. Denial rate is not quality.',
  investor_office_ne_state:
    '213 SEC/IARD Arizona principal-office firms are not Arizona state-licensed advisers. ERA is not an RIA. IAR is not a firm. Broker-dealer is not an investment adviser. CRD is not current Arizona authority.',
  insurance_no_fake_count:
    'Arizona insurance business-entity bulk is paid through SBS ($0.03/row, $30 minimum) and was not purchased. Complete agency count is UNKNOWN. Producer is not an agency. Agency is not an insurer.',
  move_no_hhg_license:
    'Arizona does not have a household-goods mover licensing or registration requirement. There is no state mover roster. ACC business registration is not a mover license. ROC R-22 is not household goods. A USDOT number is not interstate operating authority by itself.',
} as const;

export function azCaveatForHub(id: SpecialistHubId): string {
  switch (id) {
    case 'contractor':
      return AZ_SEMANTIC_GUARDRAILS.contractor_license_ne_company;
    case 'senior':
      return AZ_SEMANTIC_GUARDRAILS.senior_class_ne_sum;
    case 'lender':
      return AZ_SEMANTIC_GUARDRAILS.lender_hmda_ne_roster;
    case 'investor':
      return AZ_SEMANTIC_GUARDRAILS.investor_office_ne_state;
    case 'insurance':
      return AZ_SEMANTIC_GUARDRAILS.insurance_no_fake_count;
    case 'move':
      return AZ_SEMANTIC_GUARDRAILS.move_no_hhg_license;
    default:
      return AZ_SEMANTIC_GUARDRAILS.missing_ne_zero;
  }
}

export type AzRoute = {
  hubId: SpecialistHubId;
  stateCode: 'AZ';
  intentFamily: string;
  destination: string;
  caveat: string;
};

function earlierStateNamed(query: string, other: RegExp): boolean {
  const az = query.search(/\barizona\b/i);
  const otherAt = query.search(other);
  if (otherAt < 0) return false;
  if (az < 0) return true;
  return otherAt < az;
}

export function classifyAzHub(query: string): SpecialistHubId | undefined {
  const q = query.toLowerCase();
  if (/\b(mover|movers|moving|household[- ]goods|usdot|fmcsa|move from|move to)\b/.test(q)) return 'move';
  if (/\b(mortgage|hmda|nmls|homebuyer|denial rate|mlo)\b/.test(q)) return 'lender';
  if (/\b(mortgage broker|lender)\b/.test(q) && !/\badvis|securit|iard|ria|insur\b/.test(q)) return 'lender';
  if (
    /\b(assisted[- ]living|adult foster|adult day|nursing homes?|nursing facility|adhs|hospice|home health|azcarecheck)\b/.test(
      q,
    ) ||
    (/\bsenior[- ]?(care|resources?|housing)\b/.test(q) && /\barizona|\baz\b/i.test(query))
  ) {
    return 'senior';
  }
  if (/\b(contractor|registrar of contractors|\broc\b|contractor license)\b/.test(q)) return 'contractor';
  if (/\b(insurance|insurer|sbs|naic|producer|agency roster|difi)\b/.test(q) && !/\bmortgage|nmls|hmda\b/.test(q)) {
    return 'insurance';
  }
  if (
    /investment advis(?:er|or)s?|state[- ]registered advis(?:er|or)s?|\badvis(?:er|or)s?\b|form adv|\biard\b|\bcrd\b|\brias?\b|\bera\b|\biar\b/.test(
      q,
    ) ||
    (/\bprincipal office\b/.test(q) && /\b(advis|sec|iard|arizona)\b/.test(q))
  ) {
    return 'investor';
  }
  if (/\bdifi\b/.test(q) && /\b(mortgage|broker|lender|nmls)\b/.test(q)) return 'lender';
  return undefined;
}

export function routeAzAsk(query: string): AzRoute | undefined {
  if (earlierStateNamed(query, /\bcalifornia\b|\bcalif\b/i)) return undefined;
  if (earlierStateNamed(query, /\btexas\b|\btexan\b/i)) return undefined;
  if (earlierStateNamed(query, /\bnew\s+jersey\b/i)) return undefined;
  if (earlierStateNamed(query, /\bflorida\b/i)) return undefined;
  if (earlierStateNamed(query, /\bwashington\b/i)) return undefined;
  if (!queryLooksLikeArizona(query)) return undefined;
  const hubId = classifyAzHub(query);
  if (!hubId) return undefined;
  return {
    hubId,
    stateCode: 'AZ',
    intentFamily: hubId,
    destination: azSpecialistUrl(hubId),
    caveat: azCaveatForHub(hubId),
  };
}

export type AzHttpProbe = {
  hub_id: SpecialistHubId;
  url: string;
  http_status: number | null;
  ok: boolean;
};

export function azRequiredLiveReleaseComplete(probes: AzHttpProbe[]): {
  passed: boolean;
  missing: SpecialistHubId[];
} {
  const required = AZ_PUBLICATION_MANIFEST.release_gate.required_live_specialist_arizona_pages as SpecialistHubId[];
  const byId = new Map(probes.map((p) => [p.hub_id, p]));
  const missing: SpecialistHubId[] = [];
  for (const id of required) {
    const row = byId.get(id);
    if (!row || !row.ok || row.http_status !== 200) missing.push(id);
  }
  return { passed: missing.length === 0, missing };
}

export function azConciergeContext(): string {
  const cards = listAzHubs()
    .map((h) => `- ${NETWORK_PUBLIC_NAMES[h.hub_id as SpecialistHubId]} (${h.canonical_state_url}): ${h.coverage_summary}`)
    .join('\n');
  return `## Arizona network context
AskTrustHub /arizona is the network gateway. Four specialist /arizona pages are live (Contractor, Senior, Lender, Investor). Insurance is a STATE RESEARCH PATH (no dedicated Arizona specialist page; DIFI/SBS lookup; no fake agency count). Move is NO STATE LICENSING UNIVERSE (Arizona does not license household-goods movers). Do not invent Phoenix, Maricopa, Tucson, Pima, or any other Arizona city or county routes.
${cards}
`;
}
