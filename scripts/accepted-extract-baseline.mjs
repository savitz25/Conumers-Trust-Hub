#!/usr/bin/env node
/**
 * ENB-001: accepted-extract baseline for the six specialist publications.
 *
 *   node --experimental-strip-types scripts/accepted-extract-baseline.mjs --check [--from=upstream|bundled] [--strict] [--json]
 *       Compute the current candidate baseline and compare it to the ACCEPTED baseline
 *       (data/network-metrics/accepted-extract-baseline-v1.json). Writes nothing. Exit 0 unless --strict,
 *       in which case DRIFT / MISSING_BASELINE / INCOMPLETE_BASELINE exit 2.
 *
 *   node --experimental-strip-types scripts/accepted-extract-baseline.mjs --propose [--from=bundled|upstream]
 *       Write the candidate to data/network-metrics/accepted-extract-baseline-v1.proposal.json for review.
 *       Never touches the accepted file.
 *
 *   node --experimental-strip-types scripts/accepted-extract-baseline.mjs --replace --from=bundled|upstream --confirm=REPLACE-ACCEPTED-EXTRACT-BASELINE
 *       Overwrite the ACCEPTED baseline. This is branch/PR review material: run it on a branch, review the diff,
 *       open a normal PR. It is deliberately not wired to any npm script the scheduled workflow runs.
 *
 * `--from=bundled` reads the already-accepted fallback snapshots (data/network-metrics/<hub>-v1-fallback.json)
 * and needs no network. `--from=upstream` fetches each hub's canonical publication URL (read-only; 10 s timeout).
 * A hub whose payload cannot be fetched, parsed or validated is reported SOURCE_MISSING — never as zero.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ACCEPTED_EXTRACT_BASELINE_REL_PATH,
  ACCEPTED_EXTRACT_PROPOSAL_REL_PATH,
  MalformedBaselineError,
  REPLACE_BASELINE_CONFIRMATION,
  buildBaseline,
  buildCandidate,
  compareBaseline,
  formatReport,
  notAvailableEntry,
  parseBaseline,
  serializeBaseline,
} from '../lib/network-metrics/accepted-extract-baseline.ts';
import { SPECIALIST_OWNED_HUBS, SPECIALIST_SOURCES } from '../lib/network-metrics/sources.ts';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

export function readAcceptedBaseline(root = process.cwd()) {
  const path = join(root, ACCEPTED_EXTRACT_BASELINE_REL_PATH);
  if (!existsSync(path)) return { state: 'ABSENT' };
  try {
    return { state: 'PRESENT', document: parseBaseline(readFileSync(path, 'utf8')) };
  } catch (error) {
    if (error instanceof MalformedBaselineError) return { state: 'MALFORMED', reason: error.message };
    return { state: 'MALFORMED', reason: String(error && error.message ? error.message : error) };
  }
}

async function fetchExtract(hub, from, fetcher, root) {
  const config = SPECIALIST_SOURCES[hub];
  if (from === 'bundled') {
    const path = join(root, config.fallbackRelPath);
    if (!existsSync(path)) return { ok: false, reason: `bundled fallback not present locally: ${config.fallbackRelPath}` };
    return { ok: true, text: readFileSync(path, 'utf8') };
  }
  try {
    const response = await fetcher(config.publicationUrl, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return { ok: false, reason: `upstream HTTP ${response.status}` };
    return { ok: true, text: await response.text() };
  } catch (error) {
    return { ok: false, reason: `upstream unreachable: ${error && error.message ? error.message : String(error)}` };
  }
}

/** Testable core: build candidates for `hubs` from `from`, using `fetcher` for upstream reads. */
export async function collectCandidates({ hubs = SPECIALIST_OWNED_HUBS, from = 'bundled', fetcher = fetch, root = process.cwd(), now = new Date().toISOString() } = {}) {
  const candidates = [];
  for (const hub of hubs) {
    const fetched = await fetchExtract(hub, from, fetcher, root);
    candidates.push(buildCandidate(hub, fetched, from, now));
  }
  return candidates;
}

export function candidatesToBaseline(candidates, { from, now }) {
  const entries = candidates.map((candidate) => (candidate.available ? candidate.entry : notAvailableEntry(candidate.hub, candidate.reason, now)));
  return buildBaseline(entries, { generatedAt: now, generatedFrom: from });
}

async function main() {
  const from = option('from') ?? 'bundled';
  if (from !== 'bundled' && from !== 'upstream') throw new Error(`--from must be bundled or upstream (got ${from})`);
  const onlyHub = option('hub');
  const hubs = onlyHub ? [onlyHub] : SPECIALIST_OWNED_HUBS;
  for (const hub of hubs) if (!SPECIALIST_SOURCES[hub]) throw new Error(`unknown hub ${hub}`);
  const now = new Date().toISOString();
  const root = process.cwd();
  const mode = flag('replace') ? 'replace' : flag('propose') ? 'propose' : 'check';

  const candidates = await collectCandidates({ hubs, from, root, now });

  if (mode === 'check') {
    const report = compareBaseline(readAcceptedBaseline(root), candidates, { candidateFrom: from, checkedAt: now });
    if (flag('json')) console.log(JSON.stringify(report, null, 2));
    else console.log(formatReport(report));
    if (flag('strict') && report.overall !== 'SAME' && report.overall !== 'SOURCE_UNAVAILABLE') process.exit(2);
    return;
  }

  if (onlyHub) throw new Error('--hub is only valid with --check; a baseline document always covers every specialist hub');
  const baseline = candidatesToBaseline(candidates, { from, now });
  const text = serializeBaseline(baseline);
  const unavailable = baseline.entries.filter((entry) => entry.acceptance.state === 'NOT_AVAILABLE');

  if (mode === 'propose') {
    writeFileSync(join(root, ACCEPTED_EXTRACT_PROPOSAL_REL_PATH), text);
    console.log(`wrote ${ACCEPTED_EXTRACT_PROPOSAL_REL_PATH} (${baseline.entries.length} entries, ${unavailable.length} NOT_AVAILABLE) from ${from}.`);
    console.log('The accepted baseline was NOT changed. Review the proposal, then on a branch run:');
    console.log(`  node --experimental-strip-types scripts/accepted-extract-baseline.mjs --replace --from=${from} --confirm=${REPLACE_BASELINE_CONFIRMATION}`);
    return;
  }

  // mode === 'replace'
  if (option('confirm') !== REPLACE_BASELINE_CONFIRMATION) {
    console.error(`refusing to overwrite the accepted baseline without --confirm=${REPLACE_BASELINE_CONFIRMATION}`);
    process.exit(3);
  }
  const previous = readAcceptedBaseline(root);
  const report = compareBaseline(previous, candidates, { candidateFrom: from, checkedAt: now });
  writeFileSync(join(root, ACCEPTED_EXTRACT_BASELINE_REL_PATH), text);
  console.log(`replaced ${ACCEPTED_EXTRACT_BASELINE_REL_PATH} from ${from} (previous baseline: ${previous.state}; comparison before replace: ${report.overall}).`);
  if (unavailable.length) console.log(`NOT_AVAILABLE (no hash fabricated): ${unavailable.map((entry) => `${entry.hub} — ${entry.acceptance.note}`).join('; ')}`);
  console.log('This is review material: commit it on a branch and open a normal PR. Nothing has been accepted automatically.');
}

const isDirectlyExecuted = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectlyExecuted) {
  main().catch((error) => {
    console.error(error && error.message ? error.message : String(error));
    process.exit(1);
  });
}
