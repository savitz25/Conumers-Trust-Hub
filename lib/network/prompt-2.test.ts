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

test('capability registry: lender Ask is not live; contractor Ask is live', () => {
  assert.equal(HUB_CAPABILITY_REGISTRY.lender.askStatus, 'planned');
  assert.equal(HUB_CAPABILITY_REGISTRY.contractor.askStatus, 'live');
  assert.equal(HUB_CAPABILITY_REGISTRY.contractor.federatedExecution, 'execute');
  assert.equal(HUB_CAPABILITY_REGISTRY.move.identifierLookup, 'live');
  assert.equal(HUB_CAPABILITY_REGISTRY.insurance.identifierLookup, 'planned');
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
  assert.equal(parseNetworkAsk('NPN 1234567').identifier?.family.live, false);
  assert.equal(parseNetworkAsk('CBC015082').identifier?.family.id, 'state_contractor_license');
  const ccn = parseNetworkAsk('CCN 105502');
  assert.equal(ccn.identifier?.family.id, 'cms_ccn');
  assert.equal(ccn.identifier?.family.live, false);
  const bare = parseNetworkAsk('123456');
  assert.equal(bare.identifier?.ambiguous, true);
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
  assert.ok(SPECIALIST_HUB_IDS.length === 6);
});
