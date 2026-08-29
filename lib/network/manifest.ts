import { SPECIALIST_HUB_IDS, type SpecialistHubId } from './registry.ts';

export const NETWORK_MANIFEST_CONTRACT = 'trusthub-network-manifest-v1' as const;

export type CapabilityStatus = 'deep' | 'available' | 'partial' | 'planned' | 'not_applicable';
export type CoverageLevel =
  | 'federal_core'
  | 'basic_discovery'
  | 'state_research'
  | 'enhanced_state_intelligence'
  | 'enhanced_county_intelligence'
  | 'not_yet_researched';
export type GeographyType = 'national' | 'state' | 'county' | 'local';
export type AskCapabilityStatus = 'live' | 'partial' | 'planned';

export type ManifestMetric = {
  id: string;
  label: string;
  value: number | string;
  grain: string;
  sourceFamily?: string;
  officialAsOf?: string;
  retrievedAt?: string;
  limitation?: string;
  available?: boolean;
};

export type ManifestCapability = {
  id: string;
  label: string;
  status: CapabilityStatus;
};

export type ManifestGeography = {
  geographyType: GeographyType;
  geographyCode?: string;
  capabilityLevel: CoverageLevel;
};

export type ManifestSourceFamily = {
  id: string;
  sourceOrganization: string;
  regulatorOrAgency?: string;
  sourceSystem?: string;
  datasetName: string;
  grain: string;
  geography?: string;
  officialAsOf?: string;
  retrievedAt?: string;
  publicSourceUrl?: string;
  limitation?: string;
  organizationKind: 'regulator' | 'standards_body' | 'publisher' | 'other';
};

export type TrustHubNetworkManifest = {
  contract: typeof NETWORK_MANIFEST_CONTRACT;
  hub: {
    id: SpecialistHubId;
    name: string;
    domain: string;
    description: string;
    accent: string;
    exploreHref: string;
    askHref?: string;
    methodologyHref?: string;
  };
  snapshot: {
    snapshotId?: string;
    fingerprint?: string;
    generatedAt?: string;
    officialAsOf?: string;
    retrievedAt?: string;
    adapter: 'checked_in_canonical_snapshot';
  };
  status: 'ok' | 'stale' | 'unavailable';
  unavailableReason?: string;
  card: {
    primaryMetricId: string;
    supportingMetricIds: [string, string];
    scopeChip: string;
    ctaLabel: string;
  };
  metrics: ManifestMetric[];
  capabilities: ManifestCapability[];
  geographyCoverage?: ManifestGeography[];
  sourceFamilies: ManifestSourceFamily[];
  askCapabilities?: Array<{ mode: string; status: AskCapabilityStatus }>;
  limitations: string[];
};

export type ManifestWarning = { hubId?: SpecialistHubId; code: string; message: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:T|$)/;
const CAPABILITY: CapabilityStatus[] = ['deep', 'available', 'partial', 'planned', 'not_applicable'];
const COVERAGE: CoverageLevel[] = [
  'federal_core',
  'basic_discovery',
  'state_research',
  'enhanced_state_intelligence',
  'enhanced_county_intelligence',
  'not_yet_researched',
];

export function validateManifest(m: TrustHubNetworkManifest): ManifestWarning[] {
  const warnings: ManifestWarning[] = [];
  const hubId = m.hub?.id;
  if (m.contract !== NETWORK_MANIFEST_CONTRACT) {
    warnings.push({ hubId, code: 'contract', message: 'Unexpected manifest contract' });
  }
  if (!SPECIALIST_HUB_IDS.includes(hubId)) {
    warnings.push({ hubId, code: 'hub_id', message: `Unknown hub id: ${String(hubId)}` });
  }
  const metricIds = new Set<string>();
  for (const metric of m.metrics ?? []) {
    if (metricIds.has(metric.id)) {
      warnings.push({ hubId, code: 'dup_metric', message: `Duplicate metric id ${metric.id}` });
    }
    metricIds.add(metric.id);
    if (typeof metric.value === 'number') {
      if (!metric.grain?.trim()) {
        warnings.push({ hubId, code: 'grain', message: `Numeric metric ${metric.id} missing grain` });
      }
      if (!metric.sourceFamily && !metric.officialAsOf) {
        warnings.push({
          hubId,
          code: 'provenance',
          message: `Numeric metric ${metric.id} missing source/snapshot lineage`,
        });
      }
      if (metric.available === false) {
        warnings.push({ hubId, code: 'zero_fallback', message: `Unavailable metric ${metric.id} must not render 0` });
      }
    }
    if (metric.officialAsOf && !ISO_DATE.test(metric.officialAsOf) && metric.officialAsOf !== 'unavailable') {
      warnings.push({ hubId, code: 'date', message: `Metric ${metric.id} officialAsOf format` });
    }
  }
  for (const cap of m.capabilities ?? []) {
    if (!CAPABILITY.includes(cap.status)) {
      warnings.push({ hubId, code: 'capability', message: `Bad capability status ${cap.status}` });
    }
  }
  for (const geo of m.geographyCoverage ?? []) {
    if (!COVERAGE.includes(geo.capabilityLevel)) {
      warnings.push({ hubId, code: 'coverage', message: `Bad coverage level ${geo.capabilityLevel}` });
    }
  }
  for (const fam of m.sourceFamilies ?? []) {
    if (!fam.datasetName || !fam.sourceOrganization || !fam.grain) {
      warnings.push({ hubId, code: 'source_family', message: `Incomplete source family ${fam.id}` });
    }
    if (fam.publicSourceUrl && !/^https?:\/\//.test(fam.publicSourceUrl)) {
      warnings.push({ hubId, code: 'url', message: `Invalid URL on ${fam.id}` });
    }
  }
  return warnings;
}

export function metricById(m: TrustHubNetworkManifest, id: string): ManifestMetric | undefined {
  return m.metrics.find((row) => row.id === id);
}
