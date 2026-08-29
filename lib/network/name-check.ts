import { NAME_IS_NOT_IDENTITY } from './vocabulary.ts';
import { HUB_CAPABILITY_REGISTRY } from './capability-registry.ts';
import { NETWORK_PUBLIC_NAMES, SPECIALIST_HUB_IDS, type SpecialistHubId } from './registry.ts';

export const CROSS_HUB_NAME_CHECK = {
  version: 'name-check-invariant-v1',
  invariant: NAME_IS_NOT_IDENTITY,
  resultLanguage: {
    nameAppearance: 'This display name appears in more than one hub or record.',
    confirmedMatch: 'Confirmed identity match requires shared regulatory identifiers, not similar names.',
    disclaimer:
      'A similar or matching name appearing in more than one TrustHub system does not establish that the records represent the same legal entity.',
  },
} as const;

export type NameCheckStatus =
  | 'confirmed_identifier_match'
  | 'exact_name_appearance'
  | 'possible_name_appearance'
  | 'no_match_found'
  | 'not_currently_searchable';

export type NameCheckHubRow = {
  hubId: SpecialistHubId;
  name: string;
  status: NameCheckStatus;
  detail: string;
  destination?: string;
};

export type NameCheckResult = {
  query: string;
  hubs: NameCheckHubRow[];
  disclaimer: string;
};

function searchUrl(hubId: SpecialistHubId, q: string): string | undefined {
  const cap = HUB_CAPABILITY_REGISTRY[hubId];
  if (hubId === 'move') return `https://www.movetrusthub.com/?q=${encodeURIComponent(q)}`;
  if (hubId === 'lender') return `https://www.lendertrusthub.com/lender`;
  if (hubId === 'insurance') return undefined;
  if (hubId === 'contractor') return `https://www.contractortrusthub.com/verify?q=${encodeURIComponent(q)}`;
  if (hubId === 'senior') return `https://www.seniortrusthub.com/search`;
  if (hubId === 'investor') return `https://www.investortrusthub.com/firms?q=${encodeURIComponent(q)}`;
  return cap.publicSearchUrl;
}

export function runNameCheck(raw: string): NameCheckResult {
  const query = raw.trim();
  const hubs: NameCheckHubRow[] = SPECIALIST_HUB_IDS.map((hubId) => {
    const cap = HUB_CAPABILITY_REGISTRY[hubId];
    const dest = searchUrl(hubId, query);
    if (cap.nameSearch === 'unsupported' || cap.nameSearch === 'planned' || !dest) {
      return {
        hubId,
        name: NETWORK_PUBLIC_NAMES[hubId],
        status: 'not_currently_searchable',
        detail:
          hubId === 'insurance'
            ? 'Public people pages are unpublished. Directory ZIP search is not a firm-name identity check.'
            : `${NETWORK_PUBLIC_NAMES[hubId]} does not currently expose a public-safe name search for this parent check.`,
      };
    }
    if (cap.nameSearch === 'partial' && hubId === 'lender') {
      return {
        hubId,
        name: NETWORK_PUBLIC_NAMES[hubId],
        status: 'possible_name_appearance',
        detail:
          'LenderTrustHub can search a controlled public corpus. Open specialist search to see whether this display name appears. Ask has not confirmed a match and will not merge identities.',
        destination: dest,
      };
    }
    return {
      hubId,
      name: NETWORK_PUBLIC_NAMES[hubId],
      status: 'possible_name_appearance',
      detail: `${NETWORK_PUBLIC_NAMES[hubId]} has a public name-search interface. Possible appearance means the hub can be searched — not that Ask found or merged a legal entity.`,
      destination: dest,
    };
  });

  return {
    query,
    hubs,
    disclaimer: CROSS_HUB_NAME_CHECK.resultLanguage.disclaimer,
  };
}
