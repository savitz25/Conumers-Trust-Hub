import "server-only";

export interface MyTrustHubRuntimeReadiness {
  supabaseConfigured: boolean;
  publishableKeyConfigured: boolean;
  serviceRolePresentInPublicEnv: boolean;
  environment: "production" | "preview" | "development";
}

export function getSupabaseUrl(): string | null {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".supabase.co")
      ? url.toString().replace(/\/$/, "")
      : null;
  } catch {
    return null;
  }
}

export function getSupabasePublishableKey(): string | null {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    null
  );
}

export function getMyTrustHubRuntimeReadiness(): MyTrustHubRuntimeReadiness {
  return {
    supabaseConfigured: Boolean(getSupabaseUrl()),
    publishableKeyConfigured: Boolean(getSupabasePublishableKey()),
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
