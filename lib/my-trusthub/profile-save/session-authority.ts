import { createHash, createHmac } from 'node:crypto';
import { ISOLATED_PROJECT } from './isolated-config.ts';

/** HMAC key material is sha256 of the Ask signing PEM for the same deployment
 * target. The database stores that digest; the runtime login never receives it
 * and cannot mint a MAC. The project ref is part of the signed message, so an
 * attestation minted for one project never binds on another. */
export const SESSION_MAC_VERSION = 'v23-session/1';
export const SESSION_ATTESTATION_TTL_SECONDS = 120;

export function sessionMacKey(pem: string): Buffer {
  return createHash('sha256').update(Buffer.from(pem, 'utf8')).digest();
}

export function sessionMacMessage(subject: string, session: string, expiresUnix: number, project: string = ISOLATED_PROJECT): string {
  return `${SESSION_MAC_VERSION}|${project}|${subject.toLowerCase()}|${session.toLowerCase()}|${expiresUnix}`;
}

export function sessionMac(pem: string, subject: string, session: string, expiresUnix: number, project: string = ISOLATED_PROJECT): Buffer {
  return createHmac('sha256', sessionMacKey(pem)).update(sessionMacMessage(subject, session, expiresUnix, project), 'utf8').digest();
}

/** Cap a verified Auth expiry so a revoked session's DB attestation dies quickly.
 * getUser() is the revocation check; this bound is only the residual DB window. */
export function sessionAttestationExpiry(claimsExp: number, nowUnix = Math.floor(Date.now() / 1000)): number {
  return Math.min(claimsExp, nowUnix + SESSION_ATTESTATION_TTL_SECONDS);
}
