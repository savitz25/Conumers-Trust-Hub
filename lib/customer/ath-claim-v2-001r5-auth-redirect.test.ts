/**
 * ATH-CLAIM-V2-001R5-P1-AUTH-REDIRECT — post-sign-in redirect must never leave the Ask origin.
 * Covers the validator, magic-link CREATION (store) and magic-link CONSUMPTION (verify route target), including
 * a pre-patch/malicious link whose token is still valid. Runs on PGlite; no network, no real email.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { applyCustomerMigrations, enableAppRole } from './migrate.ts';
import { CustomerPlatform } from './store.ts';
import { DEFAULT_NEXT_PATH, internalRedirectUrl, safeInternalNextPath } from './safe-next-path.ts';
import type { SqlClient } from './sql.ts';

const ORIGIN = 'https://www.asktrusthub.com';
const FALLBACK = `${ORIGIN}${DEFAULT_NEXT_PATH}`;

const LEGITIMATE = [
  '/claim/continue',
  '/manage',
  '/admin',
  '/manage/invitations/accept?token=abc123',
  '/manage/invitations/accept?token=Zm9v-_bar%3D',
  '/path?next=%2Fsomething',
  '/claim/status/430da923-d3cf-4eff-a8f4-ae48573f68ba',
  '/manage/56a3f4c5-885d-4dd0-9c54-fe1f501bb7d4#business-information'.split('#')[0],
];

const ATTACKS: Array<[string, unknown]> = [
  ['protocol-relative', '//evil.example/x'],
  ['triple slash', '///evil.example/x'],
  ['slash backslash', '/\\evil.example/x'],
  ['double backslash', '\\\\evil.example/x'],
  ['backslash inside path', '/manage\\@evil.example'],
  ['https', 'https://evil.example/x'],
  ['http', 'http://evil.example/x'],
  ['javascript', 'javascript:alert(1)'],
  ['data', 'data:text/html,x'],
  ['no leading slash', 'evil.example/x'],
  ['relative', 'manage'],
  ['empty', ''],
  ['null', null],
  ['undefined', undefined],
  ['number', 42],
  ['object', { toString: () => '/manage' }],
  ['oversized', `/${'a'.repeat(2048)}`],
  ['newline', '/manage\nLocation: https://evil.example'],
  ['CR', '/manage\r'],
  ['tab', '/manage\t?x=1'],
  ['NUL', '/manage\u0000'],
  ['space', '/ma nage'],
  ['DEL', '/manage\u007f'],
  ['C1 control', '/manage\u0085'],
  ['scheme after slash-space', '/ https://evil.example'],
  ['encoded protocol-relative decoded by nothing', '/%5C%5Cevil.example'.replace(/%5C/g, '\\')],
];

test('validator accepts legitimate internal paths verbatim (query strings preserved)', () => {
  for (const path of LEGITIMATE) {
    assert.equal(safeInternalNextPath(path), path, path);
    assert.equal(internalRedirectUrl(path, ORIGIN), `${ORIGIN}${path}`, path);
    assert.equal(new URL(internalRedirectUrl(path, ORIGIN)).origin, ORIGIN);
  }
});

test('validator fails closed to the fallback for every attack shape and the result is always same-origin', () => {
  for (const [name, value] of ATTACKS) {
    assert.equal(safeInternalNextPath(value), DEFAULT_NEXT_PATH, `${name}: path`);
    const url = internalRedirectUrl(value, ORIGIN);
    assert.equal(url, FALLBACK, `${name}: url`);
    assert.equal(new URL(url).origin, ORIGIN, `${name}: origin`);
  }
  // Percent-encoded slashes stay a same-origin path (the server sees a path segment, not a host).
  assert.equal(new URL(internalRedirectUrl('/%2F%2Fevil.example', ORIGIN)).origin, ORIGIN);
  // A custom fallback is honoured, and the fallback itself is never the attacker's value.
  assert.equal(safeInternalNextPath('//evil.example', '/manage'), '/manage');
});

test('fuzz: 5,000 random candidates never resolve off-origin', () => {
  const alphabet = '/\\:@?#%.abcXYZ0129-_ \t\r\n\u0000\u0085 ';
  let seed = 20260924;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 5000; i += 1) {
    const len = 1 + Math.floor(rnd() * 40);
    let s = '';
    for (let j = 0; j < len; j += 1) s += alphabet[Math.floor(rnd() * alphabet.length)];
    for (const prefix of ['', '/', '//', 'https://', 'evil.example']) {
      const url = internalRedirectUrl(prefix + s, ORIGIN);
      assert.equal(new URL(url).origin, ORIGIN, JSON.stringify(prefix + s));
    }
  }
});

function asSql(db: PGlite): SqlClient { return { async query(text, params) { const r = await db.query(text, params ?? []); return { rows: (r.rows ?? []) as Record<string, unknown>[] }; }, async exec(sql) { await db.exec(sql); } }; }
async function boot() {
  const db = new PGlite(); const sql = asSql(db);
  await applyCustomerMigrations(sql); await db.query('BEGIN'); await enableAppRole(sql);
  const platform = new CustomerPlatform({ sql, cth: { async getExact() { return null; } } as never, mailer: async (m) => ({ sent: true, preview: m.text }), handoffSecret: 'r5-auth-redirect-secret-at-least-32-characters', staffEmails: ['staff@asktrusthub.com'], siteUrl: ORIGIN });
  return { db, platform };
}
const linkOf = (preview?: string) => preview?.match(/https?:\/\/\S+\/api\/customer\/auth\/verify\?[^\s]+/)?.[0] ?? '';

test('magic-link CREATION: the emailed link never embeds an external next; legitimate nexts are kept', async () => {
  const { db, platform } = await boot();
  for (const [name, value] of ATTACKS) {
    if (typeof value !== 'string') continue;
    const sent = await platform.requestMagicLink({ email: `attack-${Math.random().toString(36).slice(2)}@example.test`, nextPath: value });
    const link = new URL(linkOf(sent.preview));
    assert.equal(link.origin, ORIGIN, name);
    assert.equal(link.searchParams.get('next'), DEFAULT_NEXT_PATH, `${name}: next param`);
  }
  for (const path of ['/admin', '/manage', '/manage/invitations/accept?token=abc123', '/claim/continue']) {
    const sent = await platform.requestMagicLink({ email: `legit-${Math.random().toString(36).slice(2)}@example.test`, nextPath: path });
    assert.equal(new URL(linkOf(sent.preview)).searchParams.get('next'), path, path);
  }
  await db.close();
});

test('magic-link CONSUMPTION: a pre-patch/malicious link with a valid token signs in but redirects to the same-origin fallback', async () => {
  const { db, platform } = await boot();
  const sent = await platform.requestMagicLink({ email: 'victim@example.test', nextPath: '/manage' });
  const token = decodeURIComponent(new URL(linkOf(sent.preview)).searchParams.get('token') ?? '');
  // The attacker (or a link issued before this fix) rewrites the next param; the token itself is genuine.
  const crafted = new URL(`${ORIGIN}/api/customer/auth/verify?token=${encodeURIComponent(token)}&next=${encodeURIComponent('//evil.example/x')}`);
  const target = internalRedirectUrl(crafted.searchParams.get('next'), crafted.origin); // exactly what the route does
  const session = await platform.consumeMagicLink(token);
  assert.ok(session.sessionToken, 'sign-in still succeeds');
  assert.equal(target, FALLBACK, 'redirect stays on Ask');
  // Legitimate consumption keeps its next.
  const sent2 = await platform.requestMagicLink({ email: 'owner@example.test', nextPath: '/manage/invitations/accept?token=abc123' });
  const link2 = new URL(linkOf(sent2.preview));
  assert.equal(internalRedirectUrl(link2.searchParams.get('next'), link2.origin), `${ORIGIN}/manage/invitations/accept?token=abc123`);
  await db.close();
});

test('wiring: both ends use the single validator; no route builds a redirect from a raw next', () => {
  const store = readFileSync('lib/customer/store.ts', 'utf8');
  assert.match(store, /const next = safeInternalNextPath\(input\.nextPath\);/);
  assert.doesNotMatch(store, /nextPath\.startsWith\('\/'\)/);
  const verify = readFileSync('app/api/customer/auth/verify/route.ts', 'utf8');
  assert.match(verify, /internalRedirectUrl\(url\.searchParams\.get\('next'\), url\.origin\)/);
  assert.doesNotMatch(verify, /nextRaw|startsWith\('\/'\)/);
  assert.doesNotMatch(verify, /new URL\(next, url\.origin\)/);
});
