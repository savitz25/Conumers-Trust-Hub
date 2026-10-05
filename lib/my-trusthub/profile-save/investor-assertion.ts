import { createPrivateKey, createPublicKey, randomBytes, sign, verify } from 'node:crypto';
import { opaque } from './isolated-config.ts';
import { RuntimeError } from './runtime.ts';
import { ASSERTION_HEADER, ASSERTION_TTL_SECONDS, bodyDigest, type AssertionKey, type NonceStore, type Scope } from './service-assertion.ts';

/** Parallel to the Move and Lender assertions. Claim keys include investor_origin
 * and never move_origin or lender_origin, so no other hub's token verifies
 * here and an Investor token verifies nowhere else. */
export type InvestorService = 'ask' | 'investor';
export type InvestorPins = {
  parentOrigin: string;
  investorOrigin: string;
  project: string;
  assertionEnvironment: 'isolated' | 'production';
};
export const INVESTOR_PRODUCTION_PINS: InvestorPins = {
  parentOrigin: 'https://www.asktrusthub.com',
  investorOrigin: 'https://www.investortrusthub.com',
  project: 'qvvxvbcdmbjzrgvwjatw',
  assertionEnvironment: 'production',
};
export const investorServiceIdentity = (service: InvestorService, pins: InvestorPins) => `svc:trusthub:${service}:v23:${pins.assertionEnvironment}`;
export const investorIssuer = (service: InvestorService, pins: InvestorPins) => `urn:trusthub:v23:${pins.project}:${service}`;
export type InvestorAssertionClaims = {
  v: 1; iss: string; sub: string; aud: string; scope: Scope; method: 'POST'; path: string;
  body_sha256: string; iat: number; exp: number; jti: string;
  ask_origin: string; investor_origin: string; browser: string; session: string | null; grant: string | null;
};
const CLAIM_KEYS = 'ask_origin,aud,body_sha256,browser,exp,grant,iat,investor_origin,iss,jti,method,path,scope,session,sub,v';
const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
function decode(value: string): unknown {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || Buffer.from(value, 'base64url').toString('base64url') !== value) throw new RuntimeError('unauthorized');
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}
export function signInvestorAssertion(key: AssertionKey, service: InvestorService, target: string, scope: Scope, body: Uint8Array,
  browser: string, session: string | null = null, grant: string | null = null, now = Date.now(), pins: InvestorPins = INVESTOR_PRODUCTION_PINS): string {
  const url = new URL(target), privateKey = createPrivateKey(key.pem);
  if (privateKey.asymmetricKeyType !== 'ed25519' || !opaque(browser) || url.search || url.hash ||
      url.origin !== (service === 'ask' ? pins.investorOrigin : pins.parentOrigin)) throw new RuntimeError('unavailable');
  const iat = Math.floor(now / 1000);
  const claims: InvestorAssertionClaims = { v: 1, iss: investorIssuer(service, pins), sub: investorServiceIdentity(service, pins), aud: target,
    scope, method: 'POST', path: url.pathname, body_sha256: bodyDigest(body), iat, exp: iat + ASSERTION_TTL_SECONDS,
    jti: randomBytes(32).toString('base64url'), ask_origin: pins.parentOrigin, investor_origin: pins.investorOrigin, browser, session, grant };
  const unsigned = encode({ alg: 'EdDSA', typ: 'trusthub-v23+jws', kid: key.kid }) + '.' + encode(claims);
  return unsigned + '.' + sign(null, Buffer.from(unsigned), privateKey).toString('base64url');
}
export async function verifyInvestorAssertion(request: Request, body: Uint8Array, key: AssertionKey, service: InvestorService,
  scope: Scope, nonces: NonceStore, now = Date.now(), pins: InvestorPins = INVESTOR_PRODUCTION_PINS): Promise<InvestorAssertionClaims> {
  try {
    const value = request.headers.get(ASSERTION_HEADER);
    if (!value || value.length > 4096 || request.method !== 'POST' || body.length > 131072) throw 0;
    const pieces = value.split('.'); if (pieces.length !== 3) throw 0;
    const header = decode(pieces[0]) as Record<string, unknown>;
    if (!header || Object.keys(header).sort().join() !== 'alg,kid,typ' || header.alg !== 'EdDSA' || header.typ !== 'trusthub-v23+jws' || header.kid !== key.kid) throw 0;
    const publicKey = createPublicKey(key.pem), signature = Buffer.from(pieces[2], 'base64url');
    if (publicKey.asymmetricKeyType !== 'ed25519' || signature.length !== 64 || signature.toString('base64url') !== pieces[2] ||
      !verify(null, Buffer.from(pieces[0] + '.' + pieces[1]), publicKey, signature)) throw 0;
    const claims = decode(pieces[1]) as InvestorAssertionClaims;
    if (!claims || Object.keys(claims).sort().join() !== CLAIM_KEYS) throw 0;
    const url = new URL(request.url), seconds = Math.floor(now / 1000);
    if (url.search || url.hash || url.origin !== (service === 'investor' ? pins.parentOrigin : pins.investorOrigin) ||
      claims.v !== 1 || claims.iss !== investorIssuer(service, pins) || claims.sub !== investorServiceIdentity(service, pins) || claims.aud !== request.url ||
      claims.scope !== scope || claims.method !== request.method || claims.path !== url.pathname || claims.body_sha256 !== bodyDigest(body) ||
      claims.ask_origin !== pins.parentOrigin || claims.investor_origin !== pins.investorOrigin || !opaque(claims.browser) || !opaque(claims.jti) ||
      claims.session !== null && !/^[a-f0-9]{64}$/.test(claims.session) || claims.grant !== null && !opaque(claims.grant) ||
      !Number.isInteger(claims.iat) || !Number.isInteger(claims.exp) || claims.exp - claims.iat !== ASSERTION_TTL_SECONDS ||
      claims.iat > seconds + 2 || claims.exp <= seconds || claims.iat < seconds - ASSERTION_TTL_SECONDS) throw 0;
    if (!await nonces.claim(bodyDigest(Buffer.from(claims.iss + ':' + key.kid + ':' + claims.jti)), (claims.exp + 2) * 1000)) throw 0;
    return claims;
  } catch { throw new RuntimeError('unauthorized'); }
}
export { ASSERTION_HEADER, bodyDigest };
