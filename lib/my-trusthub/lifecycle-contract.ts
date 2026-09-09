import type { TrustHub } from "./contracts";
import type { AlertSeverity, AlertReadState } from "./alert-contract";
import type { SavedSessionType, SessionStatus } from "./session-contract";
import type { WatchStatus } from "./cross-hub-contract";

export const RESEARCH_SNAPSHOT_VERSION = "mytrusthub-research-snapshot/v1" as const;
export const MY_TRUSTHUB_EXPORT_VERSION = "mytrusthub-export/v1" as const;
export const EXPORT_ARTIFACT_TTL_DAYS = 7 as const;
export const WORKSPACE_DELETION_GRACE_DAYS = 7 as const;
export const OPERATIONAL_AUDIT_RETENTION_DAYS = 30 as const;

export type DecisionType =
  | "selected_provider"
  | "still_deciding"
  | "not_proceeding"
  | "completed_without_provider"
  | "other";

export type DecisionCategory =
  | "lender"
  | "insurance"
  | "contractor"
  | "move"
  | "senior"
  | "investor"
  | "other";

export type ProjectLifecycleState = "active" | "completed" | "archived";
export type ResearchSnapshotVersion = typeof RESEARCH_SNAPSHOT_VERSION;

export interface DecisionEntitySelection {
  savedRef: string;
  category: DecisionCategory;
  selectedAt: string;
}

export interface ProjectDecision {
  decisionRef: string;
  projectRef: string;
  decisionType: DecisionType;
  privateNote: string | null;
  selections: DecisionEntitySelection[];
  recordedAt: string;
  supersededAt: string | null;
  rowVersion: number;
}

export interface SnapshotEntityReference {
  savedRef: string;
  networkEntityRefAtSnapshot: string;
  canonicalNameAtSnapshot: string;
  identityResolutionState: "accepted" | "review_required";
}

export interface SnapshotWatchReference {
  watchRef: string;
  savedRef: string;
  status: WatchStatus;
  coverage: Array<{
    capabilityRef: string;
    capabilityKey: string;
    capabilityVersion: number;
    sourceKey: string;
    grainKey: string;
  }>;
}

export interface SnapshotAlertReference {
  alertRef: string;
  changeEventRef: string;
  severity: AlertSeverity;
  readState: AlertReadState;
  eventStateAtSnapshot: "active" | "suppressed" | "quarantined" | "retracted";
  officialAsOf: string | null;
  observedAt: string;
}

export interface SnapshotSessionReference {
  sessionRef: string;
  hub: TrustHub;
  sessionType: SavedSessionType;
  schemaKey: string;
  schemaVersion: number;
  status: SessionStatus;
  summary: Record<string, string | number | boolean | null>;
}

export interface ResearchSnapshot {
  snapshotRef: string;
  projectRef: string;
  decisionRef: string | null;
  snapshotVersion: ResearchSnapshotVersion;
  fingerprint: string;
  createdAt: string;
  entities: SnapshotEntityReference[];
  watches: SnapshotWatchReference[];
  alerts: SnapshotAlertReference[];
  sessions: SnapshotSessionReference[];
  disclosure: string;
}

export type ExportStatus = "queued" | "processing" | "completed" | "failed" | "expired" | "cancelled";

export interface ExportRequest {
  idempotencyKey: string;
}

export interface ExportManifest {
  version: typeof MY_TRUSTHUB_EXPORT_VERSION;
  exportRef: string;
  requestedAt: string;
  sections: string[];
  artifactHash: string | null;
  expiresAt: string | null;
}

export interface ExportJobStatus {
  exportRef: string;
  version: typeof MY_TRUSTHUB_EXPORT_VERSION;
  status: ExportStatus;
  requestedAt: string;
  completedAt: string | null;
  expiresAt: string | null;
  artifactAvailable: boolean;
}

export type DeletionStatus = "requested" | "grace_period" | "processing" | "completed" | "failed" | "cancelled";

export interface DeletionRequest {
  confirmationCode: string;
  idempotencyKey: string;
}

export interface DeletionJobStatus {
  deletionRef: string;
  status: DeletionStatus;
  requestedAt: string;
  graceExpiresAt: string | null;
  completedAt: string | null;
}

export interface RecordDecisionRequest {
  projectRef: string;
  decisionType: DecisionType;
  privateNote?: string;
  selections: Array<Pick<DecisionEntitySelection, "savedRef" | "category">>;
  idempotencyKey: string;
}

export interface PrivateSpecialistDecisionContext {
  projectRef: string;
  savedRef: string;
  selected: boolean;
  label: "Selected for this Project" | null;
  decisionType: DecisionType | null;
  category: DecisionCategory | null;
  recordedAt: string | null;
}

export interface MyTrustHubLifecycleService {
  recordDecision(request: RecordDecisionRequest): Promise<{ decisionRef: string; snapshotRef: string; created: boolean }>;
  listDecisions(projectRef: string): Promise<ProjectDecision[]>;
  getDecision(decisionRef: string): Promise<ProjectDecision>;
  getResearchSnapshot(snapshotRef: string): Promise<ResearchSnapshot>;
  completeProject(projectRef: string, decisionRef: string, expectedRowVersion: number, idempotencyKey: string): Promise<number>;
  reopenProject(projectRef: string, expectedRowVersion: number, idempotencyKey: string): Promise<number>;
  requestExport(request: ExportRequest): Promise<ExportJobStatus>;
  getExportStatus(exportRef: string): Promise<ExportJobStatus>;
  requestWorkspaceDeletion(request: DeletionRequest): Promise<DeletionJobStatus>;
  cancelWorkspaceDeletion(deletionRef: string): Promise<DeletionJobStatus>;
  getWorkspaceDeletionStatus(deletionRef: string): Promise<DeletionJobStatus>;
}
