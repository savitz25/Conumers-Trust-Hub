import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture } from './browser.fixture.ts';

const CANARIES = [
  { nativeId: 'state-license:FL:L106287', slug: 'asfin-llc-l106287', jurisdiction: 'FL' },
  { nativeId: 'state-license:TX:1365714', slug: 'imt-services-llc-1365714', jurisdiction: 'TX' },
  { nativeId: 'state-license:OH:19068455', slug: 'j-a-sandoval-llc-19068455', jurisdiction: 'OH' },
] as const;

test('signed Save and Unsave return to /providers and do not create a Watch', async () => {
  for (const canary of CANARIES) {
    const f = await fixture({ environment: 'production', hub: 'insurance', intent: 'save', nativeId: canary.nativeId, slug: canary.slug });
    try {
      const destination = `https://www.insurancetrusthub.com/providers/${canary.slug}`;
      const back = (r: Response) => { assert.equal(r.status, 303); assert.equal(r.headers.get('location'), destination); };
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
      const tables = f.backend.db.prepare("SELECT group_concat(name) AS names FROM (SELECT name FROM sqlite_master WHERE type='table' ORDER BY name)").get() as { names: string };
      assert.equal(tables.names, 'consumed,memberships,objects,quota,saves');
      assert.equal(JSON.stringify(tables.names).toLowerCase().includes('watch'), false);
    } finally { f.close(); }
  }
});

test('a profile filed in a Project is not removed, and an expired handoff does not save', async () => {
  const filed = await fixture({ environment: 'production', hub: 'insurance', intent: 'save' });
  try {
    filed.login();
    assert.equal((await filed.get()).status, 303);
    assert.equal(filed.backend.count('saves'), 1);
    filed.fileInProject();
    const page = await (await filed.again('unsave')).get();
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Still saved in My TrustHub/);
    assert.equal(filed.backend.count('saves'), 1);
    assert.equal(filed.acks, 1);
  } finally { filed.close(); }
  const abandoned = await fixture({ environment: 'production', hub: 'insurance', intent: 'save' });
  try {
    abandoned.login();
    abandoned.expire();
    const page = await abandoned.get();
    assert.equal(page.status, 410);
    assert.equal(abandoned.backend.count('saves'), 0);
  } finally { abandoned.close(); }
});
