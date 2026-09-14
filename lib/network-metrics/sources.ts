export const SPECIALIST_METRIC_REVALIDATE_SECONDS = 3600;

export type SpecialistHubId = 'move' | 'lender' | 'insurance' | 'contractor' | 'senior' | 'investor';

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
  investor: {
    hub: 'investor',
    schemaVersion: 'investor-network-metrics-v1',
    publicationUrl:
      'https://raw.githubusercontent.com/savitz25/investor-trust-hub/main/data/home/investor-network-metrics-v1.json',
    fallbackRelPath: 'data/network-metrics/investor-v1-fallback.json',
    timeoutMs: 4000,
  },
};

/**
 * Fingerprint of the bundled last-known-good fallback artifact for each hub.
 *
 * This is PROVENANCE metadata for the fallback snapshot only. It is intentionally
 * NOT used to gate acceptance of upstream contracts: a specialist hub is free to
 * publish a new compatible contractRevision (and therefore a new sourceFingerprint)
 * at any time without requiring an AskTrustHub code change or deployment. Upstream
 * acceptance is decided by schema-family/version and structural validation in
 * `validate.ts`, not by fingerprint equality. See `load.ts`.
 *
 * Update this constant only when `data/network-metrics/<hub>-v1-fallback.json` is
 * refreshed, so the two stay self-consistent (enforced by tests).
 */
export const FALLBACK_SPECIALIST_FINGERPRINTS = {
  move: 'c219dd772556d4097cd90d2762f979b3d40d5c0c7c84643557aa9657547e100c',
  lender: '0d6dc909edfec5882b9324b85dd8453ea3d30f9d653c4612cabc91f012a00f05',
  insurance: 'f479e78d730ec190a9011169cb0ec024d99e895b1b82951845919c4dc878bf21',
  contractor: '22c4ccf3f53d78c37ad6f19f9303af2676c69bf1fe8c45d9fad3f06c6b3502cb',
  senior: 'fa3c792ace29445aad6d2cc66ee16bcd2cf25da31af2355c9a80d5408cc3ca5c',
  investor: 'e68140f4bd33cb115e0950accc2b229e975c55039f89894ca57d4b2636bf9f5d',
} as const;

export const SPECIALIST_OWNED_HUBS: SpecialistHubId[] = [
  'move',
  'lender',
  'insurance',
  'contractor',
  'senior',
  'investor',
];
