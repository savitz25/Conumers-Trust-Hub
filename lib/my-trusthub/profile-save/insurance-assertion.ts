import { createPrivateKey, createPublicKey, randomBytes, sign, verify } from 'node:crypto';
import { opaque } from './isolated-config.ts';
import { RuntimeError } from './runtime.ts';
import { ASSERTION_HEADER, ASSERTION_TTL_SECONDS, bodyDigest, type AssertionKey, type NonceStore, type Scope } from './service-assertion.ts';

/** Same claim set the Insurance specialist already signs. The issuer is
 * urn:trusthub:v23:insurance:<service> and carries no project id. A Move or
 * Lender token cannot verify here. */
export type InsuranceService = 'ask' | 'insurance';
export type InsurancePins = {
  parentOrigin: string;
  insuranceOrigin: string;
  assertionEnvironment: 'isolated' | 'production';
};
export const INSURANCE_PRODUCTION_PINS: InsurancePins = {
  parentOrigin: 'https://www.asktrusthub.com',
  insuranceOrigin: 'https://www.insurancetrusthub.com',
  assertionEnvironment: 'production',
};
export const insuranceServiceIdentity = (service: InsuranceService, pins: InsurancePins) =>
  `svc:trusthub:${service}:v23:${pins.assertionEnvironment}`;
export const insuranceIssuer = (service: InsuranceService) => `urn:trusthub:v23:insurance:${service}`;
export type InsuranceAssertionClaims = {
  v: 1; iss: string; sub: string; aud: string; scope: Scope; method: 'POST'; path: string;
  body_sha256: string; iat: number; exp: number; jti: string;
  ask_origin: string; insurance_origin: string; browser: string; session: string | null; grant: string | null;
};
const CLAIM_KEYS = 'ask_origin,aud,body_sha256,browser,exp,grant,iat,insurance_origin,iss,jti,method,path,scope,session,sub,v';
const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
function decode(value: string): unknown {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || Buffer.from(value, 'base64url').toString('base64url') !== value) throw new RuntimeError('unauthorized');
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}
export function signInsuranceAssertion(key: AssertionKey, service: InsuranceService, target: string, scope: Scope, body: Uint8Array,
  browser: string, session: string | null = null, grant: string | null = null, now = Date.now(), pins: InsurancePins = INSURANCE_PRODUCTION_PINS): string {
  const url = new URL(target), privateKey = createPrivateKey(key.pem);
  if (privateKey.asymmetricKeyType !== 'ed25519' || !opaque(browser) || url.search || url.hash ||
      url.origin !== (service === 'ask' ? pins.insuranceOrigin : pins.parentOrigin)) throw new RuntimeError('unavailable');
  const iat = Math.floor(now / 1000);
  const claims: InsuranceAssertionClaims = {
    v: 1, iss: insuranceIssuer(service), sub: insuranceServiceIdentity(service, pins), aud: target,
    scope, method: 'POST', path: url.pathname, body_sha256: bodyDigest(body), iat, exp: iat + ASSERTION_TTL_SECONDS,
    jti: randomBytes(32).toString('base64url'), ask_origin: pins.parentOrigin, insurance_origin: pins.insuranceOrigin,
    browser, session, grant,
  };
  const unsigned = encode({ alg: 'EdDSA', typ: 'trusthub-v23+jws', kid: key.kid }) + '.' + encode(claims);
  return unsigned + '.' + sign(null, Buffer.from(unsigned), privateKey).toString('base64url');
}
export async function verifyInsuranceAssertion(request: Request, body: Uint8Array, key: AssertionKey, service: InsuranceService,
  scope: Scope, nonces: NonceStore, now = Date.now(), pins: InsurancePins = INSURANCE_PRODUCTION_PINS): Promise<InsuranceAssertionClaims> {
  try {
    const value = request.headers.get(ASSERTION_HEADER);
    if (!value || value.length > 4096 || request.method !== 'POST' || body.length > 131072) throw 0;
    const pieces = value.split('.'); if (pieces.length !== 3) throw 0;
    const header = decode(pieces[0]) as Record<string, unknown>;
    if (!header || Object.keys(header).sort().join() !== 'alg,kid,typ' || header.alg !== 'EdDSA' || header.typ !== 'trusthub-v23+jws' || header.kid !== key.kid) throw 0;
    const publicKey = createPublicKey(key.pem), signature = Buffer.from(pieces[2], 'base64url');
    if (publicKey.asymmetricKeyType !== 'ed25519' || signature.length !== 64 || signature.toString('base64url') !== pieces[2] ||
      !verify(null, Buffer.from(pieces[0] + '.' + pieces[1]), publicKey, signature)) throw 0;
    const claims = decode(pieces[1]) as InsuranceAssertionClaims;
    if (!claims || Object.keys(claims).sort().join() !== CLAIM_KEYS) throw 0;
    const url = new URL(request.url), seconds = Math.floor(now / 1000);
    if (url.search || url.hash || url.origin !== (service === 'insurance' ? pins.parentOrigin : pins.insuranceOrigin) ||
      claims.v !== 1 || claims.iss !== insuranceIssuer(service) || claims.sub !== insuranceServiceIdentity(service, pins) || claims.aud !== request.url ||
      claims.scope !== scope || claims.method !== request.method || claims.path !== url.pathname || claims.body_sha256 !== bodyDigest(body) ||
      claims.ask_origin !== pins.parentOrigin || claims.insurance_origin !== pins.insuranceOrigin || !opaque(claims.browser) || !opaque(claims.jti) ||
      claims.session !== null && !/^[a-f0-9]{64}$/.test(claims.session) || claims.grant !== null && !opaque(claims.grant) ||
      !Number.isInteger(claims.iat) || !Number.isInteger(claims.exp) || claims.exp - claims.iat !== ASSERTION_TTL_SECONDS ||
      claims.iat > seconds + 2 || claims.exp <= seconds || claims.iat < seconds - ASSERTION_TTL_SECONDS) throw 0;
    if (!await nonces.claim(bodyDigest(Buffer.from(claims.iss + ':' + key.kid + ':' + claims.jti)), (claims.exp + 2) * 1000)) throw 0;
    return claims;
  } catch (error) { if (error instanceof RuntimeError) throw error; throw new RuntimeError('unauthorized'); }
}
export { ASSERTION_HEADER };

/** Production pins only. A preview target never gains an Insurance origin from this helper. */
export function insurancePinsFor(target: { kind: string; parentOrigin: string }): InsurancePins | null {
  if (target.kind !== 'production') return null;
  if (target.parentOrigin !== INSURANCE_PRODUCTION_PINS.parentOrigin) return null;
  return INSURANCE_PRODUCTION_PINS;
}
