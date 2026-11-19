import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { shouldEnablePosthog } from './environment.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const packageName = '@vercel/' + 'analytics';
const insightsScript = '/_vercel/' + 'insights/script.js';
const speedPackage = '@vercel/' + 'speed-insights';
const speedComponent = 'Speed' + 'Insights';
const projectTokenNeedle = 'phc' + '_';
const needles = [packageName, insightsScript, speedPackage, speedComponent];

function listFiles(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === '.next') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) listFiles(full, out);
    else out.push(full);
  }
}

function textHits(text: string, extra: string[] = []): string[] {
  return [...needles, ...extra].filter((needle) => text.includes(needle));
}

test('app, components, lib, and the package files do not name Vercel Web Analytics or Speed Insights', () => {
  const files: string[] = [];
  for (const dir of ['app', 'components', 'lib']) listFiles(join(root, dir), files);
  files.push(join(root, 'package.json'), join(root, 'package-lock.json'));
  const hits = files
    .filter((file) => file.endsWith('vercel-analytics-off.test.ts') === false)
    .filter((file) => /\.(ts|tsx|js|jsx|mjs|cjs|json)$/.test(file))
    .flatMap((file) => textHits(readFileSync(file, 'utf8')).map((needle) => `${relative(root, file)} ${needle}`));
  assert.deepEqual(hits, []);
});

test('root layout keeps PostHog and does not mount Vercel Analytics', () => {
  const layout = readFileSync(join(root, 'app/layout.tsx'), 'utf8');
  assert.equal(layout.includes(packageName), false);
  assert.equal(/<Analytics[\s/>]/.test(layout), false);
  assert.match(layout, /import \{ PosthogRoot \} from '@\/components\/analytics\/posthog-root'/);
  assert.match(layout, /<PosthogRoot \/>/);
  assert.equal(layout.includes(projectTokenNeedle), false);
  assert.equal(layout.includes('posthog.com'), false);
});

test('PostHog stays off unless production has both a project token and a host', async () => {
  const keys = [
    'NEXT_PUBLIC_VERCEL_ENV',
    'VERCEL_ENV',
    'NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN',
    'NEXT_PUBLIC_POSTHOG_HOST',
  ] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  function set(values: Partial<Record<(typeof keys)[number], string>>) {
    for (const key of keys) {
      const value = values[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
  try {
    set({});
    assert.equal(shouldEnablePosthog(), false);
    const browser = readFileSync(join(root, 'lib/analytics/posthog-browser.ts'), 'utf8');
    assert.match(browser, /if \(!shouldEnablePosthog\(\)\) return null;/);
    set({
      NEXT_PUBLIC_VERCEL_ENV: 'preview',
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'project-token',
      NEXT_PUBLIC_POSTHOG_HOST: 'https://us.i.posthog.com',
    });
    assert.equal(shouldEnablePosthog(), false);
    set({ NEXT_PUBLIC_VERCEL_ENV: 'production', NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'project-token' });
    assert.equal(shouldEnablePosthog(), false);
    set({ NEXT_PUBLIC_VERCEL_ENV: 'production', NEXT_PUBLIC_POSTHOG_HOST: 'https://us.i.posthog.com' });
    assert.equal(shouldEnablePosthog(), false);
    set({
      NEXT_PUBLIC_VERCEL_ENV: 'production',
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'project-token',
      NEXT_PUBLIC_POSTHOG_HOST: 'https://us.i.posthog.com',
    });
    assert.equal(shouldEnablePosthog(), true);
  } finally {
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('a present Next build has no Vercel Analytics script and no project token', () => {
  if (!existsSync(join(root, '.next', 'BUILD_ID'))) {
    if (process.env.ASK_ANALYTICS_OFF_REQUIRE_BUILD === '1') assert.fail('next build output is missing');
    return;
  }
  const hits: string[] = [];
  const pending = [join(root, '.next', 'static'), join(root, '.next', 'server')];
  while (pending.length > 0) {
    const dir = pending.pop();
    if (!dir || !existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (name === 'cache' || name === 'trace') continue;
      const full = join(dir, name);
      const info = statSync(full);
      if (info.isDirectory()) {
        pending.push(full);
        continue;
      }
      if (!/\.(js|mjs|html|css|json|rsc)$/.test(name) || info.size > 20_000_000) continue;
      const found = textHits(readFileSync(full, 'utf8'), [projectTokenNeedle]);
      for (const needle of found) hits.push(`${relative(root, full)} ${needle}`);
    }
  }
  assert.deepEqual(hits, []);
});
