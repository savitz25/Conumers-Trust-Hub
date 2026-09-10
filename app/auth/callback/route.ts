import { NextResponse, type NextRequest } from "next/server";
import { hasMyTrustHubCanaryAccess } from "@/lib/my-trusthub/canary-access";
import { isMyTrustHubFeatureEnabled } from "@/lib/my-trusthub/feature-flags";
import { createMyTrustHubSupabaseClient } from "@/lib/supabase/server";

function safeNext(value: string | null): string {
  return value === "/my" || value?.startsWith("/my/") ? value : "/my";
}

export async function GET(request: NextRequest) {
  if (!isMyTrustHubFeatureEnabled("MY_TRUSTHUB_ENABLED")) {
    return new NextResponse(null, { status: 404 });
  }
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const destination = new URL(next, request.nextUrl.origin);
  if (!code) {
    console.warn(JSON.stringify({ level: "warn", event: "my_trusthub_auth_callback", outcome: "missing_code", host: request.nextUrl.host, has_verifier: request.cookies.getAll().some((cookie) => cookie.name.includes("code-verifier")) }));
    return NextResponse.redirect(new URL("/my/sign-in?error=callback_missing_code", request.nextUrl.origin));
  }

  const client = await createMyTrustHubSupabaseClient();
  if (!client) {
    console.error(JSON.stringify({ level: "error", event: "my_trusthub_auth_callback", outcome: "runtime_unavailable", host: request.nextUrl.host }));
    return NextResponse.redirect(new URL("/my/sign-in?error=callback_unavailable", request.nextUrl.origin));
  }
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) {
    console.warn(JSON.stringify({ level: "warn", event: "my_trusthub_auth_callback", outcome: "exchange_failed", code: error.code ?? "unknown", status: error.status ?? null, host: request.nextUrl.host, has_verifier: request.cookies.getAll().some((cookie) => cookie.name.includes("code-verifier")) }));
    return NextResponse.redirect(new URL("/my/sign-in?error=callback_exchange", request.nextUrl.origin));
  }

  const { data } = await client.auth.getUser();
  if (!data.user) {
    console.warn(JSON.stringify({ level: "warn", event: "my_trusthub_auth_callback", outcome: "session_validation_failed", host: request.nextUrl.host }));
    await client.auth.signOut();
    return NextResponse.redirect(new URL("/my/sign-in?error=callback_session", request.nextUrl.origin));
  }
  if (!hasMyTrustHubCanaryAccess(data.user)) {
    console.warn(JSON.stringify({ level: "warn", event: "my_trusthub_auth_callback", outcome: "entitlement_rejected", host: request.nextUrl.host }));
    await client.auth.signOut();
    return NextResponse.redirect(new URL("/my/sign-in?access=restricted", request.nextUrl.origin));
  }
  console.info(JSON.stringify({ level: "info", event: "my_trusthub_auth_callback", outcome: "authenticated", host: request.nextUrl.host }));
  return NextResponse.redirect(destination);
}
