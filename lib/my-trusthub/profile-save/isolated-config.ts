import { accountRuntime, admitted, PARENT_BACKEND, PARENT_ORIGIN, type AccountUser } from '../account-policy.ts';
import { PRODUCTION_ORIGINS } from '../contracts/v2-3-profile-transfer.ts';

export const ISOLATED_PROJECT = 'xkkiicsassizmakcvxml';
export const ASK_PREVIEW = 'https://conumers-trust-hub-git-mth-v2-3-pare-3127df-savitz25-s-projects.vercel.app';
export const MOVE_PREVIEW = 'https://move-trust-hub-git-mth-v2-3-move-cur-0a05f1-savitz25-s-projects.vercel.app';
export const PARENT_LOGIN = 'myth_v23_parent_preview';
export const API_PATH = '/api/my-trusthub/profile-save';
export const SOURCE_PATH = API_PATH + '/source';
export const GRANT_API_PATH = API_PATH + '/current-grant';
export const GRANT_BROWSER_PATH = '/my/profile-save/current-grant';
export type Env = Record<string, string | undefined>;

/** Production parent pins. One exact pair, never a suffix allowlist. */
export const PRODUCTION_PROJECT = 'qvvxvbcdmbjzrgvwjatw';
export const PRODUCTION_PARENT_LOGIN = 'myth_v23_parent_prod';
export const PRODUCTION_PIN_VERSION = 'v23-parent-wiring/1';

/**
 * A deployment target is the one reviewed (parent origin, Move origin, Supabase
 * project, runtime login, SQL identifier prefix) tuple the runtime may bind to.
 * `isolated` is the existing preview pair; `production` is the canonical pair
 * and is admitted only behind MY_TRUSTHUB_V23_PRODUCTION_HANDOFF_ENABLED with
 * exact pins. Nothing here derives a target from a request or a hostname.
 */
export type DeploymentTarget = {
  kind: 'isolated' | 'production';
  project: string;
  parentOrigin: string;
  moveOrigin: string;
  login: string;
  /** v23_private.<prefix>_* functions and tables. */
  sqlPrefix: 'preview' | 'prod';
  pinVersion: string;
  /** Service-assertion identity suffix shared with Move. */
  assertionEnvironment: 'isolated' | 'production';
};
export const ISOLATED_TARGET: DeploymentTarget = { kind: 'isolated', project: ISOLATED_PROJECT, parentOrigin: ASK_PREVIEW, moveOrigin: MOVE_PREVIEW,
  login: PARENT_LOGIN, sqlPrefix: 'preview', pinVersion: 'v23-parent-wiring/1', assertionEnvironment: 'isolated' };
export const PRODUCTION_TARGET: DeploymentTarget = { kind: 'production', project: PRODUCTION_PROJECT, parentOrigin: PARENT_ORIGIN, moveOrigin: PRODUCTION_ORIGINS.move,
  login: PRODUCTION_PARENT_LOGIN, sqlPrefix: 'prod', pinVersion: PRODUCTION_PIN_VERSION, assertionEnvironment: 'production' };
export const sqlName = (target: DeploymentTarget, name: string) => `v23_private.${target.sqlPrefix}_${name}`;

const FLAGS_ON = (env: Env) => env.MY_TRUSTHUB_V23_PROFILE_SAVE_ENABLED === 'true' && env.MY_TRUSTHUB_ENABLED === 'true' &&
  env.MY_TRUSTHUB_SAVED_ENABLED === 'true' && env.MY_TRUSTHUB_SPECIALIST_HANDOFF_ENABLED === 'true';

/** Explicit production admission. Every pin is exact; a flag alone opens nothing. */
export function productionHandoffEnabled(env: Env): boolean {
  const runtime = accountRuntime(env);
  return env.VERCEL_ENV === 'production' && env.MY_TRUSTHUB_V23_PRODUCTION_HANDOFF_ENABLED === 'true' && FLAGS_ON(env) &&
    !!runtime && runtime.origin === PARENT_ORIGIN && runtime.backend === PARENT_BACKEND &&
    env.MY_TRUSTHUB_V23_PARENT_ORIGIN === PARENT_ORIGIN && env.MY_TRUSTHUB_V23_MOVE_ORIGIN === PRODUCTION_ORIGINS.move &&
    env.MY_TRUSTHUB_V23_PRODUCTION_PROJECT === PRODUCTION_PROJECT && env.MY_TRUSTHUB_V23_SESSION_AFFINITY === 'dedicated' &&
    env.MY_TRUSTHUB_V23_ISOLATED_PROJECT === undefined && env.MY_TRUSTHUB_NONPRODUCTION_APPROVED !== 'true';
}

export function deploymentEnabled(env: Env): boolean {
  if (env.VERCEL_ENV === 'production') return productionHandoffEnabled(env);
  return FLAGS_ON(env) && Boolean(accountRuntime(env));
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
  return { target: ISOLATED_TARGET, project: ISOLATED_PROJECT, parentOrigin: ASK_PREVIEW, moveOrigin: MOVE_PREVIEW,
    registry: { environment: 'isolated' as const, isolatedBackendVerified: true,
      origins: { move: MOVE_PREVIEW, insurance: '', lender: '', contractor: '', senior: '', investor: '' } }, admittedIds: ids };
}

/** Production parent config. Admission is the production account policy
 * (canary or invitation lists), never a preview invite list. Watch stays a
 * separate consumer choice: this config does not require the Watch flag off,
 * but the Save path never starts one. */
export function productionConfig(env: Env) {
  if (!productionHandoffEnabled(env)) return null;
  return { target: PRODUCTION_TARGET, project: PRODUCTION_PROJECT, parentOrigin: PARENT_ORIGIN, moveOrigin: PRODUCTION_ORIGINS.move,
    registry: { environment: 'production' as const, isolatedBackendVerified: false,
      origins: { move: PRODUCTION_ORIGINS.move, insurance: '', lender: PRODUCTION_ORIGINS.lender, contractor: '', senior: '', investor: '' } } };
}

export type DeploymentConfig = NonNullable<ReturnType<typeof isolatedConfig>> | NonNullable<ReturnType<typeof productionConfig>>;
/** The single resolved config for this deployment, or null. */
export function deploymentConfig(env: Env): DeploymentConfig | null {
  return env.VERCEL_ENV === 'production' ? productionConfig(env) : isolatedConfig(env);
}

export const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export const opaque = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{43}$/.test(v);
export function admittedPreviewUser(user: AccountUser | null, env: Env): boolean {
  const c = isolatedConfig(env);
  return !!c && !!user && c.admittedIds.includes(user.id) && admitted(user, env);
}
/** Parent admission for the resolved target: exact invite list on the isolated
 * pair, the production account policy (canary/invitation) in production. */
export function admittedParentUser(user: AccountUser | null, env: Env): boolean {
  const c = deploymentConfig(env);
  if (!c || !user) return false;
  if (c.target.kind === 'isolated') return admittedPreviewUser(user, env);
  return admitted(user, env);
}
