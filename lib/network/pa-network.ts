import { createHash } from 'node:crypto';
import manifestJson from '../../data/network/pennsylvania-publication-manifest.json' with { type: 'json' };
import verificationJson from '../../data/network/pennsylvania-verification.json' with { type: 'json' };
import type { SpecialistHubId } from './registry.ts';
import { CANONICAL_ORIGINS, NETWORK_PUBLIC_NAMES } from './registry.ts';
import { tennesseeNamedFirst } from './tn-network.ts';

export const PA_NETWORK_CONTRACT = 'ath-pa-network-release-v1' as const;

export const REQUIRED_PA_HUB_IDS = [
  'contractor',
  'move',
  'senior',
  'lender',
  'insurance',
  'investor',
] as const satisfies readonly SpecialistHubId[];

export const PA_FINGERPRINT_METHOD =
  'Accepted specialist snapshot artifact at the certified repository SHA. Public HTML confirms the intended state page; the fingerprint is not recomputed from HTML.';

export const ACCEPTED_PA_SPECIALIST_RELEASES: Record<
  SpecialistHubId,
  { snapshot_version: string; fingerprint: string; certified_release_sha: string; canonical_state_url: string }
> = {
  contractor: {
    snapshot_version: 'contractor-pa-state-intel-v1',
    fingerprint: 'ad8e95e11e486c9c124b7da270d6fa38808fa4ab0be5d2008167283728324e9a',
    certified_release_sha: '6d4156791360d74c0f22054b8e445c335c999248',
    canonical_state_url: 'https://www.contractortrusthub.com/pennsylvania',
  },
  move: {
    snapshot_version: 'move-pa-state-intel-v1',
    fingerprint: '1f8b97db78233d0a89fcab02bb92c8ff51633ba69da993ecc6eea79c985d88b3',
    certified_release_sha: '081cbe4633beb9008e2d2cac31185920dfcbef1e',
    canonical_state_url: 'https://www.movetrusthub.com/pennsylvania',
  },
  senior: {
    snapshot_version: 'senior-pa-state-intel-v1',
    fingerprint: '460c6865eb7c3fdb040c95768f42e8ef90009fe9f6f80571c3268d5944ae7fed',
    certified_release_sha: '7c634a44cef433de340e86f862fb8181a6838daf',
    canonical_state_url: 'https://www.seniortrusthub.com/pennsylvania',
  },
  lender: {
    snapshot_version: 'lender-pa-state-intel-v1',
    fingerprint: '32c420aaf3dd2672a6b73774df8f567ddf6fdb08de9a29b9d95e5f948fe698c2',
    certified_release_sha: '5155a85e40254f2b05a72c3b92daff2fcba1a167',
    canonical_state_url: 'https://www.lendertrusthub.com/pennsylvania',
  },
  insurance: {
    snapshot_version: 'insurance-pa-state-intel-v1',
    fingerprint: '530c42b9bb39e86bf76160594c5b37a6b105a6742e4a11b7c364a828e2294239',
    certified_release_sha: 'f479b9bac0f3561c17b53bdc18bc1d6125e2edcc',
    canonical_state_url: 'https://www.insurancetrusthub.com/pennsylvania',
  },
  investor: {
    snapshot_version: 'investor-pa-state-intel-v1',
    fingerprint: '80420690c44566280ed43dd31e5a7976c182dbf473594d721d07ee3cfde5aad0',
    certified_release_sha: 'd7d574f98786fbfc6de22fb3a6f5eb83d466da7a',
    canonical_state_url: 'https://www.investortrusthub.com/pennsylvania',
  },
};

export type PaHubManifest = (typeof manifestJson)['hubs'][number];

export const PA_PUBLICATION_MANIFEST = manifestJson;
export const PA_VERIFICATION = verificationJson;

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

export function paPublicationSemanticFingerprint(
  manifest: typeof PA_PUBLICATION_MANIFEST = PA_PUBLICATION_MANIFEST,
): string {
  return createHash('sha256').update(canonicalJson(manifest)).digest('hex');
}

export const PA_PUBLICATION_FINGERPRINT = paPublicationSemanticFingerprint();

export function listPaHubs(): PaHubManifest[] {
  return PA_PUBLICATION_MANIFEST.hubs;
}

export function paHubById(id: SpecialistHubId): PaHubManifest | undefined {
  return PA_PUBLICATION_MANIFEST.hubs.find((h) => h.hub_id === id);
}

export function paSpecialistUrl(id: SpecialistHubId): string {
  return paHubById(id)?.canonical_state_url ?? `${CANONICAL_ORIGINS[id]}/pennsylvania`;
}

export type PaGateHub = {
  hub_id: string;
  canonical_state_url?: string;
  snapshot_version?: string;
  fingerprint?: string;
  certified_release_sha?: string;
  publication_status?: string;
};

export type PaGateManifest = {
  hubs: PaGateHub[];
  scope?: string;
  hardcoded_philadelphia_routes?: boolean;
  hardcoded_pittsburgh_routes?: boolean;
};

export type PaPageEvidence = {
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

export type PaGateVerification = {
  release_gate_passed?: boolean;
  missing?: string[];
  hubs: PaPageEvidence[];
};

export function paSixHubIdsComplete(hubs: PaGateHub[] = listPaHubs()): boolean {
  if (!Array.isArray(hubs) || hubs.length !== REQUIRED_PA_HUB_IDS.length) return false;
  const ids = hubs.map((hub) => hub.hub_id);
  if (new Set(ids).size !== REQUIRED_PA_HUB_IDS.length) return false;
  return REQUIRED_PA_HUB_IDS.every((id) => ids.includes(id));
}

export function normalizePaPublicUrl(value: string | null | undefined): string | null {
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

export function urlsAreSamePaPage(actual: string | null | undefined, expected: string): boolean {
  const left = normalizePaPublicUrl(actual);
  const right = normalizePaPublicUrl(expected);
  return Boolean(left && right && left === right);
}

export function evaluatePaPageEvidence(
  probe: PaPageEvidence,
  expectedUrl: string,
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (probe.http_status !== 200) reasons.push('http_status');
  if (probe.sso !== false) reasons.push('sso');
  const finalUrl = probe.final_url ?? probe.url ?? null;
  if (!urlsAreSamePaPage(finalUrl, expectedUrl)) reasons.push('final_url');
  if (!urlsAreSamePaPage(probe.canonical, expectedUrl)) reasons.push('canonical');
  const robots = `${probe.robots ?? ''} ${probe.x_robots_tag ?? ''}`;
  if (/noindex/i.test(robots) || probe.not_noindex === false) reasons.push('noindex');
  if (probe.headline_ok !== true) reasons.push('headline');
  if (probe.intended_intelligence_page === false) reasons.push('not_intelligence_page');
  const looksSoft404 = /page not found|\b404\b/i.test(`${probe.canonical ?? ''} ${probe.final_url ?? ''}`);
  if (looksSoft404) reasons.push('soft_404');
  return { ok: reasons.length === 0, reasons };
}

export function paReleaseGatePassed(
  manifest: PaGateManifest = PA_PUBLICATION_MANIFEST,
  verification: PaGateVerification = PA_VERIFICATION,
): boolean {
  if (!paSixHubIdsComplete(manifest.hubs)) return false;
  if (manifest.scope !== 'STATE_LEVEL_ONLY') return false;
  if (manifest.hardcoded_philadelphia_routes !== false) return false;
  if (manifest.hardcoded_pittsburgh_routes !== false) return false;
  if (!Array.isArray(verification.hubs) || verification.hubs.length !== REQUIRED_PA_HUB_IDS.length) return false;
  const verifiedIds = verification.hubs.map((row) => row.hub_id).filter((id): id is string => Boolean(id));
  if (verifiedIds.length !== REQUIRED_PA_HUB_IDS.length || new Set(verifiedIds).size !== REQUIRED_PA_HUB_IDS.length) {
    return false;
  }
  if (!REQUIRED_PA_HUB_IDS.every((id) => verifiedIds.includes(id))) return false;
  if ((verification.missing ?? []).length !== 0) return false;
  for (const hub of manifest.hubs) {
    const id = hub.hub_id as SpecialistHubId;
    const accepted = ACCEPTED_PA_SPECIALIST_RELEASES[id];
    if (!accepted) return false;
    if (hub.canonical_state_url !== accepted.canonical_state_url) return false;
    if (hub.snapshot_version !== accepted.snapshot_version) return false;
    if (hub.fingerprint !== accepted.fingerprint) return false;
    if (hub.certified_release_sha && hub.certified_release_sha !== accepted.certified_release_sha) return false;
    if (hub.publication_status !== 'live') return false;
    const verified = verification.hubs.find((row) => row.hub_id === hub.hub_id);
    if (!verified) return false;
    const page = evaluatePaPageEvidence(
      { ...verified, url: verified.url ?? verified.expected_url ?? hub.canonical_state_url },
      accepted.canonical_state_url,
    );
    if (!page.ok) return false;
  }
  return true;
}

// Unambiguous Pennsylvania city names used as a standalone "looks like PA" geography
// signal. Ambiguous common English words (e.g. "reading") are intentionally excluded
// here so that ordinary queries like "reading reviews" are not misclassified as PA.
const PA_CITY_RE =
  /\b(philadelphia|pittsburgh|harrisburg|erie|scranton|allentown|lancaster)\b/i;
// Broader city detection (includes ambiguous tokens like "reading") used only to name
// the city once Pennsylvania has already been established from other context.
const PA_CITY_DETECT_RE =
  /\b(philadelphia|pittsburgh|harrisburg|erie|scranton|allentown|reading|lancaster)\b/i;
const PA_COUNTY_RE = /\b(allegheny|montgomery|bucks|delaware|chester)\s+county\b/i;

export function detectPaCity(query: string): string | undefined {
  const city = query.match(PA_CITY_DETECT_RE);
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

export function queryLooksLikePennsylvania(query: string): boolean {
  if (/\bpennsylvania\b/i.test(query)) return true;
  if (PA_CITY_RE.test(query) || PA_COUNTY_RE.test(query)) return true;
  if (/\b(hicpa|pa\s+hic|pa\s+puc|pid\b|dobs\b|phfa\b)\b/i.test(query)) return true;
  if (/\bin pa\b/i.test(query) || /\bPA\s+(contractor|mover|lender|insur|senior|advis|broker|nursing|hic)/i.test(query)) {
    return true;
  }
  return false;
}

export const PA_SEMANTIC_GUARDRAILS = {
  missing_ne_zero: 'Unavailable official evidence is unknown, not zero.',
  search_only_ne_zero: 'Search-only official evidence is unknown, not zero.',
  no_trust_score: 'AskTrustHub does not publish a Trust Score.',
  no_ranking: 'AskTrustHub does not publish paid rankings or best/safest/worst conclusions.',
  philadelphia_deferred:
    'Philadelphia, Pittsburgh, Allegheny County, and other city/county names stay on statewide Pennsylvania research. Local Pennsylvania datasets and Ask city or county routes are not published.',
  contractor_no_universal_gc:
    'Pennsylvania has no universal statewide general-contractor license. HICPA home-improvement registration is OPEN_SEARCH_ONLY (counts null, not zero). 283 asbestos and 148 lead contractor CERT IDs are specialty credentials, not HICPA and not a combined contractor census.',
  move_puc_ne_fmcsa:
    '267 distinct PA PUC Utility Codes are intrastate Household Goods authority, not FMCSA interstate authority. Utility Code is not automatically Carrier ID. A docket is not an adverse finding. Exact PUC→USDOT and PUC→MC crosswalks remain 0.',
  senior_classes_separate:
    '1,202 exact PA state→CMS bridges do not make nursing homes, Home Health, Home Care, Hospice, PCH, ALR, or LIFE/PACE one facilities total. 659 nursing-home rows matching 659 Home Health rows is coincidence. PCH/ALR current rosters remain OPEN_SEARCH_ONLY.',
  lender_hmda_ne_lender:
    '444,887 HMDA 2025 applications for Pennsylvania properties are not lenders. Use the county-market 444,887 scalar, not the 441,180 LEI-cell total. Current NMLS company, broker, servicer, and MLO rosters remain OPEN_SEARCH_ONLY. Do not use 994 LEIs, 626 Open Data lender rows, FDIC 110, or PHFA 102 names as the NMLS census.',
  insurance_company_ne_agency:
    '1,722 PID licensed-company NAIC identities are not agencies or producers. Agency and producer bulk remain OPEN_SEARCH_ONLY. Property and Allied Lines is not homeowners. Auto Liability is not a consumer auto-agency cohort. PID Complaint Index is not a Trust Score. SQA-009: homeowners/auto agency queries must not become the generic Pennsylvania agency census.',
  investor_lenses_separate:
    '864 approved Pennsylvania state-IA CRDs are not 99 ERA firms, not 3,411 notice filings, and not the 623 principal-office overlay. Do not add them. Principal office is not registration. Notice filing is not state IA. ERA is not an RIA. Mixed DoBS documents are not an IA disciplinary census.',
  sqa009_product_intent:
    'Homeowners and auto are consumer products, not official agency lines of authority in this extract. Those queries must not silently execute as the unfiltered Pennsylvania agency census.',
} as const;

export function paCaveatForHub(id: SpecialistHubId): string {
  switch (id) {
    case 'contractor':
      return PA_SEMANTIC_GUARDRAILS.contractor_no_universal_gc;
    case 'move':
      return PA_SEMANTIC_GUARDRAILS.move_puc_ne_fmcsa;
    case 'senior':
      return PA_SEMANTIC_GUARDRAILS.senior_classes_separate;
    case 'lender':
      return PA_SEMANTIC_GUARDRAILS.lender_hmda_ne_lender;
    case 'insurance':
      return PA_SEMANTIC_GUARDRAILS.insurance_company_ne_agency;
    case 'investor':
      return PA_SEMANTIC_GUARDRAILS.investor_lenses_separate;
    default:
      return PA_SEMANTIC_GUARDRAILS.missing_ne_zero;
  }
}

export type PaRoute = {
  hubId: SpecialistHubId;
  stateCode: 'PA';
  intentFamily: string;
  destination: string;
  caveat: string;
  requestedProduct?: string[];
};

function earlierStateNamed(query: string, other: RegExp): boolean {
  const pa = query.search(/\bpennsylvania\b/i);
  const otherAt = query.search(other);
  if (otherAt < 0) return false;
  if (pa < 0) return true;
  return otherAt < pa;
}

export function classifyPaHub(query: string): SpecialistHubId | undefined {
  const q = query.toLowerCase();
  if (
    /\b(mover|movers|moving|household[- ]goods|usdot|fmcsa|hhg|puc|intrastate movers?|interstate movers?|interstate carriers?)\b/.test(
      q,
    )
  ) {
    return 'move';
  }
  if (
    /\b(mortgage|hmda|nmls|homebuyer|mlo|lender company|mortgage lender|mortgage broker|phfa|dobs)\b/.test(q) &&
    !/\badvis|securit|iard|ria\b/.test(q)
  ) {
    return 'lender';
  }
  if (
    /\b(nursing homes?|personal care|assisted[- ]living|home[- ]health|home care|hospice|life\/pace|pace program|senior[- ]?(care|resources?|housing)|pch|alr)\b/.test(
      q,
    )
  ) {
    return 'senior';
  }
  if (
    /\b(insurance|insurer|naic|producer|agency roster|market conduct|complaint index|pid)\b/.test(q) ||
    (/\bagenc/i.test(q) && /\b(homeowners?|auto(?:mobile)?)\b/.test(q))
  ) {
    return 'insurance';
  }
  if (/\b(contractors?|hicpa|home improvement|asbestos|lead contractor|debar)/.test(q)) {
    return 'contractor';
  }
  if (
    /investment advis(?:er|or)s?|state[- ]registered advis(?:er|or)s?|\badvis(?:er|or)s?\b|form adv|\biard\b|\bcrd\b|\brias?\b|\bera\b|principal office|notice[- ]fil/.test(
      q,
    )
  ) {
    return 'investor';
  }
  return undefined;
}

export function routePaAsk(query: string): PaRoute | undefined {
  if (tennesseeNamedFirst(query)) return undefined; // ATH-TN-001: Tennessee named first wins
  if (earlierStateNamed(query, /\bnew york\b/i)) return undefined;
  if (earlierStateNamed(query, /\billinois\b/i)) return undefined;
  if (earlierStateNamed(query, /\bcolorado\b/i)) return undefined;
  if (earlierStateNamed(query, /\bvirginia\b/i)) return undefined;
  if (earlierStateNamed(query, /\bcalifornia\b/i)) return undefined;
  if (earlierStateNamed(query, /\boregon\b/i)) return undefined;
  if (earlierStateNamed(query, /\bwashington\b/i)) return undefined;
  if (!queryLooksLikePennsylvania(query)) return undefined;
  const hubId = classifyPaHub(query);
  if (!hubId) return undefined;
  const requestedProduct = hubId === 'insurance' ? detectRequestedInsuranceProducts(query) : undefined;
  const caveat =
    requestedProduct && requestedProduct.length
      ? `${PA_SEMANTIC_GUARDRAILS.sqa009_product_intent} Requested product: ${requestedProduct.join(', ')}.`
      : paCaveatForHub(hubId);
  return {
    hubId,
    stateCode: 'PA',
    intentFamily: hubId,
    destination: paSpecialistUrl(hubId),
    caveat,
    requestedProduct: requestedProduct?.length ? requestedProduct : undefined,
  };
}

export function paConciergeContext(): string {
  const live = listPaHubs().filter((h) => h.publication_status === 'live');
  const cards = listPaHubs()
    .map((h) => `- ${NETWORK_PUBLIC_NAMES[h.hub_id as SpecialistHubId]} (${h.canonical_state_url}): ${h.coverage_summary}`)
    .join('\n');
  const gate = paReleaseGatePassed();
  return `## Pennsylvania network context
AskTrustHub /pennsylvania is the network gateway. Specialist /pennsylvania pages own detailed evidence.
Pennsylvania research is STATE LEVEL ONLY. Philadelphia, Pittsburgh, Allegheny, Montgomery, and other city/county names stay on specialist /pennsylvania with statewide limitations. Do not invent Pennsylvania city or county Ask routes. Local Pennsylvania acquisition is not started.
Compact planner vocabulary: Contractor HICPA/asbestos/lead/debarment/no universal GC license. Move PA PUC HHG/Utility Code/Carrier ID/intrastate vs FMCSA. Senior PCH/ALR/nursing home/Home Health/Home Care/Hospice/CCN/LIFE-PACE. Lender DoBS/NMLS/HMDA/LEI/CFPB/PHFA. Insurance PID/NAIC/NPN/licensed company/complaint/enforcement/market conduct/financial exam/surplus lines. Investor DoBS Securities/CRD/state IA/ERA/notice/IAPD.
Hub intent remains primary. Do not route every Pennsylvania question to Contractor.
Live PA specialist pages: ${live.map((h) => h.hub_id).join(', ') || 'none'}.
Six-hub specialist publication gate: ${gate ? 'passed' : 'failed'}. Blocker: ${PA_PUBLICATION_MANIFEST.release_gate.blocker ?? 'none'}.
Do not invent Pennsylvania license, roster, or count facts. Route to the specialist page.
Do not copy Oregon, Illinois, New York, Virginia, Colorado, or other-state metrics into Pennsylvania.
Do not treat HICPA search-only as a universal GC license.
Do not treat 267 Utility Codes as FMCSA authority.
Do not add nursing homes + Home Health + Home Care + Hospice + PCH into one senior-care total.
Do not treat 444,887 HMDA applications as lenders.
Do not treat 1,722 NAIC identities as agencies or producers.
Do not add 864 + 99 + 3,411 + 623 into one adviser total.
There is no combined Pennsylvania provider or Trust Hub record total.
${cards}
Guardrails:
- ${PA_SEMANTIC_GUARDRAILS.contractor_no_universal_gc}
- ${PA_SEMANTIC_GUARDRAILS.move_puc_ne_fmcsa}
- ${PA_SEMANTIC_GUARDRAILS.senior_classes_separate}
- ${PA_SEMANTIC_GUARDRAILS.lender_hmda_ne_lender}
- ${PA_SEMANTIC_GUARDRAILS.insurance_company_ne_agency}
- ${PA_SEMANTIC_GUARDRAILS.investor_lenses_separate}
- Missing, restricted, and search-only evidence is unknown, not zero. No Trust Score. No paid ranking. Philadelphia/Pittsburgh local routes are not started.`;
}
