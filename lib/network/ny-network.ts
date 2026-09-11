import { createHash } from 'node:crypto';
import manifestJson from '../../data/network/new-york-publication-manifest.json' with { type: 'json' };
import verificationJson from '../../data/network/new-york-verification.json' with { type: 'json' };
import type { SpecialistHubId } from './registry.ts';
import { CANONICAL_ORIGINS, NETWORK_PUBLIC_NAMES, SPECIALIST_HUB_IDS } from './registry.ts';

export const NY_NETWORK_CONTRACT = 'ath-ny-network-release-v1' as const;

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

export function nySixHubIdsComplete(): boolean {
  const ids = NY_PUBLICATION_MANIFEST.hubs.map((h) => h.hub_id);
  return SPECIALIST_HUB_IDS.every((id) => ids.includes(id)) && new Set(ids).size === 6;
}

export function nyReleaseGatePassed(): boolean {
  if (!nySixHubIdsComplete()) return false;
  if (NY_PUBLICATION_MANIFEST.scope !== 'STATE_LEVEL_ONLY') return false;
  if (NY_PUBLICATION_MANIFEST.hardcoded_nyc_routes !== false) return false;
  if (NY_VERIFICATION.release_gate_passed !== true) return false;
  if (!Array.isArray(NY_VERIFICATION.hubs) || NY_VERIFICATION.hubs.length !== 6) return false;
  if ((NY_VERIFICATION.missing ?? []).length !== 0) return false;
  for (const hub of listNyHubs()) {
    const verified = NY_VERIFICATION.hubs.find((row) => row.hub_id === hub.hub_id);
    if (!verified || verified.ok !== true || verified.http_status !== 200) return false;
    if (verified.url !== hub.canonical_state_url) return false;
    if (verified.selfCanonical !== true || verified.sso !== false) return false;
    if (!hub.snapshot_version || !/^[a-f0-9]{64}$/.test(hub.fingerprint)) return false;
    if (hub.publication_status !== 'live') return false;
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

function earlierStateNamed(query: string, other: RegExp): boolean {
  const ny = query.search(/\bnew york\b/i);
  const otherAt = query.search(other);
  if (otherAt < 0) return false;
  if (ny < 0) return true;
  return otherAt < ny;
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
  if (/\bdebarred in florida\b/i.test(query)) return undefined;
  if (newYorkLifeOnly(query)) return undefined;
  if (earlierStateNamed(query, /\bnew\s+jersey\b/i)) return undefined;
  if (earlierStateNamed(query, /\bwest\s+virginia\b/i)) return undefined;
  if (earlierStateNamed(query, /\bcalifornia\b|\bcalif\b/i)) return undefined;
  if (earlierStateNamed(query, /\btexas\b|\btexan\b/i)) return undefined;
  if (earlierStateNamed(query, /\bflorida\b/i) && !/\bregistered in new york\b/i.test(query)) return undefined;
  if (earlierStateNamed(query, /\bwashington\b/i)) return undefined;
  if (earlierStateNamed(query, /\barizona\b/i)) return undefined;
  if (earlierStateNamed(query, /\bcolorado\b/i)) return undefined;
  if (earlierStateNamed(query, /\bvirginia\b/i) && !/\bva mortgage\b/i.test(query)) return undefined;
  if (!queryLooksLikeNewYork(query)) return undefined;
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
Six-hub release gate passed: ${gate ? 'yes' : 'no'}. Blocker: ${NY_PUBLICATION_MANIFEST.release_gate.blocker ?? 'none'}.
Ask status is ASK_PREVIEW_READY, not Production-closed.
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
- Missing, restricted, and search-only evidence is unknown, not zero. No Trust Score. No paid ranking. NYC phase not started.`;
}
