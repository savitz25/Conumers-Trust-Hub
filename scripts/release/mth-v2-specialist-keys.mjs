#!/usr/bin/env node
// Preparation defaults to names only. No import-time key generation or I/O.
import { createHash, createPublicKey, generateKeyPairSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync, openSync, writeSync, ftruncateSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SCOPE = 'savitz25-s-projects';
export const HUBS = ['lender', 'investor', 'insurance', 'senior', 'contractor'];
export const PROJECTS = { ask: 'conumers-trust-hub', move: 'move-trust-hub', lender: 'lender-trust-hub',
  investor: 'investor-trust-hub-web', insurance: 'insurance-trust-hub', senior: 'care-trust-hub', contractor: 'contractor-trust-hub' };
const ALL = ['ask', 'move', ...HUBS];
const PREFIX = 'MY_TRUSTHUB_V23_';
const envName = (hub, suffix) => PREFIX + hub.toUpperCase() + '_' + suffix;
const fail = code => { throw new Error(code); };
const need = (ok, code) => { if (!ok) fail(code); };
const isPrivateName = name => name.endsWith('_SIGNING_PRIVATE_KEY_PEM');
const protectedName = name => /^MY_TRUSTHUB_V23_(ASK|MOVE)_/.test(name);
const fresh = (value, now) => {
  const age = now - Date.parse(value);
  need(Number.isFinite(age) && age >= 0 && age <= 300_000, 'STALE_OR_INVALID_CONNECTOR_SNAPSHOT');
};
const noPrivateInput = value => need(!/PRIVATE KEY/.test(JSON.stringify(value)), 'PRIVATE_MATERIAL_IN_PUBLIC_INPUT');

export function parseArgs(args) {
  const o = { mode: 'dry-run', hubs: [], replace: [], bundles: [] };
  let modeSet = false;
  const values = { '--hub': 'hubs', '--replace': 'replace', '--public-bundle': 'bundles',
    '--placement': 'placement', '--date': 'date', '--metadata': 'metadata', '--public-inventory': 'inventory',
    '--ask-spki-sha256': 'askFingerprint', '--vercel-cli': 'cli' };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (['--dry-run', '--verify-names', '--apply'].includes(arg)) {
      need(!modeSet, 'CONFLICTING_MODES'); modeSet = true; o.mode = arg.slice(2);
    } else if (arg === '--closed-gates-confirmed') {
      need(!o.closedGates, 'DUPLICATE_OPTION'); o.closedGates = true;
    } else {
      const key = values[arg]; need(key && args[i + 1] && !args[i + 1].startsWith('--'), 'UNKNOWN_OR_MISSING_OPTION');
      const value = args[++i];
      if (Array.isArray(o[key])) o[key].push(value);
      else { need(o[key] === undefined, 'DUPLICATE_OPTION'); o[key] = value; }
    }
  }
  need(o.hubs.every(h => HUBS.includes(h)) && new Set(o.hubs).size === o.hubs.length, 'INVALID_OR_DUPLICATE_HUB');
  need(new Set(o.replace).size === o.replace.length, 'DUPLICATE_REPLACE');
  need(o.placement === undefined || ['specialist', 'ask', 'both'].includes(o.placement), 'INVALID_PLACEMENT');
  if (o.mode !== 'dry-run') need(o.hubs.length > 0, 'EXPLICIT_HUB_REQUIRED');
  if (o.mode === 'apply') {
    need(['specialist','ask'].includes(o.placement), 'EXPLICIT_PLACEMENT_REQUIRED');
    need(o.closedGates, 'CLOSED_GATES_CONFIRMATION_REQUIRED');
    need(o.inventory && o.metadata && o.askFingerprint && o.cli, 'APPLY_INPUTS_REQUIRED');
    need(o.bundles.length > 0 && (o.placement !== 'specialist' || o.bundles.length === 1), 'PUBLIC_BUNDLE_REQUIRED');
  }
  if (o.mode === 'verify-names') need(o.metadata, 'METADATA_REQUIRED');
  return o;
}

export function plan(hubs, placement = 'both') {
  const rows = [];
  for (const hub of hubs) {
    if (placement !== 'ask') {
      for (const name of [envName(hub,'KEY_ID'),envName(hub,'SIGNING_PRIVATE_KEY_PEM'),
        envName('ask','KEY_ID'),envName('ask','VERIFY_PUBLIC_KEY_PEM'),
        ...(hub === 'insurance' ? [PREFIX + 'PARENT_ORIGIN'] : [])]) rows.push({ hub, project: hub, name });
    }
    if (placement !== 'specialist') {
      for (const name of [envName(hub,'KEY_ID'),envName(hub,'VERIFY_PUBLIC_KEY_PEM')]) rows.push({ hub, project: 'ask', name });
    }
  }
  return rows;
}

export function fingerprint(pem) {
  // createPublicKey also accepts private PEM: prohibit it before parsing.
  need(typeof pem === 'string' && /^-----BEGIN PUBLIC KEY-----\r?\n[A-Za-z0-9+/=\r\n]+\r?\n-----END PUBLIC KEY-----\s*$/.test(pem), 'SPKI_PUBLIC_PEM_REQUIRED');
  let key;
  try { key = createPublicKey(pem); } catch { fail('INVALID_PUBLIC_KEY'); }
  need(key.asymmetricKeyType === 'ed25519', 'ED25519_REQUIRED');
  return createHash('sha256').update(key.export({ format: 'der', type: 'spki' })).digest('hex');
}

function dateValid(date) {
  need(typeof date === 'string' && /^\d{8}$/.test(date), 'KID_DATE_FORMAT');
  const d = date.slice(0,4) + '-' + date.slice(4,6) + '-' + date.slice(6);
  need(Number.isFinite(Date.parse(d)) && new Date(d).toISOString().slice(0,10) === d, 'KID_DATE_INVALID');
}
function keyInfo(hub, key) {
  need(key && Object.keys(key).sort().join() === 'kid,publicKeyPem', 'PUBLIC_KEY_RECORD_REQUIRED');
  need(typeof key.kid === 'string' && new RegExp(`^${hub}-v23-prod-[0-9]{8}$`).test(key.kid) && key.kid.length <= 64, 'KID_FORMAT');
  dateValid(key.kid.slice(-8));
  return { ...key, fingerprint: fingerprint(key.publicKeyPem) };
}

function metadataCheck(metadata, now) {
  noPrivateInput(metadata);
  need(metadata?.source === 'approved-vercel-connector' && metadata.decrypted === false && metadata.scope === SCOPE, 'APPROVED_METADATA_REQUIRED');
  fresh(metadata.capturedAt, now);
  need(metadata.projects && Object.keys(metadata.projects).sort().join() === [...ALL].sort().join(), 'COMPLETE_PROJECT_METADATA_REQUIRED');
  for (const hub of ALL) {
    const p = metadata.projects[hub];
    need(p?.name === PROJECTS[hub] && typeof p.id === 'string' && /^prj_[A-Za-z0-9]+$/.test(p.id)
      && p.environment === 'production' && Array.isArray(p.env), 'PROJECT_TARGET_MISMATCH');
    need(p.env.every(e => e && Object.keys(e).sort().join() === 'key,type' && /^[A-Z0-9_]+$/.test(e.key)
      && ['secret','sensitive','encrypted','plain','config','system'].includes(e.type)), 'NAME_ONLY_METADATA_REQUIRED');
    need(new Set(p.env.map(e => e.key)).size === p.env.length, 'DUPLICATE_ENV_METADATA');
  }
  need(new Set(ALL.map(h => metadata.projects[h].id)).size === ALL.length, 'DUPLICATE_PROJECT_ID');
}

function inventoryCheck(inventory, metadata, expectedAsk, now) {
  noPrivateInput(inventory);
  need(inventory?.source === 'approved-public-key-inventory' && inventory.scope === SCOPE && inventory.complete === true, 'PUBLIC_INVENTORY_REQUIRED');
  fresh(inventory.capturedAt, now);
  need(Object.keys(inventory.keys ?? {}).sort().join() === [...ALL].sort().join(), 'ALL_SEVEN_PUBLIC_SLOTS_REQUIRED');
  const keys = {};
  for (const hub of ALL) {
    const entry = inventory.keys[hub];
    need(entry !== null || HUBS.includes(hub), 'ASK_AND_MOVE_PUBLIC_KEYS_REQUIRED');
    if (entry !== null) keys[hub] = keyInfo(hub, entry);
    // Every existing specialist verification slot on Ask must have a public
    // observation; absence cannot be used to hide a conflicting installed key.
    if (HUBS.includes(hub)) {
      const names = metadata.projects.ask.env.map(e => e.key);
      const kid = names.includes(envName(hub,'KEY_ID')), pub = names.includes(envName(hub,'VERIFY_PUBLIC_KEY_PEM'));
      const specialistNames = metadata.projects[hub].env.map(e => e.key);
      const sk = specialistNames.includes(envName(hub,'KEY_ID')), priv = specialistNames.includes(envName(hub,'SIGNING_PRIVATE_KEY_PEM'));
      need(kid === pub && sk === priv && ((kid || sk) ? entry !== null : entry === null), 'INVENTORY_METADATA_DISAGREE');
    }
  }
  need(/^[a-f0-9]{64}$/.test(expectedAsk ?? '') && keys.ask.fingerprint === expectedAsk, 'ASK_FINGERPRINT_MISMATCH');
  need(Object.keys(inventory.askCopies ?? {}).sort().join() === [...HUBS].sort().join(), 'ASK_PUBLIC_COPIES_REQUIRED');
  for (const hub of HUBS) {
    const copy = inventory.askCopies[hub], names = metadata.projects[hub].env.map(e => e.key);
    need(copy && Object.keys(copy).sort().join() === 'kid,publicKeyPem', 'ASK_PUBLIC_COPIES_REQUIRED');
    need(names.includes(envName('ask','KEY_ID')) === (copy.kid !== null)
      && names.includes(envName('ask','VERIFY_PUBLIC_KEY_PEM')) === (copy.publicKeyPem !== null), 'ASK_COPY_METADATA_DISAGREE');
    if (copy.kid !== null) need(copy.kid === keys.ask.kid, 'EXISTING_ASK_TRUST_MISMATCH');
    if (copy.publicKeyPem !== null) need(fingerprint(copy.publicKeyPem) === keys.ask.fingerprint, 'EXISTING_ASK_TRUST_MISMATCH');
  }
  // Include public receipts for staged/old specialist pairs not currently on
  // Ask, so an unselected partial rollout cannot conceal a duplicate key.
  need(Array.isArray(inventory.additionalKeys), 'ADDITIONAL_PUBLIC_KEYS_REQUIRED');
  const additional = inventory.additionalKeys.map(row => {
    need(HUBS.includes(row.hub) && Object.keys(row).sort().join() === 'hub,kid,publicKeyPem', 'INVALID_ADDITIONAL_PUBLIC_KEY');
    return { hub: row.hub, ...keyInfo(row.hub, { kid: row.kid, publicKeyPem: row.publicKeyPem }) };
  });
  unique([...Object.values(keys), ...additional]);
  return { keys, additional };
}

function unique(keys) {
  // Separate checks make a duplicate KID independently testable from SPKI.
  need(new Set(keys.map(k => k.kid)).size === keys.length, 'DUPLICATE_KID');
  need(new Set(keys.map(k => k.fingerprint)).size === keys.length, 'DUPLICATE_SPKI');
}

function targetsCheck(rows, metadata, replace) {
  need(replace.every(n => rows.some(r => r.name === n) && !protectedName(n)), 'REPLACE_NOT_SELECTED_OR_PROTECTED');
  for (const row of rows) {
    const exists = metadata.projects[row.project].env.some(e => e.key === row.name);
    need(!exists || replace.includes(row.name), 'TARGET_NAME_EXISTS');
    need(!replace.includes(row.name) || exists, 'REPLACE_TARGET_ABSENT');
    need(row.project !== 'move' && !(row.project === 'ask' && protectedName(row.name)), 'ASK_MOVE_TARGET_FORBIDDEN');
  }
}

export function cliWriter(cli, spawn = spawnSync) {
  need(typeof cli === 'string' && cli.length > 0, 'VERCEL_CLI_REQUIRED');
  return ({ projectId, name, value, replace }) => {
    // No shell, --value, --token, disk secret, inherited output, debug, env pull,
    // decrypt endpoint, deployment command, or automatic project linking.
    const args = [resolve(cli), 'env', 'add', name, 'production', '--scope', SCOPE,
      '--project', projectId, '--non-interactive', '--yes', isPrivateName(name) ? '--sensitive' : '--no-sensitive',
      ...(replace ? ['--force'] : [])];
    let result;
    try { result = spawn(process.execPath, args, { input: value, stdio: ['pipe','pipe','pipe'], windowsHide: true, timeout: 120000, maxBuffer: 1024 * 1024 }); }
    catch { fail('VERCEL_WRITE_FAILED'); }
    // The CLI may echo stdin in an error: never forward either stream or error.
    need(result.status === 0 && !result.error, 'VERCEL_WRITE_FAILED');
  };
}

export async function run(options, deps = {}) {
  const output = deps.output ?? (line => console.log(line));
  const now = deps.now ?? Date.now();
  const readJson = deps.readJson ?? (path => {
    try { return JSON.parse(readFileSync(path, 'utf8')); } catch { fail('INPUT_FILE_INVALID'); }
  });
  const hubs = options.hubs.length ? options.hubs : HUBS;
  let rows = plan(hubs, options.placement ?? 'both');
  // Default is completely offline and does not even read an input file.
  if (options.mode === 'dry-run') {
    for (const row of rows) output(`${PROJECTS[row.project]} production ${row.name}`);
    return;
  }
  const metadata = readJson(options.metadata);
  metadataCheck(metadata, now);
  if (options.mode === 'verify-names') {
    let missing = false;
    for (const row of rows) {
      const entry = metadata.projects[row.project].env.find(e => e.key === row.name);
      const present = Boolean(entry && (!isPrivateName(row.name) || ['secret','sensitive'].includes(entry.type)));
      if (!present) missing = true;
      output(`${PROJECTS[row.project]} production ${row.name} ${present ? 'PRESENT' : 'MISSING_OR_WRONG_TYPE'}`);
    }
    need(!missing, 'NAME_VERIFICATION_FAILED');
    return;
  }
  need(options.mode === 'apply' && options.hubs.length && options.closedGates, 'EXPLICIT_APPLY_REQUIRED');
  const inventory = readJson(options.inventory);
  const { keys: existing, additional } = inventoryCheck(inventory, metadata, options.askFingerprint, now);
  need(!options.replace.some(protectedName), 'REPLACE_NOT_SELECTED_OR_PROTECTED');
  // Verified existing copies of Ask's public trust are read-only, not write
  // targets. A missing half can be added; an existing half is never replaced.
  rows = rows.filter(row => !protectedName(row.name) || !metadata.projects[row.project].env.some(e => e.key === row.name));
  targetsCheck(rows, metadata, options.replace);
  const staged = {};
  const secrets = new Map();
  let bundleHandle;
  const generate = deps.generate ?? (() => generateKeyPairSync('ed25519'));
  const writeEnv = deps.writeEnv ?? cliWriter(options.cli);
  try {
    if (options.placement === 'specialist') {
      dateValid(options.date);
      // An exclusive public-only receipt is reserved only after all key guards.
      for (const hub of hubs) {
        const pair = generate();
        const key = keyInfo(hub, { kid: `${hub}-v23-prod-${options.date}`,
          publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString() });
        need(pair.privateKey.asymmetricKeyType === 'ed25519' && fingerprint(createPublicKey(pair.privateKey).export({type:'spki',format:'pem'}).toString()) === key.fingerprint, 'KEYPAIR_MISMATCH');
        // Compare against installed keys (including any replaced key) and all
        // newly staged hubs before the first external write.
        unique([...Object.values(existing), ...additional, ...Object.values(staged), key]);
        staged[hub] = key;
        secrets.set(hub, Buffer.from(pair.privateKey.export({ type: 'pkcs8', format: 'pem' })));
      }
      const bundle = state => ({ version: 1, scope: SCOPE, state, askFingerprint: existing.ask.fingerprint,
        keys: Object.fromEntries(Object.entries(staged).map(([h,k]) => [h,{kid:k.kid,publicKeyPem:k.publicKeyPem}])) });
      bundleHandle = (deps.reserveBundle ?? reserveBundle)(options.bundles[0], bundle('pending'));
      bundleHandle.complete = () => bundleHandle.save(bundle('specialists-written'));
    } else {
      need(options.placement === 'ask', 'EXPLICIT_PLACEMENT_REQUIRED');
      for (const file of options.bundles) {
        const b = readJson(file); noPrivateInput(b);
        need(b.version === 1 && b.scope === SCOPE && b.state === 'specialists-written'
          && b.askFingerprint === existing.ask.fingerprint, 'UNVERIFIED_PUBLIC_BUNDLE');
        for (const [hub, key] of Object.entries(b.keys ?? {})) {
          need(hubs.includes(hub) && !staged[hub], 'BUNDLE_HUB_NOT_SELECTED_OR_DUPLICATED');
          staged[hub] = keyInfo(hub, key);
        }
      }
      need(hubs.every(h => staged[h]), 'BUNDLE_HUB_MISSING');
      for (const hub of hubs) {
        need(existing[hub]?.kid === staged[hub].kid && existing[hub]?.fingerprint === staged[hub].fingerprint,
          'BUNDLE_DIFFERS_FROM_INSTALLED_SPECIALIST');
      }
      // Paired copies of the same hub are intentional; all different hubs must
      // differ. A bundle may not reuse an old key of a different selected hub.
      for (const [hub,key] of Object.entries(staged)) {
        const others = Object.entries(existing).filter(([h]) => h !== hub).map(([,k]) => k);
        const extras = additional.filter(k => !(k.hub === hub && k.kid === key.kid && k.fingerprint === key.fingerprint));
        unique([...others, ...extras, key]);
      }
      unique(Object.values({ ...existing, ...staged }));
      for (const row of plan(hubs, 'specialist')) {
        const e = metadata.projects[row.project].env.find(e => e.key === row.name);
        need(e && (!isPrivateName(row.name) || ['secret','sensitive'].includes(e.type)), 'SPECIALIST_PLACEMENT_NOT_VERIFIED');
      }
    }
    // Recheck snapshot age after crypto, immediately before any external write.
    fresh(metadata.capturedAt, deps.now ?? Date.now());
    fresh(inventory.capturedAt, deps.now ?? Date.now());
    for (const row of rows) {
      let value;
      if (isPrivateName(row.name)) value = secrets.get(row.hub);
      else if (row.name === PREFIX+'PARENT_ORIGIN') value = 'https://www.asktrusthub.com';
      else if (row.name === envName('ask','KEY_ID')) value = existing.ask.kid;
      else if (row.name === envName('ask','VERIFY_PUBLIC_KEY_PEM')) value = existing.ask.publicKeyPem;
      else value = row.name.endsWith('_KEY_ID') ? staged[row.hub].kid : staged[row.hub].publicKeyPem;
      need(value !== undefined, 'PLACEMENT_VALUE_MISSING');
      await writeEnv({ projectId: metadata.projects[row.project].id, project: PROJECTS[row.project],
        name: row.name, value, replace: options.replace.includes(row.name) });
      output(`${PROJECTS[row.project]} production ${row.name} WRITTEN`);
    }
    bundleHandle?.complete();
    for (const key of Object.values(staged)) output(`${key.kid} sha256:${key.fingerprint}`);
  } finally {
    for (const value of secrets.values()) if (Buffer.isBuffer(value)) value.fill(0);
    secrets.clear();
    bundleHandle?.close();
  }
}

function reserveBundle(path, initial) {
  let fd;
  try { fd = openSync(path, 'wx', 0o600); } catch { fail('PUBLIC_BUNDLE_MUST_BE_NEW'); }
  const save = value => {
    noPrivateInput(value);
    try { ftruncateSync(fd, 0); writeSync(fd, JSON.stringify(value,null,2)+'\n', 0, 'utf8'); }
    catch { fail('PUBLIC_BUNDLE_WRITE_FAILED'); }
  };
  try { save(initial); } catch (error) { closeSync(fd); throw error; }
  return { save, close: () => closeSync(fd) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await run(parseArgs(process.argv.slice(2))); }
  catch (error) {
    // Only allow constant internal error codes. Never print an input, PEM, CLI
    // stderr, child Error, stack, process environment, or command's stdin.
    const code = /^[A-Z][A-Z0-9_]+$/.test(error?.message ?? '') ? error.message : 'PROVISIONING_FAILED';
    console.error(code); process.exitCode = 1;
  }
}
