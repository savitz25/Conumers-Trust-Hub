import manifestJson from '../../data/network/washington-publication-manifest.json' with { type: 'json' };
import type { SpecialistHubId } from './registry.ts';
import { CANONICAL_ORIGINS, NETWORK_PUBLIC_NAMES, SPECIALIST_HUB_IDS } from './registry.ts';

export const WA_NETWORK_CONTRACT = 'ath-wa-network-release-v1' as const;

export type WaHubManifest = (typeof manifestJson)['hubs'][number];

export const WA_PUBLICATION_MANIFEST = manifestJson;

export function listWaHubs(): WaHubManifest[] {
  return WA_PUBLICATION_MANIFEST.hubs;
}

export function waHubById(id: SpecialistHubId): WaHubManifest | undefined {
  return WA_PUBLICATION_MANIFEST.hubs.find((h) => h.hub_id === id);
}

export function waSpecialistUrl(id: SpecialistHubId): string {
  return waHubById(id)?.canonical_state_url ?? `${CANONICAL_ORIGINS[id]}/washington`;
}

export function waSixHubIdsComplete(): boolean {
  const ids = WA_PUBLICATION_MANIFEST.hubs.map((h) => h.hub_id);
  return SPECIALIST_HUB_IDS.every((id) => ids.includes(id)) && new Set(ids).size === 6;
}

export function waReleaseGatePassed(): boolean {
  return WA_PUBLICATION_MANIFEST.release_gate.passed === true;
}

const WA_CITY_RE =
  /\b(seattle|tacoma|spokane|bellevue|vancouver|kent|everett|renton|kirkland|redmond|olympia|yakima)\b/i;
const WA_COUNTY_RE =
  /\b(king|pierce|snohomish|spokane|clark|thurston|kitsap|whatcom|yakima|benton)\s+county\b/i;
const WA_DC_RE = /\bwashington\s*,?\s*d\.?c\.?\b|\bwashington\s+dc\b/i;

export function detectWaCity(query: string): string | undefined {
  const m = query.match(WA_CITY_RE);
  if (!m) return undefined;
  return m[1].replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function queryLooksLikeWashington(query: string): boolean {
  if (WA_DC_RE.test(query)) return false;
  if (/\bwashington\b/i.test(query)) return true;
  if (/\bl&i\b|\blni\b|\bdshs\b|\bwaoic\b|\bwshfc\b/i.test(query)) return true;
  if (/\badult family homes?\b|\bafh\b/i.test(query)) return true;
  if (WA_CITY_RE.test(query) || WA_COUNTY_RE.test(query)) return true;
  if (/\bin\s+WA\b/.test(query) || /\bWA\s+(contractor|mover|lender|insur|senior|advis|broker)/i.test(query)) {
    return true;
  }
  return false;
}

export const WA_SEMANTIC_GUARDRAILS = {
  missing_ne_zero: 'Unavailable official evidence is unknown, not zero.',
  restricted_ne_zero: 'Restricted official evidence is unknown, not zero.',
  search_only_ne_zero: 'Search-only official evidence is unknown, not zero.',
  no_trust_score: 'AskTrustHub does not publish a Trust Score.',
  no_ranking: 'AskTrustHub does not publish paid rankings or best/safest/worst conclusions.',
  no_county_routes:
    'Washington is state-level only. AskTrustHub does not publish Washington city or county gateways in this release.',
  contractor_registration_ne_quality:
    'Registration is not quality. Bond is not endorsement. Insurance is not safety. A missing bond row is not unbonded. A missing insurance row is not uninsured. UBI is not contractor registration. 160,923 rows are not 160,923 net-new companies.',
  senior_afh_ne_alf:
    'AFH is not ALF. ALF is not a skilled nursing facility. DSHS is not CMS. Residential care is not home health. Hospice is not home health. Do not publish a combined Washington senior-providers denominator.',
  move_utc_ne_fmcsa:
    'UTC state permit is not FMCSA interstate authority. A USDOT number is not interstate operating authority by itself. 284 directory results are not a newly ingested mover-company count. Do not combine 284 + 148. Net-new mover organizations: 0.',
  lender_hmda_ne_roster:
    'HMDA is not a Washington mortgage-license roster. DFI year-end aggregate is not a live roster. An MLO person is not a lender company. A complaint is not a violation. Denial rate is not quality.',
  investor_office_ne_state_ria:
    '306 SEC/IARD Washington principal-office firms are not the Washington state-RIA count. 645 is not a live roster. SEC RIA is not state RIA. ERA is not an RIA. IAR is not a firm. Broker-dealer is not an investment adviser.',
  insurance_2924_ne_live:
    '2,924 is not a live Washington insurer count. Producer is not an agency. Agency is not an insurer. Plan is not an insurer. Annual aggregate is not a live roster. Verify on OIC lookup. Restricted is not zero.',
} as const;

export function waCaveatForHub(id: SpecialistHubId): string {
  switch (id) {
    case 'contractor':
      return WA_SEMANTIC_GUARDRAILS.contractor_registration_ne_quality;
    case 'senior':
      return WA_SEMANTIC_GUARDRAILS.senior_afh_ne_alf;
    case 'move':
      return WA_SEMANTIC_GUARDRAILS.move_utc_ne_fmcsa;
    case 'lender':
      return WA_SEMANTIC_GUARDRAILS.lender_hmda_ne_roster;
    case 'investor':
      return WA_SEMANTIC_GUARDRAILS.investor_office_ne_state_ria;
    case 'insurance':
      return WA_SEMANTIC_GUARDRAILS.insurance_2924_ne_live;
    default:
      return WA_SEMANTIC_GUARDRAILS.missing_ne_zero;
  }
}

export type WaRoute = {
  hubId: SpecialistHubId;
  stateCode: 'WA';
  intentFamily: string;
  destination: string;
  caveat: string;
};

function earlierStateNamed(query: string, other: RegExp): boolean {
  const wa = query.search(/\bwashington\b/i);
  const otherAt = query.search(other);
  if (otherAt < 0) return false;
  if (wa < 0) return true;
  return otherAt < wa;
}

export function classifyWaHub(query: string): SpecialistHubId | undefined {
  const q = query.toLowerCase();
  if (/\b(mover|movers|moving|household[- ]goods|usdot|fmcsa|move from|move to)\b/.test(q)) return 'move';
  if (/\b(mortgage|hmda|nmls|homebuyer|wshfc|denial rate|mlo)\b/.test(q)) return 'lender';
  if (/\b(mortgage broker|lender)\b/.test(q) && !/\badvis|securit|iard|ria\b/.test(q)) return 'lender';
  if (
    /\b(adult family home|afh|assisted[- ]living|nursing homes?|nursing facility|dshs|hospice|home health|enhanced services)\b/.test(
      q,
    ) ||
    (/\bsenior[- ]?(care|resources?|housing)\b/.test(q) && /\bwashington|\bwa\b/i.test(query))
  ) {
    return 'senior';
  }
  if (/\b(contractor|l&i|\blni\b|contractor license|contractor registration|ubi)\b/.test(q)) return 'contractor';
  if (
    /\b(insurance|insurer|oic|serff|naic|producer|agency roster|authorized-company|rate filing)\b/.test(q)
  ) {
    return 'insurance';
  }
  if (
    /investment advis(?:er|or)s?|state[- ]registered advis(?:er|or)s?|\badvis(?:er|or)s?\b|form adv|\biard\b|\bcrd\b|\brias?\b|\bera\b|\biar\b/.test(
      q,
    ) ||
    (/\bprincipal office\b/.test(q) && /\b(advis|sec|iard|washington)\b/.test(q)) ||
    (/\bdfi\b/.test(q) && /\b(advis|securit|iard|ria)\b/.test(q))
  ) {
    return 'investor';
  }
  if (/\bdfi\b/.test(q) && /\b(mortgage|broker|lender|nmls)\b/.test(q)) return 'lender';
  return undefined;
}

export function routeWaAsk(query: string): WaRoute | undefined {
  if (earlierStateNamed(query, /\bcalifornia\b|\bcalif\b/i)) return undefined;
  if (earlierStateNamed(query, /\btexas\b|\btexan\b/i)) return undefined;
  if (earlierStateNamed(query, /\bnew\s+jersey\b/i)) return undefined;
  if (earlierStateNamed(query, /\bflorida\b/i)) return undefined;
  if (!queryLooksLikeWashington(query)) return undefined;
  const hubId = classifyWaHub(query);
  if (!hubId) return undefined;
  return {
    hubId,
    stateCode: 'WA',
    intentFamily: hubId,
    destination: waSpecialistUrl(hubId),
    caveat: waCaveatForHub(hubId),
  };
}

export type WaHttpProbe = {
  hub_id: SpecialistHubId;
  url: string;
  http_status: number | null;
  ok: boolean;
};

export function waSixHubReleaseComplete(probes: WaHttpProbe[]): {
  passed: boolean;
  missing: SpecialistHubId[];
} {
  const byId = new Map(probes.map((p) => [p.hub_id, p]));
  const missing: SpecialistHubId[] = [];
  for (const id of SPECIALIST_HUB_IDS) {
    const row = byId.get(id);
    if (!row || !row.ok || row.http_status !== 200) missing.push(id);
  }
  return { passed: missing.length === 0, missing };
}

export function waConciergeContext(): string {
  const live = listWaHubs().filter((h) => h.publication_status === 'live');
  const cards = listWaHubs()
    .map((h) => `- ${NETWORK_PUBLIC_NAMES[h.hub_id as SpecialistHubId]} (${h.canonical_state_url}): ${h.coverage_summary}`)
    .join('\n');
  const gate = waReleaseGatePassed();
  return `## Washington network context
AskTrustHub /washington is the network gateway. Specialist /washington pages own detailed evidence.
Washington is STATE LEVEL ONLY. Do not invent Washington city or county Ask pages or specialist county routes. Seattle, King, Tacoma, Pierce, Spokane, Snohomish, and Bellevue stay on specialist /washington.
Hub intent remains primary. Do not route every Washington question to Contractor.
Live WA specialist pages: ${live.map((h) => h.hub_id).join(', ') || 'none'}.
Six-hub release gate passed: ${gate ? 'yes' : 'no'}. Blocker: ${WA_PUBLICATION_MANIFEST.release_gate.blocker ?? 'none'}.
Do not invent Washington license, roster, or count facts. Route to the specialist page.
Do not copy Texas, California, or New Jersey metrics into Washington.
Do not treat 160,923 contractor rows, 284 UTC results, 306 SEC/IARD firms, 2,924 OIC annual entities, or 286,871 HMDA applications as net-new organizations.
Do not answer “how many insurance companies are licensed in Washington?” as 2,924 live licensed companies.
${cards}
Guardrails:
- ${WA_SEMANTIC_GUARDRAILS.contractor_registration_ne_quality}
- ${WA_SEMANTIC_GUARDRAILS.senior_afh_ne_alf}
- ${WA_SEMANTIC_GUARDRAILS.move_utc_ne_fmcsa}
- ${WA_SEMANTIC_GUARDRAILS.lender_hmda_ne_roster}
- ${WA_SEMANTIC_GUARDRAILS.investor_office_ne_state_ria}
- ${WA_SEMANTIC_GUARDRAILS.insurance_2924_ne_live}
- Missing, restricted, and search-only evidence is unknown, not zero. No Trust Score. No paid ranking. No Washington county routes.`;
}
