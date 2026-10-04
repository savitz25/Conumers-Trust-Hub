import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture } from './browser.fixture.ts';
import { profileKey } from '../contracts/v2-3-profile-transfer.ts';

const RETURN = 'https://www.investortrusthub.com/firm/sec-crd-106176';
const IDENTITY = { hub: 'investor' as const, nativeId: 'crd-106176', profileClass: 'official_firm' };
const back = (r: Response) => { assert.equal(r.status, 303); assert.equal(r.headers.get('location'), RETURN); };

test('investor Save, repeated Save, and Unsave use one Saved row and return to /firm/sec-crd-<CRD>', async () => {
  const f = await fixture({ environment: 'production', hub: 'investor', intent: 'save' });
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
    // No Watch and no other research object is created by a Save.
    const tables = f.backend.db.prepare("SELECT group_concat(name) AS names FROM (SELECT name FROM sqlite_master WHERE type='table' ORDER BY name)").get() as { names: string };
    assert.equal(tables.names, 'consumed,memberships,objects,quota,saves');
    const kinds = f.backend.db.prepare('SELECT group_concat(DISTINCT kind) AS kinds FROM objects').get() as { kinds: string | null };
    assert.doesNotMatch(String(kinds.kinds), /watch/i);
  } finally { f.close(); }
});

test('signed-out investor Save completes after auth without a second confirmation', async () => {
  const f = await fixture({ environment: 'production', hub: 'investor', intent: 'save' });
  try {
    back(await f.get());
    assert.equal(f.backend.count('saves'), 0);
    f.login();
    back(await f.get());
    assert.equal(f.backend.count('saves'), 1);
  } finally { f.close(); }
  const g = await fixture({ environment: 'production', hub: 'investor', intent: 'save_signin' });
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
  const missing = await fixture({ environment: 'production', hub: 'investor', intent: 'save' });
  try {
    const profile = missing.backend.profiles.get(profileKey(IDENTITY));
    assert.ok(profile);
    profile!.binding = null;
    missing.login();
    back(await missing.get());
    assert.equal(missing.backend.count('saves'), 0);
    assert.equal(missing.acks, 0);
  } finally { missing.close(); }
  const review = await fixture({ environment: 'production', hub: 'investor', intent: 'save' });
  try {
    const profile = review.backend.profiles.get(profileKey(IDENTITY));
    assert.ok(profile?.binding);
    profile!.binding = { ...profile!.binding!, status: 'review_required' };
    review.login();
    back(await review.get());
    assert.equal(review.backend.count('saves'), 0);
    assert.equal(review.acks, 0);
  } finally { review.close(); }
});

test('an arrival that does not come from the Investor origin is refused', async () => {
  const f = await fixture({ environment: 'production', hub: 'investor', intent: 'save' });
  try {
    for (const from of ['https://www.lendertrusthub.com', 'https://www.movetrusthub.com', 'https://evil.example', 'https://investortrusthub.com']) {
      const response = await (await import('./browser.ts')).handleProfileConfirmation(f.post(f.arrivalBody(f.continuation.continuationRef, 'save'), '', from), f.b);
      assert.notEqual(response.status, 303, from);
    }
  } finally { f.close(); }
});
