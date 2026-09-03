import { CONSUMER_METRIC_LABELS } from './consumer-labels.ts';
import type { SpecialistHubId } from './sources.ts';
import type { NetworkMetric, SpecialistHubPresentation, MetricOrigin } from './types.ts';

type RawMetric = {
  key: string;
  label: string;
  value: number;
  grain: string;
  sourceAsOf: string | null;
  generatedAt: string;
  description: string;
  coverage?: string;
  denominator?: string;
  contributingSourceSystems?: string[];
  publicationStatus: string;
  trace?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asMetrics(raw: Record<string, unknown>): RawMetric[] {
  return Array.isArray(raw.metrics) ? (raw.metrics as RawMetric[]) : [];
}

function byKey(raw: Record<string, unknown>): Map<string, RawMetric> {
  return new Map(asMetrics(raw).map((metric) => [metric.key, metric]));
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((item) => String(item)).join(', ');
  if (isRecord(value)) return JSON.stringify(value);
  if (value == null) return 'Not supplied';
  return String(value);
}

function adaptTrace(metric: RawMetric): NetworkMetric['trace'] {
  const trace = metric.trace;
  const details: NetworkMetric['trace']['details'] = [];
  const limitations: string[] = [];
  if (isRecord(trace)) {
    if (typeof trace.counts === 'string') details.push({ label: 'Counts', value: trace.counts });
    if (typeof trace.doesNotCount === 'string') details.push({ label: 'Does not count', value: trace.doesNotCount });
    if (typeof trace.method === 'string') details.push({ label: 'Method', value: trace.method });
    if (typeof trace.payloadKey === 'string') details.push({ label: 'Payload key', value: trace.payloadKey });
    if (typeof trace.sourceDates === 'string') details.push({ label: 'Source dates', value: trace.sourceDates });
    if (typeof trace.generationDate === 'string') details.push({ label: 'Generation date', value: trace.generationDate });
    if (typeof trace.geographicCoverage === 'string') details.push({ label: 'Coverage', value: trace.geographicCoverage });
    if (Array.isArray(trace.components)) {
      for (const item of trace.components) {
        if (isRecord(item) && typeof item.label === 'string') {
          details.push({ label: item.label, value: stringifyUnknown(item.value) });
        }
      }
    }
    if (Array.isArray(trace.limitations)) {
      for (const item of trace.limitations) if (typeof item === 'string') limitations.push(item);
    }
    if (Array.isArray(trace.contributingSourceSystems) && details.every((row) => row.label !== 'Sources')) {
      details.push({
        label: 'Sources',
        value: trace.contributingSourceSystems.map(String).join(', '),
      });
    }
  }
  if (metric.sourceAsOf) details.push({ label: 'Official source as-of', value: metric.sourceAsOf });
  details.push({ label: 'Manifest generated', value: metric.generatedAt });
  details.push({ label: 'Grain', value: metric.grain });
  if (metric.denominator) details.push({ label: 'Denominator', value: metric.denominator });
  return {
    summary: metric.description,
    details,
    limitations,
  };
}

function toNetworkMetric(
  hub: SpecialistHubId,
  schema: string,
  fingerprint: string,
  metric: RawMetric,
  label = metric.label,
): NetworkMetric {
  return {
    hub,
    key: metric.key,
    label,
    sourceLabel: metric.label,
    value: metric.value,
    valueState: 'ok',
    grain: metric.grain,
    sourceAsOf: typeof metric.sourceAsOf === 'string' ? metric.sourceAsOf : null,
    generatedAt: metric.generatedAt,
    description: metric.description,
    coverage: metric.coverage ?? null,
    denominator: metric.denominator ?? null,
    contributingSourceSystems: Array.isArray(metric.contributingSourceSystems)
      ? metric.contributingSourceSystems.map(String)
      : [],
    publicationStatus: metric.publicationStatus,
    sourceManifestSchema: schema,
    sourceManifestFingerprint: fingerprint,
    trace: adaptTrace(metric),
  };
}

function pick(map: Map<string, RawMetric>, key: string): RawMetric {
  const metric = map.get(key);
  if (!metric) throw new Error(`adapter missing ${key}`);
  return metric;
}

export function adaptContractorCard(
  raw: Record<string, unknown>,
  origin: MetricOrigin,
): SpecialistHubPresentation {
  const map = byKey(raw);
  const fingerprint = String(raw.sourceFingerprint);
  const schema = String(raw.schemaVersion);
  const metric = (key: string, label?: string) => toNetworkMetric('contractor', schema, fingerprint, pick(map, key), label);
  const ca = map.get('ca_acquired_cslb_license_master_rows_truncated');
  return {
    hub: 'contractor',
    name: 'ContractorTrustHub',
    eyebrow: 'Contractors',
    href: 'https://www.contractortrusthub.com',
    action: 'Research credentials',
    origin,
    schemaVersion: schema,
    fingerprint,
    generatedAt: String(raw.generatedAt),
    newestSourceAsOf: typeof raw.newestDocumentedSourceAsOf === 'string' ? raw.newestDocumentedSourceAsOf : null,
    newestSourceAsOfNote:
      typeof raw.newestDocumentedSourceAsOfNote === 'string'
        ? raw.newestDocumentedSourceAsOfNote
        : 'Newest documented official source date among eligible metrics. Not a claim that every live credential is current through that date.',
    universes: [],
    primary: [
      metric('live_credential_records', CONSUMER_METRIC_LABELS.live_credential_records),
      metric(
        'live_active_current_credential_records',
        CONSUMER_METRIC_LABELS.live_active_current_credential_records,
      ),
      metric('nj_construction_source_records', 'NJ construction source records'),
      metric('regulatory_discipline_action_rows', 'Regulatory/enforcement rows'),
    ],
    secondary: [
      metric('indexed_permit_source_records'),
      metric('nj_current_municipalities', 'NJ municipalities'),
      metric('published_county_intelligence_pages', 'County intelligence pages'),
      metric('published_ca_city_local_intelligence_pages', 'California city intelligence pages'),
      metric('live_researched_states'),
    ],
    caveats: [
      'NJ construction source records are not credentials and not unique contractors.',
      'Permit source records are not completed jobs.',
      'Contacts are not entities.',
      'County pages and CA city pages do not change the live-state count.',
      ca
        ? `${ca.value.toLocaleString('en-US')} acquired partial CSLB License Master rows are truncated and are not live California credentials. Live CA credential contribution remains the production ca_cslb cohort.`
        : 'Live CA credential contribution is the production ca_cslb cohort, not the truncated License Master extract.',
    ],
  };
}

export function adaptSeniorCard(
  raw: Record<string, unknown>,
  origin: MetricOrigin,
): SpecialistHubPresentation {
  const map = byKey(raw);
  const fingerprint = String(raw.sourceFingerprint);
  const schema = String(raw.schemaVersion);
  const metric = (key: string, label?: string) => toNetworkMetric('senior', schema, fingerprint, pick(map, key), label);
  const newest = isRecord(raw.newestSourceAsOf) ? raw.newestSourceAsOf : {};
  return {
    hub: 'senior',
    name: 'SeniorTrustHub',
    eyebrow: 'Senior care',
    href: 'https://www.seniortrusthub.com',
    action: 'Research senior care',
    origin,
    schemaVersion: schema,
    fingerprint,
    generatedAt: String(raw.generatedAt),
    newestSourceAsOf: typeof newest.value === 'string' ? newest.value : null,
    newestSourceAsOfNote:
      typeof newest.semantics === 'string'
        ? newest.semantics
        : 'Newest official CMS source-modified date among PUBLIC metrics. Not a single network clock.',
    universes: [
      metric('current_nursing_homes', CONSUMER_METRIC_LABELS.current_nursing_homes),
      metric('current_home_health_agencies', CONSUMER_METRIC_LABELS.current_home_health_agencies),
      metric('current_hospice_providers', CONSUMER_METRIC_LABELS.current_hospice_providers),
    ],
    primary: [
      metric('mds_observations'),
      metric('health_deficiencies'),
      metric('fire_citations'),
      metric('inspection_events'),
      metric('enforcement_records'),
    ],
    secondary: [
      metric('pbj_quarter_summaries', 'Staffing records'),
      metric('civil_monetary_penalties'),
      metric('hh_quality_observations'),
      metric('hospice_quality_observations'),
    ],
    caveats: [
      'Nursing Home, Home Health, and Hospice remain separate CMS directories and are not one senior-provider total.',
      'Evidence families keep source-native grains. They are not added into one evidence headline.',
      'Known CCNs and evidence-only hospice identities are not current providers.',
    ],
  };
}
