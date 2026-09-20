/**
 * TH-SEARCH-R1-019G: Ask consumes the RELEASED Senior name-candidates-v1 operation.
 * Real adapter, real orchestrator; only the Senior HTTP transport is mocked (fixture JSON shaped
 * exactly like the released contract, confirmed live against https://www.seniortrusthub.com on
 * 2026-09-20 -- see docs/qa/th-search-r1-019g/production-fixtures.json). No live network in this gate.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NAME_ADAPTERS, seniorNameAdapter, lenderNameAdapter, moveNameAdapter, insuranceNameAdapter, investorNameAdapter, contractorNameAdapter,
  SENIOR_NAME_CANDIDATES_CONTRACT, SENIOR_NAME_CANDIDATES_LOCK, LENDER_NAME_CANDIDATES_LOCK, NAME_SPECIALIST_LOCKS,
} from './adapters.ts';

const jsonFetch = (handler: (url: string, init?: RequestInit) => { status?: number; body: unknown }): typeof fetch =>
  (async (url: string | URL, init?: RequestInit) => {
    const { status = 200, body } = handler(String(url), init);
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
const ctx = (fetcher: typeof fetch) => ({ fetcher, signal: new AbortController().signal });
const search = (n: string, page: number, fetcher: typeof fetch) => seniorNameAdapter.search(n, page, ctx(fetcher));

const V1 = { contract: 'senior-name-candidates-v1', hub: 'senior' };
const name = (supplied: string, predicateApplied = true) => ({ supplied, predicateApplied });
const pagination = (page = 1, hasMore = false) => ({ page, hasMore });
type CandOverride = Partial<{ providerClass: string; displayName: string; ccn: string; recordedLocation: Record<string, unknown> | null; locationMeaning: string | null; publicationState: string; action: { type: string; href: string; label: string } | null; whyMatched: string | null }>;
const candidate = (over: CandOverride = {}) => ({
  providerClass: over.providerClass ?? 'nursing_home',
  displayName: over.displayName ?? 'ABBEY DELRAY SOUTH',
  ccn: over.ccn ?? '105411',
  recordedLocation: over.recordedLocation === undefined ? { city: 'DELRAY BEACH', state: 'FL', county: 'Palm Beach' } : over.recordedLocation,
  locationMeaning: over.locationMeaning === undefined ? 'Recorded provider/office location on the current CMS directory record -- not service territory, availability, or a verified service area.' : over.locationMeaning,
  publicationState: over.publicationState ?? 'public_profile',
  action: over.action === undefined ? { type: 'PROFILE', href: 'https://www.seniortrusthub.com/facility/cms/105411/abbey-delray-south', label: 'Open ABBEY DELRAY SOUTH profile' } : over.action,
  whyMatched: over.whyMatched === undefined ? 'ABBEY DELRAY SOUTH is a bounded provider-name match in the current CMS nursing-home directory (CCN 105411).' : over.whyMatched,
});
const successBody = (over: Partial<{ resultState: string; candidates: unknown[]; pag: ReturnType<typeof pagination> | null; suppliedEcho: string; predicateApplied: boolean }> = {}, suppliedName = 'Abbey Delray South') => ({
  ...V1, resultState: over.resultState ?? 'COMPLETED_WITH_CANDIDATES',
  name: name(over.suppliedEcho ?? suppliedName, over.predicateApplied ?? true),
  candidates: over.candidates ?? [], pagination: over.pag === null ? null : (over.pag ?? pagination()),
  limitations: [],
});

// ---------------------------------------------------------------- 1. dispatch: v1 only, POST, contract lock
test('01 Senior name dispatch calls the released v1 endpoint via POST with operation/name/page, never the old free-text senior-ask-v1 API', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  await search('Abbey Delray South', 2, jsonFetch((url, init) => { calls.push({ url, init }); return { body: successBody({ candidates: [candidate()], pag: pagination(2) }) }; }));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, SENIOR_NAME_CANDIDATES_LOCK.url);
  assert.equal(SENIOR_NAME_CANDIDATES_LOCK.url, 'https://www.seniortrusthub.com/api/specialist-execution/name-candidates/v1');
  assert.equal(calls[0].init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { operation: 'provider_name_candidates', name: 'Abbey Delray South', page: 2 });
  assert.equal(SENIOR_NAME_CANDIDATES_CONTRACT, 'senior-name-candidates-v1');
  // The pre-existing v2 locks (Investor/Insurance/Lender, unrelated hubs) are untouched by this change.
  assert.equal(NAME_SPECIALIST_LOCKS.lender.url, 'https://www.lendertrusthub.com/api/specialist-execution/v2');
  assert.equal(LENDER_NAME_CANDIDATES_LOCK.url, 'https://www.lendertrusthub.com/api/specialist-execution/name-candidates/v1');
});

// ---------------------------------------------------------------- 2. real acceptance cases (production-shaped fixtures)
test('02 the six named real providers map with correct class, CCN, recorded location and profile action', async () => {
  const cases: Array<[string, CandOverride]> = [
    ['Abbey Delray South', { providerClass: 'nursing_home', displayName: 'ABBEY DELRAY SOUTH', ccn: '105411', recordedLocation: { city: 'DELRAY BEACH', state: 'FL', county: 'Palm Beach' }, action: { type: 'PROFILE', href: 'https://www.seniortrusthub.com/facility/cms/105411/abbey-delray-south', label: 'x' } }],
    ['Abigail House for Nursing & Rehabilitation', { providerClass: 'nursing_home', displayName: 'ABIGAIL HOUSE FOR NURSING & REHABILITATION', ccn: '315267', recordedLocation: { city: 'CAMDEN', state: 'NJ', county: 'Camden' }, action: { type: 'PROFILE', href: 'https://www.seniortrusthub.com/facility/cms/315267/abigail-house-for-nursing-and-rehabilitation', label: 'x' } }],
    ['A Holly Patterson Extended Care Facility', { providerClass: 'nursing_home', displayName: 'A Holly Patterson Extended Care Facility', ccn: '335023', recordedLocation: { city: 'UNIONDALE', state: 'NY', county: 'Nassau' }, action: { type: 'PROFILE', href: 'https://www.seniortrusthub.com/facility/cms/335023/a-holly-patterson-extended-care-facility', label: 'x' } }],
    ['FFIII Houston SNF Tenant', { providerClass: 'nursing_home', displayName: 'FFIII Houston SNF Tenant LLC', ccn: '676111', recordedLocation: { city: 'HOUSTON', state: 'TX', county: 'Harris' }, action: { type: 'PROFILE', href: 'https://www.seniortrusthub.com/facility/cms/676111/ffiii-houston-snf-tenant-llc', label: 'x' } }],
    ['AMEDISYS HOME HEALTH CARE (AMHERST)', { providerClass: 'home_health', displayName: 'AMEDISYS HOME HEALTH CARE (AMHERST)', ccn: '337248', recordedLocation: { city: 'WILLIAMSVILLE', state: 'NY' }, action: { type: 'PROFILE', href: 'https://www.seniortrusthub.com/home-health/cms/337248/amedisys-home-health-care-amherst', label: 'x' } }],
    ['ADAMS COUNTY MANOR', { providerClass: 'nursing_home', displayName: 'ADAMS COUNTY MANOR', ccn: '366143', recordedLocation: { city: 'WEST UNION', state: 'OH', county: 'Adams' }, action: { type: 'PROFILE', href: 'https://www.seniortrusthub.com/facility/cms/366143/adams-county-manor', label: 'x' } }],
  ];
  for (const [supplied, over] of cases) {
    const r = await search(supplied, 1, jsonFetch(() => ({ body: successBody({ candidates: [candidate(over)] }, supplied) })));
    assert.equal(r.state, 'COMPLETED_WITH_CANDIDATES', supplied);
    const c = r.candidates[0];
    assert.equal(c.stableKey, `senior:${over.providerClass}:${over.ccn}`, supplied);
    assert.equal(c.displayName, over.displayName);
    assert.deepEqual(c.identifiers, [{ label: 'CMS CCN', value: over.ccn }]);
    assert.equal(c.publicationState, 'PUBLIC_PROFILE');
    assert.equal(c.action?.href, over.action!.href);
    assert.equal(c.action?.type, 'PROFILE');
    assert.ok(c.recordedLocation?.includes(String((over.recordedLocation as Record<string, unknown>).state)), supplied);
  }
});

// ---------------------------------------------------------------- 3. genuine miss / unsupported / technical failure (9.7, 9.8, 9.9)
test('03 a genuine provider-name miss, an unsupported category-intent input, and a technical failure are three distinct outcomes', async () => {
  const miss = await search('Zzyzx Nonexistent Care Facility LLC', 1, jsonFetch(() => ({ body: successBody({ resultState: 'COMPLETED_NO_CANDIDATES', candidates: [] }, 'Zzyzx Nonexistent Care Facility LLC') })));
  assert.deepEqual([miss.state, miss.nameFilterApplied, miss.candidates.length], ['COMPLETED_NO_CANDIDATES', true, 0]);

  const unsupported = await search('senior care Florida', 1, jsonFetch(() => ({ status: 422, body: { ...V1, resultState: 'UNSUPPORTED_OPERATION', name: name('senior care Florida', false), message: 'This text was not accepted as a structured provider name by SeniorTrustHub’s current search.' } })));
  assert.deepEqual([unsupported.state, unsupported.nameFilterApplied], ['UNSUPPORTED_OPERATION', false]);
  assert.ok(unsupported.message);

  const failure = await search('Trigger Source Failure Fixture', 1, jsonFetch(() => ({ status: 503, body: { ...V1, resultState: 'TECHNICAL_FAILURE', name: name('Trigger Source Failure Fixture', false), failureKind: 'unavailable', message: 'SeniorTrustHub name search is temporarily unavailable.' } })));
  assert.deepEqual([failure.state, failure.failureKind, failure.nameFilterApplied], ['TECHNICAL_FAILURE', 'unavailable', false]);

  // Transport-level failures (abort/timeout) are TECHNICAL_FAILURE too, never a miss.
  const abortingFetch = (async () => { throw Object.assign(new Error('aborted'), { name: 'AbortError' }); }) as typeof fetch;
  const timeout = await search('Abbey Delray South', 1, abortingFetch);
  assert.deepEqual([timeout.state, timeout.failureKind], ['TECHNICAL_FAILURE', 'timeout']);
});

// ---------------------------------------------------------------- 4. name filter proof (echo + predicateApplied)
test('04 success/miss states are only accepted when predicateApplied is true and the echoed name matches what Ask sent', async () => {
  const noPredicate = await search('Abbey Delray South', 1, jsonFetch(() => ({ body: successBody({ candidates: [candidate()], predicateApplied: false }) })));
  assert.deepEqual([noPredicate.state, noPredicate.failureKind], ['TECHNICAL_FAILURE', 'name_filter_not_proven']);
  const wrongEcho = await search('Abbey Delray South', 1, jsonFetch(() => ({ body: successBody({ candidates: [candidate()], suppliedEcho: 'Something Else' }) })));
  assert.deepEqual([wrongEcho.state, wrongEcho.failureKind], ['TECHNICAL_FAILURE', 'name_filter_not_proven']);
  // An empty-candidates response with a wrong echo isolates the echo check from the platform's generic
  // relevance guard (which only ever runs when rows are actually returned): without the echo check,
  // this would silently read as a completed miss on the wrong (echoed) name.
  const wrongEchoEmptyMiss = await search('Abbey Delray South', 1, jsonFetch(() => ({ body: successBody({ candidates: [], resultState: 'COMPLETED_NO_CANDIDATES', suppliedEcho: 'Something Else' }) })));
  assert.deepEqual([wrongEchoEmptyMiss.state, wrongEchoEmptyMiss.failureKind], ['TECHNICAL_FAILURE', 'name_filter_not_proven']);
  // Ask must not reinterpret care-category text itself: a caller sending "senior care Florida"
  // that gets echoed back verbatim with predicateApplied:true (a hypothetical contract defect)
  // is NOT downgraded by Ask -- the specialist's own predicateApplied bit is the sole authority.
  const echoedCategoryText = await search('senior care Florida', 1, jsonFetch(() => ({ body: successBody({ candidates: [], resultState: 'COMPLETED_NO_CANDIDATES' }, 'senior care Florida') })));
  assert.equal(echoedCategoryText.state, 'COMPLETED_NO_CANDIDATES', 'Ask trusts the specialist’s own predicateApplied bit, never re-derives category-intent itself');
});

// ---------------------------------------------------------------- 5. malformed payload rejection (never coerced to a miss)
test('05 contract/hub mismatch, non-array candidates, and a status/resultState mismatch are TECHNICAL_FAILURE, never a completed miss', async () => {
  const wrongContract = await search('Abbey Delray South', 1, jsonFetch(() => ({ body: { ...successBody(), contract: 'senior-ask-v1' } })));
  assert.deepEqual([wrongContract.state, wrongContract.failureKind], ['TECHNICAL_FAILURE', 'contract_mismatch']);
  const wrongHub = await search('Abbey Delray South', 1, jsonFetch(() => ({ body: { ...successBody(), hub: 'lender' } })));
  assert.deepEqual([wrongHub.state, wrongHub.failureKind], ['TECHNICAL_FAILURE', 'contract_mismatch']);
  const notArray = await search('Abbey Delray South', 1, jsonFetch(() => ({ body: { ...successBody(), candidates: { not: 'an array' } } })));
  assert.deepEqual([notArray.state, notArray.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
  const nullCandidates = await search('Abbey Delray South', 1, jsonFetch(() => ({ body: { ...successBody(), candidates: null } })));
  assert.deepEqual([nullCandidates.state, nullCandidates.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
  // Status 200 body claiming UNSUPPORTED_OPERATION (should be 422 per the released route) -- a
  // drifted/mocked transport, not a real specialist answer.
  const statusMismatch1 = await search('Abbey Delray South', 1, jsonFetch(() => ({ status: 200, body: { ...V1, resultState: 'UNSUPPORTED_OPERATION', name: name('Abbey Delray South', false), message: 'x' } })));
  assert.deepEqual([statusMismatch1.state, statusMismatch1.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
  // Status 200 body claiming TECHNICAL_FAILURE (should be 503).
  const statusMismatch2 = await search('Abbey Delray South', 1, jsonFetch(() => ({ status: 200, body: { ...V1, resultState: 'TECHNICAL_FAILURE', name: name('Abbey Delray South', false), failureKind: 'unavailable' } })));
  assert.deepEqual([statusMismatch2.state, statusMismatch2.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
  // The route's own request-validation error shape (no resultState at all) is also TECHNICAL_FAILURE.
  const invalidRequestShape = await search('Abbey Delray South', 1, jsonFetch(() => ({ status: 400, body: { contract: 'senior-name-candidates-v1', hub: 'senior', status: 'invalid_request', errorCode: 'invalid_name', message: 'name must be 2-180 characters.' } })));
  assert.deepEqual([invalidRequestShape.state, invalidRequestShape.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
  // A COMPLETED_NO_CANDIDATES body that also supplies rows is contradictory, never silently admitted.
  const contradictoryMiss = await search('Abbey Delray South', 1, jsonFetch(() => ({ body: successBody({ resultState: 'COMPLETED_NO_CANDIDATES', candidates: [candidate()] }) })));
  assert.deepEqual([contradictoryMiss.state, contradictoryMiss.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
});

// ---------------------------------------------------------------- 6. candidate-row structural validation / class allowlist
test('06 a malformed row, an unrecognized provider class, and a non-public-profile row are dropped -- never invented or admitted', async () => {
  const missingCcnRow: Record<string, unknown> = candidate(); delete missingCcnRow.ccn;
  const missingCcn = await search('Abbey Delray South', 1, jsonFetch(() => ({ body: successBody({ candidates: [missingCcnRow] }) })));
  assert.deepEqual([missingCcn.state, missingCcn.failureKind], ['TECHNICAL_FAILURE', 'invalid_response'], 'rows returned but none mappable is a malformed payload, never a miss');
  const badCcnSyntax = await search('Abbey Delray South', 1, jsonFetch(() => ({ body: successBody({ candidates: [candidate({ ccn: '12345' })] }) })));
  assert.deepEqual([badCcnSyntax.state, badCcnSyntax.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
  // TH-SEARCH-R1-019E built its whole fix around care-category words never overriding a real name,
  // and never inventing a class -- Ask mirrors that: an unrecognized/invented class is dropped.
  const badClass = await search('Abbey Delray South', 1, jsonFetch(() => ({ body: successBody({ candidates: [candidate({ providerClass: 'assisted_living' })] }) })));
  assert.deepEqual([badClass.state, badClass.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
  const notPublicProfile = await search('Abbey Delray South', 1, jsonFetch(() => ({ body: successBody({ candidates: [candidate({ publicationState: 'unpublished' })] }) })));
  assert.deepEqual([notPublicProfile.state, notPublicProfile.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
  const missingLocationMeaning = await search('Abbey Delray South', 1, jsonFetch(() => ({ body: successBody({ candidates: [candidate({ locationMeaning: null })] }) })));
  assert.deepEqual([missingLocationMeaning.state, missingLocationMeaning.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
});

// ---------------------------------------------------------------- 7. class preservation across the three CMS classes (no cross-class denominator)
test('07 nursing home, home health and hospice candidates each keep their own source-recorded class -- never merged', async () => {
  const r = await search('Test', 1, jsonFetch(() => ({ body: successBody({ candidates: [
    candidate({ providerClass: 'nursing_home', displayName: 'Test Nursing', ccn: '100001', action: { type: 'PROFILE', href: 'https://www.seniortrusthub.com/facility/cms/100001/test-nursing', label: 'x' } }),
    candidate({ providerClass: 'home_health', displayName: 'Test Home Health', ccn: '100002', action: { type: 'PROFILE', href: 'https://www.seniortrusthub.com/home-health/cms/100002/test-home-health', label: 'x' } }),
    candidate({ providerClass: 'hospice', displayName: 'Test Hospice', ccn: '100003', action: { type: 'PROFILE', href: 'https://www.seniortrusthub.com/hospice/cms/100003/test-hospice', label: 'x' } }),
  ] }, 'Test') })));
  assert.equal(r.candidates.length, 3);
  assert.deepEqual(r.candidates.map((c) => c.stableKey).sort(), ['senior:home_health:100002', 'senior:hospice:100003', 'senior:nursing_home:100001']);
  assert.deepEqual(new Set(r.candidates.map((c) => c.entityType)), new Set(['Nursing Home', 'Home Health', 'Hospice']));
});

// ---------------------------------------------------------------- 8. action validation: origin, PROFILE type, CCN-in-URL agreement; no manufactured URL
test('08 an off-origin, non-PROFILE, or CCN-mismatched action is dropped -- Ask never constructs its own Senior URL', async () => {
  const offOrigin = await search('Abbey Delray South', 1, jsonFetch(() => ({ body: successBody({ candidates: [candidate({ action: { type: 'PROFILE', href: 'https://evil.example.com/facility/cms/105411/abbey-delray-south', label: 'x' } })] }) })));
  assert.equal(offOrigin.candidates[0].action, null, 'off-origin action is dropped, not rewritten onto Senior’s own origin');
  const wrongType = await search('Abbey Delray South', 1, jsonFetch(() => ({ body: successBody({ candidates: [candidate({ action: { type: 'RESEARCH', href: 'https://www.seniortrusthub.com/facility/cms/105411/abbey-delray-south', label: 'x' } })] }) })));
  assert.equal(wrongType.candidates[0].action, null, 'a non-PROFILE action type is not admitted as a profile link');
  const ccnMismatch = await search('Abbey Delray South', 1, jsonFetch(() => ({ body: successBody({ candidates: [candidate({ ccn: '105411', action: { type: 'PROFILE', href: 'https://www.seniortrusthub.com/facility/cms/999999/somebody-else', label: 'x' } })] }) })));
  assert.equal(ccnMismatch.candidates[0].action, null, 'a URL exposing a DIFFERENT CCN than the record’s own is dropped, never trusted');
  // No action supplied at all: the candidate is still admitted (action is optional in the common contract).
  const noAction = await search('Abbey Delray South', 1, jsonFetch(() => ({ body: successBody({ candidates: [candidate({ action: null })] }) })));
  assert.equal(noAction.state, 'COMPLETED_WITH_CANDIDATES');
  assert.equal(noAction.candidates[0].action, null);
  assert.equal(noAction.candidates[0].identifiers[0].value, '105411', 'identity is preserved even without a usable action');
});

// ---------------------------------------------------------------- 9. pagination: page-mismatch rejection, PARTIAL_TRUNCATED/hasMore consistency
test('09 a page mismatch is rejected, and PARTIAL_TRUNCATED is only accepted together with hasMore', async () => {
  const pageMismatch = await search('Abbey Delray South', 2, jsonFetch(() => ({ body: successBody({ candidates: [candidate()], pag: pagination(1) }) })));
  assert.deepEqual([pageMismatch.state, pageMismatch.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
  const truncatedNoMore = await search('Abbey Delray South', 1, jsonFetch(() => ({ body: successBody({ resultState: 'PARTIAL_TRUNCATED', candidates: [candidate()], pag: pagination(1, false) }) })));
  assert.deepEqual([truncatedNoMore.state, truncatedNoMore.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
  const truncatedOk = await search('Abbey Delray South', 1, jsonFetch(() => ({ body: successBody({ resultState: 'PARTIAL_TRUNCATED', candidates: [candidate()], pag: pagination(1, true) }) })));
  assert.deepEqual([truncatedOk.state, truncatedOk.hasMore], ['PARTIAL_TRUNCATED', true]);
  const continuationPage = await search('Abbey Delray South', 3, jsonFetch(() => ({ body: successBody({ candidates: [candidate()], pag: pagination(3) }, 'Abbey Delray South') })));
  assert.equal(continuationPage.page, 3, 'the same supplied name is continued at the incremented specialist page');
  const missingPagination = await search('Abbey Delray South', 1, jsonFetch(() => ({ body: { ...successBody({ candidates: [candidate()] }), pagination: null } })));
  assert.deepEqual([missingPagination.state, missingPagination.failureKind], ['TECHNICAL_FAILURE', 'invalid_response']);
});

// ---------------------------------------------------------------- 10. old free-text adapter is never invoked for NAME_CANDIDATES; other hubs unaffected
test('10 the old senior-ask-v1 free-text engine is never called by NAME_CANDIDATES; Lender/Move/Insurance/Investor/Contractor are unaffected', async () => {
  const calledUrls: string[] = [];
  await search('Abbey Delray South', 1, jsonFetch((url) => { calledUrls.push(url); return { body: successBody({ candidates: [candidate()] }) }; }));
  assert.ok(calledUrls.every((u) => u.startsWith('https://www.seniortrusthub.com/api/specialist-execution/name-candidates/v1')));
  assert.ok(calledUrls.every((u) => !u.includes('/api/ask')), 'the free-text senior-ask-v1 endpoint is never dispatched to for a name-candidate search');
  assert.equal(NAME_ADAPTERS.senior, seniorNameAdapter);
  // Sibling hubs' own locks/behavior are byte-identical to before this ticket.
  assert.equal(NAME_ADAPTERS.lender, lenderNameAdapter);
  assert.equal(NAME_ADAPTERS.move, moveNameAdapter);
  assert.equal(NAME_ADAPTERS.insurance, insuranceNameAdapter);
  assert.equal(NAME_ADAPTERS.investor, investorNameAdapter);
  assert.equal(NAME_ADAPTERS.contractor, contractorNameAdapter);
  assert.equal(contractorNameAdapter.enabled, false, 'Contractor remains in its current (blocked) state -- untouched by this ticket');
});
