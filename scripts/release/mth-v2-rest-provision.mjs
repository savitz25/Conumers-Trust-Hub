// Fail-closed wrapper around the certified run(options, deps) interface.
// It does not parse the certified CLI flags or launch a Vercel command.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { HUBS, PROJECTS, run } from './mth-v2-specialist-keys.mjs';
import { DESTINATIONS, assertCredential, createRestEnvWriter } from './mth-v2-rest-env-writer.mjs';

const PROJECT_ID = /^prj_[A-Za-z0-9]+$/;
const fail = code => { throw new Error(code); };
const need = (ok, code) => { if (!ok) fail(code); };
const CODE = /^[A-Z][A-Z0-9_]+$/;

function utcDay(ms) {
  const iso = new Date(ms).toISOString();
  return iso.slice(0, 4) + iso.slice(5, 7) + iso.slice(8, 10);
}

function msUntilUtcMidnight(ms) {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1) - ms;
}

export function parseRestArgs(args) {
  const options = { hubs: [], bundles: [] };
  const values = {
    '--hub': 'hubs', '--public-bundle': 'bundles', '--placement': 'placement', '--destination': 'destination',
    '--date': 'date', '--metadata': 'metadata', '--public-inventory': 'inventory', '--ask-spki-sha256': 'askFingerprint',
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--closed-gates-confirmed') {
      need(!options.closedGates, 'DUPLICATE_OPTION');
      options.closedGates = true;
      continue;
    }
    const key = values[arg];
    need(key && args[i + 1] && !args[i + 1].startsWith('--'), 'REST_UNKNOWN_OPTION');
    const value = args[++i];
    if (Array.isArray(options[key])) options[key].push(value);
    else { need(options[key] === undefined, 'DUPLICATE_OPTION'); options[key] = value; }
  }
  return options;
}

function assertInvocation(config, now) {
  need(config?.closedGates === true, 'CLOSED_GATES_CONFIRMATION_REQUIRED');
  need(config.cli === undefined, 'REST_CLI_FORBIDDEN');
  need(!config.replace || config.replace.length === 0, 'REST_REPLACE_FORBIDDEN');
  need(config.placement === 'specialist' || config.placement === 'ask', 'EXPLICIT_PLACEMENT_REQUIRED');
  need(Array.isArray(config.hubs) && config.hubs.length > 0, 'EXPLICIT_HUB_REQUIRED');
  need(new Set(config.hubs).size === config.hubs.length && config.hubs.every(hub => HUBS.includes(hub)), 'INVALID_OR_DUPLICATE_HUB');
  need(DESTINATIONS.includes(config.destination), 'DESTINATION_FORBIDDEN');
  if (config.placement === 'specialist') {
    need(config.hubs.length === 1 && config.hubs[0] === config.destination, 'REST_SINGLE_PROJECT_REQUIRED');
  } else {
    need(config.destination === 'ask', 'REST_SINGLE_PROJECT_REQUIRED');
  }
  need(typeof config.date === 'string' && config.date === utcDay(now), 'REST_KID_DATE_NOT_UTC_TODAY');
  need(msUntilUtcMidnight(now) > 300_000, 'REST_MIDNIGHT_WINDOW');
  need(typeof config.metadata === 'string' && typeof config.inventory === 'string', 'APPLY_INPUTS_REQUIRED');
  need(typeof config.askFingerprint === 'string' && /^[a-f0-9]{64}$/.test(config.askFingerprint), 'APPLY_INPUTS_REQUIRED');
  need(Array.isArray(config.bundles) && config.bundles.length > 0, 'PUBLIC_BUNDLE_REQUIRED');
  need(config.placement !== 'specialist' || config.bundles.length === 1, 'PUBLIC_BUNDLE_REQUIRED');
}

function bindProject(metadata, destination) {
  const project = metadata?.projects?.[destination];
  const moveId = metadata?.projects?.move?.id;
  need(project?.name === PROJECTS[destination] && project.environment === 'production'
    && typeof project.id === 'string' && PROJECT_ID.test(project.id), 'PROJECT_TARGET_MISMATCH');
  need(project.id !== moveId && destination !== 'move', 'MOVE_WRITE_FORBIDDEN');
  return project.id;
}

export async function executeRestProvision(config, deps = {}) {
  assertCredential(config?.credential);
  const now = deps.now ?? Date.now();
  assertInvocation(config, now);
  need(!Object.hasOwn(deps, 'writeEnv'), 'REST_WRITER_INJECTION_FORBIDDEN');
  need(typeof deps.fetch === 'function', 'REST_FETCH_REQUIRED');
  const readJson = deps.readJson ?? (path => {
    try { return JSON.parse(readFileSync(path, 'utf8')); } catch { fail('INPUT_FILE_INVALID'); }
  });
  let metadata;
  try { metadata = readJson(config.metadata); }
  catch (error) { if (CODE.test(error?.message ?? '')) throw error; fail('INPUT_FILE_INVALID'); }
  const projectId = bindProject(metadata, config.destination);
  const writeEnv = createRestEnvWriter({
    credential: config.credential, destination: config.destination, projectId, fetchImpl: deps.fetch,
  });
  await run({
    mode: 'apply', hubs: config.hubs, replace: [], bundles: config.bundles, placement: config.placement,
    date: config.date, metadata: config.metadata, inventory: config.inventory,
    askFingerprint: config.askFingerprint, closedGates: true,
  }, { ...deps, now, writeEnv });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    need(!process.env.VERCEL_TOKEN, 'REST_SAVED_TOKEN_PRESENT');
    const config = parseRestArgs(process.argv.slice(2));
    await executeRestProvision({ ...config, credential: process.env.MTH_V23_PROJECT_TOKEN }, { fetch: globalThis.fetch });
  } catch (error) {
    const code = CODE.test(error?.message ?? '') ? error.message : 'PROVISIONING_FAILED';
    console.error(code);
    process.exitCode = 1;
  }
}
