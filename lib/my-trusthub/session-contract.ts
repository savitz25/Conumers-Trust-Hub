import type { TrustHub } from "./contracts";

export const GUEST_SESSION_PAYLOAD_VERSION = "mytrusthub-guest-sessions/v1" as const;
export const GUEST_SESSION_MAX_BYTES = 256 * 1024;
export const DEFAULT_SESSION_MAX_BYTES = 64 * 1024;

export type SavedSessionType =
  | "comparison"
  | "calculator"
  | "plan"
  | "worksheet"
  | "inventory";

export type SessionStatus = "active" | "archived" | "read_only" | "invalidated";
export type SessionSchemaStatus = "draft" | "approved" | "deprecated" | "retired";
export type SessionDataClassification =
  | "non_sensitive"
  | "restricted_financial"
  | "restricted_household";

export type SessionExportPolicy = "full" | "redacted" | "summary_only";

export interface SessionSchema {
  schemaKey: string;
  version: number;
  hub: TrustHub;
  sessionType: SavedSessionType;
  status: SessionSchemaStatus;
  maxPayloadBytes: number;
  summaryVersion: number;
  resumeKind: SavedSessionType;
  resumeRouteKey: string;
  dataClassification: SessionDataClassification;
  exportPolicy: SessionExportPolicy;
  exportRedactedKeys: string[];
}

export type SessionSummaryValue = string | number | boolean | null;
export type SessionSummary = Record<string, SessionSummaryValue>;

export interface SessionProjectMembership {
  projectRef: string;
  name: string;
  status: "active" | "completed" | "archived";
}

export interface SavedSession {
  sessionRef: string;
  hub: TrustHub;
  sessionType: SavedSessionType;
  schemaKey: string;
  schemaVersion: number;
  summary: SessionSummary;
  status: SessionStatus;
  schemaStatus: SessionSchemaStatus;
  projectMemberships: SessionProjectMembership[];
  lastActivityAt: string;
  resumeAvailable: boolean;
  /** Opaque control-plane reference. It is never placed directly in a browser URL. */
  resumeRef: string;
  rowVersion: number;
}

export interface SaveSessionRequest {
  hub: TrustHub;
  sessionType: SavedSessionType;
  schemaKey: string;
  schemaVersion: number;
  payload: Record<string, unknown>;
  summary: SessionSummary;
  projectRef?: string;
  idempotencyKey: string;
}

export interface UpdateSessionRequest {
  sessionRef: string;
  schemaKey: string;
  schemaVersion: number;
  payload: Record<string, unknown>;
  summary: SessionSummary;
  expectedRowVersion: number;
  idempotencyKey: string;
}

export interface ResumeSession {
  sessionRef: string;
  hub: TrustHub;
  sessionType: SavedSessionType;
  schemaKey: string;
  schemaVersion: number;
  payload: Record<string, unknown>;
  summary: SessionSummary;
  resumeKind: SavedSessionType;
  resumeRouteKey: string;
  rowVersion: number;
}

export interface GuestSessionItem {
  clientItemId: string;
  itemType: "saved_session";
  guestSessionKey: string;
  hub: TrustHub;
  sessionType: SavedSessionType;
  schemaKey: string;
  schemaVersion: number;
  payload: Record<string, unknown>;
  summary: SessionSummary;
  createdAt: string;
}

export interface GuestSessionPayload {
  version: typeof GUEST_SESSION_PAYLOAD_VERSION;
  generatedAt: string;
  expiresAt: string;
  items: GuestSessionItem[];
}

export type GuestSessionPreviewStatus =
  | "valid"
  | "duplicate"
  | "unsupported_version"
  | "expired"
  | "invalid"
  | "oversized";

export interface GuestSessionPreviewItem {
  clientItemId: string;
  status: GuestSessionPreviewStatus;
  valid: boolean;
  importable: boolean;
  existingSessionRef: string | null;
  projectAssignmentEligible: boolean;
}

export interface CommitGuestSessionImportRequest {
  payload: GuestSessionPayload;
  selectedItemIds: string[];
  projectRef?: string;
  idempotencyKey: string;
}

export interface SessionResumeHandoff {
  /** Short-lived opaque code. The URL contains no session ID or payload. */
  code: string;
  targetHub: TrustHub;
  returnPath: string;
  expiresAt: string;
}

export interface MyTrustHubSessionService {
  saveSession(request: SaveSessionRequest): Promise<SavedSession>;
  updateSession(request: UpdateSessionRequest): Promise<SavedSession>;
  archiveSession(sessionRef: string, expectedRowVersion: number, idempotencyKey: string): Promise<SavedSession>;
  restoreSession(sessionRef: string, expectedRowVersion: number, idempotencyKey: string): Promise<SavedSession>;
  listSessionSummaries(limit?: number): Promise<SavedSession[]>;
  listContinueSessions(limit?: number): Promise<SavedSession[]>;
  addSessionProjectMembership(sessionRef: string, projectRef: string, idempotencyKey: string): Promise<void>;
  removeSessionProjectMembership(sessionRef: string, projectRef: string, idempotencyKey: string): Promise<void>;
  createResumeHandoff(sessionRef: string): Promise<SessionResumeHandoff>;
  getSessionForResume(resumeRef: string): Promise<ResumeSession>;
  previewGuestSessions(payload: GuestSessionPayload): Promise<GuestSessionPreviewItem[]>;
  commitGuestSessions(request: CommitGuestSessionImportRequest): Promise<{
    importRef: string;
    submitted: number;
    imported: number;
    duplicates: number;
    rejected: number;
  }>;
}
