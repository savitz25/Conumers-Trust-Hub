import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture } from './browser.fixture.ts';

const CANARIES = [
  { nativeId: 'fl.dbpr.license:CCC057187', slug: 'ccc057187-a-r-roofing-inc' },
  { nativeId: 'fl.dbpr.license:CFC1427249', slug: 'cfc1427249-a-sunny-plumbing-company' },
  { nativeId: 'fl.dbpr.license:CGC1506243', slug: 'cgc1506243-abs-contracting-inc' },
] as const;

test('I J K L signed Save and Unsave return to /contractors and do not create a Watch', async () => {
  for (const canary of CANARIES) {
    const f = await fixture({ environment: 'production', hub: 'contractor', intent: 'save', nativeId: canary.nativeId, slug: canary.slug });
    try {
      const destination = `https://www.contractortrusthub.com/contractors/${canary.slug}`;
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
      assert.equal(f.unsaves > 0, true);
      const tables = f.backend.db.prepare("SELECT group_concat(name) AS names FROM (SELECT name FROM sqlite_master WHERE type='table' ORDER BY name)").get() as { names: string };
      assert.equal(tables.names, 'consumed,memberships,objects,quota,saves');
      assert.equal(JSON.stringify(tables.names).toLowerCase().includes('watch'), false);
    } finally { f.close(); }
  }
});
