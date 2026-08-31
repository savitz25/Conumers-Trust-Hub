import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { applyMovePayload, assembleNetworkAnswer, buildNetworkAskPlan } from './ask-plan.ts';
import { HUB_CAPABILITY_CONTRACTS } from './hub-capability-contract.ts';
import { ASK_RESULT_CLASSES, IDENTITY_RESOLUTION_CLASSES } from './result-contract.ts';
import type { MoveAskPayload } from './move-ask.ts';

const cohortPayload: MoveAskPayload = {
  contract: 'move-ask-v1', resultType: 'entity',
  results: [{ name: 'UNRELATED FLORIDA MOVER', usdot: '999999', role: 'Carrier' }],
  counts: [{ label: 'Matching research identities', value: 269, grain: 'recorded headquarters state = FL' }],
  provenance: { sourceFamily: 'fmcsa-directory-cohort', geographyMeaning: 'recorded_headquarters_state = FL', officialAsOf: 'fixture', grain: 'recorded headquarters state = FL' },
};

test('result and identity contracts are exhaustive and unique', () => {
  assert.equal(new Set(ASK_RESULT_CLASSES).size, 7);
  assert.equal(new Set(IDENTITY_RESOLUTION_CLASSES).size, 7);
});

test('failed company match cannot downgrade to a state cohort', () => {
  const answer = applyMovePayload(assembleNetworkAnswer('Is Sunshine State Movers a legitimate licensed mover in Florida?'), cohortPayload);
  assert.equal(answer.resultClass, 'NO_CONFIDENT_MATCH');
  assert.equal(answer.identityResolutionClass, 'NO_CONFIDENT_MATCH');
  assert.equal(answer.options?.length ?? 0, 0);
  assert.equal(answer.diagnostics.fallbackPath, 'identity_cohort_firewall');
  assert.equal(answer.diagnostics.resultCount, 0);
  assert.match(answer.noResult?.understood ?? '', /specific company/i);
});

test('Move public-name inputs route but do not auto-select without canonical resolver contract', () => {
  for (const query of ['SHIFL', 'two men and a truck', 'Colleg Hunks']) {
    const plan = buildNetworkAskPlan(query);
    assert.deepEqual(plan.hubs.map((hub) => hub.hubId), ['move']);
    const answer = applyMovePayload(assembleNetworkAnswer(query), cohortPayload);
    assert.equal(answer.resultClass, 'NO_CONFIDENT_MATCH');
    assert.equal(answer.options?.length ?? 0, 0);
  }
});

test('exact identifiers preserve exact identity classification', () => {
  for (const query of ['USDOT 3244649', 'CRD 166089', 'NPN 10391484', 'CCN 105502']) {
    const answer = assembleNetworkAnswer(query);
    assert.equal(answer.resultClass, 'EXACT_IDENTITY');
    assert.equal(answer.identityResolutionClass, 'EXACT_IDENTIFIER');
  }
});

test('research, place, journey, ranking, malformed and unsupported queries fail safely', () => {
  assert.equal(assembleNetworkAnswer('active roofing contractors in Broward County').resultClass, 'RESEARCH_COHORT');
  assert.equal(assembleNetworkAnswer('What does TrustHub know about Broward?').resultClass, 'MARKET_OR_PLACE_RESEARCH');
  assert.equal(assembleNetworkAnswer("I'm buying a home in Broward County. What should I research?").resultClass, 'HANDOFF');
  const ranked = assembleNetworkAnswer('best movers in Miami');
  assert.equal(ranked.resultClass, 'RESEARCH_COHORT');
  assert.match(ranked.judgmentNote ?? '', /does not designate|does not rank/i);
  assert.equal(assembleNetworkAnswer('123456').resultClass, 'UNSUPPORTED_QUERY');
  assert.equal(assembleNetworkAnswer('compare a mover, lender and contractor in one score').resultClass, 'UNSUPPORTED_QUERY');
});

test('all six typed capability contracts preserve ownership and geography semantics', () => {
  const contracts = Object.values(HUB_CAPABILITY_CONTRACTS);
  assert.equal(contracts.length, 6);
  for (const contract of contracts) {
    assert.ok(contract.supportedEntityClasses.length);
    assert.ok(contract.canonicalDestination.startsWith('https://'));
    assert.ok(contract.geographySemantics.length > 10);
    assert.doesNotMatch(JSON.stringify(contract), /paid rank|universal score/i);
  }
});

test('golden copy has no raw template leaks and zero-result UI is explicit', () => {
  const planSource = readFileSync(new URL('./ask-plan.ts', import.meta.url), 'utf8');
  const uiSource = readFileSync(new URL('../../components/network-ask-result.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(planSource, /rewrite 924 as a recommendation|\[object Object\]/i);
  const renderedContract = JSON.stringify(applyMovePayload(assembleNetworkAnswer('Sunshine State Movers'), cohortPayload));
  assert.doesNotMatch(renderedContract, /\bundefined\b|\[object Object\]/i);
  assert.match(uiSource, /What you can try next/);
  assert.match(uiSource, /Research cohort/);
});

test('FALSE_CONFIDENT_ANSWERS = 0 across critical no-match fixtures', () => {
  const queries = ['Sunshine State Movers', 'Intentionally Unknown Moving Company XYZ'];
  const falseConfident = queries.filter((query) => applyMovePayload(assembleNetworkAnswer(query), cohortPayload).options?.length);
  assert.equal(falseConfident.length, 0);
});
