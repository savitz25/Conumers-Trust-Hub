import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const packageName = '@vercel/' + 'analytics';
const insightsScript = '/_vercel/' + 'insights/script.js';
const speedInsights = 'speed-' + 'insights';

const protectedHashes: Record<string, string> = {
  'lib/analytics/environment.ts': '733a44a0d7941a5fabb7d6ef3357de1a35ffffcfe35b2ec072ab5080ce9c7040',
  'components/analytics/posthog-root.tsx': '671d1ee7eb7d809f9f224886058d4283e8a35051b6a403b8b131a8941f3e72ae',
  'lib/analytics/early-transport.ts': '4940e3a31347dc1722da7f9d23e70f8db23e072fcd275f0b57b78826d632aef5',
  'components/analytics/click-tracker.tsx': '248c9c98d9390eafed2f00a3f4b175a9f413a60c33b3866b6382b0396762d8a7',
};

function listFiles(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === '.next') continue;
    const full = join(dir, name);
    const info = statSync(full);
    if (info.isDirectory()) listFiles(full, out);
    else out.push(full);
  }
}

function containsAnalytics(text: string) {
  return text.includes(packageName) || text.includes(insightsScript) || text.includes(speedInsights);
}

test('PostHog default-off files stay byte-identical to 11439c17', () => {
  for (const [rel, expected] of Object.entries(protectedHashes)) {
    const hash = createHash('sha256').update(readFileSync(join(root, rel))).digest('hex');
    assert.equal(hash, expected, rel);
  }
});

test('app source and lockfile do not import Vercel Analytics', () => {
  const files: string[] = [];
  for (const dir of ['app', 'components', 'lib']) listFiles(join(root, dir), files);
  files.push(join(root, 'package.json'), join(root, 'package-lock.json'));
  const hits = files
    .filter((file) => /\.(ts|tsx|js|jsx|mjs|cjs|json)$/.test(file))
    .filter((file) => file.endsWith('vercel-analytics-off.test.ts') === false)
    .filter((file) => containsAnalytics(readFileSync(file, 'utf8')))
    .map((file) => relative(root, file));
  assert.deepEqual(hits, []);
});

test('root layout does not mount the Vercel Analytics component', () => {
  const layout = readFileSync(join(root, 'app/layout.tsx'), 'utf8');
  assert.equal(layout.includes(packageName), false);
  assert.equal(/<Analytics[\s/>]/.test(layout), false);
});

test('built HTML and client bundle omit the Vercel Analytics script', () => {
  const buildId = join(root, '.next', 'BUILD_ID');
  if (!existsSync(buildId)) {
    if (process.env.ASK_ANALYTICS_OFF_REQUIRE_BUILD === '1') {
      assert.fail('next build output is missing');
    }
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
      if (containsAnalytics(readFileSync(full, 'utf8'))) hits.push(relative(root, full));
    }
  }
  assert.deepEqual(hits, []);
});
