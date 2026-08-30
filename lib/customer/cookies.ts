export const SESSION_COOKIE = 'ath_biz_session';
export const INTENT_COOKIE = 'ath_claim_intent';

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}
