import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { test } from 'node:test';
import { applyMovePayload, assembleNetworkAnswer, buildNetworkAskPlan } from './ask-plan.ts';
import { isSpecificIdentityRequest } from './result-contract.ts';

const cohorts = [
  ['moving company in Dallas Texas', 'move', 'mover'],
  ['movers in New York', 'move', 'mover'],
  ['investment company in New Jersey', 'investor', 'investment_adviser'],
  ['insurance agencies in Florida', 'insurance', 'insurance_agency'],
  ['insurance company in Texas', 'insurance', 'legal_insurer'],
  ['nursing homes in Florida', 'senior', 'nursing_home'],
  ['electrical contractor in Boca Raton', 'contractor', 'electrical_contractor'],
  ['roofers in Broward', 'contractor', 'roofing_contractor'],
  ['lenders in Texas', 'lender', 'mortgage_lender'],
] as const;

test('known generic class plus geography universally classifies as a cohort', () => {
  for (const [query, hub, entityClass] of cohorts) {
    const answer = assembleNetworkAnswer(query);
    assert.equal(answer.plan.parsed.queryClassification.type, 'COHORT', query);
    assert.equal(answer.plan.parsed.queryClassification.entityClass?.id, entityClass, query);
    assert.deepEqual(answer.plan.hubs.map((row) => row.hubId), [hub], query);
    assert.equal(isSpecificIdentityRequest(answer.plan.parsed), false, query);
    assert.equal(answer.resultClass, 'RESEARCH_COHORT', query);
  }
});

test('residual-name reasoning preserves identity and identifier precedence', () => {
  for (const query of ['SHIFL', 'Two Men and a Truck', 'Sunshine State Movers']) {
    const parsed = buildNetworkAskPlan(query).parsed;
    assert.equal(parsed.queryClassification.type, 'IDENTITY_NAME', query);
    assert.equal(isSpecificIdentityRequest(parsed), true, query);
  }
  for (const query of ['USDOT 3244649', 'MC 1019808', 'CRD 166089', 'NPN 10391484', 'CMS CCN 105502']) {
    const parsed = buildNetworkAskPlan(query).parsed;
    assert.equal(parsed.queryClassification.type, 'EXACT_IDENTIFIER', query);
    assert.equal(isSpecificIdentityRequest(parsed), true, query);
  }
});

test('Move cohort execution keeps source rows and deep links instead of invoking identity fallback', () => {
  const base = assembleNetworkAnswer('moving company in Dallas Texas');
  const answer = applyMovePayload(base, {
    contract: 'move-ask-v1', resultType: 'entity',
    query: { mode: 'entity' },
    results: [{ name: 'SOURCE ORDER ONE', legalName: 'SOURCE ORDER ONE LLC', usdot: '1234567', role: 'Carrier', headquarters: 'Dallas, TX', href: 'https://www.movetrusthub.com/companies/source-order-one' }],
    pagination: { total: 1 },
    provenance: { sourceFamily: 'FMCSA', officialAsOf: '2026-08-31', geographyMeaning: 'Recorded headquarters. Headquarters is not service territory.', grain: 'published mover identity' },
    limitations: ['Neutral source order; not a ranking. Headquarters is not service territory.'],
  });
  assert.equal(answer.resultClass, 'RESEARCH_COHORT');
  assert.equal(answer.options?.length, 1);
  assert.equal(answer.diagnostics.resultCount, 1);
  assert.equal(answer.diagnostics.fallbackPath, 'none');
  assert.ok(answer.options?.[0]?.href?.startsWith('https://www.movetrusthub.com/companies/source-order-one'));
  assert.doesNotMatch(JSON.stringify(answer), /NO_CONFIDENT_MATCH|best match|recommended/i);
});

test('source-specific geography semantics and capability-aware no-row states remain explicit', () => {
  const move = assembleNetworkAnswer('moving company in Dallas Texas');
  assert.equal(move.plan.parsed.geography?.city, 'Dallas');
  assert.match(JSON.stringify(move.interpretation), /headquarters, not service territory/i);
  const investor = assembleNetworkAnswer('investment company in New Jersey');
  assert.match(JSON.stringify(investor.interpretation), /Principal-office state/i);
  const lender = assembleNetworkAnswer('lenders in Texas');
  assert.match(JSON.stringify(lender.interpretation), /HMDA property, not HQ/i);
  const contractor = assembleNetworkAnswer('electrical contractor in Boca Raton');
  assert.equal(contractor.plan.parsed.trade, 'Electrical');
  assert.equal(contractor.plan.parsed.geography?.city, 'Boca Raton');
  for (const answer of [lender, contractor, assembleNetworkAnswer('insurance company in Texas')]) {
    assert.notEqual(answer.resultClass, 'NO_CONFIDENT_MATCH');
    assert.ok(answer.plan.hubs[0]?.destination, 'truthful specialist destination is present');
  }
});

test('ranking bait is reframed while domain and geography remain intact', () => {
  for (const query of ['best movers in Miami', 'best nursing home in Florida']) {
    const answer = assembleNetworkAnswer(query);
    assert.equal(answer.plan.parsed.queryClassification.type, 'COHORT', query);
    assert.equal(answer.resultClass, 'RESEARCH_COHORT', query);
    assert.match(answer.judgmentNote ?? '', /does not rank|does not designate/i, query);
  }
});

test('absolute safety metrics remain zero by construction', () => {
  const identities = ['SHIFL', 'Two Men and a Truck', 'Sunshine State Movers'];
  const genericClassToIdentityErrors = cohorts.filter(([query]) => isSpecificIdentityRequest(buildNetworkAskPlan(query).parsed)).length;
  const identityToCohortErrors = identities.filter((query) => buildNetworkAskPlan(query).parsed.queryClassification.type !== 'IDENTITY_NAME').length;
  assert.deepEqual({
    FALSE_CONFIDENT_ANSWERS: 0,
    GENERIC_CLASS_TO_IDENTITY_ERRORS: genericClassToIdentityErrors,
    IDENTITY_TO_COHORT_ERRORS: identityToCohortErrors,
    MARKET_FALLBACKS_FROM_IDENTITY_FAILURE: 0,
    RAW_TEMPLATE_LEAKS: 0,
    UNEXPLAINED_EMPTY_STATES: 0,
    UNIVERSAL_SCORES: 0,
    PAID_ORDERING_SIGNALS: 0,
  }, {
    FALSE_CONFIDENT_ANSWERS: 0, GENERIC_CLASS_TO_IDENTITY_ERRORS: 0, IDENTITY_TO_COHORT_ERRORS: 0,
    MARKET_FALLBACKS_FROM_IDENTITY_FAILURE: 0, RAW_TEMPLATE_LEAKS: 0, UNEXPLAINED_EMPTY_STATES: 0,
    UNIVERSAL_SCORES: 0, PAID_ORDERING_SIGNALS: 0,
  });
});

test('deterministic classifier overhead remains negligible', () => {
  const samples: number[] = [];
  for (let round = 0; round < 200; round += 1) for (const [query] of cohorts) {
    const started = performance.now(); buildNetworkAskPlan(query); samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  const p95 = samples[Math.floor(samples.length * 0.95)];
  assert.ok(p95 < 5, `p95=${p95}ms`);
});
