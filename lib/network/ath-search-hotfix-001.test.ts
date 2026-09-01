import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { test } from 'node:test';
import homeFingerprint from '../../data/network-intelligence/homepage-fingerprint-v1.json' with { type: 'json' };
import networkFingerprints from '../../data/network-intelligence/fingerprints-v1.json' with { type: 'json' };
import { assembleNetworkAnswer, buildNetworkAskPlan } from './ask-plan.ts';
import { HUB_CAPABILITY_CONTRACTS } from './hub-capability-contract.ts';
import { isAutoTransportQuery } from './move-ask.ts';

const positives: Array<[string, string | undefined]> = [
  ['auto transport carrier', 'carrier'],
  ['auto transport broker', 'broker'],
  ['auto transport carrier broker', 'carrier_broker'],
  ['auto transport companies', undefined],
  ['vehicle transport', undefined],
  ['vehicle transporter', undefined],
  ['car shipping companies', undefined],
  ['car carrier', 'carrier'],
  ['ship my car', undefined],
  ['transport my vehicle', undefined],
  ['I need someone to ship my car', undefined],
  ['Who can transport my vehicle?', undefined],
  ['I need an auto transport broker', 'broker'],
  ['show me auto transport carriers', 'carrier'],
  ['how do I research a car carrier?', 'carrier'],
  ['What should I check before shipping my car?', undefined],
];

test('bounded Auto Transport vocabulary routes to Move with category and role kept separate', () => {
  for (const [query, role] of positives) {
    assert.equal(isAutoTransportQuery(query), true, query);
    const plan = buildNetworkAskPlan(query);
    assert.deepEqual(plan.hubs.map((hub) => hub.hubId), ['move'], query);
    assert.equal(plan.parsed.moveResearchCategory, 'auto_transport', query);
    assert.equal(plan.parsed.moveRegulatoryRole, role, query);
    assert.equal(plan.hubs[0].capabilityStatus, 'handoff', query);
    assert.equal(plan.hubs[0].structuredFilters?.researchCategory, 'auto_transport', query);
    assert.equal(assembleNetworkAnswer(query).resultClass, 'HANDOFF', query);
  }
});

test('handoff is useful, explicit, source-owned, and never fabricates a cohort', () => {
  const answer = assembleNetworkAnswer('auto transport carrier');
  const hub = answer.plan.hubs[0];
  assert.match(hub.preview?.headline ?? '', /Auto Transport research.*Carrier/i);
  assert.match(hub.reason, /MoveTrustHub owns.*Ask does not construct or claim this cohort/i);
  assert.match(hub.destination ?? '', /^https:\/\/www\.movetrusthub\.com\/companies$/);
  assert.match(hub.preview?.grain ?? '', /handoff.*no Auto Transport cohort executed/i);
  assert.match(hub.preview?.limitation ?? '', /specific vehicle|service territory/i);
  assert.equal(answer.options, undefined);
  assert.equal(answer.diagnostics.resultCount, 0);
  assert.equal(answer.diagnostics.fallbackPath, 'specialist_handoff');
  assert.equal(answer.traces[0].contract, undefined);
  assert.match(answer.traces[0].sourceFamily, /public research handoff/i);
  assert.ok(answer.interpretation.some((row) => row.label === 'Research topic' && row.value === 'Auto transport'));
  assert.ok(answer.interpretation.some((row) => row.label === 'Regulatory role' && row.value === 'Carrier'));
});

test('insurance language wins and generic carrier remains ambiguous', () => {
  for (const query of ['auto insurance carrier', 'car insurance company', 'vehicle insurance', 'auto insurer', 'car insurance broker', 'insurance carrier', 'home insurance carrier', 'life insurance carrier']) {
    assert.equal(isAutoTransportQuery(query), false, query);
    assert.equal(buildNetworkAskPlan(query).hubs[0]?.hubId, 'insurance', query);
  }
  const generic = buildNetworkAskPlan('carrier');
  assert.equal(generic.hubs.length, 0);
  assert.match(generic.parsed.topic, /ambiguous/i);
  assert.equal(assembleNetworkAnswer('carrier').resultClass, 'UNSUPPORTED_QUERY');
});

test('unrelated carrier and transport concepts do not become Move Auto Transport', () => {
  for (const query of ['air carrier', 'airline carrier', 'shipping carrier tracking', 'FedEx shipment', 'package carrier', 'cell phone carrier', 'wireless carrier', 'data carrier', 'medical transport', 'public transportation']) {
    assert.equal(isAutoTransportQuery(query), false, query);
    assert.notEqual(buildNetworkAskPlan(query).parsed.moveResearchCategory, 'auto_transport', query);
  }
});

test('ranking and pricing bait understand the domain but remain neutral handoffs', () => {
  for (const query of ['best auto transport companies', 'top auto transport companies', 'safest car shipping company']) {
    const answer = assembleNetworkAnswer(query);
    assert.equal(answer.resultClass, 'HANDOFF');
    assert.match(answer.judgmentNote ?? '', /does not rank/i);
    assert.equal(answer.options, undefined);
  }
  for (const query of ['cheap auto transport', 'cheapest car shipping', 'auto transport quote', 'how much to ship my car']) {
    const answer = assembleNetworkAnswer(query);
    assert.equal(answer.resultClass, 'HANDOFF');
    assert.match(answer.judgmentNote ?? '', /do not provide live.*quotes|price rankings/i);
    assert.equal(answer.options, undefined);
  }
});

test('broker, geography, authority, ranking, paid-order, and score firewalls remain explicit', () => {
  const broker = assembleNetworkAnswer('auto transport broker');
  assert.match(broker.limitation ?? '', /broker may arrange|without physically hauling/i);
  const serialized = JSON.stringify([...positives.map(([q]) => assembleNetworkAnswer(q)), broker]);
  assert.doesNotMatch(serialized, /serves nationwide|approved by TrustHub|verified quality|recommended branch|paid boost|universal Trust Score/i);
});

test('accepted prior search goldens retain their hub and safety outcomes', () => {
  const expected: Array<[string, string | undefined]> = [
    ['USDOT 3244649', 'move'], ['MC 1019808', 'move'], ['SHIFL', 'move'],
    ['two men and a truck', 'move'], ['Sunshine State Movers', 'move'],
    ['College Hunks', 'move'], ['Colleg Hunks', 'move'],
    ['roofing contractors in Broward', 'contractor'], ['CRD 166089', 'investor'],
    ['NPN 10391484', 'insurance'], ['CMS CCN 105502', 'senior'],
  ];
  for (const [query, hub] of expected) assert.equal(buildNetworkAskPlan(query).hubs[0]?.hubId, hub, query);
  assert.equal(assembleNetworkAnswer('compare a mover, lender and contractor in one universal score').resultClass, 'UNSUPPORTED_QUERY');
});

test('capability describes a handoff rather than a canonical Auto Transport resolver', () => {
  assert.ok(HUB_CAPABILITY_CONTRACTS.move.filters.includes('auto_transport_handoff'));
  assert.match(HUB_CAPABILITY_CONTRACTS.move.publicationSemantics, /specialist handoff, not an Ask-owned cohort/i);
});

test('homepage, network intelligence, and zero-write locks remain unchanged', () => {
  assert.equal(homeFingerprint['ask-home-intel-v1'], 'c0a898c5be52197362c6118e9833e1c04c8bd81838ba4e45c2f5a5315353a02f');
  assert.equal(networkFingerprints['ask-network-intel-v1'], '834dadcfa800e84914cb0e328f21234f42d7a7314c29d497f801dab2e8d202e1');
  assert.equal(process.env.ATH_SEARCH_HOTFIX_DB_WRITES ?? '0', '0');
});

test('parser overhead remains negligible for required routing fixtures', () => {
  const queries = ['auto transport carrier', 'auto transport broker', 'car shipping companies', 'ship my car', 'auto insurance carrier', 'carrier'];
  const samples: number[] = [];
  for (let round = 0; round < 200; round += 1) for (const query of queries) {
    const started = performance.now(); buildNetworkAskPlan(query); samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  assert.ok(samples[Math.floor(samples.length * 0.95)] < 5, `p95=${samples[Math.floor(samples.length * 0.95)]}ms`);
});
