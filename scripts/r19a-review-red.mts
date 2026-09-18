// TH-SEARCH-R1-019A review corrections: RED-BEFORE reproduction of findings 1-4.
// Written against the reviewed head 0851240 using only APIs that exist there, so it runs unchanged
// before the fix (defects reproduced) and after (defects gone). Output is committed as evidence.
import { decideNameCandidateSearch } from '../lib/network/name-candidates/decision.ts';
import { searchNameCandidates } from '../lib/network/name-candidates/orchestrator.ts';
import { createFixtureAdapters, FIVE_ALLIED_FIXTURE } from '../lib/network/name-candidates/fixtures.ts';
import { buildNameResultsView } from '../lib/network/name-candidates/view.ts';
import { lenderNameAdapter } from '../lib/network/name-candidates/adapters.ts';
import type { HubNameSearchOutcome } from '../lib/network/name-candidates/contract.ts';

const out: Record<string, unknown> = {};

// Finding 1: page selection for a name with an alternate category reading when a source FAILS.
{
  const d = decideNameCandidateSearch('Pure Moving Company');
  if (d.operation !== 'NAME_CANDIDATES') throw new Error('expected name decision');
  const r = await searchNameCandidates({ name: d.name, hubScope: d.hubScope, priorityHubs: d.priorityHubs }, { adapters: createFixtureAdapters(FIVE_ALLIED_FIXTURE, { move: 'fail' }) });
  // The exact expression used by app/ask/page.tsx at the reviewed head:
  const reviewedHeadExpression = r.candidateCount > 0 || !d.alternateCohortInterpretation;
  out.finding1 = { alternate: d.alternateCohortInterpretation, moveState: r.hubs.find((h) => h.hub === 'move')!.state, candidateCount: r.candidateCount, reviewedHeadShowsNameResults: reviewedHeadExpression, defect: reviewedHeadExpression === false ? 'REPRODUCED: a Move source FAILURE drops the name UI and re-enters the legacy "What are you moving?" path' : 'not reproduced' };
}

// Finding 2: a truncated-empty first page has no usable continuation.
{
  const hub: HubNameSearchOutcome = { hub: 'move', state: 'PARTIAL_TRUNCATED', nameFilterApplied: true, searchedScope: 's', matchBreadth: 'b', candidates: [], returnedCount: 0, hubReportedTotal: 80, page: 1, hasMore: true, truncatedWithoutCursor: false, continuation: null, message: null, latencyMs: 1, calls: 1 };
  const view = buildNameResultsView({ query: 'C&L Movers', name: 'C&L Movers', scope: 'move', hubs: [hub] }) as unknown as { groups: Array<{ hub: string; canFetchMore?: boolean }> };
  const group = view.groups.find((g) => g.hub === 'move');
  out.finding2 = { groupRendered: Boolean(group), canFetchMore: group?.canFetchMore ?? false, defect: group?.canFetchMore ? 'not reproduced' : 'REPRODUCED: hasMore=true with no continuation URL, but no group/View-more control exists' };
}

// Finding 3: upstream AMBIGUOUS_IDENTITIES with no rows becomes a completed miss.
{
  const body = { contract: 'trusthub-specialist-execution-v2', contractVersion: '2.1.0', schemaFingerprint: '0da572d08450e68f4f01a4f4b28e2e813503f50b1a84546a29d7eb817db205dd', resultState: 'AMBIGUOUS_IDENTITIES', queryInterpretation: { queryType: 'identity', identityName: 'first national', matchMethod: 'exact_public_or_historical_name' }, rows: [], message: 'Multiple institutions share this name.' };
  const fetcher = (async () => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch;
  const r = await lenderNameAdapter.search('First National', 1, { fetcher, signal: new AbortController().signal });
  out.finding3 = { state: r.state, defect: r.state === 'COMPLETED_NO_CANDIDATES' ? 'REPRODUCED: valid upstream ambiguity reported as a completed miss' : 'not reproduced' };
}

// Finding 4: an unqualified all-network miss headline while a source failed.
{
  const r = await searchNameCandidates({ name: 'Allied', hubScope: 'all' }, { adapters: createFixtureAdapters([], { move: 'fail' }) });
  const view = buildNameResultsView({ query: 'Allied', name: 'Allied', scope: 'all', hubs: r.hubs });
  out.finding4 = { kind: view.kind, heading: view.heading, defect: /^No records named/.test(view.heading) ? 'REPRODUCED: leads with an unqualified miss although Move failed' : 'not reproduced' };
}

console.log(JSON.stringify(out, null, 1));
