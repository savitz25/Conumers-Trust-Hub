import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { manifestDigest } from '../contracts/v2-3-profile-transfer.ts';
import { verifyContractorAssertion, type ContractorAssertionClaims } from './contractor-assertion.ts';
import { ContractorSourceChannel } from './contractor-channel.ts';
import { RuntimeError } from './runtime.ts';

const browser = 'b'.repeat(43);
const slug = 'ccc057187-a-r-roofing-inc';
const nativeId = 'fl.dbpr.license:CCC057187';
const profile = { hub: 'contractor' as const, nativeId, profileClass: 'contractor_profile' as const };
const manifest = {
  version: 'v2-3/selected-profiles/3' as const, sourceHub: 'contractor' as const, audience: 'ask' as const,
  selected: [{ localItemId: slug, revision: '1', digest: 'a'.repeat(64), profile }],
  returnTask: { kind: 'profile' as const, hub: 'contractor' as const, canonicalSlug: slug, profile, returnPath: `/contractors/${slug}` },
};

function keys() {
  const pair = generateKeyPairSync('ed25519');
  return {
    privateKey: { kid: 'ask-contractor-test', pem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() },
    publicKey: { kid: 'ask-contractor-test', pem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString() },
  };
}

test('Q Ask source callback matches the contractor acknowledgement contract and creates no Watch', async () => {
  const pair = keys();
  const seen = new Set<string>();
  const nonces = { claim: async (key: string) => { if (seen.has(key)) return false; seen.add(key); return true; } };
  const calls: Array<{ action: string; claims: ContractorAssertionClaims; body: Record<string, unknown> }> = [];
  let watchCreated: boolean | null = null;
  const send = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const bytes = Buffer.from(init?.body as Uint8Array);
    const request = new Request(url, { method: 'POST', headers: init?.headers, body: bytes });
    const body = JSON.parse(bytes.toString('utf8')) as Record<string, unknown>;
    const scope = body.action === 'acknowledge' ? 'source:ack' as const : 'source:read' as const;
    const claims = await verifyContractorAssertion(request, bytes, pair.publicKey, 'ask', scope, nonces);
    calls.push({ action: String(body.action), claims, body });
    assert.equal(url, 'https://www.contractortrusthub.com/api/my-trusthub/profile-save/source');
    assert.equal(claims.iss, 'urn:trusthub:v23:qvvxvbcdmbjzrgvwjatw:ask');
    assert.equal(JSON.stringify(body).toLowerCase().includes('watch'), false);
    if (body.action === 'resolve') {
      assert.deepEqual(body.profile, profile);
      return Response.json({ ok: true, result: { identity: profile, canonicalSlug: slug, publicationState: 'PUBLISHABLE', reviewedClass: 'contractor_profile', checkedAt: Date.now() } });
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
    watchCreated = false;
    return Response.json({ ok: true, result: { watchCreated: false } });
  }) as typeof fetch;
  const channel = new ContractorSourceChannel(pair.privateKey, send);
  const proof = await channel.publication(browser, profile);
  assert.equal(proof.canonicalSlug, slug);
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
  }, 'source:ack', browser) as { watchCreated: boolean };
  assert.equal(ack.watchCreated, false);
  assert.equal(watchCreated, false);
  assert.deepEqual(calls.map(call => call.action), ['resolve', 'source', 'acknowledge']);
  const refused = new ContractorSourceChannel(pair.privateKey, (async () => Response.json({ ok: true, result: { watchCreated: true } })) as typeof fetch);
  await assert.rejects(() => refused.call({ action: 'acknowledge', continuationRef, receipts: [] }, 'source:ack', browser),
    (error: unknown) => error instanceof RuntimeError && error.code === 'unavailable');
});
