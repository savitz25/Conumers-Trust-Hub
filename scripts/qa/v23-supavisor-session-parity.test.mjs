import test from 'node:test';
import assert from 'node:assert/strict';
import { PARENT_LOGIN } from '../../lib/my-trusthub/profile-save/isolated-config.ts';
import { acceptedSupavisorApplicationName, assertCleanCheckout, assertTransactionAdvisoryLock } from './v23-supavisor-session-parity.mjs';

const prefixed = 'Supavisor - v23-session-parity-probe';

test('Supavisor baseline is accepted', () => {
  assert.equal(acceptedSupavisorApplicationName('Supavisor'), true);
  assert.doesNotThrow(() => assertCleanCheckout('Supavisor', 'Supavisor', PARENT_LOGIN));
});

test('Supavisor-prefixed client name is accepted', () => {
  assert.equal(acceptedSupavisorApplicationName(prefixed), true);
  assert.doesNotThrow(() => assertCleanCheckout(prefixed, prefixed, PARENT_LOGIN));
});

test('arbitrary application_name is rejected', () => {
  assert.equal(acceptedSupavisorApplicationName('psql'), false);
  assert.equal(acceptedSupavisorApplicationName('v23-session-parity-probe'), false);
  assert.throws(() => assertCleanCheckout('psql', 'psql', PARENT_LOGIN));
  assert.throws(() => assertCleanCheckout('v23-session-parity-probe', 'v23-session-parity-probe', PARENT_LOGIN));
});

test('dirty application_name after reacquire is rejected', () => {
  assert.throws(() => assertCleanCheckout('Supavisor', 'v23-probe-dirty', PARENT_LOGIN));
});

test('clean reacquire that differs from the captured baseline is rejected', () => {
  assert.throws(() => assertCleanCheckout('Supavisor', prefixed, PARENT_LOGIN));
  assert.throws(() => assertCleanCheckout(prefixed, 'Supavisor', PARENT_LOGIN));
});

test('transaction advisory lock false is rejected', () => {
  assert.throws(() => assertTransactionAdvisoryLock({ level: 'serializable', locked: false }));
  assert.throws(() => assertTransactionAdvisoryLock({ level: 'read committed', locked: true }));
  assert.doesNotThrow(() => assertTransactionAdvisoryLock({ level: 'serializable', locked: true }));
});
