/** LOCAL HARNESS ONLY: real-browser regression for the one-click Save / Unsave
 * redirect chain. A real Chrome drives the production-shaped flow against the
 * real confirmation handler:
 *
 *   source profile (site A) -> cross-site form POST /my/profile-save (site B)
 *   -> 303 + confirmation cookie -> GET /my/profile-save -> verified parent
 *   Save / removal -> 303 back to the source profile
 *
 * The parent session is a real SameSite=Lax cookie, so it is absent on the
 * cross-site POST and present on the follow-up GET exactly as in production.
 * `localhost` and `127.0.0.1` are different sites, which gives the cross-site
 * hop without any network or credential. Skips when no Chrome is installed.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handleProfileConfirmation, PROFILE_CONFIRM_PATH } from '../../lib/my-trusthub/profile-save/browser.ts';
import { fixture } from '../../lib/my-trusthub/profile-save/browser.fixture.ts';

const CHROME = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(path => path && existsSync(path));
if (!CHROME) { console.log('SKIP v23-direct-redirect-chain: no Chrome found (set CHROME_PATH)'); process.exit(0); }

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(check: () => boolean, label: string, ms = 15000) {
  for (const start = Date.now(); Date.now() - start < ms;) { if (check()) return; await sleep(50); }
  throw new Error('timeout: ' + label);
}
const listen = (handler: (q: IncomingMessage, r: ServerResponse) => void) => new Promise<{ port: number; close(): void }>(resolve => {
  const server = createServer(handler);
  server.listen(0, () => resolve({ port: (server.address() as AddressInfo).port, close: () => { server.closeAllConnections(); server.close(); } }));
});
const cookieOf = (q: IncomingMessage, name: string) => q.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith(name + '='))?.slice(name.length + 1);

// --- Parent (Ask) and source (Move) servers -------------------------------
type Hop = { method: string; session: boolean; status: number };
const hops: Hop[] = [], profileLoads: string[] = [];
let postDelay = 0, handler: (request: Request) => Promise<Response> = async () => new Response(null, { status: 503 });
const ask = await listen(async (q, r) => {
  const url = new URL(q.url!, askOrigin);
  if (url.pathname === '/login' || url.pathname === '/logout') {
    r.writeHead(200, { 'Set-Cookie': url.pathname === '/login'
      ? `sid=${url.searchParams.get('as')}; Path=/; HttpOnly; SameSite=Lax` : 'sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0', 'Content-Type': 'text/plain' });
    return void r.end('ok');
  }
  if (url.pathname !== PROFILE_CONFIRM_PATH) { r.writeHead(404); return void r.end(); }
  const chunks: Buffer[] = []; for await (const chunk of q) chunks.push(chunk as Buffer);
  if (q.method === 'POST' && postDelay) await sleep(postDelay);
  const headers = new Headers(); for (const [k, v] of Object.entries(q.headers)) if (typeof v === 'string') headers.set(k, v);
  const response = await handler(new Request(askOrigin + url.pathname + url.search, { method: q.method, headers, ...(q.method === 'POST' ? { body: Buffer.concat(chunks) } : {}) }));
  hops.push({ method: q.method!, session: Boolean(cookieOf(q, 'sid')), status: response.status });
  const out: Record<string, string | string[]> = {}; response.headers.forEach((v, k) => { if (k !== 'set-cookie') out[k] = v; });
  const cookies = response.headers.getSetCookie(); if (cookies.length) out['set-cookie'] = cookies;
  r.writeHead(response.status, out); r.end(Buffer.from(await response.arrayBuffer()));
});
const move = await listen((q, r) => {
  if (q.url === '/favicon.ico') { r.writeHead(204); return void r.end(); }
  profileLoads.push(q.url!);
  r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  r.end(`<!doctype html><title>source</title><p>source ${q.url}</p><a id="nav" href="${AWAY}" style="position:fixed;left:0;top:0;width:200px;height:100px;display:block">Away</a><script>
    function go(ref,intent){const f=document.createElement('form');f.method='POST';f.action=${JSON.stringify(`http://127.0.0.1:${ask.port}${PROFILE_CONFIRM_PATH}`)};
      for(const [n,v] of [['continuationRef',ref],['intent',intent]]){const i=document.createElement('input');i.type='hidden';i.name=n;i.value=v;f.append(i);}
      document.body.append(f);f.submit();}
  </script>`);
});
const lenderMode = process.argv.includes('--lender');
const askOrigin = `http://127.0.0.1:${ask.port}`, moveOrigin = `http://localhost:${move.port}`;
const PROFILE = lenderMode ? '/lenders/pacific-trust-mortgage' : '/companies/fixture-mover';
const AWAY = lenderMode ? '/my-lending' : '/my-move';

const f = await fixture(lenderMode
  ? { origin: askOrigin, sourceOrigin: moveOrigin, hub: 'lender', slug: 'pacific-trust-mortgage', nativeId: 'nmls:1984721' }
  : { origin: askOrigin, sourceOrigin: moveOrigin });
// The verified parent is whoever the browser's own session cookie names.
f.b.parent = async request => {
  const sid = request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith('sid='))?.slice(4);
  return sid ? { subject: sid, session: 'session-' + sid, label: 'Test account' } : null;
};
handler = request => handleProfileConfirmation(request, f.b);

// --- Minimal CDP driver over the built-in WebSocket ------------------------
const profile = mkdtempSync(join(tmpdir(), 'v23-chain-'));
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run',
  '--no-default-browser-check', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
let failure: unknown = null;
try {
  const portFile = join(profile, 'DevToolsActivePort');
  await until(() => existsSync(portFile) && readFileSync(portFile, 'utf8').includes('\n'), 'chrome start', 30000);
  const debugPort = readFileSync(portFile, 'utf8').split('\n')[0];
  let target: { webSocketDebuggerUrl: string } | undefined;
  await until(() => { void fetch(`http://127.0.0.1:${debugPort}/json`).then(x => x.json()).then((list: Array<{ type: string; webSocketDebuggerUrl: string }>) => { target ??= list.find(t => t.type === 'page'); }).catch(() => {}); return !!target; }, 'page target');
  const socket = new WebSocket(target!.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0; const waiting = new Map<number, (value: { result?: unknown; error?: unknown }) => void>();
  socket.onmessage = event => { const m = JSON.parse(String(event.data)); if (m.id && waiting.has(m.id)) { waiting.get(m.id)!(m); waiting.delete(m.id); } };
  const cdp = (method: string, params: object = {}) => new Promise<{ result?: { result?: { value?: unknown } }; error?: unknown }>(resolve => { waiting.set(++id, resolve as never); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async (expression: string) => (await cdp('Runtime.evaluate', { expression, returnByValue: true })).result?.result?.value;
  const open = async (url: string) => {
    const before = profileLoads.length, isProfile = url.startsWith(moveOrigin);
    await cdp('Page.navigate', { url });
    await until(() => !isProfile || profileLoads.length > before, 'open ' + url);
    await until(() => false, 'settle', 300).catch(() => {});
  };
  await cdp('Page.enable');
  /** One click on the source profile; resolves when the browser is back on it. */
  const click = async (intent: 'save' | 'unsave') => {
    const ref = (await f.stage()).continuationRef, from = hops.length, loads = profileLoads.length;
    await evaluate(`go(${JSON.stringify(ref)},${JSON.stringify(intent)})`);
    await until(() => profileLoads.length > loads, intent + ' returns to the source profile');
    return hops.slice(from);
  };
  const chain = (seen: Hop[]) => seen.map(h => `${h.method}:${h.session ? 'session' : 'no-session'}:${h.status}`).join(' > ');
  const CHAIN = 'POST:no-session:303 > GET:session:303';

  // 1. Signed in on the parent; one-click Save from the source profile.
  await open(askOrigin + '/login?as=owner-a');
  await open(moveOrigin + PROFILE);
  assert.equal(chain(await click('save')), CHAIN, 'Save: cross-site POST carries no session; the same-site GET does');
  assert.equal(f.backend.count('saves'), 1);
  assert.equal(profileLoads.at(-1), PROFILE);
  assert.equal(chain(await click('save')), CHAIN, 'repeated Save');
  assert.equal(f.backend.count('saves'), 1, 'repeated Save stays one parent row');

  // 2. One-click Unsave: same chain, owner-scoped row removed, acknowledged to the source.
  assert.equal(chain(await click('unsave')), CHAIN, 'Unsave: removal runs on the follow-up GET under the verified session');
  assert.equal(f.backend.count('saves'), 0);
  assert.equal(f.released.length, 1);
  assert.equal(profileLoads.at(-1), PROFILE);

  // 3. Save again, then Unsave again: Save is available again and still one row.
  await click('save'); assert.equal(f.backend.count('saves'), 1);
  await click('unsave'); assert.equal(f.backend.count('saves'), 0); assert.equal(f.released.length, 2);

  // 4. The production failure (2026-10-03): the user clicks away from the
  // profile while the hand-off POST is still in flight. Chrome abandons the
  // chain: the POST is answered 303, the GET never happens, nothing is removed
  // and nothing is acknowledged, so the source must not report an account Unsave.
  await click('save'); assert.equal(f.backend.count('saves'), 1);
  {
    const from = hops.length, released = f.released.length, ref = (await f.stage()).continuationRef;
    postDelay = 1500;
    await evaluate(`go(${JSON.stringify(ref)},'unsave')`);
    await sleep(400);
    // A real user click on the page's "My Move" link.
    for (const type of ['mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x: 50, y: 50, button: 'left', clickCount: 1 });
    await until(() => hops.length > from, 'interrupted POST completes');
    postDelay = 0;
    await sleep(2000);
    assert.equal(chain(hops.slice(from)), 'POST:no-session:303', 'interrupted chain: POST 303 and no follow-up GET');
    assert.equal(profileLoads.at(-1), AWAY);
    assert.equal(f.backend.count('saves'), 1, 'interrupted chain removes nothing');
    assert.equal(f.released.length, released, 'interrupted chain is never acknowledged');
  }

  // 5. A retry from the profile completes the Unsave.
  await open(moveOrigin + PROFILE);
  assert.equal(chain(await click('unsave')), CHAIN);
  assert.equal(f.backend.count('saves'), 0);

  // 6. Signed out: the chain still returns to the profile, removes nothing, acknowledges nothing.
  await click('save'); assert.equal(f.backend.count('saves'), 1);
  await open(askOrigin + '/logout'); await open(moveOrigin + PROFILE);
  const released = f.released.length;
  assert.equal(chain(await click('unsave')), 'POST:no-session:303 > GET:no-session:303');
  assert.equal(f.backend.count('saves'), 1); assert.equal(f.released.length, released);
  socket.close();
  console.log('PASS v23-direct-redirect-chain (real Chrome)' + (lenderMode ? ' lender' : ' move'));
} catch (error) { failure = error; }
finally {
  chrome.kill(); ask.close(); move.close(); f.close();
  await sleep(500); try { rmSync(profile, { recursive: true, force: true }); } catch { /* profile dir still locked */ }
}
if (failure) { console.error(failure); process.exit(1); }
process.exit(0);
