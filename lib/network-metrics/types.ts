import type { SpecialistHubId } from './sources.ts';

export type MetricOrigin = 'UPSTREAM' | 'FALLBACK';

export type NetworkMetricTraceRow = { label: string; value: string };

export type NetworkMetric = {
  hub: SpecialistHubId;
  key: string;
  label: string;
  sourceLabel: string;
  value: number;
  valueState: 'ok';
  grain: string;
  sourceAsOf: string | null;
  generatedAt: string;
  description: string;
  coverage: string | null;
  denominator: string | null;
  contributingSourceSystems: string[];
  publicationStatus: string;
  sourceManifestSchema: string;
  sourceManifestFingerprint: string;
  trace: {
    summary: string;
    details: NetworkMetricTraceRow[];
    limitations: string[];
  };
};

export type SpecialistHubPresentation = {
  hub: SpecialistHubId;
  name: string;
  eyebrow: string;
  href: string;
  action: string;
  origin: MetricOrigin;
  schemaVersion: string;
  fingerprint: string;
  generatedAt: string;
  newestSourceAsOf: string | null;
  newestSourceAsOfNote: string;
  universes: NetworkMetric[];
  primary: NetworkMetric[];
  secondary: NetworkMetric[];
  caveats: string[];
};
