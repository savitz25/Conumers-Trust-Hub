import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { manifestDigest } from '../contracts/v2-3-profile-transfer.ts';
import { verifySeniorAssertion, type SeniorAssertionClaims } from './senior-assertion.ts';
import { SeniorSourceChannel } from './senior-channel.ts';
import { RuntimeError } from './runtime.ts';

const browser = 'b'.repeat(43);
const slug = 'burns-nursing-home-inc';
const nativeId = '015009';
const profile = { hub: 'senior' as const, nativeId, profileClass: 'cms_facility' as const };
const manifest = {
  version: 'v2-3/selected-profiles/3' as const, sourceHub: 'senior' as const, audience: 'ask' as const,
  selected: [{ localItemId: nativeId, revision: '1', digest: 'a'.repeat(64), profile }],
  returnTask: { kind: 'profile' as const, hub: 'senior' as const, canonicalSlug: slug, profile, returnPath: `/facility/cms/${nativeId}/${slug}` },
};
const proof = (patch: Record<string, unknown> = {}) => ({ identity: profile, canonicalSlug: slug, publicationState: 'PUBLISHABLE', reviewedClass: 'cms_facility', checkedAt: Date.now(), ...patch });
const unavailable = (error: unknown) => error instanceof RuntimeError && error.code === 'unavailable';

function keys() {
  const pair = generateKeyPairSync('ed25519');
  return {
    privateKey: { kid: 'ask-senior-test', pem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() },
    publicKey: { kid: 'ask-senior-test', pem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString() },
  };
}

test('Ask re-proves the exact CCN with Senior and acknowledges over the signed source channel; no Watch', async () => {
  const pair = keys();
  const seen = new Set<string>();
  const nonces = { claim: async (key: string) => { if (seen.has(key)) return false; seen.add(key); return true; } };
  const calls: Array<{ action: string; claims: SeniorAssertionClaims; body: Record<string, unknown> }> = [];
  let watchCreated: boolean | null = null;
  const send = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const bytes = Buffer.from(init?.body as Uint8Array);
    const request = new Request(url, { method: 'POST', headers: init?.headers, body: bytes });
    const body = JSON.parse(bytes.toString('utf8')) as Record<string, unknown>;
    const scope = body.action === 'acknowledge' ? 'source:ack' as const : 'source:read' as const;
    // Senior verifies with Ask's key, as its own callback does.
    const claims = await verifySeniorAssertion(request, bytes, pair.publicKey, 'ask', scope, nonces);
    calls.push({ action: String(body.action), claims, body });
    assert.equal(url, 'https://www.seniortrusthub.com/api/my-trusthub/profile-save/source');
    assert.equal(claims.iss, 'urn:trusthub:v23:qvvxvbcdmbjzrgvwjatw:ask');
    assert.equal(claims.senior_origin, 'https://www.seniortrusthub.com');
    assert.equal(JSON.stringify(body).toLowerCase().includes('watch'), false);
    if (body.action === 'resolve') {
      assert.deepEqual(body.profile, profile);
      return Response.json({ ok: true, result: proof() });
    }
    if (body.action === 'source') {
      assert.equal(body.manifestDigest, manifestDigest(manifest));
      return Response.json({ ok: true, result: {
        continuationRef: body.continuationRef, transferRef: body.transferRef, manifest, manifestDigest: body.manifestDigest,
        browserProof: claims.browser, expiresAt: body.expiresAt, requestPrefix: claims.browser,
      } });
    }
    const receipts = body.receipts as Array<Record<string, unknown>>;
    assert.equal(receipts.length, 1);
    assert.equal(String(receipts[0]!.requestKey).startsWith(claims.browser + ':'), true);
    assert.equal(Object.hasOwn(receipts[0]!, 'watch'), false);
    assert.equal(Object.hasOwn(receipts[0]!, 'watchCreated'), false);
    assert.match(String(claims.session), /^[a-f0-9]{64}$/);
    watchCreated = false;
    return Response.json({ ok: true, result: { watchCreated: false } });
  }) as typeof fetch;
  const channel = new SeniorSourceChannel(pair.privateKey, send);
  const published = await channel.publication(browser, profile);
  assert.equal(published.canonicalSlug, slug);
  assert.equal(published.identity.nativeId, '015009');
  const continuationRef = 'c'.repeat(43);
  const transferRef = 't'.repeat(43);
  const source = await channel.call({
    action: 'source', continuationRef, transferRef, manifest, manifestDigest: manifestDigest(manifest), expiresAt: Date.now() + 60_000,
  }, 'source:read', browser) as { requestPrefix: string; browserProof: string };
  assert.equal(source.requestPrefix, browser);
  assert.equal(source.browserProof, browser);
  const ack = await channel.call({
    action: 'acknowledge', continuationRef, receipts: [{
      receiptRef: 'r'.repeat(43), requestKey: browser + ':0', localCopy: 'keep',
      parent: { outcome: 'saved' }, item: { profile },
    }],
  }, 'source:ack', browser, 'a'.repeat(64)) as { watchCreated: boolean };
  assert.equal(ack.watchCreated, false);
  assert.equal(watchCreated, false);
  assert.deepEqual(calls.map(call => call.action), ['resolve', 'source', 'acknowledge']);
  // Z. An acknowledgement answer that reports a Watch, or omits the field, is refused.
  for (const result of [{ watchCreated: true }, {}, { watchCreated: 'false' }]) {
    const refused = new SeniorSourceChannel(pair.privateKey, (async () => Response.json({ ok: true, result })) as typeof fetch);
    await assert.rejects(() => refused.call({ action: 'acknowledge', continuationRef, receipts: [] }, 'source:ack', browser), unavailable);
  }
});

test('R S T a failed source re-proof is denied: unavailable, slow, malformed, stale, future, wrong CCN, wrong class, wrong route', async () => {
  const pair = keys();
  const answering = (reply: () => Response | Promise<Response>) => new SeniorSourceChannel(pair.privateKey, (async () => reply()) as typeof fetch);
  const withProof = (patch: Record<string, unknown>) => answering(() => Response.json({ ok: true, result: proof(patch) }));
  // R. Senior unavailable, refusing, timing out, or answering with something that is not the contract.
  await assert.rejects(() => answering(() => { throw new TypeError('fetch failed'); }).publication(browser, profile));
  await assert.rejects(() => answering(() => { throw new DOMException('The operation was aborted due to timeout', 'TimeoutError'); }).publication(browser, profile));
  await assert.rejects(() => answering(() => new Response('{"ok":false,"error":"unavailable"}', { status: 503, headers: { 'content-type': 'application/json' } })).publication(browser, profile), unavailable);
  await assert.rejects(() => answering(() => new Response('{"ok":false,"error":"unauthorized"}', { status: 403, headers: { 'content-type': 'application/json' } })).publication(browser, profile), unavailable);
  await assert.rejects(() => answering(() => Response.json({ ok: false, error: 'unavailable' })).publication(browser, profile), unavailable);
  await assert.rejects(() => answering(() => new Response('<html>down</html>', { status: 200, headers: { 'content-type': 'text/html' } })).publication(browser, profile), unavailable);
  await assert.rejects(() => answering(() => new Response('{not json', { status: 200, headers: { 'content-type': 'application/json' } })).publication(browser, profile));
  await assert.rejects(() => answering(() => Response.json({ ok: true })).publication(browser, profile), unavailable);
  await assert.rejects(() => answering(() => Response.json({ ok: true, result: null })).publication(browser, profile), unavailable);
  // Stale and future-dated answers.
  await assert.rejects(() => withProof({ checkedAt: Date.now() - 6_000 }).publication(browser, profile), unavailable);
  await assert.rejects(() => withProof({ checkedAt: Date.now() + 5_000 }).publication(browser, profile), unavailable);
  await assert.rejects(() => withProof({ checkedAt: 'now' }).publication(browser, profile), unavailable);
  await assert.rejects(() => withProof({ publicationState: 'HELD' }).publication(browser, profile), unavailable);
  // S. Senior answers for a different CCN, or a malformed one.
  await assert.rejects(() => withProof({ identity: { ...profile, nativeId: '055223' } }).publication(browser, profile), unavailable);
  await assert.rejects(() => withProof({ identity: { ...profile, nativeId: 'cms.ccn:015009' } }).publication(browser, profile), unavailable);
  // T. Senior answers with another class (home health, hospice, assisted living) or another hub.
  for (const cls of ['home_health', 'hospice', 'assisted_living', 'nursing_home']) {
    await assert.rejects(() => withProof({ identity: { ...profile, profileClass: cls } }).publication(browser, profile), unavailable, cls);
    await assert.rejects(() => withProof({ reviewedClass: cls }).publication(browser, profile), unavailable, cls);
  }
  await assert.rejects(() => withProof({ identity: { ...profile, hub: 'lender' } }).publication(browser, profile), unavailable);
  // Wrong route identity: a slug that is not a canonical slug.
  for (const bad of ['', 'Burns Home', '../015009', 'a'.repeat(81), 15009]) await assert.rejects(() => withProof({ canonicalSlug: bad }).publication(browser, profile), unavailable, String(bad));
  // Ask never asks Senior about anything but the exact CMS nursing-home grain.
  let asked = 0;
  const counting = new SeniorSourceChannel(pair.privateKey, (async () => { asked++; return Response.json({ ok: true, result: proof() }); }) as typeof fetch);
  for (const identity of [{ ...profile, profileClass: 'home_health' }, { ...profile, profileClass: 'hospice' }, { ...profile, nativeId: 'AL12345' },
    { ...profile, nativeId: '11111111-1111-4111-8111-111111111111' }, { ...profile, hub: 'insurance' as const }])
    await assert.rejects(() => counting.publication(browser, identity as never), unavailable);
  assert.equal(asked, 0);
  // A good answer still passes.
  assert.equal((await withProof({}).publication(browser, profile)).canonicalSlug, slug);
});
