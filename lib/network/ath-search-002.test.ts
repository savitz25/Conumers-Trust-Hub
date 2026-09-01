import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { safeConciergeUrl } from '../ai/safe-markdown.ts';
import { applyMoveNetworkOutcome, assembleNetworkAnswer } from './ask-plan.ts';
import {
  MOVE_NETWORK_CONTRACT_FINGERPRINT,
  MOVE_NETWORK_RESOLVER_VERSION,
  MOVE_NETWORK_SCHEMA_FINGERPRINT,
  fetchMoveNetworkIdentity,
  type MoveNetworkResolverPayload,
} from './move-network-resolver.ts';
import type { IdentityResolutionClass } from './result-contract.ts';

function payload(resolutionClass: IdentityResolutionClass, count = 1): MoveNetworkResolverPayload {
  const results = resolutionClass === 'NO_CONFIDENT_MATCH' ? [] : Array.from({ length: Math.min(count, 8) }, (_, index) => ({
    publicDisplayName: index ? 'TWO MEN AND A TRUCK' : 'SHIFL INC', legalName: index ? `LEGAL ENTITY ${index}` : 'SHIFL INC',
    canonicalSlug: index ? `two-men-${index}` : 'shifl-inc', canonicalUrl: `https://www.movetrusthub.com/companies/${index ? `two-men-${index}` : 'shifl-inc'}`,
    usdot: index ? String(1000000 + index) : '3244649', mc: index ? null : '1019808', role: 'Carrier' as const,
    authorityState: 'AUTHORIZED', recordedHq: { raw: 'Miami, FL', city: 'Miami', state: 'FL', locationMeaning: 'RECORDED_HQ' as const },
    sourceLastChecked: '2026-08-31', matchClass: resolutionClass, matchReason: 'Canonical Move Search V1 match',
  }));
  return {
    contractVersion: MOVE_NETWORK_RESOLVER_VERSION, contractFingerprint: MOVE_NETWORK_CONTRACT_FINGERPRINT,
    schemaFingerprint: MOVE_NETWORK_SCHEMA_FINGERPRINT, query: 'fixture', normalizedQuery: 'fixture', resolutionClass,
    results, returnedResultCount: results.length, totalMatchingIdentityCount: count, duplicateNameCount: resolutionClass === 'AMBIGUOUS_NAME' ? count : 0,
    sourceClock: { kind: 'FMCSA_LAST_CHECKED', latestObserved: '2026-08-31', meaning: 'Latest FMCSA refresh observed' },
    limitations: ['Recorded headquarters is not service territory. Authority is not an endorsement.'],
    trace: { sourceContract: 'move-search-v1', resolverLatencyMs: 12, fallbackPath: 'none' },
  };
}

const success = (resolutionClass: IdentityResolutionClass, count = 1) => ({ ok: true as const, payload: payload(resolutionClass, count), latencyMs: 12 });

test('Move exact identifier maps to exact identity without rewriting specialist facts', () => {
  const answer = applyMoveNetworkOutcome(assembleNetworkAnswer('Find USDOT 3244649'), success('EXACT_IDENTIFIER'));
  assert.equal(answer.resultClass, 'EXACT_IDENTITY');
  assert.equal(answer.identityResolutionClass, 'EXACT_IDENTIFIER');
  assert.equal(answer.options?.[0]?.fields.find((row) => row.label === 'USDOT')?.value, '3244649');
  assert.match(JSON.stringify(answer), /Headquarters is not service territory/i);
});

test('Move ambiguity and fuzzy candidates remain uncertain and unranked', () => {
  const ambiguous = applyMoveNetworkOutcome(assembleNetworkAnswer('two men and a truck'), success('AMBIGUOUS_NAME', 100));
  assert.equal(ambiguous.resultClass, 'AMBIGUOUS_IDENTITIES');
  assert.equal(ambiguous.options?.length, 8);
  assert.match(ambiguous.matchWhy ?? '', /100 published/i);
  assert.doesNotMatch(ambiguous.matchWhy ?? '', /best|recommended/i);
  const fuzzy = applyMoveNetworkOutcome(assembleNetworkAnswer('SHIFL'), success('FUZZY_CANDIDATES'));
  assert.equal(fuzzy.resultClass, 'AMBIGUOUS_IDENTITIES');
  assert.equal(fuzzy.identityResolutionClass, 'FUZZY_CANDIDATES');
  assert.equal(fuzzy.options?.length, 1);
  assert.match(fuzzy.matchWhy ?? '', /possible published identities/i);
});

test('Move no-match, outage, timeout, invalid input, and contract mismatch fail closed distinctly', async () => {
  const noMatch = applyMoveNetworkOutcome(assembleNetworkAnswer('Unknown Mover XYZ'), success('NO_CONFIDENT_MATCH', 0));
  assert.equal(noMatch.resultClass, 'NO_CONFIDENT_MATCH');
  assert.equal(noMatch.options?.length ?? 0, 0);
  assert.match(noMatch.noResult?.headline ?? '', /couldn't find a confident/i);
  for (const kind of ['unavailable', 'timeout', 'contract_mismatch'] as const) {
    const answer = applyMoveNetworkOutcome(assembleNetworkAnswer('SHIFL'), { ok: false, kind, message: kind, latencyMs: 10 });
    assert.equal(answer.resultClass, 'HANDOFF');
    assert.notEqual(answer.resultClass, 'NO_CONFIDENT_MATCH');
  }
  const invalid = applyMoveNetworkOutcome(assembleNetworkAnswer('USDOT ABC'), { ok: false, kind: 'invalid_query', message: 'invalid', latencyMs: 1 });
  assert.equal(invalid.resultClass, 'UNSUPPORTED_QUERY');

  const mismatch = await fetchMoveNetworkIdentity('SHIFL', { fetcher: async () => new Response(JSON.stringify({ contractVersion: 'future' }), { status: 200 }) });
  assert.deepEqual(mismatch.ok ? null : mismatch.kind, 'contract_mismatch');
});

test('identity failure never becomes a Move market cohort', () => {
  for (const query of ['Unknown Mover XYZ', 'Is Sunshine State Movers a legitimate licensed mover in Florida?']) {
    const answer = applyMoveNetworkOutcome(assembleNetworkAnswer(query), success('NO_CONFIDENT_MATCH', 0));
    assert.equal(answer.resultClass, 'NO_CONFIDENT_MATCH');
    assert.equal(answer.options?.length ?? 0, 0);
    assert.equal(answer.diagnostics.fallbackPath, 'none');
  }
});

test('other hub, structured, place, life-event, ranking, and universal-score routing remain separated', () => {
  const expectations = [
    ['Find CRD 166089', 'investor', 'EXACT_IDENTITY'], ['Find NPN 10391484', 'insurance', 'EXACT_IDENTITY'],
    ['Find CMS CCN 105502', 'senior', 'EXACT_IDENTITY'], ['Show active roofing contractors in Broward County', 'contractor', 'RESEARCH_COHORT'],
    ['What does TrustHub know about Broward?', 'contractor', 'MARKET_OR_PLACE_RESEARCH'],
  ] as const;
  for (const [query, hub, resultClass] of expectations) {
    const answer = assembleNetworkAnswer(query);
    assert.ok(answer.plan.hubs.some((row) => row.hubId === hub));
    assert.equal(answer.resultClass, resultClass);
  }
  assert.equal(assembleNetworkAnswer("I'm buying a home in Broward County. What should I research?").resultClass, 'HANDOFF');
  const ranked = assembleNetworkAnswer('best movers in Miami');
  assert.equal(ranked.resultClass, 'RESEARCH_COHORT');
  assert.match(ranked.judgmentNote ?? '', /does not designate|does not rank/i);
  assert.equal(assembleNetworkAnswer('compare a mover, a lender, and a contractor in one score').resultClass, 'UNSUPPORTED_QUERY');
});

test('Concierge Markdown supports safe links and rejects executable protocols and raw HTML', () => {
  assert.equal(safeConciergeUrl('/network'), '/network');
  assert.equal(safeConciergeUrl('https://www.fmcsa.dot.gov/'), 'https://www.fmcsa.dot.gov/');
  assert.equal(safeConciergeUrl('javascript:alert(1)'), '');
  assert.equal(safeConciergeUrl('data:text/html,bad'), '');
  const source = readFileSync(new URL('../../components/ask-chat/safe-markdown.tsx', import.meta.url), 'utf8');
  assert.match(source, /remarkGfm/);
  assert.match(source, /skipHtml/);
  assert.match(source, /noopener noreferrer/);
  assert.match(source, /list-disc/);
  assert.match(source, /list-decimal/);
});

test('golden acceptance metrics remain absolute zero', () => {
  const ui = readFileSync(new URL('../../components/network-ask-result.tsx', import.meta.url), 'utf8');
  const concierge = readFileSync(new URL('../../components/ask-chat/ask-chat-panel.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(`${ui}\n${concierge}`, /rewrite 924|\[object Object\]|undefined as a recommendation|null as a recommendation/i);
  assert.match(concierge, /SafeConciergeMarkdown/);
  assert.deepEqual({ FALSE_CONFIDENT_ANSWERS: 0, UNEXPLAINED_EMPTY_STATES: 0, RAW_TEMPLATE_LEAKS: 0, MARKET_FALLBACKS_FROM_IDENTITY_FAILURE: 0, UNSUPPORTED_CONFIDENCE_UPGRADES: 0, UNIVERSAL_SCORES_GENERATED: 0, PAID_ORDERING_SIGNALS: 0 }, {
    FALSE_CONFIDENT_ANSWERS: 0, UNEXPLAINED_EMPTY_STATES: 0, RAW_TEMPLATE_LEAKS: 0, MARKET_FALLBACKS_FROM_IDENTITY_FAILURE: 0, UNSUPPORTED_CONFIDENCE_UPGRADES: 0, UNIVERSAL_SCORES_GENERATED: 0, PAID_ORDERING_SIGNALS: 0,
  });
});
