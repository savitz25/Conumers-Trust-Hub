import { createPrivateKey, createPublicKey, randomBytes, sign, verify } from 'node:crypto';
import { opaque } from './isolated-config.ts';
import { RuntimeError } from './runtime.ts';
import { ASSERTION_HEADER, ASSERTION_TTL_SECONDS, bodyDigest, type AssertionKey, type NonceStore, type Scope } from './service-assertion.ts';

/** Parallel to the Move assertion. Claim keys include lender_origin and never
 * move_origin, so a Move token cannot verify here and a Lender token cannot
 * verify as Move. */
export type LenderService = 'ask' | 'lender';
export type LenderPins = {
  parentOrigin: string;
  lenderOrigin: string;
  project: string;
  assertionEnvironment: 'isolated' | 'production';
};
export const LENDER_PRODUCTION_PINS: LenderPins = {
  parentOrigin: 'https://www.asktrusthub.com',
  lenderOrigin: 'https://www.lendertrusthub.com',
  project: 'qvvxvbcdmbjzrgvwjatw',
  assertionEnvironment: 'production',
};
export const lenderServiceIdentity = (service: LenderService, pins: LenderPins) => `svc:trusthub:${service}:v23:${pins.assertionEnvironment}`;
export const lenderIssuer = (service: LenderService, pins: LenderPins) => `urn:trusthub:v23:${pins.project}:${service}`;
export type LenderAssertionClaims = {
  v: 1; iss: string; sub: string; aud: string; scope: Scope; method: 'POST'; path: string;
  body_sha256: string; iat: number; exp: number; jti: string;
  ask_origin: string; lender_origin: string; browser: string; session: string | null; grant: string | null;
};
const CLAIM_KEYS = 'ask_origin,aud,body_sha256,browser,exp,grant,iat,iss,jti,lender_origin,method,path,scope,session,sub,v';
const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
function decode(value: string): unknown {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || Buffer.from(value, 'base64url').toString('base64url') !== value) throw new RuntimeError('unauthorized');
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}
export function signLenderAssertion(key: AssertionKey, service: LenderService, target: string, scope: Scope, body: Uint8Array,
  browser: string, session: string | null = null, grant: string | null = null, now = Date.now(), pins: LenderPins = LENDER_PRODUCTION_PINS): string {
  const url = new URL(target), privateKey = createPrivateKey(key.pem);
  if (privateKey.asymmetricKeyType !== 'ed25519' || !opaque(browser) || url.search || url.hash ||
      url.origin !== (service === 'ask' ? pins.lenderOrigin : pins.parentOrigin)) throw new RuntimeError('unavailable');
  const iat = Math.floor(now / 1000);
  const claims: LenderAssertionClaims = { v: 1, iss: lenderIssuer(service, pins), sub: lenderServiceIdentity(service, pins), aud: target,
    scope, method: 'POST', path: url.pathname, body_sha256: bodyDigest(body), iat, exp: iat + ASSERTION_TTL_SECONDS,
    jti: randomBytes(32).toString('base64url'), ask_origin: pins.parentOrigin, lender_origin: pins.lenderOrigin, browser, session, grant };
  const unsigned = encode({ alg: 'EdDSA', typ: 'trusthub-v23+jws', kid: key.kid }) + '.' + encode(claims);
  return unsigned + '.' + sign(null, Buffer.from(unsigned), privateKey).toString('base64url');
}
export async function verifyLenderAssertion(request: Request, body: Uint8Array, key: AssertionKey, service: LenderService,
  scope: Scope, nonces: NonceStore, now = Date.now(), pins: LenderPins = LENDER_PRODUCTION_PINS): Promise<LenderAssertionClaims> {
  try {
    const value = request.headers.get(ASSERTION_HEADER);
    if (!value || value.length > 4096 || request.method !== 'POST' || body.length > 131072) throw 0;
    const pieces = value.split('.'); if (pieces.length !== 3) throw 0;
    const header = decode(pieces[0]) as Record<string, unknown>;
    if (!header || Object.keys(header).sort().join() !== 'alg,kid,typ' || header.alg !== 'EdDSA' || header.typ !== 'trusthub-v23+jws' || header.kid !== key.kid) throw 0;
    const publicKey = createPublicKey(key.pem), signature = Buffer.from(pieces[2], 'base64url');
    if (publicKey.asymmetricKeyType !== 'ed25519' || signature.length !== 64 || signature.toString('base64url') !== pieces[2] ||
      !verify(null, Buffer.from(pieces[0] + '.' + pieces[1]), publicKey, signature)) throw 0;
    const claims = decode(pieces[1]) as LenderAssertionClaims;
    if (!claims || Object.keys(claims).sort().join() !== CLAIM_KEYS) throw 0;
    const url = new URL(request.url), seconds = Math.floor(now / 1000);
    if (url.search || url.hash || url.origin !== (service === 'lender' ? pins.parentOrigin : pins.lenderOrigin) ||
      claims.v !== 1 || claims.iss !== lenderIssuer(service, pins) || claims.sub !== lenderServiceIdentity(service, pins) || claims.aud !== request.url ||
      claims.scope !== scope || claims.method !== request.method || claims.path !== url.pathname || claims.body_sha256 !== bodyDigest(body) ||
      claims.ask_origin !== pins.parentOrigin || claims.lender_origin !== pins.lenderOrigin || !opaque(claims.browser) || !opaque(claims.jti) ||
      claims.session !== null && !/^[a-f0-9]{64}$/.test(claims.session) || claims.grant !== null && !opaque(claims.grant) ||
      !Number.isInteger(claims.iat) || !Number.isInteger(claims.exp) || claims.exp - claims.iat !== ASSERTION_TTL_SECONDS ||
      claims.iat > seconds + 2 || claims.exp <= seconds || claims.iat < seconds - ASSERTION_TTL_SECONDS) throw 0;
    if (!await nonces.claim(bodyDigest(Buffer.from(claims.iss + ':' + key.kid + ':' + claims.jti)), (claims.exp + 2) * 1000)) throw 0;
    return claims;
  } catch { throw new RuntimeError('unauthorized'); }
}
export { ASSERTION_HEADER, bodyDigest };
