import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture } from './browser.fixture.ts';
import { profileKey } from '../contracts/v2-3-profile-transfer.ts';

const RETURN = 'https://www.lendertrusthub.com/lenders/pacific-trust-mortgage';
const back = (r: Response) => { assert.equal(r.status, 303); assert.equal(r.headers.get('location'), RETURN); };

test('lender Save, repeated Save, and Unsave use one Saved row and return to /lenders', async () => {
  const f = await fixture({ environment: 'production', hub: 'lender', intent: 'save' });
  try {
    f.login();
    back(await f.get());
    assert.equal(f.backend.count('saves'), 1);
    assert.equal(f.acks, 1);
    back(await f.get());
    const second = await f.again('save');
    back(await second.get());
    assert.equal(f.backend.count('saves'), 1);
    const removed = await f.again('unsave');
    back(await removed.get());
    assert.equal(f.backend.count('saves'), 0);
    assert.equal(f.released.length, 1);
    const tables = f.backend.db.prepare("SELECT group_concat(name) AS names FROM (SELECT name FROM sqlite_master WHERE type='table' ORDER BY name)").get() as { names: string };
    assert.equal(tables.names, 'consumed,memberships,objects,quota,saves');
  } finally { f.close(); }
});

test('signed-out lender Save completes after auth without a second confirmation', async () => {
  const f = await fixture({ environment: 'production', hub: 'lender', intent: 'save' });
  try {
    back(await f.get());
    assert.equal(f.backend.count('saves'), 0);
    f.login();
    back(await f.get());
    assert.equal(f.backend.count('saves'), 1);
  } finally { f.close(); }
  const g = await fixture({ environment: 'production', hub: 'lender', intent: 'save_signin' });
  try {
    const gate = await g.get();
    assert.equal(gate.status, 200);
    assert.match(await gate.text(), /Sign in to continue/);
    g.login();
    back(await g.get());
    assert.equal(g.backend.count('saves'), 1);
  } finally { g.close(); }
});

test('missing binding and review_required do not write a Saved row or acknowledge success', async () => {
  const missing = await fixture({ environment: 'production', hub: 'lender', intent: 'save' });
  try {
    const identity = { hub: 'lender' as const, nativeId: 'nmls:1984721', profileClass: 'marketplace_company' };
    const profile = missing.backend.profiles.get(profileKey(identity));
    assert.ok(profile);
    profile!.binding = null;
    missing.login();
    back(await missing.get());
    assert.equal(missing.backend.count('saves'), 0);
    assert.equal(missing.acks, 0);
  } finally { missing.close(); }
  const review = await fixture({ environment: 'production', hub: 'lender', intent: 'save' });
  try {
    const identity = { hub: 'lender' as const, nativeId: 'nmls:1984721', profileClass: 'marketplace_company' };
    const profile = review.backend.profiles.get(profileKey(identity));
    assert.ok(profile?.binding);
    profile!.binding = { ...profile!.binding!, status: 'review_required' };
    review.login();
    back(await review.get());
    assert.equal(review.backend.count('saves'), 0);
    assert.equal(review.acks, 0);
  } finally { review.close(); }
});
