import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { accessMode, accountFormAvailable, accountRuntime, admitted, captchaState, emailRequestAllowed, PARENT_BACKEND, PARENT_ORIGIN, previewAccountAccess, recentVerifiedAuthentication, registrationAllowed, safeReturn, type AccountEnv } from './account-policy.ts';
import { EMAIL_MESSAGE, RECOVERY_MESSAGE, runAccountOperation, type AuthApi, type Diagnostic, type AccountResult } from './account-service.ts';
import { exchangeAccountCode } from './account-callback.ts';
import { importRequestKey, retireAcknowledged } from './guest-retirement.ts';
import { applySessionCookieWrite } from './cookie-writes.ts';

const env: AccountEnv = { MY_TRUSTHUB_ENABLED: 'true', MY_TRUSTHUB_ACCESS_MODE: 'public', MY_TRUSTHUB_SIGNUP_ENABLED: 'true', MY_TRUSTHUB_AUTH_SECURITY_READY: 'true', NEXT_PUBLIC_MY_TRUSTHUB_TURNSTILE_SITE_KEY: 'fixture-key-not-a-provider-token', VERCEL_ENV: 'production', NEXT_PUBLIC_SITE_URL: PARENT_ORIGIN, NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL: PARENT_BACKEND };
const user = { id: '10000000-0000-4000-8000-000000000001', email: 'ordinary@example.test', email_confirmed_at: '2026-09-19T00:00:00Z', app_metadata: {} };
function form(extra: Record<string, string> = {}) {
  const f = new FormData();
  for (const [key, value] of Object.entries({ email: user.email, password: 'long fixture password', confirmPassword: 'long fixture password', captchaToken: 'mock-only-token', next: '/my/saved', expectedUserId: user.id, ...extra })) f.set(key, value);
  return f;
}
function fixture(options: { signedIn?: boolean; denied?: boolean; error?: { status: number }; autoConfirm?: boolean; stale?: boolean } = {}) {
  let current: typeof user | null = options.signedIn ? user : null;
  const calls: { name: string; input?: unknown }[] = [];
  const record = (name: string, input?: unknown) => { calls.push({ name, input }); };
  const api = {
    getUser: async () => ({ data: { user: current }, error: null }),
    getClaims: async () => ({ data: { claims: { sub: current?.id, amr: [{ method: 'otp', timestamp: Math.floor(Date.now() / 1000) - (options.stale ? 3600 : 0) }] } }, error: null }),
    signUp: async (input: unknown) => { record('signUp', input); return { data: { user, session: options.autoConfirm ? {} : null }, error: options.error ?? null }; },
    signInWithPassword: async (input: unknown) => { record('login', input); current = options.denied ? { ...user, email_confirmed_at: '' } : user; return { data: { user: current }, error: options.error ?? null }; },
    signInWithOtp: async (input: unknown) => { record('link', input); return { error: options.error ?? null }; },
    resetPasswordForEmail: async (...input: unknown[]) => { record('recovery', input); return { error: options.error ?? null }; },
    updateUser: async (input: unknown) => { record('updateUser', input); return { data: { user: current }, error: options.error ?? null }; },
    signOut: async () => { record('signOut'); current = null; return { error: null }; },
    exchangeCodeForSession: async (code: string) => { record('exchange'); current = user; return { data: { redirectType: code === 'recovery-fixture' ? 'recovery' : null }, error: options.error ?? null }; },
  };
  return { api: api as unknown as AuthApi & Parameters<typeof exchangeAccountCode>[0], calls, current: () => current };
}
const quiet = () => {};
test('V2-2 defaults closed to new registration; missing/unknown mode never enables public access', () => {
  assert.equal(accessMode({ MY_TRUSTHUB_CANARY_ONLY: 'false' }), 'internal');
  assert.equal(admitted(user, { ...env, MY_TRUSTHUB_ACCESS_MODE: 'typo' }), false);
  assert.equal(registrationAllowed(user.email, { ...env, MY_TRUSTHUB_SIGNUP_ENABLED: undefined }), false);
});
test('ordinary invitation user needs verified email and server allowlist, not founder claim/business role', () => {
  const pilot = { ...env, MY_TRUSTHUB_ACCESS_MODE: 'invitation', MY_TRUSTHUB_INVITED_EMAILS: user.email };
  assert.equal(admitted(user, pilot), true);
  assert.equal(registrationAllowed(user.email, pilot), true);
  assert.equal(admitted({ ...user, email_confirmed_at: undefined }, pilot), false);
  assert.equal(admitted({ ...user, email: 'other@example.test', app_metadata: { business: true } }, pilot), false);
  assert.equal(admitted(user, { ...pilot, MY_TRUSTHUB_ENABLED: 'false' }), false);
});
test('founder internal eligibility remains claim AND approved subject, ID-only can request existing-user link', () => {
  const internal = { ...env, MY_TRUSTHUB_ACCESS_MODE: 'internal', MY_TRUSTHUB_CANARY_USER_IDS: user.id };
  assert.equal(admitted(user, internal), false);
  assert.equal(admitted({ ...user, app_metadata: { my_trusthub_canary: true } }, internal), true);
  assert.equal(emailRequestAllowed(user.email, internal), true);
  assert.equal(registrationAllowed(user.email, internal), false);
});
test('production origin/backend exact binding; missing, localhost, alternate project and credentials denied', () => {
  assert.deepEqual(accountRuntime(env), { origin: PARENT_ORIGIN, backend: PARENT_BACKEND });
  for (const bad of [undefined, '', 'http://localhost:3000', 'https://evil.example', `${PARENT_ORIGIN}/path`, 'https://user:password@www.asktrusthub.com']) assert.equal(accountRuntime({ ...env, NEXT_PUBLIC_SITE_URL: bad }), null);
  assert.equal(accountRuntime({ ...env, NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL: 'https://other.supabase.co' }), null);
});
test('preview requires an explicit isolated pair and cannot use production Auth/database', () => {
  const preview = { ...env, VERCEL_ENV: 'preview' };
  assert.equal(accountRuntime(preview), null);
  const local = { ...preview, NEXT_PUBLIC_SITE_URL: 'http://localhost:3032', NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL: 'http://127.0.0.1:54321', MY_TRUSTHUB_TEST_ORIGIN: 'http://localhost:3032', MY_TRUSTHUB_TEST_SUPABASE_URL: 'http://127.0.0.1:54321', MY_TRUSTHUB_NONPRODUCTION_APPROVED: 'true' };
  assert.ok(accountRuntime(local));
  assert.equal(accountRuntime({ ...local, NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL: PARENT_BACKEND, MY_TRUSTHUB_TEST_SUPABASE_URL: PARENT_BACKEND }), null);
});
test('normalized return allowlist preserves supported task and rejects malicious/recursive destinations', () => {
  for (const path of ['/my/saved', '/my/projects', `/my/projects/${user.id}`, `/my/sessions/${user.id}`, '/my/you']) assert.equal(safeReturn(path), path);
  assert.equal(safeReturn('/my/projects/../saved'), '/my/saved');
  for (const path of ['/my/../../ask', '/my/%2e%2e/ask', '/my/..%5c..%5cevil', '//evil.example', '/\\evil.example', 'https://evil.example', '/my/sign-in', '/my/recover', '/my/handoff/finish', '/auth/callback', '/my/saved?notes=private', '/my/saved#secret', '/my/%252e%252e/ask', '/my/%', '/my/%00saved', '', null]) assert.equal(safeReturn(path), '/my', String(path));
});
test('signup requires explicit security readiness and confirmation, never admits immediate session', async () => {
  const sdk = fixture();
  const result = await runAccountOperation('signup', form(), sdk.api, env, quiet);
  assert.ok(result.message); assert.equal(result.destination, undefined);
  assert.equal(sdk.calls[0].name, 'signUp');
  assert.match(JSON.stringify(sdk.calls[0].input), /auth\/callback\?next=%2Fmy%2Fsaved/);
  const unsafe = fixture({ autoConfirm: true });
  assert.ok((await runAccountOperation('signup', form(), unsafe.api, env, quiet)).error);
  assert.equal(unsafe.calls.at(-1)?.name, 'signOut');
  const unready = fixture();
  assert.ok((await runAccountOperation('signup', form(), unready.api, { ...env, MY_TRUSTHUB_AUTH_SECURITY_READY: undefined }, quiet)).error);
  assert.equal(unready.calls.length, 0);
});
test('signup OFF still permits returning password login and preserves task', async () => {
  const sdk = fixture();
  const result = await runAccountOperation('login', form(), sdk.api, { ...env, MY_TRUSTHUB_SIGNUP_ENABLED: 'false' }, quiet);
  assert.equal(result.destination, '/my/saved'); assert.equal(sdk.current()?.id, user.id);
  assert.equal(sdk.calls.some(c => c.name === 'signUp'), false);
});
test('optional magic link never creates a user with signup on or off', async () => {
  for (const toggle of ['true', 'false']) {
    const sdk = fixture();
    assert.equal((await runAccountOperation('link', form(), sdk.api, { ...env, MY_TRUSTHUB_SIGNUP_ENABLED: toggle }, quiet)).message, EMAIL_MESSAGE);
    assert.equal((sdk.calls[0].input as { options: { shouldCreateUser: boolean } }).options.shouldCreateUser, false);
    assert.equal(await exchangeAccountCode(sdk.api, 'verified-link-fixture', '/my/saved', env), '/my/saved?auth=complete');
    assert.equal(sdk.current()?.id, user.id);
  }
});
test('password login rejects unconfirmed/ineligible users and clears their session', async () => {
  for (const config of [{ denied: true }, {}]) {
    const sdk = fixture(config);
    const policy = config.denied ? env : { ...env, MY_TRUSTHUB_ACCESS_MODE: 'invitation' };
    assert.ok((await runAccountOperation('login', form(), sdk.api, policy, quiet)).error);
    assert.equal(sdk.current(), null);
  }
});
test('account switching cannot silently replace an existing session', async () => {
  const sdk = fixture({ signedIn: true });
  assert.ok((await runAccountOperation('login', form({ email: 'other@example.test' }), sdk.api, env, quiet)).error);
  assert.equal(sdk.current()?.id, user.id); assert.equal(sdk.calls.length, 0);
});
test('a late email callback cannot replace an account signed in after the email was requested', async () => {
  const sdk = fixture({ signedIn: true });
  assert.match(await exchangeAccountCode(sdk.api, 'older-link', '/my/saved', env), /error=callback_exchange/);
  assert.equal(sdk.current()?.id, user.id); assert.equal(sdk.calls.length, 0);
});
test('recovery requires verified provider exchange; flags do not grant password authority', async () => {
  const sdk = fixture();
  assert.equal((await runAccountOperation('recovery', form(), sdk.api, env, quiet)).message, RECOVERY_MESSAGE);
  assert.ok((await runAccountOperation('password', form({ recovery: '1' }), sdk.api, env, quiet)).error);
  assert.equal(await exchangeAccountCode(sdk.api, 'recovery-fixture', '/my/projects', env, true), '/my/reset-password?next=%2Fmy%2Fprojects');
  const changed = await runAccountOperation('password', form(), sdk.api, env, quiet);
  assert.equal(changed.completion, 'password'); assert.equal(sdk.calls.some(c => c.name === 'signUp'), false);
  assert.equal(sdk.current(), null);
});
test('passwordless existing user updates same subject; stale authentication or switched owner denied', async () => {
  const sdk = fixture({ signedIn: true });
  assert.equal((await runAccountOperation('password', form(), sdk.api, env, quiet)).completion, 'password');
  assert.deepEqual(sdk.calls.map(c => c.name), ['updateUser', 'signOut']);
  for (const options of [{ stale: true }, {}]) {
    const fail = fixture({ signedIn: true, ...options });
    assert.ok((await runAccountOperation('password', form(options.stale ? {} : { expectedUserId: 'different-user' }), fail.api, env, quiet)).error);
    assert.equal(fail.calls.length, 0);
  }
  assert.equal(recentVerifiedAuthentication({ sub: user.id, recovery: true }, user.id), false);
  assert.equal(recentVerifiedAuthentication({ sub: user.id, amr: [{ method: 'magiclink', timestamp: Math.floor(Date.now() / 1000) }] }, user.id), true);
});
test('expired/invalid/reused PKCE exchange retains safe recovery destination and never authorizes', async () => {
  const sdk = fixture({ error: { status: 400 } });
  for (const code of [null, 'invalid', 'expired', 'reused']) assert.equal(await exchangeAccountCode(sdk.api, code, '/my/saved', env), '/my/sign-in?error=callback_exchange&next=%2Fmy%2Fsaved');
});
test('CAPTCHA missing configuration/token fail without provider call; provider errors have generic public response', async () => {
  assert.equal(captchaState({}, ''), 'unconfigured'); assert.equal(captchaState(env, ''), 'missing');
  for (const [policy, data] of [[{ ...env, NEXT_PUBLIC_MY_TRUSTHUB_TURNSTILE_SITE_KEY: undefined }, form()], [env, form({ captchaToken: '' })]] as const) {
    const sdk = fixture(); assert.ok((await runAccountOperation('login', data, sdk.api, policy, quiet)).error); assert.equal(sdk.calls.length, 0);
  }
  for (const operation of ['link', 'recovery'] as const) {
    const outputs: AccountResult[] = [];
    for (const status of [400, 429, 500]) outputs.push(await runAccountOperation(operation, form(), fixture({ error: { status } }).api, env, quiet));
    outputs.push(await runAccountOperation(operation, form(), fixture().api, { ...env, MY_TRUSTHUB_ACCESS_MODE: 'invitation' }, quiet));
    assert.ok(outputs.every(o => o.message === outputs[0].message));
  }
});
test('diagnostics contain bounded categories, not email/password/provider message', async () => {
  const events: Diagnostic[] = [];
  await runAccountOperation('link', form(), fixture({ error: { status: 429 } }).api, env, d => events.push(d));
  assert.deepEqual(events, ['rate_limited']);
});

const raw = JSON.stringify({ version: 'mytrusthub-guest/v1', items: [{ client_item_id: 'a', notes: 'original' }, { client_item_id: 'b' }, { client_item_id: 'unsupported' }] });
const acknowledgment = { ownerId: user.id, importId: 'durable-fixture-receipt', itemIds: ['a'] };
test('selected successful/partial receipt only retires exact acknowledged items', () => {
  const retained = JSON.parse(retireAcknowledged(raw, raw, ['a', 'b'], acknowledgment, user.id));
  assert.deepEqual(retained.items.map((i: { client_item_id: string }) => i.client_item_id), ['b', 'unsupported']);
  assert.equal(retireAcknowledged(raw, raw, ['b'], acknowledgment, user.id), raw);
});
test('failed/forged URL/account-switch receipt cannot erase local research', () => {
  assert.equal(retireAcknowledged(raw, raw, ['a'], undefined, user.id), raw);
  assert.equal(retireAcknowledged(raw, raw, ['a'], acknowledgment, 'other-user'), raw);
  assert.equal(retireAcknowledged(raw, raw, ['a'], { ...acknowledgment, itemIds: [] }, user.id), raw);
});
test('local edits and new items during pending import are retained', () => {
  const current = JSON.parse(raw); current.items[0].notes = 'edited'; current.items.push({ client_item_id: 'new' });
  assert.equal(retireAcknowledged(JSON.stringify(current), raw, ['a'], acknowledgment, user.id), JSON.stringify(current));
});
test('duplicate cleanup retry is idempotent; import request key stable across reload and selection ordering', async () => {
  const once = retireAcknowledged(raw, raw, ['a'], acknowledgment, user.id);
  assert.equal(retireAcknowledged(once, raw, ['a'], acknowledgment, user.id), once);
  assert.equal(await importRequestKey(user.id, raw, ['a', 'b'], ''), await importRequestKey(user.id, raw, ['b', 'a'], ''));
  assert.notEqual(await importRequestKey(user.id, raw, ['a'], ''), await importRequestKey('other', raw, ['a'], ''));
});
test('source boundaries: owner check precedes RPC, receipt RLS retained, no Watch/import query cleanup', () => {
  const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
  const actions = read('app/my/actions.ts');
  for (const name of ['commitGuestImportAction', 'commitGuestSessionImportAction']) {
    const section = actions.slice(actions.indexOf(`export async function ${name}`)).split('\nexport ')[0];
    assert.ok(section.indexOf("formData.get('expectedUserId') !== user.id") < section.indexOf('const receipt = await adapter.commit'));
    assert.ok(section.includes('guestImportReceiptItems')); assert.ok(!section.includes('startWatch'));
  }
  for (const path of ['components/my-trusthub/guest-restore.tsx', 'components/my-trusthub/guest-session-restore.tsx', 'components/my-trusthub/guest-import.tsx']) {
    assert.ok(!read(path).includes('importComplete')); assert.ok(!read(path).includes('removeItem('));
  }
  const sql = read('supabase/migrations/20260907190000_my_trusthub_saved_projects_guest_import.sql');
  assert.ok(sql.includes('consumer_guest_import_items_select_own')); assert.ok(sql.includes('i.user_id = (select auth.uid())'));
});
test('UI privacy/accessibility and event cutover contracts', () => {
  const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  const ui = read('components/my-trusthub/account-form.tsx');
  for (const expected of ['autoComplete="username"', "'new-password' : 'current-password'", 'aria-pressed={show}', 'data-ph-mask="true"', 'feedback.current?.focus()', "operation === 'signup' ? 'account_signup_started'", "'account_login_started'"]) assert.ok(ui.includes(expected), expected);
  const captcha = read('components/my-trusthub/turnstile-field.tsx');
  for (const expected of ['resetKey', "'expired-callback'", "'error-callback'", "size: 'flexible'"]) assert.ok(captcha.includes(expected));
  assert.ok(!read('components/my-trusthub/account-entry.tsx').includes('canonical account'));
  assert.ok(read('lib/supabase/middleware.ts').includes('auth.getUser()'));
  assert.ok(read('lib/supabase/server.ts').includes('cookieStore.set(name, value, options)'));
});

test('V2-2R security-readiness errors cannot reveal invitation eligibility', async () => {
  const policy = { ...env, MY_TRUSTHUB_ACCESS_MODE: 'invitation', MY_TRUSTHUB_INVITED_EMAILS: user.email, MY_TRUSTHUB_AUTH_SECURITY_READY: 'false' };
  const eligible = fixture(), other = fixture();
  const a = await runAccountOperation('signup', form(), eligible.api, policy, quiet);
  const b = await runAccountOperation('signup', form({ email: 'unknown@example.test' }), other.api, policy, quiet);
  assert.deepEqual(a, b);
  assert.equal(eligible.calls.length + other.calls.length, 0);
});

test('V2-2R failed sign-out after password update must not report a completed sign-out', async () => {
  const sdk = fixture({ signedIn: true });
  sdk.api.signOut = async () => ({ error: { name: 'AuthApiError', status: 503, message: 'private provider detail' } } as Awaited<ReturnType<AuthApi['signOut']>>);
  const result = await runAccountOperation('password', form(), sdk.api, env, quiet);
  assert.equal(result.completion, undefined);
  assert.equal(result.destination, undefined);
  assert.match(result.error ?? '', /sign.out/i);
  assert.ok(!JSON.stringify(result).includes('private provider detail'));
});

test('V2-2R acknowledgment never rewrites a shared legacy localStorage bundle', () => {
  // A second tab can edit between getItem and setItem, even without an await.
  // Current writers do not share a transactional lock: retaining the local copy
  // is the only safe retirement policy until V2-3 introduces atomic revisions.
  const source = readFileSync(new URL('../../components/my-trusthub/guest-import.tsx', import.meta.url), 'utf8');
  assert.ok(!source.includes('localStorage.setItem('));
  assert.ok(!source.includes('localStorage.removeItem('));
  assert.ok(source.includes('Local copies were kept'));
});

test('V2-2R password length permits passphrases without composition rules; existing login minimum unchanged', async () => {
  for (const password of ['a'.repeat(11), 'a'.repeat(129)]) {
    const sdk = fixture();
    assert.ok((await runAccountOperation('signup', form({ password, confirmPassword: password }), sdk.api, env, quiet)).error);
    assert.equal(sdk.calls.length, 0);
  }
  const passphrase = 'only lowercase words are accepted';
  assert.ok((await runAccountOperation('signup', form({ password: passphrase, confirmPassword: passphrase }), fixture().api, env, quiet)).message);
  const login = fixture();
  assert.equal((await runAccountOperation('login', form({ password: 'legacy' }), login.api, env, quiet)).completion, 'login');
});

test('V2-2R rate limits never trigger automatic Auth retries or reveal provider details', async () => {
  for (const operation of ['signup', 'login', 'link', 'recovery'] as const) {
    const sdk = fixture({ error: { status: 429 } });
    const events: Diagnostic[] = [];
    const result = await runAccountOperation(operation, form(), sdk.api, env, d => events.push(d));
    assert.equal(sdk.calls.filter(c => c.name !== 'signOut').length, 1);
    assert.ok(events.includes('rate_limited'));
    assert.ok(!JSON.stringify(result).includes(user.email));
  }
});

test('V2-2R mutable Auth cookie failures propagate safely; read-only render may defer refresh', () => {
  let reports = 0;
  const failure = () => { throw new Error('private cookie value'); };
  assert.throws(() => applySessionCookieWrite(failure, true, () => reports++), { message: 'SESSION_COOKIE_WRITE_FAILED' });
  assert.doesNotThrow(() => applySessionCookieWrite(failure, false, () => reports++));
  let written = false;
  applySessionCookieWrite(() => { written = true; }, true, () => reports++);
  assert.equal(written, true); assert.equal(reports, 2);
  for (const path of ['app/my/account-actions.ts', 'app/auth/callback/route.ts']) {
    assert.ok(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8').includes('createMyTrustHubSupabaseClient(true)'));
  }
});

const ISOLATED_BACKEND = 'https://xkkiicsassizmakcvxml.supabase.co';
const PREVIEW_ORIGIN = 'https://conumers-trust-example-savitz25-s-projects.vercel.app';
function previewAccessEnv(extra: AccountEnv = {}): AccountEnv {
  return {
    VERCEL_ENV: 'preview',
    MY_TRUSTHUB_ENABLED: 'false',
    MY_TRUSTHUB_SIGNUP_ENABLED: 'false',
    MY_TRUSTHUB_EMAIL_ENABLED: 'false',
    MY_TRUSTHUB_PREVIEW_ACCOUNT_ACCESS: 'true',
    MY_TRUSTHUB_ACCESS_MODE: 'invitation',
    MY_TRUSTHUB_INVITED_USER_IDS: user.id,
    MY_TRUSTHUB_NONPRODUCTION_APPROVED: 'true',
    NEXT_PUBLIC_SITE_URL: PREVIEW_ORIGIN,
    NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL: ISOLATED_BACKEND,
    MY_TRUSTHUB_TEST_ORIGIN: PREVIEW_ORIGIN,
    MY_TRUSTHUB_TEST_SUPABASE_URL: ISOLATED_BACKEND,
    NEXT_PUBLIC_MY_TRUSTHUB_TURNSTILE_SITE_KEY: 'fixture-key-not-a-provider-token',
    ...extra,
  };
}

test('preview account access signs in an invited confirmed user and keeps signup, mail, and public admission closed', async () => {
  const policy = previewAccessEnv();
  assert.equal(previewAccountAccess(policy), true);
  assert.equal(accountFormAvailable('login', policy), true);
  for (const operation of ['signup', 'link', 'recovery', 'password'] as const) assert.equal(accountFormAvailable(operation, policy), false);
  assert.equal(admitted(user, policy), true);
  assert.equal(admitted({ ...user, email_confirmed_at: undefined }, policy), false);
  assert.equal(admitted({ ...user, id: '20000000-0000-4000-8000-000000000002' }, policy), false);
  assert.equal(admitted(user, { ...policy, MY_TRUSTHUB_ACCESS_MODE: 'public' }), false);
  assert.equal(registrationAllowed(user.email, policy), false);
  assert.equal(emailRequestAllowed(user.email, policy), false);
  const sdk = fixture();
  const login = await runAccountOperation('login', form(), sdk.api, policy, quiet);
  assert.equal(login.destination, '/my/saved');
  assert.equal(sdk.current()?.id, user.id);
  assert.equal(sdk.calls.some(call => call.name === 'signUp' || call.name === 'link' || call.name === 'recovery'), false);
  for (const operation of ['signup', 'link', 'recovery'] as const) {
    const blocked = fixture();
    const result = await runAccountOperation(operation, form(), blocked.api, policy, quiet);
    assert.equal(result.error, 'Account access is unavailable in this environment.');
    assert.equal(blocked.calls.length, 0);
  }
  const missingCaptcha = fixture();
  assert.match((await runAccountOperation('login', form({ captchaToken: '' }), missingCaptcha.api, policy, quiet)).error ?? '', /security check/i);
  assert.equal(missingCaptcha.calls.length, 0);
});

test('preview account access is ignored in production and without an isolated pair', async () => {
  const production = { ...env, MY_TRUSTHUB_ENABLED: 'false', MY_TRUSTHUB_PREVIEW_ACCOUNT_ACCESS: 'true', MY_TRUSTHUB_ACCESS_MODE: 'invitation', MY_TRUSTHUB_INVITED_USER_IDS: user.id };
  assert.equal(previewAccountAccess(production), false);
  assert.equal(admitted(user, production), false);
  assert.equal(accountFormAvailable('login', production), false);
  const sdk = fixture();
  assert.equal((await runAccountOperation('login', form(), sdk.api, production, quiet)).error, 'Account access is unavailable in this environment.');
  assert.equal(sdk.calls.length, 0);
  const unbound = previewAccessEnv({ NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL: PARENT_BACKEND, MY_TRUSTHUB_TEST_SUPABASE_URL: PARENT_BACKEND });
  assert.equal(accountRuntime(unbound), null);
  assert.equal(previewAccountAccess(unbound), false);
  assert.equal((await runAccountOperation('login', form(), fixture().api, unbound, quiet)).error, 'Account access is unavailable in this environment.');
  const flagOff = previewAccessEnv({ MY_TRUSTHUB_PREVIEW_ACCOUNT_ACCESS: 'false' });
  assert.equal(accountFormAvailable('login', flagOff), false);
  assert.match(readFileSync(new URL('./feature-flags.ts', import.meta.url), 'utf8'), /MY_TRUSTHUB_ENABLED/);
  assert.doesNotMatch(readFileSync(new URL('./feature-flags.ts', import.meta.url), 'utf8'), /PREVIEW_ACCOUNT_ACCESS/);
  assert.match(readFileSync(new URL('../../components/my-trusthub/account-entry.tsx', import.meta.url), 'utf8'), /accountFormAvailable/);
  assert.match(readFileSync(new URL('../../app/auth/callback/route.ts', import.meta.url), 'utf8'), /MY_TRUSTHUB_ENABLED/);
});

test('V2-2R trailing-dot DNS aliases cannot bypass production backend exclusion', () => {
  const alias = `${PARENT_BACKEND}.`;
  const preview = { ...env, VERCEL_ENV: 'preview', NEXT_PUBLIC_SITE_URL: 'http://localhost:3032', NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL: alias, MY_TRUSTHUB_NONPRODUCTION_APPROVED: 'true', MY_TRUSTHUB_TEST_ORIGIN: 'http://localhost:3032', MY_TRUSTHUB_TEST_SUPABASE_URL: alias };
  assert.equal(accountRuntime(preview), null);
  assert.equal(accountRuntime({ ...preview, NEXT_PUBLIC_SITE_URL: `${PARENT_ORIGIN}.`, MY_TRUSTHUB_TEST_ORIGIN: `${PARENT_ORIGIN}.` }), null);
});
