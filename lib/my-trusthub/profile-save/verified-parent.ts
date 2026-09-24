import { admittedPreviewUser, ASK_PREVIEW, ISOLATED_PROJECT, uuid, type Env } from './isolated-config.ts';
import type { AccountUser } from '../account-policy.ts';
import type { BrowserParent } from './browser.ts';

type AuthPort = { getUser(): Promise<{ data: { user: AccountUser | null }; error: unknown }>;
  getClaims(): Promise<{ data: { claims: Record<string, unknown> } | null; error: unknown }> };
/** Both methods verify through Supabase's Auth client. No decode/getSession
 * output is accepted. The private DB predicate also checks revocation. */
export async function verifiedParent(request: Request, env: Env, auth: AuthPort,
  live: (subject: string, session: string) => Promise<boolean>): Promise<BrowserParent | null> {
  if (new URL(request.url).origin !== ASK_PREVIEW) return null;
  const user = await auth.getUser(); if (user.error || !admittedPreviewUser(user.data.user, env)) return null;
  const verified = await auth.getClaims(), claims = verified.data?.claims, u = user.data.user!;
  if (verified.error || !claims || claims.sub !== u.id || claims.iss !== `https://${ISOLATED_PROJECT}.supabase.co/auth/v1` ||
    !uuid(claims.session_id) || typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now() ||
    !await live(u.id, claims.session_id)) return null;
  return { subject: u.id, session: claims.session_id, label: u.email ?? 'Your My TrustHub account' };
}
