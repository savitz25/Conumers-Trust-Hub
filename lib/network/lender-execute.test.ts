import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assembleNetworkAnswer, buildNetworkAskPlan } from './ask-plan.ts';
import { HUB_CAPABILITY_REGISTRY } from './capability-registry.ts';
import { LENDER_ASK_CONTRACT, LENDER_SUPPORTED_MODES } from './lender-ask.ts';
import { IDENTIFIER_FAMILIES } from './identifiers.ts';
import { browardPlaceLens } from './place-lens.ts';
import { V1_PRINCIPLES, V1_SPECIALISTS, V1_STATUS } from './v1-complete.ts';

test('Lender registry is live execute with lender-ask-v1 and no identifier mode', () => {
  assert.equal(HUB_CAPABILITY_REGISTRY.lender.askStatus, 'live');
  assert.equal(HUB_CAPABILITY_REGISTRY.lender.federatedExecution, 'execute');
  assert.equal(HUB_CAPABILITY_REGISTRY.lender.askContract, LENDER_ASK_CONTRACT);
  assert.equal(HUB_CAPABILITY_REGISTRY.lender.structuredAskUrl, 'https://www.lendertrusthub.com/ask');
  assert.equal(HUB_CAPABILITY_REGISTRY.lender.structuredAskApiUrl, 'https://www.lendertrusthub.com/api/ask');
  assert.deepEqual(HUB_CAPABILITY_REGISTRY.lender.supportedAskModes, LENDER_SUPPORTED_MODES);
  assert.ok(!LENDER_SUPPORTED_MODES.includes('identifier' as never));
  assert.equal(
    IDENTIFIER_FAMILIES.find((f) => f.id === 'nmls')?.live,
    false,
  );
});

test('FHA Florida most originations executes Lender with HMDA property geography', () => {
  const plan = buildNetworkAskPlan('Which lenders originated the most FHA mortgages in Florida?');
  assert.deepEqual(plan.hubs.map((h) => h.hubId), ['lender']);
  assert.equal(plan.hubs[0].capabilityStatus, 'execute');
  assert.equal(plan.hubs[0].mode, 'entity');
  assert.match(plan.hubs[0].destination ?? '', /lendertrusthub.com\/ask/);
  assert.match(plan.hubs[0].geographyCapability, /property/i);
  assert.doesNotMatch(plan.hubs[0].geographyCapability, /headquarters is Florida|service territory is Florida/i);
  assert.match(plan.hubs[0].whatItCanAnswer, /raw volume count|not a recommendation/i);
  const answer = assembleNetworkAnswer(plan.query);
  assert.equal(answer.traces[0].hubId, 'lender');
  assert.equal(answer.traces[0].contract, LENDER_ASK_CONTRACT);
  assert.match(answer.traces[0].geographyMeaning, /property/i);
  assert.match(answer.traces[0].queryGrain, /HMDA/i);
  assert.doesNotMatch(JSON.stringify(answer), /Trust Score|best lender|13216/);
});

test('Broward applications execute Lender as county property geography, not Place Lens metrics', () => {
  const plan = buildNetworkAskPlan('Which lenders had the most mortgage applications in Broward County?');
  assert.equal(plan.hubs[0].hubId, 'lender');
  assert.equal(plan.hubs[0].capabilityStatus, 'execute');
  assert.match(plan.hubs[0].geographyCapability, /property county|mortgaged-property county/i);
  assert.match(plan.hubs[0].geographyCapability, /not lender branch county|not lender headquarters/i);
  assert.equal(browardPlaceLens().hubs.find((h) => h.hubId === 'lender')?.metrics.length, 0);
});

test('Broward vs Palm Beach mortgage applications route Lender only, not Place Lens comparison', () => {
  const plan = buildNetworkAskPlan('Compare Broward and Palm Beach mortgage applications.');
  assert.deepEqual(plan.hubs.map((h) => h.hubId), ['lender']);
  assert.equal(plan.hubs[0].capabilityStatus, 'execute');
  assert.equal(plan.hubs[0].mode, 'comparison');
  assert.match(plan.hubs[0].destination ?? '', /lendertrusthub.com\/ask/);
  const blob = JSON.stringify(assembleNetworkAnswer(plan.query));
  assert.doesNotMatch(blob, /67743|56484|67,743|56,484/);
  assert.doesNotMatch(blob, /Trust Score/);
});

test('Lender fail-closed: best, safest, cheapest, lowest rate, discrimination, denial reasons, service territory', () => {
  const cases: Array<[string, RegExp]> = [
    ['Which lender is the best in Florida?', /does not rank|not a recommendation/i],
    ['Which lender is safest?', /safest|not a recommendation/i],
    ['Which lender is cheapest?', /pricing|rate sheet|not today/i],
    ['Who has the lowest current mortgage rate?', /rate sheet|pricing|not today/i],
    ['Which lender discriminates in Florida?', /not a finding of discrimination/i],
    ['Why did this lender deny my loan?', /denial/i],
    ['Which lenders serve Florida?', /service territory/i],
  ];
  for (const [q, expect] of cases) {
    const plan = buildNetworkAskPlan(q);
    assert.equal(plan.hubs[0].hubId, 'lender', q);
    assert.equal(plan.hubs[0].capabilityStatus, 'execute', q);
    assert.equal(plan.hubs[0].mode, 'fail_closed', q);
    assert.match(plan.hubs[0].whatItCanAnswer, expect, q);
    assert.doesNotMatch(JSON.stringify(plan), /Trust Score|#1 lender/i);
  }
});

test('complaints are not wrongdoing; denial is not discrimination; most is not a rate', () => {
  const complaints = buildNetworkAskPlan('Show CFPB mortgage complaints for Florida lenders.');
  assert.equal(complaints.hubs[0].hubId, 'lender');
  assert.equal(complaints.hubs[0].capabilityStatus, 'execute');
  assert.notEqual(complaints.hubs[0].mode, 'fail_closed');
  assert.match(complaints.hubs[0].whatItCanAnswer, /not confirmed wrongdoing/i);

  const rate = buildNetworkAskPlan('Which lender has the highest denial rate in Florida?');
  assert.equal(rate.hubs[0].mode, 'fail_closed');
  assert.match(rate.hubs[0].whatItCanAnswer, /denominator/i);
});

test('NMLS stays labeled handoff; bare digits stay ambiguous; no invented identifier mode', () => {
  const nmls = buildNetworkAskPlan('NMLS 123456');
  assert.equal(nmls.parsed.identifier?.family.id, 'nmls');
  assert.equal(nmls.parsed.identifier?.family.live, false);
  assert.equal(nmls.hubs[0].hubId, 'lender');
  assert.equal(nmls.hubs[0].capabilityStatus, 'handoff');
  assert.match(nmls.hubs[0].destination ?? '', /nmlsconsumeraccess/i);
  assert.doesNotMatch(nmls.hubs[0].destination ?? '', /lendertrusthub.com\/ask/);
  const nmlsAnswer = assembleNetworkAnswer(nmls.query);
  assert.notEqual(nmlsAnswer.traces[0]?.contract, LENDER_ASK_CONTRACT);

  const bare = buildNetworkAskPlan('123456');
  assert.equal(bare.parsed.identifier?.ambiguous, true);
  assert.ok(bare.hubs.every((h) => h.capabilityStatus === 'unsupported'));
});

test('cross-domain broker and carrier collisions', () => {
  const mortgageBroker = buildNetworkAskPlan('Show mortgage brokers in Florida.');
  assert.equal(mortgageBroker.hubs[0].hubId, 'lender');
  assert.equal(mortgageBroker.hubs[0].capabilityStatus, 'execute');

  const movingBroker = buildNetworkAskPlan('Show household-goods brokers headquartered in Florida.');
  assert.equal(movingBroker.hubs[0].hubId, 'move');
  assert.equal(movingBroker.hubs[0].capabilityStatus, 'execute');
  assert.equal(movingBroker.parsed.moveRegulatoryRole, 'broker');

  const insuranceBroker = buildNetworkAskPlan('Show insurance brokers credentialed in Florida.');
  assert.equal(insuranceBroker.hubs[0].hubId, 'insurance');
  assert.equal(insuranceBroker.hubs[0].capabilityStatus, 'execute');

  const dealer = buildNetworkAskPlan('Show broker-dealers in Florida.');
  assert.equal(dealer.hubs[0].hubId, 'investor');
  assert.equal(dealer.hubs[0].capabilityStatus, 'execute');

  const bareBroker = buildNetworkAskPlan('Tell me about this broker.');
  assert.equal(bareBroker.hubs.length, 0);
  assert.match(bareBroker.parsed.topic, /ambiguous/i);

  const hhgCarrier = buildNetworkAskPlan('Show current interstate household-goods carriers headquartered in Florida.');
  assert.equal(hhgCarrier.hubs[0].hubId, 'move');

  const insuranceCarrier = buildNetworkAskPlan('Find insurance carrier NAIC code 10064.');
  assert.equal(insuranceCarrier.hubs[0].hubId, 'insurance');

  const bareCarrier = buildNetworkAskPlan('Tell me about this carrier.');
  assert.equal(bareCarrier.hubs.length, 0);
});

test('geography semantics stay source-specific across hubs', () => {
  const lender = buildNetworkAskPlan('Which lenders originated the most FHA mortgages in Florida?');
  assert.match(lender.hubs[0].geographyCapability, /property/i);

  const move = buildNetworkAskPlan('Show current interstate household-goods carriers headquartered in Florida.');
  assert.match(move.hubs[0].geographyCapability, /headquarters|recorded/i);

  const insurance = buildNetworkAskPlan('Show insurance agencies credentialed in Florida.');
  assert.match(insurance.hubs[0].geographyCapability, /credential jurisdiction/i);

  const investor = buildNetworkAskPlan('Show SEC-registered RIAs in Florida.');
  assert.match(investor.hubs[0].geographyCapability, /principal-office/i);

  const senior = buildNetworkAskPlan('Show nursing homes in Palm Beach County.');
  assert.match(senior.hubs[0].geographyCapability, /address\/location county/i);

  const contractor = buildNetworkAskPlan('Show active roofing contractors in Broward County.');
  assert.match(contractor.hubs[0].geographyCapability, /county|credential/i);
});

test('entity-grain regression: no mega-count, no cross-hub sum, no Trust Score', () => {
  const moving = buildNetworkAskPlan('How many moving companies are there?');
  assert.equal(moving.hubs[0].mode, 'fail_closed');

  const insurance = buildNetworkAskPlan('How many insurance providers are in Florida?');
  assert.equal(insurance.hubs[0].mode, 'fail_closed');

  const senior = buildNetworkAskPlan('How many senior providers are there?');
  assert.equal(senior.hubs[0].mode, 'fail_closed');

  const journey = assembleNetworkAnswer("I'm buying a home in Broward County. What should I research?");
  assert.match(journey.hubCountLabel, /4 TrustHub research systems/);
  assert.doesNotMatch(JSON.stringify(journey), /24 million|Trust Score|network total/i);
});

test('network fail-closed: no ranking, no universal score, contractor hire is not a ranking', () => {
  const bestProvider = buildNetworkAskPlan('Who is the best provider in the network?');
  assert.equal(bestProvider.hubs.length, 0);

  const hire = buildNetworkAskPlan('Should I hire this contractor?');
  assert.equal(hire.hubs[0].hubId, 'contractor');
  assert.equal(hire.hubs[0].mode, 'fail_closed');
  assert.match(hire.hubs[0].whatItCanAnswer, /does not recommend/i);

  const safestMover = buildNetworkAskPlan('Which mover is the safest in Florida?');
  assert.equal(safestMover.hubs[0].mode, 'fail_closed');

  const trustIns = buildNetworkAskPlan('Which insurance agency is most trustworthy?');
  assert.equal(trustIns.hubs[0].mode, 'fail_closed');

  const adviser = buildNetworkAskPlan('Which adviser will give me the best returns?');
  assert.equal(adviser.hubs[0].mode, 'fail_closed');

  const safestNh = buildNetworkAskPlan('What is the safest nursing home in Florida?');
  assert.equal(safestNh.hubs[0].mode, 'fail_closed');
});

test('Trace / provenance: one execute example per hub', () => {
  const rows = [
    ['Show active roofing contractors in Broward County.', 'contractor', undefined],
    ['Show nursing homes in Palm Beach County with 5 CMS overall stars.', 'senior', 'senior-ask-v1'],
    ['Show Florida RIAs reporting between $1 billion and $10 billion RAUM.', 'investor', 'investor-ask-v1'],
    ['Show insurance agencies credentialed in Florida.', 'insurance', 'insurance-ask-v1'],
    ['Show current interstate household-goods carriers headquartered in Florida.', 'move', 'move-ask-v1'],
    ['Which lenders originated the most FHA mortgages in Florida?', 'lender', 'lender-ask-v1'],
  ] as const;

  for (const [q, hubId, contract] of rows) {
    const answer = assembleNetworkAnswer(q);
    assert.equal(answer.traces[0].hubId, hubId, q);
    if (contract) assert.equal(answer.traces[0].contract, contract, q);
    else assert.equal(answer.plan.hubs[0].capabilityStatus, 'execute', q);
    assert.ok(answer.traces[0].geographyMeaning, q);
    assert.ok(answer.traces[0].queryGrain, q);
    assert.ok(answer.traces[0].specialistDestination, q);
    assert.match(answer.traces[0].specialistDestination, /ask|verify/i, q);
  }
});

test('publication and paid-status regression: Ask is not publication or paid ranking', () => {
  const plan = buildNetworkAskPlan('Which lenders originated the most FHA mortgages in Florida?');
  const blob = JSON.stringify(assembleNetworkAnswer(plan.query));
  assert.doesNotMatch(blob, /mass-publish|paid placement|sponsored rank|subscription changes evidence/i);
  assert.doesNotMatch(blob, /person_public_candidate|gated people now public/i);
  assert.ok(!('paidStatus' in plan.hubs[0]));
  assert.ok(!('subscription' in plan));
  assert.match(HUB_CAPABILITY_REGISTRY.lender.notes.join(' '), /Ask is not publication authorization/i);
});

test('unsupported questions fail closed instead of picking a specialist', () => {
  const q = buildNetworkAskPlan('What is the meaning of life?');
  assert.equal(q.hubs.length, 0);
});

test('six hubs remain execute for their owned domains; no remaining structured-Ask handoff', () => {
  for (const hubId of ['contractor', 'senior', 'investor', 'insurance', 'move', 'lender'] as const) {
    assert.equal(HUB_CAPABILITY_REGISTRY[hubId].askStatus, 'live', hubId);
    assert.equal(HUB_CAPABILITY_REGISTRY[hubId].federatedExecution, 'execute', hubId);
  }
  assert.equal(V1_STATUS, 'ASKTRUSTHUB INTELLIGENCE NETWORK V1 — COMPLETE');
  assert.equal(V1_SPECIALISTS.lender.askContract, 'lender-ask-v1');
  assert.ok(V1_PRINCIPLES.includes('AskTrustHub is the network orchestration layer.'));
});
