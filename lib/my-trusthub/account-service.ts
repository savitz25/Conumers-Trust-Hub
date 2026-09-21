import type { SupabaseClient } from '@supabase/supabase-js';
import { accountFormAvailable, accountRuntime, admitted, captchaState, emailRequestAllowed, enabled, recentVerifiedAuthentication, registrationAllowed, safeReturn, type AccountEnv } from './account-policy.ts';

export type AccountOperation = 'signup' | 'login' | 'link' | 'recovery' | 'password';
export type AccountResult = { message?: string; error?: string; destination?: string; completion?: 'login' | 'password' };
export type Diagnostic = 'admission_blocked' | 'rate_limited' | 'provider_failure' | 'request_accepted' | 'configuration_missing';
export type AuthApi = Pick<SupabaseClient['auth'], 'signUp' | 'signInWithPassword' | 'signInWithOtp' | 'resetPasswordForEmail' | 'getUser' | 'getClaims' | 'updateUser' | 'signOut'>;
export const EMAIL_MESSAGE = "If this address is eligible, we'll email a sign-in link.";
export const RECOVERY_MESSAGE = "If this address is eligible, we'll email instructions to reset your password.";
export const SIGNUP_MESSAGE = 'If registration is available for this address, you will receive an email to verify your account. Already have an account? Sign in or recover your password.';
const LOGIN_ERROR = 'We could not sign you in. Check your details and access, or try password recovery.';
const classify = (error: { status?: number } | null): Diagnostic => error?.status === 429 ? 'rate_limited' : error ? 'provider_failure' : 'request_accepted';

/** SDK-injected for deterministic tests. No credentials or provider messages leave this boundary. */
export async function runAccountOperation(operation: AccountOperation, form: FormData, auth: AuthApi, env: AccountEnv, diagnostic: (d: Diagnostic) => void): Promise<AccountResult> {
  const runtime = accountRuntime(env);
  if (!accountFormAvailable(operation, env) || !runtime) return { error: 'Account access is unavailable in this environment.' };
  const next = safeReturn(form.get('next'));
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? ''); // Never trim a password.
  const token = String(form.get('captchaToken') ?? '');
  try {
    if (operation === 'password') {
      const { data, error } = await auth.getUser();
      const claims = await auth.getClaims(); // Signature verified by supported SDK, not decoded client input.
      if (error || !admitted(data.user, env) || data.user?.id !== form.get('expectedUserId') || claims.error ||
          !recentVerifiedAuthentication(claims.data?.claims ?? null, data.user!.id)) {
        return { error: 'Please sign in again or request a fresh password recovery email before changing your password.' };
      }
      if (password.length < 12 || password.length > 128 || password !== form.get('confirmPassword')) return { error: 'Use 12–128 characters and enter the same new password twice.' };
      const changed = await auth.updateUser({ password });
      diagnostic(classify(changed.error));
      if (changed.error) return { error: 'Your password could not be changed. Request a fresh recovery email and try again.' };
      // End this browser session after a sensitive change; never create a second identity.
      const ended = await auth.signOut({ scope: 'local' });
      if (ended.error) {
        diagnostic('provider_failure');
        return { error: 'Your password changed, but sign-out could not be confirmed. Try signing out again before switching accounts.' };
      }
      return { destination: `/my/sign-in?next=${encodeURIComponent(next)}`, completion: 'password' };
    }
    if (!email || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) return { error: 'Enter a valid email address.' };
    const challenge = captchaState(env, token);
    if (challenge === 'unconfigured') { diagnostic('configuration_missing'); return { error: 'Security verification is unavailable. Please try again later.' }; }
    if (challenge === 'missing') return { error: 'Complete a fresh security check, then try again.' };
    const current = await auth.getUser();
    if (current.error && current.error.name !== 'AuthSessionMissingError') return { error: 'We could not verify the current account. Please reload and try again.' };
    if (current.data.user) return { error: 'Sign out before using a different account. Your saved research will stay in its current account.' };
    const redirectTo = `${runtime.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    if (operation === 'signup') {
      if (password.length < 12 || password.length > 128 || password !== form.get('confirmPassword')) return { error: 'Use 12–128 characters and enter the same new password twice.' };
      // Operator attests confirmation/CAPTCHA/password security settings only at a reviewed release.
      if (!enabled(env.MY_TRUSTHUB_AUTH_SECURITY_READY)) { diagnostic('configuration_missing'); return { error: 'Account creation is not available yet.' }; }
      if (!registrationAllowed(email, env)) { diagnostic('admission_blocked'); return { message: SIGNUP_MESSAGE }; }
      const result = await auth.signUp({ email, password, options: { emailRedirectTo: redirectTo, captchaToken: token } });
      diagnostic(classify(result.error));
      if (result.data.session) { await auth.signOut({ scope: 'local' }); diagnostic('configuration_missing'); return { error: 'Account creation could not finish safely. Please contact support.' }; }
      return { message: SIGNUP_MESSAGE };
    }
    if (operation === 'login') {
      if (!password || password.length > 128) return { error: LOGIN_ERROR };
      const result = await auth.signInWithPassword({ email, password, options: { captchaToken: token } });
      const verified = result.error ? null : await auth.getUser();
      if (result.error || verified?.error || !admitted(verified?.data.user ?? null, env)) {
        diagnostic(result.error ? classify(result.error) : 'admission_blocked');
        await auth.signOut({ scope: 'local' });
        return { error: LOGIN_ERROR };
      }
      diagnostic('request_accepted');
      return { destination: next, completion: 'login' };
    }
    const message = operation === 'recovery' ? RECOVERY_MESSAGE : EMAIL_MESSAGE;
    if (!emailRequestAllowed(email, env)) { diagnostic('admission_blocked'); return { message }; }
    const result = operation === 'recovery'
      ? await auth.resetPasswordForEmail(email, { redirectTo: `${redirectTo}&flow=password`, captchaToken: token })
      : await auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo, captchaToken: token } });
    diagnostic(classify(result.error));
    // Same public response for blocked/unknown/rate-limited/provider-rejected addresses.
    return { message };
  } catch {
    diagnostic('provider_failure');
    if (operation === 'link') return { message: EMAIL_MESSAGE };
    if (operation === 'recovery') return { message: RECOVERY_MESSAGE };
    if (operation === 'signup') return { message: SIGNUP_MESSAGE };
    return { error: 'We could not complete this request safely. Please try again.' };
  }
}
