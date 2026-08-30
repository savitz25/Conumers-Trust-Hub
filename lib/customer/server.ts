import 'server-only';
import { cookies, headers } from 'next/headers';
import { withAskTx } from './db';
import { cthReadDirectory } from './cth-read';
import { resendMailer } from './mail';
import { CustomerPlatform, parseStaffEmails } from './store';
import { INTENT_COOKIE, SESSION_COOKIE, sessionCookieOptions } from './cookies';
import type { RequestContext } from './types';
import type { PoolClient } from 'pg';
import type { SqlClient } from './sql';

function asSql(client: PoolClient): SqlClient {
  return {
    query: (text, params) => client.query(text, params),
  };
}

export function requestContextFromHeaders(h: Headers): RequestContext {
  return {
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip'),
    userAgent: h.get('user-agent'),
  };
}

export async function withPlatform<T>(fn: (platform: CustomerPlatform, sql: SqlClient) => Promise<T>): Promise<T> {
  const secret = process.env.ATH_HANDOFF_SECRET || '';
  return withAskTx(async (client) => {
    const sql = asSql(client);
    const platform = new CustomerPlatform({
      sql,
      cth: cthReadDirectory,
      mailer: resendMailer,
      handoffSecret: secret,
      staffEmails: parseStaffEmails(process.env.ATH_STAFF_EMAILS),
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://www.asktrusthub.com',
    });
    return fn(platform, sql);
  });
}

export async function readSessionToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value;
}

export async function readIntentId(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(INTENT_COOKIE)?.value;
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions(30 * 24 * 60 * 60));
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, '', sessionCookieOptions(0));
}

export async function setIntentCookie(intentId: string): Promise<void> {
  const jar = await cookies();
  jar.set(INTENT_COOKIE, intentId, sessionCookieOptions(15 * 60));
}

export async function currentContext(): Promise<RequestContext> {
  return requestContextFromHeaders(await headers());
}
