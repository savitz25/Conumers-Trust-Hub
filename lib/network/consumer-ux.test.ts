import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assembleNetworkAnswer, buildNetworkAskPlan } from './ask-plan.ts';
import {
  applyConsumerPresentation,
  optionsFromInsurancePayload,
  optionsFromInvestorPayload,
  optionsFromLenderPayload,
  optionsFromMovePayload,
  parseContractorAskHtml,
  stripJudgmentModifiers,
} from './consumer-ask.ts';

test('1. best mover in tampa bay florida: Move execute, soft-fail, no fail_closed stop', () => {
  const q = 'best mover in tampa bay florida';
  const plan = buildNetworkAskPlan(q);
  assert.deepEqual(plan.hubs.map((h) => h.hubId), ['move']);
  assert.equal(plan.hubs[0].capabilityStatus, 'execute');
  assert.notEqual(plan.hubs[0].mode, 'fail_closed');
  assert.equal(plan.hubs[0].failKind, 'soft');
  assert.match(plan.hubs[0].judgmentNote ?? '', /does not designate a single mover as “best.”/i);
  assert.match(plan.hubs[0].searchQuery ?? '', /household-goods carriers headquartered in Florida/i);
  assert.doesNotMatch(plan.parsed.topic, /Network research routing/i);
  assert.equal(plan.parsed.geography?.city, 'Tampa');
  const blob = JSON.stringify(assembleNetworkAnswer(q));
  assert.doesNotMatch(blob, /Trust Score|best mover is/i);
});

test('2. top investment companies with best performance: Investor execute, no invented returns', () => {
  const q = 'top investment companies with best performance';
  const plan = buildNetworkAskPlan(q);
  assert.deepEqual(plan.hubs.map((h) => h.hubId), ['investor']);
  assert.equal(plan.hubs[0].capabilityStatus, 'execute');
  assert.notEqual(plan.hubs[0].mode, 'fail_closed');
  assert.equal(plan.hubs[0].failKind, 'soft');
  assert.match(plan.hubs[0].judgmentNote ?? '', /client-return|not performance/i);
  assert.match(plan.hubs[0].searchQuery ?? '', /SEC-registered RIAs/i);
  const blob = JSON.stringify(assembleNetworkAnswer(q));
  assert.doesNotMatch(blob, /best returns|#1 adviser|Trust Score/i);
});

test('3. grandmother in New Jersey: Senior execute, no Network research routing', () => {
  const q = 'need good place for my grandmother in new jersey';
  const plan = buildNetworkAskPlan(q);
  assert.deepEqual(plan.hubs.map((h) => h.hubId), ['senior']);
  assert.equal(plan.hubs[0].capabilityStatus, 'execute');
  assert.notEqual(plan.hubs[0].mode, 'fail_closed');
  assert.equal(plan.parsed.geography?.stateCode, 'NJ');
  assert.doesNotMatch(plan.parsed.topic, /Network research routing/i);
  assert.match(plan.parsed.topic, /Senior-care/i);
  assert.ok(plan.hubs[0].followUp);
  assert.match(plan.hubs[0].searchQuery ?? '', /nursing homes in New Jersey/i);
  const answer = assembleNetworkAnswer(q);
  assert.doesNotMatch(JSON.stringify(answer), /Network research routing/);
});

test('4. most trustworthy insurance agencies in miami: Insurance execute, decline ranking', () => {
  const q = 'most trustworthy insurance agencies in miami';
  const plan = buildNetworkAskPlan(q);
  assert.deepEqual(plan.hubs.map((h) => h.hubId), ['insurance']);
  assert.equal(plan.hubs[0].capabilityStatus, 'execute');
  assert.notEqual(plan.hubs[0].mode, 'fail_closed');
  assert.equal(plan.hubs[0].failKind, 'soft');
  assert.match(plan.hubs[0].judgmentNote ?? '', /does not rank/i);
  assert.match(plan.hubs[0].searchQuery ?? '', /insurance agencies credentialed in Florida/i);
  assert.equal(plan.parsed.geography?.city, 'Miami');
  assert.match(plan.hubs[0].geographyCapability, /credential jurisdiction|not service territory/i);
});

test('5. best mortgage lender in florida: Lender execute, no best-lender claim', () => {
  const q = 'best mortgage lender in florida';
  const plan = buildNetworkAskPlan(q);
  assert.deepEqual(plan.hubs.map((h) => h.hubId), ['lender']);
  assert.equal(plan.hubs[0].capabilityStatus, 'execute');
  assert.notEqual(plan.hubs[0].mode, 'fail_closed');
  assert.equal(plan.hubs[0].failKind, 'soft');
  assert.match(plan.hubs[0].judgmentNote ?? '', /does not rank lenders/i);
  assert.match(plan.hubs[0].searchQuery ?? '', /originated the most mortgages in Florida/i);
  assert.doesNotMatch(JSON.stringify(plan), /best lender|#1 lender|Trust Score/i);
});

test('6. good roofing contractor in broward: Contractor execute, no endorsement', () => {
  const q = 'good roofing contractor in broward';
  const plan = buildNetworkAskPlan(q);
  assert.deepEqual(plan.hubs.map((h) => h.hubId), ['contractor']);
  assert.equal(plan.hubs[0].capabilityStatus, 'execute');
  assert.notEqual(plan.hubs[0].mode, 'fail_closed');
  assert.equal(plan.hubs[0].failKind, 'soft');
  assert.match(plan.hubs[0].judgmentNote ?? '', /does not recommend whom to hire|credential is not a ranking/i);
  assert.equal(plan.parsed.trade, 'Roofing');
  assert.equal(plan.parsed.geography?.countySlug, 'broward');
  assert.match(plan.hubs[0].destination ?? '', /contractortrusthub.com\/ask/);
  assert.doesNotMatch(JSON.stringify(plan), /best roofer|#1 contractor|Trust Score/i);
  assert.match(plan.hubs[0].preview?.grain ?? '', /not “trusted roofers.”/i);
});

test('hard fail remains for rates tomorrow and hire recommendations', () => {
  const rates = buildNetworkAskPlan('What will mortgage rates be tomorrow?');
  assert.ok(rates.hubs[0]);
  assert.equal(rates.hubs[0].mode, 'fail_closed');
  assert.equal(rates.hubs[0].failKind, 'hard');

  const hire = buildNetworkAskPlan('Should I hire this contractor?');
  assert.equal(hire.hubs[0].hubId, 'contractor');
  assert.equal(hire.hubs[0].mode, 'fail_closed');
});

test('option mappers return real identity fields, not rankings', () => {
  const movers = optionsFromMovePayload({
    contract: 'move-ask-v1',
    results: [
      {
        name: '1776 MOVING AND STORAGE INC',
        usdot: '2303737',
        mc: '1202526',
        role: 'Carrier',
        whyMatched: 'Indexed as a carrier with FL headquarters.',
      },
    ],
  });
  assert.equal(movers[0].name, '1776 MOVING AND STORAGE INC');
  assert.ok(movers[0].fields.some((f) => f.label === 'USDOT'));

  const firms = optionsFromInvestorPayload({
    results: [{ firmName: 'Example RIA', crd: '160657', firmType: 'ria', raum: '$393.4 million' }],
  });
  assert.equal(firms[0].hubId, 'investor');
  assert.ok(firms[0].fields.some((f) => /RAUM/.test(f.label)));

  const agencies = optionsFromInsurancePayload({
    results: [{ name: 'Example Agency', npn: '10391484', entityClass: 'agency', credentialJurisdiction: 'FL' }],
  });
  assert.equal(agencies[0].fields.find((f) => f.label === 'NPN')?.value, '10391484');

  const lenders = optionsFromLenderPayload({
    rows: [{ displayName: 'United Wholesale Mortgage', metric: 49897, lei: '549300HW662MN1WU8550', identityStatus: 'public_profile' }],
  });
  assert.equal(lenders[0].name, 'United Wholesale Mortgage');
  assert.doesNotMatch(JSON.stringify(lenders), /Trust Score/);
});

test('contractor public Ask HTML parser extracts names and credentials', () => {
  const html = `
    <article class="cth-intel-card space-y-3">
      <h3 class="text-lg font-semibold text-[var(--text)]">123 ROOFING, INC.</h3>
      <p><span class="font-medium text-[var(--text)]">RC29027885</span> — Registered Roofing Contractor</p>
      <ul aria-label="Result facts"><li class="rounded-full bg-[var(--bg)] px-2.5 py-1 text-xs">Active/current in indexed DBPR record</li></ul>
      <details><summary>Why this matched</summary><p class="mt-2">Indexed Florida DBPR credential record.</p></details>
      <a href="/contractors/rc29027885-123-roofing-inc">View research report</a>
    </article>`;
  const options = parseContractorAskHtml(html);
  assert.equal(options[0].name, '123 ROOFING, INC.');
  assert.equal(options[0].fields.find((f) => f.label === 'Credential')?.value, 'RC29027885');
  assert.match(options[0].href, /contractortrusthub.com\/contractors\//);
  assert.equal(options[0].destination.publicationState, 'public_profile');
});

test('stripJudgmentModifiers leaves the supported search intact', () => {
  assert.match(stripJudgmentModifiers('best mover in tampa bay florida'), /mover in tampa bay florida/i);
  assert.doesNotMatch(stripJudgmentModifiers('top investment companies with best performance'), /best performance/i);
});

test('hard safety rules still stop the search', () => {
  const serving = buildNetworkAskPlan('Show movers serving Palm Beach County.');
  assert.equal(serving.hubs[0].mode, 'fail_closed');
  const combined = buildNetworkAskPlan('How many senior providers are there?');
  assert.equal(combined.hubs[0].mode, 'fail_closed');
  const stocks = buildNetworkAskPlan('What stocks should I buy?');
  assert.equal(stocks.hubs[0].mode, 'fail_closed');
});

test('applyConsumerPresentation does not invent a ranking', () => {
  const plan = buildNetworkAskPlan('best mover in tampa bay florida');
  const hub = applyConsumerPresentation(plan.hubs[0], plan.parsed);
  assert.equal(hub.failKind, 'soft');
  assert.doesNotMatch(hub.judgmentNote ?? '', /#1|Trust Score/);
});
