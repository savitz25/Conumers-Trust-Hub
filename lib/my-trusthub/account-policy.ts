/** Pure V2-2 policy. Environment is server-controlled; never pass client claims here. */
export type AccountEnv = Record<string, string | undefined>;
export type AccountUser = { id: string; email?: string; email_confirmed_at?: string; app_metadata?: Record<string, unknown> };
export const PARENT_ORIGIN = 'https://www.asktrusthub.com';
export const PARENT_BACKEND = 'https://qvvxvbcdmbjzrgvwjatw.supabase.co';
export const enabled = (value?: string) => value?.trim().toLowerCase() === 'true';
const list = (value?: string) => (value ?? '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean);

export function accessMode(env: AccountEnv): 'internal' | 'invitation' | 'public' | 'closed' {
  const mode = env.MY_TRUSTHUB_ACCESS_MODE;
  if (!mode) return 'internal'; // No implicit public activation from the legacy canary toggle.
  return mode === 'internal' || mode === 'invitation' || mode === 'public' ? mode : 'closed';
}
/**
 * Password sign-in for an already-approved isolated preview or local dev pair.
 * Production and an unset VERCEL_ENV ignore the flag. It does not open signup,
 * email delivery, or the My TrustHub workspace master gate.
 */
export function previewAccountAccess(env: AccountEnv): boolean {
  if (env.VERCEL_ENV !== 'preview' && env.VERCEL_ENV !== 'development') return false;
  if (!enabled(env.MY_TRUSTHUB_PREVIEW_ACCOUNT_ACCESS)) return false;
  return accountRuntime(env) !== null;
}

export function accountSignInEnabled(env: AccountEnv): boolean {
  return enabled(env.MY_TRUSTHUB_ENABLED) || previewAccountAccess(env);
}

/** Login can use preview account access. Every other account form still requires the master gate. */
export function accountFormAvailable(operation: 'signup' | 'login' | 'link' | 'recovery' | 'password', env: AccountEnv): boolean {
  if (!accountRuntime(env)) return false;
  if (operation === 'login') return accountSignInEnabled(env);
  return enabled(env.MY_TRUSTHUB_ENABLED);
}

export function admitted(user: AccountUser | null, env: AccountEnv): boolean {
  if (!accountSignInEnabled(env) || !user?.email_confirmed_at) return false;
  const mode = accessMode(env);
  // Preview account access never widens to every confirmed user. Public admission
  // still requires the master gate.
  if (mode === 'public') return enabled(env.MY_TRUSTHUB_ENABLED);
  if (mode === 'closed') return false;
  const prefix = mode === 'internal' ? 'MY_TRUSTHUB_CANARY' : 'MY_TRUSTHUB_INVITED';
  const eligible = list(env[`${prefix}_USER_IDS`]).includes(user.id.toLowerCase()) ||
    list(env[`${prefix}_EMAILS`]).includes((user.email ?? '').toLowerCase());
  return eligible && (mode !== 'internal' || user.app_metadata?.my_trusthub_canary === true);
}
export function registrationAllowed(email: string, env: AccountEnv): boolean {
  if (!enabled(env.MY_TRUSTHUB_ENABLED) || !enabled(env.MY_TRUSTHUB_SIGNUP_ENABLED)) return false;
  return accessMode(env) === 'public' || (accessMode(env) === 'invitation' && list(env.MY_TRUSTHUB_INVITED_EMAILS).includes(email.toLowerCase()));
}
export function emailRequestAllowed(email: string, env: AccountEnv): boolean {
  if (!enabled(env.MY_TRUSTHUB_ENABLED)) return false;
  const mode = accessMode(env);
  if (mode === 'public') return true;
  if (mode === 'closed') return false;
  const prefix = mode === 'internal' ? 'MY_TRUSTHUB_CANARY' : 'MY_TRUSTHUB_INVITED';
  // IDs cannot be looked up anonymously. Existing-user-only links may be sent;
  // verified session admission still enforces exact eligibility after exchange.
  return list(env[`${prefix}_EMAILS`]).includes(email.toLowerCase()) || list(env[`${prefix}_USER_IDS`]).length > 0;
}
function originOnly(raw?: string): string | null {
  if (!raw || raw !== raw.trim()) return null;
  try {
    const u = new URL(raw);
    if (u.username || u.password || u.search || u.hash || u.pathname !== '/') return null;
    // DNS treats a trailing dot as the same host. Do not let a textual alias of
    // the production project pass the isolated-pair exclusion below.
    if (u.hostname.endsWith('.')) return null;
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
    return u.protocol === 'https:' || (u.protocol === 'http:' && local) ? u.origin : null;
  } catch { return null; }
}
export function accountRuntime(env: AccountEnv): { origin: string; backend: string } | null {
  const origin = originOnly(env.NEXT_PUBLIC_SITE_URL);
  const backend = originOnly(env.NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL);
  if (!origin || !backend) return null;
  if (env.VERCEL_ENV === 'production') return origin === PARENT_ORIGIN && backend === PARENT_BACKEND ? { origin, backend } : null;
  if (!enabled(env.MY_TRUSTHUB_NONPRODUCTION_APPROVED) || backend === PARENT_BACKEND ||
      /(^|\.)((ask|consumers)trusthub\.com)$/.test(new URL(origin).hostname)) return null;
  if (origin !== originOnly(env.MY_TRUSTHUB_TEST_ORIGIN) || backend !== originOnly(env.MY_TRUSTHUB_TEST_SUPABASE_URL)) return null;
  return { origin, backend };
}
/** Paths only: no research, opaque handoff tokens or arbitrary query payloads. */
export function safeReturn(value: unknown): string {
  if (typeof value !== 'string' || value.length > 300 || !value.startsWith('/') || value.startsWith('//')) return '/my';
  try {
    const decoded = decodeURIComponent(value);
    if (/[\\\s?#%\u0000-\u001f]/.test(decoded) || decoded.startsWith('//')) return '/my';
    const u = new URL(decoded, PARENT_ORIGIN);
    if (u.origin !== PARENT_ORIGIN) return '/my';
    const path = u.pathname;
    if (['/my', '/my/saved', '/my/projects', '/my/you', '/my/profile-save'].includes(path)) return path;
    if (/^\/my\/(projects|sessions)\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(path)) return path;
  } catch { /* malformed input is not a destination */ }
  return '/my';
}
export function captchaState(env: AccountEnv, token: string): 'ready' | 'missing' | 'unconfigured' {
  if (!env.NEXT_PUBLIC_MY_TRUSTHUB_TURNSTILE_SITE_KEY?.trim()) return 'unconfigured';
  return token && token.length <= 4096 ? 'ready' : 'missing';
}
export function recentVerifiedAuthentication(claims: Record<string, unknown> | null, userId: string, now = Date.now()): boolean {
  if (!claims || claims.sub !== userId || !Array.isArray(claims.amr)) return false;
  return claims.amr.some((entry: unknown) => {
    if (!entry || typeof entry !== 'object') return false;
    const { method, timestamp } = entry as { method?: string; timestamp?: number };
    return ['password', 'otp', 'magiclink', 'recovery'].includes(method ?? '') && typeof timestamp === 'number' &&
      timestamp * 1000 <= now && now - timestamp * 1000 < 10 * 60 * 1000;
  });
}
