import type { SupabaseClient } from '@supabase/supabase-js';
import { admitted, safeReturn, type AccountEnv } from './account-policy.ts';

export async function exchangeAccountCode(auth: Pick<SupabaseClient['auth'], 'exchangeCodeForSession' | 'getUser' | 'signOut'>, code: string | null, next: unknown, env: AccountEnv, passwordDestination = false): Promise<string> {
  const returnTo = safeReturn(next);
  const failed = `/my/sign-in?error=callback_exchange&next=${encodeURIComponent(returnTo)}`;
  if (!code || code.length > 4096) return failed;
  try {
    const current = await auth.getUser();
    if (current.data.user || (current.error && current.error.name !== 'AuthSessionMissingError')) return failed;
    const exchanged = await auth.exchangeCodeForSession(code);
    if (exchanged.error) return failed;
    const verified = await auth.getUser();
    if (verified.error || !admitted(verified.data.user, env)) {
      await auth.signOut({ scope: 'local' });
      return failed;
    }
    // Destination is only a routing hint AFTER a verified PKCE exchange. It grants
    // no password authority; mutation independently checks fresh signed AMR + user.
    if (passwordDestination) return `/my/reset-password?next=${encodeURIComponent(returnTo)}`;
    return `${returnTo}?auth=complete`;
  } catch { return failed; }
}
