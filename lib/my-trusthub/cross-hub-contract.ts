import hubRegistry from "./hub-registry.json";
import type { EntityAlertState } from "./alert-contract";
import type { CoverageSourceHealth, SourceHealthStatus, WatchHealth } from "./monitoring-contract";
import type { ResumeSession, SaveSessionRequest, SavedSession, UpdateSessionRequest } from "./session-contract";
import type { PrivateSpecialistDecisionContext } from "./lifecycle-contract";

export const MY_TRUSTHUB_API_VERSION = "v1" as const;
export const MY_TRUSTHUB_API_PREFIX = "/v1/my" as const;
export const CROSS_HUB_BATCH_LIMIT = 50 as const;
export const HANDOFF_TTL_SECONDS = 90 as const;

export const CROSS_HUB_ERROR_CODES = [
  "AUTH_REQUIRED",
  "IDENTITY_LINK_REQUIRED",
  "HANDOFF_EXPIRED",
  "HANDOFF_ALREADY_USED",
  "INVALID_AUDIENCE",
  "INVALID_STATE",
  "RETURN_NOT_ALLOWED",
  "ENTITY_UNRESOLVED",
  "ENTITY_REVIEW_REQUIRED",
  "SAVE_CONFLICT",
  "PROJECT_MEMBERSHIP_CONFLICT",
  "WATCH_NOT_FOUND",
  "WATCH_ALREADY_EXISTS",
  "WATCH_RESTART_REQUIRED",
  "WATCH_STATE_CONFLICT",
  "WATCH_STALE",
  "CAPABILITY_NOT_ELIGIBLE",
  "COVERAGE_REQUIRED",
  "SESSION_NOT_FOUND",
  "SESSION_SCHEMA_UNSUPPORTED",
  "SESSION_NOT_RESUMABLE",
  "SESSION_STALE",
  "SESSION_PROJECT_MEMBERSHIP_CONFLICT",
  "RATE_LIMITED",
] as const;

export type CrossHubErrorCode = (typeof CROSS_HUB_ERROR_CODES)[number];
export type CrossHubEnvironment = "production" | "staging" | "development";
export type CrossHubKey = (typeof hubRegistry.hubs)[number]["key"];

export interface CanonicalUserAuthorization {
  /** Opaque, short-lived server assertion. Never a canonical UUID in a URL. */
  assertion: string;
  audience: string;
  expiresAt: string;
}

export interface SpecialistBffAuthorization {
  serviceIdentity: string;
  hub: CrossHubKey;
  scope: "entity:read" | "saved:write" | "project:read" | "project:write" | "watch:read" | "watch:write" | "alert:read" | "session:read" | "session:write" | "decision:read" | "handoff:issue" | "handoff:consume";
  user: CanonicalUserAuthorization;
}

export interface EntityStateResponse {
  networkEntityRef: string;
  canonicalDisplayRef: string | null;
  saved: boolean;
  savedRef: string | null;
  identityState: "accepted" | "review_required" | null;
  projects: Array<{
    projectRef: string;
    name: string;
    status: "active" | "completed" | "archived";
  }>;
  watch: WatchState | null;
  availableCapabilityCount: number;
  alerts: EntityAlertState | null;
}

export type WatchStatus = "active" | "paused" | "stopped";
export type WatchCoverageStatus = "enabled" | "paused_by_capability" | "disabled" | "retired";

export interface WatchCapability {
  capabilityRef: string;
  capabilityKey: string;
  version: number;
  displayName: string;
  consumerDescription: string;
  source: string;
  grain: string;
  coverageNotes: string | null;
  coverageLimitations: string[];
  freshnessExpectationSeconds: number;
  sourceCheckStatus: "not_available";
}

export interface AvailableCapability extends WatchCapability {
  eligible: boolean;
  unavailableReason: string | null;
}

export interface WatchCoverage {
  coverageRef: string;
  capability: WatchCapability;
  status: WatchCoverageStatus;
  disabledReason: string | null;
  sourceHealth?: CoverageSourceHealth | null;
}

export interface WatchState {
  watchRef: string;
  savedRef: string;
  status: WatchStatus;
  rowVersion: number;
  resumePolicy: "next_accepted_observation";
  coverage: WatchCoverage[];
  enabledCoverageCount: number;
  limitedCoverage: boolean;
  sourceCheckStatus: "not_available" | SourceHealthStatus;
  sourceHealth?: WatchHealth | null;
}

export interface StartWatchRequest {
  savedRef: string;
  selectedCapabilityRefs: string[];
  idempotencyKey: string;
}

export interface ModifyCoverageRequest {
  watchRef: string;
  capabilityRef: string;
  expectedRowVersion: number;
  idempotencyKey: string;
}

export interface SaveFromSpecialistRequest {
  bindingRef: string;
  sourceHub: CrossHubKey;
  idempotencyKey: string;
  /** Server-held context reference returned after context consumption. */
  contextRef?: string;
}

export interface ProjectSummary {
  projectRef: string;
  name: string;
  status: "active" | "completed" | "archived";
  lifeEventType: string;
}

export interface MyTrustHubCrossHubApi {
  getEntityState(auth: SpecialistBffAuthorization, networkEntityRef: string): Promise<EntityStateResponse>;
  getEntityStates(auth: SpecialistBffAuthorization, networkEntityRefs: string[]): Promise<EntityStateResponse[]>;
  save(auth: SpecialistBffAuthorization, request: SaveFromSpecialistRequest): Promise<EntityStateResponse>;
  unsave(auth: SpecialistBffAuthorization, savedRef: string, expectedVersion: number): Promise<void>;
  listProjectSummaries(auth: SpecialistBffAuthorization): Promise<ProjectSummary[]>;
  addProjectMembership(auth: SpecialistBffAuthorization, savedRef: string, projectRef: string): Promise<void>;
  removeProjectMembership(auth: SpecialistBffAuthorization, savedRef: string, projectRef: string): Promise<void>;
  getAvailableWatchCapabilities(auth: SpecialistBffAuthorization, savedRef: string): Promise<AvailableCapability[]>;
  getWatch(auth: SpecialistBffAuthorization, savedRef: string): Promise<WatchState | null>;
  getWatchSourceHealth(auth: SpecialistBffAuthorization, savedRef: string): Promise<WatchHealth | null>;
  getEntityAlertState(auth: SpecialistBffAuthorization, networkEntityRef: string): Promise<EntityAlertState | null>;
  startWatch(auth: SpecialistBffAuthorization, request: StartWatchRequest): Promise<WatchState>;
  pauseWatch(auth: SpecialistBffAuthorization, watchRef: string, expectedRowVersion: number, idempotencyKey: string): Promise<WatchState>;
  resumeWatch(auth: SpecialistBffAuthorization, watchRef: string, expectedRowVersion: number, idempotencyKey: string): Promise<WatchState>;
  stopWatch(auth: SpecialistBffAuthorization, watchRef: string, expectedRowVersion: number, idempotencyKey: string): Promise<WatchState>;
  restartWatch(auth: SpecialistBffAuthorization, request: StartWatchRequest & { watchRef: string; expectedRowVersion: number }): Promise<WatchState>;
  addWatchCoverage(auth: SpecialistBffAuthorization, request: ModifyCoverageRequest): Promise<WatchState>;
  removeWatchCoverage(auth: SpecialistBffAuthorization, request: ModifyCoverageRequest): Promise<WatchState>;
  saveSession(auth: SpecialistBffAuthorization, request: SaveSessionRequest): Promise<SavedSession>;
  updateSession(auth: SpecialistBffAuthorization, request: UpdateSessionRequest): Promise<SavedSession>;
  getSessionForResume(auth: SpecialistBffAuthorization, resumeRef: string): Promise<ResumeSession>;
  addSessionProjectMembership(auth: SpecialistBffAuthorization, sessionRef: string, projectRef: string, idempotencyKey: string): Promise<void>;
  removeSessionProjectMembership(auth: SpecialistBffAuthorization, sessionRef: string, projectRef: string, idempotencyKey: string): Promise<void>;
  getPrivateDecisionContext(auth: SpecialistBffAuthorization, projectRef: string, savedRef: string): Promise<PrivateSpecialistDecisionContext | null>;
}

export const CROSS_HUB_ENDPOINTS = Object.freeze({
  entityState: "/v1/my/entities/:networkEntityId/state",
  entityStateBatch: "/v1/my/entities/state:batch",
  saved: "/v1/my/saved",
  savedItem: "/v1/my/saved/:savedId",
  projectSummaries: "/v1/my/projects:summaries",
  membership: "/v1/my/project-memberships",
  projects: "/v1/my/projects",
  watchCapabilities: "/v1/my/saved/:savedId/watch-capabilities",
  watch: "/v1/my/saved/:savedId/watch",
  watchSourceHealth: "/v1/my/saved/:savedId/watch/source-health",
  entityAlertState: "/v1/my/entities/:networkEntityId/alerts:state",
  watchItem: "/v1/my/watches/:watchId",
  watchCoverage: "/v1/my/watches/:watchId/coverage",
  sessions: "/v1/my/sessions",
  sessionItem: "/v1/my/sessions/:sessionRef",
  sessionSummaries: "/v1/my/sessions:summaries",
  sessionMembership: "/v1/my/session-memberships",
  sessionResumePrepare: "/v1/my/sessions/:sessionRef/resume:prepare",
  sessionResumeConsume: "/v1/my/sessions/resume:consume",
  guestSessionPreview: "/v1/my/guest-sessions:preview",
  guestSessionCommit: "/v1/my/guest-sessions:commit",
  decisions: "/v1/my/projects/:projectRef/decisions",
  researchSnapshot: "/v1/my/research-snapshots/:snapshotRef",
  projectComplete: "/v1/my/projects/:projectRef/complete",
  projectReopen: "/v1/my/projects/:projectRef/reopen",
  specialistDecisionContext: "/v1/my/projects/:projectRef/entities/:savedRef/decision-context",
  exports: "/v1/my/exports",
  exportStatus: "/v1/my/exports/:exportRef",
  workspaceDeletion: "/v1/my/workspace-deletion",
  workspaceDeletionStatus: "/v1/my/workspace-deletion/:deletionRef",
  authPrepare: "/v1/my/handoffs/auth:prepare",
  authIssue: "/v1/my/handoffs/auth:issue",
  authConsume: "/v1/my/handoffs/auth:consume",
  contextPrepare: "/v1/my/handoffs/context:prepare",
  contextIssue: "/v1/my/handoffs/context:issue",
  contextConsume: "/v1/my/handoffs/context:consume",
});
