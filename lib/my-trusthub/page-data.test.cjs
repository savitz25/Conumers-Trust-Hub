const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function fixture({ enabled = true, available = true, signedIn = false } = {}) {
  const user = signedIn ? { id: 'synthetic' } : null;
  const adapter = { getUser: async () => user };
  const compile = (path, mocks = {}) => {
    const context = { exports: {}, require: name => { assert.ok(name in mocks, name); return mocks[name]; } };
    vm.runInNewContext(ts.transpileModule(readFileSync(resolve(__dirname, path), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
    return context.exports;
  };
  const gate = compile('workspace-gate.ts');
  const module = compile('page-data.ts', {
    'server-only': {}, 'next/headers': { cookies: async () => ({}) },
    'next/navigation': { redirect: href => { throw Object.assign(Error('redirect'), { href }); } },
    '@/lib/my-trusthub/feature-flags': { isMyTrustHubFeatureEnabled: () => enabled },
    '@/lib/my-trusthub/production-adapter': { ProductionMyTrustHubAdapter: { create: async () => available ? adapter : null } },
    '@/lib/my-trusthub/workspace-gate': gate,
  });
  return { ...module, user, adapter };
}

for (const path of ['/my/saved', '/my/projects']) {
  test(`${path}: signed-out destination survives redirect`, async () => {
    await assert.rejects(fixture().requireWorkspace(path), e => e.href === '/my/sign-in?next=' + encodeURIComponent(path));
  });
  test(`${path}: disabled and missing-adapter gates retain policy and destination`, async () => {
    await assert.rejects(fixture({ enabled: false }).requireWorkspace(path), e => e.href === '/my/sign-in?next=' + encodeURIComponent(path));
    await assert.rejects(fixture({ available: false }).requireWorkspace(path), e => e.href === '/my/sign-in?configuration=missing&next=' + encodeURIComponent(path));
  });
  test(`${path}: page passes its fixed destination`, () => {
    const source = readFileSync(resolve(__dirname, '../../app', path.slice(1), 'page.tsx'), 'utf8');
    assert.ok(source.includes(`requireWorkspace("${path}")`));
  });
}
test('existing callers retain bare sign-in and unsupported destinations cannot enter next', async () => {
  for (const path of [undefined, 'https://example.test', '//example.test', '/my/saved?handoff=saved', '/my/../manage']) {
    await assert.rejects(fixture().requireWorkspace(path), e => e.href === '/my/sign-in');
  }
});
test('signed-in workspace access is unchanged', async () => {
  const f = fixture({ signedIn: true });
  const result = await f.requireWorkspace('/my/saved');
  assert.equal(result.adapter, f.adapter); assert.equal(result.user, f.user);
});
