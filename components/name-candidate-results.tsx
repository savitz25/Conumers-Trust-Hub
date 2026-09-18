'use client';

import { useEffect, useRef, useState } from 'react';
import { ASK_BRAND } from '@/lib/design/ask-design-system';
import { NETWORK_PUBLIC_NAMES, type SpecialistHubId } from '@/lib/network/registry';
import { buildNameResultsView } from '@/lib/network/name-candidates/view';
import {
  INITIAL_CARDS_PER_HUB, MATCH_METHOD_LABEL, MAX_CARDS_PER_HUB,
  type HubNameSearchOutcome, type NameCandidate, type NameCandidateResponse,
} from '@/lib/network/name-candidates/contract';

/**
 * TH-SEARCH-R1-019A results-first name candidates.
 * - Cards lead; hub refinement chips are optional controls (real links, so Back/Forward/refresh
 *   restore the same query + filter from the URL).
 * - "View more" first reveals rows already returned, then asks the hub for its next page.
 * - A per-hub revision guard + AbortController means an older response can never replace newer rows.
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
        <dt className="font-medium">Matched on</dt><dd className="break-words">{candidate.matchedField}: “{candidate.matchedName}”</dd>
        {candidate.identifiers.map((id) => (<div key={id.label} className="contents"><dt className="font-medium">{id.label}</dt><dd className="break-all">{id.value}</dd></div>))}
        {candidate.recordedLocation ? (<><dt className="font-medium">Recorded location</dt><dd className="break-words">{candidate.recordedLocation}{candidate.locationMeaning ? <span className="block text-xs opacity-80">{candidate.locationMeaning}</span> : null}</dd></>) : null}
        <dt className="font-medium">Source date</dt><dd>{candidate.sourceAsOf ? candidate.sourceAsOf.slice(0, 10) : 'Not supplied by the source'}</dd>
      </dl>
      {candidate.action ? (
        <a href={candidate.action.href} className="mt-4 inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold text-white" style={{ backgroundColor: ASK_BRAND.indigo }} rel="noopener">{candidate.action.label}</a>
      ) : (
        <p className="mt-4 text-sm" style={{ color: ASK_BRAND.ink }}>This source lists the record but does not publish a page for it.</p>
      )}
    </li>
  );
}

export function NameCandidateResults({ query, initial }: { query: string; initial: NameCandidateResponse }) {
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
    return () => { inflight.current?.abort(); };
  }, [initial]);

  const scope = initial.request.hubScope;
  const name = initial.request.name;
  const view = buildNameResultsView({ query, name, scope, hubs, visible });

  async function viewMore(hub: HubNameSearchOutcome) {
    const shown = visible[hub.hub] ?? INITIAL_CARDS_PER_HUB;
    if (shown < hub.candidates.length) { setVisible((v) => ({ ...v, [hub.hub]: Math.min(shown + INITIAL_CARDS_PER_HUB, hub.candidates.length) })); return; }
    if (!hub.hasMore || hub.candidates.length >= MAX_CARDS_PER_HUB) return;
    const mine = ++revision.current; inflight.current?.abort();
    const controller = new AbortController(); inflight.current = controller;
    setLoadingHub(hub.hub); setMoreError(null);
    try {
      const response = await fetch('/api/name-candidates', { method: 'POST', signal: controller.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q: query, hub: hub.hub, pages: { [hub.hub]: hub.page + 1 }, revision: mine }) });
      if (!response.ok) throw new Error('more_failed');
      const next = await response.json() as NameCandidateResponse;
      if (mine !== revision.current || next.request.revision !== mine) return; // stale -- discard
      const fresh = next.hubs.find((row) => row.hub === hub.hub);
      if (!fresh || fresh.state === 'TECHNICAL_FAILURE') throw new Error('more_failed');
      setHubs((current) => current.map((row) => {
        if (row.hub !== hub.hub) return row;
        const seen = new Set(row.candidates.map((c) => c.stableKey));
        const merged = [...row.candidates, ...fresh.candidates.filter((c) => !seen.has(c.stableKey))].slice(0, MAX_CARDS_PER_HUB);
        return { ...row, candidates: merged, page: fresh.page, hasMore: fresh.hasMore && merged.length < MAX_CARDS_PER_HUB, truncatedWithoutCursor: fresh.truncatedWithoutCursor, continuation: fresh.continuation ?? row.continuation };
      }));
      setVisible((v) => ({ ...v, [hub.hub]: (v[hub.hub] ?? INITIAL_CARDS_PER_HUB) + INITIAL_CARDS_PER_HUB }));
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError') && mine === revision.current) setMoreError(hub.hub);
    } finally { if (mine === revision.current) setLoadingHub(null); }
  }

  return (
    <section aria-labelledby="name-candidates-title" className="min-w-0" data-testid="name-candidate-results" data-result-kind={view.kind}>
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
          <section key={group.hub} className="mt-8" aria-labelledby={`hub-${group.hub}`} data-testid={`hub-group-${group.hub}`}>
            <h3 id={`hub-${group.hub}`} className="text-lg font-semibold" style={{ color: ASK_BRAND.navy }}>{group.title}</h3>
            <p className="mt-1 text-xs" style={{ color: ASK_BRAND.ink }}>Searched: {hub.searchedScope}. {hub.matchBreadth}.</p>
            <ul className="mt-3 grid gap-4 md:grid-cols-2">{group.cards.map((candidate) => <CandidateCard key={candidate.stableKey} candidate={candidate} />)}</ul>
            <p className="mt-3 text-sm" style={{ color: ASK_BRAND.ink }} role="status">
              Showing {group.shown} of {group.returned}{group.moreMayExist ? '+' : ''} returned{hub.hubReportedTotal !== null && hub.hubReportedTotal > group.returned ? ` (the source reports ${hub.hubReportedTotal.toLocaleString('en-US')} name matches)` : ''}.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {group.canReveal || group.canFetchMore ? <button type="button" onClick={() => viewMore(hub)} disabled={loadingHub === group.hub} data-testid={`view-more-${group.hub}`} className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold disabled:opacity-60" style={{ borderColor: ASK_BRAND.indigo, color: ASK_BRAND.indigo }}>{loadingHub === group.hub ? 'Loading…' : `View more from ${group.title}`}</button> : null}
              {!group.canReveal && !group.canFetchMore && hub.truncatedWithoutCursor && hub.continuation ? <a href={hub.continuation.href} className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold" style={{ borderColor: ASK_BRAND.indigo, color: ASK_BRAND.indigo }} rel="noopener">More matches may exist — {hub.continuation.label}</a> : null}
              {moreError === group.hub ? <span role="alert" className="text-sm" style={{ color: '#B91C1C' }}>More results could not be loaded. The results above are unchanged.</span> : null}
            </div>
          </section>
        );
      })}

      {view.kind === 'COMPLETED_MISS' ? (
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
    </section>
  );
}
