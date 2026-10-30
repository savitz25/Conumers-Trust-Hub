import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';

const baseUrl = process.env.ATH_TURNSTILE_FIXTURE_URL ?? 'http://127.0.0.1:3107/my/qa/turnstile';
const chromePath = process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const widths = [320, 360, 390, 406, 407, 768, 1440];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function createCdpClient(url) {
  const socket = new WebSocket(url);
  let nextId = 0;
  const pending = new Map();
  const ready = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (!message.id) return;
    const task = pending.get(message.id);
    if (!task) return;
    pending.delete(message.id);
    if (message.error) task.reject(new Error(message.error.message));
    else task.resolve(message.result);
  });

  return {
    async send(method, params = {}) {
      await ready;
      const id = ++nextId;
      const response = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
      socket.send(JSON.stringify({ id, method, params }));
      return response;
    },
    close() { socket.close(); },
  };
}

async function evaluate(cdp, expression) {
  const response = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.text ?? 'Browser evaluation failed');
  }
  return response.result.value;
}

async function waitFor(cdp, expression, timeoutMs = 45_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(cdp, expression)) return;
    await wait(100);
  }
  throw new Error(`Timed out waiting for browser condition: ${expression}`);
}

async function setViewport(cdp, width) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await wait(150);
}

async function measure(cdp) {
  return evaluate(cdp, `(() => {
    const rect = (node) => {
      if (!node) return null;
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return { x: box.x, y: box.y, width: box.width, height: box.height,
        right: box.right, visible: style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0 };
    };
    const card = document.querySelector('.myth-auth-card');
    const host = document.querySelector('[aria-label="Security verification"]');
    const widget = host?.querySelector('[data-qa-turnstile-widget], iframe') ?? host?.firstElementChild;
    const controls = [...document.querySelectorAll('#qa-email, #qa-password, [aria-label="Security verification"], button[type="submit"]')];
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    return {
      viewport: window.innerWidth,
      documentWidth,
      pageOverflow: documentWidth > window.innerWidth + 1,
      card: rect(card),
      host: rect(host),
      widget: rect(widget),
      controls: controls.map((node) => ({ name: node.id || node.getAttribute('aria-label') || node.textContent.trim(), ...rect(node) })),
      widgetMode: widget?.getAttribute('data-qa-size') ?? null,
      iframeTitle: host?.querySelector('iframe')?.title ?? null,
    };
  })()`);
}

const mockTurnstile = `(() => {
  const state = { widgets: [], removed: [], resets: [] };
  let next = 0;
  window.__turnstileQA = state;
  window.turnstile = {
    render(host, options) {
      const id = 'qa-widget-' + (++next);
      const frame = document.createElement('div');
      frame.dataset.qaTurnstileWidget = 'true';
      frame.dataset.qaSize = options.size;
      frame.setAttribute('role', 'group');
      frame.setAttribute('aria-label', 'Turnstile test challenge');
      frame.tabIndex = 0;
      Object.assign(frame.style, {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxSizing: 'border-box', width: options.size === 'compact' ? '150px' : '300px',
        maxWidth: '100%', height: '65px', border: '1px solid #9aa7ae',
        borderRadius: '4px', background: '#f8fafc', color: '#173448',
      });
      frame.textContent = 'Turnstile QA challenge';
      host.replaceChildren(frame);
      state.widgets.push({ id, options, frame });
      return id;
    },
    remove(id) {
      state.removed.push(id);
      state.widgets.find((widget) => widget.id === id)?.frame.remove();
    },
    reset(id) { state.resets.push(id); },
  };
})();`;

const profile = await mkdtemp(path.join(os.tmpdir(), 'ath-pr287-chrome-'));
const port = await freePort();
const chrome = spawn(chromePath, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--disable-default-apps',
  '--remote-allow-origins=*', `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore', windowsHide: true });
const chromeExited = new Promise((resolve) => chrome.once('exit', resolve));

let cdp;
try {
  const versionUrl = `http://127.0.0.1:${port}/json/version`;
  let browserWebSocket;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      browserWebSocket = (await (await fetch(versionUrl)).json()).webSocketDebuggerUrl;
      break;
    } catch {
      if (chrome.exitCode !== null) throw new Error(`Chrome exited with code ${chrome.exitCode}`);
      await wait(100);
    }
  }
  assert.ok(browserWebSocket, 'Chrome remote debugging endpoint did not start');
  const targetResponse = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
  const target = await targetResponse.json();
  cdp = createCdpClient(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  // First load Cloudflare's real testing SDK and capture its host geometry.
  await setViewport(cdp, widths[0]);
  await cdp.send('Page.navigate', { url: baseUrl });
  await waitFor(cdp, `Boolean(document.querySelector('[data-testid="turnstile-qa-page"]'))`);
  try {
      await waitFor(cdp, `Boolean(window.turnstile && document.querySelector('[aria-label="Security verification"]')?.firstElementChild)`, 25_000);
  } catch (error) {
    const diagnostics = await evaluate(cdp, `(() => ({
      turnstileLoaded: Boolean(window.turnstile),
      script: document.querySelector('script[data-myth-turnstile]')?.outerHTML ?? null,
      challengeStatus: document.querySelector('[aria-label="Security verification"] + input + [role="status"]')?.textContent ?? null,
      hostHtml: document.querySelector('[aria-label="Security verification"]')?.innerHTML ?? null,
      iframeCount: document.querySelectorAll('iframe').length,
      hostRect: (() => { const node=document.querySelector('[aria-label="Security verification"]'); const child=node?.firstElementChild; return { host: node?.getBoundingClientRect().toJSON(), child: child?.getBoundingClientRect().toJSON(), shadow: Boolean(child?.shadowRoot) }; })(),
    }))()`);
    throw new Error(`${error.message}; real-widget diagnostics: ${JSON.stringify(diagnostics)}`);
  }
  const realGeometry = [];
  for (const width of widths) {
    await setViewport(cdp, width);
    await wait(1_000);
    const result = await measure(cdp);
    assert.equal(result.viewport, width);
    assert.equal(result.pageOverflow, false, `Real SDK page caused horizontal overflow at ${width}px`);
    assert.ok(result.widget?.visible, `Real Turnstile widget was not visible at ${width}px: ${JSON.stringify(result)}`);
    assert.ok(result.controls.filter((control) => control.name !== 'Security verification')
      .every((control) => control.visible && control.x >= -1 && control.right <= width + 1),
      `A sign-in control was outside the viewport at ${width}px`);
    realGeometry.push(result);
  }

  // Replace only the client API in a fresh document for deterministic callback races.
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: mockTurnstile });
  await setViewport(cdp, widths[0]);
  await cdp.send('Page.navigate', { url: baseUrl });
  await waitFor(cdp, `Boolean(document.querySelector('[data-testid="turnstile-qa-page"]') && window.__turnstileQA?.widgets.length)`);
  assert.equal(await evaluate(cdp, `window.__turnstileQA.widgets[0].options.sitekey`), '3x00000000000000000000FF',
    'Fixture did not pass Cloudflare official test sitekey to the widget');
  assert.equal(await evaluate(cdp, `document.body.innerText.includes('Create account')`), false,
    'Sign-in fixture unexpectedly exposed closed signup');
  const initialMockWidgetCount = await evaluate(cdp, `window.__turnstileQA.widgets.length`);
  const mockGeometry = [];
  for (const width of widths) {
    await setViewport(cdp, width);
    const result = await measure(cdp);
    const expectedMode = width <= 406 ? 'compact' : 'flexible';
    assert.equal(result.widgetMode, expectedMode, `Wrong Turnstile mode at ${width}px`);
    assert.equal(result.pageOverflow, false, `Mock widget caused horizontal overflow at ${width}px`);
    assert.ok(result.controls.every((control) => control.visible && control.x >= -1 && control.right <= width + 1),
      `A sign-in control was outside the viewport at ${width}px`);
    mockGeometry.push(result);
  }
  assert.equal(await evaluate(cdp, `window.__turnstileQA.widgets.length`), initialMockWidgetCount + 1,
    'Widget should only be replaced when crossing the 406px boundary');

  // Cross the breakpoint both ways, then deliver a callback from the removed widget.
  await setViewport(cdp, 406);
  const oldId = await evaluate(cdp, `window.__turnstileQA.widgets.at(-1).id`);
  await setViewport(cdp, 407);
  const stateAfterResize = await evaluate(cdp, `(() => ({
    current: window.__turnstileQA.widgets.at(-1),
    removed: window.__turnstileQA.removed,
    token: document.querySelector('[name="captchaToken"]').value,
    status: document.querySelector('[aria-label="Security verification"] + input + [role="status"]').textContent,
  }))()`);
  assert.notEqual(stateAfterResize.current.id, oldId, 'Crossing 406px did not replace the widget');
  assert.ok(stateAfterResize.removed.includes(oldId), 'Old widget was not removed');
  assert.equal(stateAfterResize.current.options.size, 'flexible');
  await evaluate(cdp, `window.__turnstileQA.widgets.find((item) => item.id === ${JSON.stringify(oldId)}).options.callback('STALE-TOKEN')`);
  let tokenState = await evaluate(cdp, `({ token: document.querySelector('[name="captchaToken"]').value, status: document.querySelector('[aria-label="Security verification"] + input + [role="status"]').textContent })`);
  assert.equal(tokenState.token, '', 'Removed widget repopulated captchaToken');
  assert.equal(tokenState.status, 'Complete a fresh security check.', 'Removed widget changed current challenge status');

  await evaluate(cdp, `window.__turnstileQA.widgets.at(-1).options.callback('CURRENT-TOKEN')`);
  tokenState = await evaluate(cdp, `document.querySelector('[name="captchaToken"]').value`);
  assert.equal(tokenState, 'CURRENT-TOKEN', 'Current widget callback did not set the token');
  await evaluate(cdp, `window.__turnstileQA.widgets.at(-1).options['error-callback']()`);
  tokenState = await evaluate(cdp, `({ token: document.querySelector('[name="captchaToken"]').value, status: document.querySelector('[aria-label="Security verification"] + input + [role="status"]').textContent })`);
  assert.equal(tokenState.token, '', 'Error callback did not clear the token');
  assert.match(tokenState.status, /unavailable/i);
  await evaluate(cdp, `window.__turnstileQA.widgets.at(-1).options.callback('EXPIRES-TOKEN')`);
  await evaluate(cdp, `window.__turnstileQA.widgets.at(-1).options['expired-callback']()`);
  tokenState = await evaluate(cdp, `({ token: document.querySelector('[name="captchaToken"]').value, status: document.querySelector('[aria-label="Security verification"] + input + [role="status"]').textContent })`);
  assert.equal(tokenState.token, '', 'Expired callback did not clear the token');
  assert.match(tokenState.status, /expired/i);

  await evaluate(cdp, `window.__turnstileQA.widgets.at(-1).options.callback('RETRY-TOKEN')`);
  await evaluate(cdp, `document.querySelector('button.myth-secondary').click()`);
  await waitFor(cdp, `document.querySelector('[aria-label="Security verification"] + input + [role="status"]').textContent === 'Complete a fresh security check.'`);
  tokenState = await evaluate(cdp, `({ token: document.querySelector('[name="captchaToken"]').value, status: document.querySelector('[aria-label="Security verification"] + input + [role="status"]').textContent, resets: window.__turnstileQA.resets.length })`);
  assert.equal(tokenState.token, '', `Retry did not clear the token: ${JSON.stringify(tokenState)}`);
  assert.equal(tokenState.status, 'Complete a fresh security check.');
  assert.ok(tokenState.resets > 0, 'Retry did not reset the current widget');

  // Verify keyboard reachability of credentials, the challenge, retry, and sign-in.
  await evaluate(cdp, 'document.activeElement.blur()');
  const tabOrder = [];
  for (let index = 0; index < 15; index += 1) {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    tabOrder.push(await evaluate(cdp, `(() => { const e=document.activeElement; return e.id || e.getAttribute('aria-label') || e.textContent.trim().slice(0,40) || e.tagName; })()`));
  }
  for (const control of ['qa-email', 'qa-password']) assert.ok(tabOrder.includes(control), `Keyboard could not reach ${control}`);
  assert.ok(tabOrder.includes('Turnstile test challenge'), `Keyboard could not reach the challenge: ${JSON.stringify(tabOrder)}`);
  assert.ok(tabOrder.includes('Retry security check'), `Keyboard could not reach retry: ${JSON.stringify(tabOrder)}`);
  assert.ok(tabOrder.includes('Sign in'), `Keyboard could not reach sign-in: ${JSON.stringify(tabOrder)}`);

  const errorGeometry = await measure(cdp);
  assert.equal(errorGeometry.pageOverflow, false, 'Error status caused horizontal overflow');
  assert.ok(errorGeometry.controls.every((control) => control.visible && control.right <= errorGeometry.viewport + 1));

  // Submission is local mock authentication and cannot call Supabase or send email.
  await evaluate(cdp, `document.querySelector('form').requestSubmit()`);
  await waitFor(cdp, `document.querySelector('[data-testid="mock-auth-status"]').textContent.includes('No account service was called')`);

  const summarize = ({ viewport, documentWidth, pageOverflow, card, host, widget, widgetMode }) => ({
    viewport, documentWidth, pageOverflow,
    card: { width: card.width, height: card.height },
    challengeHost: { width: host.width, height: host.height },
    challenge: { width: widget.width, height: widget.height, visible: widget.visible },
    widgetMode,
  });
  process.stdout.write(`${JSON.stringify({
    realSdkGeometry: realGeometry.map(summarize),
    renderedMockGeometry: mockGeometry.map(summarize),
    staleCallback: 'ignored',
    errorStates: ['error clears token', 'expiry clears token'],
    tabOrder,
    mockAuthentication: 'local-only',
  }, null, 2)}\n`);
} finally {
  cdp?.close();
  if (process.platform === 'win32' && chrome.pid) {
    spawnSync('taskkill.exe', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    chrome.kill();
  }
  await Promise.race([chromeExited, wait(5_000)]);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(profile, { recursive: true, force: true });
      break;
    } catch (error) {
      if (attempt === 4) throw error;
      await wait(200);
    }
  }
}
