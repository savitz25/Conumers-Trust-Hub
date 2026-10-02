#!/usr/bin/env node
// My TrustHub V2 production handoff — signing key provisioning.
//
// Generates two fresh ed25519 key pairs (Ask, Move) for the PRODUCTION pair and
// writes them to the Vercel Production environments of both projects through
// the Vercel CLI (stdin), never printing a secret. Writes ONLY the session-MAC
// hex (sha256 of the Ask private PEM, UTF-8, no trailing newline) to a local
// secure file for docs/my-trusthub/v2/production/05-ask-prod-session-mac-install.sql.
// Preview keys are never read or reused. Nothing touches the preview branches.
//
// Usage (machine logged into Vercel for team savitz25-s-projects):
//   node scripts/release/mth-v2-prod-secrets.mjs            # dry run: prints the plan only
//   node scripts/release/mth-v2-prod-secrets.mjs --apply    # generate + write
import { generateKeyPairSync, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const APPLY = process.argv.includes('--apply');
const SCOPE = 'savitz25-s-projects';
const PROJECTS = { ask: 'conumers-trust-hub', move: 'move-trust-hub' };
const DATE = new Date().toISOString().slice(0, 10).replaceAll('-', '');
const ASK_KID = `ask-v23-prod-${DATE}`;
const MOVE_KID = `move-v23-prod-${DATE}`;
const secretsDir = join(process.env.USERPROFILE ?? process.env.HOME ?? '.', '.trusthub-secrets');
const macFile = join(secretsDir, 'v23-prod-session-mac.hex');

function pem(kind, key) {
  return kind === 'private' ? key.export({ type: 'pkcs8', format: 'pem' }).toString() : key.export({ type: 'spki', format: 'pem' }).toString();
}
function vercelEnvAdd(project, name, value, sensitive) {
  // `vercel env add NAME production` reads the value from stdin. --sensitive hides it in the dashboard.
  const args = ['vercel', 'env', 'add', name, 'production', '--scope', SCOPE, '--force', ...(sensitive ? ['--sensitive'] : [])];
  const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { input: value, stdio: ['pipe', 'ignore', 'inherit'], cwd: projectDir(project) });
  if (result.status !== 0) throw new Error(`vercel env add ${name} failed for ${project} (exit ${result.status})`);
}
function projectDir(project) {
  // Run inside a directory linked to the target project so the CLI resolves it.
  const dir = process.env[`MTH_${project.toUpperCase()}_PROJECT_DIR`];
  if (!dir || !existsSync(join(dir, '.vercel', 'project.json'))) throw new Error(`Set MTH_${project.toUpperCase()}_PROJECT_DIR to a checkout linked to ${PROJECTS[project]}`);
  return dir;
}

const plan = [
  ['ask', 'MY_TRUSTHUB_V23_ASK_KEY_ID', ASK_KID, false],
  ['ask', 'MY_TRUSTHUB_V23_ASK_SIGNING_PRIVATE_KEY_PEM', '<ask private pem>', true],
  ['ask', 'MY_TRUSTHUB_V23_MOVE_KEY_ID', MOVE_KID, false],
  ['ask', 'MY_TRUSTHUB_V23_MOVE_VERIFY_PUBLIC_KEY_PEM', '<move public pem>', false],
  ['move', 'MY_TRUSTHUB_V23_MOVE_KEY_ID', MOVE_KID, false],
  ['move', 'MY_TRUSTHUB_V23_MOVE_SIGNING_PRIVATE_KEY_PEM', '<move private pem>', true],
  ['move', 'MY_TRUSTHUB_V23_ASK_KEY_ID', ASK_KID, false],
  ['move', 'MY_TRUSTHUB_V23_ASK_VERIFY_PUBLIC_KEY_PEM', '<ask public pem>', false],
];
console.log(APPLY ? 'APPLY: generating production key pairs and writing Vercel Production env' : 'DRY RUN (add --apply to execute)');
for (const [project, name, shown, sensitive] of plan) console.log(`  ${PROJECTS[project]}  ${name}${sensitive ? '  (sensitive)' : ''}  ${shown.startsWith('<') ? shown : '= ' + shown}`);
console.log(`  local file: ${macFile}  (session MAC hex only)`);
if (!APPLY) process.exit(0);

const ask = generateKeyPairSync('ed25519');
const move = generateKeyPairSync('ed25519');
const askPrivate = pem('private', ask.privateKey), askPublic = pem('public', ask.publicKey);
const movePrivate = pem('private', move.privateKey), movePublic = pem('public', move.publicKey);
const values = {
  '<ask private pem>': askPrivate, '<ask public pem>': askPublic, '<move private pem>': movePrivate, '<move public pem>': movePublic,
};
for (const [project, name, shown, sensitive] of plan) {
  vercelEnvAdd(project, name, values[shown] ?? shown, sensitive);
  console.log(`  wrote ${PROJECTS[project]} ${name}`);
}
mkdirSync(secretsDir, { recursive: true });
writeFileSync(macFile, createHash('sha256').update(Buffer.from(askPrivate, 'utf8')).digest('hex') + '\n', { encoding: 'utf8', mode: 0o600 });
console.log(`  wrote ${macFile}`);
console.log('Done. Load the hex into v23.install_session_mac through a non-echoing runner for 05-ask-prod-session-mac-install.sql, then delete the file.');
