import assert from 'node:assert/strict';
import test from 'node:test';
import { profileKey } from '../contracts/v2-3-profile-transfer.ts';
import { fixture } from './browser.fixture.ts';

const CANARIES = [
  { nativeId: '015009', slug: 'burns-nursing-home-inc' },
  { nativeId: '055223', slug: 'san-jacinto-valley-post-acute' },
  { nativeId: '155805', slug: 'addison-pointe-health-and-rehabilitation-center' },
] as const;
const tables = (f: Awaited<ReturnType<typeof fixture>>) =>
  (f.backend.db.prepare("SELECT group_concat(name) AS names FROM (SELECT name FROM sqlite_master WHERE type='table' ORDER BY name)").get() as { names: string }).names;

test('U V W X Z signed Senior Save and Unsave stage, commit once, acknowledge after the commit, and never create a Watch', async () => {
  for (const canary of CANARIES) {
    const f = await fixture({ environment: 'production', hub: 'senior', intent: 'save', nativeId: canary.nativeId, slug: canary.slug });
    try {
      const destination = `https://www.seniortrusthub.com/facility/cms/${canary.nativeId}/${canary.slug}`;
      const back = (r: Response) => { assert.equal(r.status, 303); assert.equal(r.headers.get('location'), destination); };
      // X. Nothing is saved or acknowledged before the commit.
      assert.equal(f.backend.count('saves'), 0);
      assert.equal(f.acks, 0);
      f.login();
      back(await f.get());
      assert.equal(f.backend.count('saves'), 1);
      assert.equal(f.acks, 1);
      // V. The same hand-off again, then a fresh Save: still one Saved row.
      back(await f.get());
      assert.equal(f.backend.count('saves'), 1);
      const second = await f.again('save');
      back(await second.get());
      assert.equal(f.backend.count('saves'), 1);
      // W. Unsave removes the row and returns to the same profile.
      const removed = await f.again('unsave');
      back(await removed.get());
      assert.equal(f.backend.count('saves'), 0);
      assert.equal(f.unsaves > 0, true);
      // Z. No Watch storage exists or was touched.
      assert.equal(tables(f), 'consumed,memberships,objects,quota,saves');
      assert.equal(tables(f).toLowerCase().includes('watch'), false);
    } finally { f.close(); }
  }
});

test('Y a signed-out arrival commits nothing and sends no acknowledgement', async () => {
  const f = await fixture({ environment: 'production', hub: 'senior', intent: 'save', nativeId: '015009', slug: 'burns-nursing-home-inc' });
  try {
    const response = await f.get();
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), 'https://www.seniortrusthub.com/facility/cms/015009/burns-nursing-home-inc');
    assert.equal(f.backend.count('saves'), 0);
    assert.equal(f.acks, 0);
  } finally { f.close(); }
});

test('signed-out Senior Save completes after sign-in with no second Save', async () => {
  const g = await fixture({ environment: 'production', hub: 'senior', intent: 'save_signin', nativeId: '055223', slug: 'san-jacinto-valley-post-acute' });
  try {
    const gate = await g.get();
    assert.equal(gate.status, 200);
    assert.match(await gate.text(), /Sign in to continue/);
    assert.equal(g.backend.count('saves'), 0);
    assert.equal(g.acks, 0);
    g.login();
    const done = await g.get();
    assert.equal(done.status, 303);
    assert.equal(done.headers.get('location'), 'https://www.seniortrusthub.com/facility/cms/055223/san-jacinto-valley-post-acute');
    assert.equal(g.backend.count('saves'), 1);
    assert.equal(g.acks, 1);
  } finally { g.close(); }
});

test('I K Y missing binding, review_required, an unpublished profile and a failed commit write nothing and acknowledge nothing', async () => {
  const identity = { hub: 'senior' as const, nativeId: '015009', profileClass: 'cms_facility' };
  const destination = 'https://www.seniortrusthub.com/facility/cms/015009/burns-nursing-home-inc';
  const cases: Array<(f: Awaited<ReturnType<typeof fixture>>) => void> = [
    f => { f.backend.profiles.get(profileKey(identity))!.binding = null; },
    f => { const p = f.backend.profiles.get(profileKey(identity))!; p.binding = { ...p.binding!, status: 'review_required' }; },
    f => { f.backend.profiles.get(profileKey(identity))!.published = false; },
    f => { f.backend.profiles.get(profileKey(identity))!.supportedClass = false; },
    f => { f.backend.failReceipt = true; },
  ];
  for (const [index, arrange] of cases.entries()) {
    const f = await fixture({ environment: 'production', hub: 'senior', intent: 'save', nativeId: '015009', slug: 'burns-nursing-home-inc' });
    try {
      assert.ok(f.backend.profiles.get(profileKey(identity)));
      arrange(f);
      f.login();
      const response = await f.get();
      assert.equal(response.status, 303, 'case ' + index);
      assert.equal(response.headers.get('location'), destination, 'case ' + index);
      assert.equal(f.acks, 0, 'no acknowledgement, case ' + index);
      if (index < 4) assert.equal(f.backend.count('saves'), 0, 'no Saved row, case ' + index);
    } finally { f.close(); }
  }
});
