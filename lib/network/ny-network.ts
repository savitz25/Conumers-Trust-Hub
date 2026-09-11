import { createHash } from 'node:crypto';
import manifestJson from '../../data/network/new-york-publication-manifest.json' with { type: 'json' };
import verificationJson from '../../data/network/new-york-verification.json' with { type: 'json' };
import type { SpecialistHubId } from './registry.ts';
import { CANONICAL_ORIGINS, NETWORK_PUBLIC_NAMES } from './registry.ts';
import { US_JURISDICTIONS } from './us-jurisdictions.ts';

export const NY_NETWORK_CONTRACT = 'ath-ny-network-release-v1' as const;

export const REQUIRED_NY_HUB_IDS = [
  'contractor',
  'move',
  'senior',
  'lender',
  'insurance',
  'investor',
] as const satisfies readonly SpecialistHubId[];

export const NY_FINGERPRINT_METHOD =
  'Accepted specialist snapshot artifact at the certified repository SHA. Public HTML confirms the intended state page; the fingerprint is not recomputed from HTML.';

export const ACCEPTED_NY_SPECIALIST_RELEASES: Record<
  SpecialistHubId,
  { snapshot_version: string; fingerprint: string; certified_release_sha: string; canonical_state_url: string }
> = {
  contractor: {
    snapshot_version: 'contractor-ny-state-intel-v1',
    fingerprint: '27f39aad84544a1ecfb4db74934ddbac55f94bd087b2a9cf3b5de20305685f14',
    certified_release_sha: '862da0d952275a99e4214b6e88b2082581cb837b',
    canonical_state_url: 'https://www.contractortrusthub.com/new-york',
  },
  move: {
    snapshot_version: 'move-ny-state-intel-v1',
    fingerprint: '9dce86a315eb652f36026620361b8ac0657c734ccafe576d533ed240f6338b83',
    certified_release_sha: '866bde6eeeed692d23257c7de75ebca38cb11e78',
    canonical_state_url: 'https://www.movetrusthub.com/new-york',
  },
  senior: {
    snapshot_version: 'senior-ny-state-intel-v1',
    fingerprint: '0ba069ebbd93faeb3274f3849a34703be2a9ce6fa66289468d6a2dfa5c73af54',
    certified_release_sha: 'eaff708dd7459c8ca24eca00c1ce0039100b5979',
    canonical_state_url: 'https://www.seniortrusthub.com/new-york',
  },
  lender: {
    snapshot_version: 'lender-ny-state-intel-v1',
    fingerprint: 'd3a07f5b5d7114e54917ef0aa0d338e81f90f87e2bb0fc9eddabe2fa75eb6b82',
    certified_release_sha: '8ea55825d3a4cc5ef4d8aabd80f7c2e8348ee1ed',
    canonical_state_url: 'https://www.lendertrusthub.com/new-york',
  },
  insurance: {
    snapshot_version: 'insurance-ny-state-intel-v1',
    fingerprint: 'd4832c3c41c0390d6ffa15755142c6d669e49e6fb0db858f55f761ea894b212e',
    certified_release_sha: 'a12b6d59d8420a0cb8a2076a0b8b00b18b88c41f',
    canonical_state_url: 'https://www.insurancetrusthub.com/new-york',
  },
  investor: {
    snapshot_version: 'investor-ny-state-intel-v1',
    fingerprint: '99934341f3307ee00802256cc143d904085d2cf464f9cc15fd97ae48f9c00a1a',
    certified_release_sha: 'e1f57a1b5092233892365f1c02a21b2cc935a2f5',
    canonical_state_url: 'https://www.investortrusthub.com/new-york',
  },
};

export type NyHubManifest = (typeof manifestJson)['hubs'][number];

export const NY_PUBLICATION_MANIFEST = manifestJson;
export const NY_VERIFICATION = verificationJson;

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

export function nyPublicationSemanticFingerprint(
  manifest: typeof NY_PUBLICATION_MANIFEST = NY_PUBLICATION_MANIFEST,
): string {
  return createHash('sha256').update(canonicalJson(manifest)).digest('hex');
}

export const NY_PUBLICATION_FINGERPRINT = nyPublicationSemanticFingerprint();

export function listNyHubs(): NyHubManifest[] {
  return NY_PUBLICATION_MANIFEST.hubs;
}

export function nyHubById(id: SpecialistHubId): NyHubManifest | undefined {
  return NY_PUBLICATION_MANIFEST.hubs.find((h) => h.hub_id === id);
}

export function nySpecialistUrl(id: SpecialistHubId): string {
  return nyHubById(id)?.canonical_state_url ?? `${CANONICAL_ORIGINS[id]}/new-york`;
}

export type NyGateHub = {
  hub_id: string;
  canonical_state_url?: string;
  snapshot_version?: string;
  fingerprint?: string;
  certified_release_sha?: string;
  publication_status?: string;
};

export type NyGateManifest = {
  hubs: NyGateHub[];
  scope?: string;
  hardcoded_nyc_routes?: boolean;
};

export type NyPageEvidence = {
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

export type NyGateVerification = {
  release_gate_passed?: boolean;
  missing?: string[];
  hubs: NyPageEvidence[];
};

export function nySixHubIdsComplete(hubs: NyGateHub[] = listNyHubs()): boolean {
  if (!Array.isArray(hubs) || hubs.length !== REQUIRED_NY_HUB_IDS.length) return false;
  const ids = hubs.map((hub) => hub.hub_id);
  if (new Set(ids).size !== REQUIRED_NY_HUB_IDS.length) return false;
  return REQUIRED_NY_HUB_IDS.every((id) => ids.includes(id));
}

export function normalizeNyPublicUrl(value: string | null | undefined): string | null {
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

export function urlsAreSameNyPage(actual: string | null | undefined, expected: string): boolean {
  const left = normalizeNyPublicUrl(actual);
  const right = normalizeNyPublicUrl(expected);
  return Boolean(left && right && left === right);
}

export function evaluateNyPageEvidence(
  probe: NyPageEvidence,
  expectedUrl: string,
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (probe.http_status !== 200) reasons.push('http_status');
  if (probe.sso !== false) reasons.push('sso');
  const finalUrl = probe.final_url ?? probe.url ?? null;
  if (!urlsAreSameNyPage(finalUrl, expectedUrl)) reasons.push('final_url');
  if (!urlsAreSameNyPage(probe.canonical, expectedUrl)) reasons.push('canonical');
  const robots = `${probe.robots ?? ''} ${probe.x_robots_tag ?? ''}`;
  if (/noindex/i.test(robots) || probe.not_noindex === false) reasons.push('noindex');
  if (probe.headline_ok !== true) reasons.push('headline');
  if (probe.intended_intelligence_page === false) reasons.push('not_intelligence_page');
  const looksSoft404 = /page not found|\b404\b/i.test(`${probe.canonical ?? ''} ${probe.final_url ?? ''}`);
  if (looksSoft404) reasons.push('soft_404');
  return { ok: reasons.length === 0, reasons };
}

export function nyReleaseGatePassed(
  manifest: NyGateManifest = NY_PUBLICATION_MANIFEST,
  verification: NyGateVerification = NY_VERIFICATION,
): boolean {
  if (!nySixHubIdsComplete(manifest.hubs)) return false;
  if (manifest.scope !== 'STATE_LEVEL_ONLY') return false;
  if (manifest.hardcoded_nyc_routes !== false) return false;
  if (!Array.isArray(verification.hubs) || verification.hubs.length !== REQUIRED_NY_HUB_IDS.length) return false;
  const verifiedIds = verification.hubs.map((row) => row.hub_id).filter((id): id is string => Boolean(id));
  if (verifiedIds.length !== REQUIRED_NY_HUB_IDS.length || new Set(verifiedIds).size !== REQUIRED_NY_HUB_IDS.length) {
    return false;
  }
  if (!REQUIRED_NY_HUB_IDS.every((id) => verifiedIds.includes(id))) return false;
  if ((verification.missing ?? []).length !== 0) return false;
  for (const hub of manifest.hubs) {
    const id = hub.hub_id as SpecialistHubId;
    const accepted = ACCEPTED_NY_SPECIALIST_RELEASES[id];
    if (!accepted) return false;
    if (hub.canonical_state_url !== accepted.canonical_state_url) return false;
    if (hub.snapshot_version !== accepted.snapshot_version) return false;
    if (hub.fingerprint !== accepted.fingerprint) return false;
    if (hub.certified_release_sha && hub.certified_release_sha !== accepted.certified_release_sha) return false;
    if (hub.publication_status !== 'live') return false;
    const verified = verification.hubs.find((row) => row.hub_id === hub.hub_id);
    if (!verified) return false;
    const page = evaluateNyPageEvidence(
      { ...verified, url: verified.url ?? verified.expected_url ?? hub.canonical_state_url },
      accepted.canonical_state_url,
    );
    if (!page.ok) return false;
  }
  return true;
}

const NYC_RE = /\b(nyc|new york city|manhattan|brooklyn|queens|the bronx|bronx|staten island)\b/i;
const NY_CITY_RE = /\b(albany|buffalo|rochester|syracuse|yonkers|white plains)\b/i;
const NY_COUNTY_RE =
  /\b(westchester|nassau|suffolk|erie|monroe|onondaga|albany|kings|queens|bronx|richmond|new york)\s+county\b/i;

function newYorkLifeOnly(query: string): boolean {
  if (!/\bnew york life\b/i.test(query)) return false;
  const stripped = query.replace(/\bnew york life\b/gi, ' ');
  return !/\bnew york\b/i.test(stripped) && !/\bin ny\b/i.test(stripped) && !NYC_RE.test(stripped);
}

export function detectNyCity(query: string): string | undefined {
  const nyc = query.match(NYC_RE);
  if (nyc) {
    const raw = nyc[1].toLowerCase();
    if (raw === 'nyc' || raw === 'new york city') return 'New York City';
    return raw.replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
  const city = query.match(NY_CITY_RE);
  if (!city) return undefined;
  return city[1].replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function queryLooksLikeNewYork(query: string): boolean {
  if (newYorkLifeOnly(query)) return false;
  if (/\bnew jersey\b/i.test(query) && !/\bnew york\b/i.test(query) && !/\bin ny\b/i.test(query) && !NYC_RE.test(query)) {
    return false;
  }
  if (/\bnew york\b/i.test(query)) return true;
  if (/\bnysdot\b|\bnysdoh\b|\bnydfs\b|\bnysdol\b|\bcarcert\b/i.test(query)) return true;
  if (NYC_RE.test(query) || NY_CITY_RE.test(query) || NY_COUNTY_RE.test(query)) return true;
  if (/\bin ny\b/i.test(query) || /\bNY\s+(contractor|mover|lender|insur|senior|advis|broker|nursing)/i.test(query)) {
    return true;
  }
  return false;
}

export const NY_SEMANTIC_GUARDRAILS = {
  missing_ne_zero: 'Unavailable official evidence is unknown, not zero.',
  search_only_ne_zero: 'Search-only official evidence is unknown, not zero.',
  no_trust_score: 'AskTrustHub does not publish a Trust Score.',
  no_ranking: 'AskTrustHub does not publish paid rankings or best/safest/worst conclusions.',
  nyc_deferred:
    'NYC and borough names stay on statewide New York research. Local NYC datasets and Ask city routes are not started.',
  contractor_certificate_ne_company:
    '14,665 is public-work registry certificate rows, not unique companies and not a statewide residential home-improvement contractor license. Canonical organizations remain zero.',
  move_roster_search_only:
    'Current NYSDOT household-goods roster is search/verification only; the authorized-mover count is unknown, not zero. 108 bulletin observations and 103 Case Numbers are not current movers or authority identities. Application is not authorization. USDOT is not NY intrastate authority. fail_closed / NOT_ACQUIRED is not a known NYSDOT population. Recorded headquarters is not service territory. NYSDOT roster unavailable does not mean federal NY research unavailable.',
  senior_classes_separate:
    '597 NYSDOH Nursing Home Profile identities are not 527 ACF research identities and not CMS home-health agencies. 527 is PARTIAL currentness, not proven currently active ACFs. Do not add nursing-home, ACF, LHCSA, and CMS HHA classes. 117 Do Not Refer observations are not 117 facilities.',
  lender_dated_ne_current:
    '388,207 HMDA 2025 applications for New York properties are not lenders. 151 bankers / 439 brokers / 36 servicers / 9,769 MLO persons are end-of-2024 aggregates, not current licensing counts. A VA mortgage product is not Virginia geography. A complaint is not a violation.',
  insurance_1054_ne_authorized:
    '1,054 DFS company-directory rows are not currently authorized insurers and not an agency/producer roster. 210 NY-domicile rows and 26 AH organization-type rows are different fields. 128 featured auto observations are 2024 data and are not TrustHub recommendations.',
  investor_1297_ne_office_ne_notice:
    '1,297 approved NY state-IA firms are not 327 ERA firms, not 5,856 notice filings, and not the pre-existing 3,152 principal-office overlay. 1,297 + 327 = 1,624 state research identities, not a combined adviser census. Principal office is not registration jurisdiction. OAG bounded enforcement is unknown, not zero.',
} as const;

export function nyCaveatForHub(id: SpecialistHubId): string {
  switch (id) {
    case 'contractor':
      return NY_SEMANTIC_GUARDRAILS.contractor_certificate_ne_company;
    case 'move':
      return NY_SEMANTIC_GUARDRAILS.move_roster_search_only;
    case 'senior':
      return NY_SEMANTIC_GUARDRAILS.senior_classes_separate;
    case 'lender':
      return NY_SEMANTIC_GUARDRAILS.lender_dated_ne_current;
    case 'insurance':
      return NY_SEMANTIC_GUARDRAILS.insurance_1054_ne_authorized;
    case 'investor':
      return NY_SEMANTIC_GUARDRAILS.investor_1297_ne_office_ne_notice;
    default:
      return NY_SEMANTIC_GUARDRAILS.missing_ne_zero;
  }
}

export type NyRoute = {
  hubId: SpecialistHubId;
  stateCode: 'NY';
  intentFamily: string;
  destination: string;
  caveat: string;
};

export type RequestedLegalJurisdiction = {
  code: string;
  name: string;
  verb: 'registered' | 'debarred';
  ambiguous: boolean;
};

function jurisdictionNamePattern(name: string): string {
  return name.replace(/\s+/g, '\\s+');
}

export function requestedLegalJurisdiction(query: string): RequestedLegalJurisdiction | undefined {
  const stripped = query.replace(/\bnew york life\b/gi, ' ');
  const found: Array<{ code: string; name: string; verb: 'registered' | 'debarred' }> = [];
  const verbs: Array<'registered' | 'debarred'> = ['registered', 'debarred'];
  const jurisdictions = [...US_JURISDICTIONS].sort((a, b) => b.name.length - a.name.length);
  for (const verb of verbs) {
    for (const place of jurisdictions) {
      if (place.code === 'VA' && /\bwest\s+virginia\b/i.test(stripped) && !/\b(?<!west\s)virginia\b/i.test(stripped)) {
        continue;
      }
      const nameRe = new RegExp(`\\b${verb}\\s+in\\s+${jurisdictionNamePattern(place.name)}\\b`, 'i');
      const codeRe = new RegExp(`\\b${verb}\\s+in\\s+${place.code}\\b`, 'i');
      if (nameRe.test(stripped) || codeRe.test(stripped)) {
        found.push({ code: place.code, name: place.name, verb });
        break;
      }
    }
  }
  if (found.length === 0) return undefined;
  const unique = [...new Set(found.map((row) => row.code))];
  if (unique.length > 1) {
    return { code: unique.join('|'), name: found.map((row) => row.name).join(' / '), verb: found[0]!.verb, ambiguous: true };
  }
  const match = found.find((row) => row.code === unique[0])!;
  return { ...match, ambiguous: false };
}

export function classifyNyHub(query: string): SpecialistHubId | undefined {
  const q = query.toLowerCase();
  if (
    /\b(mover|movers|moving|household[- ]goods|usdot|fmcsa|hhg|nysdot|carcert|intrastate movers?|interstate movers?|interstate carriers?)\b/.test(
      q,
    )
  ) {
    return 'move';
  }
  if (
    /\b(mortgage|hmda|nmls|homebuyer|mlo|lender company|mortgage lender|mortgage broker|bankers?|va mortgage)\b/.test(q) &&
    !/\badvis|securit|iard|ria\b/.test(q)
  ) {
    return 'lender';
  }
  if (
    /\b(nursing homes?|nursing facility|home[- ]care|lhcsa|adult care|acf|assisted[- ]living|nysdoh|senior[- ]?(care|resources?|housing)|home health|hospice)\b/.test(
      q,
    )
  ) {
    return 'senior';
  }
  if (/\b(contractors?|public[- ]work|nysdol|certificate rows?|debarred)\b/.test(q)) {
    return 'contractor';
  }
  if (/\b(insurance|insurer|naic|producer|agency roster|writing authority|dfs directory)\b/.test(q)) {
    return 'insurance';
  }
  if (
    /investment advis(?:er|or)s?|state[- ]registered advis(?:er|or)s?|\badvis(?:er|or)s?\b|form adv|\biard\b|\bcrd\b|\brias?\b|\bera\b|principal office/.test(
      q,
    )
  ) {
    return 'investor';
  }
  return undefined;
}

export function routeNyAsk(query: string): NyRoute | undefined {
  if (newYorkLifeOnly(query)) return undefined;
  const requested = requestedLegalJurisdiction(query);
  if (requested?.ambiguous) return undefined;
  if (requested && requested.code !== 'NY') return undefined;
  if (!queryLooksLikeNewYork(query) && requested?.code !== 'NY') return undefined;
  const hubId = classifyNyHub(query);
  if (!hubId) return undefined;
  return {
    hubId,
    stateCode: 'NY',
    intentFamily: hubId,
    destination: nySpecialistUrl(hubId),
    caveat: nyCaveatForHub(hubId),
  };
}

export function nyConciergeContext(): string {
  const live = listNyHubs().filter((h) => h.publication_status === 'live');
  const cards = listNyHubs()
    .map((h) => `- ${NETWORK_PUBLIC_NAMES[h.hub_id as SpecialistHubId]} (${h.canonical_state_url}): ${h.coverage_summary}`)
    .join('\n');
  const gate = nyReleaseGatePassed();
  return `## New York network context
AskTrustHub /new-york is the network gateway. Specialist /new-york pages own detailed evidence.
New York research is STATE LEVEL. NYC, borough, and county names stay on specialist /new-york with statewide limitations. Do not invent NYC Ask routes. Local NYC acquisition is approved after statewide closeout and is NOT STARTED.
Hub intent remains primary. Do not route every New York question to Contractor.
Live NY specialist pages: ${live.map((h) => h.hub_id).join(', ') || 'none'}.
Six-hub specialist publication gate: ${gate ? 'passed' : 'failed'}. Blocker: ${NY_PUBLICATION_MANIFEST.release_gate.blocker ?? 'none'}.
Do not invent New York license, roster, or count facts. Route to the specialist page.
Do not copy Virginia or other-state metrics into New York.
Do not answer “how many movers?” as 108 or 103.
Do not treat 14,665 certificate rows as unique companies or a residential HIC license.
Do not treat 151/439 as current lender licenses.
Do not treat 1,054 directory rows as currently authorized insurers.
Do not add 1,297 + 327 + 5,856 + 3,152 into one adviser total.
Do not treat “New York Life” as statewide research unless New York geography is independently present.
NYSDOT roster unavailable does not mean federal NY research unavailable.
${cards}
Guardrails:
- ${NY_SEMANTIC_GUARDRAILS.contractor_certificate_ne_company}
- ${NY_SEMANTIC_GUARDRAILS.move_roster_search_only}
- ${NY_SEMANTIC_GUARDRAILS.senior_classes_separate}
- ${NY_SEMANTIC_GUARDRAILS.lender_dated_ne_current}
- ${NY_SEMANTIC_GUARDRAILS.investor_1297_ne_office_ne_notice}
- ${NY_SEMANTIC_GUARDRAILS.insurance_1054_ne_authorized}
- Missing, restricted, and search-only evidence is unknown, not zero. No Trust Score. No paid ranking. NYC local routes are not started.`;
}
