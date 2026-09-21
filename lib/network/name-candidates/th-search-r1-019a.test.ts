/**
 * TH-SEARCH-R1-019A acceptance gate. Findability AND correctness both matter.
 * Fixture hubs do their own matching; the orchestrator, decision, adapters, coverage, telemetry and
 * view-model under test are the real ones. Nothing here is Production evidence.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { decideNameCandidateSearch } from './decision.ts';
import { searchNameCandidates } from './orchestrator.ts';
import { createFixtureAdapters, fixtureModeEnabled, FIVE_ALLIED_FIXTURE, type FixtureRecord } from './fixtures.ts';
import { buildNameResultsView } from './view.ts';
import { nameCandidateTelemetry } from './telemetry.ts';
import { NAME_ADAPTERS, investorNameAdapter, insuranceNameAdapter, lenderNameAdapter, moveNameAdapter, seniorNameAdapter, rowRelatesToName, safeHubUrl } from './adapters.ts';
import { INITIAL_CARDS_PER_HUB, validateSuppliedName } from './contract.ts';
import { MOVE_NETWORK_CONTRACT_FINGERPRINT, MOVE_NETWORK_RESOLVER_VERSION, MOVE_NETWORK_SCHEMA_FINGERPRINT } from '../move-network-resolver.ts';
import { planAskResearch } from '../research-planner.ts';
import { createGuidedSession } from '../../guided-research/session.ts';

const fx = (records: FixtureRecord[] = FIVE_ALLIED_FIXTURE, behavior = {}) => ({ adapters: createFixtureAdapters(records, behavior) });
async function ask(q: string, selectedHub: string | null = null, options = fx()) {
  const d = decideNameCandidateSearch(q, { selectedHub });
  assert.equal(d.operation, 'NAME_CANDIDATES', `${q} must be a name-candidate search`);
  if (d.operation !== 'NAME_CANDIDATES') throw new Error('unreachable');
  return searchNameCandidates({ originalInput: d.originalInput, name: d.name, hubScope: d.hubScope, priorityHubs: d.priorityHubs }, options);
}
const names = (r: Awaited<ReturnType<typeof ask>>) => r.hubs.flatMap((h) => h.candidates.map((c) => c.displayName)).sort();
const jsonFetch = (handler: (url: string, init?: RequestInit) => { status?: number; body: unknown }): typeof fetch =>
  (async (input: RequestInfo | URL, init?: RequestInit) => { const out = handler(String(input), init); return new Response(JSON.stringify(out.body), { status: out.status ?? 200, headers: { 'content-type': 'application/json' } }); }) as typeof fetch;
const ctx = (fetcher: typeof fetch) => ({ fetcher, signal: new AbortController().signal });

// ---------------------------------------------------------------- 1. Five-Allied cross-hub fixture
test('1a. "Allied" shows all five eligible records across four hubs with no hub selection', async () => {
  const r = await ask('Allied');
  assert.deepEqual(names(r), ['Allied Electrical', 'Allied Lending', 'Allied Lending Group', 'Allied Moving', 'Allied Senior Care', 'Allied Van Lines']);
  for (const expected of ['Allied Van Lines', 'Allied Moving', 'Allied Lending', 'Allied Electrical', 'Allied Senior Care']) assert.ok(names(r).includes(expected), expected);
  assert.deepEqual(new Set(r.hubs.filter((h) => h.candidates.length).map((h) => h.hub)), new Set(['move', 'lender', 'contractor', 'senior']));
  assert.equal(r.request.hubScope, 'all');
  const view = buildNameResultsView({ query: 'Allied', name: r.request.name, scope: 'all', hubs: r.hubs });
  assert.equal(view.kind, 'CANDIDATES');
  assert.equal(view.groups.flatMap((g) => g.cards).length, 6, 'every card is visible on first render -- no hub permanently hidden by a cap');
  assert.match(view.heading, /^6 records with a name like/);
});
test('1b. optional Moving filter narrows to the two Move records and keeps the query; All restores it', async () => {
  const moving = await ask('Allied', 'move');
  assert.deepEqual(names(moving), ['Allied Moving', 'Allied Van Lines']);
  assert.equal(moving.request.name, 'Allied'); assert.equal(moving.request.hubScope, 'move');
  assert.ok(moving.hubs.filter((h) => h.hub !== 'move').every((h) => h.state === 'NOT_SEARCHED_OUT_OF_SCOPE' && h.calls === 0));
  const view = buildNameResultsView({ query: 'Allied', name: 'Allied', scope: 'move', hubs: moving.hubs });
  assert.equal(view.chips.find((c) => c.id === 'all')!.href, '/ask?q=Allied');
  assert.equal(view.chips.find((c) => c.id === 'move')!.href, '/ask?q=Allied&hub=move');
  assert.equal(names(await ask('Allied')).length, 6);
});
test('1c. a name containing an industry word is NOT silently a hub filter ("Allied Moving")', async () => {
  const d = decideNameCandidateSearch('Allied Moving');
  assert.equal(d.operation, 'NAME_CANDIDATES'); if (d.operation !== 'NAME_CANDIDATES') return;
  assert.equal(d.hubScope, 'all'); assert.deepEqual(d.priorityHubs, ['move']); assert.equal(d.name, 'Allied Moving');
  const r = await ask('Allied Moving');
  assert.ok(r.hubs.every((h) => h.state !== 'NOT_SEARCHED_OUT_OF_SCOPE'), 'every hub is still searched');
  assert.equal(r.hubs[0].hub, 'move', 'the hint only prioritizes display order');
  const scoped = decideNameCandidateSearch('moving companies named Allied');
  assert.ok(scoped.operation === 'NAME_CANDIDATES' && scoped.hubScope === 'move' && scoped.name === 'Allied');
});

// ---------------------------------------------------------------- 2. Dataset change
test('2. a newly added matching record is discoverable with no code change', async () => {
  const added: FixtureRecord[] = [...FIVE_ALLIED_FIXTURE, { hub: 'investor', key: 'fx-zephyrine', name: 'Zephyrine Quill Advisors', entityType: 'Investment adviser firm (RIA)', identifier: { label: 'CRD', value: '9000010' } }];
  assert.deepEqual(names(await ask('zephyrine')), []);
  assert.deepEqual(names(await ask('zephyrine', null, fx(added))), ['Zephyrine Quill Advisors']);
});

// ---------------------------------------------------------------- 3 + 4. Name shapes; redundant clarification is a failure
test('3/4. lowercase, one-word, numeric-leading, hyphenated and category-word names enter candidate search with no hub keyword', () => {
  for (const q of ['Allied', 'allied', 'Cirta', 'cirta', '1-800-Pack-Rat', '10 East Partners', 'Pure Moving Company', 'A Holly Patterson Extended Care Facility', 'Allied Van Lines', 'Abbey Delray South', 'Tate Asset Management', "O'Brien & Sons"]) {
    const d = decideNameCandidateSearch(q);
    assert.equal(d.operation, 'NAME_CANDIDATES', `REDUNDANT CLARIFICATION: ${q} -> ${d.operation === 'NOT_NAME_SEARCH' ? d.reason : ''}`);
    if (d.operation === 'NAME_CANDIDATES') { assert.equal(d.hubScope, 'all'); assert.equal(d.name, q, 'numbers, hyphens, apostrophes and category words are preserved'); }
  }
});
test('4b. baseline proof: the planner alone still cannot route these (the gate this milestone removes)', () => {
  for (const q of ['Allied', '1-800-Pack-Rat', 'Allied Van Lines', 'Abbey Delray South']) { const plan = planAskResearch(q); assert.equal(plan.primaryHub, undefined); assert.equal(createGuidedSession(q), null); }
});

// ---------------------------------------------------------------- 5. No category padding / cohort masquerade
test('5a. records named only with industry words never appear for a name search', async () => {
  for (const q of ['Allied', 'Allied Moving']) { const found = names(await ask(q)); assert.ok(!found.includes('Moving') && !found.includes('Electrical Services') && !found.includes('Beacon Insurance Agency'), q); }
  assert.deepEqual(names(await ask('Allied Moving')), ['Allied Moving']);
});
test('5b. a hub that ignores the name filter is a FAILURE -- never candidates, never a miss', async () => {
  const r = await ask('Allied', null, fx(FIVE_ALLIED_FIXTURE, { move: 'ignore_name_filter' }));
  const move = r.hubs.find((h) => h.hub === 'move')!;
  assert.equal(move.state, 'TECHNICAL_FAILURE'); assert.equal(move.failureKind, 'name_filter_not_proven'); assert.equal(move.candidates.length, 0);
  assert.ok(r.coverage.incompleteHubs.includes('move')); assert.equal(r.coverage.genuineNetworkMiss, false);
});
test('5c. real adapters reject an unfiltered cohort and an unechoed name', async () => {
  const base = { contractVersion: MOVE_NETWORK_RESOLVER_VERSION, schemaFingerprint: MOVE_NETWORK_SCHEMA_FINGERPRINT, contractFingerprint: MOVE_NETWORK_CONTRACT_FINGERPRINT, resolutionClass: 'FUZZY_CANDIDATES', returnedResultCount: 1, totalMatchingIdentityCount: 1 };
  const row = (name: string) => ({ publicDisplayName: name, legalName: null, canonicalSlug: 'x', canonicalUrl: 'https://www.movetrusthub.com/companies/x', usdot: '1', mc: null, role: 'Carrier', recordedHq: {}, matchClass: 'display_prefix', matchReason: 'Company-name prefix' });
  const cohort = await moveNameAdapter.search('Allied', 1, ctx(jsonFetch(() => ({ body: { ...base, normalizedQuery: 'allied', results: [row('Zeta Relocation'), row('Omega Hauling')] } }))));
  assert.equal(cohort.state, 'TECHNICAL_FAILURE'); assert.equal(cohort.failureKind, 'name_filter_not_proven');
  const unechoed = await moveNameAdapter.search('Allied', 1, ctx(jsonFetch(() => ({ body: { ...base, normalizedQuery: '', results: [row('Allied Van Lines')] } }))));
  assert.equal(unechoed.state, 'TECHNICAL_FAILURE'); assert.equal(unechoed.nameFilterApplied, false);
  const good = await moveNameAdapter.search('Allied', 1, ctx(jsonFetch(() => ({ body: { ...base, normalizedQuery: 'allied', results: [row('Allied Van Lines')] } }))));
  assert.equal(good.state, 'COMPLETED_WITH_CANDIDATES'); assert.equal(good.nameFilterApplied, true); assert.equal(good.candidates[0].matchMethod, 'PREFIX_OR_TOKEN');
  assert.equal(rowRelatesToName('Allied', 'Zeta Relocation', 'PREFIX_OR_TOKEN'), false);
  assert.equal(rowRelatesToName('colleg hunks', 'College Hunks Moving', 'PREFIX_OR_TOKEN'), true);
});

// ---------------------------------------------------------------- 6. Distinct entities; approximate is never exact
test('6. similarly named records stay distinct, and a lone approximate candidate is not labeled exact', async () => {
  const r = await ask('Allied Lending');
  const lender = r.hubs.find((h) => h.hub === 'lender')!;
  assert.deepEqual(lender.candidates.map((c) => [c.displayName, c.matchMethod]), [['Allied Lending', 'EXACT_SOURCE_NAME'], ['Allied Lending Group', 'PREFIX_OR_TOKEN']]);
  assert.equal(new Set(lender.candidates.map((c) => c.stableKey)).size, 2);
  const lone = await ask('Allied Sen');
  assert.equal(lone.candidateCount, 1); const only = lone.hubs.flatMap((h) => h.candidates)[0];
  assert.notEqual(only.matchMethod, 'EXACT_SOURCE_NAME'); assert.notEqual(only.matchMethod, 'NORMALIZED_NAME');
  const view = buildNameResultsView({ query: 'Allied Sen', name: 'Allied Sen', scope: 'all', hubs: lone.hubs });
  assert.match(view.heading, /^1 record with a name like/); assert.doesNotMatch(view.heading + view.lead, /exact|confirmed identity|verified/i);
  const stable = new Set((await ask('Allied')).hubs.flatMap((h) => h.candidates.map((c) => c.stableKey))); assert.equal(stable.size, 6, 'cross-hub records are never merged');
});

// ---------------------------------------------------------------- 7. Partial failure
test('7a. one source fails while others succeed: valid cards kept, incomplete coverage disclosed', async () => {
  const r = await ask('Allied', null, fx(FIVE_ALLIED_FIXTURE, { lender: 'fail' }));
  assert.deepEqual(names(r), ['Allied Electrical', 'Allied Moving', 'Allied Senior Care', 'Allied Van Lines']);
  assert.deepEqual(r.coverage.incompleteHubs, ['lender']); assert.equal(r.coverage.allInScopeCompleted, false);
  const view = buildNameResultsView({ query: 'Allied', name: 'Allied', scope: 'all', hubs: r.hubs });
  assert.ok(view.notIncluded.some((row) => row.hub === 'lender' && /not a "no match" result/.test(row.line)));
  assert.deepEqual(nameCandidateTelemetry(r).reason, 'partial_source_coverage');
});
test('7b. all-source failure is NOT a no-match', async () => {
  const all = Object.fromEntries(['move', 'lender', 'insurance', 'contractor', 'senior', 'investor'].map((h) => [h, 'fail']));
  const r = await ask('Allied', null, fx(FIVE_ALLIED_FIXTURE, all));
  assert.equal(r.candidateCount, 0); assert.equal(r.coverage.genuineNetworkMiss, false); assert.equal(r.coverage.completedHubsMiss, false);
  const view = buildNameResultsView({ query: 'Allied', name: 'Allied', scope: 'all', hubs: r.hubs });
  assert.equal(view.kind, 'NOT_COMPLETED'); assert.match(view.heading, /could not complete/);
  assert.deepEqual([nameCandidateTelemetry(r).terminalOutcome, nameCandidateTelemetry(r).reason], ['ERROR', 'all_sources_failed']);
});
test('7c. a genuine completed miss is distinct from failure and keeps the entered name', async () => {
  const r = await ask('zzqx nonexistent 9917');
  assert.equal(r.coverage.genuineNetworkMiss, true);
  const view = buildNameResultsView({ query: 'zzqx nonexistent 9917', name: r.request.name, scope: 'all', hubs: r.hubs });
  assert.equal(view.kind, 'COMPLETED_MISS'); assert.match(view.heading, /zzqx nonexistent 9917/);
  assert.equal(nameCandidateTelemetry(r).reason, 'completed_miss');
});
test('7d. every live adapter is enabled (TH-SEARCH-R1-019A-FINAL: Contractor released)', () => {
  for (const hub of ['move', 'lender', 'insurance', 'contractor', 'senior', 'investor'] as const) assert.equal(NAME_ADAPTERS[hub].enabled, true, hub);
});

// ---------------------------------------------------------------- 8. Pagination, View more, stale exclusion
test('8. per-hub pages, View more and revision are preserved; an initial cap never hides another hub', async () => {
  const many: FixtureRecord[] = [...FIVE_ALLIED_FIXTURE, ...Array.from({ length: 9 }, (_, i): FixtureRecord => ({ hub: 'move', key: `fx-allied-m${i}`, name: `Allied Relocation ${String.fromCharCode(65 + i)}`, entityType: 'Mover (Carrier)', profilePath: `/companies/fx-allied-m${i}` }))];
  const first = await ask('Allied', null, fx(many));
  const move = first.hubs.find((h) => h.hub === 'move')!;
  assert.equal(move.candidates.length, 5); assert.equal(move.hasMore, true); assert.equal(move.state, 'PARTIAL_TRUNCATED'); assert.equal(move.hubReportedTotal, 11);
  assert.ok(first.hubs.find((h) => h.hub === 'senior')!.candidates.length === 1, 'a full Move page cannot hide Senior');
  const view = buildNameResultsView({ query: 'Allied', name: 'Allied', scope: 'all', hubs: first.hubs });
  const group = view.groups.find((g) => g.hub === 'move')!; assert.equal(group.shown, INITIAL_CARDS_PER_HUB); assert.equal(group.canFetchMore, true); assert.equal(group.moreMayExist, true);
  assert.match(view.chips.find((c) => c.id === 'move')!.label, /\(5\+\)/, 'the first page is never presented as every match');
  const d = decideNameCandidateSearch('Allied', { selectedHub: 'move' }); assert.ok(d.operation === 'NAME_CANDIDATES');
  const second = await searchNameCandidates({ name: 'Allied', hubScope: 'move', pages: { move: 2 }, revision: 7 }, fx(many));
  const page2 = second.hubs.find((h) => h.hub === 'move')!;
  assert.equal(second.request.revision, 7, 'revision is echoed so the client can discard stale responses');
  assert.equal(second.request.name, 'Allied'); assert.equal(second.request.hubScope, 'move'); assert.equal(page2.page, 2);
  assert.equal(new Set([...move.candidates, ...page2.candidates].map((c) => c.stableKey)).size, 10, 'page 2 returns new records, not repeats');
  assert.equal((await searchNameCandidates({ name: 'Allied', hubScope: 'all', pages: { move: 99999 } }, fx(many))).hubs.find((h) => h.hub === 'move')!.page, 20, 'page is bounded');
});

// ---------------------------------------------------------------- 9. Policy / URLs
test('9. restricted grains stay restricted; no profile URL is ever invented; off-origin links are dropped', async () => {
  // TH-SEARCH-R1-019I: insuranceNameAdapter now consumes the RELEASED insurance-name-candidates-v1
  // operation (see th-search-r1-019i.test.ts for the full acceptance/negative-control gate). The old
  // v2-shaped mixed producer+agency fixture this test used to assert against is retired for
  // NAME_CANDIDATES: under the released v1 contract's strict structural validation, a producer/person
  // row is now a malformed contribution that fails the WHOLE response (never silently dropped
  // alongside valid rows) -- that behavior has its own dedicated control in th-search-r1-019i.test.ts
  // ("12. person/producer rejected"). This control keeps the still-relevant "no profile URL invented,
  // off-origin link dropped" assertions, in the new v1 shape, with no producer row mixed in.
  const insurance = await insuranceNameAdapter.search('allied', 1, ctx(jsonFetch(() => ({ body: {
    contract: 'insurance-name-candidates-v1', contractVersion: '1.0.0', schemaFingerprint: 'c272675bdde4adab8d6672be7fb3143319ada5ec5e61dcf72dc7cda295b0d62f',
    hub: 'insurance', operation: 'name_candidates', resultState: 'CANDIDATES',
    name: { supplied: 'allied', normalized: 'allied', distinctiveTokens: ['allied'], predicateApplied: true, predicate: 'x' },
    scope: {},
    candidates: [
      { stableKey: 'insurance:agency:a1', entityClass: 'agency', displayName: 'ALLIED AGENCY', npn: '222', naicCode: null, match: { field: 'display_name', value: 'ALLIED AGENCY', method: 'distinctive_token_candidate' }, publicationState: 'RESEARCH_ROW_ONLY', action: { type: 'RESEARCH', url: '/ask?q=Find+allied&selected=a1' }, profileUrl: null, selectionUrl: '/ask?q=Find+allied&selected=a1', whyMatched: 'x' },
      { stableKey: 'insurance:legal_insurer:e1', entityClass: 'legal_insurer', displayName: 'ALLIED EVIL', npn: null, naicCode: '999', match: { field: 'canonical_legal_name', value: 'ALLIED EVIL', method: 'normalized_exact_name' }, publicationState: 'PUBLIC_PROFILE', action: { type: 'PROFILE', url: 'https://evil.example/providers/allied' }, profileUrl: 'https://evil.example/providers/allied', selectionUrl: '/ask?q=Find+allied&selected=e1', whyMatched: 'x' },
    ],
    pagination: { page: 1, limit: 10, returned: 2, hasMore: false, nextPage: null, outOfRange: false, matchedCount: 2, matchedCountIsExact: true, completeness: 'COMPLETE', suppressedByPublicationPolicy: 0 },
    limitations: [], message: null,
  } }))));
  assert.deepEqual(insurance.candidates.map((c) => c.displayName), ['ALLIED AGENCY', 'ALLIED EVIL']);
  assert.equal(insurance.candidates[0].action?.href, 'https://www.insurancetrusthub.com/ask?q=Find+allied&selected=a1', 'hub-supplied URL kept, resolved onto the canonical origin');
  assert.equal(insurance.candidates[0].action?.type, 'RESEARCH');
  assert.equal(insurance.candidates[1].action, null, 'an off-origin profile link is dropped, and no replacement URL is fabricated');
  assert.equal(safeHubUrl('move', 'javascript:alert(1)'), null); assert.equal(safeHubUrl('move', 'http://www.movetrusthub.com/x'), null);
  assert.equal(safeHubUrl('investor', 'https://adviserinfo.sec.gov/firm/summary/1')?.official, true);
  const restricted = await investorNameAdapter.search('allied', 1, ctx(jsonFetch(() => ({ body: { contract: 'trusthub-specialist-execution-v2', contractVersion: '2.0.0', schemaFingerprint: 'a92b72c4a30de1021ecf25d26decb852b52394f741ac26919b89d14a234ab384', resultState: 'PUBLICATION_RESTRICTED', message: 'Not published.' } }))));
  assert.equal(restricted.state, 'POLICY_RESTRICTED'); assert.equal(restricted.candidates.length, 0);
  const noProfile = (await ask('Beacon Insurance Agency')).hubs.flatMap((h) => h.candidates)[0];
  assert.equal(noProfile.action, null, 'profile absence does not produce an invented URL'); assert.equal(noProfile.publicationState, 'RESEARCH_ROW_ONLY');
  assert.equal(fixtureModeEnabled({ NAME_CANDIDATES_FIXTURE: 'five-allied', VERCEL_ENV: 'production' }), false, 'fixtures can never be served in production');
  assert.equal(fixtureModeEnabled({}), false);
});
test('9b. contract/version drift and the Senior category-intent decline are failures/unsupported, never misses', async () => {
  const drift = await lenderNameAdapter.search('Rocket Mortgage', 1, ctx(jsonFetch(() => ({ body: { contract: 'trusthub-specialist-execution-v2', contractVersion: '9.9.9', schemaFingerprint: 'x', resultState: 'NO_CONFIDENT_MATCH', queryInterpretation: { identityName: 'rocket mortgage' } } }))));
  assert.deepEqual([drift.state, drift.failureKind], ['TECHNICAL_FAILURE', 'contract_mismatch']);
  // TH-SEARCH-R1-019G: seniorNameAdapter now consumes the RELEASED senior-name-candidates-v1
  // operation (see th-search-r1-019g.test.ts for the full acceptance/negative-control gate) --
  // the old senior-ask-v1 free-text misparse shape this test used to assert against is retired
  // for NAME_CANDIDATES.
  const misparse = await seniorNameAdapter.search('senior care Florida', 1, ctx(jsonFetch(() => ({ status: 422, body: { contract: 'senior-name-candidates-v1', hub: 'senior', resultState: 'UNSUPPORTED_OPERATION', name: { supplied: 'senior care Florida', predicateApplied: false }, message: 'This text was not accepted as a structured provider name.' } }))));
  assert.equal(misparse.state, 'UNSUPPORTED_OPERATION'); assert.equal(misparse.nameFilterApplied, false);
  const miss = await seniorNameAdapter.search('zzqx', 1, ctx(jsonFetch(() => ({ body: { contract: 'senior-name-candidates-v1', hub: 'senior', resultState: 'COMPLETED_NO_CANDIDATES', name: { supplied: 'zzqx', predicateApplied: true }, candidates: [], pagination: { page: 1, hasMore: false }, limitations: [] } }))));
  assert.deepEqual([miss.state, miss.nameFilterApplied], ['COMPLETED_NO_CANDIDATES', true]);
  const timeout = await moveNameAdapter.search('Allied', 1, ctx((async () => { throw Object.assign(new Error('aborted'), { name: 'AbortError' }); }) as typeof fetch));
  assert.deepEqual([timeout.state, timeout.failureKind], ['TECHNICAL_FAILURE', 'timeout']);
});

// ---------------------------------------------------------------- 10. Protected behavior
test('10. identifiers, cohorts, definitions, journeys, evidence requests and missing subjects keep their protected paths', () => {
  const protectedInputs: Array<[string, RegExp]> = [
    ['NMLS 401052', /IDENTIFIER/], ['USDOT 3244649', /IDENTIFIER/], ['Find CRD 166089.', /IDENTIFIER/], ['3244649', /BARE_DIGITS/], ['NAIC ABCD', /./],
    ['roofers in Broward County', /LOCATIVE|PLANNER/], ['Show nursing homes in Palm Beach County.', /PLANNER_PROTECTED:CARE_TASK/], ['senior care Florida', /CARE_TASK/],
    ['Who owns this company?', /SPECIFIC_REFERENCE_WITHOUT_IDENTITY/], ['What is an RIA?', /EXPLAINER/], ['How do I verify a mover?', /HOW_TO/],
    ["I'm buying a home in Broward County. What should I research?", /MULTIPLE_SPECIALIST_HUBS|QUESTION/], ['complaints about Rocket Mortgage', /EVIDENCE_REQUEST/],
    ['moving company', /CATEGORY/], ['licensed movers', /./], ['best movers', /./], ['auto transport carrier', /CATEGORY/], ['insurance', /CATEGORY/], ['What does TrustHub know about Broward?', /./],
  ];
  for (const [q, reason] of protectedInputs) { const d = decideNameCandidateSearch(q); assert.equal(d.operation, 'NOT_NAME_SEARCH', `${q} must keep its existing path`); if (d.operation === 'NOT_NAME_SEARCH') assert.match(d.reason, reason, q); }
  assert.equal(planAskResearch('NMLS 401052').executionMode, 'IDENTIFIER'); assert.equal(planAskResearch('USDOT 3244649').primaryHub, 'move');
  assert.equal(planAskResearch('roofers in Broward County').intent, 'COHORT_BROWSE');
  assert.throws(() => validateSuppliedName('a')); assert.throws(() => validateSuppliedName('<b>x</b>')); assert.throws(() => validateSuppliedName('x'.repeat(121)));
  assert.equal(validateSuppliedName('  1-800-Pack-Rat  '), '1-800-Pack-Rat', 'validated, never truncated or rewritten');
});
test('10b. telemetry carries outcome classes only -- never the searched name, identifiers or URLs', async () => {
  const t = JSON.stringify(nameCandidateTelemetry(await ask('Allied')));
  assert.doesNotMatch(t, /allied|9000001|https?:/i);
});

// ---------------------------------------------------------------- Source hygiene
test('source files contain no raw control bytes (regex escapes must stay escapes)', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const dir = new URL('.', import.meta.url);
  const files = [...readdirSync(dir).map((f) => new URL(f, dir)), new URL('../../../components/name-candidate-results.tsx', dir), new URL('../../../app/api/name-candidates/route.ts', dir)];
  for (const file of files) {
    const bad = [...readFileSync(file)].filter((byte) => (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) || byte === 127).length;
    assert.equal(bad, 0, `${file.pathname} contains ${bad} raw control byte(s)`);
  }
});

// ---------------------------------------------------------------- Holdout-derived blockers (found by the frozen live holdout)
test('H1. organization-shaped names are searched even where the planner read a journey, care task or place', () => {
  for (const q of ['JUPITER REHABILITATION AND HEALTHCARE CENTER', 'jupiter rehabilitation and healthcare center', 'Deerbrook Skilled Nursing and Rehab Center', 'FFIII Houston SNF Tenant LLC', '1ST TEXAS AGENCY INC', 'CAPITAL ASSET MANAGEMENT, INC.']) {
    const d = decideNameCandidateSearch(q);
    assert.equal(d.operation, 'NAME_CANDIDATES', `REDUNDANT CLARIFICATION: ${q} -> ${d.operation === 'NOT_NAME_SEARCH' ? d.reason : ''}`);
  }
  // ...but the planner's protected reading stays the fallback, and real tasks/journeys are untouched.
  const jupiter = decideNameCandidateSearch('Jupiter Rehabilitation and Healthcare Center');
  assert.ok(jupiter.operation === 'NAME_CANDIDATES' && jupiter.alternateCohortInterpretation === true);
  for (const q of ['I need a mover and a mortgage company', 'a mover and a mortgage lender', 'senior care Florida', 'nursing homes in Palm Beach County', 'moving company and storage services', 'help my mother find a care facility']) {
    assert.equal(decideNameCandidateSearch(q).operation, 'NOT_NAME_SEARCH', `${q} must keep its protected path`);
  }
});
test('H2. the name-echo proof tolerates hub apostrophe/ampersand folding ("Al\'s" -> "al s")', async () => {
  const { echoesName } = await import('./adapters.ts');
  assert.equal(echoesName('al s relocation storage', "Al's Relocation & Storage"), true);
  assert.equal(echoesName('als relocation storage', "Al's Relocation & Storage"), true);
  assert.equal(echoesName('allied', 'Allied Van Lines'), false, 'a different (shortened) echo is still not proof');
  assert.equal(echoesName(null, 'Allied'), false); assert.equal(echoesName('', 'Allied'), false);
});
test('H3. no category-word-only padding: rows must relate to the distinctive part of the name', () => {
  assert.equal(rowRelatesToName('C&L Movers LLC', 'C&L Movers LLC', 'EXACT_SOURCE_NAME'), true);
  for (const padded of ['Call The Movers', 'Caseys Movers LLC', 'Champion Movers LLC']) assert.equal(rowRelatesToName('C&L Movers LLC', padded, 'PREFIX_OR_TOKEN'), false, padded);
  assert.equal(rowRelatesToName('Allied Moving', 'Best Moving', 'PREFIX_OR_TOKEN'), false);
  assert.equal(rowRelatesToName('Allied Moving', 'Allied Van Lines', 'PREFIX_OR_TOKEN'), true);
  // Review-1: a hub "contains" hit that lands MID-WORD is irrelevant and is no longer admitted (found by the holdout: CLEVERALPHA for "Alpha Asset Management").
  assert.equal(rowRelatesToName('tate asset management', 'PARK STATE ASSET MANAGEMENT LLC', 'NAME_CONTAINS'), false);
  assert.equal(rowRelatesToName('Alpha Asset Management', 'CLEVERALPHA ASSET MANAGEMENT, LLC', 'NAME_CONTAINS'), false);
  assert.equal(rowRelatesToName('tate asset management', '"TATE ASSET MANAGEMENT" AND "DCO WEALTH MANAGEMENT"', 'NAME_CONTAINS'), true, 'word-boundary containment is kept');
  assert.equal(rowRelatesToName('Alpha Asset Management', 'ALPHA ASSET MANAGEMENT', 'NAME_CONTAINS'), true);
  assert.equal(rowRelatesToName('Capital Asset Management, Inc.', 'CAPITAL ASSET MANAGEMENT, INC.', 'EXACT_SOURCE_NAME'), true, 'all-generic names still relate to themselves');
});
test('H4. padding-only pages are dropped without a false failure; an ignored filter is still a failure', async () => {
  const base = { contractVersion: MOVE_NETWORK_RESOLVER_VERSION, schemaFingerprint: MOVE_NETWORK_SCHEMA_FINGERPRINT, contractFingerprint: MOVE_NETWORK_CONTRACT_FINGERPRINT, resolutionClass: 'FUZZY_CANDIDATES', returnedResultCount: 2, normalizedQuery: 'c l movers' };
  const row = (name: string) => ({ publicDisplayName: name, legalName: null, canonicalSlug: name.toLowerCase().replaceAll(' ', '-'), canonicalUrl: 'https://www.movetrusthub.com/companies/x', usdot: '1', mc: null, role: 'Carrier', recordedHq: {}, matchClass: 'token_prefix', matchReason: 'Company-name token match' });
  const padded = await moveNameAdapter.search('C&L Movers', 1, ctx(jsonFetch(() => ({ body: { ...base, totalMatchingIdentityCount: 80, results: [row('Call The Movers'), row('Caseys Movers LLC')] } }))));
  assert.equal(padded.state, 'PARTIAL_TRUNCATED'); assert.equal(padded.nameFilterApplied, true); assert.equal(padded.candidates.length, 0); assert.ok(padded.continuation, 'the hub continuation is offered');
  const { summarizeCoverage } = await import('./orchestrator.ts');
  const coverage = summarizeCoverage([padded]);
  assert.equal(coverage.genuineNetworkMiss, false); assert.equal(coverage.completedHubsMiss, false); assert.deepEqual(coverage.incompleteHubs, ['move']);
  const view = buildNameResultsView({ query: 'C&L Movers', name: 'C&L Movers', scope: 'move', hubs: [padded] });
  // Review-1 finding 2: a truncated-empty hub is a GROUP with a real next-page control, not a dead-end disclosure.
  assert.equal(view.kind, 'NOT_COMPLETED'); const g = view.groups.find((row) => row.hub === 'move'); assert.ok(g && g.canFetchMore && /has more records to check/.test(g.emptyPageNote ?? ''));
  const ignored = await moveNameAdapter.search('C&L Movers', 1, ctx(jsonFetch(() => ({ body: { ...base, totalMatchingIdentityCount: 2, results: [row('Zeta Relocation'), row('Omega Hauling')] } }))));
  assert.deepEqual([ignored.state, ignored.failureKind], ['TECHNICAL_FAILURE', 'name_filter_not_proven']);
});
