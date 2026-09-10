import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { isMyTrustHubFeatureEnabled } from "./feature-flags";

// A temporary, parent-only canary gate permits production certification before
// announcing specialist support. The prepare/finish routes still require the
// authenticated allowlisted founder; master OFF always wins.
export function contractorSaveEnabled() {
  return isMyTrustHubFeatureEnabled("MY_TRUSTHUB_SAVED_ENABLED") &&
    (isMyTrustHubFeatureEnabled("MY_TRUSTHUB_SPECIALIST_HANDOFF_ENABLED") ||
      (process.env.MY_TRUSTHUB_CANARY_ONLY === "true" && process.env.MY_TRUSTHUB_P13_CERTIFICATION_ENABLED === "true"));
}

export const ASK_ORIGIN = "https://www.asktrusthub.com";
export const CONTRACTOR_ORIGIN = "https://www.contractortrusthub.com";
export const P13_COOKIE = "__Host-myth-p13";
export const P13_ARRIVAL_COOKIE = "__Host-myth-p13-arrival";
export const safeHeaders = { "Cache-Control": "private, no-store, max-age=0", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow, noarchive", "X-Content-Type-Options": "nosniff" };
export const opaque = () => randomBytes(32).toString("base64url");
export const validOpaque = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
export function authorized(value: string | null, secret: string | undefined) {
  if (!secret || secret.length < 32 || !value) return false;
  const actual = Buffer.from(value); const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function handoffError(status = 400) {
  return new NextResponse("This handoff is unavailable, expired, or already used. Return to the Contractor profile and try Save again.", { status, headers: safeHeaders });
}
export function relayForm(destination: string, name: "intent" | "code", value: string) {
  if (![`${CONTRACTOR_ORIGIN}/api/my-trusthub/issue`, `${ASK_ORIGIN}/my/handoff/arrive`].includes(destination) || !validOpaque(value)) throw new Error("INVALID_RELAY");
  const nonce = opaque();
  return new NextResponse(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Continue secure Save</title><body><main><h1>Continue to My TrustHub</h1><form method="post" action="${destination}"><input type="hidden" name="${name}" value="${value}"><button type="submit">Continue secure Save</button></form></main><script nonce="${nonce}">document.forms[0].submit()</script></body></html>`, { headers: { ...safeHeaders, "Referrer-Policy": "strict-origin", "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; form-action ${destination}; frame-ancestors 'none'; base-uri 'none'` } });
}
