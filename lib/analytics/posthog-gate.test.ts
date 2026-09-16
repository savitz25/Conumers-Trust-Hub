import assert from 'node:assert/strict';
import test from 'node:test';
import { createPosthogClientGate, getClientWithInitializingFlagRace } from './posthog-gate.ts';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('legacy initializing flag returns null to concurrent callers (proven race)', async () => {
  const state = { client: null as { id: string } | null, initializing: false };
  let loads = 0;
  const load = async () => {
    loads += 1;
    await delay(40);
    return { id: 'sdk' };
  };
  const first = getClientWithInitializingFlagRace(state, load);
  const second = await getClientWithInitializingFlagRace(state, load);
  const firstResult = await first;
  assert.equal(second, null);
  assert.deepEqual(firstResult, { id: 'sdk' });
  assert.equal(loads, 1);
});

test('shared in-flight promise: concurrent callers receive the same client', async () => {
  let loads = 0;
  const gate = createPosthogClientGate(async () => {
    loads += 1;
    await delay(40);
    return { id: 'sdk', capture(event: string) { captured.push(event); } };
  });
  const captured: string[] = [];
  const a = gate.get();
  const b = gate.get();
  const c = gate.get();
  const [clientA, clientB, clientC] = await Promise.all([a, b, c]);
  assert.equal(clientA, clientB);
  assert.equal(clientB, clientC);
  assert.notEqual(clientA, null);
  assert.equal(loads, 1);
  assert.equal(gate.getStartCount(), 1);
});

test('captures queued during initialization execute on the initialized client', async () => {
  const captured: string[] = [];
  const gate = createPosthogClientGate(async () => {
    await delay(30);
    return {
      capture(event: string) {
        captured.push(event);
      },
    };
  });
  const pending = gate.get();
  void gate.get().then((client) => {
    client?.capture('$pageview');
    client?.capture('search_submitted');
    client?.capture('search_results_returned');
  });
  await pending;
  await delay(5);
  assert.deepEqual(captured, ['$pageview', 'search_submitted', 'search_results_returned']);
  assert.equal(gate.getStartCount(), 1);
});

test('initialization failure is fail-safe and does not throw to callers', async () => {
  const gate = createPosthogClientGate(async () => {
    await delay(10);
    throw new Error('sdk failed');
  });
  const [a, b] = await Promise.all([gate.get(), gate.get()]);
  assert.equal(a, null);
  assert.equal(b, null);
  assert.equal(gate.getStartCount(), 1);
});

test('after failure a later caller may retry initialization', async () => {
  let attempt = 0;
  const gate = createPosthogClientGate(async () => {
    attempt += 1;
    if (attempt === 1) throw new Error('first fail');
    return { id: 'recovered' };
  });
  assert.equal(await gate.get(), null);
  assert.deepEqual(await gate.get(), { id: 'recovered' });
  assert.equal(gate.getStartCount(), 2);
});
