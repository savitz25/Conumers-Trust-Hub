import { createHash, createPrivateKey, createPublicKey, randomBytes, sign, verify } from 'node:crypto';
import { ASK_PREVIEW, MOVE_PREVIEW, opaque } from './isolated-config.ts';
import { RuntimeError } from './runtime.ts';

export const ASSERTION_HEADER = 'x-trusthub-v23-assertion';
export const ASSERTION_TTL_SECONDS = 30;
export type Scope = 'source:read' | 'source:ack' | 'transfer:stage' | 'receipt:verify';
export type Service = 'ask' | 'move';
export const serviceIdentity = (service: Service) => `svc:trusthub:${service}:v23:isolated`;
export const issuer = (service: Service) => `urn:trusthub:v23:xkkiicsassizmakcvxml:${service}`;
export type AssertionClaims = {
  v: 1; iss: string; sub: string; aud: string; scope: Scope; method: 'POST'; path: string;
  body_sha256: string; iat: number; exp: number; jti: string;
  ask_origin: string; move_origin: string; browser: string; session: string | null; grant: string | null;
};
export type AssertionKey = { kid: string; pem: string };
export type NonceStore = { claim(key: string, expiresAt: number): Promise<boolean> };
export const bodyDigest = (body: Uint8Array) => createHash('sha256').update(body).digest('hex');
const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
function decode(value: string): unknown {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || Buffer.from(value, 'base64url').toString('base64url') !== value) throw new RuntimeError('unauthorized');
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}
export function signAssertion(key: AssertionKey, service: Service, target: string, scope: Scope, body: Uint8Array,
  browser: string, session: string | null = null, grant: string | null = null, now = Date.now()): string {
  const url = new URL(target), privateKey = createPrivateKey(key.pem);
  if (privateKey.asymmetricKeyType !== 'ed25519' || !opaque(browser) || url.search || url.hash ||
      url.origin !== (service === 'ask' ? MOVE_PREVIEW : ASK_PREVIEW)) throw new RuntimeError('unavailable');
  const iat = Math.floor(now / 1000);
  const claims: AssertionClaims = { v: 1, iss: issuer(service), sub: serviceIdentity(service), aud: target,
    scope, method: 'POST', path: url.pathname, body_sha256: bodyDigest(body), iat, exp: iat + ASSERTION_TTL_SECONDS,
    jti: randomBytes(32).toString('base64url'), ask_origin: ASK_PREVIEW, move_origin: MOVE_PREVIEW, browser, session, grant };
  const unsigned = encode({ alg: 'EdDSA', typ: 'trusthub-v23+jws', kid: key.kid }) + '.' + encode(claims);
  return unsigned + '.' + sign(null, Buffer.from(unsigned), privateKey).toString('base64url');
}
/** Signature and request binding are checked BEFORE atomically burning the nonce.
 * No JWT user object, consumer ID, origin header or unsigned field is authority. */
export async function verifyAssertion(request: Request, body: Uint8Array, key: AssertionKey, service: Service,
  scope: Scope, nonces: NonceStore, now = Date.now()): Promise<AssertionClaims> {
  try {
    const value = request.headers.get(ASSERTION_HEADER);
    if (!value || value.length > 4096 || request.method !== 'POST' || body.length > 131072) throw 0;
    const pieces = value.split('.'); if (pieces.length !== 3) throw 0;
    const h = decode(pieces[0]) as Record<string, unknown>;
    if (!h || Object.keys(h).sort().join() !== 'alg,kid,typ' || h.alg !== 'EdDSA' || h.typ !== 'trusthub-v23+jws' || h.kid !== key.kid) throw 0;
    const publicKey = createPublicKey(key.pem), signature = Buffer.from(pieces[2], 'base64url');
    if (publicKey.asymmetricKeyType !== 'ed25519' || signature.length !== 64 || signature.toString('base64url') !== pieces[2] ||
      !verify(null, Buffer.from(pieces[0] + '.' + pieces[1]), publicKey, signature)) throw 0;
    const c = decode(pieces[1]) as AssertionClaims;
    if (!c || Object.keys(c).sort().join() !== 'ask_origin,aud,body_sha256,browser,exp,grant,iat,iss,jti,method,move_origin,path,scope,session,sub,v') throw 0;
    const url = new URL(request.url), seconds = Math.floor(now / 1000);
    if (url.search || url.hash || url.origin !== (service === 'move' ? ASK_PREVIEW : MOVE_PREVIEW) ||
      c.v !== 1 || c.iss !== issuer(service) || c.sub !== serviceIdentity(service) || c.aud !== request.url ||
      c.scope !== scope || c.method !== request.method || c.path !== url.pathname || c.body_sha256 !== bodyDigest(body) ||
      c.ask_origin !== ASK_PREVIEW || c.move_origin !== MOVE_PREVIEW || !opaque(c.browser) || !opaque(c.jti) ||
      c.session !== null && !/^[a-f0-9]{64}$/.test(c.session) || c.grant !== null && !opaque(c.grant) ||
      !Number.isInteger(c.iat) || !Number.isInteger(c.exp) || c.exp - c.iat !== ASSERTION_TTL_SECONDS ||
      c.iat > seconds + 2 || c.exp <= seconds || c.iat < seconds - ASSERTION_TTL_SECONDS) throw 0;
    if (!await nonces.claim(bodyDigest(Buffer.from(c.iss + ':' + key.kid + ':' + c.jti)), (c.exp + 2) * 1000)) throw 0;
    return c;
  } catch { throw new RuntimeError('unauthorized'); }
}
export async function boundedBody(request: Request | Response, limit = 131072): Promise<Buffer> {
  if (!request.body) throw new RuntimeError('invalid');
  const reader = request.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try { for (;;) { const r = await reader.read(); if (r.done) break; size += r.value.byteLength;
    if (size > limit) { await reader.cancel(); throw new RuntimeError('invalid'); } chunks.push(r.value); }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
