export const SPECIALIST_METRIC_REVALIDATE_SECONDS = 3600;

export type SpecialistHubId = 'move' | 'lender' | 'insurance' | 'contractor' | 'senior';

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
  move: {
    hub: 'move',
    schemaVersion: 'move-network-metrics-v1',
    publicationUrl:
      'https://raw.githubusercontent.com/savitz25/Move-trust-Hub/main/data/home/move-network-metrics-v1.json',
    fallbackRelPath: 'data/network-metrics/move-v1-fallback.json',
    timeoutMs: 4000,
  },
  lender: {
    hub: 'lender',
    schemaVersion: 'lender-network-metrics-v1',
    publicationUrl:
      'https://raw.githubusercontent.com/savitz25/Lender-Trust-Hub/main/data/home/lender-network-metrics-v1.json',
    fallbackRelPath: 'data/network-metrics/lender-v1-fallback.json',
    timeoutMs: 4000,
  },
  insurance: {
    hub: 'insurance',
    schemaVersion: 'insurance-network-metrics-v1',
    publicationUrl:
      'https://raw.githubusercontent.com/savitz25/Insurance-trust-hub/main/data/home/insurance-network-metrics-v1.json',
    fallbackRelPath: 'data/network-metrics/insurance-v1-fallback.json',
    timeoutMs: 4000,
  },
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
  move: '0b88bf6a0e0a906505c9148fe6d9e2c88ae568e024b852929a2660ed8b867a11',
  lender: '6bd624717bb1bd1ddd4880d40adccbafeba58d6624e069971f728875d750587a',
  insurance: 'c9120eaf14f96cc8226c5ac8f7e5dc940c328b339bcb75ebc1596bc306d6f301',
  contractor: '0a99e8a1cf53590d01506d57072f4a320aa6c0060476a779193d8af1dd8034b3',
  senior: '36a042ec89322dd9b7d91440221928a4f617f9761f275bae22491f97d476a84e',
} as const;

export const SPECIALIST_OWNED_HUBS: SpecialistHubId[] = ['move', 'lender', 'insurance', 'contractor', 'senior'];
