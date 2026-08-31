import { createHmac } from 'node:crypto';

export const MONITORING_CHANGE_TYPES = [
  'LICENSE_STATUS_CHANGED','LICENSE_EXPIRATION_CHANGED','OFFICIAL_ADDRESS_CHANGED',
  'BUSINESS_IDENTITY_CHANGED','DISCIPLINE_ADDED','DISCIPLINE_UPDATED','SOURCE_RECORD_CORRECTED',
] as const;
export type MonitoringChangeType = typeof MONITORING_CHANGE_TYPES[number];

export type ContractorMonitoringEvent = {
  sequence_id: string; id: string; native_profile_id: string; source_system: string;
  source_dataset: string; source_record_id: string; change_type: MonitoringChangeType;
  prior_state: unknown; current_state: unknown; source_effective_at: string | null;
  detected_at: string; fingerprint_sha256: string; provenance: unknown;
};

export class MonitoringError extends Error {
  readonly code: 'validation_failed'|'stale_version'|'not_found'|'forbidden';
  constructor(code: 'validation_failed'|'stale_version'|'not_found'|'forbidden') { super(code); this.code=code; }
}

export function validateMonitoringSettings(body: unknown) {
  if (!body || typeof body !== 'object') throw new MonitoringError('validation_failed');
  const value = body as Record<string, unknown>;
  if (typeof value.enabled !== 'boolean' || typeof value.emailEnabled !== 'boolean' ||
      typeof value.inAppEnabled !== 'boolean' || !Number.isInteger(value.version) || Number(value.version) < 0) {
    throw new MonitoringError('validation_failed');
  }
  if (value.enabled && !value.emailEnabled && !value.inAppEnabled) throw new MonitoringError('validation_failed');
  return { enabled: value.enabled, emailEnabled: value.emailEnabled, inAppEnabled: value.inAppEnabled, version: Number(value.version) };
}

const PURPOSE = 'ath-monitoring-feed-v1';
export function monitoringRequestSignature(secret: string, timestamp: string, method: string, path: string): string {
  const key = createHmac('sha256', secret).update(PURPOSE).digest();
  return createHmac('sha256', key).update(`${PURPOSE}\n${timestamp}\n${method.toUpperCase()}\n${path}`).digest('hex');
}

export function monitoringSummary(changeType: string, current: unknown): { title: string; summary: string } {
  const state = current && typeof current === 'object' ? current as Record<string, unknown> : {};
  const labels: Record<string, string> = {
    LICENSE_STATUS_CHANGED: 'Official license status changed',
    LICENSE_EXPIRATION_CHANGED: 'Official license expiration changed',
    OFFICIAL_ADDRESS_CHANGED: 'Official address changed',
    BUSINESS_IDENTITY_CHANGED: 'Official business identity changed',
    DISCIPLINE_ADDED: 'A regulatory record was added',
    DISCIPLINE_UPDATED: 'A regulatory record was updated',
    SOURCE_RECORD_CORRECTED: 'An official source record was corrected',
  };
  const title = labels[changeType] || 'Official record changed';
  const summary = changeType === 'LICENSE_STATUS_CHANGED' && state.normalized
    ? `Florida DBPR now reports license status ${String(state.normalized)}.`
    : 'AskTrustHub detected a material change in a Florida DBPR public record connected to this profile.';
  return { title, summary };
}

export function isValidContractorEvent(value: unknown): value is ContractorMonitoringEvent {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return /^\d+$/.test(String(v.sequence_id)) && /^[0-9a-f-]{36}$/i.test(String(v.native_profile_id)) &&
    v.source_system === 'fl_dbpr' && MONITORING_CHANGE_TYPES.includes(v.change_type as MonitoringChangeType) &&
    /^[0-9a-f]{64}$/.test(String(v.fingerprint_sha256)) && !Number.isNaN(Date.parse(String(v.detected_at)));
}
