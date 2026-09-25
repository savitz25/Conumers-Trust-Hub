import { createHash } from 'node:crypto';
import manifestJson from '../../data/network/georgia-publication-manifest.json' with { type: 'json' };
import verificationJson from '../../data/network/georgia-verification.json' with { type: 'json' };
import type { SpecialistHubId } from './registry.ts';
import { CANONICAL_ORIGINS, NETWORK_PUBLIC_NAMES } from './registry.ts';
import { tennesseeNamedFirst } from './tn-network.ts';

export const GA_NETWORK_CONTRACT = 'ath-ga-network-release-v1' as const;

export const REQUIRED_GA_HUB_IDS = [
  'contractor',
  'move',
  'senior',
  'lender',
  'insurance',
  'investor',
] as const satisfies readonly SpecialistHubId[];

export const GA_FINGERPRINT_METHOD =
  'Accepted specialist snapshot artifact at the certified repository SHA. Public HTML confirms the intended state page; the fingerprint is not recomputed from HTML. Contractor and Lender files do not embed a snapshot fingerprint, so those two values are the sha256 of the accepted source file at the certified SHA.';

export const ACCEPTED_GA_SPECIALIST_RELEASES: Record<
  SpecialistHubId,
  { snapshot_version: string; fingerprint: string; certified_release_sha: string; canonical_state_url: string }
> = {
  contractor: {
    snapshot_version: 'contractor-ga-state-intel-v1',
    fingerprint: '2c74394b6ee2bbcbc4756d91416e234b4c43df0309a19a0c90f1b235eab7872a',
    certified_release_sha: '9b6ee8e45edebfe62d143443137a4a87ffcc8bf0',
    canonical_state_url: 'https://www.contractortrusthub.com/georgia',
  },
  move: {
    snapshot_version: 'move-ga-state-intel-v1',
    fingerprint: '5619950c36c6cdd7b3f6df516585920c2c7aa245c2a2e82b4f03bc1ec4275e6b',
    certified_release_sha: '2aeffc4fdb9af39017ca8c313f922d653e921cb9',
    canonical_state_url: 'https://www.movetrusthub.com/georgia',
  },
  senior: {
    snapshot_version: 'senior-ga-state-intel-v1',
    fingerprint: '1820ee3a2f723f411dc59654e5633144adaba6be7a79f9cc673b469ee4ec476e',
    certified_release_sha: 'a341b5f6010f2b29724208273691a7c0bb9ab668',
    canonical_state_url: 'https://www.seniortrusthub.com/georgia',
  },
  lender: {
    snapshot_version: 'GA-LEND-001',
    fingerprint: 'c27d483bebafd938eba4218e05366af22d2d2a3605c6c284e259189cf33da827',
    certified_release_sha: 'afb65b73c77fc7a0ca79fa79e030cd45a5166991',
    canonical_state_url: 'https://www.lendertrusthub.com/georgia',
  },
  insurance: {
    snapshot_version: 'insurance-ga-state-intel-v1',
    fingerprint: '64c082caedf4f9c15f12ee28df61f11fced3bb6c3728a864e313a8cc4cbd2608',
    certified_release_sha: '0bb9c96920c0b7de140a7e0fd1975e9a9959eba9',
    canonical_state_url: 'https://www.insurancetrusthub.com/georgia',
  },
  investor: {
    snapshot_version: 'investor-ga-state-intel-v1',
    fingerprint: 'f1c44afc81eb7be3d774c91fb3928e01a4a6542511ea5dde0d079b79f41dbea6',
    certified_release_sha: '32dd2e35c12f8071ec9a234d930c62ad83082d35',
    canonical_state_url: 'https://www.investortrusthub.com/georgia',
  },
};

export type GaHubManifest = (typeof manifestJson)['hubs'][number];
export const GA_PUBLICATION_MANIFEST = manifestJson;
export const GA_VERIFICATION = verificationJson;

const VOLATILE_KEYS = new Set(['verified_at', 'verifiedAt', 'generated_at', 'generatedAt']);

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !VOLATILE_KEYS.has(key))
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`).join(',')}}`;
}

export function gaPublicationSemanticFingerprint(
  manifest: typeof GA_PUBLICATION_MANIFEST = GA_PUBLICATION_MANIFEST,
): string {
  return createHash('sha256').update(canonicalJson(manifest)).digest('hex');
}

export const GA_PUBLICATION_FINGERPRINT = gaPublicationSemanticFingerprint();

export function listGaHubs(): GaHubManifest[] {
  return GA_PUBLICATION_MANIFEST.hubs;
}

export function gaHubById(id: SpecialistHubId): GaHubManifest | undefined {
  return GA_PUBLICATION_MANIFEST.hubs.find((h) => h.hub_id === id);
}

export function gaSpecialistUrl(id: SpecialistHubId): string {
  return gaHubById(id)?.canonical_state_url ?? `${CANONICAL_ORIGINS[id]}/georgia`;
}

export type GaGateHub = {
  hub_id: string;
  canonical_state_url?: string;
  snapshot_version?: string;
  fingerprint?: string;
  certified_release_sha?: string;
  publication_status?: string;
};

export type GaGateManifest = {
  hubs: GaGateHub[];
  scope?: string;
  hardcoded_atlanta_routes?: boolean;
  hardcoded_county_routes?: boolean;
};

export type GaPageEvidence = {
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

export type GaGateVerification = {
  release_gate_passed?: boolean;
  missing?: string[];
  hubs: GaPageEvidence[];
};

export function gaSixHubIdsComplete(hubs: GaGateHub[] = listGaHubs()): boolean {
  if (!Array.isArray(hubs) || hubs.length !== REQUIRED_GA_HUB_IDS.length) return false;
  const ids = hubs.map((hub) => hub.hub_id);
  if (new Set(ids).size !== REQUIRED_GA_HUB_IDS.length) return false;
  return REQUIRED_GA_HUB_IDS.every((id) => ids.includes(id));
}

export function normalizeGaPublicUrl(value: string | null | undefined): string | null {
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

export function urlsAreSameGaPage(actual: string | null | undefined, expected: string): boolean {
  const left = normalizeGaPublicUrl(actual);
  const right = normalizeGaPublicUrl(expected);
  return Boolean(left && right && left === right);
}

export function evaluateGaPageEvidence(
  probe: GaPageEvidence,
  expectedUrl: string,
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (probe.http_status !== 200) reasons.push('http_status');
  if (probe.sso !== false) reasons.push('sso');
  const finalUrl = probe.final_url ?? probe.url ?? null;
  if (!urlsAreSameGaPage(finalUrl, expectedUrl)) reasons.push('final_url');
  if (!urlsAreSameGaPage(probe.canonical, expectedUrl)) reasons.push('canonical');
  const robots = `${probe.robots ?? ''} ${probe.x_robots_tag ?? ''}`;
  if (/noindex/i.test(robots) || probe.not_noindex === false) reasons.push('noindex');
  if (probe.headline_ok !== true) reasons.push('headline');
  if (probe.intended_intelligence_page === false) reasons.push('not_intelligence_page');
  return { ok: reasons.length === 0, reasons };
}

export function gaReleaseGatePassed(
  manifest: GaGateManifest = GA_PUBLICATION_MANIFEST,
  verification: GaGateVerification = GA_VERIFICATION,
): boolean {
  if (!gaSixHubIdsComplete(manifest.hubs)) return false;
  if (manifest.scope !== 'STATE_LEVEL_ONLY') return false;
  if (manifest.hardcoded_atlanta_routes !== false) return false;
  if (manifest.hardcoded_county_routes !== false) return false;
  if (!Array.isArray(verification.hubs) || verification.hubs.length !== REQUIRED_GA_HUB_IDS.length) return false;
  if ((verification.missing ?? []).length !== 0) return false;
  for (const hub of manifest.hubs) {
    const id = hub.hub_id as SpecialistHubId;
    const accepted = ACCEPTED_GA_SPECIALIST_RELEASES[id];
    if (!accepted) return false;
    if (hub.canonical_state_url !== accepted.canonical_state_url) return false;
    if (hub.snapshot_version !== accepted.snapshot_version) return false;
    if (hub.fingerprint !== accepted.fingerprint) return false;
    if (hub.certified_release_sha && hub.certified_release_sha !== accepted.certified_release_sha) return false;
    if (hub.publication_status !== 'live') return false;
    const verified = verification.hubs.find((row) => row.hub_id === hub.hub_id);
    if (!verified) return false;
    const page = evaluateGaPageEvidence(
      { ...verified, url: verified.url ?? verified.expected_url ?? hub.canonical_state_url },
      accepted.canonical_state_url,
    );
    if (!page.ok) return false;
  }
  return true;
}

const GA_CITY_RE = /\b(atlanta|savannah|augusta|macon|columbus)\b/i;

export function detectGaCity(query: string): string | undefined {
  const city = query.match(GA_CITY_RE);
  if (!city?.[1]) return undefined;
  if (city[1].toLowerCase() === 'columbus' && !/\bgeorgia\b/i.test(query)) return undefined;
  return city[1].replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function queryLooksLikeGeorgia(query: string): boolean {
  if (/\bgeorgia\b/i.test(query)) return true;
  if (/\b(atlanta|savannah)\b/i.test(query) && /\b(mover|contractor|mortgage|insurance|nursing|hospice|advis|securit|broker)\b/i.test(query)) {
    return true;
  }
  return false;
}

export const GA_SEMANTIC_GUARDRAILS = {
  missing_ne_zero: 'Unavailable official evidence is unknown, not zero.',
  no_trust_score: 'AskTrustHub does not publish a Trust Score.',
  no_ranking: 'AskTrustHub does not publish paid rankings or best/safest/worst conclusions.',
  atlanta_deferred:
    'Atlanta is geography, not a separate Georgia regulatory system. No Atlanta or county Ask route is published.',
  move_mca_ne_usdot:
    '380 distinct Georgia DPS MCA identities come from 572 deduped location rows. MCA is not USDOT. Exact USDOT joins: 0. Listing is not inferred Active status. Tariff No. 7 is effective 2026-01-13 and is not an interstate rate. Complaint dispositions were not acquired.',
  contractor_orders_ne_census:
    '36 Residential and General Contractor cease-and-desist orders are unlicensed-practice events. They are not a contractor census and not 36 bad contractors. Statewide license rosters were not acquired.',
  senior_cms_separate:
    '356 CMS Nursing Homes, 105 CMS Home Health providers, and 261 CMS Hospice providers stay separate. Do not publish 722 Georgia senior facilities. Georgia state care-setting rosters and GaMap2Care were not acquired. DCH facility statements are not TrustHub denominators.',
  lender_nmls:
    'Georgia DBF mortgage licensing is verified through NMLS. Mortgage broker, mortgage lender, branch, and MLO are separate. No Georgia-only license census was acquired. HMDA is federal activity, not a lender count. Complaints are not publicly disclosed at provider level.',
  insurance_grains:
    'Insurer, agency, and producer are separate. Agency, producer, and company rosters were not acquired. HB410 eliminated branch-agency licensing. Nine standalone receivership events (7 index and 2 later announcements) have 0 NAIC attachments. They are not an insurer census. The 2026 mental-health parity announcement is aggregate only.',
  investor_orders_ne_advisers:
    '57 Georgia Securities Division order documents are standalone events with 0 profile attachments. A caption is not a finding. 364 SEC/IARD firms with a Georgia principal office are not Georgia state registration. Do not add orders and principal-office firms.',
} as const;

export function gaCaveatForHub(id: SpecialistHubId): string {
  switch (id) {
    case 'move':
      return GA_SEMANTIC_GUARDRAILS.move_mca_ne_usdot;
    case 'contractor':
      return GA_SEMANTIC_GUARDRAILS.contractor_orders_ne_census;
    case 'senior':
      return GA_SEMANTIC_GUARDRAILS.senior_cms_separate;
    case 'lender':
      return GA_SEMANTIC_GUARDRAILS.lender_nmls;
    case 'insurance':
      return GA_SEMANTIC_GUARDRAILS.insurance_grains;
    case 'investor':
      return GA_SEMANTIC_GUARDRAILS.investor_orders_ne_advisers;
    default:
      return GA_SEMANTIC_GUARDRAILS.missing_ne_zero;
  }
}

export type GaRoute = {
  hubId: SpecialistHubId;
  stateCode: 'GA';
  intentFamily: string;
  destination: string;
  caveat: string;
};

function earlierStateNamed(query: string): boolean {
  return /\b(ohio|north carolina|pennsylvania|new york|illinois|oregon|virginia|colorado|california|texas|florida|washington|arizona|new jersey|tennessee)\b/i.test(
    query,
  );
}

function labeledIdentifier(query: string): boolean {
  return /\b(usdot|dot|mc|mca|nmls|naic|npn|ccn|crd|sec(?:\s+number|\s+file)?)\b/i.test(query) && /\d/.test(query);
}

export function classifyGaHub(query: string): SpecialistHubId | undefined {
  const q = query.toLowerCase();
  if (/\b(movers?|moving|household[- ]goods|mca|tariff|interstate movers?)\b/.test(q)) return 'move';
  if (/\b(mortgage|nmls|hmda|lenders?|loan originators?|mlos?)\b/.test(q) && !/\badvis|securit/.test(q)) return 'lender';
  if (/\b(nursing homes?|assisted living|personal care homes?|home[- ]health|hospice|senior|facility inspection)\b/.test(q)) return 'senior';
  if (/\b(insurance|insurers?|producers?|agenc(?:y|ies)|receivership|parity)\b/.test(q)) return 'insurance';
  if (/\b(contractors?|electricians?|plumbers?|hvac|conditioned air|cease and desist|cease-and-desist)\b/.test(q)) return 'contractor';
  if (/\b(investment advis\w*|state[- ]registered advis\w*|securities|broker-?dealers?|\bcrd\b|\biard\b)\b/.test(q)) return 'investor';
  return undefined;
}

export function routeGaAsk(query: string): GaRoute | undefined {
  if (tennesseeNamedFirst(query)) return undefined; // ATH-TN-001: Tennessee named first wins
  if (earlierStateNamed(query) && !/\bgeorgia\b/i.test(query)) return undefined;
  if (earlierStateNamed(query) && query.search(/\bgeorgia\b/i) > query.search(/\b(ohio|north carolina|pennsylvania|tennessee)\b/i)) {
    return undefined;
  }
  if (labeledIdentifier(query)) return undefined;
  if (!queryLooksLikeGeorgia(query)) return undefined;
  const hubId = classifyGaHub(query);
  if (!hubId) return undefined;
  return {
    hubId,
    stateCode: 'GA',
    intentFamily: hubId,
    destination: gaSpecialistUrl(hubId),
    caveat: gaCaveatForHub(hubId),
  };
}

export function gaConciergeContext(): string {
  const gate = gaReleaseGatePassed();
  return `## Georgia network context
AskTrustHub /georgia is the network gateway. Specialist /georgia pages own the evidence.
Georgia research is STATE LEVEL ONLY. Atlanta is not a separate regulatory system. Do not invent Atlanta or county routes.
Six-hub specialist publication gate: ${gate ? 'passed' : 'failed'}. Blocker: ${GA_PUBLICATION_MANIFEST.release_gate.blocker ?? 'none'}.
Do not add hub counts into a Georgia business, provider, or professional total.
${Object.values(GA_SEMANTIC_GUARDRAILS).join('\n')}
`;
}
