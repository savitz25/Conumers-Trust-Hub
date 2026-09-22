// Independent B4 assertions against exact-head loopback specialist component harnesses.
// Run existing QA harnesses first. No production URL, Auth form, or real backend.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, openSync, closeSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir = mkdtempSync(join(tmpdir(), 'b4-v2-3c-'));
let sequence = 0;
function browser(...args) {
  const source = args[0] === 'eval' ? args.pop() : undefined;
  const file = join(dir, `${sequence++}.json`), fd = openSync(file, 'w');
  const child = spawnSync(process.env.AGENT_BROWSER_BIN || 'agent-browser', ['--session', 'b4-independent-v23c', '--json', ...args],
    { input: source, encoding: 'utf8', stdio: ['pipe', fd, 'ignore'], timeout: 30_000 });
  closeSync(fd); assert.ifError(child.error);
  const result = JSON.parse(readFileSync(file, 'utf8')); assert.equal(result.success, true, result.error); return result.data;
}
const evaluate = script => browser('eval', '--stdin', script).result;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(script) { for (let i = 0; i < 50; i++) { if (evaluate(script)) return; await delay(100); } assert.fail(script); }
async function reset(port) {
  browser('open', `http://127.0.0.1:${port}`);
  evaluate('localStorage.clear(); sessionStorage.clear()'); browser('reload');
  await until('Boolean(window.b3 && document.querySelector("button"))');
}
const results = [];
try {
  await reset(4311);
  browser('focus', 'button'); browser('press', 'Enter');
  await until(`document.querySelector('[role=status]')?.textContent.includes('saved on this device')`);
  browser('reload');
  await until(`document.querySelector('[role=status]')?.textContent.includes('saved on this device')`);
  assert.equal(evaluate(`JSON.parse(localStorage.getItem('mth-local-saved-movers')).length`), 1);
  assert.equal(evaluate(`document.querySelector('button').getAttribute('aria-describedby')===document.querySelector('[role=status]').id`), true);
  evaluate(`window.b3.render('b3-test-mover','icon')`);
  await until(`document.querySelector('button')?.getAttribute('aria-label')?.includes('saved on this device')`);
  evaluate(`window.b3.accountContext('owner-a',true)`);
  await until(`document.querySelector('[role=status]')?.textContent.includes('Move account shortlist')`);
  assert.equal(evaluate(`/on this device|saved to My TrustHub/i.test(document.querySelector('[role=status]').textContent)`), false);
  results.push({ id: 'M9', result: 'PASS', evidence: 'BROWSER; owner-confirmed context MOCKED' });

  for (const [hub, port, key, rows] of [['insurance', 4312, 'ith:my-insurance:v1', 'savedProviders'], ['lender', 4313, 'lth:my-lending:v1', 'savedLenders']]) {
    await reset(port); browser('focus', 'button'); browser('press', 'Enter');
    await until(`JSON.parse(localStorage.getItem('${key}')||'{}').${rows}?.length===1`);
    // Seed synthetic research into the existing valid saved plan; then Save a
    // second profile through the actual control, not direct storage mutation.
    evaluate(`const s=JSON.parse(localStorage.getItem('${key}')); s.${rows}[0].notes='synthetic note to retain'; s.plans[0].notes='synthetic plan';
      s.plans[0].${hub === 'insurance' ? 'toolSnapshots' : 'calculatorSnapshots'}=[{id:'fixture-tool',toolId:'fixture',title:'fixture',summary:'fixture',href:'/tools/fixture',capturedAt:'2026-01-01',savedAt:'2026-01-01',inputs:{amount:123},outputs:{amount:456}}];
      ${hub === 'lender' ? "s.plans[0].savedLeComparisons=[{id:'fixture-compare',notes:'synthetic comparison',offers:[]}];" : ''}
      localStorage.setItem('${key}',JSON.stringify(s)); window.b3.seeded=window.b3.storage.loadState(); window.b3.render('second-fixture')`);
    await until(`!document.querySelector('button')?.textContent.includes('In My')`);
    browser('click', 'button'); await until(`JSON.parse(localStorage.getItem('${key}')).${rows}.length===2`);
    assert.equal(evaluate(`JSON.parse(localStorage.getItem('${key}')).${rows}.find(i=>i.${hub === 'insurance' ? 'providerSlug' : 'lenderSlug'}==='b3-fixture').notes`), 'synthetic note to retain');
    assert.equal(evaluate(`JSON.parse(localStorage.getItem('${key}')).plans[0].notes`), 'synthetic plan');
    assert.deepEqual(evaluate(`JSON.parse(localStorage.getItem('${key}')).plans[0].${hub === 'insurance' ? 'toolSnapshots' : 'calculatorSnapshots'}`), evaluate(`window.b3.seeded.plans[0].${hub === 'insurance' ? 'toolSnapshots' : 'calculatorSnapshots'}`));
    if (hub === 'lender') assert.deepEqual(evaluate(`JSON.parse(localStorage.getItem('${key}')).plans[0].savedLeComparisons`), evaluate('window.b3.seeded.plans[0].savedLeComparisons'));
    results.push({ id: `${hub}-research`, result: 'PASS', evidence: 'BROWSER real local store; synthetic notes/plan/tool/comparison preserved' });
    browser('reload'); await until(`document.querySelector('button')?.textContent.includes('In My')`);
    const visible = evaluate('document.body.innerText');
    const disclosure = /on this device|saved locally|device.only/i.test(visible);
    results.push({ id: `${hub}-reload-disclosure`, result: disclosure ? 'PASS' : 'FAIL', observed: visible, evidence: 'BROWSER' });
    assert.equal(evaluate('window.b3.cloud.length'), 0);
    for (const width of [1440, 390, 320]) {
      browser('set', 'viewport', String(width), '900');
      browser('focus', 'button');
      assert.equal(evaluate(`document.activeElement===document.querySelector('button')`), true);
      const noOverflow = evaluate('document.documentElement.scrollWidth<=innerWidth');
      results.push({ id: `${hub}-saved-layout-${width}`, result: noOverflow ? 'PASS' : 'FAIL', evidence: 'BROWSER component fixture only' });
    }
    browser('screenshot', join(dir, `${hub}-reload-320.png`));
  }
  // Real Lender provider/storage, mocked Supabase: scheduled write must be dropped
  // when sign-out occurs before the 800ms debounce fires.
  await reset(4314); await until('Boolean(window.b3.resolveInitial)');
  evaluate(`window.b3.resolveInitial('owner-a')`); await until('Boolean(window.b3.resolvePull)');
  evaluate('window.b3.resolvePull(null)'); await until('window.b3.observed.loading===false');
  evaluate(`document.querySelector('button').click();window.b3.emitAuth(null)`);
  await delay(1000);
  assert.equal(evaluate('window.b3.cloud.length'), 0);
  assert.equal(evaluate('window.b3.storage.getMyLendingStorageUserId()'), null);
  results.push({ id: 'lender-queued-push-signout', result: 'PASS', evidence: 'LOCAL INTEGRATION; Supabase MOCKED' });
  console.log(JSON.stringify({ results, evidenceDirectory: dir }, null, 2));
  if (results.some(r => r.result === 'FAIL')) process.exitCode = 1;
} finally { browser('close'); }
