export const SPECIALIST_METRIC_REVALIDATE_SECONDS = 3600;

export type SpecialistHubId = 'contractor' | 'senior';

export type SpecialistSourceConfig = {
  hub: SpecialistHubId;
  schemaVersion: string;
  /** Canonical public publication URL. Presentation code must not hardcode this. */
  publicationUrl: string;
  fallbackRelPath: string;
  timeoutMs: number;
};

/**
 * Central specialist metric source configuration.
 * Swap publicationUrl to a specialist-domain well-known/API later without touching cards.
 */
export const SPECIALIST_SOURCES: Record<SpecialistHubId, SpecialistSourceConfig> = {
  contractor: {
    hub: 'contractor',
    schemaVersion: 'contractor-network-metrics-v1',
    publicationUrl:
      'https://raw.githubusercontent.com/savitz25/contractor-trust-hub/main/data/home/contractor-network-metrics-v1.json',
    fallbackRelPath: 'data/network-metrics/contractor-v1-fallback.json',
    timeoutMs: 4000,
  },
  senior: {
    hub: 'senior',
    schemaVersion: 'senior-network-metrics-v1',
    publicationUrl:
      'https://raw.githubusercontent.com/savitz25/care-trust-hub/main/apps/web/src/data/senior-network-metrics-v1.json',
    fallbackRelPath: 'data/network-metrics/senior-v1-fallback.json',
    timeoutMs: 4000,
  },
};

export const ACCEPTED_SPECIALIST_FINGERPRINTS = {
  contractor: '0a99e8a1cf53590d01506d57072f4a320aa6c0060476a779193d8af1dd8034b3',
  senior: '36a042ec89322dd9b7d91440221928a4f617f9761f275bae22491f97d476a84e',
} as const;
