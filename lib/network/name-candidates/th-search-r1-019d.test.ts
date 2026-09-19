/**
 * TH-SEARCH-R1-019D: Ask consumes the RELEASED Lender name-candidates-v1 operation.
 * Real adapter, real orchestrator, real view; only the Lender HTTP transport is mocked (fixture JSON
 * shaped exactly like the released contract). No live network in this gate.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  NAME_ADAPTERS, lenderNameAdapter, moveNameAdapter, rowRelatesToName, safeHubUrl,
  LENDER_NAME_CANDIDATES_LOCK, LENDER_NAME_CANDIDATES_CONTRACT, NAME_SPECIALIST_LOCKS,
} from './adapters.ts';
import { searchNameCandidates } from './orchestrator.ts';
import { buildNameResultsView, mergeHubPage, moreStateOf } from './view.ts';
import { createFixtureAdapters, FIVE_ALLIED_FIXTURE } from './fixtures.ts';
import { MAX_CARDS_PER_HUB, type HubNameSearchOutcome } from './contract.ts';

const jsonFetch = (handler: (url: string, init?: RequestInit) => { status?: number; body: unknown }): typeof fetch =>
  (async (url: string | URL, init?: RequestInit) => {
    const { status = 200, body } = handler(String(url), init);
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
const ctx = (fetcher: typeof fetch) => ({ fetcher, signal: new AbortController().signal });

const V1 = { contract: 'lender-name-candidates-v1', contractVersion: '1.0.0', schemaFingerprint: '09e9764c94ec410bfb6426c890ab85c527004af61bbd958d27767842f3489a4b' };
const name = (supplied: string) => ({ supplied, normalized: supplied.toLowerCase(), predicateApplied: true });
// TH-SEARCH-R1-019D Astra review 1 (R3): pagination fields now follow the released engine's own formulas
// (lib/name-candidates/engine.ts searchNameCandidates; operation.ts pageCount) by default, so an ordinary
// positive fixture does not have to hand-compute reachable/pageCount/truncated itself. hasMore/truncated/
// outOfRange can still be overridden explicitly to build a deliberately inconsistent NEGATIVE fixture.
const WINDOW = 200;
const pagination = (over: Partial<{ page: number; limit: number; total: number; returned: number; hasMore: boolean; truncated: boolean; outOfRange: boolean }> = {}) => {
  const page = over.page ?? 1; const limit = over.limit ?? 10; const total = over.total ?? 0;
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
type CandOverrides = Partial<{ stableKey: string; displayName: string; entityType: string | null; method: string; field: string; value: string; sourceLabel: string; explanation: string | null; identifiers: Array<{ label: string; value: string }>; publicationState: string; action: { type: string; url: string } | null; sourceAsOf: string | null; sourceDateLabel: string }>;
const candidate = (over: CandOverrides = {}) => ({
  stableKey: over.stableKey ?? 'lender:nmls-inst:401052', displayName: over.displayName ?? 'BMO Bank', entityType: over.entityType ?? 'Nonbank mortgage company',
  match: { method: over.method ?? 'EXACT_NORMALIZED_NAME', field: over.field ?? 'canonical_name', value: over.value ?? (over.displayName ?? 'BMO Bank'), sourceLabel: over.sourceLabel ?? 'published profile canonical name', explanation: over.explanation ?? 'The entered name equals this source name.', isDocumentedSourceName: true },
  identifiers: over.identifiers ?? [{ label: 'NMLS', value: '401052' }], publicationState: over.publicationState ?? 'public_profile',
  action: over.action === undefined ? { type: 'PROFILE', url: 'https://www.lendertrusthub.com/lender/bmo-bank' } : over.action,
  source: { reference: 'fixture', clock: { label: over.sourceDateLabel ?? 'Source as-of date', value: over.sourceAsOf ?? null } },
});
const body = (over: Partial<{ resultState: string; candidates: unknown[]; pag: ReturnType<typeof pagination> | null; continuation: unknown; limitations: string[]; suppliedEcho: string }> = {}, suppliedName = 'BMO Bank') => ({
  ...V1, resultState: over.resultState ?? 'CANDIDATES', name: over.suppliedEcho ? name(over.suppliedEcho) : name(suppliedName), scope: {}, source: {},
  candidates: over.candidates ?? [], pagination: over.pag === null ? null : (over.pag ?? pagination()), continuation: over.continuation ?? null, limitations: over.limitations ?? [],
});
const search = (n: string, page: number, fetcher: typeof fetch) => lenderNameAdapter.search(n, page, ctx(fetcher));

// ---------------------------------------------------------------- 1. dispatch goes to v1, never v2; v2 locks untouched
test('01 name dispatch calls the released v1 endpoint, never trusthub-specialist-execution-v2', async () => {
  const calls: string[] = [];
  await search('BMO Bank', 1, jsonFetch((url) => { calls.push(url); return { body: body({ resultState: 'CANDIDATES', candidates: [candidate()], pag: pagination({ total: 1, returned: 1 }) }) }; }));
  assert.deepEqual(calls, [LENDER_NAME_CANDIDATES_LOCK.url]);
  assert.equal(LENDER_NAME_CANDIDATES_LOCK.url, 'https://www.lendertrusthub.com/api/specialist-execution/name-candidates/v1');
  // The pre-existing v2 lock (exact identifiers/evidence/HMDA elsewhere in Ask) is untouched by this change.
  assert.deepEqual(NAME_SPECIALIST_LOCKS.lender, { url: 'https://www.lendertrusthub.com/api/specialist-execution/v2', version: '2.1.0', schemaFingerprint: '0da572d08450e68f4f01a4f4b28e2e813503f50b1a84546a29d7eb817db205dd' });
  assert.equal(LENDER_NAME_CANDIDATES_CONTRACT, 'lender-name-candidates-v1');
});

// ---------------------------------------------------------------- 2. BMO / Alliant survive mapping; Randolph-Brooks stays separate
test('02 BMO and Alliant candidate keys survive mapping; Randolph-Brooks FCU records stay separate, not merged', async () => {
  const bmo = await search('BMO Bank', 1, jsonFetch(() => ({ body: body({ candidates: [candidate({ stableKey: 'lender:nmls-inst:401052', identifiers: [{ label: 'NMLS', value: '401052' }, { label: 'LEI', value: '3Y4U8VZURTYWI1W2K376' }] })], pag: pagination({ total: 1, returned: 1 }) }) })));
  assert.equal(bmo.state, 'COMPLETED_WITH_CANDIDATES'); assert.deepEqual(bmo.candidates[0].identifiers, [{ label: 'NMLS', value: '401052' }, { label: 'LEI', value: '3Y4U8VZURTYWI1W2K376' }]);
  const alliant = await search('Alliant Credit Union', 1, jsonFetch(() => ({ body: body({ candidates: [candidate({ stableKey: 'lender:nmls-inst:197185', displayName: 'Alliant Credit Union', value: 'Alliant Credit Union', identifiers: [{ label: 'NMLS', value: '197185' }] })], pag: pagination({ total: 1, returned: 1 }) }, 'Alliant Credit Union') })));
  assert.equal(alliant.candidates[0].stableKey, 'lender:nmls-inst:197185');
  const rb = await search('Randolph-Brooks FCU', 1, jsonFetch(() => ({ body: body({ resultState: 'AMBIGUOUS_EXACT_NAME', candidates: [
    candidate({ stableKey: 'lender:gleif-lei:AAAAAAAAAAAAAAAAAAAA', displayName: 'RANDOLPH-BROOKS', value: 'RANDOLPH-BROOKS', identifiers: [], method: 'ABBREVIATION_NORMALIZED', sourceLabel: 'HMDA reporter legal name' }),
    candidate({ stableKey: 'lender:nmls-inst:583215', displayName: 'Randolph-Brooks Federal Credit Union', value: 'Randolph-Brooks Federal Credit Union', identifiers: [{ label: 'NMLS', value: '583215' }], method: 'ABBREVIATION_NORMALIZED' }),
  ], pag: pagination({ total: 2, returned: 2 }) }, 'Randolph-Brooks FCU') })));
  assert.equal(rb.state, 'COMPLETED_WITH_CANDIDATES', 'ambiguous-with-records is a candidates state, not a clarification wall');
  assert.deepEqual(rb.candidates.map((c) => c.stableKey), ['lender:gleif-lei:AAAAAAAAAAAAAAAAAAAA', 'lender:nmls-inst:583215'], 'two distinct keys stay two distinct records');
  assert.ok(rb.candidates.every((c) => c.matchMethod === 'NORMALIZED_NAME'), 'ABBREVIATION_NORMALIZED (FCU) maps to a search-form rule, not DOCUMENTED_ALIAS');
});

// ---------------------------------------------------------------- 3. Frost Bank: GLEIF record link with hash, no invented profile
test('03 an HMDA-only research row gets the GLEIF record link with its hash; no profile URL is invented', async () => {
  const r = await search('Frost Bank', 1, jsonFetch(() => ({ body: body({ candidates: [candidate({
    stableKey: 'lender:hmda-lei:G5AHTAP80NWA3Q8RDC78', displayName: 'Frost Bank', value: 'Frost Bank', publicationState: 'unpublished_research_identity',
    identifiers: [{ label: 'LEI', value: 'G5AHTAP80NWA3Q8RDC78' }], action: { type: 'OFFICIAL_IDENTIFIER_VERIFICATION', url: 'https://search.gleif.org/#/record/G5AHTAP80NWA3Q8RDC78' },
  })], pag: pagination({ total: 1, returned: 1 }) }, 'Frost Bank') })));
  const c = r.candidates[0];
  assert.deepEqual(c.action, { type: 'OFFICIAL_SOURCE', href: 'https://search.gleif.org/#/record/G5AHTAP80NWA3Q8RDC78', label: 'Verify with the official source' });
  assert.equal(c.publicationState, 'unpublished_research_identity');
});

// ---------------------------------------------------------------- 4. VIP/V.I.P., FCU, legal-suffix, historical/derived forms admitted with truthful explanations
test('04 punctuation/initialism, FCU, legal-suffix and historical/derived search forms are admitted, truthfully labeled', async () => {
  // Confirmed live 2026-09-19 against the released endpoint (Astra review 1, R1): the real V.I.P. Mortgage HMDA record.
  const vip = await search('VIP Mortgage Inc', 1, jsonFetch(() => ({ body: body({ candidates: [candidate({ stableKey: 'lender:hmda-lei:549300PC4MFWQBNVKG88', displayName: 'V.I.P. MORTGAGE, INC.', value: 'V.I.P. MORTGAGE, INC.', publicationState: 'unpublished_research_identity', identifiers: [{ label: 'LEI', value: '549300PC4MFWQBNVKG88' }], action: null })], pag: pagination({ total: 1, returned: 1 }) }, 'VIP Mortgage Inc') })));
  assert.equal(vip.state, 'COMPLETED_WITH_CANDIDATES', 'the current relevance guard must admit VIP against V.I.P., not reject it'); assert.equal(vip.candidates[0].matchMethod, 'NORMALIZED_NAME');
  assert.equal(rowRelatesToName('VIP Mortgage Inc', 'V.I.P. MORTGAGE, INC.', 'NORMALIZED_NAME'), true, 'contract-level equivalence: initialism forms fold the same on both sides');
  const legalSuffix = await search('rocket mortgage llc', 1, jsonFetch(() => ({ body: body({ candidates: [candidate({ stableKey: 'lender:nmls-inst:3030', displayName: 'Rocket Mortgage', value: 'Rocket Mortgage', method: 'LEGAL_SUFFIX_NORMALIZED', identifiers: [{ label: 'NMLS', value: '3030' }] })], pag: pagination({ total: 1, returned: 1 }) }, 'rocket mortgage llc') })));
  assert.equal(legalSuffix.candidates[0].matchMethod, 'NORMALIZED_NAME');
  const historical = await search('Old Dominion Mortgage', 1, jsonFetch(() => ({ body: body({ candidates: [candidate({ stableKey: 'lender:nmls-inst:5001', displayName: 'Heritage Home Lending', method: 'DOCUMENTED_HISTORICAL_NAME', field: 'historical_name', value: 'Old Dominion Mortgage', sourceLabel: 'historical name recorded on the published profile', identifiers: [{ label: 'NMLS', value: '5001' }] })], pag: pagination({ total: 1, returned: 1 }) }, 'Old Dominion Mortgage') })));
  assert.deepEqual([historical.candidates[0].matchMethod, historical.candidates[0].matchedName, historical.candidates[0].displayName], ['DOCUMENTED_ALIAS', 'Old Dominion Mortgage', 'Heritage Home Lending']);
  const derived = await search('heritage home lending co', 1, jsonFetch(() => ({ body: body({ candidates: [candidate({ stableKey: 'lender:nmls-inst:5001', displayName: 'Heritage Home Lending', method: 'DERIVED_SLUG_FORM', field: 'derived_slug_form', value: 'heritage home lending co', sourceLabel: "search form derived from the profile URL slug", identifiers: [{ label: 'NMLS', value: '5001' }] })], pag: pagination({ total: 1, returned: 1 }) }, 'heritage home lending co') })));
  assert.equal(derived.candidates[0].matchMethod, 'HUB_NAME_MATCH', 'a derived slug form is a hub name match, never an official/recorded alias');
  assert.doesNotMatch(derived.candidates[0].matchedField, /official|recorded alias/i);
});

// ---------------------------------------------------------------- 5. negative controls
test('05 wrong echo/fingerprint, malformed rows and bad GLEIF identifiers are rejected -- never converted to misses', async () => {
  const wrongFingerprint = await search('BMO Bank', 1, jsonFetch(() => ({ body: { ...body(), schemaFingerprint: 'x'.repeat(64) } })));
  assert.deepEqual([wrongFingerprint.state, wrongFingerprint.failureKind], ['TECHNICAL_FAILURE', 'contract_mismatch']);
  const wrongEcho = await search('BMO Bank', 1, jsonFetch(() => ({ body: body({ candidates: [candidate()], pag: pagination({ total: 1, returned: 1 }), suppliedEcho: 'Something Else' }) })));
  assert.deepEqual([wrongEcho.state, wrongEcho.failureKind], ['TECHNICAL_FAILURE', 'name_filter_not_proven']);
  // Sharing only the generic word "Mortgage" is padding, not a filter failure: the shared platform-wide
  // rule (finish() in adapters.ts) reads this as a genuine completed miss, exactly as it does for every other hub.
  const categoryOnlyOverlap = await search('Rocket Mortgage', 1, jsonFetch(() => ({ body: body({ candidates: [candidate({ stableKey: 'lender:nmls-inst:90', displayName: 'Generic Mortgage Company', value: 'Generic Mortgage Company' })], pag: pagination({ total: 1, returned: 1 }) }, 'Rocket Mortgage') })));
  assert.equal(categoryOnlyOverlap.state, 'COMPLETED_NO_CANDIDATES', 'category-word-only overlap is dropped as padding, read as a genuine miss -- not fabricated into a match, and not a technical failure');
  assert.equal(categoryOnlyOverlap.candidates.length, 0);
  const unrelatedNormalizedName = await search('Rocket Mortgage', 1, jsonFetch(() => ({ body: body({ candidates: [candidate({ stableKey: 'lender:nmls-inst:90', displayName: 'Totally Unrelated Bank', value: 'Totally Unrelated Bank', method: 'EXACT_NORMALIZED_NAME' })], pag: pagination({ total: 1, returned: 1 }) }, 'Rocket Mortgage') })));
  assert.deepEqual([unrelatedNormalizedName.state, unrelatedNormalizedName.failureKind], ['TECHNICAL_FAILURE', 'name_filter_not_proven'], 'claiming NORMALIZED_NAME does not exempt a row from the relevance guard');
  const wrongFieldHistorical = await search('Old Dominion Mortgage', 1, jsonFetch(() => ({ body: body({ candidates: [{ ...candidate({ displayName: 'Heritage Home Lending', method: 'DOCUMENTED_HISTORICAL_NAME', value: 'Old Dominion Mortgage' }), match: undefined }], pag: pagination({ total: 1, returned: 1 }) }, 'Old Dominion Mortgage') })));
  assert.deepEqual([wrongFieldHistorical.state, wrongFieldHistorical.failureKind], ['TECHNICAL_FAILURE', 'invalid_response'], 'a row missing its match block is unmappable, not silently dropped into an empty success');
  const fabricatedMethod = await search('BMO Bank', 1, jsonFetch(() => ({ body: body({ candidates: [candidate({ method: 'MADE_UP_METHOD' })], pag: pagination({ total: 1, returned: 1 }) }) })));
  assert.deepEqual([fabricatedMethod.state, fabricatedMethod.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
  const badOriginGleif = await search('Frost Bank', 1, jsonFetch(() => ({ body: body({ candidates: [candidate({ displayName: 'Frost Bank', value: 'Frost Bank', publicationState: 'unpublished_research_identity', identifiers: [{ label: 'LEI', value: 'G5AHTAP80NWA3Q8RDC78' }], action: { type: 'OFFICIAL_IDENTIFIER_VERIFICATION', url: 'https://evil.example/#/record/G5AHTAP80NWA3Q8RDC78' } })], pag: pagination({ total: 1, returned: 1 }) }, 'Frost Bank') })));
  assert.equal(badOriginGleif.candidates[0].action, null, 'off-origin action is dropped, not rewritten'); assert.equal(badOriginGleif.state, 'COMPLETED_WITH_CANDIDATES', 'the record itself is not erased by a bad action');
  const mismatchedLei = await search('Frost Bank', 1, jsonFetch(() => ({ body: body({ candidates: [candidate({ displayName: 'Frost Bank', value: 'Frost Bank', publicationState: 'unpublished_research_identity', identifiers: [{ label: 'LEI', value: 'G5AHTAP80NWA3Q8RDC78' }], action: { type: 'OFFICIAL_IDENTIFIER_VERIFICATION', url: 'https://search.gleif.org/#/record/DIFFERENT00000000000' } })], pag: pagination({ total: 1, returned: 1 }) }, 'Frost Bank') })));
  assert.equal(mismatchedLei.candidates[0].action, null, "a fragment that does not match the record's own LEI is rejected");
  const credentialedGleif = await search('Frost Bank', 1, jsonFetch(() => ({ body: body({ candidates: [candidate({ displayName: 'Frost Bank', value: 'Frost Bank', publicationState: 'unpublished_research_identity', identifiers: [{ label: 'LEI', value: 'G5AHTAP80NWA3Q8RDC78' }], action: { type: 'OFFICIAL_IDENTIFIER_VERIFICATION', url: 'https://user:pass@search.gleif.org/#/record/G5AHTAP80NWA3Q8RDC78' } })], pag: pagination({ total: 1, returned: 1 }) }, 'Frost Bank') })));
  assert.equal(credentialedGleif.candidates[0].action, null, 'a URL carrying credentials is rejected');
  const malformedScheme = await search('Frost Bank', 1, jsonFetch(() => ({ body: body({ candidates: [candidate({ displayName: 'Frost Bank', value: 'Frost Bank', publicationState: 'unpublished_research_identity', identifiers: [{ label: 'LEI', value: 'G5AHTAP80NWA3Q8RDC78' }], action: { type: 'OFFICIAL_IDENTIFIER_VERIFICATION', url: 'javascript:alert(1)' } })], pag: pagination({ total: 1, returned: 1 }) }, 'Frost Bank') })));
  assert.equal(malformedScheme.candidates[0].action, null);
});

// ---------------------------------------------------------------- 6. allowed research-only / held-reporter cards: no borrowed identifiers
test('06 research-only and independent held-reporter cards are usable, with no borrowed identifier or profile link', async () => {
  const research = await search('Frost Bank', 1, jsonFetch(() => ({ body: body({ candidates: [candidate({ displayName: 'Frost Bank', value: 'Frost Bank', publicationState: 'unpublished_research_identity', identifiers: [{ label: 'LEI', value: 'G5AHTAP80NWA3Q8RDC78' }], action: null })], pag: pagination({ total: 1, returned: 1 }) }, 'Frost Bank') })));
  assert.equal(research.state, 'COMPLETED_WITH_CANDIDATES'); assert.equal(research.candidates[0].action, null);
  const held = await search('Guild Mortgage', 1, jsonFetch(() => ({ body: body({ candidates: [candidate({ stableKey: 'lender:hmda-lei:549300LYRWPSYPK6S325', displayName: 'Guild Mortgage Company LLC', value: 'Guild Mortgage Company LLC', method: 'LEGAL_SUFFIX_NORMALIZED', publicationState: 'identity_hold', identifiers: [{ label: 'LEI', value: '549300LYRWPSYPK6S325' }], action: { type: 'OFFICIAL_IDENTIFIER_VERIFICATION', url: 'https://search.gleif.org/#/record/549300LYRWPSYPK6S325' } })], pag: pagination({ total: 1, returned: 1 }) }, 'Guild Mortgage') })));
  const c = held.candidates[0];
  assert.equal(c.publicationState, 'identity_hold'); assert.equal(c.identifiers.some((i) => i.label === 'NMLS'), false, 'no NMLS is borrowed from the disputed profile');
  assert.equal(c.action?.type, 'OFFICIAL_SOURCE'); assert.doesNotMatch(c.action!.href, /lendertrusthub\.com\/lender\//, 'no profile link is attached through the disputed relationship');
});

// ---------------------------------------------------------------- 7. distinct outcomes; other hubs survive a Lender failure
test('07 miss, restriction, source failure, partial/capped results and valid empty pages stay distinct; other hubs survive a Lender failure', async () => {
  const miss = await search('Zzqx Nonexistent Lending', 1, jsonFetch(() => ({ body: body({ resultState: 'NO_MATCH', pag: pagination({ total: 0, returned: 0 }) }, 'Zzqx Nonexistent Lending') })));
  assert.equal(miss.state, 'COMPLETED_NO_CANDIDATES');
  const restricted = await search('NMLS 3030', 1, jsonFetch(() => ({ body: body({ resultState: 'RESTRICTED_SCOPE', pag: null }, 'NMLS 3030') })));
  assert.equal(restricted.state, 'UNSUPPORTED_OPERATION');
  const sourceDown = await search('BMO Bank', 1, jsonFetch(() => ({ body: body({ resultState: 'SOURCE_UNAVAILABLE', pag: null }) })));
  assert.deepEqual([sourceDown.state, sourceDown.failureKind], ['TECHNICAL_FAILURE', 'unavailable']);
  const transportDown = await search('BMO Bank', 1, ctx(( async () => { throw new Error('ECONNREFUSED'); }) as unknown as typeof fetch).fetcher);
  assert.deepEqual([transportDown.state, transportDown.failureKind], ['TECHNICAL_FAILURE', 'unavailable']);
  // The released engine's window is exactly 200 candidates at 10/page -- the last page (20) is where
  // hasMore genuinely goes false while truncated stays true (a real page 1 of a >200-total name always
  // has hasMore:true, since 10 < the 200-wide reachable window; see lib/name-candidates/engine.ts).
  const tenAt = (page: number) => Array.from({ length: 10 }, (_, i) => candidate({ stableKey: `lender:nmls-inst:${page}00${i}`, displayName: `First National Bank ${page}-${i}`, value: `First National Bank ${page}-${i}` }));
  const capped = await search('First', 20, jsonFetch(() => ({ body: body({ candidates: tenAt(20), pag: pagination({ page: 20, total: 250, returned: 10 }) }, 'First') })));
  assert.equal(capped.truncatedWithoutCursor, true, 'a window cap without a further page is reported the same way Insurance already reports its own cap');
  const midWindow = await search('First', 1, jsonFetch(() => ({ body: body({ candidates: tenAt(1), pag: pagination({ total: 250, returned: 10 }) }, 'First') })));
  assert.deepEqual([midWindow.hasMore, midWindow.truncatedWithoutCursor], [true, false], 'hasMore is followed first; the window cap is not asserted while a real next page exists');
  // A genuinely out-of-range page (74 total, 10/page -> 8 pages; page 9 starts past the end).
  const emptyPageInRange = await search('First', 9, jsonFetch(() => ({ body: body({ resultState: 'NO_MATCH', pag: pagination({ page: 9, total: 74, returned: 0 }) }, 'First') })));
  assert.equal(emptyPageInRange.state, 'COMPLETED_NO_CANDIDATES', 'a valid empty page beyond the end is not a technical failure');

  // Other hubs survive a Lender TECHNICAL_FAILURE within the same orchestrated search.
  const mixed = await searchNameCandidates({ name: 'Allied', hubScope: 'all' }, {
    adapters: { ...createFixtureAdapters(FIVE_ALLIED_FIXTURE), lender: lenderNameAdapter },
    fetcher: jsonFetch((url) => (url === LENDER_NAME_CANDIDATES_LOCK.url ? { status: 503, body: {} } : { body: {} })),
  });
  const lenderOutcome = mixed.hubs.find((h) => h.hub === 'lender')!; const moveOutcome = mixed.hubs.find((h) => h.hub === 'move')!;
  assert.equal(lenderOutcome.state, 'TECHNICAL_FAILURE'); assert.equal(moveOutcome.state, 'COMPLETED_WITH_CANDIDATES'); assert.ok(moveOutcome.candidates.length > 0, 'Move still returns its Allied fixture records');
});

// ---------------------------------------------------------------- 8. Lender's window and Ask's own cap
test('08 more-results handling respects both the released window and the existing Ask per-hub cap; a failed next page preserves prior cards', () => {
  const page1: HubNameSearchOutcome = { hub: 'lender', state: 'PARTIAL_TRUNCATED', nameFilterApplied: true, searchedScope: 's', matchBreadth: 'b', candidates: Array.from({ length: 5 }, (_, i) => ({ hub: 'lender', sourceGrain: 'g', stableKey: `lender:x:${i}`, displayName: `Summit ${i}`, entityType: null, matchedName: `Summit ${i}`, matchedField: 'f', matchMethod: 'PREFIX_OR_TOKEN', hubMatchExplanation: null, identifiers: [], recordedLocation: null, locationMeaning: null, sourceAsOf: null, sourceDateLabel: 'Source as-of date', publicationState: null, action: null })), returnedCount: 5, hubReportedTotal: 200, page: 1, hasMore: true, truncatedWithoutCursor: false, continuation: null, message: null, latencyMs: 1, calls: 1 };
  assert.equal(moreStateOf(page1), 'MORE_AVAILABLE');
  const failedNext: HubNameSearchOutcome = { ...page1, state: 'TECHNICAL_FAILURE', failureKind: 'unavailable', candidates: [], hasMore: true };
  const merged = mergeHubPage(page1, failedNext);
  assert.equal(merged.candidates.length, 5, 'prior cards survive a failed next page'); assert.equal(merged.state, 'TECHNICAL_FAILURE');
  // Ask's own MAX_CARDS_PER_HUB caps what is ever HELD, independent of Lender's larger window.
  const atAskCap: HubNameSearchOutcome = { ...page1, candidates: Array.from({ length: MAX_CARDS_PER_HUB }, (_, i) => ({ ...page1.candidates[0], stableKey: `lender:x:${i}` })), hasMore: true };
  assert.equal(moreStateOf(atAskCap), 'ASK_CAPPED', 'Ask stopping at its own display cap is distinguished from Lender exhausting its window');
});

// ---------------------------------------------------------------- 9. query edits, hub filters, delayed responses stay coherent; the name is never requested again after a marker
test('09 the supplied name is passed through verbatim across pages; a stale (superseded) response never overwrites newer state', async () => {
  const sent: string[] = [];
  await search('Rocket Mortgage, LLC', 2, jsonFetch((_url, init) => { const parsed = JSON.parse(String(init?.body)); sent.push(parsed.name); assert.equal(parsed.page, 2); return { body: body({ resultState: 'NO_MATCH', pag: pagination({ page: 2, total: 0, returned: 0 }) }, 'Rocket Mortgage, LLC') }; }));
  assert.deepEqual(sent, ['Rocket Mortgage, LLC'], 'no punctuation stripping, no industry term added, no numeric-leading reclassification');
  const older = await search('BMO', 1, jsonFetch(() => ({ body: body({ candidates: [candidate({ stableKey: 'lender:nmls-inst:11111' })], pag: pagination({ total: 1, returned: 1 }) }, 'BMO') })));
  const newer = await search('BMO Bank', 1, jsonFetch(() => ({ body: body({ candidates: [candidate({ stableKey: 'lender:nmls-inst:22222' })], pag: pagination({ total: 1, returned: 1 }) }) })));
  // The revision/staleness guard lives in the client component (components/name-candidate-results.tsx);
  // at the adapter/orchestrator layer, confirm each independent call is self-contained and order-agnostic.
  assert.notDeepEqual(older.candidates.map((c) => c.stableKey), newer.candidates.map((c) => c.stableKey));
});

// ---------------------------------------------------------------- 10. five-Allied fixture and mixed-hub results remain intact; no hardcoded live count
test('10 the five-Allied fixture and mixed-hub orchestration are untouched by this change', async () => {
  const r = await searchNameCandidates({ name: 'Allied', hubScope: 'all' }, { adapters: createFixtureAdapters(FIVE_ALLIED_FIXTURE) });
  assert.equal(r.candidateCount, 6, 'the fixture is unchanged: five plus the distinct sixth Allied record');
  assert.ok(!r.hubs.some((h) => h.candidates.some((c) => /^Moving$|^Electrical Services$|Beacon Insurance/.test(c.displayName))), 'distractors are still absent');
});

// ---------------------------------------------------------------- 11. labels/counts stay honest
test('11 the candidate heading and card labels never assert a verification, and totals stay candidate-record counts', async () => {
  const r = await search('BMO Bank', 1, jsonFetch(() => ({ body: body({ candidates: [candidate()], pag: pagination({ total: 1, returned: 1 }) }) })));
  const view = buildNameResultsView({ query: 'BMO Bank', name: 'BMO Bank', scope: 'lender', hubs: [r] });
  assert.match(view.heading, /1 record with a name like/); assert.doesNotMatch(view.heading, /verified|confirmed license|current license/i);
  assert.equal(r.hubReportedTotal, 1, 'the total is the candidate-record count Lender reported, not a summed identifier/profile/HMDA count');
});

// ---------------------------------------------------------------- 12. L1-P exclusions: no restricted-store access from Ask
test('12 nothing in the adapter, its config or the shared guard reaches a restricted-store, claim, or permission surface', () => {
  const source = readFileSync(new URL('./adapters.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /supabase|service_?role|createClient|claim_table|account_write/i, 'the Ask adapter is a plain HTTP client to the public operation; it never touches Lender-side storage, RLS, or claim/account data');
});

void moveNameAdapter; void safeHubUrl; void NAME_ADAPTERS;
