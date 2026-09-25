import { createHash } from 'node:crypto';
import manifestJson from '../../data/network/tennessee-publication-manifest.json' with { type: 'json' };
import verificationJson from '../../data/network/tennessee-verification.json' with { type: 'json' };
import type { SpecialistHubId } from './registry.ts';
import { CANONICAL_ORIGINS } from './registry.ts';
import { US_JURISDICTIONS } from './us-jurisdictions.ts';

export const TN_NETWORK_CONTRACT = 'ath-tn-network-release-v1' as const;

export const REQUIRED_TN_HUB_IDS = [
  'contractor',
  'move',
  'senior',
  'lender',
  'insurance',
  'investor',
] as const satisfies readonly SpecialistHubId[];

export const TN_FINGERPRINT_METHOD =
  'Accepted specialist snapshot artifact at the certified repository SHA. Public HTML confirms the intended state page; the fingerprint is not recomputed from HTML.';

export const ACCEPTED_TN_SPECIALIST_RELEASES: Record<
  SpecialistHubId,
  { snapshot_version: string; fingerprint: string; certified_release_sha: string; canonical_state_url: string }
> = {
  move: {
    snapshot_version: 'move-tn-state-intel-v1',
    fingerprint: 'aa892cceecbc7ad96f9e9df43f9f941e5e9df24f6622ff23bc1fb66751d63b69',
    certified_release_sha: 'b72c3c0aabf0813358a8f622be68f4b2fe4302a4',
    canonical_state_url: 'https://www.movetrusthub.com/tennessee',
  },
  lender: {
    snapshot_version: 'lender-tn-state-intel-v1',
    fingerprint: 'cb713c0a555163348f74e4679e66182cd55739b079178a469dd5d39e9ce1d66a',
    certified_release_sha: '54b11a9c12bf03042f1bb3ff1af60a0005d6d04a',
    canonical_state_url: 'https://www.lendertrusthub.com/tennessee',
  },
  contractor: {
    snapshot_version: 'contractor-tn-state-intel-v1',
    fingerprint: 'f9ff8de0df88d4f59ae19efea15aae25cac4ca42a02c4f9439f7d50959a0e680',
    certified_release_sha: 'd36047b72a69374514ee32b9aededc36c4318944',
    canonical_state_url: 'https://www.contractortrusthub.com/tennessee',
  },
  insurance: {
    snapshot_version: 'insurance-tn-state-intel-v1',
    fingerprint: 'bb82b021809e2deaf5355dd8d30e5d751483f51cb708a9c77bf79fad8eed1bf8',
    certified_release_sha: 'a52b69d53e408d18f3ef5d64f38d40e57f8e1c41',
    canonical_state_url: 'https://www.insurancetrusthub.com/tennessee',
  },
  senior: {
    snapshot_version: 'senior-tn-state-intel-v1',
    fingerprint: 'f95d81b37f042879e0259bf8d833e0e89122e8a44e55030aa281ca044b047ea9',
    certified_release_sha: 'e5ba724a9209422e15c80c4d112afba1cd57b1f8',
    canonical_state_url: 'https://www.seniortrusthub.com/tennessee',
  },
  investor: {
    snapshot_version: 'investor-tn-state-intel-v1',
    fingerprint: 'a2332c25eb07803d5e126c0a1935c3e8e0d9268d2fd9f3790e90fce65545f54e',
    certified_release_sha: '506ba754a21105c309c87757b8f57fdb41e39b34',
    canonical_state_url: 'https://www.investortrusthub.com/tennessee',
  },
};

export type TnHubManifest = (typeof manifestJson)['hubs'][number];
export const TN_PUBLICATION_MANIFEST = manifestJson;
export const TN_VERIFICATION = verificationJson;

const VOLATILE_KEYS = new Set(['verified_at', 'verifiedAt', 'generated_at', 'generatedAt']);

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !VOLATILE_KEYS.has(key))
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`).join(',')}}`;
}

export function tnPublicationSemanticFingerprint(
  manifest: typeof TN_PUBLICATION_MANIFEST = TN_PUBLICATION_MANIFEST,
): string {
  return createHash('sha256').update(canonicalJson(manifest)).digest('hex');
}

export const TN_PUBLICATION_FINGERPRINT = tnPublicationSemanticFingerprint();

export function listTnHubs(): TnHubManifest[] {
  return TN_PUBLICATION_MANIFEST.hubs;
}

export function tnHubById(id: SpecialistHubId): TnHubManifest | undefined {
  return TN_PUBLICATION_MANIFEST.hubs.find((h) => h.hub_id === id);
}

export function tnSpecialistUrl(id: SpecialistHubId): string {
  return tnHubById(id)?.canonical_state_url ?? `${CANONICAL_ORIGINS[id]}/tennessee`;
}

export type TnGateHub = {
  hub_id: string;
  canonical_state_url?: string;
  snapshot_version?: string;
  fingerprint?: string;
  certified_release_sha?: string;
  publication_status?: string;
  specialist_status?: string;
};

export type TnGateManifest = {
  hubs: TnGateHub[];
  scope?: string;
  hardcoded_city_routes?: boolean;
  hardcoded_county_routes?: boolean;
};

export type TnPageEvidence = {
  hub_id?: string;
  url?: string | null;
  expected_url?: string | null;
  http_status?: number | null;
  canonical?: string | null;
  robots?: string | null;
  x_robots_tag?: string | null;
  final_url?: string | null;
  sso?: boolean;
  headline_ok?: boolean;
  intended_intelligence_page?: boolean;
  not_noindex?: boolean;
  specialist_status?: string | null;
};

export type TnGateVerification = {
  release_gate_passed?: boolean;
  missing?: string[];
  pending_certificates?: string[];
  hubs: TnPageEvidence[];
};

export function tnSixHubIdsComplete(hubs: TnGateHub[] = listTnHubs()): boolean {
  if (!Array.isArray(hubs) || hubs.length !== REQUIRED_TN_HUB_IDS.length) return false;
  const ids = hubs.map((hub) => hub.hub_id);
  if (new Set(ids).size !== REQUIRED_TN_HUB_IDS.length) return false;
  return REQUIRED_TN_HUB_IDS.every((id) => ids.includes(id));
}

export function normalizeTnPublicUrl(value: string | null | undefined): string | null {
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

export function urlsAreSameTnPage(actual: string | null | undefined, expected: string): boolean {
  const left = normalizeTnPublicUrl(actual);
  const right = normalizeTnPublicUrl(expected);
  return Boolean(left && right && left === right);
}

export function evaluateTnPageEvidence(probe: TnPageEvidence, expectedUrl: string): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (probe.http_status !== 200) reasons.push('http_status');
  if (probe.sso !== false) reasons.push('sso');
  const finalUrl = probe.final_url ?? probe.url ?? null;
  if (!urlsAreSameTnPage(finalUrl, expectedUrl)) reasons.push('final_url');
  if (!urlsAreSameTnPage(probe.canonical, expectedUrl)) reasons.push('canonical');
  const robots = `${probe.robots ?? ''} ${probe.x_robots_tag ?? ''}`;
  if (/noindex/i.test(robots) || probe.not_noindex === false) reasons.push('noindex');
  if (probe.headline_ok !== true) reasons.push('headline');
  if (probe.intended_intelligence_page === false) reasons.push('not_intelligence_page');
  return { ok: reasons.length === 0, reasons };
}

/**
 * Every hub must be CLOSED_PRODUCTION_VERIFIED at its accepted SHA and fingerprint and its live
 * /tennessee page must pass, or Ask /tennessee stays noindex and out of the state catalog.
 */
export function tnReleaseGatePassed(
  manifest: TnGateManifest = TN_PUBLICATION_MANIFEST,
  verification: TnGateVerification = TN_VERIFICATION,
): boolean {
  if (!tnSixHubIdsComplete(manifest.hubs)) return false;
  if (manifest.scope !== 'STATE_LEVEL_ONLY') return false;
  if (manifest.hardcoded_city_routes !== false) return false;
  if (manifest.hardcoded_county_routes !== false) return false;
  if (!Array.isArray(verification.hubs) || verification.hubs.length !== REQUIRED_TN_HUB_IDS.length) return false;
  if ((verification.missing ?? []).length !== 0) return false;
  if ((verification.pending_certificates ?? []).length !== 0) return false;
  for (const hub of manifest.hubs) {
    const id = hub.hub_id as SpecialistHubId;
    const accepted = ACCEPTED_TN_SPECIALIST_RELEASES[id];
    if (!accepted) return false;
    if (hub.specialist_status !== 'CLOSED_PRODUCTION_VERIFIED') return false;
    if (hub.canonical_state_url !== accepted.canonical_state_url) return false;
    if (hub.snapshot_version !== accepted.snapshot_version) return false;
    if (hub.fingerprint !== accepted.fingerprint) return false;
    if (hub.certified_release_sha !== accepted.certified_release_sha) return false;
    if (hub.publication_status !== 'live') return false;
    const verified = verification.hubs.find((row) => row.hub_id === hub.hub_id);
    if (!verified || verified.specialist_status !== 'CLOSED_PRODUCTION_VERIFIED') return false;
    const page = evaluateTnPageEvidence(
      { ...verified, url: verified.url ?? verified.expected_url ?? hub.canonical_state_url },
      accepted.canonical_state_url,
    );
    if (!page.ok) return false;
  }
  return true;
}

// Cities that exist elsewhere too: they imply Tennessee only with a TrustHub vertical term and no
// other state named. Franklin, Jackson, Clarksville, Columbia and Cleveland need "Tennessee".
const TN_CITY_RE = /\b(nashville|memphis|knoxville|chattanooga|murfreesboro)\b/i;
const TN_SHARED_CITY_RE = /\b(franklin|jackson|clarksville|columbia|cleveland|johnson city|kingsport)\b/i;
const TN_TOKEN_RE = /\btennessee\b|\btenn\.(?=\s|$|,)/i;
const VERTICAL_RE =
  /\b(movers?|moving|household[- ]goods|intrastate|mortgages?|lenders?|nmls|mlos?|loan originators?|hmda|contractors?|home improvement|hic|lle|llp|electricians?|plumbers?|insurance|insurers?|naic|npn|producers?|agents?|agenc(?:y|ies)|nursing homes?|assisted living|aclfs?|rhas?|homes? for the aged|home[- ]health|hospices?|senior|ccn|investment|investors?|advis(?:er|or)s?|rias?|eras?|securities|broker[- ]?dealers?|crd|notice filings?|consent orders?|cease and desist)\b/i;
const OTHER_STATE_NAMES = US_JURISDICTIONS.filter((j) => j.code !== 'TN' && j.kind === 'state').map((j) => j.name.toLowerCase());
// Two-letter codes that are ordinary words or other contracts (Medicare Advantage "MA", "ID") are not
// used as evidence of another state for city-only routing. "Nashville GA" still means Georgia.
const AMBIGUOUS_CODES = new Set(['IN', 'OR', 'ME', 'OK', 'HI', 'MA', 'ID']);
const OTHER_STATE_CODES = US_JURISDICTIONS.filter((j) => j.code !== 'TN').map((j) => j.code);

function tnTokenIndex(query: string): number {
  const named = query.search(TN_TOKEN_RE);
  const code = query.search(/\bTN\b/);
  if (named < 0) return code;
  if (code < 0) return named;
  return Math.min(named, code);
}

/** Index of the first other state named in the query ("Washington County" is a Tennessee county, not the state). */
export function firstOtherStateIndex(query: string): number {
  let first = -1;
  for (const name of OTHER_STATE_NAMES) {
    const re = new RegExp(`\\b${name.replace(/\s+/g, '\\s+')}\\b(?!\\s+county)`, 'i');
    const at = query.search(re);
    if (at >= 0 && (first < 0 || at < first)) first = at;
  }
  if (/\bwest\s+virginia\b/i.test(query)) {
    const at = query.search(/\bwest\s+virginia\b/i);
    if (first < 0 || at < first) first = at;
  }
  return first;
}

function otherStateCodeNamed(query: string): boolean {
  return (query.match(/\b[A-Z]{2}\b/g) ?? []).some((token) => OTHER_STATE_CODES.includes(token) && !AMBIGUOUS_CODES.has(token));
}

/** Tennessee (or TN) is named, and no other state is named before it. */
export function tennesseeNamedFirst(query: string): boolean {
  const tn = tnTokenIndex(query);
  if (tn < 0) return false;
  const other = firstOtherStateIndex(query);
  return other < 0 || tn < other;
}

export function detectTnCity(query: string): string | undefined {
  const named = tnTokenIndex(query) >= 0;
  const city = query.match(TN_CITY_RE) ?? (named ? query.match(TN_SHARED_CITY_RE) : null);
  if (!city?.[1]) return undefined;
  if (!named && !queryLooksLikeTennessee(query)) return undefined;
  return city[1].replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function queryLooksLikeTennessee(query: string): boolean {
  if (tennesseeNamedFirst(query)) return true;
  if (tnTokenIndex(query) >= 0) return false; // Tennessee named after another state: that state wins
  if (!TN_CITY_RE.test(query) || !VERTICAL_RE.test(query)) return false;
  return firstOtherStateIndex(query) < 0 && !otherStateCodeNamed(query);
}

export const TN_SEMANTIC_GUARDRAILS = {
  missing_ne_zero: 'Unavailable official evidence is unknown, not zero.',
  no_trust_score: 'AskTrustHub does not publish a Trust Score.',
  no_ranking: 'AskTrustHub does not publish paid rankings or best, safest, or recommended winners.',
  city_deferred:
    'Nashville, Memphis, Knoxville and Chattanooga are geography, not separate Tennessee regulatory systems. No Tennessee city or county Ask route is published.',
  move_authority_ne_usdot:
    'Tennessee Revenue grants Intrastate Authority but publishes no roster or carrier search, so there is no Tennessee mover count (unknown, not zero). Intrastate Authority is not a USDOT or MC number; exact USDOT joins 0, exact MC joins 0. A Tennessee address is not Tennessee authority. The household-goods estimate, weight, claims and tariff rules were repealed effective 2026-03-09 and are not current consumer protections. Form H cargo insurance and the current cargo-liability minimums ($5,000 per vehicle; $10,000 at any one time and place) remain.',
  lender_regulator_ne_registry:
    'TDFI regulates Tennessee mortgage lenders, brokers, servicers and MLOs; NMLS Consumer Access is the licensing verification path. No Tennessee bulk license roster was acquired, so lender, broker, servicer, MLO and branch counts are unknown, not zero. 10 TDFI enforcement orders are listed (9 retrieved, 1 mortgage-related), standalone with 0 exact NMLS attachments. HMDA 2025 shows 302,219 applications for Tennessee properties: loan activity, not licensing, and an LEI is not an NMLS ID. No combined Tennessee lender count.',
  contractor_license_ne_contractor:
    '29,096 Tennessee Contractor license numbers are on the Board for Licensing Contractors dashboard (the $25,000+ Contractor license only; 20,460 Active as published). That is license numbers, not contractors. Home Improvement (HIC), Limited Licensed Electrician (LLE) and Limited Licensed Plumber (LLP) are separate credentials whose rosters were not acquired. A qualifying agent is not a contractor. 679 discipline rows (January 2024 to August 2026) are standalone events; an exact contractor license number is the identity.',
  insurance_insurer_ne_agency:
    '2,029 distinct NAIC codes on TDCI\'s List of Licensed Insurance Companies (as of 2026-08-31); 2,115 listed rows across 13 company types, never summed; 72 NAIC 99999 placeholder rows are not identities. An insurer is not an agency or producer, NAIC is not NPN, domicile is not Tennessee authority, and Eligible surplus lines is not Licensed. Company actions, activity events and examinations are separate and never attached by name. Agency and producer bulk rosters were not acquired.',
  senior_classes_separate:
    '326 HFC Nursing Home licenses (July 2026 bed report) are one class. 331 Assisted Care Living Facilities, 39 Residential Homes for the Aged, county Home Health and Hospice lists, and CMS (303 nursing homes, 128 home health, 61 hospice) stay separate. State HFC licensure is not CMS certification. No combined facility or bed total. Proven exact state-to-CMS bridges: 0, which is not zero overlap. The Adult Care Home list was not acquired.',
  investor_registration_lenses:
    '327 APPROVED Tennessee state IA firms (IAPD 2026-09-17) are state registration only. 38 ERA, 2,685 federal notice filings and 264 principal-office firms are separate lenses. An IAR is not a firm and a broker-dealer is not an adviser; IAR and state broker-dealer and agent populations were not acquired. Consent Orders (273 listings), Cease and Desist Orders (52) and Final Administrative Orders (79) are separate archives; only an exact CRD attaches (3 firm links). No combined Tennessee investment-professional count.',
  bare_license_ambiguous:
    'A bare Tennessee license number is ambiguous: contractor, HFC facility, insurance and securities numbers collide. Ask does not guess the credential from the number. Name it, for example "Tennessee contractor license 1742" or "Tennessee ACLF license 115".',
} as const;

export function tnCaveatForHub(id: SpecialistHubId): string {
  switch (id) {
    case 'move':
      return TN_SEMANTIC_GUARDRAILS.move_authority_ne_usdot;
    case 'lender':
      return TN_SEMANTIC_GUARDRAILS.lender_regulator_ne_registry;
    case 'contractor':
      return TN_SEMANTIC_GUARDRAILS.contractor_license_ne_contractor;
    case 'insurance':
      return TN_SEMANTIC_GUARDRAILS.insurance_insurer_ne_agency;
    case 'senior':
      return TN_SEMANTIC_GUARDRAILS.senior_classes_separate;
    case 'investor':
      return TN_SEMANTIC_GUARDRAILS.investor_registration_lenses;
    default:
      return TN_SEMANTIC_GUARDRAILS.missing_ne_zero;
  }
}

export type TnRoute = {
  hubId: SpecialistHubId;
  stateCode: 'TN';
  intentFamily: string;
  destination: string;
  caveat: string;
};

/** Exact labeled identifiers stay in identifier mode ahead of any Tennessee routing. */
export function tnLabeledIdentifier(query: string): boolean {
  if (/\b(usdot|dot|mc|nmls|naic|npn|ccn|crd|iard|sec(?:\s+number|\s+file)?)\b[\s#:.-]*\d/i.test(query)) return true;
  if (/\bsec\s+(?:file\s+)?(?:no\.?\s*)?\d{3}-\d+/i.test(query)) return true;
  return /\blicen[cs]e\s*(?:number|no\.?|#)?\s*[A-Z]?\d{2,}/i.test(query);
}

/** "license 115" with no credential class or vertical: never guessed across hubs. */
export function tnBareLicenseAmbiguous(query: string): boolean {
  if (!/\blicen[cs]e\s*(?:number|no\.?|#)?\s*[A-Z]?\d{2,}/i.test(query)) return false;
  return !/\b(contractor|home improvement|hic|lle|llp|electric|plumb|nursing|aclf|assisted|rha|home for the aged|homes for the aged|home health|hospice|insurance|insurer|producer|agent|agency|npn|naic|mortgage|lender|nmls|mlo|securities|adviser|advisor|broker|crd|mover|moving|intrastate)\w*/i.test(query);
}

/** Exact Tennessee credential routes that the specialists answer: contractor license lookup and HFC class licenses. */
export function tnExactCredentialRoute(query: string): TnRoute | undefined {
  if (!tennesseeNamedFirst(query) && !queryLooksLikeTennessee(query)) return undefined;
  // The shared parser has no SEC file-number family; keep it an investor identifier, not a place search.
  const secFile = query.match(/\bsec\b(?:\s+(?:file|number))?(?:\s+(?:no\.?|#))?\s*(\d{3}-\d{3,6})\b/i)?.[1];
  if (secFile) {
    return {
      hubId: 'investor',
      stateCode: 'TN',
      intentFamily: 'sec_file_number',
      destination: `${CANONICAL_ORIGINS.investor}/ask?q=${encodeURIComponent(query)}`,
      caveat: `SEC file ${secFile} is an exact identifier on InvestorTrustHub, not a Tennessee registration answer. ${TN_SEMANTIC_GUARDRAILS.investor_registration_lenses}`,
    };
  }
  const number = query.match(/\blicen[cs]e\s*(?:number|no\.?|#)?\s*(\d{2,})/i)?.[1];
  if (!number) return undefined;
  if (/\bcontractor\b/i.test(query) && !/\b(home improvement|hic|lle|llp)\b/i.test(query)) {
    return {
      hubId: 'contractor',
      stateCode: 'TN',
      intentFamily: 'contractor_license',
      destination: `${tnSpecialistUrl('contractor')}?license=${number}#tn-license-lookup`,
      caveat: `Exact Tennessee Contractor license ${number} on the Board dashboard. A license number is the identity; no match is not proof of unlicensed work. ${TN_SEMANTIC_GUARDRAILS.contractor_license_ne_contractor}`,
    };
  }
  if (/\b(nursing home|aclf|assisted care|assisted living|rha|home for the aged|homes for the aged)\b/i.test(query)) {
    return {
      hubId: 'senior',
      stateCode: 'TN',
      intentFamily: 'hfc_license',
      destination: `${CANONICAL_ORIGINS.senior}/ask?q=${encodeURIComponent(query)}`,
      caveat: `Exact HFC facility license ${number} within the named class. State HFC licensure is not CMS certification. ${TN_SEMANTIC_GUARDRAILS.senior_classes_separate}`,
    };
  }
  return undefined;
}

function rankingAsked(query: string): boolean {
  return /\b(best|safest|top|worst|recommended|trust\s*score)\b/i.test(query);
}

export function classifyTnHub(query: string): SpecialistHubId | undefined {
  const q = query.toLowerCase();
  if (/\b(movers?|moving|household[- ]goods|intrastate authority|intrastate movers?|moving regulations?|moving rules)\b/.test(q)) return 'move';
  if (/\b(mortgages?|nmls|hmda|lenders?|loan originators?|mlos?)\b/.test(q) && !/\badvis|securit/.test(q)) return 'lender';
  if (/\b(nursing homes?|assisted living|assisted care living|aclfs?|rhas?|residential homes? for the aged|homes? for the aged|home[- ]health|hospices?|senior|adult care homes?|ccn)\b/.test(q)) return 'senior';
  if (/\b(insurance|insurers?|naic|npn|producers?)\b/.test(q)) return 'insurance';
  if (/\b(contractors?|home improvement|hic|lle|llp|limited licensed|electricians?|plumbers?|qualifying agents?|discipline)\b/.test(q)) return 'contractor';
  if (/\b(investment advis\w*|state[- ]registered advis\w*|advis(?:er|or)s?|investors?|rias?|eras?|securities|broker[- ]?dealers?|crd|iard|notice filings?|consent orders?|cease and desist|final administrative orders?)\b/.test(q)) return 'investor';
  if (/\bagenc(?:y|ies)\b/.test(q)) return 'insurance';
  return undefined;
}

/**
 * Tennessee questions the gateway itself answers: a combined total (rejected) or complaints with no
 * vertical (each hub has its own complaint path; no counts). No specialist hub is claimed.
 */
export function tnGatewayOnlyQuery(query: string): 'cross_hub_total' | 'ambiguous_complaints' | undefined {
  if (!queryLooksLikeTennessee(query) || classifyTnHub(query)) return undefined;
  if (/\bcross[- ]hub\b|\b(all|total|every|combined|how many)\b[\s\S]*\b(records?|businesses|providers|professionals|trust\s*hub)\b/i.test(query)) {
    return 'cross_hub_total';
  }
  if (/\bcomplaints?\b/i.test(query)) return 'ambiguous_complaints';
  return undefined;
}

export const TN_GATEWAY_ONLY_REASONS = {
  cross_hub_total: `${TN_PUBLICATION_MANIFEST.expansion_ledger.CROSS_HUB_RECORD_TOTAL.explanation} Cross-hub record total: ${TN_PUBLICATION_MANIFEST.expansion_ledger.CROSS_HUB_RECORD_TOTAL.status}. Open Ask /tennessee for the six specialist sources.`,
  ambiguous_complaints:
    'Tennessee complaint paths differ by hub (TDFI, TDCI, the contractor board, HFC, the Securities Division and Revenue or the Attorney General). Name the vertical. Ask /tennessee lists the six specialist pages; no complaint counts are published, and a complaint is not a finding.',
} as const;

function contractorAnchor(query: string): string {
  if (/\b(home improvement|hic)\b/i.test(query)) return '#home-improvement';
  if (/\b(lle|electricians?|limited licensed electrician)\b/i.test(query)) return '#lle';
  if (/\b(llp|plumbers?|limited licensed plumber)\b/i.test(query)) return '#llp';
  if (/\bdisciplin/i.test(query)) return '#discipline';
  return '';
}

export function routeTnAsk(query: string): TnRoute | undefined {
  if (tnLabeledIdentifier(query)) return undefined;
  if (!queryLooksLikeTennessee(query)) return undefined;
  const hubId = classifyTnHub(query);
  if (!hubId) return undefined;
  const caveat = rankingAsked(query)
    ? `${tnCaveatForHub(hubId)} Ask does not select a winner. Compare the specialist evidence.`
    : tnCaveatForHub(hubId);
  const anchor = hubId === 'contractor' ? contractorAnchor(query) : '';
  return {
    hubId,
    stateCode: 'TN',
    intentFamily: hubId,
    destination: `${tnSpecialistUrl(hubId)}${anchor}`,
    caveat,
  };
}

export function tnConciergeContext(): string {
  const gate = tnReleaseGatePassed();
  return `## Tennessee network context
AskTrustHub /tennessee is the network gateway. Specialist /tennessee pages own the evidence.
Tennessee research is STATE LEVEL ONLY. Nashville, Memphis, Knoxville and Chattanooga are geography, not separate regulatory systems. Do not invent city or county routes.
A bare "license <number>" without a credential class is ambiguous in Tennessee; ask which credential.
Six-hub specialist publication gate: ${gate ? 'passed' : 'failed'}. Blocker: ${TN_PUBLICATION_MANIFEST.release_gate.blocker ?? 'none'}.
Do not add hub counts into a Tennessee business, provider, or professional total.
${Object.values(TN_SEMANTIC_GUARDRAILS).join('\n')}
${Object.values(TN_GATEWAY_ONLY_REASONS).join('\n')}
`;
}
