'use client';

import { useEffect, useRef, useState } from 'react';
import { ASK_BRAND } from '@/lib/design/ask-design-system';
import { NETWORK_PUBLIC_NAMES, type SpecialistHubId } from '@/lib/network/registry';
import { buildNameResultsView, mergeHubPage, type AlternateAction, type HubGroupView } from '@/lib/network/name-candidates/view';
import {
  INITIAL_CARDS_PER_HUB, MATCH_METHOD_LABEL,
  type HubNameSearchOutcome, type NameCandidate, type NameCandidateResponse,
} from '@/lib/network/name-candidates/contract';

/**
 * TH-SEARCH-R1-019A results-first name candidates.
 * - Cards lead; hub refinement chips are optional controls (real links, so Back/Forward/refresh
 *   restore the same query + filter from the URL).
 * - "View more" first reveals rows already returned, then asks the hub for its next page. A hub whose
 *   current page had nothing admissible still gets a group and a real control, so page two is reachable.
 * - A per-request revision + AbortController means an older response can never replace newer rows,
 *   and a new query/filter (a new `initial`) discards everything still in flight.
 * - When a next page fails or turns unsupported/restricted/ambiguous, cards already shown stay and
 *   the hub's fresh state is shown: coverage never keeps claiming success.
 * - A candidate is a relevant public record -- never presented as a confirmed identity.
 */
function CandidateCard({ candidate }: { candidate: NameCandidate }) {
  const suggestion = candidate.matchMethod === 'SIMILAR_SPELLING';
  return (
    <li className="min-w-0 rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: ASK_BRAND.border }} data-testid="name-candidate-card" data-hub={candidate.hub} data-stable-key={candidate.stableKey}>
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ASK_BRAND.indigo }}>{NETWORK_PUBLIC_NAMES[candidate.hub]}{candidate.entityType ? ` · ${candidate.entityType}` : ''}</p>
      <h4 className="mt-1 break-words text-lg font-semibold" style={{ color: ASK_BRAND.navy }}>{candidate.displayName}</h4>
      <p className="mt-2 text-sm" style={{ color: ASK_BRAND.ink }}>
        <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: suggestion ? '#FEF3C7' : ASK_BRAND.periwinkle, color: ASK_BRAND.navy }}>{MATCH_METHOD_LABEL[candidate.matchMethod]}</span>
      </p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm" style={{ color: ASK_BRAND.ink }}>
        <dt className="font-medium">Matched on</dt>
        <dd className="break-words">{candidate.matchedName ? <>{candidate.matchedField}: “{candidate.matchedName}”</> : candidate.matchedField}</dd>
        {candidate.identifiers.map((id) => (<div key={id.label} className="contents"><dt className="font-medium">{id.label}</dt><dd className="break-all">{id.value}</dd></div>))}
        {candidate.recordedLocation ? (<><dt className="font-medium">Recorded location</dt><dd className="break-words">{candidate.recordedLocation}{candidate.locationMeaning ? <span className="block text-xs opacity-80">{candidate.locationMeaning}</span> : null}</dd></>) : null}
        <dt className="font-medium">{candidate.sourceDateLabel}</dt><dd>{candidate.sourceAsOf ? candidate.sourceAsOf.slice(0, 10) : 'Not supplied by the source'}</dd>
      </dl>
      {candidate.action ? (
        <a href={candidate.action.href} className="mt-4 inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold text-white" style={{ backgroundColor: ASK_BRAND.indigo }} rel="noopener">{candidate.action.label}</a>
      ) : (
        <p className="mt-4 text-sm" style={{ color: ASK_BRAND.ink }}>This source lists the record but does not publish a page for it.</p>
      )}
    </li>
  );
}

function moreLine(group: HubGroupView, hub: HubNameSearchOutcome): string {
  const reported = hub.hubReportedTotal !== null && hub.hubReportedTotal > group.returned ? ` The source reports ${hub.hubReportedTotal.toLocaleString('en-US')} name matches.` : '';
  const why = group.moreState === 'MORE_AVAILABLE' ? ' More are available from this source.'
    : group.moreState === 'SOURCE_CAPPED' ? ' This source caps its answer here; more matches may exist.'
      : group.moreState === 'ASK_CAPPED' ? ' This is the most Ask lists for one source; more exist there.'
        : ' That is everything this source returned.';
  return `Showing ${group.shown} of ${group.returned} returned.${why}${reported}`;
}

export function NameCandidateResults({ query, initial, alternate = null }: { query: string; initial: NameCandidateResponse; alternate?: AlternateAction | null }) {
  const [hubs, setHubs] = useState<HubNameSearchOutcome[]>(initial.hubs);
  const [visible, setVisible] = useState<Partial<Record<SpecialistHubId, number>>>({});
  const [loadingHub, setLoadingHub] = useState<SpecialistHubId | null>(null);
  const [moreError, setMoreError] = useState<SpecialistHubId | null>(null);
  const revision = useRef(0);
  const inflight = useRef<AbortController | null>(null);

  // A new server render (new query, new hub filter, Back/Forward) replaces all client state and
  // invalidates anything still in flight, so a stale "View more" can never land on new results.
  useEffect(() => {
    revision.current += 1; inflight.current?.abort(); inflight.current = null;
    setHubs(initial.hubs); setVisible({}); setLoadingHub(null); setMoreError(null);
    return () => { revision.current += 1; inflight.current?.abort(); };
  }, [initial]);

  const scope = initial.request.hubScope;
  const name = initial.request.name;
  const view = buildNameResultsView({ query, name, scope, hubs, visible, alternate });

  async function viewMore(hub: HubNameSearchOutcome) {
    const shown = visible[hub.hub] ?? INITIAL_CARDS_PER_HUB;
    if (shown < hub.candidates.length) { setVisible((v) => ({ ...v, [hub.hub]: Math.min(shown + INITIAL_CARDS_PER_HUB, hub.candidates.length) })); return; }
    if (!hub.hasMore) return;
    const mine = ++revision.current; inflight.current?.abort();
    const controller = new AbortController(); inflight.current = controller;
    setLoadingHub(hub.hub); setMoreError(null);
    try {
      const response = await fetch('/api/name-candidates', { method: 'POST', signal: controller.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q: query, hub: hub.hub, pages: { [hub.hub]: hub.page + 1 }, revision: mine }) });
      if (mine !== revision.current) return; // superseded while in flight -- discard
      if (!response.ok) throw new Error('more_failed');
      const next = await response.json() as NameCandidateResponse;
      if (mine !== revision.current || next.request.revision !== mine || next.request.name !== name) return; // stale -- discard
      const fresh = next.hubs.find((row) => row.hub === hub.hub);
      if (!fresh) throw new Error('more_failed');
      // Prior valid cards are kept; the hub's state becomes whatever the fresh page actually was.
      setHubs((current) => current.map((row) => (row.hub === hub.hub ? mergeHubPage(row, fresh) : row)));
      if (fresh.candidates.length) setVisible((v) => ({ ...v, [hub.hub]: (v[hub.hub] ?? INITIAL_CARDS_PER_HUB) + INITIAL_CARDS_PER_HUB }));
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError') && mine === revision.current) setMoreError(hub.hub);
    } finally { if (mine === revision.current) setLoadingHub(null); }
  }

  return (
    <section aria-labelledby="name-candidates-title" className="min-w-0" data-testid="name-candidate-results" data-result-kind={view.kind} data-searched-name={name}>
      <h2 id="name-candidates-title" className="break-words text-2xl font-semibold" style={{ color: ASK_BRAND.navy }}>{view.heading}</h2>
      <p className="mt-2 max-w-3xl text-sm" style={{ color: ASK_BRAND.ink }}>{view.lead}</p>

      <nav aria-label="Narrow by TrustHub (optional)" className="mt-5 flex flex-wrap gap-2">
        {view.chips.map((chip) => (
          <a key={chip.id} href={chip.href} aria-current={chip.active ? 'true' : undefined} data-testid={`hub-filter-${chip.id}`} className="inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium" style={{ borderColor: chip.active ? ASK_BRAND.indigo : ASK_BRAND.border, backgroundColor: chip.active ? ASK_BRAND.periwinkle : ASK_BRAND.white, color: ASK_BRAND.navy }}>{chip.label}</a>
        ))}
      </nav>

      {view.groups.map((group) => {
        const hub = hubs.find((row) => row.hub === group.hub)!;
        return (
          <section key={group.hub} className="mt-8" aria-labelledby={`hub-${group.hub}`} data-testid={`hub-group-${group.hub}`} data-more-state={group.moreState} data-hub-state={hub.state}>
            <h3 id={`hub-${group.hub}`} className="text-lg font-semibold" style={{ color: ASK_BRAND.navy }}>{group.title}</h3>
            <p className="mt-1 text-xs" style={{ color: ASK_BRAND.ink }}>Searched: {hub.searchedScope}. {hub.matchBreadth}.</p>
            {group.emptyPageNote ? <p className="mt-3 rounded-xl border p-3 text-sm" style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.ink }} data-testid={`empty-page-note-${group.hub}`}>{group.emptyPageNote}</p> : null}
            {group.cards.length ? <ul className="mt-3 grid gap-4 md:grid-cols-2">{group.cards.map((candidate) => <CandidateCard key={candidate.stableKey} candidate={candidate} />)}</ul> : null}
            {group.returned ? <p className="mt-3 text-sm" style={{ color: ASK_BRAND.ink }} role="status">{moreLine(group, hub)}</p> : null}
            {group.statusNote ? <p className="mt-2 text-sm" role="alert" style={{ color: '#B91C1C' }} data-testid={`hub-status-note-${group.hub}`}>{group.statusNote}{group.returned ? ' The records above were returned earlier and are unchanged.' : ''}</p> : null}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {group.canReveal || group.canFetchMore ? <button type="button" onClick={() => viewMore(hub)} disabled={loadingHub === group.hub} data-testid={`view-more-${group.hub}`} className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold disabled:opacity-60" style={{ borderColor: ASK_BRAND.indigo, color: ASK_BRAND.indigo }}>{loadingHub === group.hub ? 'Loading…' : group.statusNote && !group.emptyPageNote ? `Try ${group.title} again` : group.returned ? `View more from ${group.title}` : `Check more of ${group.title}`}</button> : null}
              {!group.canReveal && !group.canFetchMore && group.moreMayExist && hub.continuation ? <a href={hub.continuation.href} className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold" style={{ borderColor: ASK_BRAND.indigo, color: ASK_BRAND.indigo }} rel="noopener">{hub.continuation.label}</a> : null}
              {moreError === group.hub ? <span role="alert" className="text-sm" style={{ color: '#B91C1C' }}>More results could not be loaded. Nothing above has changed.</span> : null}
            </div>
          </section>
        );
      })}

      {view.kind === 'COMPLETED_MISS' || view.kind === 'PARTIAL_MISS' ? (
        <div className="mt-6 rounded-2xl border bg-white p-5 text-sm" style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.ink }} data-testid="name-honest-miss">
          <p className="font-semibold" style={{ color: ASK_BRAND.navy }}>What you can do</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Check the spelling, or try the legal name or a shorter distinctive part of the name. Your search is still in the box above.</li>
            <li>If you have a license or registration number (USDOT, NMLS, CRD, NPN, CCN), search that instead — identifiers are exact.</li>
            <li>A missing record is not a finding about the business. It may operate under another name or in a source TrustHub has not acquired.</li>
          </ul>
        </div>
      ) : null}

      {view.notIncluded.length ? (
        <div className="mt-6 rounded-2xl border p-4 text-sm" style={{ borderColor: ASK_BRAND.border, backgroundColor: ASK_BRAND.canvas, color: ASK_BRAND.ink }} data-testid="name-coverage-disclosure">
          <p className="font-semibold" style={{ color: ASK_BRAND.navy }}>Not included in this search</p>
          <ul className="mt-2 space-y-1">{view.notIncluded.map((row) => {
            const continuation = hubs.find((h) => h.hub === row.hub)?.continuation;
            return <li key={row.hub}>{row.line}{continuation ? <> <a className="underline" href={continuation.href} rel="noopener">{continuation.label}</a>.</> : null}</li>;
          })}</ul>
        </div>
      ) : null}

      {view.alternate ? (
        <p className="mt-6 text-sm" style={{ color: ASK_BRAND.ink }} data-testid="name-alternate-interpretation">
          We searched for a business named “{name}”. <a className="font-semibold underline" style={{ color: ASK_BRAND.indigo }} href={view.alternate.href}>{view.alternate.label}</a>. That is a different question and has not been run.
        </p>
      ) : null}
    </section>
  );
}
