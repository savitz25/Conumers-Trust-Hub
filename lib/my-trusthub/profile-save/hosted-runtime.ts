import 'server-only';
import { Pool } from 'pg';
import { createPrivateKey, createPublicKey } from 'node:crypto';
import { PreviewAssembly } from './preview-assembly.ts';
import { PreviewStore, randomRef } from './preview-store.ts';
import { SourceChannel } from './source-channel.ts';
import { ISOLATED_PROJECT, PARENT_LOGIN, isolatedConfig, type Env } from './isolated-config.ts';
import { verifiedParent } from './verified-parent.ts';
import { hash } from './runtime.ts';
import type { TransactionPool } from './postgres-backend.ts';

// Connection reuse only. All authorization, nonces, grants and research are DB
// backed and reverified per request. No credentials or failures are logged.
let cached: { fingerprint: string; pool: Pool } | undefined;
export async function hostedRuntime(env: Env = process.env): Promise<PreviewAssembly | null> {
  let pool: Pool | undefined;
  try {
    const c = isolatedConfig(env); if (!c) return null;
    const publishable = env.NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_PUBLISHABLE_KEY?.trim();
    if (!publishable) return null;
    // Legacy anon API keys are accepted as public API credentials only. This
    // check is NOT user authentication; verifiedParent establishes the user.
    if (!publishable.startsWith('sb_publishable_')) {
      const parts = publishable.split('.');
      if (parts.length !== 3 || JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')).role !== 'anon') return null;
    }
    const raw = env.MY_TRUSTHUB_V23_PARENT_DATABASE_URL, ca = env.MY_TRUSTHUB_V23_DATABASE_CA_PEM;
    const key = { kid: env.MY_TRUSTHUB_V23_ASK_KEY_ID ?? '', pem: env.MY_TRUSTHUB_V23_ASK_SIGNING_PRIVATE_KEY_PEM ?? '' };
    const moveKey = { kid: env.MY_TRUSTHUB_V23_MOVE_KEY_ID ?? '', pem: env.MY_TRUSTHUB_V23_MOVE_VERIFY_PUBLIC_KEY_PEM ?? '' };
    if (!raw || !ca || !/^[A-Za-z0-9_-]{1,64}$/.test(key.kid) || !/^[A-Za-z0-9_-]{1,64}$/.test(moveKey.kid)) return null;
    const url = new URL(raw), host = `db.${ISOLATED_PROJECT}.supabase.co`;
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== host ||
      url.port !== '5432' || url.pathname !== '/postgres' || url.username !== PARENT_LOGIN || !url.password || url.search || url.hash) return null;
    const askPrivate = createPrivateKey(key.pem), movePublic = createPublicKey(moveKey.pem);
    if (askPrivate.asymmetricKeyType !== 'ed25519' || movePublic.asymmetricKeyType !== 'ed25519' ||
      createPublicKey(askPrivate).export({ type: 'spki', format: 'pem' }) === movePublic.export({ type: 'spki', format: 'pem' })) return null;
    const fingerprint = hash(raw + '\0' + ca);
    if (cached && cached.fingerprint !== fingerprint) { await cached.pool.end(); cached = undefined; }
    if (!cached) cached = { fingerprint, pool: new Pool({ host, port: 5432, database: 'postgres', user: PARENT_LOGIN,
      password: decodeURIComponent(url.password), ssl: { ca, rejectUnauthorized: true, servername: host }, max: 6,
      connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000, application_name: 'v23-parent-isolated' }) };
    pool = cached.pool;
    const db = await pool.connect();
    try {
      const role = (await db.query(`select session_user as name,rolcanlogin,rolinherit,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication
        from pg_roles where rolname=session_user`)).rows[0];
      if (!role || role.name !== PARENT_LOGIN || role.rolcanlogin !== true || ['rolinherit','rolsuper','rolbypassrls','rolcreatedb','rolcreaterole','rolreplication'].some(k => role[k] !== false)) return null;
      const memberships = (await db.query(`select r.rolname,m.admin_option,m.inherit_option,m.set_option from pg_auth_members m
        join pg_roles r on r.oid=m.roleid where m.member=(select oid from pg_roles where rolname=session_user) order by r.rolname`)).rows;
      if (memberships.length !== 2 || memberships.map(r => r.rolname).join() !== 'myth_v23_authorizer,myth_v23_executor' ||
        memberships.some(r => r.admin_option || r.inherit_option || !r.set_option)) return null;
      const permissions = (await db.query(`select exists(select 1 from information_schema.role_table_grants where grantee=session_user) as table_grants,
        exists(select 1 from pg_auth_members m where m.member in (select oid from pg_roles where rolname in ('myth_v23_authorizer','myth_v23_executor'))) as nested_roles,
        exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in ('auth','consumer','ops','network','v23_private')
          and (has_table_privilege(session_user,c.oid,'SELECT') or has_table_privilege(session_user,c.oid,'INSERT') or has_table_privilege(session_user,c.oid,'UPDATE') or has_table_privilege(session_user,c.oid,'DELETE'))) as raw_access`)).rows[0];
      if (permissions.table_grants || permissions.nested_roles || permissions.raw_access) return null;
    } finally { db.release(); }
    const scoped = pool as unknown as TransactionPool, store = new PreviewStore(scoped);
    const pin = await store.authorized(async db => (await db.query<{ project_ref: string; version: string; ask_origin: string; move_origin: string }>('select * from v23_private.preview_deployment_pin where singleton', [])).rows[0]);
    if (!pin || pin.project_ref !== ISOLATED_PROJECT || pin.version !== 'v23-parent-wiring/1' || pin.ask_origin !== c.parentOrigin || pin.move_origin !== c.moveOrigin) return null;
    // Check all named deployment functions and durable tables, including EXECUTE.
    const ports = await store.authorized(async db => (await db.query<{ ready: boolean }>('select v23_private.preview_ports_ready() as ready', [])).rows[0]?.ready);
    if (!ports) return null;
    const authHealth = await fetch(`https://${ISOLATED_PROJECT}.supabase.co/auth/v1/settings`, {
      headers: { apikey: publishable }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000) });
    if (!authHealth.ok) return null;
    await authHealth.body?.cancel();
    const source = new SourceChannel(key, env.MY_TRUSTHUB_V23_MOVE_PROTECTION_BYPASS);
    const runtime = new PreviewAssembly(env, scoped, source, moveKey, async request => {
      const { createMyTrustHubSupabaseClient } = await import('../../supabase/server');
      const client = await createMyTrustHubSupabaseClient(true);
      return client ? verifiedParent(request, env, client.auth, (sub, sid) => store.live(sub, sid)) : null;
    });
    // Missing binding or unwired/non-publishable source is unavailable everywhere.
    await runtime.binding(); await source.publication(randomRef());
    return runtime;
  } catch { return null; }
}
