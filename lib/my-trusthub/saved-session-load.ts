/**
 * Owner resume load for one saved session.
 * A missing resume function is identified only by PostgREST PGRST202 or
 * PostgreSQL undefined_function 42883. Message text is not a signal.
 * Every other failure uses the same message format as the adapter fail() path.
 */

const RESUME_FUNCTION_ABSENT_CODES = new Set(["PGRST202", "42883"]);

export const RESUME_UNAVAILABLE_COPY =
  "This version cannot be resumed yet. Your saved research was preserved unchanged.";

export class ResumeCapabilityAbsentError extends Error {
  constructor() {
    super("Resume capability is absent");
    this.name = "RESUME_CAPABILITY_ABSENT";
  }
}

export function isResumeFunctionAbsentCode(code: string | undefined): boolean {
  return code !== undefined && RESUME_FUNCTION_ABSENT_CODES.has(code);
}

export function rejectResumeRpc(error: { message?: string; code?: string } | null): never {
  if (isResumeFunctionAbsentCode(error?.code)) throw new ResumeCapabilityAbsentError();
  const code = error?.code ? `${error.code}: ` : "";
  throw new Error(`My TrustHub data request failed (${code}${error?.message ?? "unknown"})`);
}

export function absorbResumeCapabilityAbsence(error: unknown): { absent: true; session: null } {
  if (error instanceof ResumeCapabilityAbsentError) return { absent: true, session: null };
  throw error;
}

export interface OwnedSavedSessionSummary {
  saved_session_id: string;
  title: string;
  hub: string;
  session_type: "comparison" | "calculator" | "plan" | "worksheet" | "inventory";
  summary: Record<string, string | number | boolean | null>;
  status: "active" | "archived" | "read_only" | "invalidated";
  schema_key: string;
  schema_version: number;
  resume_available: boolean;
  resume_ref: string;
  last_activity_at: string;
}

export interface OwnedSavedSessionDetail {
  id: string;
  hub: string;
  session_type: OwnedSavedSessionSummary["session_type"];
  schema_key: string;
  schema_version: number;
  payload: Record<string, unknown>;
  summary: Record<string, string | number | boolean | null>;
  status: OwnedSavedSessionSummary["status"];
  resume_ref: string;
  row_version: number;
  created_at: string;
  updated_at: string;
  last_resumed_at: string | null;
}

export type SavedSessionPageModel =
  | { kind: "not-found"; httpStatus: 404 }
  | { kind: "resume-unavailable"; httpStatus: 200; copy: typeof RESUME_UNAVAILABLE_COPY }
  | { kind: "ready"; httpStatus: 200; session: OwnedSavedSessionDetail };

function oneRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return (value[0] as Record<string, unknown> | undefined) ?? null;
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export async function readOwnedSavedSession(
  sessionId: string,
  summaries: OwnedSavedSessionSummary[],
  resume: (resumeRef: string) => Promise<unknown>,
): Promise<OwnedSavedSessionDetail | null> {
  const summary = summaries.find((item) => item.saved_session_id === sessionId);
  if (!summary || !summary.resume_available) return null;
  const resumable = oneRecord(await resume(summary.resume_ref));
  if (!resumable) return null;
  return {
    id: sessionId,
    hub: summary.hub,
    session_type: summary.session_type,
    schema_key: summary.schema_key,
    schema_version: summary.schema_version,
    payload: resumable.payload as Record<string, unknown>,
    summary: summary.summary,
    status: summary.status,
    resume_ref: summary.resume_ref,
    row_version: Number(resumable.row_version),
    created_at: summary.last_activity_at,
    updated_at: summary.last_activity_at,
    last_resumed_at: null,
  };
}

export function savedSessionPageModel(
  input: { absent: true; session: null } | { absent: false; session: OwnedSavedSessionDetail | null },
): SavedSessionPageModel {
  if (input.absent) return { kind: "resume-unavailable", httpStatus: 200, copy: RESUME_UNAVAILABLE_COPY };
  if (!input.session) return { kind: "not-found", httpStatus: 404 };
  return { kind: "ready", httpStatus: 200, session: input.session };
}
