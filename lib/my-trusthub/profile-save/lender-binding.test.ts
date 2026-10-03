import assert from 'node:assert/strict';
import test from 'node:test';
import { profileCapability } from '../contracts/v2-3-profile-save.ts';
import { resolveExactProfile } from './identity.ts';
import { classifyLenderRows, lenderNativeId, type LenderBindingRow } from './lender-binding.ts';
import type { FoundationSql } from './p12-p13.ts';

const nativeId = lenderNativeId('1984721');
assert.equal(nativeId, 'nmls:1984721');

function row(patch: Partial<LenderBindingRow> = {}): LenderBindingRow {
  return {
    id: 'binding-1',
    network_entity_id: 'entity-1',
    binding_status: 'accepted',
    specialist_entity_type: 'marketplace_company',
    specialist_entity_id: 'nmls:1984721',
    identifier_namespace: 'nmls',
    source_identifier: '1984721',
    jurisdiction: 'US',
    entity_status: 'active',
    ...patch,
  };
}

test('exact accepted NMLS binding is eligible and a repeated read is the same row', () => {
  const once = classifyLenderRows('nmls:1984721', [row()]);
  const twice = classifyLenderRows('nmls:1984721', [row()]);
  assert.equal(once.outcome, 'eligible');
  assert.equal(twice.outcome, 'eligible');
  if (once.outcome === 'eligible' && twice.outcome === 'eligible') assert.equal(once.id, twice.id);
});

function deniedReason(nativeId: string, rows: LenderBindingRow[]) {
  const decision = classifyLenderRows(nativeId, rows);
  assert.equal(decision.outcome, 'denied');
  if (decision.outcome !== 'denied') throw new Error('expected a denial');
  return decision.reason;
}

test('missing, ambiguous, review_required, wrong class, and disagreement are denied', () => {
  assert.equal(deniedReason('nmls:1984721', []), 'missing');
  assert.equal(deniedReason('nmls:1984721', [row(), row({ id: 'binding-2' })]), 'ambiguous');
  assert.equal(deniedReason('nmls:1984721', [row({ binding_status: 'review_required' })]), 'review_required');
  assert.equal(deniedReason('nmls:1984721', [row({ specialist_entity_type: 'national_institution' })]), 'wrong_class');
  assert.equal(deniedReason('nmls:1984721', [row({ source_identifier: '3030' })]), 'identity_disagreement');
  assert.equal(deniedReason('nmls:1984721', [row({ identifier_namespace: 'fmcsa.usdot' })]), 'identity_disagreement');
  assert.equal(deniedReason('slug:pacific-trust-mortgage', [row()]), 'identity_disagreement');
  assert.equal(deniedReason('nmls:1984721', [row({ entity_status: 'retired' })]), 'inactive');
});

test('lender resolution uses the NMLS query and does not admit review_required as a save', async () => {
  const calls: unknown[][] = [];
  const sql: FoundationSql = {
    async query<T>(_text: string, values: unknown[]) {
      calls.push(values);
      return { rows: [row({ binding_status: 'review_required' })] as T[] };
    },
  };
  const identity = { hub: 'lender' as const, nativeId: 'nmls:1984721', profileClass: 'marketplace_company' };
  const profile = await resolveExactProfile(identity, {
    resolve: async () => ({ identity, published: true, supportedClass: true }),
  }, sql);
  assert.deepEqual(calls[0], ['marketplace_company', 'nmls:1984721', 'nmls', '1984721']);
  assert.equal(profile?.binding?.status, 'review_required');
  assert.equal(profile ? profileCapability(profile) : '', 'IDENTITY_REVIEW_REQUIRED');
});

test('Move registry values stay on the original query', async () => {
  const calls: unknown[][] = [];
  const sql: FoundationSql = {
    async query<T>(_text: string, values: unknown[]) {
      calls.push(values);
      return { rows: [{ id: 'binding', network_entity_id: 'canonical', binding_status: 'accepted' }] as T[] };
    },
  };
  const identity = { hub: 'move' as const, nativeId: 'usdot-1002530', profileClass: 'mover' };
  const profile = await resolveExactProfile(identity, {
    resolve: async () => ({ identity, published: true, supportedClass: true }),
  }, sql);
  assert.deepEqual(calls[0], ['move', 'usdot-1002530', 'mover']);
  assert.equal(profile?.binding?.status, 'accepted');
  assert.equal(profile ? profileCapability(profile) : '', 'SAVE_SUPPORTED');
});
