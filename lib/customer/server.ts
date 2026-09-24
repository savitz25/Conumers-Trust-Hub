import 'server-only';
import { cookies, headers } from 'next/headers';
import { revalidateTag } from 'next/cache';
import { withAskTx } from './db';
import { cthReadDirectory } from './cth-read';
import { compositeCustomerDirectory } from './specialist-read';
import { resendMailer } from './mail';
import { CustomerPlatform, combineStaffEmails } from './store';
import { INTENT_COOKIE, RECEIPT_COOKIE, SESSION_COOKIE, sessionCookieOptions } from './cookies';
import { decodeClaimReceipt, encodeClaimReceipt, type ClaimReceipt } from './claim-receipt';
import type { RequestContext } from './types';
import type { PoolClient } from 'pg';
import type { SqlClient } from './sql';
import { PUBLIC_EXISTENCE_TAG, publicStateTag, registerPublicReadInvalidator } from './public-read-invalidate';

// Every writer route reaches the store through this module, so the shared-cache invalidator is always registered
// in the instance that performs the write (ATH-CLAIM-V2-001R4). `expire: 0` = expire now; the next public read
// blocks on fresh data instead of being served the pre-write value once (the old 'max' SWR profile).
registerPublicReadInvalidator((nativeProfileId) => {
  try {
    revalidateTag(PUBLIC_EXISTENCE_TAG, { expire: 0 });
    revalidateTag(publicStateTag(nativeProfileId), { expire: 0 });
  } catch {
    // Outside a Next request scope (scripts/tests) there is no shared cache to expire.
  }
});

function asSql(client: PoolClient): SqlClient {
  return {
    query: (text, params) => client.query(text, params),
  };
}

export function customerPlatformForSql(sql:SqlClient):CustomerPlatform{return new CustomerPlatform({sql,cth:compositeCustomerDirectory(cthReadDirectory),mailer:resendMailer,handoffSecret:process.env.ATH_HANDOFF_SECRET||'',staffEmails:combineStaffEmails(process.env.ATH_STAFF_EMAILS,process.env.ATH_STAFF_EMAILS_EXTRA),siteUrl:process.env.NEXT_PUBLIC_SITE_URL||'https://www.asktrusthub.com'})}

export function requestContextFromHeaders(h: Headers): RequestContext {
  return {
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip'),
    userAgent: h.get('user-agent'),
  };
}

export async function withPlatform<T>(fn: (platform: CustomerPlatform, sql: SqlClient) => Promise<T>): Promise<T> {
  return withAskTx(async (client) => {
    const sql = asSql(client);
    const platform = customerPlatformForSql(sql);
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

export async function clearIntentCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(INTENT_COOKIE, '', sessionCookieOptions(0));
}

/** Same underlying secret as handoff signing, but never the same signed message — see claim-receipt.ts. */
function receiptSecret(): string {
  return process.env.ATH_HANDOFF_SECRET || '';
}

export async function readClaimReceipt(): Promise<ClaimReceipt | null> {
  const jar = await cookies();
  return decodeClaimReceipt(jar.get(RECEIPT_COOKIE)?.value, receiptSecret());
}

export async function setClaimReceiptCookie(receipt: ClaimReceipt): Promise<void> {
  const jar = await cookies();
  jar.set(RECEIPT_COOKIE, encodeClaimReceipt(receipt, receiptSecret()), sessionCookieOptions(15 * 60));
}

export async function clearClaimReceiptCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(RECEIPT_COOKIE, '', sessionCookieOptions(0));
}

export async function currentContext(): Promise<RequestContext> {
  return requestContextFromHeaders(await headers());
}
