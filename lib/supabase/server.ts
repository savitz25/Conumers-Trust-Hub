import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { applySessionCookieWrite } from '@/lib/my-trusthub/cookie-writes';
import {
  getMyTrustHubSupabasePublishableKey,
  getMyTrustHubSupabaseUrl,
} from "@/lib/my-trusthub/runtime-config";

export async function createMyTrustHubSupabaseClient(requireCookieWrite = false) {
  const url = getMyTrustHubSupabaseUrl();
  const publishableKey = getMyTrustHubSupabasePublishableKey();
  if (!url || !publishableKey) return null;

  const cookieStore = await cookies();
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(values) {
        applySessionCookieWrite(() => {
          for (const { name, value, options } of values) {
            cookieStore.set(name, value, options);
          }
        }, requireCookieWrite, () => {
          console.warn(JSON.stringify({ level: "warn", event: "my_trusthub_cookie_write_failed", surface: "server_client" }));
        });
      },
    },
  });
}
