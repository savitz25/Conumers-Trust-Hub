import { createHash } from 'node:crypto';
import manifestJson from '../../data/network/oregon-publication-manifest.json' with { type: 'json' };
import verificationJson from '../../data/network/oregon-verification.json' with { type: 'json' };
import type { SpecialistHubId } from './registry.ts';
import { CANONICAL_ORIGINS, NETWORK_PUBLIC_NAMES } from './registry.ts';
import { tennesseeNamedFirst } from './tn-network.ts';

export const OR_NETWORK_CONTRACT = 'ath-or-network-release-v1' as const;

export const REQUIRED_OR_HUB_IDS = [
  'contractor',
  'move',
  'senior',
  'lender',
  'insurance',
  'investor',
] as const satisfies readonly SpecialistHubId[];

export const OR_FINGERPRINT_METHOD =
  'Accepted specialist snapshot artifact at the certified repository SHA. Public HTML confirms the intended state page; the fingerprint is not recomputed from HTML.';

export const ACCEPTED_OR_SPECIALIST_RELEASES: Record<
  SpecialistHubId,
  { snapshot_version: string; fingerprint: string; certified_release_sha: string; canonical_state_url: string }
> = {
  contractor: {
    snapshot_version: 'contractor-or-state-intel-v1',
    fingerprint: 'b09a4da9e9566d52ad8b8ca6b2ce2f011e797dd5e6dd4ec308dfb3019c937fce',
    certified_release_sha: '9c45a5ad5fd8fc846f57f02009cbae6060d358a9',
    canonical_state_url: 'https://www.contractortrusthub.com/oregon',
  },
  move: {
    snapshot_version: 'move-or-state-intel-v1',
    fingerprint: '88315442cd5207330e94ded88c4eb882ef4694817737479e6f26153100ec8423',
    certified_release_sha: 'ecafe63f310b79ca764e35ae956c33a521b09626',
    canonical_state_url: 'https://www.movetrusthub.com/oregon',
  },
  senior: {
    snapshot_version: 'senior-or-state-intel-v1',
    fingerprint: '1041ed21b2647cb670a0b5056458df04d8272e000a5206bb22030d70d3de0cbc',
    certified_release_sha: 'e7fa4cf02257411f06d376cf8e255339e1dde976',
    canonical_state_url: 'https://www.seniortrusthub.com/oregon',
  },
  lender: {
    snapshot_version: 'lender-or-state-intel-v1',
    fingerprint: '8e67c1dced6a6b6e39d291899722baa3d5c4dae91f156b8239f37c0bbc269d66',
    certified_release_sha: '471cb1815333d37f13dfb958d49842001e8d6ef0',
    canonical_state_url: 'https://www.lendertrusthub.com/oregon',
  },
  insurance: {
    snapshot_version: 'insurance-or-state-intel-v1',
    fingerprint: 'df48d2f563f81a90c12929a3eb7eb1e2e403e395e75913a595d671959dd00f3a',
    certified_release_sha: 'f807dcc489fc715d61b5d83f6c72bf286c6de1e6',
    canonical_state_url: 'https://www.insurancetrusthub.com/oregon',
  },
  investor: {
    snapshot_version: 'investor-or-state-intel-v1',
    fingerprint: 'c14319b60b458f87c0243af59c6119f7c914eeb442da2ee62bac4ac279c56443',
    certified_release_sha: '600e29f6d0f0b4c57e09207eaca93c609580f842',
    canonical_state_url: 'https://www.investortrusthub.com/oregon',
  },
};

export type OrHubManifest = (typeof manifestJson)['hubs'][number];

export const OR_PUBLICATION_MANIFEST = manifestJson;
export const OR_VERIFICATION = verificationJson;

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

export function orPublicationSemanticFingerprint(
  manifest: typeof OR_PUBLICATION_MANIFEST = OR_PUBLICATION_MANIFEST,
): string {
  return createHash('sha256').update(canonicalJson(manifest)).digest('hex');
}

export const OR_PUBLICATION_FINGERPRINT = orPublicationSemanticFingerprint();

export function listOrHubs(): OrHubManifest[] {
  return OR_PUBLICATION_MANIFEST.hubs;
}

export function orHubById(id: SpecialistHubId): OrHubManifest | undefined {
  return OR_PUBLICATION_MANIFEST.hubs.find((h) => h.hub_id === id);
}

export function orSpecialistUrl(id: SpecialistHubId): string {
  return orHubById(id)?.canonical_state_url ?? `${CANONICAL_ORIGINS[id]}/oregon`;
}

export type OrGateHub = {
  hub_id: string;
  canonical_state_url?: string;
  snapshot_version?: string;
  fingerprint?: string;
  certified_release_sha?: string;
  publication_status?: string;
};

export type OrGateManifest = {
  hubs: OrGateHub[];
  scope?: string;
  hardcoded_portland_routes?: boolean;
  hardcoded_multnomah_routes?: boolean;
};

export type OrPageEvidence = {
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

export type OrGateVerification = {
  release_gate_passed?: boolean;
  missing?: string[];
  hubs: OrPageEvidence[];
};

export function orSixHubIdsComplete(hubs: OrGateHub[] = listOrHubs()): boolean {
  if (!Array.isArray(hubs) || hubs.length !== REQUIRED_OR_HUB_IDS.length) return false;
  const ids = hubs.map((hub) => hub.hub_id);
  if (new Set(ids).size !== REQUIRED_OR_HUB_IDS.length) return false;
  return REQUIRED_OR_HUB_IDS.every((id) => ids.includes(id));
}

export function normalizeOrPublicUrl(value: string | null | undefined): string | null {
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

export function urlsAreSameOrPage(actual: string | null | undefined, expected: string): boolean {
  const left = normalizeOrPublicUrl(actual);
  const right = normalizeOrPublicUrl(expected);
  return Boolean(left && right && left === right);
}

export function evaluateOrPageEvidence(
  probe: OrPageEvidence,
  expectedUrl: string,
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (probe.http_status !== 200) reasons.push('http_status');
  if (probe.sso !== false) reasons.push('sso');
  const finalUrl = probe.final_url ?? probe.url ?? null;
  if (!urlsAreSameOrPage(finalUrl, expectedUrl)) reasons.push('final_url');
  if (!urlsAreSameOrPage(probe.canonical, expectedUrl)) reasons.push('canonical');
  const robots = `${probe.robots ?? ''} ${probe.x_robots_tag ?? ''}`;
  if (/noindex/i.test(robots) || probe.not_noindex === false) reasons.push('noindex');
  if (probe.headline_ok !== true) reasons.push('headline');
  if (probe.intended_intelligence_page === false) reasons.push('not_intelligence_page');
  const looksSoft404 = /page not found|\b404\b/i.test(`${probe.canonical ?? ''} ${probe.final_url ?? ''}`);
  if (looksSoft404) reasons.push('soft_404');
  return { ok: reasons.length === 0, reasons };
}

export function orReleaseGatePassed(
  manifest: OrGateManifest = OR_PUBLICATION_MANIFEST,
  verification: OrGateVerification = OR_VERIFICATION,
): boolean {
  if (!orSixHubIdsComplete(manifest.hubs)) return false;
  if (manifest.scope !== 'STATE_LEVEL_ONLY') return false;
  if (manifest.hardcoded_portland_routes !== false) return false;
  if (manifest.hardcoded_multnomah_routes !== false) return false;
  if (!Array.isArray(verification.hubs) || verification.hubs.length !== REQUIRED_OR_HUB_IDS.length) return false;
  const verifiedIds = verification.hubs.map((row) => row.hub_id).filter((id): id is string => Boolean(id));
  if (verifiedIds.length !== REQUIRED_OR_HUB_IDS.length || new Set(verifiedIds).size !== REQUIRED_OR_HUB_IDS.length) {
    return false;
  }
  if (!REQUIRED_OR_HUB_IDS.every((id) => verifiedIds.includes(id))) return false;
  if ((verification.missing ?? []).length !== 0) return false;
  for (const hub of manifest.hubs) {
    const id = hub.hub_id as SpecialistHubId;
    const accepted = ACCEPTED_OR_SPECIALIST_RELEASES[id];
    if (!accepted) return false;
    if (hub.canonical_state_url !== accepted.canonical_state_url) return false;
    if (hub.snapshot_version !== accepted.snapshot_version) return false;
    if (hub.fingerprint !== accepted.fingerprint) return false;
    if (hub.certified_release_sha && hub.certified_release_sha !== accepted.certified_release_sha) return false;
    if (hub.publication_status !== 'live') return false;
    const verified = verification.hubs.find((row) => row.hub_id === hub.hub_id);
    if (!verified) return false;
    const page = evaluateOrPageEvidence(
      { ...verified, url: verified.url ?? verified.expected_url ?? hub.canonical_state_url },
      accepted.canonical_state_url,
    );
    if (!page.ok) return false;
  }
  return true;
}

const OR_CITY_RE =
  /\b(portland|salem|eugene|bend|gresham|hillsboro|beaverton|medford|corvallis)\b/i;
const OR_COUNTY_RE = /\b(multnomah|clackamas|lane|marion)\s+county\b/i;

export function detectOrCity(query: string): string | undefined {
  const city = query.match(OR_CITY_RE);
  if (!city) return undefined;
  const raw = city[1].toLowerCase();
  return raw.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function queryLooksLikeOregon(query: string): boolean {
  if (/\boregon\b/i.test(query)) return true;
  if (/\boregon\s+ccb\b|\bccb\b.*\boregon\b|\bodot\b|\bodhs\b|\bohcs\b|\boregon\s+dfr\b/i.test(query)) return true;
  if (OR_CITY_RE.test(query) || OR_COUNTY_RE.test(query)) return true;
  if (/\bwashington\s+county\b/i.test(query) && /\boregon\b/i.test(query)) return true;
  if (/\bin or\b/i.test(query) || /\bOR\s+(contractor|mover|lender|insur|senior|advis|broker|nursing|roofing|ccb)/i.test(query)) {
    return true;
  }
  return false;
}

export const OR_SEMANTIC_GUARDRAILS = {
  missing_ne_zero: 'Unavailable official evidence is unknown, not zero.',
  search_only_ne_zero: 'Search-only official evidence is unknown, not zero.',
  no_trust_score: 'AskTrustHub does not publish a Trust Score.',
  no_ranking: 'AskTrustHub does not publish paid rankings or best/safest/worst conclusions.',
  portland_deferred:
    'Portland, Multnomah County, and other city/county names stay on statewide Oregon research. Local Oregon datasets and Ask city or county routes are not published.',
  contractor_ccb_ne_company:
    '45,501 is distinct Oregon CCB license IDs, not unique contractor companies. 56,172 CCB rows are license-type observations. BCD business, person, and inspector credentials are not added to CCB.',
  move_certificate_ne_usdot:
    '113 official ODOT authorized household-goods certificate IDs are not USDOT numbers and not MC authority. Local cartage and other-than-local overlap. Complaint and enforcement bulk remain unacquired, not zero.',
  senior_classes_separate:
    '128 open ODHS nursing facilities are not 240 ALF, 332 RCF, or 1,580 AFH settings. OHA HHA 66 is not CMS Home Health 51. Matching 128 NF and CMS NH counts is not a CCN bridge. Do not add these classes.',
  lender_hmda_ne_lender:
    '146,902 HMDA 2025 applications for Oregon properties are not lenders. Use the county-market 146,902 scalar, not the 145,271 LEI-cell total. Current DFR/NMLS company, MLO, and servicer rosters remain OPEN_SEARCH_ONLY.',
  insurance_complaints_ne_insurers:
    '1,309 DFR 2025 insurer-line complaint table rows are not Oregon insurers. 738 insurance-native order documents are not 726 unique matters. Agency, producer, and authorized-insurer universes remain OPEN_SEARCH_ONLY. Complaint Index is not a Trust Score.',
  investor_335_ne_office_ne_notice:
    '335 approved Oregon state-IA CRDs are not 26 ERA firms, not 2,262 notice filings, and not the 167 principal-office overlay. Do not add them. Principal office is not registration. Notice filing is not state IA. ERA is not an RIA.',
} as const;

export function orCaveatForHub(id: SpecialistHubId): string {
  switch (id) {
    case 'contractor':
      return OR_SEMANTIC_GUARDRAILS.contractor_ccb_ne_company;
    case 'move':
      return OR_SEMANTIC_GUARDRAILS.move_certificate_ne_usdot;
    case 'senior':
      return OR_SEMANTIC_GUARDRAILS.senior_classes_separate;
    case 'lender':
      return OR_SEMANTIC_GUARDRAILS.lender_hmda_ne_lender;
    case 'insurance':
      return OR_SEMANTIC_GUARDRAILS.insurance_complaints_ne_insurers;
    case 'investor':
      return OR_SEMANTIC_GUARDRAILS.investor_335_ne_office_ne_notice;
    default:
      return OR_SEMANTIC_GUARDRAILS.missing_ne_zero;
  }
}

export type OrRoute = {
  hubId: SpecialistHubId;
  stateCode: 'OR';
  intentFamily: string;
  destination: string;
  caveat: string;
};

function earlierStateNamed(query: string, other: RegExp): boolean {
  const or = query.search(/\boregon\b/i);
  const otherAt = query.search(other);
  if (otherAt < 0) return false;
  if (or < 0) return true;
  return otherAt < or;
}

export function classifyOrHub(query: string): SpecialistHubId | undefined {
  const q = query.toLowerCase();
  if (
    /\b(mover|movers|moving|household[- ]goods|usdot|fmcsa|hhg|odot|intrastate movers?|interstate movers?|interstate carriers?)\b/.test(
      q,
    )
  ) {
    return 'move';
  }
  if (
    /\b(mortgage|hmda|nmls|homebuyer|mlo|lender company|mortgage lender|mortgage broker|ohcs|flex lending)\b/.test(q) &&
    !/\badvis|securit|iard|ria\b/.test(q)
  ) {
    return 'lender';
  }
  if (
    /\b(nursing homes?|nursing facility|assisted[- ]living|residential care|adult foster|odhs|senior[- ]?(care|resources?|housing)|home[- ]health|hospice)\b/.test(
      q,
    )
  ) {
    return 'senior';
  }
  if (/\b(contractors?|roofing|roofer|ccb|building codes division|bcd)\b/.test(q)) {
    return 'contractor';
  }
  if (
    /\b(insurance|insurer|naic|producer|agency roster|market conduct|complaint index)\b/.test(q)
  ) {
    return 'insurance';
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

export function routeOrAsk(query: string): OrRoute | undefined {
  if (tennesseeNamedFirst(query)) return undefined; // ATH-TN-001: Tennessee named first wins
  if (earlierStateNamed(query, /\bnew york\b/i)) return undefined;
  if (earlierStateNamed(query, /\billinois\b/i)) return undefined;
  if (earlierStateNamed(query, /\bcolorado\b/i)) return undefined;
  if (earlierStateNamed(query, /\bvirginia\b/i)) return undefined;
  if (earlierStateNamed(query, /\bcalifornia\b/i)) return undefined;
  if (earlierStateNamed(query, /\bwashington\b/i) && !/\boregon\b/i.test(query) && !/\bwashington\s+county\b/i.test(query)) {
    return undefined;
  }
  if (!queryLooksLikeOregon(query)) return undefined;
  const hubId = classifyOrHub(query);
  if (!hubId) return undefined;
  return {
    hubId,
    stateCode: 'OR',
    intentFamily: hubId,
    destination: orSpecialistUrl(hubId),
    caveat: orCaveatForHub(hubId),
  };
}

export function orConciergeContext(): string {
  const live = listOrHubs().filter((h) => h.publication_status === 'live');
  const cards = listOrHubs()
    .map((h) => `- ${NETWORK_PUBLIC_NAMES[h.hub_id as SpecialistHubId]} (${h.canonical_state_url}): ${h.coverage_summary}`)
    .join('\n');
  const gate = orReleaseGatePassed();
  return `## Oregon network context
AskTrustHub /oregon is the network gateway. Specialist /oregon pages own detailed evidence.
Oregon research is STATE LEVEL ONLY. Portland, Multnomah County, and other city/county names stay on specialist /oregon with statewide limitations. Do not invent Oregon city or county Ask routes. Local Oregon acquisition is not started.
Hub intent remains primary. Do not route every Oregon question to Contractor.
Live OR specialist pages: ${live.map((h) => h.hub_id).join(', ') || 'none'}.
Six-hub specialist publication gate: ${gate ? 'passed' : 'failed'}. Blocker: ${OR_PUBLICATION_MANIFEST.release_gate.blocker ?? 'none'}.
Do not invent Oregon license, roster, or count facts. Route to the specialist page.
Do not copy Illinois, New York, Virginia, Colorado, or other-state metrics into Oregon.
Do not treat 45,501 CCB license IDs as unique contractor companies.
Do not treat 113 ODOT certificates as USDOT/MC authority.
Do not add 128 + 240 + 332 + 1,580 into one senior-care total.
Do not treat 146,902 HMDA applications as lenders.
Do not treat 1,309 complaint-table rows as currently authorized insurers.
Do not add 335 + 26 + 2,262 + 167 into one adviser total.
There is no combined Oregon provider or Trust Hub record total.
${cards}
Guardrails:
- ${OR_SEMANTIC_GUARDRAILS.contractor_ccb_ne_company}
- ${OR_SEMANTIC_GUARDRAILS.move_certificate_ne_usdot}
- ${OR_SEMANTIC_GUARDRAILS.senior_classes_separate}
- ${OR_SEMANTIC_GUARDRAILS.lender_hmda_ne_lender}
- ${OR_SEMANTIC_GUARDRAILS.insurance_complaints_ne_insurers}
- ${OR_SEMANTIC_GUARDRAILS.investor_335_ne_office_ne_notice}
- Missing, restricted, and search-only evidence is unknown, not zero. No Trust Score. No paid ranking. Portland/Multnomah local routes are not started.`;
}
