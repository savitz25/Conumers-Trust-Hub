/**
 * TH-SEARCH-R1-019A: pure view-model for the results-first name candidate UI. The component renders
 * exactly what this returns, so the display rules (count wording, what is visible before "View
 * more", honest miss vs failure, optional filter chips) are executable without a browser.
 */
import { NETWORK_PUBLIC_NAMES, SPECIALIST_HUB_IDS, type SpecialistHubId } from '../registry.ts';
import { INITIAL_CARDS_PER_HUB, MAX_CARDS_PER_HUB, type HubNameSearchOutcome, type NameCandidate, type NameHubScope } from './contract.ts';

export const HUB_FILTER_LABEL: Record<SpecialistHubId, string> = { move: 'Moving', lender: 'Lending', insurance: 'Insurance', contractor: 'Contractors', senior: 'Senior care', investor: 'Investment advisers' };
const COMPLETED = new Set(['COMPLETED_WITH_CANDIDATES', 'COMPLETED_NO_CANDIDATES', 'PARTIAL_TRUNCATED']);

export type HubGroupView = { hub: SpecialistHubId; title: string; cards: NameCandidate[]; shown: number; returned: number; canReveal: boolean; canFetchMore: boolean; moreMayExist: boolean };
export type FilterChipView = { id: NameHubScope; label: string; href: string; active: boolean };
export type NameResultsView = {
  heading: string; lead: string; total: number; kind: 'CANDIDATES' | 'COMPLETED_MISS' | 'NOT_COMPLETED';
  groups: HubGroupView[]; chips: FilterChipView[]; notIncluded: Array<{ hub: SpecialistHubId; line: string }>;
};

export function askNameHref(query: string, hub: NameHubScope): string {
  const params = new URLSearchParams({ q: query });
  if (hub !== 'all') params.set('hub', hub);
  return `/ask?${params.toString()}`;
}

export function hubStatusLine(hub: HubNameSearchOutcome): string | null {
  if (hub.state === 'PARTIAL_TRUNCATED' && hub.candidates.length === 0) return `${NETWORK_PUBLIC_NAMES[hub.hub]} returned only loosely related records on its first page, and more exist there. This is not a "no match" result.`;
  if (hub.state === 'TECHNICAL_FAILURE') return `${NETWORK_PUBLIC_NAMES[hub.hub]} could not be searched just now. This is not a "no match" result -- try again.`;
  if (hub.state === 'UNSUPPORTED_OPERATION') return hub.message ?? `${NETWORK_PUBLIC_NAMES[hub.hub]} could not be searched by name from here.`;
  if (hub.state === 'POLICY_RESTRICTED') return hub.message ?? `${NETWORK_PUBLIC_NAMES[hub.hub]} does not publish matching records for name search.`;
  return null;
}

export function buildNameResultsView(input: { query: string; name: string; scope: NameHubScope; hubs: HubNameSearchOutcome[]; visible?: Partial<Record<SpecialistHubId, number>> }): NameResultsView {
  const { query, name, scope, hubs } = input; const visible = input.visible ?? {};
  const groups = hubs.filter((hub) => hub.candidates.length > 0).map((hub): HubGroupView => {
    const shown = Math.min(visible[hub.hub] ?? INITIAL_CARDS_PER_HUB, hub.candidates.length);
    const canFetchMore = hub.hasMore && hub.candidates.length < MAX_CARDS_PER_HUB;
    return { hub: hub.hub, title: NETWORK_PUBLIC_NAMES[hub.hub], cards: hub.candidates.slice(0, shown), shown, returned: hub.candidates.length, canReveal: shown < hub.candidates.length, canFetchMore, moreMayExist: canFetchMore || hub.truncatedWithoutCursor };
  });
  const total = groups.reduce((n, group) => n + group.returned, 0);
  const truncatedEmpty = (h: HubNameSearchOutcome) => h.state === 'PARTIAL_TRUNCATED' && h.candidates.length === 0;
  const completedNames = hubs.filter((h) => COMPLETED.has(h.state) && !truncatedEmpty(h)).map((h) => NETWORK_PUBLIC_NAMES[h.hub]);
  const anyFailed = hubs.some((h) => h.state === 'TECHNICAL_FAILURE' || truncatedEmpty(h));
  const kind: NameResultsView['kind'] = total > 0 ? 'CANDIDATES' : completedNames.length ? 'COMPLETED_MISS' : 'NOT_COMPLETED';
  // Singular/plural follows the actual count; the match label on each card follows evidence, not count.
  const heading = kind === 'CANDIDATES' ? `${total} ${total === 1 ? 'record' : 'records'} with a name like “${name}”` : kind === 'NOT_COMPLETED' ? `We could not complete a search for “${name}”` : `No records named “${name}” were found`;
  const lead = kind === 'CANDIDATES'
    ? `These are public records whose names match what you entered${scope === 'all' ? ' across the TrustHub network' : ` in ${NETWORK_PUBLIC_NAMES[scope]}`}. A matching name is not proof that a record is the business you mean, and similarly named records are different businesses unless an identifier says otherwise.`
    : kind === 'NOT_COMPLETED' ? 'Every source had a problem answering. This is not a "no match" result.'
      : `Searched: ${completedNames.join(', ')}.${anyFailed ? ' Some sources could not be searched, so this is not a complete answer.' : ''}`;
  const chips = (['all', ...SPECIALIST_HUB_IDS] as NameHubScope[]).map((id): FilterChipView => {
    const hub = id === 'all' ? undefined : hubs.find((h) => h.hub === id);
    const count = hub?.candidates.length ?? 0;
    const suffix = scope === 'all' && count ? ` (${count}${hub?.hasMore || hub?.truncatedWithoutCursor ? '+' : ''})` : '';
    return { id, label: `${id === 'all' ? 'All TrustHubs' : HUB_FILTER_LABEL[id]}${suffix}`, href: askNameHref(query, id), active: scope === id };
  });
  const notIncluded = hubs.flatMap((hub) => { const line = hubStatusLine(hub); return line ? [{ hub: hub.hub, line }] : []; });
  return { heading, lead, total, kind, groups, chips, notIncluded };
}
