import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildAskResearchRoute } from './ask-research-route.ts';

const cases = [
  ['I need a roofer in Broward County.', 'contractor'],
  ['Find mover USDOT 3244649.', 'move'],
  ['Research lender NMLS 3030.', 'lender'],
  ['Find nursing homes in Palm Beach County.', 'senior'],
  ['Check insurance NPN 10391484.', 'insurance'],
  ['Research adviser CRD 105958.', 'investor'],
] as const;

test('all six specialists receive an intent-preserving canonical /ask destination', () => {
  for (const [question, hub] of cases) {
    const route = buildAskResearchRoute(question);
    assert.equal(route.plan.primaryHub, hub);
    const specialistAsk = route.destinations.find((row) => new URL(row.href).pathname === '/ask');
    assert.ok(specialistAsk, `${hub} canonical /ask destination missing`);
    const url = new URL(specialistAsk.href);
    assert.equal(url.pathname, '/ask');
    assert.equal(url.searchParams.get('q'), question);
  }
});

test('legacy precision utilities remain secondary and never replace Specialist Search V1', () => {
  const contractor = buildAskResearchRoute('Check contractor license CCC1332036.');
  assert.equal(contractor.destinations[0]?.id, 'contractor.verify');
  assert.ok(contractor.destinations.some((row) => row.id === 'contractor.verify'));
  const investor = buildAskResearchRoute('How do I verify an investment adviser?');
  assert.equal(investor.destinations[0]?.id, 'investor.firms');
  assert.ok(investor.destinations.some((row) => row.id === 'investor.ask'));
  assert.ok(investor.destinations.some((row) => row.id === 'investor.firms'));
});

test('handoff URLs are HTTPS production origins and contain no private routing state', () => {
  for (const [question] of cases) {
    const route = buildAskResearchRoute(question);
    const destination = route.destinations.find((row) => new URL(row.href).pathname === '/ask')!;
    const url = new URL(destination.href);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.pathname, '/ask');
    assert.deepEqual([...url.searchParams.keys()], ['q']);
    assert.doesNotMatch(destination.href, /localhost|vercel\.app|token|email|user_id/i);
  }
});
