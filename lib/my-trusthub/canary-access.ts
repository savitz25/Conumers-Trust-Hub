import "server-only";

import type { User } from "@supabase/supabase-js";

function csvSet(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isMyTrustHubCanaryOnly(): boolean {
  return process.env.MY_TRUSTHUB_CANARY_ONLY?.trim().toLowerCase() !== "false";
}

export function isApprovedCanaryEmail(email: string): boolean {
  return csvSet(process.env.MY_TRUSTHUB_CANARY_EMAILS).has(email.trim().toLowerCase());
}

export function hasMyTrustHubCanaryAccess(user: User): boolean {
  if (!isMyTrustHubCanaryOnly()) return true;

  const approvedUserIds = csvSet(process.env.MY_TRUSTHUB_CANARY_USER_IDS);
  const approvedById = approvedUserIds.has(user.id.toLowerCase());
  const approvedByEmail = Boolean(user.email && isApprovedCanaryEmail(user.email));
  const approvedByTrustedClaim = user.app_metadata?.my_trusthub_canary === true;

  return approvedByTrustedClaim && (approvedById || approvedByEmail);
}

export function getMyTrustHubAccessMode(): "internal_canary" | "public" {
  return isMyTrustHubCanaryOnly() ? "internal_canary" : "public";
}
