import { createHash } from 'node:crypto';
import manifestJson from '../../data/network/ohio-publication-manifest.json' with { type: 'json' };
import verificationJson from '../../data/network/ohio-verification.json' with { type: 'json' };
import type { SpecialistHubId } from './registry.ts';
import { CANONICAL_ORIGINS, NETWORK_PUBLIC_NAMES } from './registry.ts';
import { tennesseeNamedFirst } from './tn-network.ts';

export const OH_NETWORK_CONTRACT = 'ath-oh-network-release-v1' as const;

export const REQUIRED_OH_HUB_IDS = [
  'contractor',
  'move',
  'senior',
  'lender',
  'insurance',
  'investor',
] as const satisfies readonly SpecialistHubId[];

export const OH_FINGERPRINT_METHOD =
  'Accepted specialist snapshot artifact at the certified repository SHA. Public HTML confirms the intended state page; the fingerprint is not recomputed from HTML.';

export const ACCEPTED_OH_SPECIALIST_RELEASES: Record<
  SpecialistHubId,
  { snapshot_version: string; fingerprint: string; certified_release_sha: string; canonical_state_url: string }
> = {
  contractor: {
    snapshot_version: 'contractor-oh-state-intel-v1',
    fingerprint: 'b7e441958066cc598342127e4ecc3d87ee4273d16470f5db8d148f7dfef9c03d',
    certified_release_sha: '7b3458990a81817b1ca41993056925935c67aa84',
    canonical_state_url: 'https://www.contractortrusthub.com/ohio',
  },
  move: {
    snapshot_version: 'move-oh-state-intel-v1',
    fingerprint: '24cfc71aacbec3837b7c06c5b291d8cde1548673712e91888c8378b99f7d7a44',
    certified_release_sha: '5018639dee0901bbc630cafdd633015421f86e00',
    canonical_state_url: 'https://www.movetrusthub.com/ohio',
  },
  senior: {
    snapshot_version: 'senior-oh-state-intel-v1',
    fingerprint: 'f4e8f7706cf758403dc7e11883c936a14d080fd24d3fc25dca8ae3031c7c5578',
    certified_release_sha: 'ee23ce348c7be1b5cbfa7b21642a2517aef7fc84',
    canonical_state_url: 'https://www.seniortrusthub.com/ohio',
  },
  lender: {
    snapshot_version: 'lender-oh-state-intel-v1',
    fingerprint: 'c2f9a94cb644a32ff91d98d5c4e338096ac23bdc3e0f2a18464b9b1bc0df3fb8',
    certified_release_sha: 'f69194245199ac8013dbbebc63f5820eb769e043',
    canonical_state_url: 'https://www.lendertrusthub.com/ohio',
  },
  insurance: {
    snapshot_version: 'insurance-oh-state-intel-v1',
    fingerprint: '37736ead0d717acbaa8b3cfdcfa43f7b14b5dae985a158dadb6f6d545ebb25bc',
    certified_release_sha: '7416c40ce85a9be62b4cbc3c0306ed41ed744cae',
    canonical_state_url: 'https://www.insurancetrusthub.com/ohio',
  },
  investor: {
    snapshot_version: 'investor-oh-state-intel-v1',
    fingerprint: '5066d92b3b16cfc19c21edf722652dac764a13139e41335ebf46beb95eb6aa0b',
    certified_release_sha: '5f7f363b5479db16dc122a128bb65270476aa196',
    canonical_state_url: 'https://www.investortrusthub.com/ohio',
  },
};

export type OhHubManifest = (typeof manifestJson)['hubs'][number];

export const OH_PUBLICATION_MANIFEST = manifestJson;
export const OH_VERIFICATION = verificationJson;

const VOLATILE_KEYS = new Set([
  'verified_at',
  'verifiedAt',
  'generated_at',
  'generatedAt',
  'live_route_verified_at',
  'live_route_verifiedAt',
]);

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !VOLATILE_KEYS.has(key))
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`).join(',')}}`;
}

export function ohPublicationSemanticFingerprint(
  manifest: typeof OH_PUBLICATION_MANIFEST = OH_PUBLICATION_MANIFEST,
): string {
  return createHash('sha256').update(canonicalJson(manifest)).digest('hex');
}

export const OH_PUBLICATION_FINGERPRINT = ohPublicationSemanticFingerprint();

export function listOhHubs(): OhHubManifest[] {
  return OH_PUBLICATION_MANIFEST.hubs;
}

export function ohHubById(id: SpecialistHubId): OhHubManifest | undefined {
  return OH_PUBLICATION_MANIFEST.hubs.find((h) => h.hub_id === id);
}

export function ohSpecialistUrl(id: SpecialistHubId): string {
  return ohHubById(id)?.canonical_state_url ?? `${CANONICAL_ORIGINS[id]}/ohio`;
}

export type OhGateHub = {
  hub_id: string;
  canonical_state_url?: string;
  snapshot_version?: string;
  fingerprint?: string;
  certified_release_sha?: string;
  publication_status?: string;
};

export type OhGateManifest = {
  hubs: OhGateHub[];
  scope?: string;
  hardcoded_columbus_routes?: boolean;
  hardcoded_cleveland_routes?: boolean;
};

export type OhPageEvidence = {
  hub_id?: string;
  url?: string | null;
  expected_url?: string | null;
  http_status?: number | null;
  ok?: boolean;
  canonical?: string | null;
  robots?: string | null;
  x_robots_tag?: string | null;
  final_url?: string | null;
  selfCanonical?: boolean;
  sso?: boolean;
  headline_ok?: boolean;
  intended_intelligence_page?: boolean;
  not_noindex?: boolean;
};

export type OhGateVerification = {
  release_gate_passed?: boolean;
  missing?: string[];
  hubs: OhPageEvidence[];
};

export function ohSixHubIdsComplete(hubs: OhGateHub[] = listOhHubs()): boolean {
  if (!Array.isArray(hubs) || hubs.length !== REQUIRED_OH_HUB_IDS.length) return false;
  const ids = hubs.map((hub) => hub.hub_id);
  if (new Set(ids).size !== REQUIRED_OH_HUB_IDS.length) return false;
  return REQUIRED_OH_HUB_IDS.every((id) => ids.includes(id));
}

export function normalizeOhPublicUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    if (!host) return null;
    const path = (url.pathname.replace(/\/+$/, '') || '/') as string;
    if (url.username || url.password) return null;
    return `https://${host}${path}`;
  } catch {
    return null;
  }
}

export function urlsAreSameOhPage(actual: string | null | undefined, expected: string): boolean {
  const left = normalizeOhPublicUrl(actual);
  const right = normalizeOhPublicUrl(expected);
  return Boolean(left && right && left === right);
}

export function evaluateOhPageEvidence(
  probe: OhPageEvidence,
  expectedUrl: string,
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (probe.http_status !== 200) reasons.push('http_status');
  if (probe.sso !== false) reasons.push('sso');
  const finalUrl = probe.final_url ?? probe.url ?? null;
  if (!urlsAreSameOhPage(finalUrl, expectedUrl)) reasons.push('final_url');
  if (!urlsAreSameOhPage(probe.canonical, expectedUrl)) reasons.push('canonical');
  const robots = `${probe.robots ?? ''} ${probe.x_robots_tag ?? ''}`;
  if (/noindex/i.test(robots) || probe.not_noindex === false) reasons.push('noindex');
  if (probe.headline_ok !== true) reasons.push('headline');
  if (probe.intended_intelligence_page === false) reasons.push('not_intelligence_page');
  const looksSoft404 = /page not found|\b404\b/i.test(`${probe.canonical ?? ''} ${probe.final_url ?? ''}`);
  if (looksSoft404) reasons.push('soft_404');
  return { ok: reasons.length === 0, reasons };
}

export function ohReleaseGatePassed(
  manifest: OhGateManifest = OH_PUBLICATION_MANIFEST,
  verification: OhGateVerification = OH_VERIFICATION,
): boolean {
  if (!ohSixHubIdsComplete(manifest.hubs)) return false;
  if (manifest.scope !== 'STATE_LEVEL_ONLY') return false;
  if (manifest.hardcoded_columbus_routes !== false) return false;
  if (manifest.hardcoded_cleveland_routes !== false) return false;
  if (!Array.isArray(verification.hubs) || verification.hubs.length !== REQUIRED_OH_HUB_IDS.length) return false;
  const verifiedIds = verification.hubs.map((row) => row.hub_id).filter((id): id is string => Boolean(id));
  if (verifiedIds.length !== REQUIRED_OH_HUB_IDS.length || new Set(verifiedIds).size !== REQUIRED_OH_HUB_IDS.length) {
    return false;
  }
  if (!REQUIRED_OH_HUB_IDS.every((id) => verifiedIds.includes(id))) return false;
  if ((verification.missing ?? []).length !== 0) return false;
  for (const hub of manifest.hubs) {
    const id = hub.hub_id as SpecialistHubId;
    const accepted = ACCEPTED_OH_SPECIALIST_RELEASES[id];
    if (!accepted) return false;
    if (hub.canonical_state_url !== accepted.canonical_state_url) return false;
    if (hub.snapshot_version !== accepted.snapshot_version) return false;
    if (hub.fingerprint !== accepted.fingerprint) return false;
    if (hub.certified_release_sha && hub.certified_release_sha !== accepted.certified_release_sha) return false;
    if (hub.publication_status !== 'live') return false;
    const verified = verification.hubs.find((row) => row.hub_id === hub.hub_id);
    if (!verified) return false;
    const page = evaluateOhPageEvidence(
      { ...verified, url: verified.url ?? verified.expected_url ?? hub.canonical_state_url },
      accepted.canonical_state_url,
    );
    if (!page.ok) return false;
  }
  return true;
}

const OH_CITY_RE =
  /\b(columbus|cleveland|cincinnati|toledo|akron|dayton|youngstown|canton|lorain|hamilton)\b/i;
const OH_COUNTY_RE =
  /\b(franklin|cuyahoga|hamilton|lucas|summit|montgomery|stark|butler|lorain|mahoning)\s+county\b/i;

export function detectOhCity(query: string): string | undefined {
  const city = query.match(OH_CITY_RE);
  if (!city) return undefined;
  const raw = city[1].toLowerCase();
  return raw.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function detectRequestedOhInsuranceProducts(query: string): string[] {
  const out: string[] = [];
  if (/\bhomeowners?\b|\bhome insurance\b/i.test(query)) out.push('homeowners');
  if (/\bauto(?:mobile)?\b|\bcar insurance\b/i.test(query)) out.push('auto');
  if (/\blife insurance\b|\blife agencies\b/i.test(query)) out.push('life');
  if (/\bhealth insurance\b|\bhealth agencies\b/i.test(query)) out.push('health');
  if (/\bflood\b/i.test(query)) out.push('flood');
  return out;
}

export function queryLooksLikeOhio(query: string): boolean {
  if (/\bohio\b/i.test(query)) return true;
  if (OH_CITY_RE.test(query) || OH_COUNTY_RE.test(query)) return true;
  if (/\b(ocilb|puco|odh|dfi|rmla|odi|ohfa)\b/i.test(query)) return true;
  if (/\bin oh\b/i.test(query) || /\bOH\s+(registered|contractor|mover|lender|insur|senior|advis|broker|nursing|mortgage|securities)/.test(query)) {
    return true;
  }
  return false;
}

export const OH_SEMANTIC_GUARDRAILS = {
  missing_ne_zero: 'Unavailable official evidence is unknown, not zero.',
  search_only_ne_zero: 'Search-only official evidence is unknown, not zero.',
  no_trust_score: 'AskTrustHub does not publish a Trust Score.',
  no_ranking: 'AskTrustHub does not publish paid rankings or best/safest/worst conclusions.',
  columbus_deferred:
    'Columbus, Cleveland, Cincinnati, Toledo, Akron, Dayton, and other city/county names stay on statewide Ohio research. Local Ohio datasets and Ask city or county routes are not published.',
  contractor_no_statewide_gc:
    'Ohio does not have one statewide general-contractor license. OCILB licenses five commercial specialty trades. 9,528 distinct numeric identities is the deduplicated grain; 12,461 trade rows are not unique contractors. Fire-alarm work may involve SFM certification and is not proved unlicensed by the absence of an EL credential alone.',
  move_puco_ne_fmcsa:
    'PUCO household-goods carrier authority is publicly searchable; no complete current statewide HHG certificate roster was acquired. Search-only is not zero movers. Each carrier files its own tariff. Ohio does not use North Carolina’s statewide Maximum Rate Tariff. PUCO ≠ USDOT ≠ MC. Interstate work remains FMCSA.',
  senior_rcf_ne_nh:
    '923 ODH Nursing Home licenses are not 812 Residential Care Facility licenses. Do not publish 1,735 Ohio senior facilities. Consumer “assisted living” maps to RCF. ODH license ≠ CMS CCN. Exact state↔CMS bridges remain 0. Navigator quality is not a TrustHub ranking.',
  lender_hmda_ne_lender:
    '460,825 HMDA 2025 applications for Ohio properties are not lenders. Current RMLA company registration is OPEN_SEARCH_ONLY. Do not use MLOs, 2,095 OHFA observations, 85 OHFA names, 981 LEIs, or 157 FDIC institutions as the lender census. DFI is the regulator; NMLS is infrastructure.',
  insurance_sqa009:
    '1,738 authorized legal insurers are not 23,922 Major Lines business-entity NPNs. Do not add them. Homeowners, auto, and flood remain UNSUPPORTED exact product LOA and must not silently become generic Ohio agencies. Life is source-supported licensing authority; health is Accident & Health licensing authority. Authority is not current product inventory. The Administrative Actions Journal warns it is not comprehensive.',
  investor_lenses_separate:
    '784 IAPD APPROVED Ohio state-IA firm CRDs are not 24 ERA, not 2,733 notice filings, and not 426 principal-office firms. Do not add them. Principal office is not registration. NOH is allegation/opportunity for hearing, not a final finding. Firm CRD is not person CRD.',
} as const;

export function ohCaveatForHub(id: SpecialistHubId): string {
  switch (id) {
    case 'contractor':
      return OH_SEMANTIC_GUARDRAILS.contractor_no_statewide_gc;
    case 'move':
      return OH_SEMANTIC_GUARDRAILS.move_puco_ne_fmcsa;
    case 'senior':
      return OH_SEMANTIC_GUARDRAILS.senior_rcf_ne_nh;
    case 'lender':
      return OH_SEMANTIC_GUARDRAILS.lender_hmda_ne_lender;
    case 'insurance':
      return OH_SEMANTIC_GUARDRAILS.insurance_sqa009;
    case 'investor':
      return OH_SEMANTIC_GUARDRAILS.investor_lenses_separate;
    default:
      return OH_SEMANTIC_GUARDRAILS.missing_ne_zero;
  }
}

export type OhRoute = {
  hubId: SpecialistHubId;
  stateCode: 'OH';
  intentFamily: string;
  destination: string;
  caveat: string;
  requestedProduct?: string[];
};

function earlierStateNamed(query: string, other: RegExp): boolean {
  const oh = query.search(/\bohio\b/i);
  const otherAt = query.search(other);
  if (otherAt < 0) return false;
  if (oh < 0) return true;
  return otherAt < oh;
}

export function classifyOhHub(query: string): SpecialistHubId | undefined {
  const q = query.toLowerCase();
  if (
    /\b(mover|movers|moving|household[- ]goods|usdot|fmcsa|hhg|puco|intrastate movers?|interstate movers?|interstate carriers?|moving rates?|moving tariff)\b/.test(
      q,
    )
  ) {
    return 'move';
  }
  if (
    /\b(mortgage|hmda|nmls|homebuyer|mlo|lender company|mortgage lender|mortgage broker|rmla|ohfa|dfi)\b/.test(q) &&
    !/\badvis|securit|iard|ria\b/.test(q)
  ) {
    return 'lender';
  }
  if (
    /\b(nursing homes?|residential care|assisted[- ]living|home[- ]health|hospice|pace(?:s| program)?|senior[- ]?(care|resources?|housing)|odh)\b/.test(
      q,
    )
  ) {
    return 'senior';
  }
  if (
    /\b(insurance|insurer|naic|producer|agency roster|odi|administrative actions?|journal)\b/.test(q) ||
    (/\bagenc/i.test(q) && /\b(homeowners?|auto(?:mobile)?|life|health|flood)\b/.test(q))
  ) {
    return 'insurance';
  }
  if (
    /\b(contractors?|ocilb|general contractor|residential contractor|electrical contractor|hvac contractor|plumber|fire alarm)\b/.test(
      q,
    )
  ) {
    return 'contractor';
  }
  if (
    /investment advis(?:er|or)s?|state[- ]registered advis(?:er|or)s?|\badvis(?:er|or)s?\b|form adv|\biard\b|\biars?\b|\bcrd\b|\brias?\b|\bera\b|principal office|notice[- ]fil|securities|noh|final orders?/.test(
      q,
    )
  ) {
    return 'investor';
  }
  return undefined;
}

export function routeOhAsk(query: string): OhRoute | undefined {
  if (tennesseeNamedFirst(query)) return undefined; // ATH-TN-001: Tennessee named first wins
  if (earlierStateNamed(query, /\bnorth carolina\b/i)) return undefined;
  if (earlierStateNamed(query, /\bpennsylvania\b/i)) return undefined;
  if (earlierStateNamed(query, /\bnew york\b/i)) return undefined;
  if (earlierStateNamed(query, /\billinois\b/i)) return undefined;
  if (earlierStateNamed(query, /\bcolorado\b/i)) return undefined;
  if (earlierStateNamed(query, /\bvirginia\b/i)) return undefined;
  if (earlierStateNamed(query, /\bcalifornia\b/i)) return undefined;
  if (earlierStateNamed(query, /\boregon\b/i)) return undefined;
  if (earlierStateNamed(query, /\bwashington\b/i)) return undefined;
  if (!queryLooksLikeOhio(query)) return undefined;
  const hubId = classifyOhHub(query);
  if (!hubId) return undefined;
  const requestedProduct = hubId === 'insurance' ? detectRequestedOhInsuranceProducts(query) : undefined;
  let caveat = ohCaveatForHub(hubId);
  if (requestedProduct?.includes('homeowners') || requestedProduct?.includes('auto') || requestedProduct?.includes('flood')) {
    caveat = `${OH_SEMANTIC_GUARDRAILS.insurance_sqa009} Requested product: ${requestedProduct.join(', ')}. Exact product LOA is UNSUPPORTED; do not convert this to generic Ohio agencies.`;
  } else if (requestedProduct?.includes('life') || requestedProduct?.includes('health')) {
    caveat = `${OH_SEMANTIC_GUARDRAILS.insurance_sqa009} Requested product: ${requestedProduct.join(', ')}. This is licensing-authority evidence, not current product inventory.`;
  }
  return {
    hubId,
    stateCode: 'OH',
    intentFamily: hubId,
    destination: ohSpecialistUrl(hubId),
    caveat,
    requestedProduct: requestedProduct?.length ? requestedProduct : undefined,
  };
}

export function ohConciergeContext(): string {
  const live = listOhHubs().filter((h) => h.publication_status === 'live');
  const cards = listOhHubs()
    .map((h) => `- ${NETWORK_PUBLIC_NAMES[h.hub_id as SpecialistHubId]} (${h.canonical_state_url}): ${h.coverage_summary}`)
    .join('\n');
  const gate = ohReleaseGatePassed();
  return `## Ohio network context
AskTrustHub /ohio is the network gateway. Specialist /ohio pages own detailed evidence.
Ohio research is STATE LEVEL ONLY. Columbus, Cleveland, Cincinnati, Toledo, Akron, Dayton, and other city/county names stay on specialist /ohio with statewide limitations. Do not invent Ohio city or county Ask routes. Local Ohio acquisition is not started.
Compact planner vocabulary: Contractor OCILB/EL/HV/HY/PL/RE/commercial specialty/no statewide GC/SFM fire certification. Move PUCO HHG certificate/carrier-specific tariff/intrastate vs FMCSA/search-only roster. Senior ODH Nursing Home/RCF assisted living/state license vs CMS CCN. Lender DFI/RMLA/NMLS/company vs MLO/HMDA/CFPB/OHFA. Insurance ODI/NAIC/NPN/authorized insurer/agency Major Lines/Life A&H authority/Journal. Investor Ohio Division of Securities/CRD/state IA/ERA/notice/principal office/NOH/Final Order.
Hub intent remains primary. Do not route every Ohio question to Contractor.
Live OH specialist pages: ${live.map((h) => h.hub_id).join(', ') || 'none'}.
Six-hub specialist publication gate: ${gate ? 'passed' : 'failed'}. Blocker: ${OH_PUBLICATION_MANIFEST.release_gate.blocker ?? 'none'}.
Do not invent Ohio license, roster, or count facts. Route to the specialist page.
Do not copy North Carolina, Pennsylvania, Oregon, Illinois, New York, Virginia, or Colorado metrics into Ohio.
Do not treat 12,461 OCILB trade rows as unique contractors or as a statewide GC census.
Do not invent a PUCO mover count or a statewide Maximum Rate Tariff.
Do not add 923 Nursing Homes + 812 RCFs into one senior-facility total.
Do not treat 460,825 HMDA applications as lenders.
Do not add 1,738 authorized insurers + 23,922 Major Lines NPNs. SQA-009: homeowners/auto remain UNSUPPORTED exact product LOA.
Do not add 784 APPROVED state IA + 24 ERA + 2,733 notice + 426 principal-office firms.
There is no combined Ohio provider or Trust Hub record total.
${cards}
Guardrails:
- ${OH_SEMANTIC_GUARDRAILS.contractor_no_statewide_gc}
- ${OH_SEMANTIC_GUARDRAILS.move_puco_ne_fmcsa}
- ${OH_SEMANTIC_GUARDRAILS.senior_rcf_ne_nh}
- ${OH_SEMANTIC_GUARDRAILS.lender_hmda_ne_lender}
- ${OH_SEMANTIC_GUARDRAILS.insurance_sqa009}
- ${OH_SEMANTIC_GUARDRAILS.investor_lenses_separate}
- Missing, restricted, and search-only evidence is unknown, not zero. No Trust Score. No paid ranking. Columbus/Cleveland local routes are not started.`;
}
