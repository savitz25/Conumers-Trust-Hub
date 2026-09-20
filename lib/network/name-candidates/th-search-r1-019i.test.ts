/**
 * TH-SEARCH-R1-019I: Ask consumes the RELEASED Insurance name-candidates-v1 operation.
 * Real adapter, real orchestrator wiring; only the Insurance HTTP transport is mocked (fixture JSON
 * shaped exactly like the released contract -- confirmed LIVE against
 * https://www.insurancetrusthub.com/api/specialist-execution/name-candidates/v1 on 2026-09-20 for
 * allied/beacon/summit/V FINANCIAL LLC/CITIZENS PROP INS CORP/ocean harbor/a genuine fake org/an
 * out-of-range page/an INVALID_REQUEST). No live network in this gate.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NAME_ADAPTERS, insuranceNameAdapter, lenderNameAdapter, moveNameAdapter, seniorNameAdapter, investorNameAdapter, contractorNameAdapter,
  INSURANCE_NAME_CANDIDATES_CONTRACT, INSURANCE_NAME_CANDIDATES_LOCK, NAME_SPECIALIST_LOCKS, NAME_SPECIALIST_CONTRACT,
} from './adapters.ts';

const jsonFetch = (handler: (url: string, init?: RequestInit) => { status?: number; body: unknown }): typeof fetch =>
  (async (url: string | URL, init?: RequestInit) => {
    const { status = 200, body } = handler(String(url), init);
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
const ctx = (fetcher: typeof fetch) => ({ fetcher, signal: new AbortController().signal });
const search = (n: string, page: number, fetcher: typeof fetch) => insuranceNameAdapter.search(n, page, ctx(fetcher));

const V1 = { contract: 'insurance-name-candidates-v1', contractVersion: '1.0.0', schemaFingerprint: 'c272675bdde4adab8d6672be7fb3143319ada5ec5e61dcf72dc7cda295b0d62f', hub: 'insurance', operation: 'name_candidates' };
const name = (supplied: string | null, predicateApplied = true) => ({ supplied, normalized: supplied?.toLowerCase() ?? null, distinctiveTokens: [], predicateApplied, predicate: 'x' });
type Pag = Partial<{ page: number; limit: number; returned: number; hasMore: boolean; nextPage: number | null; outOfRange: boolean; matchedCount: number | null; matchedCountIsExact: boolean; completeness: string; suppressedByPublicationPolicy: number }>;
const pagination = (over: Pag = {}) => {
  const page = over.page ?? 1;
  const hasMore = over.hasMore ?? false;
  return {
    page, limit: over.limit ?? 10, returned: over.returned ?? 0, hasMore,
    nextPage: over.nextPage === undefined ? (hasMore ? page + 1 : null) : over.nextPage,
    outOfRange: over.outOfRange ?? false,
    matchedCount: over.matchedCount === undefined ? (over.returned ?? 0) : over.matchedCount,
    matchedCountIsExact: over.matchedCountIsExact ?? true,
    completeness: over.completeness ?? 'COMPLETE',
    suppressedByPublicationPolicy: over.suppressedByPublicationPolicy ?? 0,
  };
};
type CandOver = Partial<{ stableKey: string; entityClass: string; displayName: string; npn: string | null; naicCode: string | null; method: string; field: string; value: string; publicationState: string; action: { type: string; url: string } | null; profileUrl: string | null; selectionUrl: string | null; whyMatched: string | null }>;
const candidate = (over: CandOver = {}, forName = 'allied') => {
  const entityClass = over.entityClass ?? 'agency';
  const id = '269dbfd0-e1f7-4474-9a5e-b3aebe936908';
  const stableKey = over.stableKey ?? `insurance:${entityClass}:${id}`;
  const displayName = over.displayName ?? '3A ALLIED INSURANCE CORP.';
  const suffix = stableKey.split(':').slice(2).join(':');
  const selUrl = `/ask?q=${encodeURIComponent(`Find ${forName}`)}&selected=${suffix}`;
  return {
    stableKey, entityClass, displayName,
    npn: over.npn === undefined ? '10058617' : over.npn,
    naicCode: over.naicCode === undefined ? null : over.naicCode,
    match: { field: over.field ?? 'display_name', value: over.value ?? displayName, method: over.method ?? 'distinctive_token_candidate' },
    publicationState: over.publicationState ?? 'RESEARCH_ROW_ONLY',
    action: over.action === undefined ? { type: 'RESEARCH', url: selUrl } : over.action,
    profileUrl: over.profileUrl === undefined ? null : over.profileUrl,
    selectionUrl: over.selectionUrl === undefined ? selUrl : over.selectionUrl,
    whyMatched: over.whyMatched === undefined ? `Name candidate: requested "${forName}" matches source display_name "${displayName}" (distinctive_token_candidate).` : over.whyMatched,
  };
};
const profileCandidate = (over: CandOver = {}) => candidate({
  entityClass: 'legal_insurer', stableKey: 'insurance:legal_insurer:27d7418a-d2bf-4339-8c3b-4774e7f403bc',
  displayName: 'CITIZENS PROP INS CORP', npn: null, naicCode: '10064',
  field: 'canonical_legal_name', method: 'normalized_exact_name',
  publicationState: 'PUBLIC_PROFILE',
  action: { type: 'PROFILE', url: 'https://www.insurancetrusthub.com/insurers/citizens-property-insurance-corporation' },
  profileUrl: '/insurers/citizens-property-insurance-corporation',
  selectionUrl: '/ask?q=Find+CITIZENS+PROP+INS+CORP&selected=27d7418a-d2bf-4339-8c3b-4774e7f403bc',
  whyMatched: 'Name candidate: requested "CITIZENS PROP INS CORP" matches source canonical_legal_name "CITIZENS PROP INS CORP" (normalized_exact_name).',
  ...over,
});
const successBody = (over: Partial<{ resultState: string; candidates: unknown[]; pag: ReturnType<typeof pagination> | null; suppliedEcho: string | null; predicateApplied: boolean; message: string | null }> = {}, suppliedName = 'allied') => ({
  ...V1, resultState: over.resultState ?? 'CANDIDATES',
  name: name(over.suppliedEcho === undefined ? suppliedName : over.suppliedEcho, over.predicateApplied ?? true),
  scope: {}, candidates: over.candidates ?? [], pagination: over.pag === null ? null : (over.pag ?? pagination()),
  limitations: [], message: over.message ?? null,
});

// ---------------------------------------------------------------- 1. dedicated contract lock
test('01 Insurance NAME_CANDIDATES dispatches to the dedicated v1 lock via POST, never the shared v2 lock', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  await search('allied', 1, jsonFetch((url, init) => { calls.push({ url, init }); return { body: successBody({ candidates: [candidate()], pag: pagination({ returned: 1, matchedCount: 1 }) }) }; }));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, INSURANCE_NAME_CANDIDATES_LOCK.url);
  assert.equal(INSURANCE_NAME_CANDIDATES_LOCK.url, 'https://www.insurancetrusthub.com/api/specialist-execution/name-candidates/v1');
  assert.equal(calls[0].init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { contract: 'insurance-name-candidates-v1', operation: 'name_candidates', name: 'allied', page: 1, limit: 10 });
  assert.equal(INSURANCE_NAME_CANDIDATES_CONTRACT, 'insurance-name-candidates-v1');
  assert.equal(INSURANCE_NAME_CANDIDATES_LOCK.version, '1.0.0');
  assert.equal(INSURANCE_NAME_CANDIDATES_LOCK.schemaFingerprint, 'c272675bdde4adab8d6672be7fb3143319ada5ec5e61dcf72dc7cda295b0d62f');
  // The pre-existing v2 lock (identifiers/cohorts/evidence, unrelated to name-candidates) is untouched.
  assert.deepEqual(NAME_SPECIALIST_LOCKS.insurance, { url: 'https://www.insurancetrusthub.com/api/specialist-execution/v2', version: '2.0.0', schemaFingerprint: '4aa93bb372aebb45c7028b750000e77be4a847d9a210f3c40d3db1df1f7f637f' });
  assert.equal(NAME_SPECIALIST_CONTRACT, 'trusthub-specialist-execution-v2');
});

// ---------------------------------------------------------------- 2. version/fingerprint validation
test('02 a contract/version/fingerprint/hub/operation mismatch is TECHNICAL_FAILURE contract_mismatch', async () => {
  const wrongContract = await search('allied', 1, jsonFetch(() => ({ body: { ...successBody({ candidates: [candidate()] }), contract: 'insurance-name-candidates-v2' } })));
  assert.deepEqual([wrongContract.state, wrongContract.failureKind], ['TECHNICAL_FAILURE', 'contract_mismatch']);
  const wrongVersion = await search('allied', 1, jsonFetch(() => ({ body: { ...successBody({ candidates: [candidate()] }), contractVersion: '1.1.0' } })));
  assert.deepEqual([wrongVersion.state, wrongVersion.failureKind], ['TECHNICAL_FAILURE', 'contract_mismatch']);
  const wrongFingerprint = await search('allied', 1, jsonFetch(() => ({ body: { ...successBody({ candidates: [candidate()] }), schemaFingerprint: 'deadbeef' } })));
  assert.deepEqual([wrongFingerprint.state, wrongFingerprint.failureKind], ['TECHNICAL_FAILURE', 'contract_mismatch']);
  const wrongHub = await search('allied', 1, jsonFetch(() => ({ body: { ...successBody({ candidates: [candidate()] }), hub: 'lender' } })));
  assert.deepEqual([wrongHub.state, wrongHub.failureKind], ['TECHNICAL_FAILURE', 'contract_mismatch']);
  const wrongOperation = await search('allied', 1, jsonFetch(() => ({ body: { ...successBody({ candidates: [candidate()] }), operation: 'identity' } })));
  assert.deepEqual([wrongOperation.state, wrongOperation.failureKind], ['TECHNICAL_FAILURE', 'contract_mismatch']);
});

// ---------------------------------------------------------------- 3. name echo/predicate proof
test('03 CANDIDATES/NO_MATCH/PARTIAL_REFINE_REQUIRED are only accepted when predicateApplied is true and the echo matches what Ask sent', async () => {
  const noPredicate = await search('allied', 1, jsonFetch(() => ({ body: successBody({ candidates: [candidate()], predicateApplied: false }) })));
  assert.deepEqual([noPredicate.state, noPredicate.failureKind], ['TECHNICAL_FAILURE', 'name_filter_not_proven']);
  const wrongEcho = await search('allied', 1, jsonFetch(() => ({ body: successBody({ candidates: [candidate()], suppliedEcho: 'beacon' }) })));
  assert.deepEqual([wrongEcho.state, wrongEcho.failureKind], ['TECHNICAL_FAILURE', 'name_filter_not_proven']);
  // Isolate the echo check from the generic relevance guard, which only runs when rows exist.
  const wrongEchoEmptyMiss = await search('allied', 1, jsonFetch(() => ({ body: successBody({ resultState: 'NO_MATCH', candidates: [], suppliedEcho: 'beacon', pag: pagination({ matchedCount: 0 }) }) })));
  assert.deepEqual([wrongEchoEmptyMiss.state, wrongEchoEmptyMiss.failureKind], ['TECHNICAL_FAILURE', 'name_filter_not_proven']);
});

// ---------------------------------------------------------------- 4. CANDIDATES state (real allied fixture)
test('04 a real CANDIDATES page maps candidates with exact matchedCount and real hasMore continuation', async () => {
  const rows = Array.from({ length: 10 }, (_, i) => candidate({ stableKey: `insurance:agency:row-${i}`, displayName: `ALLIED ROW ${i}` }));
  const r = await search('allied', 1, jsonFetch(() => ({ body: successBody({ candidates: rows, pag: pagination({ returned: 10, hasMore: true, matchedCount: 46 }) }) })));
  assert.equal(r.candidates.length, 10);
  assert.equal(r.hubReportedTotal, 46);
  assert.equal(r.hasMore, true);
  assert.equal(r.page, 1);
  assert.equal(r.nameFilterApplied, true);
});

// ---------------------------------------------------------------- 5. completed NO_MATCH
test('05 NO_MATCH is only a completed miss when COMPLETE/exact-zero/no-rows/no-more-pages all hold', async () => {
  const genuineMiss = await search('Zzyxqvortnabble Fictitious Underwriters', 1, jsonFetch(() => ({ body: successBody({ resultState: 'NO_MATCH', candidates: [], pag: pagination({ matchedCount: 0, matchedCountIsExact: true, completeness: 'COMPLETE', hasMore: false }) }, 'Zzyxqvortnabble Fictitious Underwriters') })));
  assert.deepEqual([genuineMiss.state, genuineMiss.nameFilterApplied, genuineMiss.candidates.length, genuineMiss.hubReportedTotal], ['COMPLETED_NO_CANDIDATES', true, 0, 0]);

  // Contradictory: NO_MATCH but hasMore true -- never silently admitted as a completed miss.
  const contradictoryHasMore = await search('x', 1, jsonFetch(() => ({ body: successBody({ resultState: 'NO_MATCH', candidates: [], pag: pagination({ matchedCount: 0, matchedCountIsExact: true, hasMore: true }) }, 'x') })));
  assert.deepEqual([contradictoryHasMore.state, contradictoryHasMore.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
  // Contradictory: NO_MATCH but SCAN_BOUND_REACHED (not exact) -- never a completed miss.
  const contradictoryScanBound = await search('x', 1, jsonFetch(() => ({ body: successBody({ resultState: 'NO_MATCH', candidates: [], pag: pagination({ matchedCount: null, matchedCountIsExact: false, completeness: 'SCAN_BOUND_REACHED', hasMore: true }) }, 'x') })));
  assert.deepEqual([contradictoryScanBound.state, contradictoryScanBound.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
  // Contradictory: NO_MATCH claims no rows but supplies one.
  const contradictoryRows = await search('x', 1, jsonFetch(() => ({ body: successBody({ resultState: 'NO_MATCH', candidates: [candidate({}, 'x')], pag: pagination({ returned: 1, matchedCount: 1 }) }, 'x') })));
  assert.deepEqual([contradictoryRows.state, contradictoryRows.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
});

// ---------------------------------------------------------------- 6. PARTIAL_REFINE_REQUIRED != miss
test('06 PARTIAL_REFINE_REQUIRED is incomplete coverage, never a miss, even with zero rows on this page', async () => {
  // Real V FINANCIAL LLC shape: SCAN_BOUND_REACHED, matchedCount null, hasMore true -- candidates preserved.
  const rows = [candidate({ displayName: 'V FINANCIAL LLC', value: 'V FINANCIAL LLC', method: 'normalized_exact_name', field: 'legal_name' }, 'V FINANCIAL LLC')];
  const partial = await search('V FINANCIAL LLC', 1, jsonFetch(() => ({ body: successBody({ resultState: 'PARTIAL_REFINE_REQUIRED', candidates: rows, pag: pagination({ returned: 1, hasMore: true, matchedCount: null, matchedCountIsExact: false, completeness: 'SCAN_BOUND_REACHED' }) }, 'V FINANCIAL LLC') })));
  assert.equal(partial.state, 'PARTIAL_TRUNCATED');
  assert.equal(partial.candidates.length, 1);
  assert.equal(partial.hubReportedTotal, null, 'never a manufactured total under SCAN_BOUND_REACHED');
  assert.equal(partial.truncatedWithoutCursor, true);

  // Scan bound reached AND this page's own hasMore is false: the scanned stream ended, but that is not
  // proof every possible match was found -- still PARTIAL_TRUNCATED, with a refine disclosure, never a miss.
  const exhausted = await search('V FINANCIAL LLC', 3, jsonFetch(() => ({ body: successBody({ resultState: 'PARTIAL_REFINE_REQUIRED', candidates: [], pag: pagination({ page: 3, returned: 0, hasMore: false, matchedCount: null, matchedCountIsExact: false, completeness: 'SCAN_BOUND_REACHED' }) }, 'V FINANCIAL LLC') })));
  assert.equal(exhausted.state, 'PARTIAL_TRUNCATED');
  assert.equal(exhausted.candidates.length, 0);
  assert.equal(exhausted.truncatedWithoutCursor, true);
  assert.ok(exhausted.message?.toLowerCase().includes('refine'));
  assert.equal(exhausted.continuation?.type, 'RESEARCH');
});

// ---------------------------------------------------------------- 7. out-of-range page != miss
test('07 an out-of-range page with matchedCount > 0 is never COMPLETED_NO_CANDIDATES and never silently substitutes page 1', async () => {
  const r = await search('allied', 10, jsonFetch(() => ({ body: successBody({ resultState: 'CANDIDATES', candidates: [], pag: pagination({ page: 10, returned: 0, hasMore: false, outOfRange: true, matchedCount: 46 }) }) })));
  assert.notEqual(r.state, 'COMPLETED_NO_CANDIDATES');
  assert.equal(r.state, 'PARTIAL_TRUNCATED');
  assert.equal(r.page, 10, 'the requested page is preserved -- Ask never silently substitutes page 1');
  assert.equal(r.hubReportedTotal, 46);
  assert.ok(r.message?.includes('not a no-match'));
  assert.equal(r.continuation?.type, 'RESEARCH');
});

// ---------------------------------------------------------------- 8. exact matchedCount only when exact
test('08 hubReportedTotal is set only when matchedCountIsExact is true, and is never manufactured otherwise', async () => {
  const beaconRow = candidate({ displayName: 'BEACON INSURANCE GROUP', value: 'BEACON INSURANCE GROUP' }, 'beacon');
  const exact = await search('beacon', 1, jsonFetch(() => ({ body: successBody({ candidates: [beaconRow], pag: pagination({ returned: 1, matchedCount: 46, matchedCountIsExact: true }) }, 'beacon') })));
  assert.equal(exact.hubReportedTotal, 46);
  const summitRow = candidate({ displayName: 'SUMMIT FINANCIAL GROUP', value: 'SUMMIT FINANCIAL GROUP' }, 'summit financial');
  const notExact = await search('summit financial', 1, jsonFetch(() => ({ body: successBody({ resultState: 'PARTIAL_REFINE_REQUIRED', candidates: [summitRow], pag: pagination({ returned: 1, hasMore: true, matchedCount: null, matchedCountIsExact: false, completeness: 'SCAN_BOUND_REACHED' }) }, 'summit financial') })));
  assert.equal(notExact.hubReportedTotal, null);
  // A contradictory payload -- claims exact but supplies null -- fails structural pagination validation
  // (this is caught before mapping/relevance filtering, so the row content is irrelevant here).
  const contradiction = await search('x', 1, jsonFetch(() => ({ body: successBody({ candidates: [candidate({}, 'x')], pag: pagination({ returned: 1, matchedCount: null, matchedCountIsExact: true }) }, 'x') })));
  assert.deepEqual([contradiction.state, contradiction.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
});

// ---------------------------------------------------------------- 9. real page continuation
test('09 successive pages request the incremented page and return distinct real-window candidates', async () => {
  const calls: unknown[] = [];
  const page2Row = candidate({ stableKey: 'insurance:agency:984b589d-df8d-477c-a948-eeb8c69f566d', displayName: 'ALLIED SECOND PAGE ROW' });
  await search('allied', 2, jsonFetch((_url, init) => {
    calls.push(JSON.parse(String(init?.body)));
    return { body: successBody({ candidates: [page2Row], pag: pagination({ page: 2, returned: 1, hasMore: true, matchedCount: 46 }) }) };
  }));
  assert.deepEqual((calls[0] as Record<string, unknown>).page, 2);
  const r2 = await search('allied', 2, jsonFetch(() => ({ body: successBody({ candidates: [page2Row], pag: pagination({ page: 2, returned: 1, hasMore: true, matchedCount: 46 }) }) })));
  assert.equal(r2.page, 2);
  assert.equal(r2.candidates[0].stableKey, 'insurance:agency:984b589d-df8d-477c-a948-eeb8c69f566d');
  // A page-number mismatch between requested and reported page is rejected, never silently accepted.
  const pageMismatch = await search('allied', 2, jsonFetch(() => ({ body: successBody({ candidates: [candidate()], pag: pagination({ page: 1, returned: 1, matchedCount: 1 }) }) })));
  assert.deepEqual([pageMismatch.state, pageMismatch.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
});

// ---------------------------------------------------------------- 10. publication-suppressed short page still hasMore
test('10 a publication-suppressed short page (returned < limit) with hasMore=true is never read as end-of-stream', async () => {
  const rows = Array.from({ length: 6 }, (_, i) => candidate({ stableKey: `insurance:agency:supp-${i}`, displayName: `ALLIED ROW ${i}`, value: `ALLIED ROW ${i}` }));
  const r = await search('allied', 1, jsonFetch(() => ({ body: successBody({ candidates: rows, pag: pagination({ returned: 6, hasMore: true, matchedCount: 46, suppressedByPublicationPolicy: 4 }) }) })));
  assert.equal(r.candidates.length, 6);
  assert.equal(r.hasMore, true, 'returned < limit must not be inferred as final page when the source withheld rows for publication policy');
  assert.equal(r.state, 'PARTIAL_TRUNCATED');
  // A negative suppressedByPublicationPolicy is a malformed pagination payload.
  const negative = await search('allied', 1, jsonFetch(() => ({ body: successBody({ candidates: [candidate()], pag: pagination({ returned: 1, matchedCount: 1, suppressedByPublicationPolicy: -1 }) }) })));
  assert.deepEqual([negative.state, negative.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
});

// ---------------------------------------------------------------- 11. stableKey preserved verbatim
test('11 the specialist\'s stableKey is preserved verbatim -- never reconstructed from NPN or NAIC', async () => {
  const r = await search('CITIZENS PROP INS CORP', 1, jsonFetch(() => ({ body: successBody({ candidates: [profileCandidate()], pag: pagination({ returned: 1, matchedCount: 1 }) }, 'CITIZENS PROP INS CORP') })));
  assert.equal(r.candidates[0].stableKey, 'insurance:legal_insurer:27d7418a-d2bf-4339-8c3b-4774e7f403bc');
  // A stableKey whose namespace disagrees with the row's own entityClass is a structural defect.
  const mismatch = await search('CITIZENS PROP INS CORP', 1, jsonFetch(() => ({ body: successBody({ candidates: [profileCandidate({ stableKey: 'insurance:agency:27d7418a-d2bf-4339-8c3b-4774e7f403bc' })] }, 'CITIZENS PROP INS CORP') })));
  assert.deepEqual([mismatch.state, mismatch.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
});

// ---------------------------------------------------------------- 12. person/producer rejected
test('12 an entityClass outside {agency, legal_insurer} (e.g. a person/producer row) fails the whole response, never silently dropped', async () => {
  const producerRow = await search('allied', 1, jsonFetch(() => ({ body: successBody({ candidates: [candidate({ entityClass: 'producer', stableKey: 'insurance:producer:some-id' }), candidate()] }) })));
  assert.deepEqual([producerRow.state, producerRow.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
  const personRow = await search('allied', 1, jsonFetch(() => ({ body: successBody({ candidates: [candidate({ entityClass: 'person', stableKey: 'insurance:person:some-id' })] }) })));
  assert.deepEqual([personRow.state, personRow.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
});

// ---------------------------------------------------------------- 13. strict match-method vocabulary
test('13 only normalized_exact_name and distinctive_token_candidate are accepted; an unknown method fails the row (no HUB_NAME_MATCH fallback)', async () => {
  const known = await search('CITIZENS PROP INS CORP', 1, jsonFetch(() => ({ body: successBody({ candidates: [profileCandidate()], pag: pagination({ returned: 1, matchedCount: 1 }) }, 'CITIZENS PROP INS CORP') })));
  assert.equal(known.candidates[0].matchMethod, 'NORMALIZED_NAME');
  const knownPrefix = await search('allied', 1, jsonFetch(() => ({ body: successBody({ candidates: [candidate()], pag: pagination({ returned: 1, matchedCount: 1 }) }) })));
  assert.equal(knownPrefix.candidates[0].matchMethod, 'PREFIX_OR_TOKEN');
  const unknownMethod = await search('allied', 1, jsonFetch(() => ({ body: successBody({ candidates: [candidate({ method: 'fuzzy' }), candidate({ stableKey: 'insurance:agency:other-id' })], pag: pagination({ returned: 2, matchedCount: 2 }) }) })));
  assert.deepEqual([unknownMethod.state, unknownMethod.failureKind], ['TECHNICAL_FAILURE', 'invalid_response'], 'an unrecognized method must never silently fall back to HUB_NAME_MATCH');
});

// ---------------------------------------------------------------- 14. profile action integrity
test('14 a PROFILE action requires PUBLIC_PROFILE, InsuranceTrustHub\'s canonical origin, and profileUrl correspondence', async () => {
  const pag1 = pagination({ returned: 1, matchedCount: 1 });
  const ok = await search('CITIZENS PROP INS CORP', 1, jsonFetch(() => ({ body: successBody({ candidates: [profileCandidate()], pag: pag1 }, 'CITIZENS PROP INS CORP') })));
  assert.deepEqual(ok.candidates[0].action, { type: 'PROFILE', href: 'https://www.insurancetrusthub.com/insurers/citizens-property-insurance-corporation', label: 'Open InsuranceTrustHub profile' });
  const offOrigin = await search('CITIZENS PROP INS CORP', 1, jsonFetch(() => ({ body: successBody({ candidates: [profileCandidate({ action: { type: 'PROFILE', url: 'https://evil.example.com/insurers/citizens' } })], pag: pag1 }, 'CITIZENS PROP INS CORP') })));
  assert.equal(offOrigin.candidates[0].action, null);
  const wrongType = await search('CITIZENS PROP INS CORP', 1, jsonFetch(() => ({ body: successBody({ candidates: [profileCandidate({ action: { type: 'RESEARCH', url: 'https://www.insurancetrusthub.com/insurers/citizens-property-insurance-corporation' } })], pag: pag1 }, 'CITIZENS PROP INS CORP') })));
  assert.equal(wrongType.candidates[0].action, null, 'a research-typed action on a PUBLIC_PROFILE row is never borrowed as a profile link');
  const profileUrlMismatch = await search('CITIZENS PROP INS CORP', 1, jsonFetch(() => ({ body: successBody({ candidates: [profileCandidate({ profileUrl: '/insurers/some-other-insurer' })], pag: pag1 }, 'CITIZENS PROP INS CORP') })));
  assert.equal(profileUrlMismatch.candidates[0].action, null, 'profileUrl disagreeing with the action URL degrades the action to null, never trusted');
  // A research row (RESEARCH_ROW_ONLY) must never receive a manufactured public profile action.
  const researchRowNoProfile = await search('allied', 1, jsonFetch(() => ({ body: successBody({ candidates: [candidate({ action: { type: 'PROFILE', url: 'https://www.insurancetrusthub.com/insurers/fake' } })], pag: pagination({ returned: 1, matchedCount: 1 }) }) })));
  assert.equal(researchRowNoProfile.candidates[0].action, null, 'a RESEARCH_ROW_ONLY row is never given a PROFILE action even if the payload tries to supply one');
});

// ---------------------------------------------------------------- 15. research action identity revalidation
test('15 a RESEARCH action requires RESEARCH_ROW_ONLY, InsuranceTrustHub origin, name-scoping, and identity agreement with the candidate\'s own stableKey', async () => {
  const pag1 = pagination({ returned: 1, matchedCount: 1 });
  const ok = await search('allied', 1, jsonFetch(() => ({ body: successBody({ candidates: [candidate()], pag: pag1 }) })));
  assert.equal(ok.candidates[0].action?.type, 'RESEARCH');
  assert.ok(ok.candidates[0].action?.href.includes('selected=269dbfd0-e1f7-4474-9a5e-b3aebe936908'));
  const offOrigin = await search('allied', 1, jsonFetch(() => ({ body: successBody({ candidates: [candidate({ action: { type: 'RESEARCH', url: 'https://evil.example.com/ask?q=Find+allied&selected=269dbfd0-e1f7-4474-9a5e-b3aebe936908' } })], pag: pag1 }) })));
  assert.equal(offOrigin.candidates[0].action, null);
  const wrongName = await search('allied', 1, jsonFetch(() => ({ body: successBody({ candidates: [candidate({ action: { type: 'RESEARCH', url: '/ask?q=Find+beacon&selected=269dbfd0-e1f7-4474-9a5e-b3aebe936908' } })], pag: pag1 }) })));
  assert.equal(wrongName.candidates[0].action, null, 'a research URL not scoped to the searched name is dropped');
  // The `selected` param must agree with THIS row's own stable identity -- never another candidate's.
  const wrongSelected = await search('allied', 1, jsonFetch(() => ({ body: successBody({ candidates: [candidate({ action: { type: 'RESEARCH', url: '/ask?q=Find+allied&selected=some-other-agency-id' } })], pag: pag1 }) })));
  assert.equal(wrongSelected.candidates[0].action, null, 'a selected identity that does not correspond to this candidate\'s own stableKey is dropped');
  const selectionUrlMismatch = await search('allied', 1, jsonFetch(() => ({ body: successBody({ candidates: [candidate({ selectionUrl: '/ask?q=Find+allied&selected=some-other-id' })], pag: pag1 }) })));
  assert.equal(selectionUrlMismatch.candidates[0].action, null, 'selectionUrl disagreeing with the action URL degrades the action to null');
});

// ---------------------------------------------------------------- 16. malformed candidate array fails whole response
test('16 a single malformed element inside an otherwise-valid candidate array fails the WHOLE response, never silently dropped', async () => {
  const primitive = await search('allied', 1, jsonFetch(() => ({ body: successBody({ candidates: [candidate(), 'not-an-object'] }) })));
  assert.deepEqual([primitive.state, primitive.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
  const incomplete = await search('allied', 1, jsonFetch(() => ({ body: successBody({ candidates: [candidate(), { entityClass: 'agency' }] }) })));
  assert.deepEqual([incomplete.state, incomplete.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
  const notArray = await search('allied', 1, jsonFetch(() => ({ body: { ...successBody(), candidates: { not: 'an array' } } })));
  assert.deepEqual([notArray.state, notArray.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
  const nullCandidates = await search('allied', 1, jsonFetch(() => ({ body: { ...successBody(), candidates: null } })));
  assert.deepEqual([nullCandidates.state, nullCandidates.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
});

// ---------------------------------------------------------------- 17. source failure != miss
test('17 SOURCE_UNAVAILABLE is TECHNICAL_FAILURE, never a miss', async () => {
  const r = await search('allied', 1, jsonFetch(() => ({ status: 503, body: { ...V1, resultState: 'SOURCE_UNAVAILABLE', name: name(null, false), scope: {}, candidates: [], pagination: null, limitations: [], message: 'InsuranceTrustHub is temporarily unavailable.' } })));
  assert.deepEqual([r.state, r.failureKind, r.nameFilterApplied], ['TECHNICAL_FAILURE', 'unavailable', false]);
  assert.notEqual(r.state, 'COMPLETED_NO_CANDIDATES');
  // Status/state mismatch (200 claiming SOURCE_UNAVAILABLE, should be 503) is also TECHNICAL_FAILURE.
  const statusMismatch = await search('allied', 1, jsonFetch(() => ({ status: 200, body: { ...V1, resultState: 'SOURCE_UNAVAILABLE', name: name(null, false), scope: {}, candidates: [], pagination: null, limitations: [] } })));
  assert.deepEqual([statusMismatch.state, statusMismatch.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
});

// ---------------------------------------------------------------- 18. timeout != miss
test('18 TIMEOUT (upstream 504) and a transport-level abort are both TECHNICAL_FAILURE/timeout, never a miss', async () => {
  const r = await search('allied', 1, jsonFetch(() => ({ status: 504, body: { ...V1, resultState: 'TIMEOUT', name: name(null, false), scope: {}, candidates: [], pagination: null, limitations: [] } })));
  assert.deepEqual([r.state, r.failureKind], ['TECHNICAL_FAILURE', 'timeout']);
  assert.notEqual(r.state, 'COMPLETED_NO_CANDIDATES');
  const abortingFetch = (async () => { throw Object.assign(new Error('aborted'), { name: 'AbortError' }); }) as typeof fetch;
  const transportTimeout = await search('allied', 1, abortingFetch);
  assert.deepEqual([transportTimeout.state, transportTimeout.failureKind], ['TECHNICAL_FAILURE', 'timeout']);
  // INVALID_REQUEST for Ask's own well-formed request is an adapter/contract disagreement, never a miss.
  const invalidRequest = await search('allied', 1, jsonFetch(() => ({ status: 400, body: { ...V1, resultState: 'INVALID_REQUEST', name: name(null, false), scope: {}, candidates: [], pagination: null, limitations: [], error: { code: 'x', message: 'x' } } })));
  assert.deepEqual([invalidRequest.state, invalidRequest.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
  assert.notEqual(invalidRequest.state, 'COMPLETED_NO_CANDIDATES');
  // UNSUPPORTED_OPERATION and RESTRICTED_SCOPE are also never a miss.
  const unsupported = await search('allied', 1, jsonFetch(() => ({ status: 422, body: { ...V1, resultState: 'UNSUPPORTED_OPERATION', name: name(null, false), scope: {}, candidates: [], pagination: null, limitations: [], message: 'x' } })));
  assert.equal(unsupported.state, 'UNSUPPORTED_OPERATION');
  const restricted = await search('allied', 1, jsonFetch(() => ({ status: 422, body: { ...V1, resultState: 'RESTRICTED_SCOPE', name: name(null, false), scope: {}, candidates: [], pagination: null, limitations: [], message: 'x' } })));
  assert.equal(restricted.state, 'POLICY_RESTRICTED');
});

// ---------------------------------------------------------------- 19. legacy v2 is NOT invoked for NAME_CANDIDATES
test('19 the legacy trusthub-specialist-execution-v2 Insurance identity endpoint is never called for NAME_CANDIDATES', async () => {
  const calledUrls: string[] = [];
  await search('allied', 1, jsonFetch((url) => { calledUrls.push(url); return { body: successBody({ candidates: [candidate()] }) }; }));
  assert.ok(calledUrls.every((u) => u === INSURANCE_NAME_CANDIDATES_LOCK.url));
  assert.ok(calledUrls.every((u) => !u.endsWith('/api/specialist-execution/v2')), 'the old v2 identity endpoint is never dispatched to for a name-candidate search');
  assert.equal(NAME_ADAPTERS.insurance, insuranceNameAdapter);
});

// ---------------------------------------------------------------- 20. Move/Lender/Senior/Investor/Contractor unchanged
test('20 sibling hub adapters/locks are byte-identical to before this ticket; Contractor remains disabled', async () => {
  assert.equal(NAME_ADAPTERS.move, moveNameAdapter);
  assert.equal(NAME_ADAPTERS.lender, lenderNameAdapter);
  assert.equal(NAME_ADAPTERS.senior, seniorNameAdapter);
  assert.equal(NAME_ADAPTERS.investor, investorNameAdapter);
  assert.equal(NAME_ADAPTERS.contractor, contractorNameAdapter);
  assert.equal(contractorNameAdapter.enabled, false);
  assert.deepEqual(NAME_SPECIALIST_LOCKS.lender, { url: 'https://www.lendertrusthub.com/api/specialist-execution/v2', version: '2.1.0', schemaFingerprint: '0da572d08450e68f4f01a4f4b28e2e813503f50b1a84546a29d7eb817db205dd' });
  assert.deepEqual(NAME_SPECIALIST_LOCKS.investor, { url: 'https://www.investortrusthub.com/api/specialist-execution/v2', version: '2.0.0', schemaFingerprint: 'a92b72c4a30de1021ecf25d26decb852b52394f741ac26919b89d14a234ab384' });
});

// ---------------------------------------------------------------- 21. real acceptance shapes: legal-insurer profile + agency research rows coexist correctly
test('21 CITIZENS PROP INS CORP and ocean harbor map as PUBLIC_PROFILE legal insurers with exact matchedCount 1; a person/producer-shaped row never appears', async () => {
  const r = await search('CITIZENS PROP INS CORP', 1, jsonFetch(() => ({ body: successBody({ candidates: [profileCandidate()], pag: pagination({ returned: 1, matchedCount: 1 }) }, 'CITIZENS PROP INS CORP') })));
  assert.equal(r.state, 'COMPLETED_WITH_CANDIDATES');
  assert.equal(r.candidates.length, 1);
  assert.equal(r.candidates[0].entityType, 'Legal insurer');
  assert.equal(r.candidates[0].publicationState, 'PUBLIC_PROFILE');
  assert.equal(r.candidates[0].recordedLocation, null, 'the v1 candidate contract does not publish a location; Ask never carries over the old v2 credential-jurisdiction field');
  assert.equal(r.candidates[0].sourceAsOf, null, 'the v1 candidate contract does not publish a source clock; Ask never invents an observation date');
  assert.equal(r.hubReportedTotal, 1);
});
