import { createHash } from 'node:crypto';
import manifestJson from '../../data/network/massachusetts-publication-manifest.json' with { type: 'json' };
import verificationJson from '../../data/network/massachusetts-verification.json' with { type: 'json' };
import type { SpecialistHubId } from './registry.ts';
import { CANONICAL_ORIGINS } from './registry.ts';
import { tennesseeNamedFirst } from './tn-network.ts';
import { nevadaNamedFirst } from './nv-network.ts';

export const MA_NETWORK_CONTRACT = 'ath-ma-network-release-v1' as const;

export const REQUIRED_MA_HUB_IDS = [
  'contractor',
  'move',
  'senior',
  'lender',
  'insurance',
  'investor',
] as const satisfies readonly SpecialistHubId[];

export const MA_FINGERPRINT_METHOD =
  'Accepted specialist snapshot artifact at the certified repository SHA. Public HTML confirms the intended state page; the fingerprint is not recomputed from HTML.';

export const ACCEPTED_MA_SPECIALIST_RELEASES: Record<
  SpecialistHubId,
  { snapshot_version: string; fingerprint: string; certified_release_sha: string; canonical_state_url: string }
> = {
  move: {
    snapshot_version: 'move-ma-state-intel-v1',
    fingerprint: '4d716b593ec05ba56cdf69c87a33d307aa941ead0bf3967074b8dacc1a7d92ff',
    certified_release_sha: '2e7424b3b8610f08d17721a7d1ae08a74d686ca5',
    canonical_state_url: 'https://www.movetrusthub.com/massachusetts',
  },
  lender: {
    snapshot_version: 'lender-ma-state-intel-v1',
    fingerprint: 'efd41b02e75a7a0891bc433b50ddd19b5ba3c4095b96521739f20012188aaebe',
    certified_release_sha: '158f3017563257a490d8192ea0a9e30c3f699587',
    canonical_state_url: 'https://www.lendertrusthub.com/massachusetts',
  },
  contractor: {
    snapshot_version: 'contractor-ma-state-intel-v1',
    fingerprint: 'd40024ca5490514a33c5c6f0329b16be8f0f05bb8802f5a1997730fb368fba94',
    certified_release_sha: 'af0b7da0527b97249f81a3c3d0943be811dc6e74',
    canonical_state_url: 'https://www.contractortrusthub.com/massachusetts',
  },
  insurance: {
    snapshot_version: 'insurance-ma-state-intel-v1',
    fingerprint: 'fe08b5e2b602f9a7b3af61ea1986b678fda98d53e00e1efbdaf060e4b4d88f17',
    certified_release_sha: '86e1d4b5425a9ba7455b1c57d607c1d42e1549a6',
    canonical_state_url: 'https://www.insurancetrusthub.com/massachusetts',
  },
  senior: {
    snapshot_version: 'senior-ma-state-intel-v1',
    fingerprint: 'b8cb397f6bb0ecdb9f58a09ff7e6a7ce720d7a37c1906cf16e68deac39586ccf',
    certified_release_sha: '49fb6d8bfab5c8d09da13b039ad0356da0966d59',
    canonical_state_url: 'https://www.seniortrusthub.com/massachusetts',
  },
  investor: {
    snapshot_version: 'investor-ma-state-intel-v1',
    fingerprint: '014fb959166d135153618b9781fd099322e0f1d4eec38d3bd3470dd282ee1930',
    certified_release_sha: 'c33a82f85121f162799b9a5b33dbbce5204acc25',
    canonical_state_url: 'https://www.investortrusthub.com/massachusetts',
  },
};

export type MaHubManifest = (typeof manifestJson)['hubs'][number];
export const MA_PUBLICATION_MANIFEST = manifestJson;
export const MA_VERIFICATION = verificationJson;

const VOLATILE_KEYS = new Set(['verified_at', 'verifiedAt', 'generated_at', 'generatedAt']);

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !VOLATILE_KEYS.has(key))
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`).join(',')}}`;
}

export function maPublicationSemanticFingerprint(
  manifest: typeof MA_PUBLICATION_MANIFEST = MA_PUBLICATION_MANIFEST,
): string {
  return createHash('sha256').update(canonicalJson(manifest)).digest('hex');
}

export const MA_PUBLICATION_FINGERPRINT = maPublicationSemanticFingerprint();

export function listMaHubs(): MaHubManifest[] {
  return MA_PUBLICATION_MANIFEST.hubs;
}

export function maHubById(id: SpecialistHubId): MaHubManifest | undefined {
  return MA_PUBLICATION_MANIFEST.hubs.find((h) => h.hub_id === id);
}

export function maSpecialistUrl(id: SpecialistHubId): string {
  return maHubById(id)?.canonical_state_url ?? `${CANONICAL_ORIGINS[id]}/massachusetts`;
}

export type MaGateHub = {
  hub_id: string;
  canonical_state_url?: string;
  snapshot_version?: string;
  fingerprint?: string;
  certified_release_sha?: string;
  publication_status?: string;
};

export type MaGateManifest = {
  hubs: MaGateHub[];
  scope?: string;
  hardcoded_boston_routes?: boolean;
  hardcoded_county_routes?: boolean;
};

export type MaPageEvidence = {
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

export type MaGateVerification = {
  release_gate_passed?: boolean;
  missing?: string[];
  hubs: MaPageEvidence[];
};

export function maSixHubIdsComplete(hubs: MaGateHub[] = listMaHubs()): boolean {
  if (!Array.isArray(hubs) || hubs.length !== REQUIRED_MA_HUB_IDS.length) return false;
  const ids = hubs.map((hub) => hub.hub_id);
  if (new Set(ids).size !== REQUIRED_MA_HUB_IDS.length) return false;
  return REQUIRED_MA_HUB_IDS.every((id) => ids.includes(id));
}

export function normalizeMaPublicUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (url.username || url.password) return null;
    return `https://${url.hostname.toLowerCase()}${path}`;
  } catch {
    return null;
  }
}

export function urlsAreSameMaPage(actual: string | null | undefined, expected: string): boolean {
  const left = normalizeMaPublicUrl(actual);
  const right = normalizeMaPublicUrl(expected);
  return Boolean(left && right && left === right);
}

export function evaluateMaPageEvidence(
  probe: MaPageEvidence,
  expectedUrl: string,
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (probe.http_status !== 200) reasons.push('http_status');
  if (probe.sso !== false) reasons.push('sso');
  const finalUrl = probe.final_url ?? probe.url ?? null;
  if (!urlsAreSameMaPage(finalUrl, expectedUrl)) reasons.push('final_url');
  if (!urlsAreSameMaPage(probe.canonical, expectedUrl)) reasons.push('canonical');
  const robots = `${probe.robots ?? ''} ${probe.x_robots_tag ?? ''}`;
  if (/noindex/i.test(robots) || probe.not_noindex === false) reasons.push('noindex');
  if (probe.headline_ok !== true) reasons.push('headline');
  if (probe.intended_intelligence_page === false) reasons.push('not_intelligence_page');
  return { ok: reasons.length === 0, reasons };
}

export function maReleaseGatePassed(
  manifest: MaGateManifest = MA_PUBLICATION_MANIFEST,
  verification: MaGateVerification = MA_VERIFICATION,
): boolean {
  if (!maSixHubIdsComplete(manifest.hubs)) return false;
  if (manifest.scope !== 'STATE_LEVEL_ONLY') return false;
  if (manifest.hardcoded_boston_routes !== false) return false;
  if (manifest.hardcoded_county_routes !== false) return false;
  if (!Array.isArray(verification.hubs) || verification.hubs.length !== REQUIRED_MA_HUB_IDS.length) return false;
  if ((verification.missing ?? []).length !== 0) return false;
  for (const hub of manifest.hubs) {
    const id = hub.hub_id as SpecialistHubId;
    const accepted = ACCEPTED_MA_SPECIALIST_RELEASES[id];
    if (!accepted) return false;
    if (hub.canonical_state_url !== accepted.canonical_state_url) return false;
    if (hub.snapshot_version !== accepted.snapshot_version) return false;
    if (hub.fingerprint !== accepted.fingerprint) return false;
    if (hub.certified_release_sha && hub.certified_release_sha !== accepted.certified_release_sha) return false;
    if (hub.publication_status !== 'live') return false;
    const verified = verification.hubs.find((row) => row.hub_id === hub.hub_id);
    if (!verified) return false;
    const page = evaluateMaPageEvidence(
      { ...verified, url: verified.url ?? verified.expected_url ?? hub.canonical_state_url },
      accepted.canonical_state_url,
    );
    if (!page.ok) return false;
  }
  return true;
}

const MA_CITY_RE = /\b(boston|worcester|cambridge|quincy|lowell|springfield)\b/i;

export function detectMaCity(query: string): string | undefined {
  const city = query.match(MA_CITY_RE);
  if (!city?.[1]) return undefined;
  const token = city[1].toLowerCase();
  const named = /\bmassachusetts\b/i.test(query);
  if (!named && token !== 'boston') return undefined;
  if (!named && token === 'boston' && !queryLooksLikeMassachusetts(query)) return undefined;
  return city[1].replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function queryLooksLikeMassachusetts(query: string): boolean {
  if (/\bmedicare\s+advantage\b/i.test(query) && !/\bmassachusetts\b/i.test(query)) return false;
  if (/\bma-pd\b/i.test(query) && !/\bmassachusetts\b/i.test(query)) return false;
  if (/\bmassachusetts\b/i.test(query)) return true;
  if (/\bdpu\s+certificate\b/i.test(query)) return true;
  if (
    /\bboston\b/i.test(query) &&
    /\b(mover|moving|contractor|mortgage|lender|insurance|nursing|hospice|assisted|senior|advis|securit|broker|debar)\b/i.test(query) &&
    !/\b(ohio|georgia|illinois|missouri|oregon|virginia|colorado|florida|texas|california|washington|arizona|pennsylvania|new york|north carolina|new jersey|tennessee|nevada)\b/i.test(query)
  ) {
    return true;
  }
  return false;
}

export const MA_SEMANTIC_GUARDRAILS = {
  missing_ne_zero: 'Unavailable official evidence is unknown, not zero.',
  no_trust_score: 'AskTrustHub does not publish a Trust Score.',
  no_ranking: 'AskTrustHub does not publish paid rankings or best, safest, or recommended winners.',
  boston_deferred: 'Boston is geography, not a separate Massachusetts regulatory system. No Boston or county Ask route is published.',
  ambiguous_ma: 'Medicare Advantage "MA" and MA-PD are not Massachusetts. Bare Springfield is not assumed to be Massachusetts.',
  move_dpu_ne_usdot:
    '308 distinct Massachusetts DPU certificate numbers come from 309 regulated-mover rows. A DPU certificate is not a USDOT number and not an MC number. Exact USDOT joins: 0. Exact MC joins: 0. A DPU listing is not an invented Active status. 300 rows have a posted tariff link and 9 are pending. Tariff effective dates were not acquired.',
  lender_company_ne_person:
    '298 distinct mortgage-lender company NMLS IDs are one company-license grain. The mortgage-broker file, MLO persons, and branch NMLS IDs stay separate. 559 company NMLS identities across the company files are not one lender total. HMDA is federal activity, not a license count.',
  contractor_discipline_ne_census:
    '518 DOL construction-trade discipline rows are discipline evidence, not a contractor census. HIC lookup and CSL lookup are known, and both bulk rosters were not acquired. HIC is not CSL and neither is an electrician, plumber, or gas license. DCAMM parties and AG Fair Labor rows stay separate. No profile is attached by name.',
  insurance_company_ne_designation:
    '1,693 distinct NAIC identities are the DOI licensed/approved company grain. Designation lists, 1,000 non-NAIC research rows, and enforcement indexes stay separate. Agency and producer bulk rosters were not acquired.',
  senior_classes_separate:
    '347 Massachusetts DPH Nursing Homes are one facility class. Rest Homes, certified home health agencies, hospice, hospice inpatient satellites, adult day health, AGE assisted living residences, and CMS nursing home, home health, and hospice counts stay separate. Proven exact DPH-to-CMS bridges: 0. That is not a claim of zero real-world overlap.',
  investor_registration_lenses:
    '773 APPROVED Massachusetts state IA firms are state registration, not ERA, not federal notice filings, and not a principal-office census. 794 state IA rows also include CONDREST and TERMREQUEST. Exact CRD attachments on the enforcement archive: 0. No name-only joins.',
} as const;

export function maCaveatForHub(id: SpecialistHubId): string {
  switch (id) {
    case 'move':
      return MA_SEMANTIC_GUARDRAILS.move_dpu_ne_usdot;
    case 'lender':
      return MA_SEMANTIC_GUARDRAILS.lender_company_ne_person;
    case 'contractor':
      return MA_SEMANTIC_GUARDRAILS.contractor_discipline_ne_census;
    case 'insurance':
      return MA_SEMANTIC_GUARDRAILS.insurance_company_ne_designation;
    case 'senior':
      return MA_SEMANTIC_GUARDRAILS.senior_classes_separate;
    case 'investor':
      return MA_SEMANTIC_GUARDRAILS.investor_registration_lenses;
    default:
      return MA_SEMANTIC_GUARDRAILS.missing_ne_zero;
  }
}

export type MaRoute = {
  hubId: SpecialistHubId;
  stateCode: 'MA';
  intentFamily: string;
  destination: string;
  caveat: string;
};

function earlierStateNamed(query: string): boolean {
  return /\b(ohio|georgia|north carolina|pennsylvania|new york|illinois|oregon|virginia|colorado|california|texas|florida|washington|arizona|new jersey|tennessee|nevada)\b/i.test(
    query,
  );
}

function labeledIdentifier(query: string): boolean {
  return /\b(usdot|dot|mc|nmls|naic|npn|ccn|crd|sec(?:\s+number|\s+file)?|hic|csl)\b/i.test(query) && /\d/.test(query);
}

function rankingAsked(query: string): boolean {
  return /\b(best|safest|top|worst|recommended|trust\s*score)\b/i.test(query);
}

export function classifyMaHub(query: string): SpecialistHubId | undefined {
  const q = query.toLowerCase();
  if (/\b(movers?|moving|household[- ]goods|dpu\s+certificate|moving tariff|tariff)\b/.test(q)) return 'move';
  if (/\b(mortgage|nmls|hmda|lenders?|loan originators?|mlos?)\b/.test(q) && !/\badvis|securit/.test(q)) return 'lender';
  if (/\b(nursing homes?|assisted living|rest homes?|home[- ]health|hospice|senior|adult day)\b/.test(q)) return 'senior';
  if (/\b(insurance|insurers?|naic|producers?|agenc(?:y|ies))\b/.test(q)) return 'insurance';
  if (/\b(contractors?|home improvement|\bhic\b|\bcsl\b|electricians?|plumbers?|gas fitters?|debar(?:ment|red)?|discipline)\b/.test(q)) return 'contractor';
  if (/\b(investment advis\w*|state[- ]registered advis\w*|\bria\b|\bera\b|securities|broker-?dealers?|\bcrd\b|\biard\b|notice filing)\b/.test(q)) return 'investor';
  return undefined;
}

export function routeMaAsk(query: string): MaRoute | undefined {
  if (tennesseeNamedFirst(query)) return undefined; // ATH-TN-001: Tennessee named first wins
  if (nevadaNamedFirst(query)) return undefined; // ATH-NV-001: Nevada named first wins
  if (/\bmedicare\s+advantage\b/i.test(query) && !/\bmassachusetts\b/i.test(query)) return undefined;
  if (/\bma-pd\b/i.test(query) && !/\bmassachusetts\b/i.test(query)) return undefined;
  if (earlierStateNamed(query) && !/\bmassachusetts\b/i.test(query)) return undefined;
  if (earlierStateNamed(query) && query.search(/\bmassachusetts\b/i) > query.search(/\b(ohio|georgia|north carolina|pennsylvania|tennessee|nevada)\b/i)) {
    return undefined;
  }
  if (labeledIdentifier(query)) return undefined;
  if (/\bspringfield\b/i.test(query) && !/\bmassachusetts\b/i.test(query)) return undefined;
  if (!queryLooksLikeMassachusetts(query)) return undefined;
  const hubId = classifyMaHub(query);
  if (!hubId) return undefined;
  const caveat = rankingAsked(query)
    ? `${maCaveatForHub(hubId)} Ask does not select a winner. Compare the specialist evidence.`
    : maCaveatForHub(hubId);
  return {
    hubId,
    stateCode: 'MA',
    intentFamily: hubId,
    destination: maSpecialistUrl(hubId),
    caveat,
  };
}

export function maConciergeContext(): string {
  const gate = maReleaseGatePassed();
  return `## Massachusetts network context
AskTrustHub /massachusetts is the network gateway. Specialist /massachusetts pages own the evidence.
Massachusetts research is STATE LEVEL ONLY. Boston is not a separate regulatory system. Do not invent Boston or county routes.
Medicare Advantage "MA" and MA-PD are not the state. Bare Springfield is not Massachusetts.
Six-hub specialist publication gate: ${gate ? 'passed' : 'failed'}. Blocker: ${MA_PUBLICATION_MANIFEST.release_gate.blocker ?? 'none'}.
Do not add hub counts into a Massachusetts business, provider, or professional total.
${Object.values(MA_SEMANTIC_GUARDRAILS).join('\n')}
`;
}
