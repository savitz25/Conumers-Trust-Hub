import manifestJson from '../../data/network/texas-publication-manifest.json' with { type: 'json' };
import type { SpecialistHubId } from './registry.ts';
import { CANONICAL_ORIGINS, NETWORK_PUBLIC_NAMES, SPECIALIST_HUB_IDS } from './registry.ts';

export const TX_NETWORK_CONTRACT = 'ath-tx-network-release-v1' as const;

export type TxHubManifest = (typeof manifestJson)['hubs'][number];

export const TX_PUBLICATION_MANIFEST = manifestJson;

export function listTxHubs(): TxHubManifest[] {
  return TX_PUBLICATION_MANIFEST.hubs;
}

export function txHubById(id: SpecialistHubId): TxHubManifest | undefined {
  return TX_PUBLICATION_MANIFEST.hubs.find((h) => h.hub_id === id);
}

export function txSpecialistUrl(id: SpecialistHubId): string {
  return txHubById(id)?.canonical_state_url ?? `${CANONICAL_ORIGINS[id]}/texas`;
}

export function txSixHubIdsComplete(): boolean {
  const ids = TX_PUBLICATION_MANIFEST.hubs.map((h) => h.hub_id);
  return SPECIALIST_HUB_IDS.every((id) => ids.includes(id)) && new Set(ids).size === 6;
}

export function txReleaseGatePassed(): boolean {
  return TX_PUBLICATION_MANIFEST.release_gate.passed === true;
}

const TX_CITY_RE =
  /\b(austin|houston|dallas|san\s+antonio|fort\s+worth|el\s+paso|plano|arlington|irving|corpus\s+christi|lubbock|amarillo|laredo|garland|frisco|mckinney)\b/i;

const TX_REGULATOR_RE =
  /\b(tdlr|tsbpe|tdi|sml|txdmv|hhsc|tulip|cmbl|tsahc|tdhca)\b/i;

export function detectTxCity(query: string): string | undefined {
  const m = query.match(TX_CITY_RE);
  if (!m) return undefined;
  return m[1].replace(/\s+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function queryLooksLikeTexas(query: string): boolean {
  if (/\btexas\b|\btexan\b/i.test(query)) return true;
  if (TX_REGULATOR_RE.test(query)) return true;
  if (/\bssb\b/.test(query) && /\b(advis|securit|crd|iard)\b/i.test(query)) return true;
  if (TX_CITY_RE.test(query)) return true;
  if (/\bin\s+TX\b/.test(query) || /\bTX\s+(contractor|mover|lender|insur|senior|advis|electrician|plumber)/i.test(query)) {
    return true;
  }
  return false;
}

export const TX_SEMANTIC_GUARDRAILS = {
  missing_ne_zero: 'Unavailable official evidence is unknown, not zero.',
  no_trust_score: 'AskTrustHub does not publish a Trust Score.',
  no_ranking: 'AskTrustHub does not publish paid rankings or best/safest/worst conclusions.',
  no_county_routes:
    'Texas is state-level only. AskTrustHub does not publish Texas city or county gateways in this release.',
  contractor_no_gc:
    'Texas has no statewide general-contractor license. TDLR specialty-trade identities, TSBPE plumbing, and CMBL vendors are different universes. Vendor is not a license.',
  insurance_appointment_ne_quality:
    'Appointment count is not quality. A TDI complaint is not a violation. The TDI complaint index is not a TrustHub score. Person licenses are not a public directory.',
  lender_hmda_ne_roster:
    'HMDA is not a Texas mortgage-license roster. An NMLS ID is not current Texas authority by itself. Name-only SML orders are unsafe for adverse attach. Denial rate is not quality.',
  move_txdmv_ne_fmcsa:
    'Texas intrastate household-goods authority is not FMCSA interstate authority. A USDOT number alone is not interstate operating authority. A tow company is not a household-goods mover. Complete mover denominator is UNKNOWN, not zero.',
  investor_office_ne_ssb:
    'A Texas principal office is not Texas state-RIA registration. ERA is not an RIA. Broker-dealer is not an investment adviser. CRD is not current Texas authority.',
  senior_hhsc_ne_cms:
    'HHSC is not CMS. Assisted living is not a nursing home. HCSSA is not CMS Home Health. Personal Assistance is not Home Health. Hospice is not Home Health. Do not sum overlapping HCSSA labels.',
} as const;

export function txCaveatForHub(id: SpecialistHubId): string {
  switch (id) {
    case 'contractor':
      return TX_SEMANTIC_GUARDRAILS.contractor_no_gc;
    case 'insurance':
      return TX_SEMANTIC_GUARDRAILS.insurance_appointment_ne_quality;
    case 'lender':
      return TX_SEMANTIC_GUARDRAILS.lender_hmda_ne_roster;
    case 'move':
      return TX_SEMANTIC_GUARDRAILS.move_txdmv_ne_fmcsa;
    case 'investor':
      return TX_SEMANTIC_GUARDRAILS.investor_office_ne_ssb;
    case 'senior':
      return TX_SEMANTIC_GUARDRAILS.senior_hhsc_ne_cms;
    default:
      return TX_SEMANTIC_GUARDRAILS.missing_ne_zero;
  }
}

export type TxRoute = {
  hubId: SpecialistHubId;
  stateCode: 'TX';
  intentFamily: string;
  destination: string;
  caveat: string;
};

function californiaNamedBeforeTexas(query: string): boolean {
  const ca = query.search(/\bcalifornia\b|\bcalif\b/i);
  const tx = query.search(/\btexas\b|\btexan\b/i);
  if (ca < 0) return false;
  if (tx < 0) return true;
  return ca < tx;
}

export function classifyTxHub(query: string): SpecialistHubId | undefined {
  const q = query.toLowerCase();
  if (/\b(mover|movers|moving|txdmv|household[- ]goods|usdot|fmcsa|move from|move to)\b/.test(q)) return 'move';
  if (/\b(mortgage|lender|hmda|sml|nmls|homebuyer|tdhca|tsahc|denial rate)\b/.test(q)) return 'lender';
  if (/\b(insurance|insurer|appointed|appointment|complaint index)\b/.test(q) || /\btdi\b/.test(q) || /\bnaic\b/.test(q)) {
    return 'insurance';
  }
  if (
    /\b(assisted[- ]living|nursing homes?|nursing facility|alf|hcssa|hhsc|tulip|hospice|home health|ltc)\b/.test(q) ||
    /\bsenior[- ]?(care|resources?|housing)\b/.test(q) ||
    (/\bcms\b/.test(q) && /\b(hhsc|texas|nursing|hospice|home health)\b/.test(q))
  ) {
    return 'senior';
  }
  if (
    /\b(contractor|electrician|plumber|plumbing|tdlr|tsbpe|cmbl|general contractor|specialty trade)\b/.test(q)
  ) {
    return 'contractor';
  }
  if (
    /investment advis(?:er|or)s?|state[- ]registered advis(?:er|or)s?|\badvis(?:er|or)s?\b|form adv|\biard\b|\bcrd\b|\brias?\b|\bera\b|\bssb\b/.test(
      q,
    ) ||
    (/\bprincipal office\b/.test(q) && /\b(advis|sec|iard|texas)\b/.test(q))
  ) {
    return 'investor';
  }
  return undefined;
}

export function routeTxAsk(query: string): TxRoute | undefined {
  if (californiaNamedBeforeTexas(query)) return undefined;
  if (!queryLooksLikeTexas(query)) return undefined;
  const hubId = classifyTxHub(query);
  if (!hubId) return undefined;
  return {
    hubId,
    stateCode: 'TX',
    intentFamily: hubId,
    destination: txSpecialistUrl(hubId),
    caveat: txCaveatForHub(hubId),
  };
}

export type TxHttpProbe = {
  hub_id: SpecialistHubId;
  url: string;
  http_status: number | null;
  ok: boolean;
};

export function txSixHubReleaseComplete(probes: TxHttpProbe[]): {
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

export function txConciergeContext(): string {
  const live = listTxHubs().filter((h) => h.publication_status === 'live');
  const cards = listTxHubs()
    .map((h) => `- ${NETWORK_PUBLIC_NAMES[h.hub_id as SpecialistHubId]} (${h.canonical_state_url}): ${h.coverage_summary}`)
    .join('\n');
  const gate = txReleaseGatePassed();
  return `## Texas network context
AskTrustHub /texas is the network gateway. Specialist /texas pages own detailed evidence.
Texas is STATE LEVEL ONLY. Do not invent Texas city or county Ask pages or specialist county routes. Austin, Houston, Dallas, San Antonio, Fort Worth, Travis, Harris, Tarrant, and Bexar stay on specialist /texas.
Hub intent remains primary. Do not route every Texas question to Contractor.
Live TX specialist pages: ${live.map((h) => h.hub_id).join(', ') || 'none'}.
Six-hub release gate passed: ${gate ? 'yes' : 'no'}. Blocker: ${TX_PUBLICATION_MANIFEST.release_gate.blocker ?? 'none'}.
Do not invent Texas license, roster, or count facts. Route to the specialist page.
Do not copy California or New Jersey metrics into Texas.
Do not add TDLR, TSBPE, and CMBL into one Texas contractors number.
Do not manufacture a Texas mover count. Do not treat SEC/IARD Texas principal-office firms as the state-RIA roster.
${cards}
Guardrails:
- ${TX_SEMANTIC_GUARDRAILS.contractor_no_gc}
- ${TX_SEMANTIC_GUARDRAILS.insurance_appointment_ne_quality}
- ${TX_SEMANTIC_GUARDRAILS.lender_hmda_ne_roster}
- ${TX_SEMANTIC_GUARDRAILS.move_txdmv_ne_fmcsa}
- ${TX_SEMANTIC_GUARDRAILS.investor_office_ne_ssb}
- ${TX_SEMANTIC_GUARDRAILS.senior_hhsc_ne_cms}
- Missing evidence is unknown, not zero. No Trust Score. No paid ranking. No Texas county routes.`;
}
