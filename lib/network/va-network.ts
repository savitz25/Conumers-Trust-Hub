import manifestJson from '../../data/network/virginia-publication-manifest.json' with { type: 'json' };
import type { SpecialistHubId } from './registry.ts';
import { CANONICAL_ORIGINS, NETWORK_PUBLIC_NAMES, SPECIALIST_HUB_IDS } from './registry.ts';

export const VA_NETWORK_CONTRACT = 'ath-va-network-release-v1' as const;
export const VA_PUBLICATION_FINGERPRINT =
  'a6558550fcb6e9a5fdc9241e6c363f1f458495d16575532485a497c19eadcbdd';

export type VaHubManifest = (typeof manifestJson)['hubs'][number];

export const VA_PUBLICATION_MANIFEST = manifestJson;

export function listVaHubs(): VaHubManifest[] {
  return VA_PUBLICATION_MANIFEST.hubs;
}

export function vaHubById(id: SpecialistHubId): VaHubManifest | undefined {
  return VA_PUBLICATION_MANIFEST.hubs.find((h) => h.hub_id === id);
}

export function vaSpecialistUrl(id: SpecialistHubId): string {
  return vaHubById(id)?.canonical_state_url ?? `${CANONICAL_ORIGINS[id]}/virginia`;
}

export function vaSixHubIdsComplete(): boolean {
  const ids = VA_PUBLICATION_MANIFEST.hubs.map((h) => h.hub_id);
  return SPECIALIST_HUB_IDS.every((id) => ids.includes(id)) && new Set(ids).size === 6;
}

export function vaReleaseGatePassed(): boolean {
  return VA_PUBLICATION_MANIFEST.release_gate.passed === true;
}

const VA_CITY_RE =
  /\b(richmond|virginia beach|norfolk|alexandria|arlington|fairfax|chesapeake|newport news|hampton|roanoke|lynchburg|charlottesville)\b/i;
const VA_COUNTY_RE =
  /\b(fairfax|arlington|loudoun|prince william|henrico|chesterfield|virginia beach)\s+county\b/i;
const WEST_VIRGINIA_RE = /\bwest\s+virginia\b/i;
const STANDALONE_VIRGINIA_RE = /(?<!\bwest\s)virginia\b/i;

export function detectVaCity(query: string): string | undefined {
  const m = query.match(VA_CITY_RE);
  if (!m) return undefined;
  return m[1].replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Index of "Virginia" that is not the "Virginia" inside "West Virginia". */
export function standaloneVirginiaIndex(query: string): number {
  const match = STANDALONE_VIRGINIA_RE.exec(query);
  return match?.index ?? -1;
}

export function queryLooksLikeVirginia(query: string): boolean {
  const standalone = standaloneVirginiaIndex(query) >= 0;
  if (WEST_VIRGINIA_RE.test(query) && !standalone) return false;
  if (standalone) return true;
  if (/\bvirginia beach\b/i.test(query)) return true;
  if (/\bdpor\b/i.test(query) && /\b(contractor|license|class a|class b|class c)\b/i.test(query)) {
    return true;
  }
  if (/\b(dss|alf)\b/i.test(query) && /\b(assisted[- ]living|nursing|senior)\b/i.test(query)) return true;
  if (VA_CITY_RE.test(query) || VA_COUNTY_RE.test(query)) return true;
  if (/\bin\s+VA\b/.test(query) || /\bVA\s+(contractor|mover|lender|insur|senior|advis|broker)/i.test(query)) {
    return true;
  }
  return false;
}

export const VA_SEMANTIC_GUARDRAILS = {
  missing_ne_zero: 'Unavailable official evidence is unknown, not zero.',
  search_only_ne_zero: 'Search-only official evidence is unknown, not zero.',
  no_trust_score: 'AskTrustHub does not publish a Trust Score.',
  no_ranking: 'AskTrustHub does not publish paid rankings or best/safest/worst conclusions.',
  no_county_routes:
    'Virginia is state-level only. AskTrustHub does not publish Virginia city or county gateways in this release.',
  contractor_license_ne_company:
    '53,840 is distinct Class A/B/C contractor-business LICENSE NUMBERS, not unique companies, not tradesmen, and not all Virginia construction businesses. 30,120 tradesman/person rows are not contractor businesses. A revocation observation is not a criminal conviction.',
  move_hhg_ne_property:
    '192 Virginia HHG certificate authority numbers are not Property Carrier permits and not a mover census. Do not add 192 + 4,916. Further than 30 miles requires a Virginia HHG certificate; less than 31 road-miles, a qualifying Property Carrier may transport HHG. Virginia DMV authority is not USDOT, not MC authority, and not FMCSA interstate authority.',
  senior_classes_separate:
    '573 licensed assisted-living facilities are not nursing homes. Licensed capacity is not occupancy. Complaint-related inspection is not a substantiated complaint. Do not add 573 + 82 + 289 + 237 + 110 into one Virginia senior-provider total. An ALF license is not a CMS CCN.',
  lender_dated_ne_current:
    '1,257 dated SCC mortgage-company roster rows as of 2025-12-31 are not a live September 2026 lender count. An MLO is not a company. An HMDA application is not a lender. A complaint is not a violation. Live 2026 company denominator remains unknown, not zero.',
  insurance_1546_ne_authorized:
    '1,546 NAIC company observations in the 2025 statistical report are dated financial/market evidence (year ended 2025-12-31, reported as of 2026-06-01), not currently authorized insurers. A regulatory action is not a conviction. A market conduct examination is not a violation. 1,727 exact-match observations are not unique insurers.',
  investor_697_ne_office_ne_notice:
    '697 APPROVED Virginia state-registered IA firms are not 339 principal-office firms, not 107 ERA firms, and not 3,289 notice filings. 4,481 SCC annual activity is not 4,481 firms. Four CRDs may appear in both state IA and notice-filed sets. Do not add these populations.',
} as const;

export function vaCaveatForHub(id: SpecialistHubId): string {
  switch (id) {
    case 'contractor':
      return VA_SEMANTIC_GUARDRAILS.contractor_license_ne_company;
    case 'senior':
      return VA_SEMANTIC_GUARDRAILS.senior_classes_separate;
    case 'move':
      return VA_SEMANTIC_GUARDRAILS.move_hhg_ne_property;
    case 'lender':
      return VA_SEMANTIC_GUARDRAILS.lender_dated_ne_current;
    case 'investor':
      return VA_SEMANTIC_GUARDRAILS.investor_697_ne_office_ne_notice;
    case 'insurance':
      return VA_SEMANTIC_GUARDRAILS.insurance_1546_ne_authorized;
    default:
      return VA_SEMANTIC_GUARDRAILS.missing_ne_zero;
  }
}

export type VaRoute = {
  hubId: SpecialistHubId;
  stateCode: 'VA';
  intentFamily: string;
  destination: string;
  caveat: string;
};

function earlierStateNamed(query: string, other: RegExp): boolean {
  const va = standaloneVirginiaIndex(query);
  const otherAt = query.search(other);
  if (otherAt < 0) return false;
  if (va < 0) return true;
  return otherAt < va;
}

export function classifyVaHub(query: string): SpecialistHubId | undefined {
  const q = query.toLowerCase();
  if (/\b(mover|movers|moving|household[- ]goods|usdot|fmcsa|hhg|property carrier|move from|move to)\b/.test(q)) {
    return 'move';
  }
  if (
    /\b(mortgage|hmda|nmls|homebuyer|mlo|lender company|mortgage lender|mortgage broker)\b/.test(q) &&
    !/\badvis|securit|iard|ria\b/.test(q)
  ) {
    return 'lender';
  }
  if (
    /\b(nursing homes?|nursing facility|home health|hospice|assisted[- ]living|alf|adult day|dss|senior[- ]?(care|resources?|housing))\b/.test(
      q,
    )
  ) {
    return 'senior';
  }
  if (/\b(contractors?|class a|class b|class c|dpor|tradesmen|tradesman|general contractors?)\b/.test(q)) {
    return 'contractor';
  }
  if (
    /\b(insurance|insurer|authorized|naic|producer|agency roster|surplus[- ]lines|market conduct|sircon)\b/.test(q)
  ) {
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

export function routeVaAsk(query: string): VaRoute | undefined {
  if (earlierStateNamed(query, /\bwest\s+virginia\b/i)) return undefined;
  if (earlierStateNamed(query, /\bcalifornia\b|\bcalif\b/i)) return undefined;
  if (earlierStateNamed(query, /\btexas\b|\btexan\b/i)) return undefined;
  if (earlierStateNamed(query, /\bnew\s+jersey\b/i)) return undefined;
  if (earlierStateNamed(query, /\bflorida\b/i)) return undefined;
  if (earlierStateNamed(query, /\bwashington\b/i)) return undefined;
  if (earlierStateNamed(query, /\barizona\b/i)) return undefined;
  if (earlierStateNamed(query, /\bcolorado\b/i)) return undefined;
  if (earlierStateNamed(query, /\bnorth\s+carolina\b/i)) return undefined;
  if (!queryLooksLikeVirginia(query)) return undefined;
  const hubId = classifyVaHub(query);
  if (!hubId) return undefined;
  return {
    hubId,
    stateCode: 'VA',
    intentFamily: hubId,
    destination: vaSpecialistUrl(hubId),
    caveat: vaCaveatForHub(hubId),
  };
}

export function vaConciergeContext(): string {
  const live = listVaHubs().filter((h) => h.publication_status === 'live');
  const cards = listVaHubs()
    .map((h) => `- ${NETWORK_PUBLIC_NAMES[h.hub_id as SpecialistHubId]} (${h.canonical_state_url}): ${h.coverage_summary}`)
    .join('\n');
  const gate = vaReleaseGatePassed();
  return `## Virginia network context
AskTrustHub /virginia is the network gateway. Specialist /virginia pages own detailed evidence.
Virginia is STATE LEVEL ONLY. Do not invent Virginia city or county Ask pages. Richmond, Virginia Beach, Norfolk, Alexandria, Arlington, Fairfax, Loudoun, and Prince William stay on specialist /virginia.
Hub intent remains primary. Do not route every Virginia question to Contractor.
Live VA specialist pages: ${live.map((h) => h.hub_id).join(', ') || 'none'}.
Six-hub release gate passed: ${gate ? 'yes' : 'no'}. Blocker: ${VA_PUBLICATION_MANIFEST.release_gate.blocker ?? 'none'}.
Do not invent Virginia license, roster, or count facts. Route to the specialist page.
Do not copy Colorado or other-state metrics into Virginia.
Do not answer “how many contractors are in Virginia?” as unique companies. 53,840 is Class A/B/C LICENSE NUMBERS.
Do not answer “how many movers?” as 5,108 or 4,916.
Do not add senior classes into one senior-provider total.
Do not treat 1,257 dated SCC roster rows as current 2026 lenders.
Do not answer “which insurance companies are authorized in Virginia?” as 1,546 live authorized companies.
Do not answer “how many advisers?” as 339 + 697 + 107 + 3,289.
${cards}
Guardrails:
- ${VA_SEMANTIC_GUARDRAILS.contractor_license_ne_company}
- ${VA_SEMANTIC_GUARDRAILS.senior_classes_separate}
- ${VA_SEMANTIC_GUARDRAILS.move_hhg_ne_property}
- ${VA_SEMANTIC_GUARDRAILS.lender_dated_ne_current}
- ${VA_SEMANTIC_GUARDRAILS.investor_697_ne_office_ne_notice}
- ${VA_SEMANTIC_GUARDRAILS.insurance_1546_ne_authorized}
- Missing, restricted, and search-only evidence is unknown, not zero. No Trust Score. No paid ranking. No Virginia county routes.`;
}
