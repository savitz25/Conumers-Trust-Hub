"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  isApprovedCanaryEmail,
  isMyTrustHubCanaryOnly,
} from "@/lib/my-trusthub/canary-access";
import {
  assertMyTrustHubFeature,
  getMyTrustHubFeatureFlags,
} from "@/lib/my-trusthub/feature-flags";
import {
  getMyTrustHubSupabasePublishableKey,
  getMyTrustHubSupabaseUrl,
} from "@/lib/my-trusthub/runtime-config";
import { ProductionMyTrustHubAdapter } from "@/lib/my-trusthub/production-adapter";
import { createMyTrustHubSupabaseClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function textField(formData: FormData, name: string, max: number): string {
  const value = String(formData.get(name) ?? "").trim();
  if (!value || value.length > max) throw new Error(`Invalid ${name}`);
  return value;
}

function uuidField(formData: FormData, name: string): string {
  const value = textField(formData, name, 36);
  if (!UUID_PATTERN.test(value)) throw new Error(`Invalid ${name}`);
  return value;
}

async function requiredAdapter() {
  const adapter = await ProductionMyTrustHubAdapter.create();
  if (!adapter || !(await adapter.getUser())) redirect("/my/sign-in");
  return adapter;
}

export async function requestMagicLinkAction(formData: FormData) {
  assertMyTrustHubFeature("MY_TRUSTHUB_ENABLED");
  const email = textField(formData, "email", 254).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid email address");

  const flags = getMyTrustHubFeatureFlags();
  const canaryOnly = isMyTrustHubCanaryOnly();
  if (canaryOnly && !isApprovedCanaryEmail(email)) {
    redirect("/my/sign-in?sent=1");
  }
  if (!canaryOnly && !flags.MY_TRUSTHUB_SIGNUP_ENABLED) {
    redirect("/my/sign-in?sent=1");
  }

  const client = await createMyTrustHubSupabaseClient();
  const url = getMyTrustHubSupabaseUrl();
  const key = getMyTrustHubSupabasePublishableKey();
  if (!client || !url || !key) throw new Error("My TrustHub sign-in is not configured");

  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/my`,
      shouldCreateUser: flags.MY_TRUSTHUB_SIGNUP_ENABLED && !canaryOnly,
    },
  });
  if (error) throw new Error("Unable to send the sign-in link");
  redirect("/my/sign-in?sent=1");
}

export async function signOutAction() {
  const client = await createMyTrustHubSupabaseClient();
  if (client) await client.auth.signOut();
  redirect("/my");
}

export async function saveCanaryEntityAction(formData: FormData) {
  assertMyTrustHubFeature("MY_TRUSTHUB_SAVED_ENABLED");
  const adapter = await requiredAdapter();
  await adapter.saveEntity(uuidField(formData, "bindingId"));
  revalidatePath("/my");
  revalidatePath("/my/saved");
  redirect("/my/saved");
}

export async function createProjectAction(formData: FormData) {
  assertMyTrustHubFeature("MY_TRUSTHUB_PROJECTS_ENABLED");
  const adapter = await requiredAdapter();
  const projectId = await adapter.createProject({
    creationKey: randomUUID(),
    name: textField(formData, "name", 120),
    lifeEventType: textField(formData, "lifeEventType", 40),
    targetDate: String(formData.get("targetDate") ?? "") || undefined,
  });
  revalidatePath("/my");
  revalidatePath("/my/projects");
  redirect(`/my/projects/${projectId}`);
}

export async function archiveProjectAction(formData: FormData) {
  assertMyTrustHubFeature("MY_TRUSTHUB_PROJECTS_ENABLED");
  const adapter = await requiredAdapter();
  const projectId = uuidField(formData, "projectId");
  await adapter.archiveProject(projectId, Number(formData.get("rowVersion")));
  revalidatePath("/my");
  revalidatePath("/my/projects");
  revalidatePath(`/my/projects/${projectId}`);
}

export async function restoreProjectAction(formData: FormData) {
  assertMyTrustHubFeature("MY_TRUSTHUB_PROJECTS_ENABLED");
  const adapter = await requiredAdapter();
  const projectId = uuidField(formData, "projectId");
  await adapter.restoreProject(projectId, Number(formData.get("rowVersion")));
  revalidatePath("/my");
  revalidatePath("/my/projects");
  revalidatePath(`/my/projects/${projectId}`);
}

export async function addSavedToProjectAction(formData: FormData) {
  assertMyTrustHubFeature("MY_TRUSTHUB_PROJECTS_ENABLED");
  const adapter = await requiredAdapter();
  const projectId = uuidField(formData, "projectId");
  await adapter.addSavedEntityToProject(
    projectId,
    uuidField(formData, "savedEntityId"),
  );
  revalidatePath("/my");
  revalidatePath("/my/saved");
  revalidatePath(`/my/projects/${projectId}`);
}

export async function removeSavedFromProjectAction(formData: FormData) {
  assertMyTrustHubFeature("MY_TRUSTHUB_PROJECTS_ENABLED");
  const adapter = await requiredAdapter();
  const projectId = uuidField(formData, "projectId");
  await adapter.removeSavedEntityFromProject(
    projectId,
    uuidField(formData, "savedEntityId"),
  );
  revalidatePath("/my");
  revalidatePath("/my/saved");
  revalidatePath(`/my/projects/${projectId}`);
}
