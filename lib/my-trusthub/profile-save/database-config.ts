import { ISOLATED_PROJECT, PARENT_LOGIN, type Env } from './isolated-config.ts';

export type DatabaseConnectionMode = 'DIRECT' | 'SUPAVISOR_SESSION';
export type DatabaseConnectionConfig = {
  mode: DatabaseConnectionMode; host: string; port: 5432; database: 'postgres';
  user: string; password: string; ca: string;
};
export const RUNTIME_POOL_MAX = 2;

/** Strict preview-only database endpoint contract. Transaction-mode poolers
 * (port 6543), arbitrary pooler hosts, query parameters and production refs
 * are rejected before pg receives any credential. */
export function databaseConnectionConfig(env: Env): DatabaseConnectionConfig | null {
  const mode = env.MY_TRUSTHUB_V23_DATABASE_CONNECTION_MODE as DatabaseConnectionMode | undefined;
  const raw = env.MY_TRUSTHUB_V23_PARENT_DATABASE_URL;
  const ca = env.MY_TRUSTHUB_V23_DATABASE_CA_PEM;
  if (!raw || !ca || (mode !== 'DIRECT' && mode !== 'SUPAVISOR_SESSION')) return null;
  try {
    const url = new URL(raw);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.port !== '5432' ||
        url.pathname !== '/postgres' || !url.password || url.search || url.hash || url.hostname.endsWith('.')) return null;
    if (mode === 'DIRECT') {
      const host = `db.${ISOLATED_PROJECT}.supabase.co`;
      if (url.hostname !== host || url.username !== PARENT_LOGIN) return null;
      return { mode, host, port: 5432, database: 'postgres', user: PARENT_LOGIN, password: decodeURIComponent(url.password), ca };
    }
    const pinned = env.MY_TRUSTHUB_V23_SUPAVISOR_SESSION_HOST?.trim().toLowerCase();
    if (!pinned || url.hostname !== pinned || !/^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(pinned) ||
        url.username !== `${PARENT_LOGIN}.${ISOLATED_PROJECT}`) return null;
    return { mode, host: pinned, port: 5432, database: 'postgres', user: url.username, password: decodeURIComponent(url.password), ca };
  } catch { return null; }
}
