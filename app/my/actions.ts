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

function rowVersionField(formData: FormData): number {
  const value = Number(formData.get("rowVersion"));
  if (!Number.isSafeInteger(value) || value < 1) throw new Error("Invalid row version");
  return value;
}

function optionalUuidField(formData: FormData, name: string): string | undefined {
  const value = String(formData.get(name) ?? "").trim();
  if (!value) return undefined;
  if (!UUID_PATTERN.test(value)) throw new Error(`Invalid ${name}`);
  return value;
}

function noteTypeField(formData: FormData) {
  const value = String(formData.get("noteType") ?? "general");
  if (!['general', 'research', 'reminder'].includes(value)) throw new Error("Invalid note type");
  return value as "general" | "research" | "reminder";
}

function guestPayload(raw: string): Record<string, unknown> {
  if (!raw || new TextEncoder().encode(raw).length > 256 * 1024) throw new Error("Invalid guest payload");
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid guest payload");
  return parsed as Record<string, unknown>;
}

async function requiredAdapter() {
  const adapter = await ProductionMyTrustHubAdapter.create();
  if (!adapter || !(await adapter.getUser())) redirect("/my/sign-in");
  return adapter;
}

async function safeMutation<T>(event: string, errorPath: string, mutation: () => Promise<T>): Promise<T> {
  try {
    return await mutation();
  } catch {
    console.warn(JSON.stringify({ level: "warn", event }));
    redirect(errorPath);
  }
}

export async function requestMagicLinkAction(formData: FormData) {
  assertMyTrustHubFeature("MY_TRUSTHUB_ENABLED");
  const email = textField(formData, "email", 254).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) redirect("/my/sign-in?error=invalid");

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
  if (!client || !url || !key) redirect("/my/sign-in?error=unavailable");

  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/my`,
      shouldCreateUser: flags.MY_TRUSTHUB_SIGNUP_ENABLED && !canaryOnly,
    },
  });
  if (error) {
    const safeMessage = error.message.replaceAll(email, "[redacted-email]");
    console.error(JSON.stringify({
      level: "error",
      event: "my_trusthub_magic_link_failed",
      code: error.code ?? "unknown",
      status: error.status ?? null,
      message: safeMessage,
    }));
    redirect("/my/sign-in?error=delivery");
  }
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
  const projectId = await safeMutation("my_trusthub_project_create_failed", "/my/projects?error=unable", () => adapter.createProject({
    creationKey: randomUUID(),
    name: textField(formData, "name", 120),
    lifeEventType: textField(formData, "lifeEventType", 40),
    targetDate: String(formData.get("targetDate") ?? "") || undefined,
  }));
  revalidatePath("/my");
  revalidatePath("/my/projects");
  redirect(`/my/projects/${projectId}`);
}

export async function updateProjectAction(formData: FormData) {
  assertMyTrustHubFeature("MY_TRUSTHUB_PROJECTS_ENABLED");
  const adapter = await requiredAdapter();
  const projectId = uuidField(formData, "projectId");
  const existing = await adapter.getProject(projectId);
  if (!existing) redirect("/my/projects?error=not-found");
  await safeMutation("my_trusthub_project_update_failed", `/my/projects/${projectId}?error=unable`, () => adapter.updateProject({
    projectId,
    rowVersion: rowVersionField(formData),
    name: textField(formData, "name", 120),
    locationContext: existing.location_context && typeof existing.location_context === "object"
      ? existing.location_context as Record<string, string>
      : undefined,
    targetDate: String(formData.get("targetDate") ?? "") || undefined,
  }));
  revalidatePath("/my");
  revalidatePath("/my/projects");
  revalidatePath(`/my/projects/${projectId}`);
  redirect(`/my/projects/${projectId}?updated=1`);
}

export async function archiveProjectAction(formData: FormData) {
  assertMyTrustHubFeature("MY_TRUSTHUB_PROJECTS_ENABLED");
  const adapter = await requiredAdapter();
  const projectId = uuidField(formData, "projectId");
  await safeMutation("my_trusthub_project_archive_failed", `/my/projects/${projectId}?error=unable`, () => adapter.archiveProject(projectId, rowVersionField(formData)));
  revalidatePath("/my");
  revalidatePath("/my/projects");
  revalidatePath(`/my/projects/${projectId}`);
}

export async function restoreProjectAction(formData: FormData) {
  assertMyTrustHubFeature("MY_TRUSTHUB_PROJECTS_ENABLED");
  const adapter = await requiredAdapter();
  const projectId = uuidField(formData, "projectId");
  await safeMutation("my_trusthub_project_restore_failed", `/my/projects/${projectId}?error=unable`, () => adapter.restoreProject(projectId, rowVersionField(formData)));
  revalidatePath("/my");
  revalidatePath("/my/projects");
  revalidatePath(`/my/projects/${projectId}`);
}

export async function addSavedToProjectAction(formData: FormData) {
  assertMyTrustHubFeature("MY_TRUSTHUB_PROJECTS_ENABLED");
  const adapter = await requiredAdapter();
  const projectId = uuidField(formData, "projectId");
  await safeMutation("my_trusthub_membership_add_failed", "/my/saved?error=unable", () => adapter.addSavedEntityToProject(
    projectId,
    uuidField(formData, "savedEntityId"),
  ));
  revalidatePath("/my");
  revalidatePath("/my/saved");
  revalidatePath(`/my/projects/${projectId}`);
}

export async function removeSavedFromProjectAction(formData: FormData) {
  assertMyTrustHubFeature("MY_TRUSTHUB_PROJECTS_ENABLED");
  const adapter = await requiredAdapter();
  const projectId = uuidField(formData, "projectId");
  await safeMutation("my_trusthub_membership_remove_failed", "/my/saved?error=unable", () => adapter.removeSavedEntityFromProject(
    projectId,
    uuidField(formData, "savedEntityId"),
  ));
  revalidatePath("/my");
  revalidatePath("/my/saved");
  revalidatePath(`/my/projects/${projectId}`);
}

export async function createPrivateNoteAction(formData: FormData) {
  assertMyTrustHubFeature("MY_TRUSTHUB_SAVED_ENABLED");
  const adapter = await requiredAdapter();
  const savedEntityId = optionalUuidField(formData, "savedEntityId");
  const projectId = optionalUuidField(formData, "projectId");
  await safeMutation("my_trusthub_note_create_failed", "/my/saved?error=unable", () => adapter.createNote({
    requestId: randomUUID(),
    savedEntityId,
    projectId,
    noteType: noteTypeField(formData),
    body: textField(formData, "body", 4000),
  }));
  revalidatePath("/my");
  revalidatePath("/my/saved");
  if (projectId) revalidatePath(`/my/projects/${projectId}`);
}

export async function updatePrivateNoteAction(formData: FormData) {
  assertMyTrustHubFeature("MY_TRUSTHUB_SAVED_ENABLED");
  const adapter = await requiredAdapter();
  await safeMutation("my_trusthub_note_update_failed", "/my/saved?error=unable", () => adapter.updateNote({
    noteId: uuidField(formData, "noteId"),
    rowVersion: rowVersionField(formData),
    noteType: noteTypeField(formData),
    body: textField(formData, "body", 4000),
  }));
  revalidatePath("/my");
  revalidatePath("/my/saved");
}

export async function deletePrivateNoteAction(formData: FormData) {
  assertMyTrustHubFeature("MY_TRUSTHUB_SAVED_ENABLED");
  const adapter = await requiredAdapter();
  await safeMutation("my_trusthub_note_delete_failed", "/my/saved?error=unable", () => adapter.deleteNote(uuidField(formData, "noteId")));
  revalidatePath("/my");
  revalidatePath("/my/saved");
}

export type GuestPreviewState = {
  ok: boolean;
  error?: string;
  items?: Awaited<ReturnType<ProductionMyTrustHubAdapter["previewGuestImport"]>>;
};

export async function previewGuestImportAction(rawPayload: string): Promise<GuestPreviewState> {
  try {
    const adapter = await requiredAdapter();
    return { ok: true, items: await adapter.previewGuestImport(guestPayload(rawPayload)) };
  } catch {
    return { ok: false, error: "This guest research could not be restored safely." };
  }
}

export async function commitGuestImportAction(formData: FormData) {
  assertMyTrustHubFeature("MY_TRUSTHUB_SAVED_ENABLED");
  const adapter = await requiredAdapter();
  try {
    const payload = guestPayload(textField(formData, "payload", 262144));
    const selectedItemIds = formData.getAll("selectedItemId").map(String).filter(Boolean);
    if (!selectedItemIds.length) redirect("/my/saved?import=none");
    await adapter.commitGuestImport({
      payload,
      selectedItemIds,
      idempotencyKey: uuidField(formData, "idempotencyKey"),
      projectId: optionalUuidField(formData, "projectId"),
    });
    revalidatePath("/my");
    revalidatePath("/my/saved");
    revalidatePath("/my/projects");
    redirect("/my/saved?import=complete");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/my/saved?import=invalid");
  }
}
