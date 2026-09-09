import type { AlertSeverity } from "./alert-contract";

export type DeliveryChannel = "email" | "in_app";
export type DeliveryStatus =
  | "pending"
  | "processing"
  | "delivered"
  | "failed"
  | "suppressed"
  | "cancelled";
export type DeliveryType =
  | "p0_immediate"
  | "p1_digest"
  | "p2_digest"
  | "watch_summary"
  | "correction";
export type DeliveryFailureClass =
  | "transient"
  | "permanent"
  | "suppressed"
  | "invalid_destination"
  | "provider_error"
  | "rate_limited";

export interface NotificationPreferences {
  p0EmailEnabled: boolean;
  p1DigestEnabled: boolean;
  p2DigestEnabled: boolean;
  periodicWatchSummaryEnabled: boolean;
  /** Consumer-selected IANA timezone; UTC is the fallback. */
  timezone: string;
  digestTimeLocal: string;
  rowVersion: number;
}

export interface WatchNotificationOverride {
  watchRef: string;
  channel: "email";
  severity: AlertSeverity;
  enabled: boolean;
  rowVersion: number;
}

export interface AlertDelivery {
  deliveryRef: string;
  alertRef: string;
  channel: "email";
  deliveryType: DeliveryType;
  templateKey: string;
  templateVersion: number;
  status: DeliveryStatus;
  attemptCount: number;
  nextAttemptAt: string | null;
  deliveredAt: string | null;
  failureClass: DeliveryFailureClass | null;
}

export interface P0EmailPayload {
  product: "My TrustHub";
  subject: string;
  body: string;
  entityName: string;
  hub: "move" | "lender" | "insurance" | "contractor" | "senior" | "investor";
  whatChanged: string;
  officialAsOf: string | null;
  observedAt: string;
  source: string;
  sourceConfirmationRef: string | null;
  projectContext: unknown;
  whyReceived: string;
  watchedGrain: string;
  coverageDisplayName: string;
  disclosure: string;
  manageNotificationsPath: "/my/notifications";
}

export interface DigestEligibility {
  alertRef: string;
  severity: "P1" | "P2";
  localDigestDate: string;
  headline: string;
  entityName: string;
  sourceOrganization: string;
  sourceConfirmationRef: string | null;
  officialAsOf: string | null;
}

export interface WatchSummaryEligibility {
  eligible: boolean;
  activeWatchCount: number;
  materialAlertCount: number;
  healthyNoChangeCoverageCount: number;
  delayedCoverageCount: number;
  degradedCoverageCount: number;
  unknownCoverageCount: number;
}

export interface UpdateNotificationPreferencesRequest
  extends Omit<NotificationPreferences, "rowVersion"> {
  expectedRowVersion: number;
  idempotencyKey: string;
}

export interface SetWatchNotificationOverrideRequest {
  watchRef: string;
  severity: AlertSeverity;
  enabled: boolean;
  idempotencyKey: string;
}

export interface NotificationTransportResult {
  outcome:
    | "success"
    | "transient_failure"
    | "permanent_failure"
    | "invalid_destination"
    | "provider_error"
    | "rate_limited";
  providerMessageRef?: string;
}

export interface NotificationTransport {
  readonly mode: "mock" | "sandbox" | "production";
  sendTransactionalEmail(
    payload: P0EmailPayload,
    /** Stable logical key must be forwarded to providers that support idempotency. */
    idempotencyKey: string,
  ): Promise<NotificationTransportResult>;
}

export function createDeterministicMockTransport(
  outcome: NotificationTransportResult["outcome"] = "success",
): NotificationTransport {
  return {
    mode: "mock",
    async sendTransactionalEmail(_payload, idempotencyKey) {
      return {
        outcome,
        providerMessageRef:
          outcome === "success" ? `mock:p17:${idempotencyKey}` : undefined,
      };
    },
  };
}

export interface MyTrustHubNotificationApi {
  getPreferences(): Promise<NotificationPreferences>;
  updatePreferences(request: UpdateNotificationPreferencesRequest): Promise<number>;
  getWatchOverrides(watchRef: string): Promise<WatchNotificationOverride[]>;
  setWatchOverride(request: SetWatchNotificationOverrideRequest): Promise<number>;
  removeWatchOverride(
    watchRef: string,
    severity: AlertSeverity,
    idempotencyKey: string,
  ): Promise<void>;
  getDigestEligibility(localDate?: string): Promise<DigestEligibility[]>;
  getWatchSummaryEligibility(): Promise<WatchSummaryEligibility>;
}

export const NOTIFICATION_SETTINGS_ENDPOINTS = Object.freeze({
  preferences: "/v1/my/notification-preferences",
  watchOverrides: "/v1/my/watches/:watchId/notification-overrides",
  digestEligibility: "/v1/my/notifications/digest:eligibility",
  watchSummaryEligibility: "/v1/my/notifications/watch-summary:eligibility",
  manageNotifications: "/my/notifications",
});
