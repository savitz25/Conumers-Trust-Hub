import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  getMyTrustHubSupabasePublishableKey,
  getMyTrustHubSupabaseUrl,
} from "@/lib/my-trusthub/runtime-config";

export async function createMyTrustHubSupabaseClient() {
  const url = getMyTrustHubSupabaseUrl();
  const publishableKey = getMyTrustHubSupabasePublishableKey();
  if (!url || !publishableKey) return null;

  const cookieStore = await cookies();
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(values) {
        try {
          for (const { name, value, options } of values) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. Middleware refreshes sessions.
        }
      },
    },
  });
}
