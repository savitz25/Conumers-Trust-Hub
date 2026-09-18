/**
 * TH-SEARCH-R1-019A independent-review corrections (review 1, reviewed head 0851240).
 * Each block is red on the reviewed head (see docs/qa/th-search-r1-019a/review-1/red-before-0851240.json)
 * and green after the correction. Classification is the REAL decision/planner; only hub outcomes are controlled.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { planAskResearch } from '../research-planner.ts';
import { createGuidedSession } from '../../guided-research/session.ts';
import { resolveAskNameState } from './page-state.ts';
import { searchNameCandidates } from './orchestrator.ts';
import { summarizeCoverage } from './coverage.ts';
import { buildNameResultsView, mergeHubPage, moreStateOf } from './view.ts';
import { nameCandidateTelemetry } from './telemetry.ts';
import { createFixtureAdapters, createFixtureAdaptersForScenario, FIVE_ALLIED_FIXTURE, type FixtureBehavior, type FixtureRecord } from './fixtures.ts';
import { lenderNameAdapter, moveNameAdapter, rowRelatesToName, safeHubUrl, type HubNameAdapter } from './adapters.ts';
import { MAX_CARDS_PER_HUB, type HubNameSearchOutcome } from './contract.ts';
import { MOVE_NETWORK_CONTRACT_FINGERPRINT, MOVE_NETWORK_RESOLVER_VERSION, MOVE_NETWORK_SCHEMA_FINGERPRINT } from '../move-network-resolver.ts';
import type { SpecialistHubId } from '../registry.ts';

const PURE: FixtureRecord = { hub: 'move', key: 'fx-pure-moving', name: 'Pure Moving Company', entityType: 'Mover (Carrier)', profilePath: '/companies/fx-pure-moving' };

/** Fixture adapters that COUNT every hub dispatch, so "no second retrieval" is measured, not assumed. */
function counted(records: FixtureRecord[], behavior: Partial<Record<SpecialistHubId, FixtureBehavior>> = {}) {
  const calls: Array<{ hub: SpecialistHubId; name: string; page: number }> = [];
  const base = createFixtureAdapters(records, behavior);
  const adapters = Object.fromEntries(Object.entries(base).map(([hub, adapter]) => [hub, { ...adapter, search: async (name, page, ctx) => { calls.push({ hub: hub as SpecialistHubId, name, page }); return adapter.search(name, page, ctx); } } satisfies HubNameAdapter])) as Record<SpecialistHubId, HubNameAdapter>;
  return { adapters, calls };
}
async function page(query: string, records: FixtureRecord[], behavior: Partial<Record<SpecialistHubId, FixtureBehavior>> = {}, extra: { selectedHub?: string; interpretAs?: string } = {}) {
  const c = counted(records, behavior);
  const state = await resolveAskNameState({ query, plan: planAskResearch(query), ...extra }, { adapters: c.adapters });
  const view = state.mode === 'NAME_RESULTS' ? buildNameResultsView({ query, name: state.response.request.name, scope: state.response.request.hubScope, hubs: state.response.hubs, alternate: state.alternate }) : null;
  return { state, view, calls: c.calls };
}
const jsonFetch = (body: unknown, status = 200): typeof fetch => (async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })) as typeof fetch;
const ctx = (fetcher: typeof fetch) => ({ fetcher, signal: new AbortController().signal });

// ================================================================ Finding 1
test('R1a. relevant source FAILS, others miss: the name result is kept -- no legacy gate, no second retrieval', async () => {
  // The legacy path this must NOT fall into: the "What are you moving?" questionnaire.
  assert.deepEqual(createGuidedSession('Pure Moving Company')?.missingFields, ['moveMode']);
  const { state, view, calls } = await page('Pure Moving Company', [PURE], { move: 'fail' });
  assert.equal(state.mode, 'NAME_RESULTS'); if (state.mode !== 'NAME_RESULTS' || !view) return;
  assert.equal(state.decision.alternateCohortInterpretation, true, 'this name genuinely has an alternate category reading');
  assert.equal(state.response.request.name, 'Pure Moving Company'); assert.equal(state.response.candidateCount, 0);
  assert.equal(view.kind, 'PARTIAL_MISS'); assert.match(view.heading, /Pure Moving Company/); assert.match(view.lead, /Could not be fully searched just now: Move Trust Hub/);
  // Dispatch count: one name search per hub, plus the single permitted transient retry of the failed hub. Nothing else.
  assert.equal(calls.length, 7); assert.ok(calls.every((c) => c.name === 'Pure Moving Company' && c.page === 1));
  assert.equal(calls.filter((c) => c.hub === 'move').length, 2);
  assert.equal(nameCandidateTelemetry(state.response).reason, 'partial_source_coverage_no_candidates');
});
test('R1b. ALL sources fail: still the name result (not a category question, not a "no match")', async () => {
  const all = Object.fromEntries(['move', 'lender', 'insurance', 'contractor', 'senior', 'investor'].map((h) => [h, 'fail'])) as Record<SpecialistHubId, FixtureBehavior>;
  const { state, view } = await page('Pure Moving Company', [PURE], all);
  assert.equal(state.mode, 'NAME_RESULTS'); assert.equal(view?.kind, 'NOT_COMPLETED'); assert.match(view!.heading, /could not complete a search for “Pure Moving Company”/);
});
test('R1c. relevant source UNSUPPORTED: name result kept, unsupported stays distinct from a completed miss', async () => {
  const { state, view, calls } = await page('Pure Moving Company', [PURE], { move: 'unsupported' });
  assert.equal(state.mode, 'NAME_RESULTS'); assert.equal(view?.kind, 'PARTIAL_MISS');
  assert.match(view!.lead, /Not searchable by this name from here: Move Trust Hub/); assert.doesNotMatch(view!.lead, /Could not be fully searched/);
  assert.equal(calls.length, 6, 'unsupported is never retried and triggers no extra retrieval');
});
test('R1d. genuine scoped miss: name kept, alternate reading offered as an EXPLICIT labeled action only', async () => {
  const { state, view, calls } = await page('Pure Moving Company', [], {}, { selectedHub: 'move' });
  assert.equal(state.mode, 'NAME_RESULTS'); assert.equal(view?.kind, 'COMPLETED_MISS'); assert.match(view!.heading, /^No records named “Pure Moving Company” were found$/);
  assert.equal(calls.length, 1, 'a zero-result never dispatches a general cohort');
  assert.ok(view!.alternate); assert.match(view!.alternate!.label, /Not looking for a business named “Pure Moving Company”\? Research these words as a category instead/);
  assert.equal(view!.alternate!.href, '/ask?q=Pure+Moving+Company&interpret=category');
});
test('R1e. positive control + the explicit category choice is the ONLY way into the legacy path', async () => {
  const hit = await page('Pure Moving Company', [PURE]);
  assert.equal(hit.view?.kind, 'CANDIDATES'); assert.equal(hit.view?.groups[0].cards[0].displayName, 'Pure Moving Company');
  const chosen = await page('Pure Moving Company', [PURE], {}, { interpretAs: 'category' });
  assert.deepEqual(chosen.state, { mode: 'LEGACY', reason: 'USER_CHOSE_CATEGORY_INTERPRETATION' }); assert.equal(chosen.calls.length, 0);
  // A name with NO alternate reading cannot be forced into a category by a URL parameter.
  const allied = await page('Allied', FIVE_ALLIED_FIXTURE, {}, { interpretAs: 'category' });
  assert.equal(allied.state.mode, 'NAME_RESULTS'); assert.equal(allied.view?.alternate, null);
});

// ================================================================ Finding 2
test('R2a. first page has NO admissible rows, hasMore=true, NO continuation URL: a real next-page control exists and reaches the record', async () => {
  const adapters = createFixtureAdaptersForScenario({ NAME_CANDIDATES_FIXTURE: 'paging-race' });
  adapters.move = { ...adapters.move, search: createFixtureAdapters([{ hub: 'move', key: 'fx-borealis-van-lines', name: 'Borealis Van Lines', entityType: 'Mover (Carrier)', profilePath: '/companies/fx-borealis-van-lines' }], { move: { emptyFirstPage: true } }).move.search };
  const first = await searchNameCandidates({ name: 'Borealis', hubScope: 'all' }, { adapters });
  const move = first.hubs.find((h) => h.hub === 'move')!;
  assert.deepEqual([move.state, move.candidates.length, move.hasMore, move.continuation], ['PARTIAL_TRUNCATED', 0, true, null]);
  const view = buildNameResultsView({ query: 'Borealis', name: 'Borealis', scope: 'all', hubs: first.hubs });
  const group = view.groups.find((g) => g.hub === 'move');
  assert.ok(group, 'the hub renders as a group even with zero cards'); assert.equal(group!.canFetchMore, true); assert.equal(group!.moreState, 'MORE_AVAILABLE'); assert.match(group!.emptyPageNote ?? '', /has more records to check/);
  assert.ok(view.groups.some((g) => g.hub === 'senior' && g.cards.length === 5), 'other hubs keep their cards');
  // What the real control does: fetch page 2 for that hub and merge it.
  const second = await searchNameCandidates({ name: 'Borealis', hubScope: 'move', pages: { move: 2 }, revision: 3 }, { adapters });
  const hubsAfter = first.hubs.map((h) => (h.hub === 'move' ? mergeHubPage(h, second.hubs.find((x) => x.hub === 'move')!) : h));
  const after = buildNameResultsView({ query: 'Borealis', name: 'Borealis', scope: 'all', hubs: hubsAfter });
  assert.deepEqual(after.groups.find((g) => g.hub === 'move')!.cards.map((c) => c.displayName), ['Borealis Van Lines']);
  assert.equal(after.groups.find((g) => g.hub === 'move')!.moreState, 'COMPLETE');
  assert.equal(after.groups.find((g) => g.hub === 'senior')!.returned, 5, 'known candidates from other hubs are preserved');
});
test('R2b. a FAILED next page keeps prior valid cards, exposes the fresh state, and keeps a retry control', async () => {
  const adapters = createFixtureAdaptersForScenario({ NAME_CANDIDATES_FIXTURE: 'paging-race' });
  const first = await searchNameCandidates({ name: 'Borealis', hubScope: 'all' }, { adapters });
  const lender = first.hubs.find((h) => h.hub === 'lender')!; assert.equal(lender.candidates.length, 5); assert.equal(lender.hasMore, true);
  const failed = (await searchNameCandidates({ name: 'Borealis', hubScope: 'lender', pages: { lender: 2 } }, { adapters })).hubs.find((h) => h.hub === 'lender')!;
  assert.equal(failed.state, 'TECHNICAL_FAILURE');
  const merged = mergeHubPage(lender, failed);
  assert.equal(merged.candidates.length, 5, 'prior valid cards retained'); assert.equal(merged.state, 'TECHNICAL_FAILURE'); assert.equal(merged.page, 1, 'cursor not advanced, so the same page can be retried');
  const hubs = first.hubs.map((h) => (h.hub === 'lender' ? merged : h));
  assert.ok(summarizeCoverage(hubs).incompleteHubs.includes('lender'), 'coverage stops claiming this hub succeeded');
  const group = buildNameResultsView({ query: 'Borealis', name: 'Borealis', scope: 'all', hubs }).groups.find((g) => g.hub === 'lender')!;
  assert.equal(group.cards.length, 5); assert.match(group.statusNote ?? '', /could not be searched just now/); assert.equal(group.canFetchMore, true);
  for (const state of ['UNSUPPORTED_OPERATION', 'POLICY_RESTRICTED', 'AMBIGUOUS_NO_CANDIDATES'] as const) {
    const m = mergeHubPage(lender, { ...failed, state, failureKind: undefined, message: null });
    assert.equal(m.state, state); assert.equal(m.candidates.length, 5);
  }
});
test('R2c. multi-page + caps: a cap never claims exhaustion (more available / source-capped / Ask-capped / complete)', async () => {
  const many: FixtureRecord[] = Array.from({ length: 12 }, (_, i) => ({ hub: 'senior' as const, key: `fx-b${i}`, name: `Borealis Home ${String.fromCharCode(65 + i)}`, entityType: 'Nursing Home', profilePath: `/facility/cms/9001${i}` }));
  const adapters = createFixtureAdapters(many);
  let hub = (await searchNameCandidates({ name: 'Borealis', hubScope: 'senior' }, { adapters })).hubs.find((h) => h.hub === 'senior')!;
  assert.equal(moreStateOf(hub), 'MORE_AVAILABLE');
  for (const p of [2, 3]) hub = mergeHubPage(hub, (await searchNameCandidates({ name: 'Borealis', hubScope: 'senior', pages: { senior: p } }, { adapters })).hubs.find((h) => h.hub === 'senior')!);
  assert.equal(hub.candidates.length, 12); assert.equal(new Set(hub.candidates.map((c) => c.stableKey)).size, 12); assert.equal(moreStateOf(hub), 'COMPLETE');
  assert.equal(moreStateOf({ ...hub, hasMore: false, truncatedWithoutCursor: true }), 'SOURCE_CAPPED');
  const capped = { ...hub, hasMore: true, candidates: Array.from({ length: MAX_CARDS_PER_HUB }, (_, i) => ({ ...hub.candidates[0], stableKey: `k${i}` })) };
  assert.equal(moreStateOf(capped), 'ASK_CAPPED');
  const g = buildNameResultsView({ query: 'Borealis', name: 'Borealis', scope: 'senior', hubs: [capped] }).groups[0];
  assert.equal(g.canFetchMore, false); assert.equal(g.moreMayExist, true, 'Ask stopping at its own limit is not presented as complete');
  // positive first-page control: everything on page one, nothing more to fetch
  const one = (await searchNameCandidates({ name: 'Allied Senior', hubScope: 'senior' }, { adapters: createFixtureAdapters(FIVE_ALLIED_FIXTURE) })).hubs.find((h) => h.hub === 'senior')!;
  assert.deepEqual([one.candidates.length, moreStateOf(one)], [1, 'COMPLETE']);
});

// ================================================================ Finding 3
const LENDER = { contract: 'trusthub-specialist-execution-v2', contractVersion: '2.1.0', schemaFingerprint: '0da572d08450e68f4f01a4f4b28e2e813503f50b1a84546a29d7eb817db205dd' };
const qi = (n: string) => ({ queryType: 'identity', entityClass: 'institution', identityName: n, matchMethod: 'exact_public_or_historical_name' });
test('R3a. valid upstream AMBIGUOUS_IDENTITIES with empty rows is preserved -- never COMPLETED_NO_CANDIDATES', async () => {
  const r = await lenderNameAdapter.search('First National', 1, ctx(jsonFetch({ ...LENDER, resultState: 'AMBIGUOUS_IDENTITIES', queryInterpretation: qi('first national'), rows: [], destinations: [{ type: 'INSTITUTION_DIRECTORY', url: '/lender' }] })));
  assert.equal(r.state, 'AMBIGUOUS_NO_CANDIDATES'); assert.notEqual(r.state, 'COMPLETED_NO_CANDIDATES');
  assert.equal(r.nameFilterApplied, true); assert.equal(r.candidates.length, 0, 'nothing is manufactured or selected');
  assert.equal(r.continuation?.href, 'https://www.lendertrusthub.com/lender'); assert.match(r.message ?? '', /more than one record shares this name.*does not return them/);
  const coverage = summarizeCoverage([r]);
  assert.deepEqual([coverage.ambiguousHubs, coverage.genuineNetworkMiss, coverage.completedHubsMiss], [['lender'], false, false]);
  const view = buildNameResultsView({ query: 'First National', name: 'First National', scope: 'lender', hubs: [r] });
  assert.equal(view.kind, 'NOT_COMPLETED'); assert.match(view.heading, /First National/); assert.doesNotMatch(view.heading, /^No records named/);
});
test('R3b. ambiguity WITH records renders them as separate candidates; true miss and positive controls are unchanged', async () => {
  const rows = [{ displayName: 'First National Bank', nmls: '1001', destination: { url: '/lender/first-national-bank' } }, { displayName: 'First National Bank', nmls: '2002', destination: { url: '/lender/first-national-bank-2' } }];
  const amb = await lenderNameAdapter.search('First National Bank', 1, ctx(jsonFetch({ ...LENDER, resultState: 'AMBIGUOUS_IDENTITIES', queryInterpretation: qi('first national bank'), rows })));
  assert.equal(amb.state, 'COMPLETED_WITH_CANDIDATES'); assert.deepEqual(amb.candidates.map((c) => c.stableKey), ['lender:nmls:1001', 'lender:nmls:2002'], 'same-name institutions stay distinct');
  const miss = await lenderNameAdapter.search('Zzqx Bank', 1, ctx(jsonFetch({ ...LENDER, resultState: 'NO_CONFIDENT_MATCH', queryInterpretation: qi('zzqx bank'), rows: [] })));
  assert.equal(miss.state, 'COMPLETED_NO_CANDIDATES');
  const hit = await lenderNameAdapter.search('Rocket Mortgage', 1, ctx(jsonFetch({ ...LENDER, resultState: 'EXACT_IDENTITY', queryInterpretation: qi('rocket mortgage'), rows: [], identity: { displayName: 'Rocket Mortgage', nmls: '3030', destination: { url: '/lender/rocket-mortgage' } } })));
  assert.deepEqual([hit.state, hit.candidates[0].matchMethod, hit.candidates[0].matchedName], ['COMPLETED_WITH_CANDIDATES', 'EXACT_SOURCE_NAME', 'Rocket Mortgage']);
});
test('R3c. malformed or contradictory payloads are failures, never successful misses', async () => {
  const claimsMatchNoRecord = await lenderNameAdapter.search('Rocket Mortgage', 1, ctx(jsonFetch({ ...LENDER, resultState: 'EXACT_IDENTITY', queryInterpretation: qi('rocket mortgage'), rows: [] })));
  assert.deepEqual([claimsMatchNoRecord.state, claimsMatchNoRecord.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
  const unmappable = await lenderNameAdapter.search('Rocket Mortgage', 1, ctx(jsonFetch({ ...LENDER, resultState: 'SUPPORTED_RESULTS', queryInterpretation: qi('rocket mortgage'), rows: [{ unexpected: true }] })));
  assert.deepEqual([unmappable.state, unmappable.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
  const notJsonObject = await lenderNameAdapter.search('Rocket Mortgage', 1, ctx(jsonFetch([1, 2, 3])));
  assert.equal(notJsonObject.state, 'TECHNICAL_FAILURE');
});
test('R3d. a source-established alias is not discarded for having different words -- and its text is never invented', async () => {
  const base = { contractVersion: MOVE_NETWORK_RESOLVER_VERSION, schemaFingerprint: MOVE_NETWORK_SCHEMA_FINGERPRINT, contractFingerprint: MOVE_NETWORK_CONTRACT_FINGERPRINT, resolutionClass: 'EXACT_PUBLIC_NAME', returnedResultCount: 1, totalMatchingIdentityCount: 1, normalizedQuery: 'zephyr relocation' };
  const row = (matchClass: string) => ({ publicDisplayName: 'Northwind Carriers', legalName: 'Northwind Carriers LLC', canonicalSlug: 'northwind-carriers', canonicalUrl: 'https://www.movetrusthub.com/companies/northwind-carriers', usdot: '55', mc: null, role: 'Carrier', recordedHq: {}, matchClass, matchReason: 'Exact accepted alias match' });
  const alias = await moveNameAdapter.search('Zephyr Relocation', 1, ctx(jsonFetch({ ...base, results: [row('exact_alias')] })));
  assert.equal(alias.state, 'COMPLETED_WITH_CANDIDATES'); const c = alias.candidates[0];
  assert.equal(c.matchMethod, 'DOCUMENTED_ALIAS'); assert.equal(c.matchedName, null, 'the display name is NOT presented as the matched alias text');
  assert.match(c.matchedField, /does not return the alias text/); assert.equal(c.displayName, 'Northwind Carriers');
  // The exemption is ONLY for the hub's explicit alias class: the same unrelated row under any other class is still rejected.
  const notAlias = await moveNameAdapter.search('Zephyr Relocation', 1, ctx(jsonFetch({ ...base, results: [row('display_prefix')] })));
  assert.deepEqual([notAlias.state, notAlias.failureKind], ['TECHNICAL_FAILURE', 'name_filter_not_proven']);
  assert.equal(rowRelatesToName('Zephyr', null, 'PREFIX_OR_TOKEN'), false); assert.equal(rowRelatesToName('Zephyr', null, 'DOCUMENTED_ALIAS'), true);
  const historical = await lenderNameAdapter.search('Quicken Loans', 1, ctx(jsonFetch({ ...LENDER, resultState: 'EXACT_IDENTITY', queryInterpretation: qi('quicken loans'), rows: [], identity: { displayName: 'Rocket Mortgage', nmls: '3030', destination: { url: '/lender/rocket-mortgage' } } })));
  assert.deepEqual([historical.candidates[0].matchMethod, historical.candidates[0].matchedName], ['DOCUMENTED_ALIAS', null]); assert.match(historical.candidates[0].matchedField, /historical or alternate institution name/);
});

// ================================================================ Finding 4
const blank = (hub: SpecialistHubId, state: HubNameSearchOutcome['state'], extra: Partial<HubNameSearchOutcome> = {}): HubNameSearchOutcome => ({ hub, state, nameFilterApplied: state.startsWith('COMPLETED'), searchedScope: 's', matchBreadth: 'b', candidates: [], returnedCount: 0, hubReportedTotal: null, page: 1, hasMore: false, truncatedWithoutCursor: false, continuation: null, message: null, latencyMs: 1, calls: 1, ...extra });
test('R4. headlines, lead and telemetry share ONE coverage interpretation', () => {
  const v = (hubs: HubNameSearchOutcome[]) => buildNameResultsView({ query: 'Allied', name: 'Allied', scope: 'all', hubs });
  // The reviewer's exact replay: Move TECHNICAL_FAILURE + Lender COMPLETED_NO_CANDIDATES.
  const mixed = v([blank('move', 'TECHNICAL_FAILURE', { failureKind: 'timeout' }), blank('lender', 'COMPLETED_NO_CANDIDATES')]);
  assert.equal(mixed.kind, 'PARTIAL_MISS'); assert.equal(mixed.heading, 'No matches for “Allied” in the 1 source that completed');
  assert.doesNotMatch(mixed.heading, /^No records named/); assert.match(mixed.lead, /Completed with no match: Lender Trust Hub\. Could not be fully searched just now: Move Trust Hub\./);
  // completed misses + unsupported: unsupported is named as NOT searchable, never as "failed" or as a miss
  const unsupported = v([blank('lender', 'COMPLETED_NO_CANDIDATES'), blank('investor', 'COMPLETED_NO_CANDIDATES'), blank('contractor', 'UNSUPPORTED_OPERATION'), blank('insurance', 'POLICY_RESTRICTED')]);
  assert.equal(unsupported.kind, 'PARTIAL_MISS'); assert.match(unsupported.heading, /in the 2 sources that completed/);
  assert.match(unsupported.lead, /Not searchable by this name from here: Contractor Trust Hub\./); assert.match(unsupported.lead, /Do not publish matching records for name search: Insurance Trust Hub\./); assert.doesNotMatch(unsupported.lead, /Could not be fully searched/);
  assert.equal(v([blank('move', 'TECHNICAL_FAILURE'), blank('lender', 'TECHNICAL_FAILURE')]).kind, 'NOT_COMPLETED');
  const truncatedEmpty = v([blank('move', 'PARTIAL_TRUNCATED', { hasMore: true, nameFilterApplied: true })]);
  assert.equal(truncatedEmpty.kind, 'NOT_COMPLETED'); assert.equal(truncatedEmpty.groups.length, 1);
  const trueMiss = v([blank('move', 'COMPLETED_NO_CANDIDATES'), blank('lender', 'COMPLETED_NO_CANDIDATES'), blank('senior', 'NOT_SEARCHED_OUT_OF_SCOPE', { calls: 0 })]);
  assert.equal(trueMiss.kind, 'COMPLETED_MISS'); assert.equal(trueMiss.heading, 'No records named “Allied” were found'); assert.match(trueMiss.lead, /Every source in this search completed/);
  for (const hubs of [[blank('move', 'TECHNICAL_FAILURE'), blank('lender', 'COMPLETED_NO_CANDIDATES')], [blank('move', 'COMPLETED_NO_CANDIDATES')]]) {
    const c = summarizeCoverage(hubs); const t = nameCandidateTelemetry({ version: 'ask-name-candidates-v1', request: { originalInput: 'x', name: 'x', hubScope: 'all', priorityHubs: [], pages: {}, revision: 0, unresolvedConditions: [] }, hubs, candidateCount: 0, coverage: c, timing: { totalMs: 1, overallDeadlineMs: 1, calls: 1 } });
    assert.equal(t.reason === 'completed_miss', buildNameResultsView({ query: 'x', name: 'x', scope: 'all', hubs }).kind === 'COMPLETED_MISS', 'telemetry and headline agree on what a complete miss is');
  }
});
test('R4b. ordinary positive results are unchanged, and incomplete coverage is said next to them', async () => {
  const r = await searchNameCandidates({ name: 'Allied', hubScope: 'all' }, { adapters: createFixtureAdapters(FIVE_ALLIED_FIXTURE, { lender: 'fail' }) });
  const view = buildNameResultsView({ query: 'Allied', name: 'Allied', scope: 'all', hubs: r.hubs });
  assert.equal(view.kind, 'CANDIDATES'); assert.match(view.heading, /^4 records with a name like “Allied”$/); assert.match(view.lead, /This is not every source: Could not be fully searched just now: Lender Trust Hub\./);
  const clean = await searchNameCandidates({ name: 'Allied', hubScope: 'all' }, { adapters: createFixtureAdapters(FIVE_ALLIED_FIXTURE) });
  assert.doesNotMatch(buildNameResultsView({ query: 'Allied', name: 'Allied', scope: 'all', hubs: clean.hubs }).lead, /not every source/);
});

// ================================================================ Finding 5 (code-level parts)
test('R5. link hygiene never produces an unscoped redirect; date meaning is carried, not relabeled', async () => {
  assert.equal(safeHubUrl('insurance', '/ask?q=Find+allied&entity=agency&state=undefined&loa=undefined&selected=abc')?.href, 'https://www.insurancetrusthub.com/ask?q=Find+allied&entity=agency&selected=abc', 'identity (selected), class (entity) and query survive; only literal-undefined params go');
  assert.equal(safeHubUrl('insurance', '/ask?q=Find+allied&selected=undefined'), null, 'a broken record-selecting param means NO link, not an unscoped page');
  assert.equal(safeHubUrl('insurance', '/ask?q=undefined&selected=abc'), null);
  const r = await searchNameCandidates({ name: 'Allied', hubScope: 'move' }, { adapters: createFixtureAdapters(FIVE_ALLIED_FIXTURE) });
  assert.ok(r.hubs.find((h) => h.hub === 'move')!.candidates.every((c) => typeof c.sourceDateLabel === 'string' && c.sourceDateLabel.length > 0 && !/effective/i.test(c.sourceDateLabel)));
});
