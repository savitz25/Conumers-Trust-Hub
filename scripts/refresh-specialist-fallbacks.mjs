#!/usr/bin/env node
/**
 * ATH-METRICS-R2-06: one-command bundled fallback refresh.
 *
 * Fallback snapshots (data/network-metrics/*-v1-fallback.json) exist purely for
 * resilience against a genuine upstream outage. They must never be the *normal*
 * source of truth, but when a real outage does happen they should degrade to
 * *recent* data, not data from whenever someone last remembered to refresh them.
 *
 * This script is the "one-command refresh" named in the R2-06 automation report:
 *   node scripts/refresh-specialist-fallbacks.mjs           # refresh every hub
 *   node scripts/refresh-specialist-fallbacks.mjs --check   # report drift only, write nothing
 *   node scripts/refresh-specialist-fallbacks.mjs --hub=lender
 *
 * It deliberately does NOT commit or open a PR by itself. Per R2-06 policy, an
 * automated PR is preferable to a silent automatic mutation of `main`, but a
 * bot silently writing to `data/network-metrics/*.json` unreviewed is exactly
 * the kind of "trust the pipeline blindly" failure mode this whole project
 * exists to fix. Detection + a clear notice + a one-command local refresh +
 * the existing test suite as validation is the safer minimum; wiring this into
 * an automated PR-opening workflow is named explicitly as a Prompt/Stage 3
 * candidate in the R2-06 report, not silently done here.
 *
 * A hub is only refreshed if its live upstream contract is schema-compatible
 * and passes the same structural validation Ask's request-time loader uses
 * (lib/network-metrics/validate.ts) -- this script can never bundle a broken
 * or incompatible contract as a "fallback".
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  validateContractorManifest,
  validateInsuranceManifest,
  validateInvestorManifest,
  validateLenderManifest,
  validateMoveManifest,
  validateSeniorManifest,
} from '../lib/network-metrics/validate.ts';
import { FALLBACK_SPECIALIST_FINGERPRINTS, SPECIALIST_OWNED_HUBS, SPECIALIST_SOURCES } from '../lib/network-metrics/sources.ts';

const VALIDATORS = {
  contractor: validateContractorManifest,
  senior: validateSeniorManifest,
  move: validateMoveManifest,
  lender: validateLenderManifest,
  insurance: validateInsuranceManifest,
  investor: validateInvestorManifest,
};

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const hubArg = args.find((arg) => arg.startsWith('--hub='));
const onlyHub = hubArg ? hubArg.slice('--hub='.length) : null;

/** Pure/testable: decide whether a fetched upstream payload is safe to bundle. */
export function planRefresh(hub, upstreamText, bundledRaw) {
  let upstream;
  try {
    upstream = JSON.parse(upstreamText);
  } catch {
    return { hub, action: 'skip', reason: 'upstream response was not valid JSON' };
  }
  try {
    VALIDATORS[hub](upstream);
  } catch (error) {
    return { hub, action: 'skip', reason: `upstream failed structural validation: ${error.message}` };
  }
  if (upstream.sourceFingerprint === bundledRaw.sourceFingerprint) {
    return { hub, action: 'noop', reason: 'bundled fallback already matches upstream' };
  }
  return {
    hub,
    action: 'refresh',
    reason: `bundled contractRevision ${bundledRaw.contractRevision ?? 'unknown'} -> upstream ${upstream.contractRevision ?? 'unknown'}`,
    upstreamText,
    newFingerprint: upstream.sourceFingerprint,
  };
}

async function main() {
  const hubs = onlyHub ? [onlyHub] : SPECIALIST_OWNED_HUBS;
  const results = [];
  for (const hub of hubs) {
    const config = SPECIALIST_SOURCES[hub];
    const fallbackPath = join(process.cwd(), config.fallbackRelPath);
    const bundledRaw = JSON.parse(readFileSync(fallbackPath, 'utf8'));
    let upstreamText;
    try {
      const response = await fetch(config.publicationUrl, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) {
        results.push({ hub, action: 'skip', reason: `upstream HTTP ${response.status}` });
        continue;
      }
      upstreamText = await response.text();
    } catch (error) {
      results.push({ hub, action: 'skip', reason: `upstream unreachable: ${error.message}` });
      continue;
    }
    const plan = planRefresh(hub, upstreamText, bundledRaw);
    results.push(plan);
    if (plan.action === 'refresh' && !checkOnly) {
      writeFileSync(fallbackPath, plan.upstreamText);
    }
  }

  for (const result of results) {
    console.log(`[${result.hub}] ${result.action}: ${result.reason}`);
  }

  const refreshed = results.filter((r) => r.action === 'refresh');
  if (refreshed.length === 0) {
    console.log('\nNo bundled fallback snapshots are behind their live upstream contract.');
    return;
  }
  if (checkOnly) {
    console.log(`\n${refreshed.length} bundled fallback snapshot(s) are behind upstream (--check: nothing written).`);
    console.log('Run without --check to refresh, then update FALLBACK_SPECIALIST_FINGERPRINTS in');
    console.log('lib/network-metrics/sources.ts to match, run `npm test`, and open a normal reviewed PR.');
    // Deliberately exit 0: a specialist shipping a new compatible revision is
    // healthy/expected, not a CI failure. This is a visibility notice for the
    // scheduled health-check workflow, not a fail-closed gate -- schema
    // incompatibility (the real failure mode) is verify-specialist-metrics.mjs's
    // job, not this script's.
    return;
  }
  console.log(`\nRefreshed ${refreshed.length} bundled fallback snapshot(s). Next steps:`);
  console.log('  1. Update FALLBACK_SPECIALIST_FINGERPRINTS in lib/network-metrics/sources.ts to match:');
  for (const result of refreshed) {
    console.log(`       ${result.hub}: '${result.newFingerprint}',`);
  }
  console.log('  2. Run `npm test` and fix any assertions pinned to the old fallback content.');
  console.log('  3. Open a normal PR for review -- this script never commits or pushes on its own.');
}

const isDirectlyExecuted = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectlyExecuted) {
  main();
}

export { FALLBACK_SPECIALIST_FINGERPRINTS };
