import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isMyTrustHubFeatureEnabled } from "@/lib/my-trusthub/feature-flags";
import { ProductionMyTrustHubAdapter } from "@/lib/my-trusthub/production-adapter";
import { privateWorkspaceGate } from "@/lib/my-trusthub/workspace-gate";

export async function getEnabledAdapter() {
  await cookies();
  if (!isMyTrustHubFeatureEnabled("MY_TRUSTHUB_ENABLED")) return null;
  return ProductionMyTrustHubAdapter.create();
}

export async function requireWorkspace(returnPath?: "/my/saved" | "/my/projects") {
  await cookies();
  const featureEnabled = isMyTrustHubFeatureEnabled("MY_TRUSTHUB_ENABLED");
  const adapter = featureEnabled ? await ProductionMyTrustHubAdapter.create() : null;
  const user = adapter ? await adapter.getUser() : null;
  const gate = privateWorkspaceGate({
    featureEnabled,
    adapterAvailable: Boolean(adapter),
    userPresent: Boolean(user),
  });
  if (gate.kind === "redirect" || !adapter || !user) {
    const href = gate.kind === "redirect" ? gate.href : "/my/sign-in";
    // Only fixed workspace destinations may continue through sign-in. Do not
    // forward query notices or accept an arbitrary caller-provided redirect.
    const next = returnPath === "/my/saved" || returnPath === "/my/projects" ? returnPath : null;
    redirect(next ? `${href}${href.includes("?") ? "&" : "?"}next=${encodeURIComponent(next)}` : href);
  }
  return { adapter, user };
}
