import "server-only";

const EXPECTED_MY_TRUSTHUB_PROJECT_HOST =
  "qvvxvbcdmbjzrgvwjatw.supabase.co";

export interface MyTrustHubRuntimeReadiness {
  supabaseConfigured: boolean;
  publishableKeyConfigured: boolean;
  serviceRolePresentInPublicEnv: boolean;
  environment: "production" | "preview" | "development";
}

export function getMyTrustHubSupabaseUrl(): string | null {
  const value = process.env.NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === EXPECTED_MY_TRUSTHUB_PROJECT_HOST
      ? url.toString().replace(/\/$/, "")
      : null;
  } catch {
    return null;
  }
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
