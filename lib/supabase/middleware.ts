import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasMyTrustHubCanaryAccess } from "@/lib/my-trusthub/canary-access";
import {
  getMyTrustHubSupabasePublishableKey,
  getMyTrustHubSupabaseUrl,
} from "@/lib/my-trusthub/runtime-config";

export async function refreshMyTrustHubSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = getMyTrustHubSupabaseUrl();
  const key = getMyTrustHubSupabasePublishableKey();
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        for (const { name, value } of values) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of values) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  if (
    request.nextUrl.pathname.startsWith("/my") &&
    data.user &&
    !hasMyTrustHubCanaryAccess(data.user)
  ) {
    await supabase.auth.signOut();
    const denied = NextResponse.redirect(
      new URL("/my/sign-in?access=restricted", request.url),
    );
    for (const cookie of response.cookies.getAll()) {
      denied.cookies.set(cookie);
    }
    return denied;
  }
  return response;
}
