import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createGuidedSession, validateGuidedSession } from './session.ts';
import { orchestrateGuidedResearch } from './orchestrator.ts';
import { planAskResearch } from '../network/research-planner.ts';

const originalFetch = globalThis.fetch;
const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
globalThis.fetch = (async (input, init) => {
  const url = String(input);
  const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
  calls.push({ url, body });
  if (url.includes('movetrusthub.com')) return new Response(JSON.stringify({
    contract: 'trusthub-specialist-execution-v2', resultType: 'ZERO_MATCHING_ROWS', rows: [], total: 0,
    destinations: { verifyDot: 'https://www.movetrusthub.com/verify-dot' },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
  return new Response('{}', { status: 503, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;
test.after(() => { globalThis.fetch = originalFetch; });

test('Ask UI START/RESUME execution retains labeled USDOT and MC over category words', async () => {
  assert.match(readFileSync('app/ask/page.tsx', 'utf8'), /createGuidedSession\(query\)/);
  assert.match(readFileSync('app/api/guided-research/route.ts', 'utf8'), /orchestrateGuidedResearch\(body\)/);
  for (const [question, type, value] of [
    ['USDOT 1234567 Michigan insurance', 'USDOT', '1234567'],
    ['USDOT 1234567 Michigan lender', 'USDOT', '1234567'],
    ['DOT 1234567 Michigan insurance', 'USDOT', '1234567'],
    ['USDOT 1234567 contractor', 'USDOT', '1234567'],
    ['MC 123456 Michigan insurance', 'MC', '123456'],
    ['find USDOT 1234567 in Michigan', 'USDOT', '1234567'],
    ['verify MC 123456 Michigan', 'MC', '123456'],
  ] as const) {
    calls.length = 0;
    const initial = createGuidedSession(question);
    assert.equal(initial?.hub, 'move', question);
    assert.equal(initial?.moveMode, 'identifier', question);
    assert.equal(initial?.queryType, 'EXACT_IDENTIFIER', question);
    assert.deepEqual(initial?.identifier, { type, value }, question);
    assert.equal(initial?.insuranceEntityClass, undefined, question);
    const started = await orchestrateGuidedResearch(JSON.parse(JSON.stringify({ action: { type: 'START', question } })));
    assert.equal(started.session.hub, 'move', question);
    assert.equal(started.result?.specialist, 'move', question);
    assert.notEqual(started.result?.error?.code, 'execution_not_authorized', question);
    assert.equal(started.diagnostics.specialistCalls, 1, question);
    assert.equal(calls.length, 1, question);
    assert.match(calls[0].url, /movetrusthub\.com/, question);
    assert.deepEqual(calls[0].body.identifier, { type, value }, question);
    assert.equal(calls[0].body.queryType, 'identifier', question);
    assert.ok(validateGuidedSession(JSON.parse(JSON.stringify(started.session))), question);
    const resumed = await orchestrateGuidedResearch(JSON.parse(JSON.stringify({ session: started.session, action: { type: 'RESUME' } })));
    assert.equal(resumed.session.hub, 'move', question);
    assert.notEqual(resumed.result?.error?.code, 'execution_not_authorized', question);
  }
});

test('other explicit identifier families retain their authoritative specialist', async () => {
  for (const [question, hub, type] of [
    ['NMLS 3030 Michigan mover', 'lender', 'NMLS'],
    ['NAIC 10064 Michigan mover', 'insurance', 'NAIC'],
    ['NPN 20000635 Michigan lender', 'insurance', 'NPN'],
    ['CCN 105502 Michigan insurance', 'senior', 'CCN'],
    ['CRD 166089 Michigan mover', 'investor', 'CRD'],
  ] as const) {
    calls.length = 0;
    const session = createGuidedSession(question);
    assert.equal(session?.hub, hub, question);
    assert.equal(session?.identifier?.type, type, question);
    const response = await orchestrateGuidedResearch({ action: { type: 'START', question } });
    assert.equal(response.session.hub, hub, question);
    assert.notEqual(response.result?.error?.code, 'execution_not_authorized', question);
    if (session?.executionScope.executionAllowed) {
      assert.equal(calls.length, 1, question);
      assert.match(calls[0].url, new RegExp(`${hub}trusthub\\.com`), question);
    } else {
      assert.equal(calls.length, 0, question);
    }
  }
  const sec = createGuidedSession('SEC file 801-12345 Michigan mover');
  assert.equal(sec?.hub, 'investor');
  assert.equal(sec?.identifier?.value, '801-12345');
  assert.equal(sec?.phase, 'CLARIFY');
  assert.match(sec?.nextAction ?? '', /not treat it as a CRD/);
});

test('bare numbers and Michigan ranking requests remain non-executable', async () => {
  calls.length = 0;
  const bare = createGuidedSession('1234567 Michigan');
  assert.equal(bare?.identifier, undefined);
  assert.notEqual(bare?.phase, 'EXECUTE');
  for (const question of ['best Michigan contractor', 'AggregateRating Michigan lender', 'most trustworthy Michigan mover']) {
    assert.equal(planAskResearch(question).executionAllowed, false, question);
    const response = await orchestrateGuidedResearch({ action: { type: 'START', question } });
    assert.equal(response.diagnostics.specialistCalls, 0, question);
  }
  assert.equal(calls.length, 0);
  const multi = createGuidedSession('electrician mortgage lender New Jersey');
  assert.equal(multi?.hub, undefined);
  assert.deepEqual(multi?.missingFields, ['hub']);
  const explicitSecondTask = createGuidedSession('Research USDOT 1234567 and also find insurance agencies in Michigan');
  assert.equal(explicitSecondTask?.hub, undefined);
  assert.deepEqual(explicitSecondTask?.missingFields, ['hub']);
  assert.deepEqual(explicitSecondTask?.availableChoices.map(choice => choice.value), ['hub:move', 'hub:insurance']);
  const multiStart = await orchestrateGuidedResearch({action:{type:'START',question:'Research USDOT 1234567 and also find insurance agencies in Michigan'}});
  const selectedMove = await orchestrateGuidedResearch({session:multiStart.session,action:{type:'SELECT_CHOICE',value:'hub:move'}});
  assert.equal(selectedMove.session.hub, 'move');
  assert.notEqual(selectedMove.result?.error?.code, 'execution_not_authorized');
});
