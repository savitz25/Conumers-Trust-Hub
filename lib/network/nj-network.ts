import manifestJson from '../../data/network/new-jersey-publication-manifest.json' with { type: 'json' };
import type { SpecialistHubId } from './registry.ts';
import { CANONICAL_ORIGINS, NETWORK_PUBLIC_NAMES, SPECIALIST_HUB_IDS } from './registry.ts';

export const NJ_NETWORK_CONTRACT = 'ath-nj-network-v1' as const;

export type NjHubManifest = (typeof manifestJson)['hubs'][number];

export const NJ_PUBLICATION_MANIFEST = manifestJson;

export function listNjHubs(): NjHubManifest[] {
  return NJ_PUBLICATION_MANIFEST.hubs;
}

export function njHubById(id: SpecialistHubId): NjHubManifest | undefined {
  return NJ_PUBLICATION_MANIFEST.hubs.find((h) => h.hub_id === id);
}

export function njSpecialistUrl(id: SpecialistHubId): string {
  return njHubById(id)?.canonical_state_url ?? `${CANONICAL_ORIGINS[id]}/new-jersey`;
}

export function sixHubIdsComplete(): boolean {
  const ids = NJ_PUBLICATION_MANIFEST.hubs.map((h) => h.hub_id);
  return SPECIALIST_HUB_IDS.every((id) => ids.includes(id)) && new Set(ids).size === 6;
}

export function njReleaseGatePassed(): boolean {
  return NJ_PUBLICATION_MANIFEST.release_gate.passed === true;
}

export const NJ_COUNTIES: Record<string, string> = {
  atlantic: 'Atlantic County',
  bergen: 'Bergen County',
  burlington: 'Burlington County',
  camden: 'Camden County',
  'cape may': 'Cape May County',
  cumberland: 'Cumberland County',
  essex: 'Essex County',
  gloucester: 'Gloucester County',
  hudson: 'Hudson County',
  hunterdon: 'Hunterdon County',
  mercer: 'Mercer County',
  middlesex: 'Middlesex County',
  monmouth: 'Monmouth County',
  morris: 'Morris County',
  ocean: 'Ocean County',
  passaic: 'Passaic County',
  salem: 'Salem County',
  somerset: 'Somerset County',
  sussex: 'Sussex County',
  union: 'Union County',
  warren: 'Warren County',
};

const NJ_COUNTY_RE = new RegExp(
  `\\b(${Object.keys(NJ_COUNTIES).sort((a, b) => b.length - a.length).join('|')})\\b`,
  'i',
);

export function detectNjCounty(query: string): string | undefined {
  const m = query.match(NJ_COUNTY_RE);
  if (!m) return undefined;
  return NJ_COUNTIES[m[1].toLowerCase()];
}

export function queryLooksLikeNewJersey(query: string): boolean {
  if (/\bnew\s+jersey\b|\bn\.?j\.?\b|\bnewark\b/i.test(query)) return true;
  const county = detectNjCounty(query);
  if (!county) return false;
  const strong = /\b(bergen|hudson|middlesex|monmouth|camden|morris)\s+county\b/i.test(query);
  const otherState = /\b(florida|texas|new york|california|pennsylvania|massachusetts)\b/i.test(query);
  return strong && !otherState;
}

export const NJ_SEMANTIC_GUARDRAILS = {
  missing_ne_zero: 'Unavailable official evidence is unknown, not zero.',
  no_trust_score: 'AskTrustHub does not publish a Trust Score.',
  no_ranking: 'AskTrustHub does not publish paid rankings or best/safest/worst conclusions.',
  move_ne_fmcsa: 'New Jersey state mover authority is not FMCSA interstate authority. Active FMCSA status does not prove a New Jersey state license.',
  lender_hmda_ne_roster: 'HMDA mortgage-market evidence is not a New Jersey mortgage-license roster.',
  insurance_complaint_ne_violation: 'A complaint is not a violation. An examination is not enforcement. Admitted is not surplus lines.',
  senior_office_ne_service: 'A facility office location is not a service area. Unresolved enforcement is not a clean history.',
  contractor_record_ne_permit: '2.678 million DCA construction source records are not 2.68 million permits or projects. Statewide construction rows currently have no contractor attribution.',
  investor_sec_ne_state_ria: 'SEC/IARD New Jersey firms are not the complete New Jersey state-RIA universe. An annual questionnaire is not a firm score.',
} as const;

export function njCaveatForHub(id: SpecialistHubId): string {
  switch (id) {
    case 'move':
      return NJ_SEMANTIC_GUARDRAILS.move_ne_fmcsa;
    case 'lender':
      return NJ_SEMANTIC_GUARDRAILS.lender_hmda_ne_roster;
    case 'insurance':
      return NJ_SEMANTIC_GUARDRAILS.insurance_complaint_ne_violation;
    case 'senior':
      return NJ_SEMANTIC_GUARDRAILS.senior_office_ne_service;
    case 'contractor':
      return NJ_SEMANTIC_GUARDRAILS.contractor_record_ne_permit;
    case 'investor':
      return NJ_SEMANTIC_GUARDRAILS.investor_sec_ne_state_ria;
    default:
      return NJ_SEMANTIC_GUARDRAILS.missing_ne_zero;
  }
}

export type NjRoute = {
  hubId: SpecialistHubId;
  stateCode: 'NJ';
  intentFamily: string;
  destination: string;
  caveat: string;
};

export function classifyNjHub(query: string): SpecialistHubId | undefined {
  const q = query.toLowerCase();
  if (/\b(mover|movers|moving|warehouse|fmcsa|usdot|household[- ]goods)\b/.test(q)) return 'move';
  if (/\b(mortgage|lender|hmda|njhmfa|down[- ]payment|dpa|denial rate|first[- ]time buyer)\b/.test(q)) return 'lender';
  if (/\b(insurance|insurer|dobi|ihc|seh|get covered|surplus|financial examination)\b/.test(q)) return 'insurance';
  if (/\b(assisted[- ]living|nursing homes?|staffing|residents per staff|pace|medicaid|senior care|ltc)\b/.test(q)) {
    return 'senior';
  }
  if (/\b(contractor|construction|wall|wage watchlist|treasury debarment|permit data|public works|2\.68 million)\b/.test(q)) {
    return 'contractor';
  }
  if (
    /investment advis(?:er|or)s?|state[- ]registered advis(?:er|or)s?|bureau of securities|form adv|\biard\b|\bcrd\b|\brias?\b/.test(
      q,
    )
  ) {
    return 'investor';
  }
  return undefined;
}

export function routeNjAsk(query: string): NjRoute | undefined {
  if (!queryLooksLikeNewJersey(query)) return undefined;
  const hubId = classifyNjHub(query);
  if (!hubId) return undefined;
  return {
    hubId,
    stateCode: 'NJ',
    intentFamily: hubId,
    destination: njSpecialistUrl(hubId),
    caveat: njCaveatForHub(hubId),
  };
}

export type NjHttpProbe = {
  hub_id: SpecialistHubId;
  url: string;
  http_status: number | null;
  ok: boolean;
};

export function sixHubReleaseComplete(probes: NjHttpProbe[]): {
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

export function njConciergeContext(): string {
  const live = listNjHubs().filter((h) => h.publication_status === 'live');
  const pending = listNjHubs().filter((h) => h.publication_status !== 'live');
  const cards = listNjHubs()
    .map((h) => `- ${NETWORK_PUBLIC_NAMES[h.hub_id as SpecialistHubId]} (${h.canonical_state_url}): ${h.coverage_summary}`)
    .join('\n');
  return `## New Jersey network context
AskTrustHub /new-jersey is the network gateway. Specialist /new-jersey pages own detailed evidence.
Live NJ specialist pages: ${live.map((h) => h.hub_id).join(', ') || 'none'}.
Pending: ${pending.map((h) => h.hub_id).join(', ') || 'none'}.
Do not claim all six NJ hubs are live unless every specialist /new-jersey URL is HTTP 200.
Do not invent New Jersey license, roster, or count facts. Route to the specialist page.
${cards}
Guardrails:
- ${NJ_SEMANTIC_GUARDRAILS.move_ne_fmcsa}
- ${NJ_SEMANTIC_GUARDRAILS.lender_hmda_ne_roster}
- ${NJ_SEMANTIC_GUARDRAILS.insurance_complaint_ne_violation}
- ${NJ_SEMANTIC_GUARDRAILS.senior_office_ne_service}
- ${NJ_SEMANTIC_GUARDRAILS.contractor_record_ne_permit}
- ${NJ_SEMANTIC_GUARDRAILS.investor_sec_ne_state_ria}
- Missing evidence is unknown, not zero. No Trust Score. No paid ranking.`;
}
