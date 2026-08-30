import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assembleNetworkAnswer, buildNetworkAskPlan } from './ask-plan.ts';
import { HUB_CAPABILITY_REGISTRY } from './capability-registry.ts';
import { INSURANCE_ASK_CONTRACT } from './insurance-ask.ts';

test('Insurance execute: Florida agencies, count, Texas, NPN, NAIC', () => {
  const fl = buildNetworkAskPlan('Show insurance agencies credentialed in Florida.');
  assert.deepEqual(fl.hubs.map((h) => h.hubId), ['insurance']);
  assert.equal(fl.hubs[0].capabilityStatus, 'execute');
  assert.equal(fl.hubs[0].mode, 'entity');
  assert.equal(fl.parsed.insuranceEntityClass, 'agency');
  assert.match(fl.hubs[0].destination ?? '', /insurancetrusthub.com\/ask/);
  assert.match(fl.hubs[0].geographyCapability, /credential jurisdiction/i);
  assert.doesNotMatch(fl.hubs[0].geographyCapability, /located in Florida|headquartered in Florida|serves Florida/i);
  assert.ok(fl.parsed.interpretationLines.some((row) => row.label === 'Entity class' && row.value === 'Agency'));
  assert.ok(fl.parsed.interpretationLines.some((row) => row.label === 'credential jurisdiction' && row.value === 'Florida'));
  const flAnswer = assembleNetworkAnswer(fl.query);
  assert.equal(flAnswer.traces[0].contract, INSURANCE_ASK_CONTRACT);
  assert.equal(flAnswer.traces[0].providerClass, 'Agency');
  assert.match(flAnswer.traces[0].geographyMeaning, /credential jurisdiction/i);

  const count = buildNetworkAskPlan('How many agencies are credentialed in Florida?');
  assert.equal(count.hubs[0].hubId, 'insurance');
  assert.equal(count.hubs[0].capabilityStatus, 'execute');
  assert.equal(count.hubs[0].mode, 'count');

  const tx = buildNetworkAskPlan('Show insurance agencies credentialed in Texas.');
  assert.equal(tx.hubs[0].hubId, 'insurance');
  assert.equal(tx.hubs[0].capabilityStatus, 'execute');
  assert.equal(tx.parsed.insuranceEntityClass, 'agency');

  const npn = buildNetworkAskPlan('Find NPN 10391484.');
  assert.equal(npn.hubs[0].hubId, 'insurance');
  assert.equal(npn.hubs[0].capabilityStatus, 'execute');
  assert.equal(npn.hubs[0].mode, 'identifier');
  assert.equal(npn.parsed.identifier?.family.id, 'npn');
  assert.equal(npn.parsed.insuranceEntityClass, undefined);
  assert.match(npn.hubs[0].preview?.grain ?? '', /class is not assumed/i);
  const npnAnswer = assembleNetworkAnswer(npn.query);
  assert.match(npnAnswer.traces[0].identifier ?? '', /10391484/);

  const naic = buildNetworkAskPlan('Find insurer NAIC code 10064.');
  assert.equal(naic.hubs[0].hubId, 'insurance');
  assert.equal(naic.hubs[0].capabilityStatus, 'execute');
  assert.equal(naic.parsed.identifier?.family.id, 'naic_company_code');
  assert.match(naic.hubs[0].destination ?? '', /insurancetrusthub.com\/ask/);
});

test('Insurance P&C is execute with a data limitation, not unsupported', () => {
  const pc = buildNetworkAskPlan(
    'Show Florida-credentialed agencies with Property and Casualty lines of authority.',
  );
  assert.equal(pc.hubs[0].hubId, 'insurance');
  assert.equal(pc.hubs[0].capabilityStatus, 'execute');
  assert.notEqual(pc.hubs[0].mode, 'fail_closed');
  assert.notEqual(pc.hubs[0].capabilityStatus, 'unsupported');
  assert.match(pc.hubs[0].preview?.limitation ?? '', /Empty current-data results are not “no authority.”/i);
  assert.equal(pc.parsed.insuranceEntityClass, 'agency');
  assert.match(pc.hubs[0].geographyCapability, /credential jurisdiction/i);
});

test('Insurance fail-closed: ranking, quotes, clean record, class sum, domicile, serving, appointment, county, persons', () => {
  const best = buildNetworkAskPlan('Which insurance agency is the best in Florida?');
  assert.equal(best.hubs[0].hubId, 'insurance');
  assert.equal(best.hubs[0].capabilityStatus, 'execute');
  assert.equal(best.hubs[0].mode, 'fail_closed');

  const safest = buildNetworkAskPlan('Which insurer is safest?');
  assert.equal(safest.hubs[0].mode, 'fail_closed');

  const trust = buildNetworkAskPlan('Which insurance agency is most trustworthy?');
  assert.equal(trust.hubs[0].hubId, 'insurance');
  assert.equal(trust.hubs[0].mode, 'fail_closed');

  const cheap = buildNetworkAskPlan('Which insurer has the cheapest homeowners policy?');
  assert.equal(cheap.hubs[0].mode, 'fail_closed');

  const hire = buildNetworkAskPlan('Which agent should I hire?');
  assert.equal(hire.hubs[0].hubId, 'insurance');
  assert.equal(hire.hubs[0].mode, 'fail_closed');

  const clean = buildNetworkAskPlan('Which insurer has a clean record?');
  assert.equal(clean.hubs[0].mode, 'fail_closed');

  const providers = buildNetworkAskPlan('How many insurance providers are in Florida?');
  assert.equal(providers.hubs[0].mode, 'fail_closed');
  assert.match(providers.hubs[0].whatItCanAnswer, /stay separate|not added/i);

  const domicile = buildNetworkAskPlan('Show insurers domiciled in Florida.');
  assert.equal(domicile.hubs[0].hubId, 'insurance');
  assert.equal(domicile.hubs[0].capabilityStatus, 'execute');
  assert.equal(domicile.hubs[0].mode, 'fail_closed');
  assert.match(domicile.hubs[0].whatItCanAnswer, /domicile/i);

  const serving = buildNetworkAskPlan('Which insurer serves my county?');
  assert.equal(serving.hubs[0].mode, 'fail_closed');
  assert.doesNotMatch(JSON.stringify(serving), /service territory is Florida/i);

  const appt = buildNetworkAskPlan('Is this agency authorized to sell policies from XYZ Insurance Company?');
  assert.equal(appt.hubs[0].capabilityStatus, 'execute');
  assert.equal(appt.hubs[0].mode, 'fail_closed');
  assert.match(appt.hubs[0].whatItCanAnswer, /appointment/i);

  const every = buildNetworkAskPlan("Is this agency authorized to sell every insurer's products?");
  assert.equal(every.hubs[0].mode, 'fail_closed');

  const county = buildNetworkAskPlan('Is this producer authorized to sell insurance in Broward County?');
  assert.equal(county.hubs[0].mode, 'fail_closed');
  assert.match(county.hubs[0].whatItCanAnswer, /not treated as service territory/i);

  const persons = buildNetworkAskPlan('Show all insurance producers in Florida.');
  assert.equal(persons.hubs[0].mode, 'fail_closed');
  assert.match(persons.hubs[0].whatItCanAnswer, /not published/i);

  const personCount = buildNetworkAskPlan('How many individual producers are credentialed in Florida?');
  assert.equal(personCount.hubs[0].mode, 'count');
  assert.equal(personCount.hubs[0].capabilityStatus, 'execute');
  assert.equal(personCount.parsed.insuranceEntityClass, 'person');
});

test('Insurance identifiers: bare digits fail closed; unknown NPN is still execute lookup', () => {
  const bare = buildNetworkAskPlan('10391484');
  assert.equal(bare.parsed.identifier?.ambiguous, true);
  assert.ok(bare.hubs.every((h) => h.capabilityStatus === 'unsupported'));

  const unknown = buildNetworkAskPlan('Find NPN 0000001.');
  assert.equal(unknown.hubs[0].capabilityStatus, 'execute');
  assert.equal(unknown.hubs[0].mode, 'identifier');
  assert.doesNotMatch(JSON.stringify(unknown), /unlicensed|invalid producer/i);
});

test('Insurance execute does not change contractor / senior / investor / lender / move states', () => {
  assert.equal(HUB_CAPABILITY_REGISTRY.contractor.federatedExecution, 'execute');
  assert.equal(HUB_CAPABILITY_REGISTRY.senior.federatedExecution, 'execute');
  assert.equal(HUB_CAPABILITY_REGISTRY.investor.federatedExecution, 'execute');
  assert.equal(HUB_CAPABILITY_REGISTRY.lender.federatedExecution, 'handoff');
  assert.equal(HUB_CAPABILITY_REGISTRY.lender.askStatus, 'planned');
  assert.equal(HUB_CAPABILITY_REGISTRY.move.federatedExecution, 'execute');
  assert.equal(HUB_CAPABILITY_REGISTRY.move.askStatus, 'live');

  const contractor = buildNetworkAskPlan('Show active roofing contractors in Broward County.');
  assert.equal(contractor.hubs[0].hubId, 'contractor');
  assert.equal(contractor.hubs[0].capabilityStatus, 'execute');

  const senior = buildNetworkAskPlan('Show nursing homes in Florida.');
  assert.equal(senior.hubs[0].hubId, 'senior');
  assert.equal(senior.hubs[0].capabilityStatus, 'execute');

  const investor = buildNetworkAskPlan('Find CRD 166089.');
  assert.equal(investor.hubs[0].hubId, 'investor');
  assert.equal(investor.hubs[0].capabilityStatus, 'execute');

  const lender = buildNetworkAskPlan('Which lenders originated the most FHA mortgages in Florida?');
  assert.equal(lender.hubs[0].hubId, 'lender');
  assert.equal(lender.hubs[0].capabilityStatus, 'handoff');

  const move = buildNetworkAskPlan('USDOT 3244649');
  assert.equal(move.hubs[0].hubId, 'move');
  assert.equal(move.hubs[0].capabilityStatus, 'execute');
});
