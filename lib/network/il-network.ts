import { createHash } from 'node:crypto';
import manifestJson from '../../data/network/illinois-publication-manifest.json' with { type: 'json' };
import verificationJson from '../../data/network/illinois-verification.json' with { type: 'json' };
import type { SpecialistHubId } from './registry.ts';
import { CANONICAL_ORIGINS, NETWORK_PUBLIC_NAMES } from './registry.ts';

export const IL_NETWORK_CONTRACT = 'ath-il-network-release-v1' as const;

export const REQUIRED_IL_HUB_IDS = [
  'contractor',
  'move',
  'senior',
  'lender',
  'insurance',
  'investor',
] as const satisfies readonly SpecialistHubId[];

export const IL_FINGERPRINT_METHOD =
  'Accepted specialist snapshot artifact at the certified repository SHA. Public HTML confirms the intended state page; the fingerprint is not recomputed from HTML.';

export const ACCEPTED_IL_SPECIALIST_RELEASES: Record<
  SpecialistHubId,
  { snapshot_version: string; fingerprint: string; certified_release_sha: string; canonical_state_url: string }
> = {
  contractor: {
    snapshot_version: 'contractor-il-state-intel-v1',
    fingerprint: 'a9f63e7625d25fd64e4fe95b15f558a49fc719376154be481fdd062042dd0235',
    certified_release_sha: '11fd0b6fd8f6a1fe5e40e48a34f6a578b67334f4',
    canonical_state_url: 'https://www.contractortrusthub.com/illinois',
  },
  move: {
    snapshot_version: 'move-il-state-intel-v1',
    fingerprint: 'b484ba81488f813b43698ccb8a034afc645809be03662f101a951020839c388d',
    certified_release_sha: '65e03580bfa95337726b83ce2926e81f3ae8a6d6',
    canonical_state_url: 'https://www.movetrusthub.com/illinois',
  },
  senior: {
    snapshot_version: 'senior-il-state-intel-v1',
    fingerprint: '20e48b6f8a24c2f3acb0ea208961a93e5c10a3c858d5f42f81454059dea85bac',
    certified_release_sha: '72c1ddb01a3d4f126fb9692b350f091a8eb60d72',
    canonical_state_url: 'https://www.seniortrusthub.com/illinois',
  },
  lender: {
    snapshot_version: 'lender-il-state-intel-v1',
    fingerprint: '06c7f10b4756076b57da54c64306fb50fc9666a379855d1e262591652a9f70a4',
    certified_release_sha: 'dd0f908ee67c0faf0c2795deb09071e41cd1ae9f',
    canonical_state_url: 'https://www.lendertrusthub.com/illinois',
  },
  insurance: {
    snapshot_version: 'insurance-il-state-intel-v1',
    fingerprint: '3085ccfe7ec30c038fafcfb3e70a11609eeba91a9918c9efe14ceb7f0ef634aa',
    certified_release_sha: '8051be7d5169929e42155cab81effa94178e8aad',
    canonical_state_url: 'https://www.insurancetrusthub.com/illinois',
  },
  investor: {
    snapshot_version: 'investor-il-state-intel-v1',
    fingerprint: '997728ec50c9a913a64283b7a10810440c1e0b88e7fae03a91df58df3997534d',
    certified_release_sha: '7dc6c318ce1792b115ae416cffeb48268cc32841',
    canonical_state_url: 'https://www.investortrusthub.com/illinois',
  },
};

export type IlHubManifest = (typeof manifestJson)['hubs'][number];

export const IL_PUBLICATION_MANIFEST = manifestJson;
export const IL_VERIFICATION = verificationJson;

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

export function ilPublicationSemanticFingerprint(
  manifest: typeof IL_PUBLICATION_MANIFEST = IL_PUBLICATION_MANIFEST,
): string {
  return createHash('sha256').update(canonicalJson(manifest)).digest('hex');
}

export const IL_PUBLICATION_FINGERPRINT = ilPublicationSemanticFingerprint();

export function listIlHubs(): IlHubManifest[] {
  return IL_PUBLICATION_MANIFEST.hubs;
}

export function ilHubById(id: SpecialistHubId): IlHubManifest | undefined {
  return IL_PUBLICATION_MANIFEST.hubs.find((h) => h.hub_id === id);
}

export function ilSpecialistUrl(id: SpecialistHubId): string {
  return ilHubById(id)?.canonical_state_url ?? `${CANONICAL_ORIGINS[id]}/illinois`;
}

export type IlGateHub = {
  hub_id: string;
  canonical_state_url?: string;
  snapshot_version?: string;
  fingerprint?: string;
  certified_release_sha?: string;
  publication_status?: string;
};

export type IlGateManifest = {
  hubs: IlGateHub[];
  scope?: string;
  hardcoded_chicago_routes?: boolean;
  hardcoded_cook_routes?: boolean;
};

export type IlPageEvidence = {
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

export type IlGateVerification = {
  release_gate_passed?: boolean;
  missing?: string[];
  hubs: IlPageEvidence[];
};

export function ilSixHubIdsComplete(hubs: IlGateHub[] = listIlHubs()): boolean {
  if (!Array.isArray(hubs) || hubs.length !== REQUIRED_IL_HUB_IDS.length) return false;
  const ids = hubs.map((hub) => hub.hub_id);
  if (new Set(ids).size !== REQUIRED_IL_HUB_IDS.length) return false;
  return REQUIRED_IL_HUB_IDS.every((id) => ids.includes(id));
}

export function normalizeIlPublicUrl(value: string | null | undefined): string | null {
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

export function urlsAreSameIlPage(actual: string | null | undefined, expected: string): boolean {
  const left = normalizeIlPublicUrl(actual);
  const right = normalizeIlPublicUrl(expected);
  return Boolean(left && right && left === right);
}

export function evaluateIlPageEvidence(
  probe: IlPageEvidence,
  expectedUrl: string,
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (probe.http_status !== 200) reasons.push('http_status');
  if (probe.sso !== false) reasons.push('sso');
  const finalUrl = probe.final_url ?? probe.url ?? null;
  if (!urlsAreSameIlPage(finalUrl, expectedUrl)) reasons.push('final_url');
  if (!urlsAreSameIlPage(probe.canonical, expectedUrl)) reasons.push('canonical');
  const robots = `${probe.robots ?? ''} ${probe.x_robots_tag ?? ''}`;
  if (/noindex/i.test(robots) || probe.not_noindex === false) reasons.push('noindex');
  if (probe.headline_ok !== true) reasons.push('headline');
  if (probe.intended_intelligence_page === false) reasons.push('not_intelligence_page');
  const looksSoft404 = /page not found|\b404\b/i.test(`${probe.canonical ?? ''} ${probe.final_url ?? ''}`);
  if (looksSoft404) reasons.push('soft_404');
  return { ok: reasons.length === 0, reasons };
}

export function ilReleaseGatePassed(
  manifest: IlGateManifest = IL_PUBLICATION_MANIFEST,
  verification: IlGateVerification = IL_VERIFICATION,
): boolean {
  if (!ilSixHubIdsComplete(manifest.hubs)) return false;
  if (manifest.scope !== 'STATE_LEVEL_ONLY') return false;
  if (manifest.hardcoded_chicago_routes !== false) return false;
  if (manifest.hardcoded_cook_routes !== false) return false;
  if (!Array.isArray(verification.hubs) || verification.hubs.length !== REQUIRED_IL_HUB_IDS.length) return false;
  const verifiedIds = verification.hubs.map((row) => row.hub_id).filter((id): id is string => Boolean(id));
  if (verifiedIds.length !== REQUIRED_IL_HUB_IDS.length || new Set(verifiedIds).size !== REQUIRED_IL_HUB_IDS.length) {
    return false;
  }
  if (!REQUIRED_IL_HUB_IDS.every((id) => verifiedIds.includes(id))) return false;
  if ((verification.missing ?? []).length !== 0) return false;
  for (const hub of manifest.hubs) {
    const id = hub.hub_id as SpecialistHubId;
    const accepted = ACCEPTED_IL_SPECIALIST_RELEASES[id];
    if (!accepted) return false;
    if (hub.canonical_state_url !== accepted.canonical_state_url) return false;
    if (hub.snapshot_version !== accepted.snapshot_version) return false;
    if (hub.fingerprint !== accepted.fingerprint) return false;
    if (hub.certified_release_sha && hub.certified_release_sha !== accepted.certified_release_sha) return false;
    if (hub.publication_status !== 'live') return false;
    const verified = verification.hubs.find((row) => row.hub_id === hub.hub_id);
    if (!verified) return false;
    const page = evaluateIlPageEvidence(
      { ...verified, url: verified.url ?? verified.expected_url ?? hub.canonical_state_url },
      accepted.canonical_state_url,
    );
    if (!page.ok) return false;
  }
  return true;
}

const IL_CITY_RE =
  /\b(chicago|springfield|naperville|peoria|rockford|aurora|elgin|joliet|evanston|cicero|champaign|bloomington)\b/i;
const IL_COUNTY_RE = /\b(cook|dupage|du page|lake|will|kane|mchenry|winnebago)\s+county\b/i;

export function detectIlCity(query: string): string | undefined {
  const city = query.match(IL_CITY_RE);
  if (!city) return undefined;
  const raw = city[1].toLowerCase();
  if (raw === 'chicago') return 'Chicago';
  return raw.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function queryLooksLikeIllinois(query: string): boolean {
  if (/\billinois\b/i.test(query)) return true;
  if (/\bidfpr\b|\bidph\b|\bidoi\b|\bilcc\b|\bilsos\b/i.test(query)) return true;
  if (IL_CITY_RE.test(query) || IL_COUNTY_RE.test(query)) return true;
  if (/\bin il\b/i.test(query) || /\bIL\s+(contractor|mover|lender|insur|senior|advis|broker|nursing|roofing)/i.test(query)) {
    return true;
  }
  return false;
}

export const IL_SEMANTIC_GUARDRAILS = {
  missing_ne_zero: 'Unavailable official evidence is unknown, not zero.',
  search_only_ne_zero: 'Search-only official evidence is unknown, not zero.',
  no_trust_score: 'AskTrustHub does not publish a Trust Score.',
  no_ranking: 'AskTrustHub does not publish paid rankings or best/safest/worst conclusions.',
  chicago_deferred:
    'Chicago and Cook County names stay on statewide Illinois research. Local Illinois datasets and Ask city or county routes are not published.',
  contractor_roofing_ne_census:
    '4,675 is active Illinois roofing business credential IDs, not unique companies and not a universal Illinois contractor census. 33,290 distinct roofing credential IDs are the source slice, not 33,290 companies. Qualifying party is not the contractor business. Discipline is not a conviction.',
  move_roster_search_only:
    'Current Illinois Commerce Commission household-goods roster is search/verification only; the licensed-mover count is unknown, not zero. Do not display 0 licensed movers. ILCC HHG is not USDOT, not MC authority, and not FMCSA interstate authority. Exact state-to-federal crosswalks remain 0. fail_closed / NOT_ACQUIRED is not a known ILCC population.',
  senior_classes_separate:
    '666 CMS nursing homes are not 595 IDPH home-health licenses and not 169 HFS supportive-living sites. Home nursing, home services, hospice programs, and hospice residences stay separate. Assisted living / shared housing remains OPEN_SEARCH_ONLY. Exact IL-state → CMS bridges are 0. Do not add these classes.',
  lender_hmda_ne_lender:
    '394,488 HMDA 2025 applications for Illinois properties are not lenders. 231,788 originations and 66,742 denials are activity grains. 66,742 / 394,488 = 16.92% is denials as a percent of total applications, not a decision-based denial rate or approval-risk score. Current IDFPR/NMLS company roster remains SEARCH_ONLY / NOT_ACQUIRED.',
  insurance_2896_ne_insurers:
    '2,896 IDOI Director’s Order observations are not currently authorized insurers and not an agency/producer roster. Company, agency, and producer current universes remain OPEN_SEARCH_ONLY. Exact company and producer enforcement associations are 0. Order is not a conviction. Order is not a complaint. Name-only attachment is unsafe.',
  investor_855_ne_office_ne_notice:
    '855 approved Illinois state-IA CRDs are not 55 ERA firms, not 3,560 notice filings, and not the pre-existing 793 principal-office overlay. 855 + 55 = 910 state research identities, not a combined adviser census. Principal office is not registration jurisdiction. Notice filing is not state registration. ERA is not an RIA. SOS bounded enforcement is unknown, not zero.',
} as const;

export function ilCaveatForHub(id: SpecialistHubId): string {
  switch (id) {
    case 'contractor':
      return IL_SEMANTIC_GUARDRAILS.contractor_roofing_ne_census;
    case 'move':
      return IL_SEMANTIC_GUARDRAILS.move_roster_search_only;
    case 'senior':
      return IL_SEMANTIC_GUARDRAILS.senior_classes_separate;
    case 'lender':
      return IL_SEMANTIC_GUARDRAILS.lender_hmda_ne_lender;
    case 'insurance':
      return IL_SEMANTIC_GUARDRAILS.insurance_2896_ne_insurers;
    case 'investor':
      return IL_SEMANTIC_GUARDRAILS.investor_855_ne_office_ne_notice;
    default:
      return IL_SEMANTIC_GUARDRAILS.missing_ne_zero;
  }
}

export type IlRoute = {
  hubId: SpecialistHubId;
  stateCode: 'IL';
  intentFamily: string;
  destination: string;
  caveat: string;
};

function earlierStateNamed(query: string, other: RegExp): boolean {
  const il = query.search(/\billinois\b/i);
  const otherAt = query.search(other);
  if (otherAt < 0) return false;
  if (il < 0) return true;
  return otherAt < il;
}

export function classifyIlHub(query: string): SpecialistHubId | undefined {
  const q = query.toLowerCase();
  if (
    /\b(mover|movers|moving|household[- ]goods|usdot|fmcsa|hhg|ilcc|intrastate movers?|interstate movers?|interstate carriers?)\b/.test(
      q,
    )
  ) {
    return 'move';
  }
  if (
    /\b(mortgage|hmda|nmls|homebuyer|mlo|lender company|mortgage lender|mortgage broker|bankers?)\b/.test(q) &&
    !/\badvis|securit|iard|ria\b/.test(q)
  ) {
    return 'lender';
  }
  if (
    /\b(nursing homes?|nursing facility|home[- ]health|home[- ]nursing|home[- ]services|hospice|assisted[- ]living|supportive[- ]living|idph|senior[- ]?(care|resources?|housing))\b/.test(
      q,
    )
  ) {
    return 'senior';
  }
  if (/\b(contractors?|roofing|roofer|idfpr|qualifying party|disciplinary records?)\b/.test(q)) {
    return 'contractor';
  }
  if (
    /\b(insurance|insurer|naic|producer|agency roster|director.?s? orders?|idoi)\b/.test(q)
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

export function routeIlAsk(query: string): IlRoute | undefined {
  if (earlierStateNamed(query, /\bnew york\b/i) && !/\bregistered in illinois\b/i.test(query)) return undefined;
  if (earlierStateNamed(query, /\bcolorado\b/i)) return undefined;
  if (earlierStateNamed(query, /\bvirginia\b/i)) return undefined;
  if (earlierStateNamed(query, /\bcalifornia\b/i)) return undefined;
  if (!queryLooksLikeIllinois(query)) return undefined;
  const hubId = classifyIlHub(query);
  if (!hubId) return undefined;
  return {
    hubId,
    stateCode: 'IL',
    intentFamily: hubId,
    destination: ilSpecialistUrl(hubId),
    caveat: ilCaveatForHub(hubId),
  };
}

export function ilConciergeContext(): string {
  const live = listIlHubs().filter((h) => h.publication_status === 'live');
  const cards = listIlHubs()
    .map((h) => `- ${NETWORK_PUBLIC_NAMES[h.hub_id as SpecialistHubId]} (${h.canonical_state_url}): ${h.coverage_summary}`)
    .join('\n');
  const gate = ilReleaseGatePassed();
  return `## Illinois network context
AskTrustHub /illinois is the network gateway. Specialist /illinois pages own detailed evidence.
Illinois research is STATE LEVEL ONLY. Chicago, Cook County, and other city/county names stay on specialist /illinois with statewide limitations. Do not invent Illinois city or county Ask routes. Local Illinois acquisition is not started.
Hub intent remains primary. Do not route every Illinois question to Contractor.
Live IL specialist pages: ${live.map((h) => h.hub_id).join(', ') || 'none'}.
Six-hub specialist publication gate: ${gate ? 'passed' : 'failed'}. Blocker: ${IL_PUBLICATION_MANIFEST.release_gate.blocker ?? 'none'}.
Do not invent Illinois license, roster, or count facts. Route to the specialist page.
Do not copy New York, Virginia, Colorado, or other-state metrics into Illinois.
Do not answer “how many movers?” as 0.
Do not treat 4,675 roofing business IDs as unique companies or a universal contractor census.
Do not treat 394,488 HMDA applications as lenders.
Do not treat 2,896 Director’s Orders as currently authorized insurers.
Do not add 855 + 55 + 3,560 + 793 into one adviser total.
ILCC roster unavailable does not mean federal IL research unavailable.
${cards}
Guardrails:
- ${IL_SEMANTIC_GUARDRAILS.contractor_roofing_ne_census}
- ${IL_SEMANTIC_GUARDRAILS.move_roster_search_only}
- ${IL_SEMANTIC_GUARDRAILS.senior_classes_separate}
- ${IL_SEMANTIC_GUARDRAILS.lender_hmda_ne_lender}
- ${IL_SEMANTIC_GUARDRAILS.investor_855_ne_office_ne_notice}
- ${IL_SEMANTIC_GUARDRAILS.insurance_2896_ne_insurers}
- Missing, restricted, and search-only evidence is unknown, not zero. No Trust Score. No paid ranking. Chicago/Cook local routes are not started.`;
}
