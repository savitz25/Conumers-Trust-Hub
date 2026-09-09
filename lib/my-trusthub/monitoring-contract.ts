export type SourceHealthStatus = "current" | "delayed" | "degraded" | "unknown";
export type CompletenessStatus = "complete" | "partial" | "failed" | "unknown";
export type SchemaStatus = "compatible" | "changed" | "invalid" | "unknown";
export type ObservationStatus = "candidate" | "accepted" | "quarantined" | "superseded" | "rejected";
export type ChangeEvaluationStatus =
  | "pending"
  | "baseline"
  | "no_change"
  | "event_created"
  | "classifier_missing"
  | "late_historical"
  | "quarantined"
  | "rejected";
export type EventSeverity = "P0" | "P1" | "P2";
export type ChangeEventStatus = "active" | "suppressed" | "quarantined" | "retracted";

export interface SourceClockSet {
  sourceAsOf: string | null;
  publishedAt: string | null;
  retrievedAt: string;
  observedAt: string | null;
  snapshotAsOf: string | null;
  generatedAt: string | null;
}

/** Server-side normalized envelope; raw regulator artifacts stay hub-owned. */
export interface SourceObservation {
  observationRef: string;
  originalNetworkEntityRef: string;
  canonicalNetworkEntityRef: string;
  capabilityRef: string;
  capabilityVersion: number;
  source: string;
  grain: string;
  sourceRecordKey: string | null;
  normalizedValue: Record<string, unknown>;
  materialFingerprint: string;
  status: ObservationStatus;
  evaluation: ChangeEvaluationStatus;
  checkpointRef: string;
  provenanceRef: string;
  schemaVersion: string;
  clocks: SourceClockSet;
}

export interface SourceCheckpoint {
  checkpointRef: string;
  capabilityRef: string;
  capabilityVersion: number;
  source: string;
  jurisdiction: string;
  runRef: string;
  health: SourceHealthStatus;
  completeness: CompletenessStatus;
  schema: SchemaStatus;
  lastSuccessfulCheck: string | null;
  sourceAsOf: string | null;
  massChangeDetected: boolean;
}

export interface ChangeEvent {
  changeEventRef: string;
  canonicalNetworkEntityRef: string;
  capabilityRef: string;
  capabilityVersion: number;
  previousObservationRef: string;
  newObservationRef: string;
  checkpointRef: string;
  eventType: string;
  severity: EventSeverity;
  severityRuleVersion: number;
  sourceAsOf: string | null;
  observedAt: string;
  status: ChangeEventStatus;
}

export interface CoverageSourceHealth {
  coverageRef: string;
  capabilityKey: string;
  capabilityVersion: number;
  source: string;
  health: SourceHealthStatus;
  completeness: CompletenessStatus;
  schema: SchemaStatus;
  lastSuccessfulCheck: string | null;
  sourceAsOf: string | null;
  noChangeEligible: boolean;
}

export interface WatchHealth {
  status: SourceHealthStatus;
  coverage: CoverageSourceHealth[];
  /** True only after a current, complete, compatible check with an unchanged accepted observation. */
  noChangeEligible: boolean;
}

/** Unknown is worst because the control plane cannot make a reliable determination. */
export const SOURCE_HEALTH_ORDER: Readonly<Record<SourceHealthStatus, number>> = Object.freeze({
  current: 0,
  delayed: 1,
  degraded: 2,
  unknown: 3,
});
