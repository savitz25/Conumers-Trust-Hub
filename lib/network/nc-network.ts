import { createHash } from 'node:crypto';
import manifestJson from '../../data/network/north-carolina-publication-manifest.json' with { type: 'json' };
import verificationJson from '../../data/network/north-carolina-verification.json' with { type: 'json' };
import type { SpecialistHubId } from './registry.ts';
import { CANONICAL_ORIGINS, NETWORK_PUBLIC_NAMES } from './registry.ts';

export const NC_NETWORK_CONTRACT = 'ath-nc-network-release-v1' as const;

export const REQUIRED_NC_HUB_IDS = [
  'contractor',
  'move',
  'senior',
  'lender',
  'insurance',
  'investor',
] as const satisfies readonly SpecialistHubId[];

export const NC_FINGERPRINT_METHOD =
  'Accepted specialist snapshot artifact at the certified repository SHA. Public HTML confirms the intended state page; the fingerprint is not recomputed from HTML.';

export const ACCEPTED_NC_SPECIALIST_RELEASES: Record<
  SpecialistHubId,
  { snapshot_version: string; fingerprint: string; certified_release_sha: string; canonical_state_url: string }
> = {
  contractor: {
    snapshot_version: 'contractor-nc-state-intel-v1',
    fingerprint: '17bd03c18651bcb88ba52d54aeba3297d5ced19ae29190159c833d01774eb297',
    certified_release_sha: '0be9e356a4e71cb6d9b4fa3711c2b523501a84e1',
    canonical_state_url: 'https://www.contractortrusthub.com/north-carolina',
  },
  move: {
    snapshot_version: 'move-nc-state-intel-v1',
    fingerprint: '9b4becfd1d99f78abdbe79daabb0ba61571e6b6fc3e13f8fb1dc439661e46bec',
    certified_release_sha: '560a3ac5dd566d37a8fb37b66627d993cd8f235f',
    canonical_state_url: 'https://www.movetrusthub.com/north-carolina',
  },
  senior: {
    snapshot_version: 'senior-nc-state-intel-v1',
    fingerprint: 'a53e54853c351e287e8d91a7f131369d60a4e40a3f35a64d2e86899ed41d3181',
    certified_release_sha: '2f603dcb5d8c4910608f08535b2295c5065cb3f2',
    canonical_state_url: 'https://www.seniortrusthub.com/north-carolina',
  },
  lender: {
    snapshot_version: 'lender-nc-state-intel-v1',
    fingerprint: '95cc55e2092335c30698c676c67eb6ca0559a7a4dc33a68ce8e82bf4cfe6c10d',
    certified_release_sha: 'dbf7f3e8f58415e16ddaed330f51e69e0d858290',
    canonical_state_url: 'https://www.lendertrusthub.com/north-carolina',
  },
  insurance: {
    snapshot_version: 'insurance-nc-state-intel-v1',
    fingerprint: 'a3abc66b4595a426fe6a3969b396f24cd9ecfaf3189411cf1a7ea0db9b2feab0',
    certified_release_sha: 'c8d869b19c028cf5b9f143291bbe4471eca89099',
    canonical_state_url: 'https://www.insurancetrusthub.com/north-carolina',
  },
  investor: {
    snapshot_version: 'investor-nc-state-intel-v1',
    fingerprint: '697edd7ef765dcc52930e2953ddeb55d111a3cd361afba79504d76588a696325',
    certified_release_sha: 'b90f8d4582a3cac0cbe048032fdfd37174a223f9',
    canonical_state_url: 'https://www.investortrusthub.com/north-carolina',
  },
};

export type NcHubManifest = (typeof manifestJson)['hubs'][number];

export const NC_PUBLICATION_MANIFEST = manifestJson;
export const NC_VERIFICATION = verificationJson;

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

export function ncPublicationSemanticFingerprint(
  manifest: typeof NC_PUBLICATION_MANIFEST = NC_PUBLICATION_MANIFEST,
): string {
  return createHash('sha256').update(canonicalJson(manifest)).digest('hex');
}

export const NC_PUBLICATION_FINGERPRINT = ncPublicationSemanticFingerprint();

export function listNcHubs(): NcHubManifest[] {
  return NC_PUBLICATION_MANIFEST.hubs;
}

export function ncHubById(id: SpecialistHubId): NcHubManifest | undefined {
  return NC_PUBLICATION_MANIFEST.hubs.find((h) => h.hub_id === id);
}

export function ncSpecialistUrl(id: SpecialistHubId): string {
  return ncHubById(id)?.canonical_state_url ?? `${CANONICAL_ORIGINS[id]}/north-carolina`;
}

export type NcGateHub = {
  hub_id: string;
  canonical_state_url?: string;
  snapshot_version?: string;
  fingerprint?: string;
  certified_release_sha?: string;
  publication_status?: string;
};

export type NcGateManifest = {
  hubs: NcGateHub[];
  scope?: string;
  hardcoded_charlotte_routes?: boolean;
  hardcoded_raleigh_routes?: boolean;
};

export type NcPageEvidence = {
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

export type NcGateVerification = {
  release_gate_passed?: boolean;
  missing?: string[];
  hubs: NcPageEvidence[];
};

export function ncSixHubIdsComplete(hubs: NcGateHub[] = listNcHubs()): boolean {
  if (!Array.isArray(hubs) || hubs.length !== REQUIRED_NC_HUB_IDS.length) return false;
  const ids = hubs.map((hub) => hub.hub_id);
  if (new Set(ids).size !== REQUIRED_NC_HUB_IDS.length) return false;
  return REQUIRED_NC_HUB_IDS.every((id) => ids.includes(id));
}

export function normalizeNcPublicUrl(value: string | null | undefined): string | null {
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

export function urlsAreSameNcPage(actual: string | null | undefined, expected: string): boolean {
  const left = normalizeNcPublicUrl(actual);
  const right = normalizeNcPublicUrl(expected);
  return Boolean(left && right && left === right);
}

export function evaluateNcPageEvidence(
  probe: NcPageEvidence,
  expectedUrl: string,
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (probe.http_status !== 200) reasons.push('http_status');
  if (probe.sso !== false) reasons.push('sso');
  const finalUrl = probe.final_url ?? probe.url ?? null;
  if (!urlsAreSameNcPage(finalUrl, expectedUrl)) reasons.push('final_url');
  if (!urlsAreSameNcPage(probe.canonical, expectedUrl)) reasons.push('canonical');
  const robots = `${probe.robots ?? ''} ${probe.x_robots_tag ?? ''}`;
  if (/noindex/i.test(robots) || probe.not_noindex === false) reasons.push('noindex');
  if (probe.headline_ok !== true) reasons.push('headline');
  if (probe.intended_intelligence_page === false) reasons.push('not_intelligence_page');
  const looksSoft404 = /page not found|\b404\b/i.test(`${probe.canonical ?? ''} ${probe.final_url ?? ''}`);
  if (looksSoft404) reasons.push('soft_404');
  return { ok: reasons.length === 0, reasons };
}

export function ncReleaseGatePassed(
  manifest: NcGateManifest = NC_PUBLICATION_MANIFEST,
  verification: NcGateVerification = NC_VERIFICATION,
): boolean {
  if (!ncSixHubIdsComplete(manifest.hubs)) return false;
  if (manifest.scope !== 'STATE_LEVEL_ONLY') return false;
  if (manifest.hardcoded_charlotte_routes !== false) return false;
  if (manifest.hardcoded_raleigh_routes !== false) return false;
  if (!Array.isArray(verification.hubs) || verification.hubs.length !== REQUIRED_NC_HUB_IDS.length) return false;
  const verifiedIds = verification.hubs.map((row) => row.hub_id).filter((id): id is string => Boolean(id));
  if (verifiedIds.length !== REQUIRED_NC_HUB_IDS.length || new Set(verifiedIds).size !== REQUIRED_NC_HUB_IDS.length) {
    return false;
  }
  if (!REQUIRED_NC_HUB_IDS.every((id) => verifiedIds.includes(id))) return false;
  if ((verification.missing ?? []).length !== 0) return false;
  for (const hub of manifest.hubs) {
    const id = hub.hub_id as SpecialistHubId;
    const accepted = ACCEPTED_NC_SPECIALIST_RELEASES[id];
    if (!accepted) return false;
    if (hub.canonical_state_url !== accepted.canonical_state_url) return false;
    if (hub.snapshot_version !== accepted.snapshot_version) return false;
    if (hub.fingerprint !== accepted.fingerprint) return false;
    if (hub.certified_release_sha && hub.certified_release_sha !== accepted.certified_release_sha) return false;
    if (hub.publication_status !== 'live') return false;
    const verified = verification.hubs.find((row) => row.hub_id === hub.hub_id);
    if (!verified) return false;
    const page = evaluateNcPageEvidence(
      { ...verified, url: verified.url ?? verified.expected_url ?? hub.canonical_state_url },
      accepted.canonical_state_url,
    );
    if (!page.ok) return false;
  }
  return true;
}

const NC_CITY_RE =
  /\b(charlotte|raleigh|durham|greensboro|winston-salem|asheville|wilmington|fayetteville)\b/i;
const NC_CITY_DETECT_RE =
  /\b(charlotte|raleigh|durham|greensboro|winston-salem|asheville|wilmington|fayetteville|cary)\b/i;
const NC_COUNTY_RE = /\b(mecklenburg|wake|guilford|forsyth|buncombe)\s+county\b/i;

export function detectNcCity(query: string): string | undefined {
  const city = query.match(NC_CITY_DETECT_RE);
  if (!city) return undefined;
  const raw = city[1].toLowerCase();
  return raw.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function detectRequestedInsuranceProducts(query: string): string[] {
  const out: string[] = [];
  if (/\bhomeowners?\b|\bhome insurance\b/i.test(query)) out.push('homeowners');
  if (/\bauto(?:mobile)?\b|\bcar insurance\b/i.test(query)) out.push('auto');
  return out;
}

export function queryLooksLikeNorthCarolina(query: string): boolean {
  if (/\bnorth carolina\b/i.test(query)) return true;
  if (NC_CITY_RE.test(query) || NC_COUNTY_RE.test(query)) return true;
  if (/\b(nclbgc|nccob|ncuc|dhsr|ncdoi|nchfa|ncbee?c|phfs)\b/i.test(query)) return true;
  if (/\bin nc\b/i.test(query) || /\bNC\s+(registered|contractor|mover|lender|insur|senior|advis|broker|nursing|mortgage|securities)/.test(query)) {
    return true;
  }
  return false;
}

export const NC_SEMANTIC_GUARDRAILS = {
  missing_ne_zero: 'Unavailable official evidence is unknown, not zero.',
  search_only_ne_zero: 'Search-only official evidence is unknown, not zero.',
  no_trust_score: 'AskTrustHub does not publish a Trust Score.',
  no_ranking: 'AskTrustHub does not publish paid rankings or best/safest/worst conclusions.',
  charlotte_deferred:
    'Charlotte, Raleigh, Durham, Mecklenburg County, Wake County, and other city/county names stay on statewide North Carolina research. Local North Carolina datasets and Ask city or county routes are not published.',
  contractor_search_only:
    'Current NCLBGC statewide roster is OPEN_SEARCH_ONLY. Do not use 38,523 mixed historical records as an active-contractor census. The $40,000 project-value threshold is not every construction job. Unlimited is a limitation, not quality. Electrical and PHFS boards are not NCLBGC.',
  move_ncuc_ne_fmcsa:
    '362 NCUC C-number identities are a September 8, 2026 monthly list snapshot, not currently active movers and not FMCSA interstate authority. C-number is not T-number. Exact NCUC→USDOT and NCUC→MC bridges remain 0. Preserve both the announced 361 and parsed 362 C identities.',
  senior_classes_separate:
    '568 Adult Care Home licenses are not 515 Family Care Homes and not 423 Nursing Homes. Do not add ACH + FCH + NH + Home Health + Home Care + Hospice + PACE + CCRC. NC DHSR Star Rating is government regulatory evidence, not a TrustHub ranking or AggregateRating. Exact state↔CMS bridges remain 0.',
  lender_hmda_ne_lender:
    '484,454 HMDA 2025 applications for North Carolina properties are not lenders. 640 current NCCOB Mortgage Lender rows is a license-class grain, not all lending institutions. Do not use 1,380 mixed entities, 24,612 MLO matching records, 1,121 LEIs, or 91 FDIC institutions as the lender census. NCCOB license is not NMLS.',
  insurance_company_ne_agency:
    '2,874 NCDOI Licensing Action rows are a mixed catalog, not providers, complaints, or unique matters. Company, agency, and producer bulk remain OPEN_SEARCH_ONLY. 199 homeowners company market-share rows are not homeowners agency evidence. SQA-009: homeowners/auto agency queries must not become the generic North Carolina agency census.',
  investor_lenses_separate:
    '687 SOS IA firm CRDs are not 701 IAPD APPROVED state-IA firms, not 33 ERA, not 3,704 notice filings, and not 325 principal-office firms. Do not add them. Principal office is not registration. Summary cease and desist is not a final finding. Firm CRD is not person CRD.',
  sqa009_product_intent:
    'Homeowners and auto are consumer products, not official agency lines of authority in this extract. Those queries must not silently execute as the unfiltered North Carolina agency census.',
} as const;

export function ncCaveatForHub(id: SpecialistHubId): string {
  switch (id) {
    case 'contractor':
      return NC_SEMANTIC_GUARDRAILS.contractor_search_only;
    case 'move':
      return NC_SEMANTIC_GUARDRAILS.move_ncuc_ne_fmcsa;
    case 'senior':
      return NC_SEMANTIC_GUARDRAILS.senior_classes_separate;
    case 'lender':
      return NC_SEMANTIC_GUARDRAILS.lender_hmda_ne_lender;
    case 'insurance':
      return NC_SEMANTIC_GUARDRAILS.insurance_company_ne_agency;
    case 'investor':
      return NC_SEMANTIC_GUARDRAILS.investor_lenses_separate;
    default:
      return NC_SEMANTIC_GUARDRAILS.missing_ne_zero;
  }
}

export type NcRoute = {
  hubId: SpecialistHubId;
  stateCode: 'NC';
  intentFamily: string;
  destination: string;
  caveat: string;
  requestedProduct?: string[];
};

function earlierStateNamed(query: string, other: RegExp): boolean {
  const nc = query.search(/\bnorth carolina\b/i);
  const otherAt = query.search(other);
  if (otherAt < 0) return false;
  if (nc < 0) return true;
  return otherAt < nc;
}

export function classifyNcHub(query: string): SpecialistHubId | undefined {
  const q = query.toLowerCase();
  if (
    /\b(mover|movers|moving|household[- ]goods|usdot|fmcsa|hhg|ncuc|intrastate movers?|interstate movers?|interstate carriers?|moving rates?)\b/.test(
      q,
    )
  ) {
    return 'move';
  }
  if (
    /\b(mortgage|hmda|nmls|homebuyer|mlo|lender company|mortgage lender|mortgage broker|nccob|mosr|nchfa)\b/.test(q) &&
    !/\badvis|securit|iard|ria\b/.test(q)
  ) {
    return 'lender';
  }
  if (
    /\b(nursing homes?|adult care|family care|assisted[- ]living|home[- ]health|home care|hospice|pace(?:s| program)?|ccrc|senior[- ]?(care|resources?|housing)|dhsr|star rating)\b/.test(
      q,
    )
  ) {
    return 'senior';
  }
  if (
    /\b(insurance|insurer|naic|producer|agency roster|market conduct|financial exam|receivership|ncdoi|licensing action)\b/.test(q) ||
    (/\bagenc/i.test(q) && /\b(homeowners?|auto(?:mobile)?)\b/.test(q))
  ) {
    return 'insurance';
  }
  if (/\b(contractors?|nclbgc|general contractor|roofing contractor|unlicensed injunction|debar)/.test(q)) {
    return 'contractor';
  }
  if (
    /investment advis(?:er|or)s?|state[- ]registered advis(?:er|or)s?|\badvis(?:er|or)s?\b|form adv|\biard\b|\bcrd\b|\brias?\b|\bera\b|principal office|notice[- ]fil|securities agent|cease and desist/.test(
      q,
    )
  ) {
    return 'investor';
  }
  return undefined;
}

export function routeNcAsk(query: string): NcRoute | undefined {
  if (earlierStateNamed(query, /\bpennsylvania\b/i)) return undefined;
  if (earlierStateNamed(query, /\bnew york\b/i)) return undefined;
  if (earlierStateNamed(query, /\billinois\b/i)) return undefined;
  if (earlierStateNamed(query, /\bcolorado\b/i)) return undefined;
  if (earlierStateNamed(query, /\bvirginia\b/i)) return undefined;
  if (earlierStateNamed(query, /\bcalifornia\b/i)) return undefined;
  if (earlierStateNamed(query, /\boregon\b/i)) return undefined;
  if (earlierStateNamed(query, /\bwashington\b/i)) return undefined;
  if (!queryLooksLikeNorthCarolina(query)) return undefined;
  const hubId = classifyNcHub(query);
  if (!hubId) return undefined;
  const requestedProduct = hubId === 'insurance' ? detectRequestedInsuranceProducts(query) : undefined;
  const caveat =
    requestedProduct && requestedProduct.length
      ? `${NC_SEMANTIC_GUARDRAILS.sqa009_product_intent} Requested product: ${requestedProduct.join(', ')}.`
      : ncCaveatForHub(hubId);
  return {
    hubId,
    stateCode: 'NC',
    intentFamily: hubId,
    destination: ncSpecialistUrl(hubId),
    caveat,
    requestedProduct: requestedProduct?.length ? requestedProduct : undefined,
  };
}

export function ncConciergeContext(): string {
  const live = listNcHubs().filter((h) => h.publication_status === 'live');
  const cards = listNcHubs()
    .map((h) => `- ${NETWORK_PUBLIC_NAMES[h.hub_id as SpecialistHubId]} (${h.canonical_state_url}): ${h.coverage_summary}`)
    .join('\n');
  const gate = ncReleaseGatePassed();
  return `## North Carolina network context
AskTrustHub /north-carolina is the network gateway. Specialist /north-carolina pages own detailed evidence.
North Carolina research is STATE LEVEL ONLY. Charlotte, Raleigh, Durham, Mecklenburg, Wake, and other city/county names stay on specialist /north-carolina with statewide limitations. Do not invent North Carolina city or county Ask routes. Local North Carolina acquisition is not started.
Compact planner vocabulary: Contractor NCLBGC/$40k threshold/classification/limitation/qualifier/discipline. Move NCUC/C-number/T-number/tariff/intrastate vs FMCSA. Senior Adult Care Home/Family Care Home/Nursing Home/Home Care/Home Health/Hospice/DHSR Star Rating/FID/CCN/PACE/CCRC. Lender NCCOB/NCCOB license/NMLS/HMDA/CFPB/MOSR/MLO/mortgage enforcement. Insurance NCDOI/NAIC/NPN/business entity/producer/licensing action/market exam/financial exam/receivership. Investor NC SOS Securities/CRD/IA/IAR/ERA/notice filing/IAPD/administrative vs criminal action.
Hub intent remains primary. Do not route every North Carolina question to Contractor.
Live NC specialist pages: ${live.map((h) => h.hub_id).join(', ') || 'none'}.
Six-hub specialist publication gate: ${gate ? 'passed' : 'failed'}. Blocker: ${NC_PUBLICATION_MANIFEST.release_gate.blocker ?? 'none'}.
Do not invent North Carolina license, roster, or count facts. Route to the specialist page.
Do not copy Pennsylvania, Oregon, Illinois, New York, Virginia, Colorado, or other-state metrics into North Carolina.
Do not treat 38,523 mixed NCLBGC records as active contractors.
Do not treat 362 C-numbers as currently active movers or as FMCSA authority.
Do not add Adult Care + Family Care + Nursing Home + Home Health + Hospice into one senior-care total.
Do not treat 484,454 HMDA applications as lenders, or 1,380 mixed NCCOB entities as lenders.
Do not treat 2,874 Licensing Action rows as providers. SQA-009: homeowners/auto agency queries are not generic NC agencies.
Do not add 687 SOS IA + 701 IAPD APPROVED + 33 ERA + 3,704 notice into one adviser total.
There is no combined North Carolina provider or Trust Hub record total.
${cards}
Guardrails:
- ${NC_SEMANTIC_GUARDRAILS.contractor_search_only}
- ${NC_SEMANTIC_GUARDRAILS.move_ncuc_ne_fmcsa}
- ${NC_SEMANTIC_GUARDRAILS.senior_classes_separate}
- ${NC_SEMANTIC_GUARDRAILS.lender_hmda_ne_lender}
- ${NC_SEMANTIC_GUARDRAILS.insurance_company_ne_agency}
- ${NC_SEMANTIC_GUARDRAILS.investor_lenses_separate}
- Missing, restricted, and search-only evidence is unknown, not zero. No Trust Score. No paid ranking. Charlotte/Raleigh local routes are not started.`;
}
