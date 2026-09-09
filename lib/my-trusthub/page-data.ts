import "server-only";

import { notFound, redirect } from "next/navigation";
import { isMyTrustHubFeatureEnabled } from "@/lib/my-trusthub/feature-flags";
import { ProductionMyTrustHubAdapter } from "@/lib/my-trusthub/production-adapter";

export async function getEnabledAdapter() {
  if (!isMyTrustHubFeatureEnabled("MY_TRUSTHUB_ENABLED")) notFound();
  return ProductionMyTrustHubAdapter.create();
}

export async function requireWorkspace() {
  const adapter = await getEnabledAdapter();
  if (!adapter) redirect("/my/sign-in?configuration=missing");
  const user = await adapter.getUser();
  if (!user) redirect("/my/sign-in");
  return { adapter, user };
}
