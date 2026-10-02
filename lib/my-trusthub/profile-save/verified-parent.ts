import { admittedPreviewUser, ASK_PREVIEW, ISOLATED_PROJECT, uuid, type Env } from './isolated-config.ts';
import type { AccountUser } from '../account-policy.ts';
import type { BrowserParent } from './browser.ts';
import { sessionAttestationExpiry } from './session-authority.ts';

type AuthPort = { getUser(): Promise<{ data: { user: AccountUser | null }; error: unknown }>;
  getClaims(): Promise<{ data: { claims: Record<string, unknown> } | null; error: unknown }> };
/** Attestation is written only after getUser() and getClaims() succeed.
 * getUser() against the isolated Auth service is the revocation check. A revoked
 * session is not refreshed. An attestation already stored can still satisfy
 * preview_session_live until it expires, at most 120 seconds. The MAC is not a
 * substitute for getUser(). */
export type SessionAuthority = {
  bind(subject: string, session: string, expiresUnix: number): Promise<boolean>;
  live(subject: string, session: string): Promise<boolean>;
};
export async function verifiedParent(request: Request, env: Env, auth: AuthPort,
  authority: SessionAuthority): Promise<BrowserParent | null> {
  if (new URL(request.url).origin !== ASK_PREVIEW) return null;
  const user = await auth.getUser(); if (user.error || !admittedPreviewUser(user.data.user, env)) return null;
  const verified = await auth.getClaims(), claims = verified.data?.claims, u = user.data.user!;
  if (verified.error || !claims || claims.sub !== u.id || claims.iss !== `https://${ISOLATED_PROJECT}.supabase.co/auth/v1` ||
    !uuid(claims.session_id) || typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now()) return null;
  const expiresUnix = sessionAttestationExpiry(claims.exp);
  if (expiresUnix * 1000 <= Date.now()) return null;
  if (!await authority.bind(u.id, claims.session_id, expiresUnix)) return null;
  if (!await authority.live(u.id, claims.session_id)) return null;
  return { subject: u.id, session: claims.session_id, label: u.email ?? 'Your My TrustHub account' };
}
