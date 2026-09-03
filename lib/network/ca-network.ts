import manifestJson from '../../data/network/california-publication-manifest.json' with { type: 'json' };
import type { SpecialistHubId } from './registry.ts';
import { CANONICAL_ORIGINS, NETWORK_PUBLIC_NAMES, SPECIALIST_HUB_IDS } from './registry.ts';

export const CA_NETWORK_CONTRACT = 'ath-ca-network-v1' as const;

export type CaHubManifest = (typeof manifestJson)['hubs'][number];

export const CA_PUBLICATION_MANIFEST = manifestJson;

export function listCaHubs(): CaHubManifest[] {
  return CA_PUBLICATION_MANIFEST.hubs;
}

export function caHubById(id: SpecialistHubId): CaHubManifest | undefined {
  return CA_PUBLICATION_MANIFEST.hubs.find((h) => h.hub_id === id);
}

export function caSpecialistUrl(id: SpecialistHubId): string {
  return caHubById(id)?.canonical_state_url ?? `${CANONICAL_ORIGINS[id]}/california`;
}

export function caSixHubIdsComplete(): boolean {
  const ids = CA_PUBLICATION_MANIFEST.hubs.map((h) => h.hub_id);
  return SPECIALIST_HUB_IDS.every((id) => ids.includes(id)) && new Set(ids).size === 6;
}

export function caReleaseGatePassed(): boolean {
  return CA_PUBLICATION_MANIFEST.release_gate.passed === true;
}

const CA_CITY_RE =
  /\b(los\s+angeles|san\s+francisco|san\s+diego|sacramento|san\s+jose|oakland|orange\s+county|silicon\s+valley)\b/i;

const CA_REGULATOR_RE =
  /\b(cslb|calhfa|crmla|dmhc|bhgs|dfpi|rcfe|ccld|cal-t|calt)\b/i;

export function detectCaCity(query: string): string | undefined {
  const m = query.match(CA_CITY_RE);
  if (!m) return undefined;
  return m[1].replace(/\s+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function queryLooksLikeCalifornia(query: string): boolean {
  if (/\bcalifornia\b|\bcalif\b/i.test(query)) return true;
  if (CA_REGULATOR_RE.test(query)) return true;
  if (/\bimr\b/i.test(query)) return true;
  if (CA_CITY_RE.test(query)) return true;
  if (/\bC\.A\.\b/.test(query)) return true;
  if (/\bin\s+CA\b/.test(query) || /\bCA\s+(contractor|mover|lender|insur|senior|advis)/i.test(query)) {
    return true;
  }
  return false;
}

export const CA_SEMANTIC_GUARDRAILS = {
  missing_ne_zero: 'Unavailable official evidence is unknown, not zero.',
  no_trust_score: 'AskTrustHub does not publish a Trust Score.',
  no_ranking: 'AskTrustHub does not publish paid rankings or best/safest/worst conclusions.',
  no_county_routes: 'California is state-level only. AskTrustHub does not publish California county gateways.',
  move_calt_ne_usdot:
    'CAL-T is not USDOT. California intrastate authority is not FMCSA interstate authority. FMCSA ACTIVE is not a California license.',
  lender_hmda_ne_roster:
    'HMDA mortgage-market evidence is not a California mortgage-license roster. Denial rate is not quality. CalHFA participation is not an endorsement.',
  insurance_imr_ne_violation:
    'An IMR is not a finding that an insurer violated the law. DMHC is not CDI. The dated 28-company CDI health-insurer list is not all California insurers.',
  senior_rcfe_ne_snf:
    'An RCFE is not a nursing home. Do not add ELMS, RCFE, HCAI, HCO, and CMS overlays into one California senior-provider count. Facility address is not a service area.',
  contractor_acquired_ne_universe:
    'Acquired CSLB rows are not the complete California contractor universe. CLEAR is not TrustHub verified. A vendor is not a CSLB license. PWCR is not a CSLB license.',
  investor_office_ne_dfpi:
    'A California principal office is not DFPI / California state registration. SEC RIA is not state RIA. CRD is not current California authority.',
} as const;

export function caCaveatForHub(id: SpecialistHubId): string {
  switch (id) {
    case 'move':
      return CA_SEMANTIC_GUARDRAILS.move_calt_ne_usdot;
    case 'lender':
      return CA_SEMANTIC_GUARDRAILS.lender_hmda_ne_roster;
    case 'insurance':
      return CA_SEMANTIC_GUARDRAILS.insurance_imr_ne_violation;
    case 'senior':
      return CA_SEMANTIC_GUARDRAILS.senior_rcfe_ne_snf;
    case 'contractor':
      return CA_SEMANTIC_GUARDRAILS.contractor_acquired_ne_universe;
    case 'investor':
      return CA_SEMANTIC_GUARDRAILS.investor_office_ne_dfpi;
    default:
      return CA_SEMANTIC_GUARDRAILS.missing_ne_zero;
  }
}

export type CaRoute = {
  hubId: SpecialistHubId;
  stateCode: 'CA';
  intentFamily: string;
  destination: string;
  caveat: string;
};

export function classifyCaHub(query: string): SpecialistHubId | undefined {
  const q = query.toLowerCase();
  if (/\b(mover|movers|moving|move|bhgs|cal-t|household[- ]goods)\b/.test(q)) return 'move';
  if (/\b(mortgage|lender|hmda|calhfa|crmla|down[- ]payment|denial rate|first[- ]time buyer)\b/.test(q)) {
    return 'lender';
  }
  if (/\b(insurance|insurer|dmhc|imr|fair plan)\b/.test(q) || /\bcdi\b/.test(q)) return 'insurance';
  if (
    /\b(assisted[- ]living|nursing homes?|rcfe|snf|elms|hcai|ccld|medicaid|ltc)\b/.test(q) ||
    /\bsenior[- ]?(care|resources?|housing|centers?)\b/.test(q)
  ) {
    return 'senior';
  }
  if (/\b(contractor|cslb|pwcr|public works|classification tokens?)\b/.test(q) || (/\bclear\b/.test(q) && /\b(cslb|license|contractor)\b/.test(q))) {
    return 'contractor';
  }
  if (
    /investment advis(?:er|or)s?|state[- ]registered advis(?:er|or)s?|\badvis(?:er|or)s?\b|form adv|\biard\b|\bcrd\b|\brias?\b|\bdfpi\b/.test(
      q,
    ) ||
    (/\bprincipal office\b/.test(q) && /\b(advis|dfpi|sec|iard|california)\b/.test(q))
  ) {
    return 'investor';
  }
  return undefined;
}

export function routeCaAsk(query: string): CaRoute | undefined {
  if (!queryLooksLikeCalifornia(query)) return undefined;
  const hubId = classifyCaHub(query);
  if (!hubId) return undefined;
  return {
    hubId,
    stateCode: 'CA',
    intentFamily: hubId,
    destination: caSpecialistUrl(hubId),
    caveat: caCaveatForHub(hubId),
  };
}

export type CaHttpProbe = {
  hub_id: SpecialistHubId;
  url: string;
  http_status: number | null;
  ok: boolean;
};

export function caSixHubReleaseComplete(probes: CaHttpProbe[]): {
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

export function caConciergeContext(): string {
  const live = listCaHubs().filter((h) => h.publication_status === 'live');
  const pending = listCaHubs().filter((h) => h.publication_status !== 'live');
  const cards = listCaHubs()
    .map((h) => `- ${NETWORK_PUBLIC_NAMES[h.hub_id as SpecialistHubId]} (${h.canonical_state_url}): ${h.coverage_summary}`)
    .join('\n');
  const gate = caReleaseGatePassed();
  return `## California network context
AskTrustHub /california is the network gateway. Specialist /california pages own detailed evidence.
California is STATE LEVEL ONLY. Do not invent California county Ask pages or specialist county routes. Los Angeles, San Francisco, San Diego, Orange County, and other California places stay on specialist /california.
Hub intent remains primary. Do not route every California question to Contractor.
Live CA specialist pages: ${live.map((h) => h.hub_id).join(', ') || 'none'}.
Pending: ${pending.map((h) => h.hub_id).join(', ') || 'none'}.
Six-hub release gate passed: ${gate ? 'yes' : 'no'}. Blocker: ${CA_PUBLICATION_MANIFEST.release_gate.blocker ?? 'none'}.
All six specialist /california pages are live, indexable, and self-canonical. Ask /california is the indexable state-level network gateway. Still do not invent specialist facts. California counties are not published.
Do not invent California license, roster, or count facts. Route to the specialist page.
Do not copy New Jersey metrics or caveats into California.
${cards}
Guardrails:
- ${CA_SEMANTIC_GUARDRAILS.move_calt_ne_usdot}
- ${CA_SEMANTIC_GUARDRAILS.lender_hmda_ne_roster}
- ${CA_SEMANTIC_GUARDRAILS.insurance_imr_ne_violation}
- ${CA_SEMANTIC_GUARDRAILS.senior_rcfe_ne_snf}
- ${CA_SEMANTIC_GUARDRAILS.contractor_acquired_ne_universe}
- ${CA_SEMANTIC_GUARDRAILS.investor_office_ne_dfpi}
- Missing evidence is unknown, not zero. No Trust Score. No paid ranking. No California county routes.`;
}
