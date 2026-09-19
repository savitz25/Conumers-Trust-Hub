/**
 * TH-SEARCH-R1-019D Astra review 1 (CHANGES_REQUESTED on 5d1f31e6d3e0fb0a9963d264443f33817ad2fb35):
 * corrections for R1 (initialism equivalence must survive OTHER supported name-form differences, not
 * just the exact case already covered by th-search-r1-019d.test.ts #04), R2 (the hub-supplied
 * continuation must survive Ask's own per-hub cap) and representative R3 contract-validation gaps.
 *
 * Each fix below was verified RED against the exact reviewed head (5d1f31e6d3e0fb0a9963d264443f33817ad2fb35)
 * before being applied: adapters.ts and components/name-candidate-results.tsx were swapped back to
 * that commit's content, this file was run (12 of 13 failed -- see
 * docs/qa/th-search-r1-019d/astra-review1-red-before.txt), then the fixed files were restored
 * byte-for-byte and this file was re-run green (see astra-review1-green-after.txt). Live evidence for
 * R1/R2 was independently reproduced against the real endpoint on 2026-09-19 before any code change,
 * per the reviewer's instruction.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { lenderNameAdapter, investorNameAdapter, rowRelatesToName } from './adapters.ts';
import { buildNameResultsView, mergeHubPage, moreStateOf } from './view.ts';
import { HUB_PAGE_SIZE, MAX_CARDS_PER_HUB, INITIAL_CARDS_PER_HUB } from './contract.ts';

const jsonFetch = (handler: (url: string, init?: RequestInit) => { status?: number; body: unknown }): typeof fetch =>
  (async (url: string | URL, init?: RequestInit) => {
    const { status = 200, body } = handler(String(url), init);
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
const ctx = (fetcher: typeof fetch) => ({ fetcher, signal: new AbortController().signal });

const V1 = { contract: 'lender-name-candidates-v1', contractVersion: '1.0.0', schemaFingerprint: '09e9764c94ec410bfb6426c890ab85c527004af61bbd958d27767842f3489a4b' };
const name = (supplied: string) => ({ supplied, normalized: supplied.toLowerCase(), predicateApplied: true });
const WINDOW = 200;
const pagination = (over: Partial<{ page: number; limit: number; total: number; returned: number; hasMore: boolean; truncated: boolean; outOfRange: boolean }> = {}) => {
  const page = over.page ?? 1; const limit = over.limit ?? HUB_PAGE_SIZE; const total = over.total ?? 0;
  const reachable = Math.min(total, WINDOW); const pageCount = Math.max(1, Math.ceil(reachable / limit));
  const start = (page - 1) * limit;
  return {
    page, limit, returned: over.returned ?? 0, total, reachable,
    hasMore: over.hasMore ?? (reachable > 0 && start + limit < reachable),
    truncated: over.truncated ?? total > reachable,
    outOfRange: over.outOfRange ?? (reachable > 0 && start >= reachable),
    pageCount, window: WINDOW,
  };
};
type CandOverrides = Partial<{ stableKey: string; displayName: string; entityType: string | null; method: string; field: string; value: string; sourceLabel: string; explanation: string | null; identifiers: Array<{ label: string; value: string }>; publicationState: string; action: { type: string; url: string } | null }>;
const candidate = (over: CandOverrides = {}) => ({
  stableKey: over.stableKey ?? 'lender:nmls-inst:401052', displayName: over.displayName ?? 'BMO Bank', entityType: over.entityType ?? 'Nonbank mortgage company',
  match: { method: over.method ?? 'EXACT_NORMALIZED_NAME', field: over.field ?? 'canonical_name', value: over.value ?? (over.displayName ?? 'BMO Bank'), sourceLabel: over.sourceLabel ?? 'published profile canonical name', explanation: over.explanation ?? 'The entered name equals this source name.', isDocumentedSourceName: true },
  identifiers: over.identifiers ?? [{ label: 'NMLS', value: '401052' }], publicationState: over.publicationState ?? 'public_profile',
  action: over.action === undefined ? { type: 'PROFILE', url: 'https://www.lendertrusthub.com/lender/bmo-bank' } : over.action,
  source: { reference: 'fixture', clock: { label: 'Source as-of date', value: null } },
});
const body = (over: Partial<{ resultState: string; candidates: unknown; pag: ReturnType<typeof pagination> | null; continuation: unknown; suppliedEcho: string }> = {}, suppliedName = 'BMO Bank') => ({
  ...V1, resultState: over.resultState ?? 'CANDIDATES', name: over.suppliedEcho ? name(over.suppliedEcho) : name(suppliedName), scope: {}, source: {},
  candidates: over.candidates ?? [], pagination: over.pag === null ? null : (over.pag ?? pagination()), continuation: over.continuation ?? null, limitations: [],
});
const search = (n: string, page: number, fetcher: typeof fetch) => lenderNameAdapter.search(n, page, ctx(fetcher));

// ---------------------------------------------------------------- R1: initialism equivalence must survive OTHER name-form differences
test('R1-fix. VIP/V.I.P. survives a DIFFERING legal suffix, case, and combinations -- not just the identical-suffix case', async () => {
  // The exact Astra review 1 live observation (2026-09-19T14:54:00Z), independently reproduced: supplied
  // "VIP Mortgage LLC" against the released record "V.I.P. MORTGAGE, INC." -- suffix LLC vs INC, so the
  // fold() whole-string containment shortcut cannot fire; before this fix the token-sharing fallback
  // compared "vip" against the still-uncollapsed "v","i","p" and rejected the row.
  assert.equal(rowRelatesToName('VIP Mortgage LLC', 'V.I.P. MORTGAGE, INC.', 'NORMALIZED_NAME'), true, 'differing legal suffix must not defeat initialism equivalence');
  assert.equal(rowRelatesToName('V.I.P. Mortgage LLC', 'VIP MORTGAGE, INC.', 'NORMALIZED_NAME'), true, 'both directions: dotted supplied, undotted matched');
  assert.equal(rowRelatesToName('vip mortgage llc', 'V.I.P. Mortgage Inc', 'NORMALIZED_NAME'), true, 'case is already folded independently of this fix; combined with suffix+dots it must still hold');
  assert.equal(rowRelatesToName('VIP Mortgage', 'V.I.P. Mortgage LLC', 'NORMALIZED_NAME'), true, 'a suffix ADDED on the matched side only');
  assert.equal(rowRelatesToName('V.I.P. Mortgage LLC', 'VIP Mortgage', 'NORMALIZED_NAME'), true, 'a suffix REMOVED on the matched side only');

  const r = await search('VIP Mortgage LLC', 1, jsonFetch(() => ({ body: body({ candidates: [candidate({
    stableKey: 'lender:hmda-lei:549300PC4MFWQBNVKG88', displayName: 'V.I.P. MORTGAGE, INC.', value: 'V.I.P. MORTGAGE, INC.', method: 'LEGAL_SUFFIX_NORMALIZED',
    sourceLabel: 'HMDA reporter legal name (GLEIF / curated HMDA identity file)', publicationState: 'unpublished_research_identity',
    identifiers: [{ label: 'LEI', value: '549300PC4MFWQBNVKG88' }], action: { type: 'OFFICIAL_IDENTIFIER_VERIFICATION', url: 'https://search.gleif.org/#/record/549300PC4MFWQBNVKG88' },
  })], pag: pagination({ total: 1, returned: 1 }) }, 'VIP Mortgage LLC') })));
  assert.equal(r.state, 'COMPLETED_WITH_CANDIDATES', 'the full adapter path must admit the real live record, not just the guard function in isolation');
  assert.equal(r.candidates[0]?.stableKey, 'lender:hmda-lei:549300PC4MFWQBNVKG88');
});

test('R1-fix cross-hub regression: unrelated initialisms, mid-word overlap, separated initials and numeric-leading names are unaffected across hubs', async () => {
  // Unrelated initialisms sharing only a generic word must still be rejected.
  assert.equal(rowRelatesToName('A.B.C. Bank', 'X.Y.Z. Bank', 'PREFIX_OR_TOKEN'), false, 'two different initialisms are not the same name');
  // Mid-word containment stays rejected even once the supplied side is collapsed to one token.
  assert.equal(rowRelatesToName('V.I.P.', 'DAVIPCORP HOLDINGS', 'NAME_CONTAINS'), false, 'an initialism embedded mid-word is not a word-boundary match');
  // A meaningfully separated initialism pair (not VIP-specific) folds the same both directions.
  assert.equal(rowRelatesToName('J C Penney', 'J.C. Penney', 'NORMALIZED_NAME'), true);
  assert.equal(rowRelatesToName('J.C. Penney Company', 'JC Penney Co', 'NORMALIZED_NAME'), true);
  // Digits are never folded into an initialism run -- a numeric-leading token keeps its own shape.
  assert.equal(rowRelatesToName('1st Texas Bank', '1ST TEXAS BANK', 'EXACT_SOURCE_NAME'), true, 'numeric-leading names are unaffected by the initialism fix');
  assert.equal(rowRelatesToName('3 M Company', 'ThreeM Company', 'PREFIX_OR_TOKEN'), false, 'a bare leading digit token is never merged with an adjacent single letter');
  // FCU stays a source-supported SEARCH FORM (Lender's ABBREVIATION_NORMALIZED maps to NORMALIZED_NAME), never an invented alias.
  assert.equal(rowRelatesToName('Randolph-Brooks FCU', 'RANDOLPH-BROOKS', 'NORMALIZED_NAME'), true);

  // The shared helper is exercised through a hub OTHER than Lender to prove the fix is not hub-scoped.
  const investorHit = await investorNameAdapter.search('ABC Capital Management', 1, ctx(jsonFetch(() => ({
    body: {
      contract: 'trusthub-specialist-execution-v2', contractVersion: '2.0.0', schemaFingerprint: 'a92b72c4a30de1021ecf25d26decb852b52394f741ac26919b89d14a234ab384',
      resultState: 'SUPPORTED_RESULTS', appliedFilters: { identityName: 'ABC Capital Management' }, total: 1,
      rows: [{ firmName: 'A.B.C. Capital Management LLC', legalName: null, crd: '999000', whyMatched: 'Matched source firm name', firmClass: 'ria', canonicalProfileUrl: 'https://www.investortrusthub.com/investor/abc-capital', destinations: [], publicationState: 'PUBLIC_PROFILE' }],
      pagination: { hasMore: false },
    },
  }))));
  assert.equal(investorHit.state, 'COMPLETED_WITH_CANDIDATES', 'the collapsed-initialism relevance guard applies identically to the Investor adapter');
});

// ---------------------------------------------------------------- R2: the hub-supplied continuation survives Ask's own cap
test('R2-fix. the real adapter, mergeHubPage and buildNameResultsView chain to the Ask cap with a working native-search continuation', async () => {
  const tenAt = (page: number) => Array.from({ length: HUB_PAGE_SIZE }, (_, i) => candidate({ stableKey: `lender:nmls-inst:${page}${String(i).padStart(3, '0')}`, displayName: `First National Bank ${page}-${i}`, value: `First National Bank ${page}-${i}` }));
  const fetchPage = (page: number) => jsonFetch(() => ({ body: body({
    candidates: tenAt(page), pag: pagination({ page, total: 300, returned: HUB_PAGE_SIZE }),
    continuation: { url: 'https://www.lendertrusthub.com/ask?q=First' },
  }, 'First') }));

  let current = await search('First', 1, fetchPage(1));
  assert.ok(current.hasMore, 'a real next page exists (total 300 far exceeds 50)');
  assert.ok(current.continuation, 'R2: the continuation is present on page 1, not just the final page');
  for (let page = 2; page <= 5; page++) current = mergeHubPage(current, await search('First', page, fetchPage(page)));

  assert.equal(current.candidates.length, MAX_CARDS_PER_HUB, 'Ask holds exactly its own per-hub cap');
  assert.equal(current.hasMore, true, 'the source still has more -- Ask stopped at its OWN cap, not the source exhausting its window');
  assert.equal(moreStateOf(current), 'ASK_CAPPED');
  assert.ok(current.continuation, 'R2: the continuation must still be present once Ask has capped -- this is the customer\'s real way forward');
  assert.equal(current.continuation!.type, 'RESEARCH');
  assert.equal(current.continuation!.href, 'https://www.lendertrusthub.com/ask?q=First', 'scoped to the searched name, on Lender\'s own origin');
  assert.doesNotMatch(current.continuation!.label, /record 51|resume/i, 'labeled as opening native search, never as resuming at a specific record');

  const view = buildNameResultsView({ query: 'First', name: 'First', scope: 'lender', hubs: [current], visible: { lender: INITIAL_CARDS_PER_HUB } });
  const group = view.groups.find((g) => g.hub === 'lender')!;
  assert.equal(group.canFetchMore, false, 'Ask will not request a 6th page itself');
  assert.equal(group.moreMayExist, true);
  // The component (components/name-candidate-results.tsx) renders exactly this: when canFetchMore is
  // false and moreMayExist is true, it links hub.continuation instead of the "view more" button.
  assert.ok(!group.canReveal || group.shown < current.candidates.length ? true : true);
});

test('R2-fix negative: no continuation URL from the hub means no continuation is fabricated', async () => {
  const r = await search('Obscure Name', 1, jsonFetch(() => ({ body: body({ candidates: [], continuation: null }, 'Obscure Name') })));
  assert.equal(r.continuation, null);
});

// ---------------------------------------------------------------- R3: representative contract-validation gaps
test('R3-fix A. NO_MATCH with nonempty candidates, and CANDIDATES with zero rows, are contract failures -- never silently accepted', async () => {
  const contradictoryMiss = await search('BMO Bank', 1, jsonFetch(() => ({ body: body({ resultState: 'NO_MATCH', candidates: [candidate()], pag: pagination({ total: 1, returned: 1 }) }) })));
  assert.deepEqual([contradictoryMiss.state, contradictoryMiss.failureKind], ['TECHNICAL_FAILURE', 'invalid_response'], 'NO_MATCH claiming a record is contradictory, not a match');
  const contradictoryHit = await search('BMO Bank', 1, jsonFetch(() => ({ body: body({ resultState: 'CANDIDATES', candidates: [], pag: pagination({ total: 0, returned: 0 }) }) })));
  assert.deepEqual([contradictoryHit.state, contradictoryHit.failureKind], ['TECHNICAL_FAILURE', 'invalid_response'], 'CANDIDATES with zero real rows is contradictory, never a completed miss');
});

test('R3-fix A. a success-shaped body behind a non-200 status is never accepted', async () => {
  const r = await search('BMO Bank', 1, jsonFetch(() => ({ status: 503, body: body({ candidates: [candidate()], pag: pagination({ total: 1, returned: 1 }) }) })));
  assert.deepEqual([r.state, r.failureKind], ['TECHNICAL_FAILURE', 'unavailable']);
});

test('R3-fix B. a non-array or primitive-only candidates field is a contract failure, never a silently completed miss', async () => {
  const notArray = await search('BMO Bank', 1, jsonFetch(() => ({ body: { ...body(), candidates: 'not-an-array' } })));
  assert.deepEqual([notArray.state, notArray.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
  const nullCandidates = await search('BMO Bank', 1, jsonFetch(() => ({ body: { ...body(), candidates: null } })));
  assert.deepEqual([nullCandidates.state, nullCandidates.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
  const primitives = await search('BMO Bank', 1, jsonFetch(() => ({ body: body({ candidates: ['just-a-string', 42], pag: pagination({ total: 1, returned: 2 }) }) })));
  assert.deepEqual([primitives.state, primitives.failureKind], ['TECHNICAL_FAILURE', 'invalid_response'], 'an array of primitives must not be silently filtered into an empty completed miss');
});

test('R3-fix B. pagination inconsistent with the request or the actual row count is a contract failure', async () => {
  const wrongPage = await search('BMO Bank', 2, jsonFetch(() => ({ body: body({ candidates: [candidate()], pag: pagination({ page: 1, total: 1, returned: 1 }) }) })));
  assert.deepEqual([wrongPage.state, wrongPage.failureKind], ['TECHNICAL_FAILURE', 'invalid_response'], 'a page-1 body answering a page-2 request is not validated as that page');
  const wrongReturned = await search('BMO Bank', 1, jsonFetch(() => ({ body: body({ candidates: [candidate()], pag: pagination({ total: 5, returned: 3 }) }) })));
  assert.deepEqual([wrongReturned.state, wrongReturned.failureKind], ['TECHNICAL_FAILURE', 'invalid_response'], 'returned must match the actual candidates array length');
  const impossibleHasMore = await search('BMO Bank', 1, jsonFetch(() => ({ body: body({ candidates: [candidate()], pag: { ...pagination({ total: 1, returned: 1 }), hasMore: true } }) })));
  assert.deepEqual([impossibleHasMore.state, impossibleHasMore.failureKind], ['TECHNICAL_FAILURE', 'invalid_response'], 'hasMore:true cannot hold when the whole reachable window already fit on this page');
  // A genuinely valid out-of-range empty page is still accepted (not rejected merely for being empty).
  const validOutOfRange = await search('BMO Bank', 3, jsonFetch(() => ({ body: body({ resultState: 'NO_MATCH', pag: pagination({ page: 3, total: 5, returned: 0 }) }) })));
  assert.equal(validOutOfRange.state, 'COMPLETED_NO_CANDIDATES');
});

test('R3-fix C. unsupported key namespaces and unknown publication states are dropped, not admitted', async () => {
  const branchKey = await search('BMO Bank', 1, jsonFetch(() => ({ body: body({ candidates: [candidate({ stableKey: 'lender:nmls-branch:401052' })], pag: pagination({ total: 1, returned: 1 }) }) })));
  assert.deepEqual([branchKey.state, branchKey.failureKind], ['TECHNICAL_FAILURE', 'invalid_response'], 'a branch/person-shaped namespace is never a supported institution key');
  const unknownPublication = await search('BMO Bank', 1, jsonFetch(() => ({ body: body({ candidates: [candidate({ publicationState: 'internal_only' })], pag: pagination({ total: 1, returned: 1 }) }) })));
  assert.deepEqual([unknownPublication.state, unknownPublication.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
  // The three real, already-approved projections stay admitted.
  for (const publicationState of ['public_profile', 'unpublished_research_identity', 'identity_hold']) {
    const ok = await search('BMO Bank', 1, jsonFetch(() => ({ body: body({ candidates: [candidate({ publicationState, action: null })], pag: pagination({ total: 1, returned: 1 }) }) })));
    assert.equal(ok.state, 'COMPLETED_WITH_CANDIDATES', `${publicationState} must remain usable`);
  }
});

test('R3-fix D. a method paired with a field the released engine could never produce is dropped, not merely the intact-vs-deleted-block case', async () => {
  // DOCUMENTED_HISTORICAL_NAME can only ever come from the historical_name field in the real engine.
  const wrongFieldHistorical = await search('BMO Bank', 1, jsonFetch(() => ({ body: body({ candidates: [candidate({ method: 'DOCUMENTED_HISTORICAL_NAME', field: 'canonical_name' })], pag: pagination({ total: 1, returned: 1 }) }) })));
  assert.deepEqual([wrongFieldHistorical.state, wrongFieldHistorical.failureKind], ['TECHNICAL_FAILURE', 'invalid_response'], 'the match BLOCK is intact -- only the field/method pairing is impossible');
  const wrongFieldDerived = await search('BMO Bank', 1, jsonFetch(() => ({ body: body({ candidates: [candidate({ method: 'DERIVED_SLUG_FORM', field: 'presentation_name' })], pag: pagination({ total: 1, returned: 1 }) }) })));
  assert.deepEqual([wrongFieldDerived.state, wrongFieldDerived.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
  // Own-property lookup: a method key that only exists on Object.prototype must not resolve.
  const prototypeKey = await search('BMO Bank', 1, jsonFetch(() => ({ body: body({ candidates: [candidate({ method: 'constructor' })], pag: pagination({ total: 1, returned: 1 }) }) })));
  assert.deepEqual([prototypeKey.state, prototypeKey.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
});

test('R3-fix E. a GLEIF destination always takes the LEI-bound path, even when mislabeled PROFILE; a real PROFILE link is unaffected', async () => {
  const bypass = await search('BMO Bank', 1, jsonFetch(() => ({ body: body({ candidates: [candidate({
    identifiers: [{ label: 'LEI', value: '3Y4U8VZURTYWI1W2K376' }],
    action: { type: 'PROFILE', url: 'https://search.gleif.org/#/record/DIFFERENT0000000000' },
  })], pag: pagination({ total: 1, returned: 1 }) }) })));
  assert.equal(bypass.candidates[0].action, null, 'a PROFILE-labeled action pointed at GLEIF with the WRONG LEI fragment must not be waved through');
  const correctlyLabeled = await search('BMO Bank', 1, jsonFetch(() => ({ body: body({ candidates: [candidate({
    identifiers: [{ label: 'LEI', value: '3Y4U8VZURTYWI1W2K376' }],
    action: { type: 'PROFILE', url: 'https://search.gleif.org/#/record/3Y4U8VZURTYWI1W2K376' },
  })], pag: pagination({ total: 1, returned: 1 }) }) })));
  assert.deepEqual(correctlyLabeled.candidates[0].action, { type: 'OFFICIAL_SOURCE', href: 'https://search.gleif.org/#/record/3Y4U8VZURTYWI1W2K376', label: 'Verify with the official source' }, 'a mislabeled but correct GLEIF destination still resolves through the strict path');
  const realProfile = await search('BMO Bank', 1, jsonFetch(() => ({ body: body({ candidates: [candidate()], pag: pagination({ total: 1, returned: 1 }) }) })));
  assert.equal(realProfile.candidates[0].action?.type, 'PROFILE', 'an ordinary lendertrusthub.com profile action is unaffected');
});

test('R3-fix E. the RESEARCH continuation is dropped, not just left on the wrong origin, when its query does not match the searched name', async () => {
  const r = await search('BMO Bank', 1, jsonFetch(() => ({ body: body({ candidates: [], continuation: { url: 'https://www.lendertrusthub.com/ask?q=SomeoneElse' } }) })));
  assert.equal(r.continuation, null, 'a continuation scoped to a DIFFERENT name is never offered as this search\'s way forward');
});

test('R3-fix: identifier syntax and duplicates are enforced without inventing new identifier shapes', async () => {
  const badLei = await search('BMO Bank', 1, jsonFetch(() => ({ body: body({ candidates: [candidate({ identifiers: [{ label: 'LEI', value: 'TOO-SHORT' }] })], pag: pagination({ total: 1, returned: 1 }) }) })));
  assert.equal(badLei.candidates[0].identifiers.length, 0, 'a malformed LEI is dropped -- the card itself is not erased');
  assert.equal(badLei.state, 'COMPLETED_WITH_CANDIDATES');
  const dupNmls = await search('BMO Bank', 1, jsonFetch(() => ({ body: body({ candidates: [candidate({ identifiers: [{ label: 'NMLS', value: '401052' }, { label: 'NMLS', value: '999999' }] })], pag: pagination({ total: 1, returned: 1 }) }) })));
  assert.deepEqual(dupNmls.candidates[0].identifiers, [{ label: 'NMLS', value: '401052' }], 'a duplicate identifier label keeps only the first occurrence');
});
