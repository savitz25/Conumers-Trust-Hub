import 'server-only';
import { Pool } from 'pg';
import { createPrivateKey, createPublicKey } from 'node:crypto';
import { PreviewAssembly } from './preview-assembly.ts';
import { PreviewStore, randomRef } from './preview-store.ts';
import { SourceChannel } from './source-channel.ts';
import { deploymentConfig, sqlName, type Env } from './isolated-config.ts';
import { databaseConnectionConfig, RUNTIME_POOL_MAX } from './database-config.ts';
import { verifiedParent } from './verified-parent.ts';
import { sessionMac } from './session-authority.ts';
import { hash } from './runtime.ts';
import type { TransactionPool } from './postgres-backend.ts';

// Connection reuse only. All authorization, nonces, grants and research are DB
// backed and reverified per request. No credentials or failures are logged.
let cached: { fingerprint: string; pool: Pool } | undefined;
/** Resolves the one deployment target (isolated preview pair or the explicit
 * production pair) and verifies the runtime login, its narrow memberships, the
 * deployment pin, the readiness contract and the Auth service before any
 * consumer request is served. Any failed check is "unavailable". */
export async function hostedRuntime(env: Env = process.env): Promise<PreviewAssembly | null> {
  let pool: Pool | undefined;
  try {
    const c = deploymentConfig(env); if (!c) return null;
    const target = c.target;
    const publishable = env.NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_PUBLISHABLE_KEY?.trim();
    if (!publishable) return null;
    // Legacy anon API keys are accepted as public API credentials only. This
    // check is NOT user authentication; verifiedParent establishes the user.
    if (!publishable.startsWith('sb_publishable_')) {
      const parts = publishable.split('.');
      if (parts.length !== 3 || JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')).role !== 'anon') return null;
    }
    const raw = env.MY_TRUSTHUB_V23_PARENT_DATABASE_URL;
    const connection = databaseConnectionConfig(env, target);
    const key = { kid: env.MY_TRUSTHUB_V23_ASK_KEY_ID ?? '', pem: env.MY_TRUSTHUB_V23_ASK_SIGNING_PRIVATE_KEY_PEM ?? '' };
    const moveKey = { kid: env.MY_TRUSTHUB_V23_MOVE_KEY_ID ?? '', pem: env.MY_TRUSTHUB_V23_MOVE_VERIFY_PUBLIC_KEY_PEM ?? '' };
    if (!raw || !connection || !/^[A-Za-z0-9_-]{1,64}$/.test(key.kid) || !/^[A-Za-z0-9_-]{1,64}$/.test(moveKey.kid)) return null;
    const askPrivate = createPrivateKey(key.pem), movePublic = createPublicKey(moveKey.pem);
    if (askPrivate.asymmetricKeyType !== 'ed25519' || movePublic.asymmetricKeyType !== 'ed25519' ||
      createPublicKey(askPrivate).export({ type: 'spki', format: 'pem' }) === movePublic.export({ type: 'spki', format: 'pem' })) return null;
    const fingerprint = hash(target.kind + '\0' + raw + '\0' + connection.ca + '\0' + connection.mode);
    if (cached && cached.fingerprint !== fingerprint) { await cached.pool.end(); cached = undefined; }
    if (!cached) cached = { fingerprint, pool: new Pool({ host: connection.host, port: connection.port, database: connection.database, user: connection.user,
      password: connection.password, ssl: { ca: connection.ca, rejectUnauthorized: true, servername: connection.host }, max: RUNTIME_POOL_MAX,
      connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000, application_name: `v23-parent-${target.kind}` }) };
    pool = cached.pool;
    const db = await pool.connect();
    try {
      const role = (await db.query(`select session_user as name,rolcanlogin,rolinherit,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication
        from pg_roles where rolname=session_user`)).rows[0];
      if (!role || role.name !== target.login || role.rolcanlogin !== true || ['rolinherit','rolsuper','rolbypassrls','rolcreatedb','rolcreaterole','rolreplication'].some(k => role[k] !== false)) return null;
      const memberships = (await db.query(`select r.rolname,m.admin_option,m.inherit_option,m.set_option from pg_auth_members m
        join pg_roles r on r.oid=m.roleid where m.member=(select oid from pg_roles where rolname=session_user) order by r.rolname`)).rows;
      if (memberships.length !== 2 || memberships.map(r => r.rolname).join() !== 'myth_v23_authorizer,myth_v23_executor' ||
        memberships.some(r => r.admin_option || r.inherit_option || !r.set_option)) return null;
      // Isolated: pg_net must be absent (reviewed gate). Production: the extension
      // may exist for other tenants of the database, so the gate is instead that no
      // runtime role can reach schema net or any of its functions.
      const outboundGate = target.kind === 'isolated'
        ? `(exists(select 1 from pg_extension where extname='pg_net') or to_regnamespace('net') is not null) as outbound_access`
        : `exists(select 1 from pg_namespace n where n.nspname='net' and (has_schema_privilege(session_user,n.oid,'USAGE')
            or has_schema_privilege('myth_v23_authorizer',n.oid,'USAGE') or has_schema_privilege('myth_v23_executor',n.oid,'USAGE')
            or exists(select 1 from pg_proc p where p.pronamespace=n.oid and (has_function_privilege(session_user,p.oid,'EXECUTE')
              or has_function_privilege('myth_v23_authorizer',p.oid,'EXECUTE') or has_function_privilege('myth_v23_executor',p.oid,'EXECUTE'))))) as outbound_access`;
      const permissions = (await db.query(`select exists(select 1 from information_schema.role_table_grants where grantee=session_user) as table_grants,
        exists(select 1 from pg_auth_members m where m.member in (select oid from pg_roles where rolname in ('myth_v23_authorizer','myth_v23_executor'))) as nested_roles,
        ${outboundGate},
        exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in ('auth','consumer','ops','network','v23_private')
          and (has_table_privilege(session_user,c.oid,'SELECT') or has_table_privilege(session_user,c.oid,'INSERT') or has_table_privilege(session_user,c.oid,'UPDATE') or has_table_privilege(session_user,c.oid,'DELETE'))) as raw_access`)).rows[0];
      if (permissions.table_grants || permissions.nested_roles || permissions.outbound_access || permissions.raw_access) return null;
    } finally { db.release(); }
    const scoped = pool as unknown as TransactionPool, store = new PreviewStore(scoped, target);
    const pin = await store.authorized(async db => (await db.query<{ project_ref: string; version: string; ask_origin: string; move_origin: string }>(`select * from ${sqlName(target, 'deployment_pin')} where singleton`, [])).rows[0]);
    if (!pin || pin.project_ref !== target.project || pin.version !== target.pinVersion || pin.ask_origin !== c.parentOrigin || pin.move_origin !== c.moveOrigin) return null;
    // Check all named deployment functions and durable tables, including EXECUTE.
    const ports = await store.authorized(async db => (await db.query<{ ready: boolean }>(`select ${sqlName(target, 'ports_ready')}() as ready`, [])).rows[0]?.ready);
    if (!ports) return null;
    const authHealth = await fetch(`https://${target.project}.supabase.co/auth/v1/settings`, {
      headers: { apikey: publishable }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000) });
    if (!authHealth.ok) return null;
    await authHealth.body?.cancel();
    // Deployment Protection bypass is a preview-only transport concern.
    const source = new SourceChannel(key, target.kind === 'isolated' ? env.MY_TRUSTHUB_V23_MOVE_PROTECTION_BYPASS : undefined, fetch, target);
    const runtime = new PreviewAssembly(env, scoped, source, moveKey, async request => {
      const { createMyTrustHubSupabaseClient } = await import('../../supabase/server');
      const client = await createMyTrustHubSupabaseClient(true);
      return client ? verifiedParent(request, env, client.auth, {
        bind: (sub, sid, exp) => store.bind(sub, sid, exp, sessionMac(key.pem, sub, sid, exp, target.project)),
        live: (sub, sid) => store.live(sub, sid),
      }, target) : null;
    });
    // Missing binding or unwired/non-publishable source is unavailable everywhere.
    await runtime.binding(); await source.publication(randomRef());
    return runtime;
  } catch { return null; }
}
