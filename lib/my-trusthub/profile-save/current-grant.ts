import { hash, RuntimeError } from './runtime.ts';
import { PreviewStore, randomRef } from './preview-store.ts';
import { ASK_PREVIEW, MOVE_PREVIEW, GRANT_BROWSER_PATH, opaque } from './isolated-config.ts';
import type { BrowserParent, Confirmation } from './browser.ts';
import { PRIVATE_HEADERS } from './http.ts';
import { boundedBody } from './service-assertion.ts';

type GrantRecord = { subject: string; session: string; browser: string; accountContextRef: string; continuationRef: string;
  requestPrefix: string; projectRef?: string; expiresAt: number };
type Challenge = { continuationRef: string; browser: string; expiresAt: number };
type Proof = Challenge & { subject: string; session: string; accountContextRef: string; verifiedAt: number };
const COOKIE = 'mth_v23_current_grant';

/** Receipt acknowledgment never calls remember. Only the parent confirmation
 * calls it after P13 consume and committed, server-generated receipts. */
export class CurrentGrants {
  readonly store: PreviewStore; readonly parent: (r: Request) => Promise<BrowserParent | null>;
  constructor(store: PreviewStore, parent: (r: Request) => Promise<BrowserParent | null>) { this.store = store; this.parent = parent; }
  async remember(c: Confirmation, parent: BrowserParent) {
    if (!c.accountContextRef || !c.receipts?.length || c.parent?.subject !== parent.subject || c.parent.session !== parent.session ||
      c.receipts.some(r => r.accountContextRef !== c.accountContextRef)) throw new RuntimeError('unauthorized');
    const record: GrantRecord = { subject: parent.subject, session: parent.session, browser: c.source.browserProof,
      accountContextRef: c.accountContextRef, continuationRef: c.source.continuationRef, requestPrefix: c.requestPrefix,
      ...(c.projectRef ? { projectRef: c.projectRef } : {}), expiresAt: Date.now() + 30 * 86400000 };
    await this.store.record<GrantRecord>('grant:' + record.continuationRef, async prior => {
      if (prior && (prior.subject !== record.subject || prior.session !== record.session || prior.accountContextRef !== record.accountContextRef)) throw new RuntimeError('conflict');
      return { value: record, expiresAt: record.expiresAt, result: null };
    });
  }
  async challenge(continuationRef: string, browser: string) {
    const g = await this.store.read<GrantRecord>('grant:' + continuationRef);
    if (!opaque(continuationRef) || !g || g.browser !== browser) throw new RuntimeError('unauthorized');
    const ref = randomRef(), value = { continuationRef, browser, expiresAt: Date.now() + 90000 };
    await this.store.put('challenge:' + ref, value, value.expiresAt, true);
    return { target: ASK_PREVIEW + GRANT_BROWSER_PATH, fields: { challengeRef: ref } };
  }
  async authorize(challengeRef: string, parent: BrowserParent | null): Promise<string> {
    if (!opaque(challengeRef)) throw new RuntimeError('unauthorized');
    const c = await this.store.read<Challenge>('challenge:' + challengeRef);
    if (!c || c.expiresAt <= Date.now() || !await this.store.claim(hash('challenge:' + challengeRef), c.expiresAt)) throw new RuntimeError('unauthorized');
    // Account change/reverification invalidates the previous proof even on denial.
    const proofRef = randomRef(), expiresAt = Date.now() + 30000;
    await this.store.put('active:' + c.browser, { proofRef }, expiresAt);
    const g = await this.store.read<GrantRecord>('grant:' + c.continuationRef);
    if (!parent || !g || g.browser !== c.browser || g.subject !== parent.subject || !await this.store.live(parent.subject, parent.session)) throw new RuntimeError('unauthorized');
    const proof: Proof = { ...c, expiresAt, subject: parent.subject, session: parent.session, accountContextRef: g.accountContextRef, verifiedAt: Date.now() };
    await this.store.put('proof:' + proofRef, proof, expiresAt, true);
    return proofRef;
  }
  async resolve(proofRef: string, browser: string, continuationRef?: string) {
    if (!opaque(proofRef)) throw new RuntimeError('unauthorized');
    const p = await this.store.read<Proof>('proof:' + proofRef);
    const active = await this.store.read<{ proofRef: string }>('active:' + browser);
    if (!p || p.expiresAt <= Date.now() || p.browser !== browser || active?.proofRef !== proofRef ||
      continuationRef !== undefined && p.continuationRef !== continuationRef || !await this.store.live(p.subject, p.session)) throw new RuntimeError('unauthorized');
    const g = await this.store.read<GrantRecord>('grant:' + p.continuationRef);
    if (!g || g.subject !== p.subject || g.browser !== browser || g.accountContextRef !== p.accountContextRef) throw new RuntimeError('unauthorized');
    return { proof: p, grant: g };
  }
  async browser(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.origin !== ASK_PREVIEW || url.pathname !== GRANT_BROWSER_PATH || url.search) throw new RuntimeError('invalid');
    if (request.method === 'POST') {
      if (request.headers.get('origin') !== MOVE_PREVIEW || request.headers.get('content-type')?.split(';')[0] !== 'application/x-www-form-urlencoded') throw new RuntimeError('unauthorized');
      const form = new URLSearchParams((await boundedBody(request, 1024)).toString('utf8'));
      const ref = form.get('challengeRef');
      if ([...form.keys()].join() !== 'challengeRef' || !opaque(ref) || !await this.store.read('challenge:' + ref)) throw new RuntimeError('unauthorized');
      return new Response(null, { status: 303, headers: { ...PRIVATE_HEADERS, Location: GRANT_BROWSER_PATH,
        'Set-Cookie': `${COOKIE}=${ref}; Path=${GRANT_BROWSER_PATH}; HttpOnly; Secure; SameSite=Lax; Max-Age=90` } });
    }
    if (request.method !== 'GET') throw new RuntimeError('invalid');
    const ref = request.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
    const parent = await this.parent(request);
    const proofRef = await this.authorize(ref ?? '', parent), nonce = randomRef();
    const message = JSON.stringify({ type: 'v23-current-grant', proofRef });
    return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>My TrustHub confirmation</title><p role="status">Your current account was checked. You can return to Move.</p><script nonce="${nonce}">if(window.opener)window.opener.postMessage(${message},${JSON.stringify(MOVE_PREVIEW)});window.close();</script></html>`,
      { headers: { ...PRIVATE_HEADERS, 'Content-Type': 'text/html; charset=utf-8', 'Cross-Origin-Opener-Policy': 'unsafe-none',
        'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`,
        'Set-Cookie': `${COOKIE}=; Path=${GRANT_BROWSER_PATH}; HttpOnly; Secure; SameSite=Lax; Max-Age=0` } });
  }
}
