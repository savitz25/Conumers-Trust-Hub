import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { InsuranceAckChannel, INSURANCE_SOURCE_PATH } from './insurance-channel.ts';
import { INSURANCE_PRODUCTION_PINS, verifyInsuranceAssertion } from './insurance-assertion.ts';
import { accountContextIssueQuery, SHARED_HUB_ACCOUNT_CONTEXT } from './hub-account-context.ts';
import { PRODUCTION_TARGET } from './isolated-config.ts';
import { RuntimeError } from './runtime.ts';
import type { ItemReceipt } from '../contracts/v2-3-profile-transfer.ts';

const browser = 'b'.repeat(43), session = 'f'.repeat(64), continuation = 'k'.repeat(43);
function keys() {
  const pair = generateKeyPairSync('ed25519');
  return { privateKey: { kid: 'ask-test', pem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() },
    publicKey: { kid: 'ask-test', pem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString() } };
}
function receipt(outcome: 'saved' | 'already_saved' | 'local_only', patch: Partial<ItemReceipt> = {}): ItemReceipt {
  return { receiptRef: 'r'.repeat(43), requestKey: browser + ':0', accountContextRef: 'c'.repeat(43), manifestDigest: 'a'.repeat(64),
    item: { localItemId: 'asfin-llc-l106287', revision: '1', digest: 'a'.repeat(64), profile: { hub: 'insurance', nativeId: 'state-license:FL:L106287', profileClass: 'insurance_provider' } },
    parent: { outcome }, project: { outcome: 'not_requested' }, localCopy: 'keep', ...patch };
}
/** Stand-in for the Insurance source route: verifies Ask's signature and scope. */
function insurance(ask: ReturnType<typeof keys>, answer: unknown = { ok: true, result: { acknowledged: 'save', watchCreated: false } }, status = 200) {
  const calls: Array<{ url: string; body: { action: string; continuationRef: string; receipts: ItemReceipt[] }; claims: Awaited<ReturnType<typeof verifyInsuranceAssertion>> }> = [];
  const seen = new Set<string>();
  const send = (async (url: string, init: RequestInit) => {
    const bytes = Buffer.from(init.body as Uint8Array);
    const claims = await verifyInsuranceAssertion(new Request(url, { method: 'POST', headers: init.headers as Record<string, string>, body: bytes }), bytes, ask.publicKey,
      'ask', 'source:ack', { claim: async key => !seen.has(key) && !!seen.add(key) });
    calls.push({ url, body: JSON.parse(bytes.toString('utf8')), claims });
    return Response.json(answer, { status });
  }) as typeof fetch;
  return { calls, send };
}

test('Ask acknowledges an Insurance Save and Unsave with one signed source:ack call to the pinned Insurance origin', async () => {
  const ask = keys(), peer = insurance(ask);
  const channel = new InsuranceAckChannel(ask.privateKey, peer.send);
  for (const outcome of ['saved', 'already_saved', 'local_only'] as const) await channel.acknowledge(continuation, [receipt(outcome)], browser, session);
  assert.equal(peer.calls.length, 3);
  for (const call of peer.calls) {
    assert.equal(call.url, 'https://www.insurancetrusthub.com' + INSURANCE_SOURCE_PATH);
    assert.deepEqual(Object.keys(call.body).sort(), ['action', 'continuationRef', 'receipts']);
    assert.equal(call.body.action, 'acknowledge');
    assert.equal(call.body.continuationRef, continuation);
    assert.equal(call.body.receipts.length, 1);
    // Insurance ties the receipt to the handoff it staged by the browser proof it signed.
    assert.ok(call.body.receipts[0]!.requestKey.startsWith(call.claims.browser + ':'));
    assert.equal(call.claims.browser, browser);
    assert.equal(call.claims.session, session);
    assert.equal(call.claims.scope, 'source:ack');
    assert.equal(call.claims.insurance_origin, INSURANCE_PRODUCTION_PINS.insuranceOrigin);
    assert.doesNotMatch(JSON.stringify(call.body), /watch/i);
  }
  assert.deepEqual(peer.calls.map(call => call.body.receipts[0]!.parent.outcome), ['saved', 'already_saved', 'local_only']);
});

test('nothing is sent for a receipt Insurance would not accept, and a refused or unexpected answer is a failure', async () => {
  const ask = keys(), peer = insurance(ask);
  const channel = new InsuranceAckChannel(ask.privateKey, peer.send);
  const cases: ItemReceipt[][] = [
    [], [receipt('saved'), receipt('saved')],
    [receipt('saved', { requestKey: 'x'.repeat(43) + ':0' })],
    [receipt('saved', { parent: { outcome: 'failed' } })],
    [receipt('saved', { parent: { outcome: 'identity_review_required' } })],
    [receipt('saved', { item: { ...receipt('saved').item, profile: { hub: 'lender', nativeId: 'nmls:2767', profileClass: 'marketplace_company' } } })],
    [receipt('saved', { item: { ...receipt('saved').item, profile: { hub: 'insurance', nativeId: 'asfin-llc-l106287', profileClass: 'insurance_provider' } } })],
    [receipt('saved', { item: { ...receipt('saved').item, profile: { hub: 'insurance', nativeId: 'state-license:FL:L106287', profileClass: 'legal_insurer' } } })],
  ];
  for (const receipts of cases) await assert.rejects(() => channel.acknowledge(continuation, receipts, browser, session), /unavailable/);
  assert.equal(peer.calls.length, 0);
  for (const [answer, status] of [[{ ok: false, error: 'unauthorized' }, 403], [{ ok: false, error: 'unavailable' }, 503], [{ ok: true, result: { acknowledged: 'save', watchCreated: true } }, 200], [{ ok: true }, 200]] as const) {
    const refused = insurance(ask, answer, status);
    await assert.rejects(() => new InsuranceAckChannel(ask.privateKey, refused.send).acknowledge(continuation, [receipt('saved')], browser, session), /unavailable/);
  }
  const stranger = insurance(keys());
  await assert.rejects(() => new InsuranceAckChannel(ask.privateKey, stranger.send).acknowledge(continuation, [receipt('saved')], browser, session));
});

test('the account context is issued for the verified caller hub; Move and Investor keep their own issuers', () => {
  const assembly = readFileSync(new URL('./preview-assembly.ts', import.meta.url), 'utf8');
  assert.match(assembly, /const hub = a\.caller\.hub;/);
  assert.match(assembly, /const issue = accountContextIssueQuery\(this\.target, hub\);/);
  assert.match(assembly, /issue\.hubArgument\s*\? \[JSON\.stringify\(proof\), p\.subject, p\.sessionBinding, hub\]/);
  assert.doesNotMatch(assembly, /issueSharedAccountContext/);
  // An Insurance acknowledgement is no longer skipped.
  assert.doesNotMatch(assembly, /sourceHub === 'insurance'\) throw new RuntimeError\('unavailable'\)/);
  assert.match(assembly, /requestPrefix: claims\.browser/);
  assert.match(assembly, /requestPrefix: link\.browser/);
  const shared = 'select v23_private.prod_hub_issue_context($1,$2,$3,$4) as issued';
  assert.deepEqual(accountContextIssueQuery(PRODUCTION_TARGET, 'move'), { text: 'select v23_private.prod_issue_context($1,$2,$3) as issued', hubArgument: false });
  assert.deepEqual(accountContextIssueQuery(PRODUCTION_TARGET, 'investor'), { text: 'select v23_private.prod_investor_issue_context($1,$2,$3) as issued', hubArgument: false });
  for (const hub of SHARED_HUB_ACCOUNT_CONTEXT) assert.deepEqual(accountContextIssueQuery(PRODUCTION_TARGET, hub), { text: shared, hubArgument: true }, hub);
  for (const hub of ['senior', 'ask', '', 'move ', 'LENDER', 'investor ']) assert.throws(() => accountContextIssueQuery(PRODUCTION_TARGET, hub), (error: unknown) => error instanceof RuntimeError && error.message === 'unavailable');
});
