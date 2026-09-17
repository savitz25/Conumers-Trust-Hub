/**
 * ATH-SEARCH-P0-001 / SQA-001 — live `/ask` securities-advice intent gate.
 *
 * Covers buildAskResearchRoute (the live `/ask` path). Legacy buildNetworkAskPlan-only
 * tests do not exercise HOME_BUYING journey scatter on current Ask SSR.
 *
 *   node --experimental-strip-types --test lib/network/ath-search-p0-001.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createGuidedSession } from '../guided-research/session.ts';
import { buildAskResearchRoute } from './ask-research-route.ts';
import {
  isUnsupportedSecuritiesAdviceQuery,
  UNSUPPORTED_SECURITIES_ADVICE_STATUS,
} from './investor-ask.ts';

const categoryB = [
  'what stock should I buy',
  'which stocks should I invest in',
  'recommend a stock to buy today',
  'which ETF is best?',
  'should I sell Tesla?',
  'give me three stocks likely to outperform',
  'where should I invest $10,000?',
  'best stocks right now',
  'should I sell Apple?',
  'where should I invest $20,000?',
  'give me three ETFs for retirement',
] as const;

const categoryA = [
  'Look up CRD 166089',
  'Look up CRD 123456',
  'Research this investment adviser',
  'Does this adviser have disciplinary disclosures?',
  'Find the SEC/IARD record for a firm',
  'look up an investment adviser',
  'How do I verify an investment adviser?',
  'How do I check if an advisor is registered?',
  'What should I read on Form ADV?',
] as const;

const ambiguous = [
  'I need an investment adviser',
  'Who can help me invest?',
  'Research investment advisers in Florida',
  'Tell me about Vanguard',
] as const;

const housingJourneys = [
  "I'm buying a home in Broward County. What should I research?",
  "I'm moving from New Jersey to Florida and buying a house.",
] as const;

function assertHardGate(query: string) {
  const route = buildAskResearchRoute(query);
  assert.equal(isUnsupportedSecuritiesAdviceQuery(query), true, query);
  assert.equal(route.journey ?? null, null, `${query} must not become a multi-hub journey`);
  assert.ok(route.plan.reasonCodes.includes('UNSUPPORTED_SECURITIES_ADVICE'), query);
  assert.equal(route.plan.intent, 'RECOMMENDATION_REQUEST', query);
  assert.equal(route.plan.primaryHub, 'investor', query);
  assert.equal(route.canExecute, false, query);
  assert.equal(route.plan.executionAllowed, false, query);
  assert.equal(route.status, UNSUPPORTED_SECURITIES_ADVICE_STATUS, query);
  assert.match(route.explanation, /rather than recommending investments/i, query);
  assert.doesNotMatch(route.explanation, /Loan Estimate|NPN|USDOT|contractor/i, query);
  assert.ok(
    route.destinations.every((d) => d.hub === 'investor' || d.owner === 'OFFICIAL'),
    `${query} destinations must stay Investor-registration-only`,
  );
  assert.ok(
    route.destinations.every((d) => {
      try {
        const url = new URL(d.href);
        return url.searchParams.get('q') !== query;
      } catch {
        return true;
      }
    }),
    `${query} must not be forwarded as a specialist search`,
  );
  assert.ok(
    !route.destinations.some((d) => /lendertrusthub|insurancetrusthub|contractortrusthub|movetrusthub/i.test(d.href)),
    query,
  );
  const guided = createGuidedSession(query);
  assert.notEqual(guided?.nextAction, 'execute', query);
  assert.notEqual(guided?.phase, 'EXECUTE', query);
}

test('ATH-SEARCH-P0-001 Category B: live /ask hard-gates securities advice before journey/provider execution', () => {
  for (const query of categoryB) assertHardGate(query);
});

test('ATH-SEARCH-P0-001 original SQA-001 query is not HOME_BUYING lender+insurance scatter', () => {
  const route = buildAskResearchRoute('what stock should I buy');
  assert.equal(route.journey, undefined);
  assert.deepEqual(route.plan.candidateHubs, ['investor']);
  assert.doesNotMatch(JSON.stringify(route), /loan-estimate-analyzer|insurancetrusthub\.com\/ask/i);
});

test('ATH-SEARCH-P0-001 Category A: InvestorTrustHub research still works on live /ask', () => {
  for (const query of categoryA) {
    const route = buildAskResearchRoute(query);
    assert.equal(isUnsupportedSecuritiesAdviceQuery(query), false, query);
    assert.ok(!route.plan.reasonCodes.includes('UNSUPPORTED_SECURITIES_ADVICE'), query);
    assert.equal(route.plan.primaryHub, 'investor', query);
    assert.equal(route.journey, undefined, query);
    assert.notEqual(route.status, UNSUPPORTED_SECURITIES_ADVICE_STATUS, query);
    assert.ok(route.hubLabel === 'InvestorTrustHub' || route.plan.primaryHub === 'investor', query);
  }
  const crd = buildAskResearchRoute('Look up CRD 166089');
  assert.equal(crd.plan.intent, 'IDENTIFIER_LOOKUP');
  assert.equal(crd.canExecute, true);
  assert.ok(crd.destinations.some((d) => d.id === 'investor.ask' || d.id === 'official.iapd'));
  const formAdv = buildAskResearchRoute('What should I read on Form ADV?');
  assert.equal(formAdv.plan.intent, 'HOW_TO');
  assert.equal(formAdv.plan.primaryHub, 'investor');
});

test('ATH-SEARCH-P0-001 ambiguous boundary retains Investor research, not Category B dump', () => {
  for (const query of ambiguous) {
    const route = buildAskResearchRoute(query);
    assert.equal(isUnsupportedSecuritiesAdviceQuery(query), false, query);
    assert.ok(!route.plan.reasonCodes.includes('UNSUPPORTED_SECURITIES_ADVICE'), query);
    assert.notEqual(route.journey?.journeyType, 'HOME_BUYING', query);
    assert.notEqual(route.status, UNSUPPORTED_SECURITIES_ADVICE_STATUS, query);
  }
  const adviser = buildAskResearchRoute('I need an investment adviser');
  assert.equal(adviser.plan.primaryHub, 'investor');
  assert.equal(adviser.journey, undefined);
  const help = buildAskResearchRoute('Who can help me invest?');
  assert.equal(help.plan.primaryHub, 'investor');
  assert.ok(!help.plan.reasonCodes.includes('UNSUPPORTED_SECURITIES_ADVICE'));
  assert.notEqual(help.plan.intent, 'ENTITY_LOOKUP');
  assert.equal(help.plan.entityName, undefined);
  const florida = buildAskResearchRoute('Research investment advisers in Florida');
  assert.equal(florida.plan.primaryHub, 'investor');
  assert.ok(['COHORT_BROWSE', 'ENTITY_LOOKUP', 'HOW_TO'].includes(florida.plan.intent));
});

test('ATH-SEARCH-P0-001 housing buy journeys remain HOME_BUYING', () => {
  for (const query of housingJourneys) {
    const route = buildAskResearchRoute(query);
    assert.equal(isUnsupportedSecuritiesAdviceQuery(query), false, query);
    assert.ok(route.journey, query);
    assert.ok(['HOME_BUYING', 'MOVE_AND_BUY'].includes(route.journey!.journeyType), query);
  }
});

test('ATH-SEARCH-P0-001 detector is intent-based, not a bare invest/stock keyword dump', () => {
  for (const query of [
    'I want to research an investment adviser before I hire them.',
    'Show Florida RIAs reporting between $1 billion and $10 billion RAUM.',
    'best advisor florida',
    'should I buy a house',
    'I need to refinance my house in Florida.',
  ]) {
    assert.equal(isUnsupportedSecuritiesAdviceQuery(query), false, query);
  }
});

test('ATH-SEARCH-P0-001 live /ask still plans through buildAskResearchRoute before guided/network execute', () => {
  const page = readFileSync(new URL('../../app/ask/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /buildAskResearchRoute\(query\)/);
  assert.match(page, /UNSUPPORTED_SECURITIES_ADVICE/);
  assert.match(page, /refuseSecuritiesAdvice/);
  const routeSource = readFileSync(new URL('./ask-research-route.ts', import.meta.url), 'utf8');
  assert.match(routeSource, /planAskResearch\(question\)/);
  assert.match(routeSource, /planAskMultiHubJourney/);
  assert.match(routeSource, /UNSUPPORTED_SECURITIES_ADVICE/);
});
