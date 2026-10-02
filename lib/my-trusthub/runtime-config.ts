import "server-only";

import { accountRuntime } from './account-policy';

export interface MyTrustHubRuntimeReadiness {
  supabaseConfigured: boolean;
  publishableKeyConfigured: boolean;
  serviceRolePresentInPublicEnv: boolean;
  environment: "production" | "preview" | "development";
}

export function getMyTrustHubSupabaseUrl(): string | null {
  return accountRuntime(process.env)?.backend ?? null;
}

export function getMyTrustHubSupabasePublishableKey(): string | null {
  return (
    process.env.NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_PUBLISHABLE_KEY?.trim() || null
  );
}

export function getMyTrustHubRuntimeReadiness(): MyTrustHubRuntimeReadiness {
  return {
    supabaseConfigured: Boolean(getMyTrustHubSupabaseUrl()),
    publishableKeyConfigured: Boolean(getMyTrustHubSupabasePublishableKey()),
    serviceRolePresentInPublicEnv: Object.keys(process.env).some(
      (key) => key.startsWith("NEXT_PUBLIC_") && /SERVICE.*ROLE|SECRET.*KEY/i.test(key),
    ),
    environment:
      process.env.VERCEL_ENV === "production"
        ? "production"
        : process.env.VERCEL_ENV === "preview"
          ? "preview"
          : "development",
  };
}
