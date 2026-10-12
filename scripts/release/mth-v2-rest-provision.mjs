// Fail-closed wrapper around the certified run(options, deps) interface.
// It does not parse the certified CLI flags or launch a Vercel command.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { HUBS, PROJECTS, SCOPE, fingerprint, run } from './mth-v2-specialist-keys.mjs';
import { DESTINATIONS, assertCredential, createRestEnvWriter } from './mth-v2-rest-env-writer.mjs';

const fail = code => { throw new Error(code); };
const need = (ok, code) => { if (!ok) fail(code); };
const ASK_HUB_ORDER = Object.freeze(['lender', 'investor', 'insurance', 'senior', 'contractor']);
// Independent recheck for team savitz25-s-projects. An authorized execution
// must read these identities again before any write. This module does not.
export const PINNED_PROJECT_IDS = Object.freeze({
  ask: 'prj_925ZdSHjPhPU7pH9WiwyNOK1MrZB',
  lender: 'prj_Il28Mv0ebRiIrumFO7iBX6JrSbdD',
  investor: 'prj_Qu2DT0AIy8R7XYTQiHgNcDYjE9i8',
  insurance: 'prj_ARBlfWYNhpJWBtaPO4vUJlraa5BK',
  senior: 'prj_k9GyyXn28JZkyYKqLhBJ4rUQcpUb',
  contractor: 'prj_OYmhfgBxZvRAKBPJv5zqshJnJwgq',
});
export const MOVE_PROJECT_ID = 'prj_gudPGeW9SZBkgiL8zxvi3Swfo6T0';
const SAFE_CODES = new Set([
  'ADDITIONAL_PUBLIC_KEYS_REQUIRED', 'ALL_SEVEN_PUBLIC_SLOTS_REQUIRED', 'APPLY_INPUTS_REQUIRED',
  'APPROVED_METADATA_REQUIRED', 'ASK_AND_MOVE_PUBLIC_KEYS_REQUIRED', 'ASK_COPY_METADATA_DISAGREE',
  'ASK_FINGERPRINT_MISMATCH', 'ASK_MOVE_TARGET_FORBIDDEN', 'ASK_PUBLIC_COPIES_REQUIRED',
  'BUNDLE_DIFFERS_FROM_INSTALLED_SPECIALIST', 'BUNDLE_HUB_MISSING', 'BUNDLE_HUB_NOT_SELECTED_OR_DUPLICATED',
  'CLOSED_GATES_CONFIRMATION_REQUIRED', 'COMPLETE_PROJECT_METADATA_REQUIRED', 'CONFLICTING_MODES',
  'DESTINATION_FORBIDDEN', 'DUPLICATE_ENV_METADATA', 'DUPLICATE_KID', 'DUPLICATE_OPTION',
  'DUPLICATE_PROJECT_ID', 'DUPLICATE_REPLACE', 'DUPLICATE_SPKI', 'ED25519_REQUIRED',
  'EXISTING_ASK_TRUST_MISMATCH', 'EXPLICIT_APPLY_REQUIRED', 'EXPLICIT_HUB_REQUIRED',
  'EXPLICIT_PLACEMENT_REQUIRED', 'INPUT_FILE_INVALID', 'INVALID_ADDITIONAL_PUBLIC_KEY',
  'INVALID_OR_DUPLICATE_HUB', 'INVALID_PLACEMENT', 'INVALID_PUBLIC_KEY', 'INVENTORY_METADATA_DISAGREE',
  'KEYPAIR_MISMATCH', 'KID_DATE_FORMAT', 'KID_DATE_INVALID', 'KID_FORMAT', 'METADATA_REQUIRED',
  'MOVE_WRITE_FORBIDDEN', 'NAME_ONLY_METADATA_REQUIRED', 'NAME_VERIFICATION_FAILED',
  'PARENT_ORIGIN_MISMATCH', 'PLACEMENT_VALUE_MISSING', 'PRIVATE_MATERIAL_IN_PUBLIC_INPUT',
  'PRIVATE_MATERIAL_IN_PUBLIC_VALUE', 'PRIVATE_PEM_BUFFER_REQUIRED', 'PROJECT_ID_INVALID',
  'PROJECT_TARGET_MISMATCH', 'PUBLIC_BUNDLE_MUST_BE_NEW', 'PUBLIC_BUNDLE_REQUIRED',
  'PUBLIC_BUNDLE_WRITE_FAILED', 'PUBLIC_INVENTORY_REQUIRED', 'PUBLIC_KEY_RECORD_REQUIRED',
  'PUBLIC_PEM_REQUIRED', 'PUBLIC_VALUE_REQUIRED', 'REPLACE_NOT_SELECTED_OR_PROTECTED',
  'REPLACE_TARGET_ABSENT', 'REST_AMBIGUOUS', 'REST_ASK_BUNDLES_REQUIRED', 'REST_ASK_HUBS_REQUIRED',
  'REST_BUNDLE_HUB_MISMATCH', 'REST_CLI_FORBIDDEN', 'REST_CONFLICT', 'REST_CREDENTIAL_INVALID',
  'REST_CREDENTIAL_MISSING', 'REST_FETCH_REQUIRED', 'REST_FORBIDDEN', 'REST_KID_DATE_NOT_UTC_TODAY',
  'REST_MIDNIGHT_WINDOW', 'REST_NAME_FORBIDDEN', 'REST_NETWORK', 'REST_PARTIAL',
  'REST_PROJECT_FORBIDDEN', 'REST_RATE_LIMITED', 'REST_REDIRECT', 'REST_REPLACE_FORBIDDEN',
  'REST_SAVED_TOKEN_PRESENT', 'REST_SERVER_AMBIGUOUS', 'REST_SINGLE_PROJECT_REQUIRED',
  'REST_TARGET_AMBIGUOUS', 'REST_TIMEOUT', 'REST_UNAUTHORIZED', 'REST_UNKNOWN_OPTION',
  'REST_WRITER_INJECTION_FORBIDDEN', 'SPECIALIST_PLACEMENT_NOT_VERIFIED', 'SPKI_PUBLIC_PEM_REQUIRED',
  'STALE_OR_INVALID_CONNECTOR_SNAPSHOT', 'TARGET_NAME_EXISTS', 'UNKNOWN_OR_MISSING_OPTION',
  'UNVERIFIED_PUBLIC_BUNDLE', 'VERCEL_CLI_REQUIRED', 'VERCEL_WRITE_FAILED',
]);

export function reportedCode(error) {
  const message = error?.message;
  return SAFE_CODES.has(message) ? message : 'PROVISIONING_FAILED';
}

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
    need(Array.isArray(config.bundles) && config.bundles.length === 1, 'PUBLIC_BUNDLE_REQUIRED');
  } else {
    need(config.destination === 'ask', 'REST_SINGLE_PROJECT_REQUIRED');
    need(ASK_HUB_ORDER.join() === HUBS.join(), 'REST_ASK_HUBS_REQUIRED');
    need(Array.isArray(config.hubs) && config.hubs.length === ASK_HUB_ORDER.length
      && config.hubs.every((hub, index) => hub === ASK_HUB_ORDER[index]), 'REST_ASK_HUBS_REQUIRED');
    need(Array.isArray(config.bundles) && config.bundles.length === ASK_HUB_ORDER.length, 'REST_ASK_BUNDLES_REQUIRED');
  }
  need(typeof config.date === 'string' && config.date === utcDay(now), 'REST_KID_DATE_NOT_UTC_TODAY');
  need(msUntilUtcMidnight(now) > 300_000, 'REST_MIDNIGHT_WINDOW');
  need(typeof config.metadata === 'string' && typeof config.inventory === 'string', 'APPLY_INPUTS_REQUIRED');
  need(typeof config.askFingerprint === 'string' && /^[a-f0-9]{64}$/.test(config.askFingerprint), 'APPLY_INPUTS_REQUIRED');
}

function bindProject(metadata, destination) {
  const project = metadata?.projects?.[destination];
  const pinned = PINNED_PROJECT_IDS[destination];
  need(project?.id !== MOVE_PROJECT_ID, 'MOVE_WRITE_FORBIDDEN');
  need(Boolean(pinned) && project?.name === PROJECTS[destination] && project.environment === 'production'
    && project.id === pinned, 'PROJECT_TARGET_MISMATCH');
  return pinned;
}

function readChecked(readJson, file) {
  try { return readJson(file); }
  catch { fail('INPUT_FILE_INVALID'); }
}

function assertAskBundles(config, readJson) {
  if (config.placement !== 'ask') return;
  const seenKids = new Set();
  const seenFingerprints = new Set();
  config.bundles.forEach((file, index) => {
    const hub = ASK_HUB_ORDER[index];
    const bundle = readChecked(readJson, file);
    need(bundle?.version === 1 && bundle.scope === SCOPE && bundle.state === 'specialists-written'
      && bundle.askFingerprint === config.askFingerprint, 'UNVERIFIED_PUBLIC_BUNDLE');
    const entries = Object.entries(bundle.keys ?? {});
    need(entries.length === 1 && entries[0][0] === hub, 'REST_BUNDLE_HUB_MISMATCH');
    const key = entries[0][1];
    need(key && Object.keys(key).sort().join() === 'kid,publicKeyPem', 'PUBLIC_KEY_RECORD_REQUIRED');
    need(typeof key.kid === 'string' && new RegExp(`^${hub}-v23-prod-[0-9]{8}$`).test(key.kid), 'KID_FORMAT');
    let digest;
    try { digest = fingerprint(key.publicKeyPem); }
    catch (error) { fail(SAFE_CODES.has(error?.message) ? error.message : 'PUBLIC_KEY_RECORD_REQUIRED'); }
    need(!seenKids.has(key.kid), 'DUPLICATE_KID');
    need(!seenFingerprints.has(digest), 'DUPLICATE_SPKI');
    seenKids.add(key.kid);
    seenFingerprints.add(digest);
  });
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
  const metadata = readChecked(readJson, config.metadata);
  const projectId = bindProject(metadata, config.destination);
  assertAskBundles(config, readJson);
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
    console.error(reportedCode(error));
    process.exitCode = 1;
  }
}
