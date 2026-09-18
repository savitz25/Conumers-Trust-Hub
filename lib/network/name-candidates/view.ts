/**
 * TH-SEARCH-R1-019A: pure view-model for the results-first name candidate UI. The component renders
 * exactly what this returns, so the display rules (count wording, what is visible before "View
 * more", coverage-aware headlines, continuation when a page has nothing admissible, optional filter
 * chips) are executable without a browser.
 *
 * Headline, lead and telemetry all read the ONE coverage interpretation in coverage.ts.
 */
import { NETWORK_PUBLIC_NAMES, SPECIALIST_HUB_IDS, type SpecialistHubId } from '../registry.ts';
import { INITIAL_CARDS_PER_HUB, MAX_CARDS_PER_HUB, type HubNameSearchOutcome, type NameCandidate, type NameHubScope } from './contract.ts';
import { isTruncatedEmpty, summarizeCoverage } from './coverage.ts';

export const HUB_FILTER_LABEL: Record<SpecialistHubId, string> = { move: 'Moving', lender: 'Lending', insurance: 'Insurance', contractor: 'Contractors', senior: 'Senior care', investor: 'Investment advisers' };

/**
 * Whether more records exist for a hub, and why the list stops where it does. A cap is never
 * presented as exhaustion.
 *  COMPLETE        the source returned everything it matched
 *  MORE_AVAILABLE  the source has a next page Ask can fetch
 *  SOURCE_CAPPED   the source capped its answer and offers no cursor (a continuation link may exist)
 *  ASK_CAPPED      Ask stopped at its own per-hub card limit although the source has more
 */
export type MoreState = 'COMPLETE' | 'MORE_AVAILABLE' | 'SOURCE_CAPPED' | 'ASK_CAPPED';

export type HubGroupView = {
  hub: SpecialistHubId; title: string; cards: NameCandidate[]; shown: number; returned: number;
  canReveal: boolean; canFetchMore: boolean; moreState: MoreState; moreMayExist: boolean;
  /** Set when this page had nothing admissible but the source has more -- the group still renders so its control exists. */
  emptyPageNote: string | null;
  /** Set when the hub's LATEST state is a failure/unsupported/restricted/ambiguous while earlier valid cards are kept. */
  statusNote: string | null;
};
export type FilterChipView = { id: NameHubScope; label: string; href: string; active: boolean };
export type AlternateAction = { label: string; href: string };
export type NameResultsKind = 'CANDIDATES' | 'COMPLETED_MISS' | 'PARTIAL_MISS' | 'NOT_COMPLETED';
export type NameResultsView = {
  heading: string; lead: string; total: number; kind: NameResultsKind;
  groups: HubGroupView[]; chips: FilterChipView[]; notIncluded: Array<{ hub: SpecialistHubId; line: string }>;
  /** Explicit, clearly labeled other reading of the text. Never auto-dispatched. */
  alternate: AlternateAction | null;
};

export function askNameHref(query: string, hub: NameHubScope): string {
  const params = new URLSearchParams({ q: query });
  if (hub !== 'all') params.set('hub', hub);
  return `/ask?${params.toString()}`;
}

/** The explicit "treat my text as a category instead" action. Only a user click ever follows it. */
export function askCategoryHref(query: string): string {
  return `/ask?${new URLSearchParams({ q: query, interpret: 'category' }).toString()}`;
}

export function hubStatusLine(hub: HubNameSearchOutcome): string | null {
  const name = NETWORK_PUBLIC_NAMES[hub.hub];
  if (isTruncatedEmpty(hub)) return `${name} returned only loosely related records so far, and more exist there. This is not a "no match" result.`;
  if (hub.state === 'TECHNICAL_FAILURE') return `${name} could not be searched just now. This is not a "no match" result -- try again.`;
  if (hub.state === 'AMBIGUOUS_NO_CANDIDATES') return hub.message ?? `${name} reports more than one record with this name but did not return them. This is not a "no match" result.`;
  if (hub.state === 'UNSUPPORTED_OPERATION') return hub.message ?? `${name} could not be searched by name from here.`;
  if (hub.state === 'POLICY_RESTRICTED') return hub.message ?? `${name} does not publish matching records for name search.`;
  return null;
}

export function moreStateOf(hub: HubNameSearchOutcome): MoreState {
  if (hub.hasMore && hub.candidates.length >= MAX_CARDS_PER_HUB) return 'ASK_CAPPED';
  if (hub.hasMore) return 'MORE_AVAILABLE';
  if (hub.truncatedWithoutCursor) return 'SOURCE_CAPPED';
  return 'COMPLETE';
}

const FRESH_PAGE_OK = new Set(['COMPLETED_WITH_CANDIDATES', 'COMPLETED_NO_CANDIDATES', 'PARTIAL_TRUNCATED']);

/**
 * Merge a hub's NEXT page into what is already shown. Valid cards already displayed are always
 * kept. When the next page failed / became unsupported / restricted / ambiguous, the hub's state
 * becomes that fresh state (so coverage stops claiming success) and the page cursor does not
 * advance, so the same page can be retried.
 */
export function mergeHubPage(current: HubNameSearchOutcome, fresh: HubNameSearchOutcome): HubNameSearchOutcome {
  if (!FRESH_PAGE_OK.has(fresh.state)) {
    return { ...current, state: fresh.state, failureKind: fresh.failureKind, message: fresh.message, continuation: fresh.continuation ?? current.continuation };
  }
  const seen = new Set(current.candidates.map((c) => c.stableKey));
  const candidates = [...current.candidates, ...fresh.candidates.filter((c) => !seen.has(c.stableKey))].slice(0, MAX_CARDS_PER_HUB);
  const more = fresh.hasMore || fresh.truncatedWithoutCursor;
  return {
    ...current, candidates, returnedCount: candidates.length, page: fresh.page, hasMore: fresh.hasMore, truncatedWithoutCursor: fresh.truncatedWithoutCursor,
    hubReportedTotal: fresh.hubReportedTotal ?? current.hubReportedTotal, continuation: fresh.continuation ?? current.continuation, failureKind: undefined, message: null,
    state: more ? 'PARTIAL_TRUNCATED' : candidates.length ? 'COMPLETED_WITH_CANDIDATES' : 'COMPLETED_NO_CANDIDATES',
  };
}

const list = (hubs: SpecialistHubId[]) => hubs.map((hub) => NETWORK_PUBLIC_NAMES[hub]).join(', ');

export function buildNameResultsView(input: { query: string; name: string; scope: NameHubScope; hubs: HubNameSearchOutcome[]; visible?: Partial<Record<SpecialistHubId, number>>; alternate?: AlternateAction | null }): NameResultsView {
  const { query, name, scope, hubs } = input; const visible = input.visible ?? {};
  const coverage = summarizeCoverage(hubs);

  // A hub is a GROUP when it has cards, or when its page had nothing admissible but it can continue:
  // the control to reach page two must exist even though no card does.
  // hasMore stays true after a FAILED next page (see mergeHubPage), so the retry control survives too.
  const groups = hubs.filter((hub) => hub.candidates.length > 0 || hub.hasMore || (isTruncatedEmpty(hub) && Boolean(hub.continuation))).map((hub): HubGroupView => {
    const shown = Math.min(visible[hub.hub] ?? INITIAL_CARDS_PER_HUB, hub.candidates.length);
    const moreState = moreStateOf(hub);
    const latestIsProblem = !FRESH_PAGE_OK.has(hub.state);
    return {
      hub: hub.hub, title: NETWORK_PUBLIC_NAMES[hub.hub], cards: hub.candidates.slice(0, shown), shown, returned: hub.candidates.length,
      canReveal: shown < hub.candidates.length, canFetchMore: moreState === 'MORE_AVAILABLE', moreState, moreMayExist: moreState !== 'COMPLETE',
      emptyPageNote: isTruncatedEmpty(hub) ? `Nothing on ${NETWORK_PUBLIC_NAMES[hub.hub]}'s page ${hub.page} closely matched this name, but it has more records to check.` : null,
      statusNote: latestIsProblem ? hubStatusLine(hub) : null,
    };
  });
  const total = groups.reduce((n, group) => n + group.returned, 0);

  const gaps: string[] = [];
  if (coverage.incompleteHubs.length) gaps.push(`Could not be fully searched just now: ${list(coverage.incompleteHubs)}.`);
  if (coverage.ambiguousHubs.length) gaps.push(`Reported more than one possible record without returning them: ${list(coverage.ambiguousHubs)}.`);
  if (coverage.unsupportedHubs.length) gaps.push(`Not searchable by this name from here: ${list(coverage.unsupportedHubs)}.`);
  if (coverage.policyRestrictedHubs.length) gaps.push(`Do not publish matching records for name search: ${list(coverage.policyRestrictedHubs)}.`);

  const completedCount = coverage.completedHubs.length;
  const kind: NameResultsKind = total > 0 ? 'CANDIDATES' : completedCount === 0 ? 'NOT_COMPLETED' : coverage.genuineNetworkMiss ? 'COMPLETED_MISS' : 'PARTIAL_MISS';
  // Singular/plural follows the actual count; the match label on each card follows evidence, not count.
  const heading =
    kind === 'CANDIDATES' ? `${total} ${total === 1 ? 'record' : 'records'} with a name like “${name}”`
      : kind === 'NOT_COMPLETED' ? `We could not complete a search for “${name}”`
        : kind === 'COMPLETED_MISS' ? `No records named “${name}” were found`
          // Never lead with an unqualified all-network miss while any in-scope source did not complete.
          : `No matches for “${name}” in the ${completedCount} ${completedCount === 1 ? 'source' : 'sources'} that completed`;
  const where = scope === 'all' ? 'across the TrustHub network' : `in ${NETWORK_PUBLIC_NAMES[scope]}`;
  const lead =
    kind === 'CANDIDATES' ? `These are public records whose names match what you entered ${where}. A matching name is not proof that a record is the business you mean, and similarly named records are different businesses unless an identifier says otherwise.${gaps.length ? ` This is not every source: ${gaps.join(' ')}` : ''}`
      : kind === 'NOT_COMPLETED' ? `No source completed a search for this name, so this is not a "no match" result. ${gaps.join(' ')}`.trim()
        : kind === 'COMPLETED_MISS' ? `Every source in this search completed: ${list(coverage.completedHubs)}.`
          : `Completed with no match: ${list(coverage.completedHubs)}. ${gaps.join(' ')} This is not a complete answer for the whole network.`;

  const chips = (['all', ...SPECIALIST_HUB_IDS] as NameHubScope[]).map((id): FilterChipView => {
    const hub = id === 'all' ? undefined : hubs.find((h) => h.hub === id);
    const count = hub?.candidates.length ?? 0;
    const suffix = scope === 'all' && count ? ` (${count}${hub && moreStateOf(hub) !== 'COMPLETE' ? '+' : ''})` : '';
    return { id, label: `${id === 'all' ? 'All TrustHubs' : HUB_FILTER_LABEL[id]}${suffix}`, href: askNameHref(query, id), active: scope === id };
  });
  // Hubs rendered as a group carry their note inside the group; everything else is listed here.
  const grouped = new Set(groups.map((group) => group.hub));
  const notIncluded = hubs.flatMap((hub) => { const line = hubStatusLine(hub); return line && !grouped.has(hub.hub) ? [{ hub: hub.hub, line }] : []; });
  return { heading, lead, total, kind, groups, chips, notIncluded, alternate: input.alternate ?? null };
}
