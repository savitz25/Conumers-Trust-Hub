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
import { DBPR_LOOKUP_CONSENT } from "@/lib/my-trusthub/dbpr-lookup";

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

function boundedInteger(formData: FormData, name: string, minimum: number, maximum: number): number {
  const value = Number(formData.get(name));
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(`Invalid ${name}`);
  return value;
}

function sessionGuestPayload(raw: string): Record<string, unknown> {
  if (!raw || new TextEncoder().encode(raw).length > 256 * 1024) throw new Error("Invalid guest session payload");
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid guest session payload");
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
  const captchaToken = String(formData.get("captchaToken") ?? "").trim();
  if (process.env.NEXT_PUBLIC_MY_TRUSTHUB_TURNSTILE_SITE_KEY && !captchaToken) redirect("/my/sign-in?error=captcha");

  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/my`,
      shouldCreateUser: flags.MY_TRUSTHUB_SIGNUP_ENABLED && !canaryOnly,
      ...(captchaToken ? { captchaToken } : {}),
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

export async function saveMoveInventorySessionAction(formData: FormData) {
  assertMyTrustHubFeature("MY_TRUSTHUB_SESSIONS_ENABLED");
  const adapter = await requiredAdapter();
  const rooms = boundedInteger(formData, "rooms", 1, 20);
  const estimatedCubicFeet = boundedInteger(formData, "estimatedCubicFeet", 50, 20000);
  const title = textField(formData, "title", 120);
  await safeMutation("my_trusthub_session_save_failed", "/my/saved?session_error=unable", () => adapter.saveSession({
    hub: "move",
    sessionType: "inventory",
    schemaKey: "move.inventory/v1",
    schemaVersion: 1,
    payload: { room_counts: { total: rooms }, estimated_cubic_feet: estimatedCubicFeet },
    summary: { title, primary_value: estimatedCubicFeet, unit: "estimated cubic feet", label: `${rooms} rooms` },
    projectId: optionalUuidField(formData, "projectId"),
    idempotencyKey: uuidField(formData, "idempotencyKey"),
  }));
  revalidatePath("/my"); revalidatePath("/my/saved"); revalidatePath("/my/projects");
  redirect("/my/saved?session=saved");
}

export async function updateMoveInventorySessionAction(formData: FormData) {
  assertMyTrustHubFeature("MY_TRUSTHUB_SESSIONS_ENABLED");
  const adapter = await requiredAdapter();
  const sessionId = uuidField(formData, "sessionId");
  const current = await adapter.getSavedSession(sessionId);
  if (!current || current.schema_key !== "move.inventory/v1" || current.schema_version !== 1) redirect("/my/saved?session_error=unsupported");
  const rooms = boundedInteger(formData, "rooms", 1, 20);
  const estimatedCubicFeet = boundedInteger(formData, "estimatedCubicFeet", 50, 20000);
  const title = textField(formData, "title", 120);
  await safeMutation("my_trusthub_session_update_failed", `/my/sessions/${sessionId}?error=unable`, () => adapter.updateSavedSession({
    sessionId, schemaKey: current.schema_key, schemaVersion: current.schema_version,
    payload: { room_counts: { total: rooms }, estimated_cubic_feet: estimatedCubicFeet },
    summary: { title, primary_value: estimatedCubicFeet, unit: "estimated cubic feet", label: `${rooms} rooms` },
    rowVersion: rowVersionField(formData), idempotencyKey: randomUUID(),
  }));
  revalidatePath("/my"); revalidatePath("/my/saved"); revalidatePath(`/my/sessions/${sessionId}`);
  redirect(`/my/sessions/${sessionId}?updated=1`);
}

export async function addSessionToProjectAction(formData: FormData) {
  assertMyTrustHubFeature("MY_TRUSTHUB_SESSIONS_ENABLED");
  const adapter = await requiredAdapter();
  const sessionId = uuidField(formData, "sessionId");
  const projectId = uuidField(formData, "projectId");
  await safeMutation("my_trusthub_session_project_add_failed", `/my/sessions/${sessionId}?error=unable`, () => adapter.addSessionToProject(sessionId, projectId));
  revalidatePath("/my"); revalidatePath("/my/saved"); revalidatePath(`/my/sessions/${sessionId}`); revalidatePath(`/my/projects/${projectId}`);
}

export async function removeSessionFromProjectAction(formData: FormData) {
  assertMyTrustHubFeature("MY_TRUSTHUB_SESSIONS_ENABLED");
  const adapter = await requiredAdapter();
  const sessionId = uuidField(formData, "sessionId");
  const projectId = uuidField(formData, "projectId");
  await safeMutation("my_trusthub_session_project_remove_failed", `/my/sessions/${sessionId}?error=unable`, () => adapter.removeSessionFromProject(sessionId, projectId));
  revalidatePath("/my"); revalidatePath("/my/saved"); revalidatePath(`/my/sessions/${sessionId}`); revalidatePath(`/my/projects/${projectId}`);
}

export async function resumeSavedSessionAction(formData: FormData) {
  assertMyTrustHubFeature("MY_TRUSTHUB_SESSIONS_ENABLED");
  const adapter = await requiredAdapter();
  const sessionId = uuidField(formData, "sessionId");
  const session = await adapter.getSavedSession(sessionId);
  if (!session) redirect("/my/saved?session_error=not-found");
  await safeMutation("my_trusthub_session_resume_validation_failed", `/my/sessions/${sessionId}?resume=unsupported`, () => adapter.validateSessionForResume(session.resume_ref));
  // Cross-hub handoff remains deliberately disabled. Validation proves the preserved
  // session is current without exposing its payload or resume reference in a URL.
  redirect(`/my/sessions/${sessionId}?resume=hub-unavailable`);
}

export type GuestSessionPreviewState = { ok: boolean; error?: string; items?: Awaited<ReturnType<ProductionMyTrustHubAdapter["previewGuestSessionImport"]>> };

export async function previewGuestSessionImportAction(rawPayload: string): Promise<GuestSessionPreviewState> {
  try {
    assertMyTrustHubFeature("MY_TRUSTHUB_SESSIONS_ENABLED");
    const adapter = await requiredAdapter();
    return { ok: true, items: await adapter.previewGuestSessionImport(sessionGuestPayload(rawPayload)) };
  } catch {
    return { ok: false, error: "This guest research session could not be restored safely." };
  }
}

export async function commitGuestSessionImportAction(formData: FormData) {
  assertMyTrustHubFeature("MY_TRUSTHUB_SESSIONS_ENABLED");
  const adapter = await requiredAdapter();
  try {
    const payload = sessionGuestPayload(textField(formData, "payload", 262144));
    const selectedItemIds = formData.getAll("selectedItemId").map(String).filter(Boolean);
    if (!selectedItemIds.length) redirect("/my/saved?session_import=none");
    await adapter.commitGuestSessionImport({ payload, selectedItemIds, projectId: optionalUuidField(formData, "projectId"), idempotencyKey: uuidField(formData, "idempotencyKey") });
    revalidatePath("/my"); revalidatePath("/my/saved"); revalidatePath("/my/projects");
    redirect("/my/saved?session_import=complete");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/my/saved?session_import=invalid");
  }
}

function capabilityIds(formData: FormData): string[] {
  return formData.getAll("capabilityId").map(String).filter((value) => /^[0-9a-f-]{36}$/i.test(value));
}

export async function startWatchAction(formData: FormData) {
  assertMyTrustHubFeature("MY_TRUSTHUB_WATCH_ENABLED");
  const adapter = await requiredAdapter();
  const savedEntityId = uuidField(formData, "savedEntityId");
  const selected = capabilityIds(formData);
  if (!selected.length) redirect("/my/watches?error=coverage-required");
  await safeMutation("my_trusthub_watch_start_failed", "/my/watches?error=unable", () =>
    adapter.startWatch(savedEntityId, selected, uuidField(formData, "idempotencyKey")));
  revalidatePath("/my"); revalidatePath("/my/saved"); revalidatePath("/my/watches");
  redirect("/my/watches?started=1");
}

async function mutateWatch(formData: FormData, operation: "pause" | "resume" | "stop" | "restart") {
  assertMyTrustHubFeature("MY_TRUSTHUB_WATCH_ENABLED");
  const adapter = await requiredAdapter();
  const watchId = uuidField(formData, "watchId");
  const rowVersion = rowVersionField(formData);
  await safeMutation(`my_trusthub_watch_${operation}_failed`, "/my/watches?error=unable", () => {
    if (operation === "pause") return adapter.pauseWatch(watchId, rowVersion);
    if (operation === "resume") return adapter.resumeWatch(watchId, rowVersion);
    if (operation === "stop") return adapter.stopWatch(watchId, rowVersion);
    const selected = capabilityIds(formData);
    if (!selected.length) throw new Error("COVERAGE_REQUIRED");
    return adapter.restartWatch(watchId, selected, rowVersion);
  });
  revalidatePath("/my"); revalidatePath("/my/saved"); revalidatePath("/my/watches");
}

export async function pauseWatchAction(formData: FormData) { return mutateWatch(formData, "pause"); }
export async function resumeWatchAction(formData: FormData) { return mutateWatch(formData, "resume"); }
export async function stopWatchAction(formData: FormData) { return mutateWatch(formData, "stop"); }
export async function restartWatchAction(formData: FormData) { return mutateWatch(formData, "restart"); }

export async function upgradeDbprWatchAction(formData: FormData) {
  assertMyTrustHubFeature("MY_TRUSTHUB_WATCH_ENABLED");
  const adapter = await requiredAdapter();
  if (formData.get("consent") !== DBPR_LOOKUP_CONSENT) redirect("/my/watches?error=consent-required");
  await safeMutation("my_trusthub_watch_upgrade_failed", "/my/watches?error=unable", () =>
    adapter.upgradeDbprWatch(uuidField(formData, "watchId"), uuidField(formData, "fromCapabilityId"),
      uuidField(formData, "toCapabilityId"), rowVersionField(formData), uuidField(formData, "idempotencyKey"), DBPR_LOOKUP_CONSENT));
  revalidatePath("/my"); revalidatePath("/my/saved"); revalidatePath("/my/watches");
  redirect("/my/watches?upgraded=2");
}

export async function updateNotificationPreferencesAction(formData: FormData) {
  assertMyTrustHubFeature("MY_TRUSTHUB_EMAIL_ENABLED");
  const adapter = await requiredAdapter();
  const timezone = textField(formData, "timezone", 100);
  const digestTimeLocal = textField(formData, "digestTimeLocal", 8);
  if (!/^\d{2}:\d{2}$/.test(digestTimeLocal)) throw new Error("Invalid digest time");
  await safeMutation("my_trusthub_notification_preferences_failed", "/my/you?error=notifications", () => adapter.updateNotificationPreferences({
    p0EmailEnabled: formData.get("p0EmailEnabled") === "on",
    p1DigestEnabled: formData.get("p1DigestEnabled") === "on",
    p2DigestEnabled: formData.get("p2DigestEnabled") === "on",
    periodicWatchSummaryEnabled: formData.get("periodicWatchSummaryEnabled") === "on",
    timezone, digestTimeLocal: `${digestTimeLocal}:00`, expectedRowVersion: rowVersionField(formData), idempotencyKey: randomUUID(),
  }));
  revalidatePath("/my/you");
}

export async function setWatchNotificationOverrideAction(formData: FormData) {
  assertMyTrustHubFeature("MY_TRUSTHUB_EMAIL_ENABLED");
  const adapter = await requiredAdapter();
  const severity = textField(formData, "severity", 2);
  if (!("P0 P1 P2" as string).split(" ").includes(severity)) throw new Error("Invalid severity");
  await safeMutation("my_trusthub_watch_notification_override_failed", "/my/you?error=notifications", () => adapter.setWatchNotificationOverride(uuidField(formData, "watchId"), severity as "P0" | "P1" | "P2", formData.get("enabled") === "on", randomUUID()));
  revalidatePath("/my/you");
}

export async function removeWatchNotificationOverrideAction(formData: FormData) {
  assertMyTrustHubFeature("MY_TRUSTHUB_EMAIL_ENABLED");
  const adapter = await requiredAdapter();
  const severity = textField(formData, "severity", 2);
  if (!("P0 P1 P2" as string).split(" ").includes(severity)) throw new Error("Invalid severity");
  await safeMutation("my_trusthub_watch_notification_override_remove_failed", "/my/you?error=notifications", () => adapter.removeWatchNotificationOverride(uuidField(formData, "watchId"), severity as "P0" | "P1" | "P2", randomUUID()));
  revalidatePath("/my/you");
}

export async function setAlertReadStateAction(formData: FormData) {
  assertMyTrustHubFeature("MY_TRUSTHUB_ALERTS_ENABLED");
  const adapter = await requiredAdapter();
  const alertRef = uuidField(formData, "alertRef");
  const read = String(formData.get("read")) === "true";
  await safeMutation("my_trusthub_alert_read_state_failed", "/my/alerts?error=unable", () =>
    adapter.setAlertReadState({ alertRef, read, expectedRowVersion: rowVersionField(formData) }));
  revalidatePath("/my"); revalidatePath("/my/alerts"); revalidatePath(`/my/alerts/${alertRef}`);
}

export async function markAllAlertsReadAction() {
  assertMyTrustHubFeature("MY_TRUSTHUB_ALERTS_ENABLED");
  const adapter = await requiredAdapter();
  await safeMutation("my_trusthub_alert_mark_all_read_failed", "/my/alerts?error=unable", () => adapter.markAllAlertsRead());
  revalidatePath("/my"); revalidatePath("/my/alerts");
}

export async function requestExportAction() {
  assertMyTrustHubFeature("MY_TRUSTHUB_EXPORT_ENABLED");
  const adapter = await requiredAdapter();
  const ref = await safeMutation("my_trusthub_export_request_failed", "/my/you?error=export", () => adapter.requestExport(randomUUID()));
  revalidatePath("/my/you");
  redirect(`/my/you?export=${encodeURIComponent(ref)}`);
}

export async function requestDeletionConfirmationAction() {
  assertMyTrustHubFeature("MY_TRUSTHUB_DELETE_ENABLED");
  const adapter = await requiredAdapter();
  const code = await safeMutation("my_trusthub_deletion_confirmation_failed", "/my/you?error=deletion", () => adapter.issueDeletionConfirmation());
  revalidatePath("/my/you");
  redirect(`/my/you?delete_code=${encodeURIComponent(code)}`);
}

export async function requestWorkspaceDeletionAction(formData: FormData) {
  assertMyTrustHubFeature("MY_TRUSTHUB_DELETE_ENABLED");
  const adapter = await requiredAdapter();
  const code = textField(formData, "confirmationCode", 120);
  const ref = await safeMutation("my_trusthub_deletion_request_failed", "/my/you?error=deletion", () => adapter.requestWorkspaceDeletion(code, randomUUID()));
  revalidatePath("/my/you");
  redirect(`/my/you?deletion=${encodeURIComponent(ref)}`);
}

export async function cancelWorkspaceDeletionAction(formData: FormData) {
  assertMyTrustHubFeature("MY_TRUSTHUB_DELETE_ENABLED");
  const adapter = await requiredAdapter();
  await safeMutation("my_trusthub_deletion_cancel_failed", "/my/you?error=deletion", () => adapter.cancelWorkspaceDeletion(uuidField(formData, "deletionRef")));
  revalidatePath("/my/you");
  redirect("/my/you?deletion_cancelled=1");
}
