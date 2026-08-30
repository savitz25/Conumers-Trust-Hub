import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assembleNetworkAnswer, buildNetworkAskPlan } from './ask-plan.ts';
import { HUB_CAPABILITY_REGISTRY } from './capability-registry.ts';
import { MOVE_ASK_CONTRACT } from './move-ask.ts';

test('Move registry is live execute with move-ask-v1', () => {
  assert.equal(HUB_CAPABILITY_REGISTRY.move.askStatus, 'live');
  assert.equal(HUB_CAPABILITY_REGISTRY.move.federatedExecution, 'execute');
  assert.equal(HUB_CAPABILITY_REGISTRY.move.askContract, MOVE_ASK_CONTRACT);
  assert.equal(HUB_CAPABILITY_REGISTRY.move.structuredAskUrl, 'https://www.movetrusthub.com/ask');
  assert.equal(HUB_CAPABILITY_REGISTRY.move.structuredAskApiUrl, 'https://www.movetrusthub.com/api/ask');
});

test('Find USDOT 3244649 executes Move, not Insurance', () => {
  const plan = buildNetworkAskPlan('Find USDOT 3244649.');
  assert.deepEqual(plan.hubs.map((h) => h.hubId), ['move']);
  assert.equal(plan.hubs[0].capabilityStatus, 'execute');
  assert.equal(plan.hubs[0].mode, 'identifier');
  assert.equal(plan.parsed.identifier?.family.id, 'usdot');
  assert.match(plan.hubs[0].destination ?? '', /movetrusthub.com\/ask/);
  assert.doesNotMatch(plan.hubs[0].destination ?? '', /insurancetrusthub/);
  const answer = assembleNetworkAnswer(plan.query);
  assert.equal(answer.traces[0].contract, MOVE_ASK_CONTRACT);
  assert.match(answer.traces[0].identifier ?? '', /3244649/);
  assert.doesNotMatch(JSON.stringify(answer), /Legal insurer/);
});

test('Find MC 1019808 executes Move', () => {
  const plan = buildNetworkAskPlan('Find MC 1019808.');
  assert.equal(plan.hubs[0].hubId, 'move');
  assert.equal(plan.hubs[0].capabilityStatus, 'execute');
  assert.equal(plan.parsed.identifier?.family.id, 'mc');
  assert.match(plan.hubs[0].destination ?? '', /movetrusthub.com\/ask/);
  const answer = assembleNetworkAnswer(plan.query);
  assert.equal(answer.traces[0].contract, MOVE_ASK_CONTRACT);
  assert.match(answer.traces[0].identifier ?? '', /1019808/);
});

test('household-goods carriers headquartered in Florida execute Move, not Insurance', () => {
  const plan = buildNetworkAskPlan(
    'Show current interstate household-goods carriers headquartered in Florida.',
  );
  assert.deepEqual(plan.hubs.map((h) => h.hubId), ['move']);
  assert.equal(plan.hubs[0].capabilityStatus, 'execute');
  assert.notEqual(plan.hubs[0].mode, 'fail_closed');
  assert.equal(plan.parsed.moveRegulatoryRole, 'carrier');
  assert.match(plan.hubs[0].geographyCapability, /headquarters|recorded/i);
  assert.doesNotMatch(plan.hubs[0].geographyCapability, /serves Florida|service territory is Florida/i);
  assert.match(plan.hubs[0].destination ?? '', /movetrusthub.com\/ask/);
  const answer = assembleNetworkAnswer(plan.query);
  assert.equal(answer.traces[0].hubId, 'move');
  assert.equal(answer.traces[0].contract, MOVE_ASK_CONTRACT);
  assert.equal(answer.traces[0].providerClass, 'Carrier');
  assert.doesNotMatch(JSON.stringify(answer), /Legal insurer/);
});

test('household-goods brokers headquartered in Florida execute Move', () => {
  const plan = buildNetworkAskPlan('Show household-goods brokers headquartered in Florida.');
  assert.equal(plan.hubs[0].hubId, 'move');
  assert.equal(plan.hubs[0].capabilityStatus, 'execute');
  assert.equal(plan.parsed.moveRegulatoryRole, 'broker');
  assert.match(plan.hubs[0].whatItCanAnswer, /Carrier ≠ broker|not the transporting carrier|Broker/i);
  const answer = assembleNetworkAnswer(plan.query);
  assert.equal(answer.traces[0].providerClass, 'Broker');
});

test('Florida IM registrations execute Move as FDACS grain', () => {
  const plan = buildNetworkAskPlan('Show Florida intrastate movers registered with FDACS.');
  assert.equal(plan.hubs[0].hubId, 'move');
  assert.equal(plan.hubs[0].capabilityStatus, 'execute');
  assert.match(plan.hubs[0].preview?.grain ?? '', /FDACS|Intrastate Mover/i);
  assert.match(plan.hubs[0].geographyCapability, /not FMCSA interstate|not service territory/i);
});

test('carrier vs broker definition executes Move', () => {
  const plan = buildNetworkAskPlan('What is the difference between a carrier and a broker?');
  assert.equal(plan.hubs[0].hubId, 'move');
  assert.equal(plan.hubs[0].capabilityStatus, 'execute');
  assert.equal(plan.hubs[0].mode, 'definition');
});

test('broker-as-transporter and safest remain fail_closed on Move execute', () => {
  const transporter = buildNetworkAskPlan(
    'Is this broker the company that will actually transport my belongings?',
  );
  assert.equal(transporter.hubs[0].hubId, 'move');
  assert.equal(transporter.hubs[0].capabilityStatus, 'execute');
  assert.equal(transporter.hubs[0].mode, 'fail_closed');
  assert.match(transporter.hubs[0].whatItCanAnswer, /broker/i);

  const safest = buildNetworkAskPlan('Which mover is the safest in Florida?');
  assert.equal(safest.hubs[0].hubId, 'move');
  assert.equal(safest.hubs[0].mode, 'fail_closed');
  assert.doesNotMatch(JSON.stringify(safest), /ranked list|Trust Score/i);

  const best = buildNetworkAskPlan('Which mover is best?');
  assert.equal(best.hubs[0].mode, 'fail_closed');

  const cheap = buildNetworkAskPlan('Which mover is cheapest?');
  assert.equal(cheap.hubs[0].mode, 'fail_closed');

  const scam = buildNetworkAskPlan('Is this mover a scam?');
  assert.equal(scam.hubs[0].mode, 'fail_closed');

  const serving = buildNetworkAskPlan('Show movers serving Palm Beach County.');
  assert.equal(serving.hubs[0].hubId, 'move');
  assert.equal(serving.hubs[0].mode, 'fail_closed');
  assert.doesNotMatch(JSON.stringify(serving), /service territory is Florida headquarters/i);

  const mega = buildNetworkAskPlan('How many moving companies are there?');
  assert.equal(mega.hubs[0].mode, 'fail_closed');
});

test('carrier disambiguation: moving vs insurance vs ambiguous', () => {
  const hhg = buildNetworkAskPlan('Show current interstate household-goods carriers headquartered in Florida.');
  assert.equal(hhg.hubs[0].hubId, 'move');

  const motor = buildNetworkAskPlan('Show motor carriers with FMCSA authority.');
  assert.equal(motor.hubs[0].hubId, 'move');

  const movingCarrier = buildNetworkAskPlan('Show moving carriers in the FMCSA extract.');
  assert.equal(movingCarrier.hubs[0].hubId, 'move');

  const insuranceCarrier = buildNetworkAskPlan('Find insurance carrier NAIC code 10064.');
  assert.equal(insuranceCarrier.hubs[0].hubId, 'insurance');
  assert.equal(insuranceCarrier.hubs[0].capabilityStatus, 'execute');
  assert.equal(insuranceCarrier.parsed.identifier?.family.id, 'naic_company_code');

  const legal = buildNetworkAskPlan('Show legal insurers credentialed in Florida.');
  assert.equal(legal.hubs[0].hubId, 'insurance');

  const homeowners = buildNetworkAskPlan('Find a homeowners insurance carrier.');
  assert.equal(homeowners.hubs[0].hubId, 'insurance');

  const bare = buildNetworkAskPlan('Tell me about this carrier.');
  assert.equal(bare.hubs.length, 0);
  assert.match(bare.parsed.topic, /ambiguous/i);

  const token = buildNetworkAskPlan('carrier');
  assert.equal(token.hubs.length, 0);
});

test('bare digits remain ambiguous across the network', () => {
  const bare = buildNetworkAskPlan('3244649');
  assert.equal(bare.parsed.identifier?.ambiguous, true);
  assert.ok(bare.hubs.every((h) => h.capabilityStatus === 'unsupported'));
});

test('Move execute does not change contractor / senior / investor / insurance / lender', () => {
  assert.equal(HUB_CAPABILITY_REGISTRY.contractor.federatedExecution, 'execute');
  assert.equal(HUB_CAPABILITY_REGISTRY.senior.federatedExecution, 'execute');
  assert.equal(HUB_CAPABILITY_REGISTRY.investor.federatedExecution, 'execute');
  assert.equal(HUB_CAPABILITY_REGISTRY.insurance.federatedExecution, 'execute');
  assert.equal(HUB_CAPABILITY_REGISTRY.lender.federatedExecution, 'execute');
  assert.equal(HUB_CAPABILITY_REGISTRY.lender.askStatus, 'live');

  const contractor = buildNetworkAskPlan('Show active roofing contractors in Broward County.');
  assert.equal(contractor.hubs[0].hubId, 'contractor');
  assert.equal(contractor.hubs[0].capabilityStatus, 'execute');

  const senior = buildNetworkAskPlan('Show nursing homes in Florida.');
  assert.equal(senior.hubs[0].hubId, 'senior');
  assert.equal(senior.hubs[0].capabilityStatus, 'execute');

  const investor = buildNetworkAskPlan('Find CRD 166089.');
  assert.equal(investor.hubs[0].hubId, 'investor');
  assert.equal(investor.hubs[0].capabilityStatus, 'execute');

  const agency = buildNetworkAskPlan('Show insurance agencies credentialed in Florida.');
  assert.equal(agency.hubs[0].hubId, 'insurance');
  assert.equal(agency.hubs[0].capabilityStatus, 'execute');

  const lender = buildNetworkAskPlan('Which lenders originated the most FHA mortgages in Florida?');
  assert.equal(lender.hubs[0].hubId, 'lender');
  assert.equal(lender.hubs[0].capabilityStatus, 'execute');
});
