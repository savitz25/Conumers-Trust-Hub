import "server-only";

import type { User } from "@supabase/supabase-js";
import { accessMode, admitted } from './account-policy';

function csvSet(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isMyTrustHubCanaryOnly(): boolean {
  return accessMode(process.env) === 'internal';
}

export function isApprovedCanaryEmail(email: string): boolean {
  return csvSet(process.env.MY_TRUSTHUB_CANARY_EMAILS).has(email.trim().toLowerCase());
}

export function hasMyTrustHubCanaryAccess(user: User): boolean {
  return admitted(user, process.env);
}

export function getMyTrustHubAccessMode() {
  return accessMode(process.env);
}
