import type { SourceHealthStatus } from "./monitoring-contract";

export type AlertSeverity = "P0" | "P1" | "P2";
export type AlertReadState = "unread" | "read";
export type AlertEventState = "active" | "retracted";
export type CoverageCheckState =
  | "no_change"
  | "material_change"
  | "delayed"
  | "degraded"
  | "unknown"
  | "baseline_only";
export type WatchSummaryState =
  | "current_no_change"
  | "needs_attention"
  | "delayed"
  | "degraded"
  | "unknown"
  | "baseline_only";

export interface AlertProjectContext {
  projectRef: string;
  name: string;
  status: "active" | "completed" | "archived";
  currentStatus: "active" | "completed" | "archived";
}

export interface ConsumerAlert {
  alertRef: string;
  severity: AlertSeverity;
  readState: AlertReadState;
  headline: string;
  hub: "move" | "lender" | "insurance" | "contractor" | "senior" | "investor";
  entityName: string;
  officialAsOf: string | null;
  observedAt: string;
  surfacedAt: string;
  sourceOrganization: string;
  projectContext: AlertProjectContext[];
  eventState: AlertEventState;
  rowVersion: number;
}

export interface AlertDetail extends ConsumerAlert {
  identifier: string | null;
  whatChanged: string;
  detailBody: string;
  checkedAt: string | null;
  sourceConfirmationRef: string | null;
  coverageRef: string;
  capabilityRef: string;
  capabilityVersion: number;
  watchedGrain: string;
  coverageDisplayName: string;
  whyReceived: "You asked My TrustHub to Watch supported public-record changes for this record.";
  disclosure: "Extracts can lag. This is not a TrustHub verdict." | string;
  correctionNotice: string | null;
  previousValue: Record<string, unknown> | null;
  currentValue: Record<string, unknown> | null;
  retractionReason: string | null;
}

export interface CoverageWatchCheck {
  coverageRef: string;
  capabilityRef: string;
  capabilityKey: string;
  capabilityVersion: number;
  coverageDisplayName: string;
  sourceOrganization: string;
  health: SourceHealthStatus;
  lastSuccessfulCheck: string | null;
  sourceAsOf: string | null;
  state: CoverageCheckState;
  alertCount: number;
  unreadAlertCount: number;
  coverageDisclosure: "No material change detected applies only to the public records included in this Watch coverage." | string;
}

export interface WatchCheckState {
  savedRef: string;
  summary: WatchSummaryState;
  health: SourceHealthStatus;
  alertCount: number;
  unreadAlertCount: number;
  allEnabledCoverageNoChange: boolean;
  coverage: CoverageWatchCheck[];
}

export type WatchObservationHistoryType =
  | "started"
  | "paused"
  | "resumed"
  | "stopped"
  | "coverage_added"
  | "coverage_removed"
  | "capability_retired"
  | "source_checked_no_change"
  | "material_change_surfaced"
  | "source_correction";

export interface WatchObservationHistoryEntry {
  occurredAt: string;
  type: WatchObservationHistoryType;
  title: string;
  capabilityKey: string | null;
  sourceOrganization: string | null;
  alertRef: string | null;
  eventState: AlertEventState | null;
}

export interface EntityAlertState {
  hasUnreadAlert: boolean;
  alertCount: number;
  latestSeverity: AlertSeverity | null;
  latestEventState: AlertEventState | null;
  latestHeadline: string | null;
  latestAlertRef: string | null;
  latestObservedAt: string | null;
}

export interface AlertsOverview {
  totalAlerts: number;
  unreadAlerts: number;
  unreadBySeverity: Record<AlertSeverity, number>;
  allRead: boolean;
  hasMonitoringHealthIssue: boolean;
}

export interface AlertListRequest {
  severity?: AlertSeverity;
  unreadOnly?: boolean;
  limit?: number;
  before?: string;
}

export interface SetAlertReadStateRequest {
  alertRef: string;
  read: boolean;
  expectedRowVersion: number;
}

export interface MyTrustHubAlertsApi {
  listAlerts(request?: AlertListRequest): Promise<ConsumerAlert[]>;
  getAlertDetail(alertRef: string): Promise<AlertDetail>;
  setAlertReadState(request: SetAlertReadStateRequest): Promise<number>;
  markAllAlertsRead(): Promise<number>;
  getAlertsOverview(): Promise<AlertsOverview>;
  getWatchChecks(savedRef: string): Promise<WatchCheckState>;
  getWatchObservationHistory(savedRef: string, limit?: number): Promise<WatchObservationHistoryEntry[]>;
}
