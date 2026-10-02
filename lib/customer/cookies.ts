export const SESSION_COOKIE = 'ath_biz_session';
export const INTENT_COOKIE = 'ath_claim_intent';
/** ATH-CLAIM-V2-001: passive handoff receipt. Holds the signed token + a browser-bound receipt id; creates no durable state. */
export const RECEIPT_COOKIE = 'ath_claim_receipt';

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}
