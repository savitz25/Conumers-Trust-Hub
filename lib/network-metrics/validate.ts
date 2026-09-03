const CONTRACTOR_REQUIRED_PUBLIC = [
  'live_credential_records',
  'live_active_current_credential_records',
  'live_researched_states',
  'regulatory_discipline_action_rows',
  'indexed_permit_source_records',
  'nj_construction_source_records',
  'published_county_intelligence_pages',
  'nj_current_municipalities',
  'published_ca_city_local_intelligence_pages',
] as const;

const SENIOR_REQUIRED_PUBLIC = [
  'current_nursing_homes',
  'current_home_health_agencies',
  'current_hospice_providers',
  'mds_observations',
  'health_deficiencies',
  'fire_citations',
  'inspection_events',
  'enforcement_records',
] as const;

export type RawMetric = {
  key?: unknown;
  label?: unknown;
  value?: unknown;
  grain?: unknown;
  sourceAsOf?: unknown;
  generatedAt?: unknown;
  description?: unknown;
  coverage?: unknown;
  denominator?: unknown;
  contributingSourceSystems?: unknown;
  publicationStatus?: unknown;
  trace?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireString(value: unknown, message: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(message);
  return value;
}

function metricMap(metrics: unknown): Map<string, RawMetric> {
  if (!Array.isArray(metrics)) throw new Error('metrics array required');
  const map = new Map<string, RawMetric>();
  for (const item of metrics) {
    if (!isRecord(item)) throw new Error('metric must be an object');
    const key = requireString(item.key, 'metric.key required');
    map.set(key, item as RawMetric);
  }
  return map;
}

function requirePublicCount(map: Map<string, RawMetric>, key: string, grain?: string): RawMetric {
  const metric = map.get(key);
  if (!metric) throw new Error(`required metric absent: ${key}`);
  if (typeof metric.value !== 'number' || !Number.isFinite(metric.value) || metric.value < 0) {
    throw new Error(`malformed value for ${key}`);
  }
  if (typeof metric.publicationStatus !== 'string' || metric.publicationStatus.trim() === '') {
    throw new Error(`missing publication status for ${key}`);
  }
  requireString(metric.label, `${key}: label required`);
  requireString(metric.grain, `${key}: grain required`);
  if (grain && metric.grain !== grain) throw new Error(`${key}: unexpected grain ${String(metric.grain)}`);
  return metric;
}

export function validateContractorManifest(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) throw new Error('contractor manifest must be an object');
  if (raw.schemaVersion !== 'contractor-network-metrics-v1') {
    throw new Error(`unknown schema version: ${String(raw.schemaVersion)}`);
  }
  requireString(raw.sourceFingerprint, 'contractor fingerprint required');
  requireString(raw.generatedAt, 'contractor generatedAt required');
  if (!String(raw.generatedAt).includes('T')) throw new Error('contractor generatedAt must be a timestamp');
  const map = metricMap(raw.metrics);
  requirePublicCount(map, 'live_credential_records', 'license_credential_record');
  requirePublicCount(map, 'live_active_current_credential_records', 'license_credential_record_active_current');
  requirePublicCount(map, 'nj_construction_source_records', 'municipal_permit_or_certificate_source_record');
  requirePublicCount(map, 'regulatory_discipline_action_rows', 'discipline_action_row');
  requirePublicCount(map, 'indexed_permit_source_records', 'permit_source_record');
  for (const key of CONTRACTOR_REQUIRED_PUBLIC) requirePublicCount(map, key);
  const ca = map.get('ca_acquired_cslb_license_master_rows_truncated');
  if (ca && ca.publicationStatus === 'PUBLIC' && typeof ca.value === 'number') {
    throw new Error('truncated CSLB master rows must not be PUBLIC live credentials');
  }
  const live = map.get('live_credential_records')!.value as number;
  const nj = map.get('nj_construction_source_records')!.value as number;
  if (live === nj) throw new Error('construction-source records must not equal credential denominator');
  return raw;
}

export function validateSeniorManifest(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) throw new Error('senior manifest must be an object');
  if (raw.schemaVersion !== 'senior-network-metrics-v1') {
    throw new Error(`unknown schema version: ${String(raw.schemaVersion)}`);
  }
  requireString(raw.sourceFingerprint, 'senior fingerprint required');
  requireString(raw.generatedAt, 'senior generatedAt required');
  const combined = isRecord(raw.combinedProviderDenominator) ? raw.combinedProviderDenominator : {};
  const evidence = isRecord(raw.combinedEvidenceDepth) ? raw.combinedEvidenceDepth : {};
  if (combined.publishAsHeadline !== false || combined.status !== 'UNSUPPORTED') {
    throw new Error('unsupported combined senior provider metric');
  }
  if (evidence.status !== 'REJECTED' || evidence.publishAsHeadline !== false) {
    throw new Error('rejected combined senior evidence metric must remain unpublished');
  }
  const map = metricMap(raw.metrics);
  requirePublicCount(map, 'current_nursing_homes', 'current_directory_provider');
  requirePublicCount(map, 'current_home_health_agencies', 'current_directory_provider');
  requirePublicCount(map, 'current_hospice_providers', 'current_directory_provider');
  requirePublicCount(map, 'mds_observations', 'mds_observation');
  for (const key of SENIOR_REQUIRED_PUBLIC) requirePublicCount(map, key);
  const combinedProviders = map.get('combined_cms_senior_providers');
  if (combinedProviders && combinedProviders.publicationStatus === 'PUBLIC' && combinedProviders.value != null) {
    throw new Error('combined senior providers must not be public');
  }
  const combinedEvidence = map.get('combined_indexed_evidence_records');
  if (combinedEvidence && combinedEvidence.publicationStatus === 'PUBLIC' && combinedEvidence.value != null) {
    throw new Error('combined senior evidence must not be public');
  }
  const universes = isRecord(raw.providerUniverses) ? raw.providerUniverses : {};
  const hospice = isRecord(universes.hospice) ? universes.hospice : {};
  const nh = isRecord(universes.nursingHome) ? universes.nursingHome : {};
  if (nh.current != null && nh.known != null && nh.current !== nh.known) {
    if (map.get('current_nursing_homes')?.value === nh.known) {
      throw new Error('known NH CCNs must not be treated as current');
    }
  }
  if (typeof hospice.evidenceOnly === 'number' && hospice.evidenceOnly > 0) {
    if (map.get('current_hospice_providers')?.value === hospice.typed) {
      throw new Error('evidence-only hospice identities must not enter current hospice');
    }
  }
  return raw;
}

export { CONTRACTOR_REQUIRED_PUBLIC, SENIOR_REQUIRED_PUBLIC };
