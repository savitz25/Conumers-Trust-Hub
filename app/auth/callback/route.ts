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
  destination.searchParams.set("auth", code ? "complete" : "failed");
  if (!code) return NextResponse.redirect(destination);

  const client = await createMyTrustHubSupabaseClient();
  if (!client) return NextResponse.redirect(destination);
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) {
    destination.searchParams.set("auth", "failed");
    return NextResponse.redirect(destination);
  }

  const { data } = await client.auth.getUser();
  if (!data.user || !hasMyTrustHubCanaryAccess(data.user)) {
    await client.auth.signOut();
    return NextResponse.redirect(new URL("/my/sign-in?access=restricted", request.nextUrl.origin));
  }
  return NextResponse.redirect(destination);
}
