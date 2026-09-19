/**
 * TH-SEARCH-R1-019D Astra review 2 (CHANGES_REQUESTED on 7a63e00503d48fcd24ed8eab7dfc0ba6a8c2138c):
 * the released catalog's stable-key namespace is nmls-inst: / gleif-lei: / fdic-cert: (published
 * profiles, copying record.stable_key verbatim) plus hmda-lei: (a standalone HMDA research row,
 * synthesized in catalog.ts). The prior guard (Astra review 1) only recognized nmls-inst/lei/hmda-lei
 * -- an unconfirmed "lei:" guess instead of the real "gleif-lei:", and no fdic-cert: at all -- so it
 * rejected already-approved public-profile records. This is a SOURCE-CONTRACT test (every discovered
 * eligible namespace family plus negative controls), not a company-name exception list.
 *
 * Both live examples were independently reproduced against the real endpoint on 2026-09-19 before any
 * code change. Red-before/green-after: adapters.ts was swapped back to the exact reviewed head, this
 * file was run (fails), then the fixed file was restored byte-for-byte and re-run (passes) -- see
 * docs/qa/th-search-r1-019d/astra-review2-red-before.txt / astra-review2-green-after.txt.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { lenderNameAdapter } from './adapters.ts';

const jsonFetch = (handler: (url: string, init?: RequestInit) => { status?: number; body: unknown }): typeof fetch =>
  (async (url: string | URL, init?: RequestInit) => {
    const { status = 200, body } = handler(String(url), init);
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
const ctx = (fetcher: typeof fetch) => ({ fetcher, signal: new AbortController().signal });
const search = (n: string, page: number, fetcher: typeof fetch) => lenderNameAdapter.search(n, page, ctx(fetcher));

const V1 = { contract: 'lender-name-candidates-v1', contractVersion: '1.0.0', schemaFingerprint: '09e9764c94ec410bfb6426c890ab85c527004af61bbd958d27767842f3489a4b' };
const name = (supplied: string) => ({ supplied, normalized: supplied.toLowerCase(), predicateApplied: true });
const WINDOW = 200;
const pagination = (over: Partial<{ page: number; limit: number; total: number; returned: number }> = {}) => {
  const page = over.page ?? 1; const limit = over.limit ?? 10; const total = over.total ?? 0;
  const reachable = Math.min(total, WINDOW); const pageCount = Math.max(1, Math.ceil(reachable / limit));
  const start = (page - 1) * limit;
  return { page, limit, returned: over.returned ?? 0, total, reachable, hasMore: reachable > 0 && start + limit < reachable, truncated: total > reachable, outOfRange: reachable > 0 && start >= reachable, pageCount, window: WINDOW };
};
type CandOverrides = Partial<{ stableKey: string; displayName: string; entityType: string | null; method: string; field: string; value: string; sourceLabel: string; explanation: string | null; identifiers: Array<{ label: string; value: string }>; publicationState: string; action: { type: string; url: string } | null }>;
const candidate = (over: CandOverrides = {}) => ({
  stableKey: over.stableKey ?? 'lender:nmls-inst:401052', displayName: over.displayName ?? 'BMO Bank', entityType: over.entityType ?? 'Nonbank mortgage company',
  match: { method: over.method ?? 'EXACT_NORMALIZED_NAME', field: over.field ?? 'canonical_name', value: over.value ?? (over.displayName ?? 'BMO Bank'), sourceLabel: over.sourceLabel ?? 'published profile canonical name', explanation: over.explanation ?? 'The entered name equals this source name.', isDocumentedSourceName: true },
  identifiers: over.identifiers ?? [{ label: 'NMLS', value: '401052' }], publicationState: over.publicationState ?? 'public_profile',
  action: over.action === undefined ? { type: 'PROFILE', url: 'https://www.lendertrusthub.com/lender/bmo-bank' } : over.action,
  source: { reference: 'fixture', clock: { label: 'Source as-of date', value: null } },
});
const body = (over: Partial<{ resultState: string; candidates: unknown[]; pag: ReturnType<typeof pagination> | null; continuation: unknown; suppliedEcho: string }> = {}, suppliedName = 'BMO Bank') => ({
  ...V1, resultState: over.resultState ?? 'CANDIDATES', name: over.suppliedEcho ? name(over.suppliedEcho) : name(suppliedName), scope: {}, source: {},
  candidates: over.candidates ?? [], pagination: over.pag === null ? null : (over.pag ?? pagination()), continuation: over.continuation ?? null, limitations: [],
});

// ---------------------------------------------------------------- table-driven source-key family matrix
type KeyCase = { label: string; stableKey: string; expectAdmitted: boolean; publicationState?: string };
const KEY_FAMILY_MATRIX: KeyCase[] = [
  // Positive: every namespace family actually discovered in the released source.
  { label: 'nmls-inst -- published profile keyed by NMLS institution id (BMO Bank, confirmed live)', stableKey: 'lender:nmls-inst:401052', expectAdmitted: true },
  { label: 'gleif-lei -- published profile keyed by LEI, no NMLS (Select Portfolio Servicing, confirmed live)', stableKey: 'lender:gleif-lei:254900AF53CA0NLFZW89', expectAdmitted: true },
  { label: 'fdic-cert -- published profile keyed by FDIC certificate id (First State Bank, confirmed live)', stableKey: 'lender:fdic-cert:15663', expectAdmitted: true },
  { label: 'hmda-lei -- standalone HMDA research row, no profile (confirmed live)', stableKey: 'lender:hmda-lei:549300C1ICNCM0V37Y02', expectAdmitted: true, publicationState: 'unpublished_research_identity' },
  // Negative: excluded projections (institution-only publication gate) and unknown/malformed keys.
  { label: 'nmls-branch -- branch record, excluded upstream by the institution-only gate', stableKey: 'lender:nmls-branch:401052', expectAdmitted: false },
  { label: 'nmls-person -- person/MLO record, excluded upstream', stableKey: 'lender:nmls-person:401052', expectAdmitted: false },
  { label: 'nmls-mlo -- another person-shaped alias, never a supported namespace', stableKey: 'lender:nmls-mlo:401052', expectAdmitted: false },
  { label: 'unknown family entirely', stableKey: 'lender:secret-internal:401052', expectAdmitted: false },
  { label: 'nmls-inst with a non-digit suffix', stableKey: 'lender:nmls-inst:ABCDEF', expectAdmitted: false },
  { label: 'nmls-inst with a suffix below the contract minimum (1 digit)', stableKey: 'lender:nmls-inst:4', expectAdmitted: false },
  { label: 'gleif-lei with a too-short suffix', stableKey: 'lender:gleif-lei:SHORT', expectAdmitted: false },
  { label: 'hmda-lei with a lowercase (non-canonical) LEI', stableKey: 'lender:hmda-lei:254900af53ca0nlfzw89', expectAdmitted: false },
  { label: 'fdic-cert with a non-numeric suffix', stableKey: 'lender:fdic-cert:ABCDE', expectAdmitted: false },
  { label: 'missing the lender: prefix entirely', stableKey: 'nmls-inst:401052', expectAdmitted: false },
  { label: 'empty suffix', stableKey: 'lender:nmls-inst:', expectAdmitted: false },
];

test('key-family matrix. every discovered eligible namespace family is admitted; excluded projections and malformed keys are dropped, never accepted as any lender: string', async () => {
  for (const c of KEY_FAMILY_MATRIX) {
    const displayName = 'Family Test Institution';
    const r = await search(displayName, 1, jsonFetch(() => ({ body: body({
      candidates: [candidate({ stableKey: c.stableKey, displayName, value: displayName, publicationState: c.publicationState, action: null })],
      pag: pagination({ total: 1, returned: 1 }),
    }, displayName) })));
    const admitted = r.candidates.some((cand) => cand.stableKey === c.stableKey);
    assert.equal(admitted, c.expectAdmitted, c.label);
    if (!c.expectAdmitted) {
      // A rejected row is dropped, never silently invented into some OTHER accepted key.
      assert.equal(r.candidates.length, 0, `${c.label}: no substitute record is manufactured`);
    }
  }
});

// ---------------------------------------------------------------- full-adapter reproduction: "First State Bank" (live, 2026-09-19T16:41:53Z)
test('live reproduction: First State Bank -- three fdic-cert public profiles and two hmda-lei research rows all survive together', async () => {
  const liveShapedCandidates = [
    candidate({ stableKey: 'lender:fdic-cert:15663', displayName: 'First State Bank', value: 'First State Bank', method: 'EXACT_NORMALIZED_NAME', field: 'canonical_name', action: { type: 'PROFILE', url: 'https://www.lendertrusthub.com/lender/first-state-bank' } }),
    candidate({ stableKey: 'lender:fdic-cert:12836', displayName: 'First State Bank of Porter', value: 'First State Bank of Porter', method: 'WORD_PREFIX', field: 'canonical_name', action: { type: 'PROFILE', url: 'https://www.lendertrusthub.com/lender/first-state-bank-of-porter' } }),
    candidate({ stableKey: 'lender:hmda-lei:549300C1ICNCM0V37Y02', displayName: 'First State Bank of St. Charles, Missouri', value: 'First State Bank of St. Charles, Missouri', method: 'WORD_PREFIX', field: 'hmda_reporter_name', sourceLabel: 'HMDA reporter legal name (GLEIF / curated HMDA identity file)', publicationState: 'unpublished_research_identity', identifiers: [{ label: 'LEI', value: '549300C1ICNCM0V37Y02' }], action: null }),
    candidate({ stableKey: 'lender:fdic-cert:22971', displayName: 'First Secure State Bank', value: 'First Secure State Bank', method: 'DISTINCTIVE_TOKENS', field: 'canonical_name', action: { type: 'PROFILE', url: 'https://www.lendertrusthub.com/lender/first-secure-state-bank' } }),
    candidate({ stableKey: 'lender:hmda-lei:549300F04B6FGYBJY412', displayName: 'First State Community Bank', value: 'First State Community Bank', method: 'DISTINCTIVE_TOKENS', field: 'hmda_reporter_name', sourceLabel: 'HMDA reporter legal name (GLEIF / curated HMDA identity file)', publicationState: 'unpublished_research_identity', identifiers: [{ label: 'LEI', value: '549300F04B6FGYBJY412' }], action: null }),
  ];
  const r = await search('First State Bank', 1, jsonFetch(() => ({ body: body({ candidates: liveShapedCandidates, pag: pagination({ total: 5, returned: 5 }) }, 'First State Bank') })));
  assert.equal(r.state, 'COMPLETED_WITH_CANDIDATES');
  assert.deepEqual(r.candidates.map((c) => c.stableKey), [
    'lender:fdic-cert:15663', 'lender:fdic-cert:12836', 'lender:hmda-lei:549300C1ICNCM0V37Y02', 'lender:fdic-cert:22971', 'lender:hmda-lei:549300F04B6FGYBJY412',
  ], 'the exact target (fdic-cert:15663) and every other real record survive together, distinct HMDA rows included');
  const exactTarget = r.candidates.find((c) => c.stableKey === 'lender:fdic-cert:15663')!;
  assert.equal(exactTarget.matchMethod, 'NORMALIZED_NAME'); assert.equal(exactTarget.action?.type, 'PROFILE');
});

// ---------------------------------------------------------------- full-adapter reproduction: "Select Portfolio Servicing" (live, 2026-09-19T16:44:16Z)
test('live reproduction: Select Portfolio Servicing -- retains its gleif-lei source key, LEI identifier, matched name and profile action', async () => {
  const r = await search('Select Portfolio Servicing', 1, jsonFetch(() => ({ body: body({ candidates: [candidate({
    stableKey: 'lender:gleif-lei:254900AF53CA0NLFZW89', displayName: 'Select Portfolio Servicing, Inc.', value: 'Select Portfolio Servicing, Inc.',
    entityType: 'Nonbank · servicer evidence', method: 'LEGAL_SUFFIX_NORMALIZED', field: 'canonical_name', identifiers: [{ label: 'LEI', value: '254900AF53CA0NLFZW89' }],
    action: { type: 'PROFILE', url: 'https://www.lendertrusthub.com/lender/select-portfolio-servicing' },
  })], pag: pagination({ total: 1, returned: 1 }) }, 'Select Portfolio Servicing') })));
  assert.equal(r.state, 'COMPLETED_WITH_CANDIDATES', 'previously TECHNICAL_FAILURE: rawRowCount=1, mapped=0 (the gleif-lei key was rejected)');
  const c = r.candidates[0];
  assert.equal(c.stableKey, 'lender:gleif-lei:254900AF53CA0NLFZW89', 'the supplied key is preserved exactly, never rewritten onto a different namespace');
  assert.equal(c.matchMethod, 'NORMALIZED_NAME'); assert.equal(c.matchedName, 'Select Portfolio Servicing, Inc.');
  assert.deepEqual(c.identifiers, [{ label: 'LEI', value: '254900AF53CA0NLFZW89' }]);
  assert.deepEqual(c.action, { type: 'PROFILE', href: 'https://www.lendertrusthub.com/lender/select-portfolio-servicing', label: 'Open LenderTrustHub profile' });
});
