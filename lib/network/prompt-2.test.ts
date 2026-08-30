import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assembleNetworkAnswer, buildNetworkAskPlan } from './ask-plan.ts';
import { parseNetworkAsk } from './ask-parse.ts';
import { HUB_CAPABILITY_REGISTRY } from './capability-registry.ts';
import { coverageAtlasCells, coverageCounts, cellAt } from './coverage-atlas-data.ts';
import { evidenceCell, evidenceAtlasCells } from './evidence-atlas-data.ts';
import { IDENTIFIER_FAMILIES } from './identifiers.ts';
import { runNameCheck } from './name-check.ts';
import { browardPlaceLens, floridaPlaceLens, palmBeachPlaceLens } from './place-lens.ts';
import { SPECIALIST_HUB_IDS } from './registry.ts';
import { US_JURISDICTIONS } from './us-jurisdictions.ts';
import { STANDARD_PIPELINE } from '../standard.ts';

test('capability registry: lender Ask is not live; contractor, senior, investor, and insurance Ask are live', () => {
  assert.equal(HUB_CAPABILITY_REGISTRY.lender.askStatus, 'planned');
  assert.equal(HUB_CAPABILITY_REGISTRY.contractor.askStatus, 'live');
  assert.equal(HUB_CAPABILITY_REGISTRY.contractor.federatedExecution, 'execute');
  assert.equal(HUB_CAPABILITY_REGISTRY.senior.askStatus, 'live');
  assert.equal(HUB_CAPABILITY_REGISTRY.senior.federatedExecution, 'execute');
  assert.equal(HUB_CAPABILITY_REGISTRY.senior.askContract, 'senior-ask-v1');
  assert.equal(HUB_CAPABILITY_REGISTRY.investor.askStatus, 'live');
  assert.equal(HUB_CAPABILITY_REGISTRY.investor.federatedExecution, 'execute');
  assert.equal(HUB_CAPABILITY_REGISTRY.investor.askContract, 'investor-ask-v1');
  assert.equal(HUB_CAPABILITY_REGISTRY.investor.structuredAskUrl, 'https://www.investortrusthub.com/ask');
  assert.equal(HUB_CAPABILITY_REGISTRY.investor.structuredAskApiUrl, 'https://www.investortrusthub.com/api/ask');
  assert.equal(HUB_CAPABILITY_REGISTRY.move.askStatus, 'partial');
  assert.equal(HUB_CAPABILITY_REGISTRY.move.federatedExecution, 'handoff');
  assert.equal(HUB_CAPABILITY_REGISTRY.insurance.askStatus, 'live');
  assert.equal(HUB_CAPABILITY_REGISTRY.insurance.federatedExecution, 'execute');
  assert.equal(HUB_CAPABILITY_REGISTRY.insurance.askContract, 'insurance-ask-v1');
  assert.equal(HUB_CAPABILITY_REGISTRY.insurance.structuredAskUrl, 'https://www.insurancetrusthub.com/ask');
  assert.equal(HUB_CAPABILITY_REGISTRY.insurance.structuredAskApiUrl, 'https://www.insurancetrusthub.com/api/ask');
  assert.equal(HUB_CAPABILITY_REGISTRY.move.identifierLookup, 'live');
  assert.equal(HUB_CAPABILITY_REGISTRY.insurance.identifierLookup, 'live');
  assert.equal(HUB_CAPABILITY_REGISTRY.lender.federatedExecution, 'handoff');
});

test('Broward roofers route to contractor execute', () => {
  const plan = buildNetworkAskPlan('Show active roofing contractors in Broward County.');
  assert.equal(plan.intent, 'entity');
  assert.deepEqual(plan.hubs.map((h) => h.hubId), ['contractor']);
  assert.equal(plan.hubs[0].capabilityStatus, 'execute');
  assert.match(plan.hubs[0].destination ?? '', /contractortrusthub.com\/ask/);
  assert.match(plan.hubs[0].preview?.headline ?? '', /924/);
  assert.doesNotMatch(plan.hubs[0].preview?.headline ?? '', /trusted roofers/i);
});

test('FHA Florida does not fabricate Lender Ask', () => {
  const plan = buildNetworkAskPlan('Which lenders originated the most FHA mortgages in Florida?');
  assert.equal(plan.hubs.length, 1);
  assert.equal(plan.hubs[0].hubId, 'lender');
  assert.equal(plan.hubs[0].capabilityStatus, 'handoff');
  assert.match(plan.hubs[0].reason, /not production-live/i);
});

test('identifier routing', () => {
  assert.equal(parseNetworkAsk('USDOT 3244649').identifier?.family.id, 'usdot');
  assert.equal(buildNetworkAskPlan('USDOT 3244649').hubs[0].hubId, 'move');
  assert.equal(parseNetworkAsk('CRD 123456').identifier?.family.id, 'crd');
  assert.equal(buildNetworkAskPlan('CRD 123456').hubs[0].hubId, 'investor');
  assert.equal(parseNetworkAsk('NMLS 123456').identifier?.family.live, false);
  assert.equal(parseNetworkAsk('NPN 1234567').identifier?.family.live, true);
  assert.equal(parseNetworkAsk('NPN 1234567').identifier?.family.id, 'npn');
  assert.equal(parseNetworkAsk('CBC015082').identifier?.family.id, 'state_contractor_license');
  const ccn = parseNetworkAsk('CCN 105502');
  assert.equal(ccn.identifier?.family.id, 'cms_ccn');
  assert.equal(ccn.identifier?.family.live, true);
  const bare = parseNetworkAsk('123456');
  assert.equal(bare.identifier?.ambiguous, true);
});

test('Senior execute: Florida / Palm Beach / 5-star NH / CCN / Florida HH / Florida hospice', () => {
  const flNh = buildNetworkAskPlan('Show nursing homes in Florida.');
  assert.deepEqual(flNh.hubs.map((h) => h.hubId), ['senior']);
  assert.equal(flNh.hubs[0].capabilityStatus, 'execute');
  assert.match(flNh.hubs[0].destination ?? '', /seniortrusthub.com\/ask/);
  assert.equal(flNh.parsed.seniorProviderClass, 'nursing_home');

  const palm = buildNetworkAskPlan('Show nursing homes in Palm Beach County.');
  assert.deepEqual(palm.hubs.map((h) => h.hubId), ['senior']);
  assert.equal(palm.hubs[0].capabilityStatus, 'execute');
  assert.match(palm.hubs[0].geographyCapability, /address\/location county/i);

  const stars = buildNetworkAskPlan('Show Florida nursing homes with 5 CMS overall stars.');
  assert.equal(stars.hubs[0].hubId, 'senior');
  assert.equal(stars.hubs[0].capabilityStatus, 'execute');
  assert.notEqual(stars.hubs[0].mode, 'fail_closed');

  const ccn = buildNetworkAskPlan('Find CMS CCN 105502.');
  assert.equal(ccn.hubs[0].hubId, 'senior');
  assert.equal(ccn.hubs[0].capabilityStatus, 'execute');
  assert.equal(ccn.hubs[0].mode, 'identifier');
  assert.match(ccn.hubs[0].destination ?? '', /seniortrusthub.com\/ask/);

  const hh = buildNetworkAskPlan('Show home health agencies in Florida.');
  assert.equal(hh.hubs[0].hubId, 'senior');
  assert.equal(hh.hubs[0].capabilityStatus, 'execute');
  assert.equal(hh.parsed.seniorProviderClass, 'home_health');
  assert.notEqual(hh.hubs[0].mode, 'fail_closed');

  const hospice = buildNetworkAskPlan('Show hospice providers in Florida.');
  assert.equal(hospice.hubs[0].hubId, 'senior');
  assert.equal(hospice.hubs[0].capabilityStatus, 'execute');
  assert.equal(hospice.parsed.seniorProviderClass, 'hospice');
});

test('Senior fail-closed: HH county, 5-star hospice, safest NH, combined count', () => {
  const hhCounty = buildNetworkAskPlan('Show home health agencies in Miami-Dade County.');
  assert.equal(hhCounty.hubs[0].hubId, 'senior');
  assert.equal(hhCounty.hubs[0].capabilityStatus, 'execute');
  assert.equal(hhCounty.hubs[0].mode, 'fail_closed');
  assert.match(hhCounty.hubs[0].whatItCanAnswer, /county/i);
  assert.doesNotMatch(JSON.stringify(hhCounty), /serves Miami-Dade/i);

  const hospiceStars = buildNetworkAskPlan('Show 5-star hospice providers.');
  assert.equal(hospiceStars.hubs[0].mode, 'fail_closed');
  assert.match(hospiceStars.hubs[0].whatItCanAnswer, /overall CMS star/i);

  const safest = buildNetworkAskPlan('What is the safest nursing home in Florida?');
  assert.equal(safest.hubs[0].hubId, 'senior');
  assert.equal(safest.hubs[0].mode, 'fail_closed');
  assert.match(safest.hubs[0].whatItCanAnswer, /does not publish a safest/i);
  assert.doesNotMatch(JSON.stringify(safest), /#1 safest|ranking of nursing homes/i);

  const combined = buildNetworkAskPlan('How many senior providers are there?');
  assert.equal(combined.hubs[0].hubId, 'senior');
  assert.equal(combined.hubs[0].mode, 'fail_closed');
  assert.match(combined.hubs[0].whatItCanAnswer, /stay separate/i);
  assert.doesNotMatch(JSON.stringify(combined), /senior providers total|summed/i);
});

test('Senior execute does not change contractor / lender / move / insurance / investor states', () => {
  const contractor = buildNetworkAskPlan('Show active roofing contractors in Broward County.');
  assert.equal(contractor.hubs[0].hubId, 'contractor');
  assert.equal(contractor.hubs[0].capabilityStatus, 'execute');

  const lender = buildNetworkAskPlan('Which lenders originated the most FHA mortgages in Florida?');
  assert.equal(lender.hubs[0].hubId, 'lender');
  assert.equal(lender.hubs[0].capabilityStatus, 'handoff');

  const move = buildNetworkAskPlan('USDOT 3244649');
  assert.equal(move.hubs[0].hubId, 'move');

  const insurance = buildNetworkAskPlan('Find a Florida insurance agency license.');
  assert.equal(insurance.hubs[0].hubId, 'insurance');
  assert.equal(insurance.hubs[0].capabilityStatus, 'execute');

  const investor = buildNetworkAskPlan('Find CRD 166089.');
  assert.equal(investor.hubs[0].hubId, 'investor');
  assert.equal(investor.hubs[0].capabilityStatus, 'execute');
});

test('Investor execute: Florida RIA/ERA, RAUM, compensation, counts, CRD', () => {
  const flRia = buildNetworkAskPlan('Show SEC-registered RIAs in Florida.');
  assert.deepEqual(flRia.hubs.map((h) => h.hubId), ['investor']);
  assert.equal(flRia.hubs[0].capabilityStatus, 'execute');
  assert.match(flRia.hubs[0].destination ?? '', /investortrusthub.com\/ask/);
  assert.equal(flRia.parsed.investorFirmType, 'ria');
  assert.match(flRia.hubs[0].geographyCapability, /principal-office/i);
  assert.doesNotMatch(flRia.hubs[0].geographyCapability, /Serves Florida/i);

  const flEra = buildNetworkAskPlan('Show ERAs in Florida.');
  assert.equal(flEra.hubs[0].hubId, 'investor');
  assert.equal(flEra.hubs[0].capabilityStatus, 'execute');
  assert.equal(flEra.parsed.investorFirmType, 'era');

  const raum = buildNetworkAskPlan('Show Florida RIAs reporting between $1 billion and $10 billion RAUM.');
  assert.equal(raum.hubs[0].capabilityStatus, 'execute');
  assert.equal(raum.parsed.investorFirmType, 'ria');
  assert.doesNotMatch(JSON.stringify(raum), /performance ranking|best returns/i);
  const raumTrace = assembleNetworkAnswer(raum.query);
  assert.equal(raumTrace.traces[0].contract, 'investor-ask-v1');
  assert.match(raumTrace.traces[0].geographyMeaning, /Principal-office/i);
  assert.match(raumTrace.traces[0].queryGrain, /RIA firm facts/i);

  const fees = buildNetworkAskPlan('Show firms reporting asset-based compensation.');
  assert.equal(fees.hubs[0].hubId, 'investor');
  assert.equal(fees.hubs[0].capabilityStatus, 'execute');
  assert.notEqual(fees.hubs[0].mode, 'fail_closed');

  const fixed = buildNetworkAskPlan('Show firms reporting fixed fees.');
  assert.equal(fixed.hubs[0].capabilityStatus, 'execute');

  const riaCount = buildNetworkAskPlan('How many RIAs are currently indexed?');
  assert.equal(riaCount.hubs[0].mode, 'count');
  assert.equal(riaCount.hubs[0].capabilityStatus, 'execute');

  const eraCount = buildNetworkAskPlan('How many ERAs are currently indexed?');
  assert.equal(eraCount.parsed.investorFirmType, 'era');
  assert.equal(eraCount.hubs[0].capabilityStatus, 'execute');

  const crd = buildNetworkAskPlan('Find CRD 166089.');
  assert.equal(crd.hubs[0].mode, 'identifier');
  assert.equal(crd.hubs[0].capabilityStatus, 'execute');
  assert.match(crd.hubs[0].destination ?? '', /investortrusthub.com\/ask/);

  const def = buildNetworkAskPlan('What does RAUM mean?');
  assert.equal(def.hubs[0].hubId, 'investor');
  assert.equal(def.hubs[0].mode, 'definition');
});

test('Investor fail-closed: ranking, fees, stocks, bare digits, serving ≠ client geography', () => {
  for (const q of [
    'Which adviser will give me the best returns?',
    'Who is the best financial adviser?',
    'Which adviser is safest?',
    'Which adviser is most trustworthy?',
    'Which adviser has the lowest fees?',
    'Which RIA performs best?',
  ]) {
    const plan = buildNetworkAskPlan(q);
    assert.equal(plan.hubs[0].hubId, 'investor', q);
    assert.equal(plan.hubs[0].mode, 'fail_closed', q);
    assert.doesNotMatch(JSON.stringify(plan), /#1 adviser|trusted ranking/i);
  }

  const stocks = buildNetworkAskPlan('What stocks should I buy?');
  assert.equal(stocks.hubs[0].hubId, 'investor');
  assert.equal(stocks.hubs[0].mode, 'fail_closed');
  assert.match(stocks.hubs[0].whatItCanAnswer, /rather than recommending investments/i);

  const bare = buildNetworkAskPlan('166089');
  assert.equal(bare.parsed.identifier?.ambiguous, true);
  assert.ok(bare.hubs.every((h) => h.capabilityStatus === 'unsupported'));

  const serving = buildNetworkAskPlan('Show advisers serving Florida.');
  assert.equal(serving.hubs[0].hubId, 'investor');
  assert.equal(serving.hubs[0].capabilityStatus, 'execute');
  assert.match(serving.hubs[0].geographyCapability, /principal office/i);
  assert.doesNotMatch(serving.hubs[0].geographyCapability, /service territory is Florida/i);
});

test('buying a home in Broward is multi-hub', () => {
  const plan = buildNetworkAskPlan("I'm buying a home in Broward County. What should I research?");
  assert.equal(plan.intent, 'journey');
  assert.deepEqual(plan.hubs.map((h) => h.hubId), ['lender', 'insurance', 'contractor', 'move']);
  assert.equal(plan.placeLensHref, '/places/florida/broward');
  const answer = assembleNetworkAnswer(plan.query);
  assert.match(answer.hubCountLabel, /4 TrustHub research systems/);
});

test('place question opens Broward lens', () => {
  const parsed = parseNetworkAsk('What does TrustHub know about Broward?');
  assert.equal(parsed.intent, 'place');
  assert.equal(buildNetworkAskPlan(parsed.query).placeLensHref, '/places/florida/broward');
});

test('name check never confirms identity', () => {
  const result = runNameCheck('ABC Holdings');
  assert.equal(result.hubs.length, 6);
  assert.ok(result.hubs.every((h) => h.status !== 'confirmed_identifier_match'));
  assert.ok(result.hubs.some((h) => h.status === 'possible_name_appearance'));
  assert.ok(result.hubs.some((h) => h.status === 'not_currently_searchable'));
  assert.match(result.disclaimer, /does not establish that the records represent the same legal entity/);
});

test('coverage atlas: 6 hubs × 51 jurisdictions, categorical only', () => {
  const cells = coverageAtlasCells();
  assert.equal(US_JURISDICTIONS.length, 51);
  assert.equal(cells.length, 6 * 51);
  assert.equal(new Set(cells.map((c) => c.hubId)).size, 6);
  const counts = coverageCounts();
  assert.equal(counts.enhanced_county_intelligence, 0);
  assert.ok(counts.enhanced_state_intelligence >= 5);
  assert.equal(cellAt('contractor', 'FL')?.status, 'enhanced_state_intelligence');
  assert.equal(cellAt('contractor', 'NJ')?.status, 'state_research');
  assert.equal(cellAt('lender', 'CA')?.status, 'federal_core');
  assert.equal(cellAt('lender', 'CA')?.dedicatedPage, false);
  assert.equal(cellAt('investor', 'NY')?.status, 'basic_discovery');
  const blob = JSON.stringify(cells);
  assert.doesNotMatch(blob, /depth score|Trust Score/i);
});

test('place lens Florida / Broward / Palm Beach differences', () => {
  const fl = floridaPlaceLens();
  const br = browardPlaceLens();
  const pb = palmBeachPlaceLens();
  assert.equal(fl.hubs.length, 6);
  assert.equal(br.hubs.find((h) => h.hubId === 'contractor')?.capability, 'enhanced_county_intelligence');
  assert.equal(pb.hubs.find((h) => h.hubId === 'contractor')?.capability, 'enhanced_county_intelligence');
  assert.notEqual(br.hubs.find((h) => h.hubId === 'contractor')?.destination, pb.hubs.find((h) => h.hubId === 'contractor')?.destination);
  assert.equal(br.hubs.find((h) => h.hubId === 'lender')?.metrics.length, 0);
  assert.match(br.hubs.find((h) => h.hubId === 'lender')?.capabilityLabel ?? '', /county-specific intelligence not currently published/i);
  const browardRoof = br.hubs.find((h) => h.hubId === 'contractor')?.metrics.find((m) => /roofing/i.test(m.label));
  assert.equal(browardRoof?.value, '924');
  const pbRoof = pb.hubs.find((h) => h.hubId === 'contractor')?.metrics.find((m) => /roofing/i.test(m.label));
  assert.equal(pbRoof, undefined);
});

test('evidence atlas pricing/ownership honest', () => {
  assert.equal(evidenceAtlasCells().length, 6 * 14);
  assert.equal(evidenceCell('lender', 'pricing')?.status, 'planned');
  assert.match(evidenceCell('lender', 'pricing')?.why ?? '', /not currently available/i);
  assert.equal(evidenceCell('senior', 'ownership')?.status, 'partial');
  assert.equal(evidenceCell('investor', 'compensation')?.status, 'available');
  assert.doesNotMatch(JSON.stringify(evidenceAtlasCells()), /percent complete|quality score/i);
});

test('integrity: no SCORE step, no mega-count in answers', () => {
  assert.ok(!STANDARD_PIPELINE.some((s) => s.verb === 'SCORE'));
  const blob = JSON.stringify(assembleNetworkAnswer("I'm buying a home in Broward County. What should I research?"));
  assert.doesNotMatch(blob, /24 million|Trust Score|best county/i);
  assert.ok(IDENTIFIER_FAMILIES.some((f) => f.id === 'usdot' && f.live));
  assert.ok(IDENTIFIER_FAMILIES.some((f) => f.id === 'cms_ccn' && f.live));
  assert.ok(SPECIALIST_HUB_IDS.length === 6);
  const seniorTrace = assembleNetworkAnswer('Show nursing homes in Palm Beach County with 5 CMS overall stars.');
  assert.equal(seniorTrace.traces[0].hubId, 'senior');
  assert.equal(seniorTrace.traces[0].contract, 'senior-ask-v1');
  assert.equal(seniorTrace.traces[0].providerClass, 'Nursing Home');
  assert.match(seniorTrace.traces[0].specialistDestination, /seniortrusthub.com\/ask/);
});
