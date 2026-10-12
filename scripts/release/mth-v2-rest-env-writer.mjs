// Project-scoped REST transport for one Production environment variable.
// This file does not generate keys, call the Vercel CLI, or read a saved login.
import { HUBS, PROJECTS } from './mth-v2-specialist-keys.mjs';

export const API_ORIGIN = 'https://api.vercel.com';
export const DESTINATIONS = Object.freeze([...HUBS, 'ask']);
export const PARENT_ORIGIN = 'https://www.asktrusthub.com';
const CREDENTIAL = /^[A-Za-z0-9_]{20,256}$/;
const PROJECT_ID = /^prj_[A-Za-z0-9]+$/;
const CODE = /^[A-Z][A-Z0-9_]+$/;
const PRIVATE_PEM = /^-----BEGIN PRIVATE KEY-----\r?\n[A-Za-z0-9+/=\r\n]+\r?\n-----END PRIVATE KEY-----\s*$/;

const fail = code => { throw new Error(code); };
const need = (ok, code) => { if (!ok) fail(code); };

export function approvedWrites(destination) {
  need(DESTINATIONS.includes(destination), 'DESTINATION_FORBIDDEN');
  if (destination === 'ask') {
    return HUBS.flatMap(hub => [
      [`MY_TRUSTHUB_V23_${hub.toUpperCase()}_KEY_ID`, 'encrypted'],
      [`MY_TRUSTHUB_V23_${hub.toUpperCase()}_VERIFY_PUBLIC_KEY_PEM`, 'encrypted'],
    ]);
  }
  const prefix = `MY_TRUSTHUB_V23_${destination.toUpperCase()}`;
  const rows = [
    [`${prefix}_KEY_ID`, 'encrypted'],
    [`${prefix}_SIGNING_PRIVATE_KEY_PEM`, 'sensitive'],
    ['MY_TRUSTHUB_V23_ASK_KEY_ID', 'encrypted'],
    ['MY_TRUSTHUB_V23_ASK_VERIFY_PUBLIC_KEY_PEM', 'encrypted'],
  ];
  if (destination === 'insurance') rows.push(['MY_TRUSTHUB_V23_PARENT_ORIGIN', 'encrypted']);
  return rows;
}

export function assertCredential(credential) {
  need(typeof credential === 'string' && credential.length > 0, 'REST_CREDENTIAL_MISSING');
  need(CREDENTIAL.test(credential), 'REST_CREDENTIAL_INVALID');
}

// Certified run() supplies a PKCS#8 PEM Buffer and zeroes that Buffer in
// finally. JSON.stringify(Buffer) calls Buffer#toJSON and would persist a
// byte array instead of the PEM. Decode once to the UTF-8 string the JSON
// value field requires. The string lives only in the request body: it is not
// written to disk, returned, or copied into an error.
function jsonValue(name, value) {
  if (name.endsWith('_SIGNING_PRIVATE_KEY_PEM')) {
    need(Buffer.isBuffer(value), 'PRIVATE_PEM_BUFFER_REQUIRED');
    const text = value.toString('utf8');
    need(PRIVATE_PEM.test(text), 'PRIVATE_PEM_BUFFER_REQUIRED');
    return text;
  }
  need(typeof value === 'string' && value.length > 0, 'PUBLIC_VALUE_REQUIRED');
  need(!value.includes('PRIVATE KEY'), 'PRIVATE_MATERIAL_IN_PUBLIC_VALUE');
  if (name === 'MY_TRUSTHUB_V23_PARENT_ORIGIN') need(value === PARENT_ORIGIN, 'PARENT_ORIGIN_MISMATCH');
  if (name.endsWith('_VERIFY_PUBLIC_KEY_PEM')) need(value.startsWith('-----BEGIN PUBLIC KEY-----'), 'PUBLIC_PEM_REQUIRED');
  return value;
}

function transportFailure(error) {
  if (CODE.test(error?.message ?? '')) throw error;
  const name = error?.name ?? '';
  if (name === 'AbortError' || name === 'TimeoutError') fail('REST_TIMEOUT');
  if (/redirect/i.test(String(error?.message ?? ''))) fail('REST_REDIRECT');
  fail('REST_NETWORK');
}

async function discard(response) {
  try { await response.text(); } catch { /* Drop the body. Never attach it to an error. */ }
}

async function conflictCode(response) {
  let parsed;
  try { parsed = JSON.parse(await response.text()); } catch { return 'REST_FORBIDDEN'; }
  const code = parsed?.error?.code;
  if (typeof code === 'string' && /exist|conflict|duplicate/i.test(code)) return 'REST_CONFLICT';
  return 'REST_FORBIDDEN';
}

function acceptCreated(body, expected) {
  need(body && Array.isArray(body.failed) && body.failed.length === 0, body?.failed?.length ? 'REST_PARTIAL' : 'REST_AMBIGUOUS');
  const created = body.created;
  need(created && !Array.isArray(created) && typeof created === 'object', 'REST_AMBIGUOUS');
  need(created.key === expected.key && created.type === expected.type, 'REST_AMBIGUOUS');
  need(Array.isArray(created.target) && created.target.length === 1 && created.target[0] === 'production', 'REST_TARGET_AMBIGUOUS');
  need(!created.gitBranch, 'REST_TARGET_AMBIGUOUS');
  need(!Array.isArray(created.customEnvironmentIds) || created.customEnvironmentIds.length === 0, 'REST_TARGET_AMBIGUOUS');
}

export function createRestEnvWriter({ credential, destination, projectId, fetchImpl }) {
  assertCredential(credential);
  need(DESTINATIONS.includes(destination), 'DESTINATION_FORBIDDEN');
  need(typeof projectId === 'string' && PROJECT_ID.test(projectId), 'PROJECT_ID_INVALID');
  need(typeof fetchImpl === 'function', 'REST_FETCH_REQUIRED');
  const allowed = new Map(approvedWrites(destination));
  return async function writeEnv(record) {
    need(record?.replace !== true, 'REST_REPLACE_FORBIDDEN');
    need(record?.project !== PROJECTS.move, 'MOVE_WRITE_FORBIDDEN');
    need(record?.projectId === projectId && record?.project === PROJECTS[destination], 'REST_PROJECT_FORBIDDEN');
    const type = allowed.get(record?.name);
    need(type, 'REST_NAME_FORBIDDEN');
    const value = jsonValue(record.name, record.value);
    const payload = { key: record.name, value, type, target: ['production'] };
    const url = `${API_ORIGIN}/v10/projects/${encodeURIComponent(projectId)}/env`;
    let response;
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        redirect: 'error',
        cache: 'no-store',
        credentials: 'omit',
        signal: AbortSignal.timeout(30_000),
        headers: {
          Authorization: `Bearer ${credential}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      transportFailure(error);
    }
    if (response.status === 201) {
      let body;
      try { body = JSON.parse(await response.text()); } catch { fail('REST_AMBIGUOUS'); }
      acceptCreated(body, payload);
      return;
    }
    if (response.status === 401) { await discard(response); fail('REST_UNAUTHORIZED'); }
    if (response.status === 403) fail(await conflictCode(response));
    if (response.status === 404) { await discard(response); fail('REST_PROJECT_FORBIDDEN'); }
    if (response.status === 409) { await discard(response); fail('REST_CONFLICT'); }
    if (response.status === 429) { await discard(response); fail('REST_RATE_LIMITED'); }
    if (response.status >= 500) { await discard(response); fail('REST_SERVER_AMBIGUOUS'); }
    await discard(response);
    fail('REST_AMBIGUOUS');
  };
}
