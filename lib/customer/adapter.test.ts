import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateContractorAdapter } from './adapter.ts';
import type { CthProfileRecord, HandoffPayload } from './types.ts';

const handoff: Pick<
  HandoffPayload,
  'hub_id' | 'native_profile_id' | 'slug' | 'external_key' | 'source_system' | 'home_state'
> = {
  hub_id: 'contractor',
  native_profile_id: '11111111-1111-4111-8111-111111111111',
  slug: 'cbc015082-acme-roofing',
  external_key: 'CBC015082',
  source_system: 'fl_dbpr',
  home_state: 'FL',
};

const profile: CthProfileRecord = {
  id: handoff.native_profile_id,
  slug: handoff.slug,
  displayName: 'Acme Roofing',
  isThin: false,
  homeState: 'FL',
  licenseState: 'FL',
  externalKey: 'CBC015082',
  sourceSystem: 'fl_dbpr',
};

test('happy Florida non-thin profile accepted', () => {
  const r = validateContractorAdapter(handoff, profile);
  assert.equal(r.ok, true);
});

test('non-Florida rejected', () => {
  const r = validateContractorAdapter(handoff, { ...profile, homeState: 'TX', licenseState: 'TX' });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, 'unsupported_state');
});

test('unsupported source rejected', () => {
  const r = validateContractorAdapter(handoff, { ...profile, sourceSystem: 'tx_tdlr' });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, 'unsupported_source');
});

test('thin profile rejected', () => {
  const r = validateContractorAdapter(handoff, { ...profile, isThin: true });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, 'thin_profile');
});

test('nonexistent profile rejected', () => {
  const r = validateContractorAdapter(handoff, null);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, 'missing_profile');
});

test('wrong slug rejected', () => {
  const r = validateContractorAdapter(handoff, { ...profile, slug: 'other-slug' });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, 'slug_mismatch');
});
