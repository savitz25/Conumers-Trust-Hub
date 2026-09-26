import { createHash } from 'node:crypto';
import manifestJson from '../../data/network/nevada-publication-manifest.json' with { type: 'json' };
import verificationJson from '../../data/network/nevada-verification.json' with { type: 'json' };
import type { SpecialistHubId } from './registry.ts';
import { CANONICAL_ORIGINS } from './registry.ts';
import { US_JURISDICTIONS } from './us-jurisdictions.ts';
import { evaluateTnPageEvidence, type TnGateHub, type TnGateManifest, type TnGateVerification } from './tn-network.ts';

export const NV_NETWORK_CONTRACT = 'ath-nv-network-release-v1' as const;

export const REQUIRED_NV_HUB_IDS = [
  'contractor',
  'move',
  'senior',
  'lender',
  'insurance',
  'investor',
] as const satisfies readonly SpecialistHubId[];

export const NV_FINGERPRINT_METHOD =
  'Accepted specialist snapshot artifact at the certified repository SHA. Public HTML confirms the intended state page; the fingerprint is not recomputed from HTML.';

export const ACCEPTED_NV_SPECIALIST_RELEASES: Record<
  SpecialistHubId,
  { snapshot_version: string; fingerprint: string; certified_release_sha: string; canonical_state_url: string }
> = {
  move: {
    snapshot_version: 'move-nv-state-intel-v1',
    fingerprint: '4a8af0569b5d5d023dbdcd7b37ac30842158282d11e45fd7ffbfd8cfa43d4f80',
    certified_release_sha: 'd0dddb4e93ec1e5557e0fa006ae020cc2407b2e8',
    canonical_state_url: 'https://www.movetrusthub.com/nevada',
  },
  lender: {
    snapshot_version: 'lender-nv-state-intel-v1',
    fingerprint: 'a38a2aa9b3929f04c4cbea42a435866e6f1f31e41dc570e0b7ec1a7145ac6400',
    certified_release_sha: 'a8dafcda82b5e2c561aa38ffd5fad60f097c226d',
    canonical_state_url: 'https://www.lendertrusthub.com/nevada',
  },
  contractor: {
    snapshot_version: 'contractor-nv-state-intel-v1',
    fingerprint: 'a0fd24f0af96fda1408c53af35675961dc7beb529b1e90336162e12a433ccbaa',
    certified_release_sha: 'c6835be2c61b98fdaf5959d507a22a78f56ab615',
    canonical_state_url: 'https://www.contractortrusthub.com/nevada',
  },
  insurance: {
    snapshot_version: 'insurance-nv-state-intel-v1',
    fingerprint: '633d2f8bbcde1f817532ccf3c02e9ba0deda879ed4ebac79046736acbcf19c55',
    certified_release_sha: '9bd835860b68507546deb0392bd5d261e327eaeb',
    canonical_state_url: 'https://www.insurancetrusthub.com/nevada',
  },
  senior: {
    snapshot_version: 'senior-nv-state-intel-v1',
    fingerprint: '43e036b7d3db32c9c76393a79b51163f5d8de5014d90899213639715dd49b640',
    certified_release_sha: '234c6b09a019da362b1c383418d13e3715a5fbca',
    canonical_state_url: 'https://www.seniortrusthub.com/nevada',
  },
  investor: {
    snapshot_version: 'investor-nv-state-intel-v1',
    fingerprint: '951496e8f1ef02f7b2777455e965b0768c0a89c610dbe8d2a3b4ed192661f6f6',
    certified_release_sha: '68fa8d10ccc2fe71e61ca078ef26d79a0ea44b15',
    canonical_state_url: 'https://www.investortrusthub.com/nevada',
  },
};

export type NvHubManifest = (typeof manifestJson)['hubs'][number];
export const NV_PUBLICATION_MANIFEST = manifestJson;
export const NV_VERIFICATION = verificationJson;

const VOLATILE_KEYS = new Set(['verified_at', 'verifiedAt', 'generated_at', 'generatedAt']);

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !VOLATILE_KEYS.has(key))
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`).join(',')}}`;
}

/** Ask canonical semantic fingerprint (same method as Tennessee). Controls release. */
export function nvPublicationSemanticFingerprint(
  manifest: typeof NV_PUBLICATION_MANIFEST = NV_PUBLICATION_MANIFEST,
): string {
  return createHash('sha256').update(canonicalJson(manifest)).digest('hex');
}

export const NV_PUBLICATION_FINGERPRINT = nvPublicationSemanticFingerprint();

export function listNvHubs(): NvHubManifest[] {
  return NV_PUBLICATION_MANIFEST.hubs;
}

export function nvHubById(id: SpecialistHubId): NvHubManifest | undefined {
  return NV_PUBLICATION_MANIFEST.hubs.find((h) => h.hub_id === id);
}

export function nvSpecialistUrl(id: SpecialistHubId): string {
  return nvHubById(id)?.canonical_state_url ?? `${CANONICAL_ORIGINS[id]}/nevada`;
}

export function nvSixHubIdsComplete(hubs: TnGateHub[] = listNvHubs()): boolean {
  if (!Array.isArray(hubs) || hubs.length !== REQUIRED_NV_HUB_IDS.length) return false;
  const ids = hubs.map((hub) => hub.hub_id);
  if (new Set(ids).size !== REQUIRED_NV_HUB_IDS.length) return false;
  return REQUIRED_NV_HUB_IDS.every((id) => ids.includes(id));
}

/**
 * Every hub must be CLOSED_PRODUCTION_VERIFIED at its accepted SHA and fingerprint and its live
 * /nevada page must pass, or Ask /nevada stays noindex and out of the state catalog.
 */
export function nvReleaseGatePassed(
  manifest: TnGateManifest = NV_PUBLICATION_MANIFEST,
  verification: TnGateVerification = NV_VERIFICATION,
): boolean {
  if (!nvSixHubIdsComplete(manifest.hubs)) return false;
  if (manifest.scope !== 'STATE_LEVEL_ONLY') return false;
  if (manifest.hardcoded_city_routes !== false) return false;
  if (manifest.hardcoded_county_routes !== false) return false;
  if (!Array.isArray(verification.hubs) || verification.hubs.length !== REQUIRED_NV_HUB_IDS.length) return false;
  if ((verification.missing ?? []).length !== 0) return false;
  if ((verification.pending_certificates ?? []).length !== 0) return false;
  for (const hub of manifest.hubs) {
    const id = hub.hub_id as SpecialistHubId;
    const accepted = ACCEPTED_NV_SPECIALIST_RELEASES[id];
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

// Nevada cities imply Nevada only with a TrustHub vertical term and no other state named
// ("Las Vegas NM", "Reno Texas" and "Henderson Kentucky" are not Nevada).
const NV_CITY_RE = /\b(north las vegas|las vegas|reno|henderson|carson city)\b/i;
const NV_TOKEN_RE = /\bnevada\b|\bnev\.(?=\s|$|,)/i;
const VERTICAL_RE =
  /\b(movers?|moving|household[- ]goods|intrastate|cpcns?|tariffs?|mortgages?|lenders?|nmls|mlos?|loan originators?|servicers?|escrow|hmda|contractors?|roofers?|roofing|electricians?|plumbers?|monetary limit|insurance|insurers?|naic|npn|producers?|agents?|agenc(?:y|ies)|nursing homes?|skilled nursing|snfs?|assisted living|rfgs?|residential facilit(?:y|ies) for groups|alzheimer'?s?|memory care|dementia|hic|home for individual residential care|home[- ]health|hha|hospices?|adult day|senior|ccn|hcqc|investment|investors?|advis(?:er|or)s?|rias?|eras?|securities|broker[- ]?dealers?|crd|notice filings?)\b/i;
const OTHER_STATE_NAMES = US_JURISDICTIONS.filter((j) => j.code !== 'NV' && j.kind === 'state').map((j) => j.name.toLowerCase());
// Two-letter codes that are ordinary words or other contracts are not evidence of another state
// (same exclusions as the Tennessee contract).
const AMBIGUOUS_CODES = new Set(['IN', 'OR', 'ME', 'OK', 'HI', 'MA', 'ID']);
const OTHER_STATE_CODES = US_JURISDICTIONS.filter((j) => j.code !== 'NV').map((j) => j.code);

function nvTokenIndex(query: string): number {
  const named = query.search(NV_TOKEN_RE);
  const code = query.search(/\bNV\b/);
  if (named < 0) return code;
  if (code < 0) return named;
  return Math.min(named, code);
}

function firstOtherStateNameIndex(query: string): number {
  let first = -1;
  for (const name of OTHER_STATE_NAMES) {
    const re = new RegExp(`\\b${name.replace(/\s+/g, '\\s+')}\\b(?!\\s+county)`, 'i');
    const at = query.search(re);
    if (at >= 0 && (first < 0 || at < first)) first = at;
  }
  return first;
}

function firstOtherStateCode(query: string): { index: number; code: string } | undefined {
  const re = /\b[A-Z]{2}\b/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(query)) !== null) {
    if (OTHER_STATE_CODES.includes(match[0]) && !AMBIGUOUS_CODES.has(match[0])) return { index: match.index, code: match[0] };
  }
  return undefined;
}

/** Nevada (or NV) is named, and no other state, by full name or two-letter code, is named before it. */
export function nevadaNamedFirst(query: string): boolean {
  const nv = nvTokenIndex(query);
  if (nv < 0) return false;
  const others = [firstOtherStateNameIndex(query), firstOtherStateCode(query)?.index ?? -1].filter((at) => at >= 0);
  return others.length === 0 || nv < Math.min(...others);
}

/**
 * "movers CA and Nevada": a state code named before Nevada wins (ATH-TN-001R contract). The shared
 * geography fallback reads full names before codes, so the parser asks for this state explicitly.
 */
export function stateCodeNamedBeforeNevada(query: string): string | undefined {
  const nv = nvTokenIndex(query);
  if (nv < 0) return undefined;
  const code = firstOtherStateCode(query);
  if (!code || code.index > nv) return undefined;
  const name = firstOtherStateNameIndex(query);
  if (name >= 0 && name < code.index) return undefined; // an earlier full name is handled by the shared parser
  return code.code;
}

export function detectNvCity(query: string): string | undefined {
  const city = query.match(NV_CITY_RE)?.[1];
  if (!city) return undefined;
  if (nvTokenIndex(query) < 0 && !queryLooksLikeNevada(query)) return undefined;
  return city.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function queryLooksLikeNevada(query: string): boolean {
  if (nevadaNamedFirst(query)) return true;
  if (nvTokenIndex(query) >= 0) return false; // Nevada named after another state: that state wins
  if (!NV_CITY_RE.test(query) || !VERTICAL_RE.test(query)) return false;
  return firstOtherStateNameIndex(query) < 0 && !firstOtherStateCode(query) && !/\bnew mexico\b|\bN\.?M\.?\b/.test(query);
}

export const NV_SEMANTIC_GUARDRAILS = {
  missing_ne_zero: 'Unavailable official evidence is unknown, not zero.',
  no_trust_score: 'AskTrustHub does not publish a Trust Score.',
  no_ranking: 'AskTrustHub does not publish paid rankings or best, safest, or recommended winners.',
  city_deferred:
    'Las Vegas, Reno, Henderson, Carson City and North Las Vegas are geography, not separate Nevada regulatory systems. No Nevada city or county Ask route is published.',
  move_cpcn_ne_usdot:
    'The Nevada Transportation Authority lists 46 distinct household-goods CPCN identities: 41 on its Active Mover list and 5 proven by NTA-filed documents. A CPCN is not a USDOT or MC number; exact USDOT joins 0, exact MC joins 0. A tariff on file is not a quote, and an application is not a certificate. The NTA pages print no as-of date.',
  lender_activity_ne_licensee:
    'The Nevada Division of Mortgage Lending licenses mortgage companies, MLOs, servicers and escrow; licenses are verified on NMLS Consumer Access and the Nevada SRS search. No bulk company, MLO, branch or escrow roster was acquired, so those counts are unknown, not zero. The MLD enforcement index lists 189 rows (2012-2026) with 188 linked documents, read 2019-2026. HMDA 2025 shows 119,768 applications, 69,135 originations and 20,655 denials for Nevada properties: loan activity, not a lender count. No combined Nevada lender total.',
  contractor_license_ne_contractor:
    '19,213 active Nevada contractor license numbers are in the State Contractors Board directory (Board as-of 9/25/2026 10:32:43 AM). That is license numbers, not contractors; 21,937 license-to-classification links are a different grain. A monetary limit is a regulatory contract limit, not revenue or quality. The qualified individual is a person and was not acquired in bulk. 609 discipline rows; 287 attach to an active license by exact license number only.',
  insurance_census_is_dated:
    "The Nevada Division of Insurance publishes its own licensee census in its 2025 Market Report, dated October 2024 (for example 1,652 licensed insurers). Those are NDOI's figures, not current identity counts. Company, agency and producer bulk lists were not acquired. An insurer is not an agency or a producer. Complaint data are reason rows (2022-2024), not complaints or company rates. One current enforcement order is listed; nothing is attached by name.",
  senior_classes_separate:
    'HCQC licenses 58 Facilities for Skilled Nursing, 8 hospital distinct-part SNFs, 438 Residential Facilities for Groups, 145 Homes for Individual Residential Care (HIC), 27 Adult Day Care facilities, 306 Home Health agencies (plus 9 branches), 242 hospice programs and 4 hospice facilities. An RFG is not assisted living by default: 74 hold the Assisted Living endorsement and 223 the Alzheimer\'s endorsement. A state license is not CMS certification; 418 state rows link to CMS by exact printed CCN. No combined facility or bed total.',
  investor_registration_lenses:
    '271 APPROVED Nevada state IA firms and 83 ACTIVE exempt reporting advisers (IAPD 2026-09-17), 1,982 SEC notice filings (2026-09-18) and 99 Nevada principal-office firms (2026-08-27) are separate lenses with separate clocks. An ERA is not a Nevada-licensed IA and a notice filing is not state registration. Securities Division enforcement actions were not acquired and no other regulator is substituted. No combined Nevada investment-professional count.',
  bare_license_ambiguous:
    'A bare Nevada license number is ambiguous: contractor, HCQC facility, insurance and mortgage numbers collide. Ask does not guess the credential from the number. Name it, for example "Nevada contractor license 0095506" or "Nevada RFG license 116".',
} as const;

export function nvCaveatForHub(id: SpecialistHubId): string {
  switch (id) {
    case 'move':
      return NV_SEMANTIC_GUARDRAILS.move_cpcn_ne_usdot;
    case 'lender':
      return NV_SEMANTIC_GUARDRAILS.lender_activity_ne_licensee;
    case 'contractor':
      return NV_SEMANTIC_GUARDRAILS.contractor_license_ne_contractor;
    case 'insurance':
      return NV_SEMANTIC_GUARDRAILS.insurance_census_is_dated;
    case 'senior':
      return NV_SEMANTIC_GUARDRAILS.senior_classes_separate;
    case 'investor':
      return NV_SEMANTIC_GUARDRAILS.investor_registration_lenses;
    default:
      return NV_SEMANTIC_GUARDRAILS.missing_ne_zero;
  }
}

export type NvRoute = {
  hubId: SpecialistHubId;
  stateCode: 'NV';
  intentFamily: string;
  destination: string;
  caveat: string;
};

const CPCN_RE = /\bcpcn\b\s*(?:no\.?|number|#)?\s*(\d{3,5}(?:\.\d{1,2})?)\b/i;
const HCQC_CREDENTIAL_RE = /\b(\d{2,6}-(?:SNF|SFD|AGC|HIC|ADC|HHA|HBR|HSB|HPC|HFS)-\d{1,3})\b/i;
const SEC_FILE_RE = /\bsec\b(?:\s+(?:file|number))?(?:\s+(?:no\.?|#))?\s*(\d{3}-\d{3,6})\b/i;
const LICENSE_NUMBER_RE = /\b(?:licen[cs]e|credential)\s*(?:number|no\.?|#)?\s*#?\s*[A-Z]?\d{2,}/i;

/** Exact labeled identifiers stay in identifier mode ahead of any Nevada vertical routing. */
export function nvLabeledIdentifier(query: string): boolean {
  if (/\b(usdot|dot|mc|nmls|naic|npn|ccn|crd|iard|sec(?:\s+number|\s+file)?)\b[\s#:.-]*\d/i.test(query)) return true;
  if (CPCN_RE.test(query) || HCQC_CREDENTIAL_RE.test(query) || SEC_FILE_RE.test(query)) return true;
  return LICENSE_NUMBER_RE.test(query);
}

/** "license 115" / "credential 42" with no credential class or vertical: never guessed across hubs. */
export function nvBareLicenseAmbiguous(query: string): boolean {
  if (!LICENSE_NUMBER_RE.test(query)) return false;
  if (HCQC_CREDENTIAL_RE.test(query)) return false;
  return !/\b(contractor|nscb|roof|electric|plumb|nursing|skilled|snf|sfd|rfg|agc|residential facilit|assisted|alzheimer|hic|individual residential|home health|hha|hospice|adult day|hcqc|insurance|insurer|producer|agent|agency|npn|naic|mortgage|lender|nmls|mlo|escrow|servicer|securities|adviser|advisor|broker|crd|mover|moving|cpcn)\w*/i.test(query);
}

const ask = (hub: SpecialistHubId, query: string) => `${CANONICAL_ORIGINS[hub]}/ask?q=${encodeURIComponent(query)}`;

/**
 * Nevada-only identifier formats route to their hub even without the word "Nevada": an NTA CPCN
 * (Move), an HCQC credential such as 116-AGC-41 (Senior), and an SEC file number (Investor) when
 * Tennessee is not the named state (Tennessee owns its own SEC-file handoff).
 */
export function nvIdentifierRoute(query: string, tennesseeNamed = false): NvRoute | undefined {
  const cpcn = query.match(CPCN_RE)?.[1];
  if (cpcn) {
    return {
      hubId: 'move',
      stateCode: 'NV',
      intentFamily: 'nta_cpcn',
      destination: ask('move', query),
      caveat: `CPCN ${cpcn} is an exact Nevada Transportation Authority certificate identifier on MoveTrustHub. ${NV_SEMANTIC_GUARDRAILS.move_cpcn_ne_usdot}`,
    };
  }
  const credential = query.match(HCQC_CREDENTIAL_RE)?.[1];
  if (credential) {
    return {
      hubId: 'senior',
      stateCode: 'NV',
      intentFamily: 'hcqc_credential',
      destination: ask('senior', query),
      caveat: `${credential.toUpperCase()} is an exact Nevada HCQC credential on SeniorTrustHub. A state license is not CMS certification. ${NV_SEMANTIC_GUARDRAILS.senior_classes_separate}`,
    };
  }
  const secFile = query.match(SEC_FILE_RE)?.[1];
  if (secFile && !tennesseeNamed) {
    return {
      hubId: 'investor',
      stateCode: 'NV',
      intentFamily: 'sec_file_number',
      destination: ask('investor', query),
      caveat: `SEC file ${secFile} is an exact identifier on InvestorTrustHub, not a Nevada registration answer. ${NV_SEMANTIC_GUARDRAILS.investor_registration_lenses}`,
    };
  }
  return undefined;
}

/** Exact Nevada credential routes inside Nevada context: class-qualified license numbers. */
export function nvExactCredentialRoute(query: string): NvRoute | undefined {
  if (!queryLooksLikeNevada(query)) return undefined;
  const identifier = nvIdentifierRoute(query);
  if (identifier) return identifier;
  const number = query.match(/\b(?:licen[cs]e|credential)\s*(?:number|no\.?|#)?\s*#?\s*(\d{2,}[A-Z]?)/i)?.[1];
  if (!number) return undefined;
  if (/\bcontractor\b|\bnscb\b/i.test(query)) {
    const digits = number.replace(/[A-Z]$/i, '');
    const exact = digits.padStart(7, '0') + number.slice(digits.length).toUpperCase();
    return {
      hubId: 'contractor',
      stateCode: 'NV',
      intentFamily: 'nscb_license',
      destination: `${nvSpecialistUrl('contractor')}?license=${exact}#license-lookup`,
      caveat: `Exact Nevada contractor license ${exact} in the State Contractors Board active directory. No match is not proof of unlicensed work. ${NV_SEMANTIC_GUARDRAILS.contractor_license_ne_contractor}`,
    };
  }
  if (/\b(nursing|skilled|snf|sfd|rfg|agc|residential facilit|assisted|alzheimer|hic|individual residential|home health|hha|hospice|adult day|hcqc)/i.test(query)) {
    return {
      hubId: 'senior',
      stateCode: 'NV',
      intentFamily: 'hcqc_license',
      destination: ask('senior', query),
      caveat: `HCQC license ${number} within the named class. State HCQC licensure is not CMS certification. ${NV_SEMANTIC_GUARDRAILS.senior_classes_separate}`,
    };
  }
  if (/\b(insurance|insurer|producer|agent|agency|npn|naic)/i.test(query)) {
    return {
      hubId: 'insurance',
      stateCode: 'NV',
      intentFamily: 'ndoi_license',
      destination: ask('insurance', query),
      caveat: `Nevada insurance license ${number} is verified on the NDOI license lookup via InsuranceTrustHub. ${NV_SEMANTIC_GUARDRAILS.insurance_census_is_dated}`,
    };
  }
  if (/\b(mortgage|lender|nmls|mlo|escrow|servicer)/i.test(query)) {
    return {
      hubId: 'lender',
      stateCode: 'NV',
      intentFamily: 'mld_license',
      destination: ask('lender', query),
      caveat: `Nevada mortgage license ${number} is verified on NMLS Consumer Access or the SRS search via LenderTrustHub. ${NV_SEMANTIC_GUARDRAILS.lender_activity_ne_licensee}`,
    };
  }
  return undefined;
}

function rankingAsked(query: string): boolean {
  return /\b(best|safest|top|worst|recommended|trust\s*score)\b/i.test(query);
}

export function classifyNvHub(query: string): SpecialistHubId | undefined {
  const q = query.toLowerCase();
  // Senior first: in Nevada "HIC" is a Home for Individual Residential Care, never a contractor credential.
  if (/\b(rfgs?|residential facilit(?:y|ies) for groups|assisted living|alzheimer'?s?|memory care|dementia|nursing homes?|skilled nursing|snfs?|sfd|hic|homes? for individual residential care|hirc|home[- ]health|hhas?|hospices?|adult day|hcqc|ccn|senior care)\b/.test(q)) return 'senior';
  if (/\b(movers?|moving|household[- ]goods|intrastate movers?|cpcns?|moving tariffs?|nta)\b/.test(q)) return 'move';
  if (/\b(mortgages?|nmls|hmda|lenders?|loan originators?|mlos?|servicers?|escrow|srs|mortgage lending)\b/.test(q) && !/\badvis|securit/.test(q)) return 'lender';
  if (/\b(insurance|insurers?|naic|npn|producers?)\b/.test(q)) return 'insurance';
  if (/\b(contractors?|nscb|monetary limit|roofers?|roofing|electricians?|plumbers?|general building|general engineering|qualified individuals?)\b/.test(q)) return 'contractor';
  if (/\b(investment advis\w*|state[- ]registered advis\w*|advis(?:er|or)s?|investors?|rias?|eras?|exempt reporting|securities|broker[- ]?dealers?|crd|iard|notice filings?)\b/.test(q)) return 'investor';
  if (/\bagenc(?:y|ies)\b/.test(q)) return 'insurance';
  if (/\bdisciplin/.test(q)) return 'contractor';
  return undefined;
}

/**
 * Nevada questions the gateway itself answers: a combined total (rejected) or complaints with no
 * vertical. No specialist hub is claimed.
 */
export function nvGatewayOnlyQuery(query: string): 'cross_hub_total' | 'ambiguous_complaints' | undefined {
  if (!queryLooksLikeNevada(query) || classifyNvHub(query)) return undefined;
  if (/\bcross[- ]hub\b|\b(all|total|every|combined|how many)\b[\s\S]*\b(records?|businesses|companies|providers|professionals|facilities|trust\s*hub)\b/i.test(query)) {
    return 'cross_hub_total';
  }
  if (/\bcomplaints?\b/i.test(query)) return 'ambiguous_complaints';
  return undefined;
}

export const NV_GATEWAY_ONLY_REASONS = {
  cross_hub_total: `${NV_PUBLICATION_MANIFEST.expansion_ledger.CROSS_HUB_RECORD_TOTAL.explanation} Cross-hub record total: ${NV_PUBLICATION_MANIFEST.expansion_ledger.CROSS_HUB_RECORD_TOTAL.status}. Open Ask /nevada for the six specialist sources.`,
  ambiguous_complaints:
    'Nevada complaint paths differ by hub (the Transportation Authority, the Division of Mortgage Lending, the State Contractors Board, the Division of Insurance, HCQC and the Securities Division). Name the vertical. Ask /nevada lists the six specialist pages; no complaint counts are published, and a complaint is not a finding.',
} as const;

function hubAnchor(hubId: SpecialistHubId, query: string): string {
  if (hubId === 'contractor') {
    if (/\bdisciplin|revok|suspend|citation/i.test(query)) return '#discipline';
    if (/\bmonetary limit/i.test(query)) return '#monetary-limit';
    if (/\bqualif/i.test(query)) return '#qualifying-party';
    if (/\bclassification|general building|general engineering|roof|electric|plumb/i.test(query)) return '#classifications';
  }
  if (hubId === 'senior') {
    if (/\balzheimer|memory care|dementia/i.test(query)) return '#memory-care';
    if (/\bassisted living/i.test(query)) return '#assisted-living';
    if (/\brfg|residential facilit/i.test(query)) return '#rfg';
    if (/\bhic\b|individual residential/i.test(query)) return '#hirc';
    if (/\bhome[- ]health|\bhha\b/i.test(query)) return '#home-health';
    if (/\bhospice/i.test(query)) return '#hospice';
    if (/\bskilled|snf|nursing home/i.test(query)) return '#skilled-nursing';
    if (/\binspection|sanction/i.test(query)) return '#inspections';
    if (/\bcomplaint/i.test(query)) return '#complaints';
  }
  return '';
}

export function routeNvAsk(query: string): NvRoute | undefined {
  if (nvLabeledIdentifier(query)) return undefined;
  if (!queryLooksLikeNevada(query)) return undefined;
  const hubId = classifyNvHub(query);
  if (!hubId) return undefined;
  const caveat = rankingAsked(query)
    ? `${nvCaveatForHub(hubId)} Ask does not select a winner. Compare the specialist evidence.`
    : nvCaveatForHub(hubId);
  return {
    hubId,
    stateCode: 'NV',
    intentFamily: hubId,
    destination: `${nvSpecialistUrl(hubId)}${hubAnchor(hubId, query)}`,
    caveat,
  };
}

export function nvConciergeContext(): string {
  const gate = nvReleaseGatePassed();
  return `## Nevada network context
AskTrustHub /nevada is the network gateway. Specialist /nevada pages own the evidence.
Nevada research is STATE LEVEL ONLY. Las Vegas, Reno, Henderson, Carson City and North Las Vegas are geography, not separate regulatory systems. Do not invent city or county routes.
A bare "license <number>" without a credential class is ambiguous in Nevada; ask which credential.
In Nevada, HIC means Home for Individual Residential Care (senior care), not a home improvement contractor.
Six-hub specialist publication gate: ${gate ? 'passed' : 'failed'}. Blocker: ${NV_PUBLICATION_MANIFEST.release_gate.blocker ?? 'none'}.
Do not add hub counts into a Nevada business, provider, or professional total. Source clocks differ by hub; there is no single Nevada source date.
${Object.values(NV_SEMANTIC_GUARDRAILS).join('\n')}
${Object.values(NV_GATEWAY_ONLY_REASONS).join('\n')}
`;
}
