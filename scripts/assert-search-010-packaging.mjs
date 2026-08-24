import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve } from 'node:path';

const root = process.cwd();
const tracePath = join(root, '.next', 'server', 'app', 'search', 'page.js.nft.json');
const required = [
  'provenance.json',
  'move.v1.json',
  'lender.v1.json',
  'insurance.v1.json',
  'contractor.v1.json',
  'senior.v1.json',
  'investor.v1.json',
].map((name) => `data/network-discovery/feeds/${name}`);

if (!existsSync(tracePath)) {
  throw new Error(`Search function trace is missing: ${relative(root, tracePath)}`);
}

const trace = JSON.parse(readFileSync(tracePath, 'utf8'));
const traced = new Map(
  trace.files.map((entry) => {
    const absolute = resolve(dirname(tracePath), entry);
    return [normalize(relative(root, absolute)).replaceAll('\\', '/'), absolute];
  })
);

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const failures = [];
for (const expected of required) {
  const tracedPath = traced.get(expected);
  const sourcePath = join(root, expected);
  if (!tracedPath || !existsSync(tracedPath)) {
    failures.push(`${expected}: absent from search server trace`);
    continue;
  }
  if (sha256(tracedPath) !== sha256(sourcePath)) {
    failures.push(`${expected}: traced bytes differ from source`);
  }
}

const forbidden = [...traced.keys()].filter((path) =>
  /(^|\/)(\.env(?:\.|$)|\.vercel(?:\/|$)|artifacts(?:\/|$)|credentials?(?:\.|\/|$))/i.test(path)
);
if (forbidden.length) failures.push(`forbidden traced paths: ${forbidden.join(', ')}`);

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`ASK-SEARCH-010 packaging assertion PASS (${required.length}/${required.length} assets; byte-identical; no forbidden paths).`);
