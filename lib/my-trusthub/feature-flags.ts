import "server-only";

export const MY_TRUSTHUB_FEATURE_KEYS = [
  "MY_TRUSTHUB_ENABLED",
  "MY_TRUSTHUB_SIGNUP_ENABLED",
  "MY_TRUSTHUB_SAVED_ENABLED",
  "MY_TRUSTHUB_PROJECTS_ENABLED",
  "MY_TRUSTHUB_SESSIONS_ENABLED",
  "MY_TRUSTHUB_WATCH_ENABLED",
  "MY_TRUSTHUB_ALERTS_ENABLED",
  "MY_TRUSTHUB_EMAIL_ENABLED",
  "MY_TRUSTHUB_EXPORT_ENABLED",
  "MY_TRUSTHUB_DELETE_ENABLED",
  "MY_TRUSTHUB_SPECIALIST_HANDOFF_ENABLED",
  "MY_TRUSTHUB_SOURCE_MONITORING_ENABLED",
] as const;

export type MyTrustHubFeatureKey = (typeof MY_TRUSTHUB_FEATURE_KEYS)[number];

function enabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

export function getMyTrustHubFeatureFlags(): Record<MyTrustHubFeatureKey, boolean> {
  const master = enabled(process.env.MY_TRUSTHUB_ENABLED);
  return Object.fromEntries(
    MY_TRUSTHUB_FEATURE_KEYS.map((key) => [
      key,
      key === "MY_TRUSTHUB_ENABLED" ? master : master && enabled(process.env[key]),
    ]),
  ) as Record<MyTrustHubFeatureKey, boolean>;
}

export function isMyTrustHubFeatureEnabled(key: MyTrustHubFeatureKey): boolean {
  return getMyTrustHubFeatureFlags()[key];
}

export function assertMyTrustHubFeature(key: MyTrustHubFeatureKey): void {
  if (!isMyTrustHubFeatureEnabled(key)) {
    throw new Error("MY_TRUSTHUB_FEATURE_DISABLED");
  }
}
