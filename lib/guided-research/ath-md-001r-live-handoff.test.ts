import test from 'node:test';
import assert from 'node:assert/strict';
import { orchestrateGuidedResearch } from './orchestrator.ts';
import { createGuidedSession } from './session.ts';

async function start(question: string) {
  return orchestrateGuidedResearch({action:{type:'START',question}});
}

test('SEC file handoff uses explicit state and preserves Investor grain', async () => {
  for (const [state, slug] of [['Maryland','maryland'],['Connecticut','connecticut'],['Michigan','michigan'],['Minnesota','minnesota']]) {
    const response = await start(`SEC 801-12345 ${state}`);
    assert.equal(response.session.hub,'investor');
    assert.equal(response.session.identifier?.type,'SEC');
    assert.match(response.session.nextAction ?? '',new RegExp(`InvestorTrustHub ${state}`));
    assert.equal(response.result?.destinations[0]?.href,`https://www.investortrusthub.com/${slug}`);
  }
  const unscoped=await start('SEC 801-12345');
  assert.equal(unscoped.session.hub,'investor');
  assert.equal(unscoped.session.identifier?.type,'SEC');
  assert.equal(unscoped.result?.destinations[0]?.href,'https://www.investortrusthub.com/ask');
  assert.doesNotMatch(unscoped.session.nextAction ?? '',/Michigan|Maryland/);
  const initial=createGuidedSession('SEC 801-12345 Maryland')!;
  assert.equal(initial.phase,'EXECUTE');
  const live=await orchestrateGuidedResearch({session:initial,action:{type:'EXECUTE'}});
  assert.equal(live.result?.destinations[0]?.href,'https://www.investortrusthub.com/maryland');
});

test('Maryland assisted living uses statewide Senior handoff, including city context', async () => {
  for(const question of ['assisted living Maryland','assisted living Baltimore Maryland']) {
    const response=await start(question);
    assert.equal(response.session.hub,'senior');
    assert.equal(response.session.entityClass,'assisted_living');
    assert.equal(response.session.phase,'DEEP_LINK');
    assert.equal(response.result?.destinations[0]?.href,'https://www.seniortrusthub.com/maryland');
    assert.doesNotMatch(JSON.stringify(response),/unexecutable local scope|requested local scope is not executable/i);
    assert.equal(response.result?.executionOccurred,false);
    const initial=createGuidedSession(question)!;
    assert.equal(initial.phase,'EXECUTE');
    const live=await orchestrateGuidedResearch({session:initial,action:{type:'EXECUTE'}});
    assert.equal(live.result?.destinations[0]?.href,'https://www.seniortrusthub.com/maryland');
  }
  const memory=await start('memory care Maryland');
  assert.equal(memory.session.hub,'senior');
  assert.notEqual(memory.session.entityClass,'assisted_living');
  assert.equal(memory.result?.destinations.length ?? 0,0);
  assert.equal((await start('nursing home Maryland')).session.hub,'senior');
  assert.equal((await start('CCN 015001 Maryland')).session.identifier?.type,'CCN');
});

test('unlabeled numbers and ranking requests remain non-executable', async () => {
  await assert.rejects(start('1234567'),/not_guided_query/);
  for(const question of ['best Maryland mover','AggregateRating Maryland lender','most trustworthy Maryland contractor']) {
    const response=await start(question);
    assert.notEqual(response.session.phase,'REFINE');
    assert.equal(response.result?.executionOccurred ?? false,false);
  }
});
