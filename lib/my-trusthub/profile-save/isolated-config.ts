import { accountRuntime, admitted, type AccountUser } from '../account-policy.ts';

export const ISOLATED_PROJECT = 'xkkiicsassizmakcvxml';
export const ASK_PREVIEW = 'https://conumers-trust-hub-git-mth-v2-3-pare-3127df-savitz25-s-projects.vercel.app';
export const MOVE_PREVIEW = 'https://move-trust-hub-git-mth-v2-3-move-cur-0a05f1-savitz25-s-projects.vercel.app';
export const PARENT_LOGIN = 'myth_v23_parent_preview';
export const API_PATH = '/api/my-trusthub/profile-save';
export const SOURCE_PATH = API_PATH + '/source';
export const GRANT_API_PATH = API_PATH + '/current-grant';
export const GRANT_BROWSER_PATH = '/my/profile-save/current-grant';
export type Env = Record<string, string | undefined>;

export function deploymentEnabled(env: Env): boolean {
  return env.VERCEL_ENV !== 'production' && env.MY_TRUSTHUB_V23_PROFILE_SAVE_ENABLED === 'true' &&
    env.MY_TRUSTHUB_ENABLED === 'true' && env.MY_TRUSTHUB_SAVED_ENABLED === 'true' &&
    env.MY_TRUSTHUB_SPECIALIST_HANDOFF_ENABLED === 'true' && Boolean(accountRuntime(env));
}

/** One reviewed branch pair, never a suffix/wildcard allowlist or production fallback. */
export function isolatedConfig(env: Env) {
  const runtime = accountRuntime(env);
  if (!deploymentEnabled(env) || env.VERCEL_ENV !== 'preview' || !runtime ||
      runtime.origin !== ASK_PREVIEW || runtime.backend !== `https://${ISOLATED_PROJECT}.supabase.co` ||
      env.MY_TRUSTHUB_V23_PARENT_ORIGIN !== ASK_PREVIEW || env.MY_TRUSTHUB_V23_MOVE_ORIGIN !== MOVE_PREVIEW ||
      env.MY_TRUSTHUB_V23_ISOLATED_PROJECT !== ISOLATED_PROJECT ||
      env.MY_TRUSTHUB_V23_SESSION_AFFINITY !== 'dedicated' || env.MY_TRUSTHUB_ACCESS_MODE !== 'invitation' ||
      ['MY_TRUSTHUB_SIGNUP_ENABLED', 'MY_TRUSTHUB_EMAIL_ENABLED', 'MY_TRUSTHUB_WATCH_ENABLED',
        'MY_TRUSTHUB_ALERTS_ENABLED', 'MY_TRUSTHUB_SOURCE_MONITORING_ENABLED'].some(k => env[k] !== 'false')) return null;
  const ids = (env.MY_TRUSTHUB_INVITED_USER_IDS ?? '').split(',').map(x => x.trim());
  if (ids.length !== 2 || new Set(ids).size !== 2 || !ids.every(uuid) || env.MY_TRUSTHUB_INVITED_EMAILS?.trim()) return null;
  return { project: ISOLATED_PROJECT, parentOrigin: ASK_PREVIEW, moveOrigin: MOVE_PREVIEW,
    registry: { environment: 'isolated' as const, isolatedBackendVerified: true,
      origins: { move: MOVE_PREVIEW, insurance: '', lender: '' } }, admittedIds: ids };
}
export const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export const opaque = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{43}$/.test(v);
export function admittedPreviewUser(user: AccountUser | null, env: Env): boolean {
  const c = isolatedConfig(env);
  return !!c && !!user && c.admittedIds.includes(user.id) && admitted(user, env);
}
