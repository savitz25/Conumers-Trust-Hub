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
    sourceAsOf: typeof metric.sourceAsOf === 'string' && metric.sourceAsOf.trim() ? metric.sourceAsOf : null,
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

export function adaptMoveCard(
  raw: Record<string, unknown>,
  origin: MetricOrigin,
): SpecialistHubPresentation {
  const map = byKey(raw);
  const fingerprint = String(raw.sourceFingerprint);
  const schema = String(raw.schemaVersion);
  const metric = (key: string, label?: string) => toNetworkMetric('move', schema, fingerprint, pick(map, key), label);
  return {
    hub: 'move',
    name: 'MoveTrustHub',
    eyebrow: 'Moving',
    href: 'https://www.movetrusthub.com',
    action: 'Research movers',
    origin,
    schemaVersion: schema,
    fingerprint,
    generatedAt: String(raw.generatedAt),
    newestSourceAsOf: typeof raw.newestDocumentedSourceAsOf === 'string' ? raw.newestDocumentedSourceAsOf : null,
    newestSourceAsOfNote:
      typeof raw.newestDocumentedSourceAsOfNote === 'string'
        ? raw.newestDocumentedSourceAsOfNote
        : 'Newest documented official source-effective date among metrics that carry a sourceAsOf. Not the as-of date of every federal profile.',
    universes: [],
    primary: [
      metric('federal_publishable_directory_profiles', CONSUMER_METRIC_LABELS.federal_publishable_directory_profiles),
      metric('federal_directory_authority_active', CONSUMER_METRIC_LABELS.federal_directory_authority_active),
      metric(
        'florida_fdacs_im_active_registrations',
        CONSUMER_METRIC_LABELS.florida_fdacs_im_active_registrations,
      ),
    ],
    secondary: [
      metric('nj_operation_safe_move_novs_acquired', 'NJ Safe Move NOV rows'),
      metric('ca_bhgs_19237_citation_rows', 'California household-mover citation rows'),
    ],
    caveats: [
      'Federal directory profiles and Florida FDACS registrations are different universes and are not one mover total.',
      'Headquarters is not service territory. Current authority is not a recommendation.',
      'New Jersey PM/PW/PC statewide mover universe is REQUEST_ONLY and is not shown as zero.',
      'California CAL-T household-mover universe is NOT_ACQUIRED and is not shown as zero.',
      'NOV is not a final order. A citation row is not a mover identity.',
    ],
  };
}

export function adaptLenderCard(
  raw: Record<string, unknown>,
  origin: MetricOrigin,
): SpecialistHubPresentation {
  const map = byKey(raw);
  const fingerprint = String(raw.sourceFingerprint);
  const schema = String(raw.schemaVersion);
  const metric = (key: string, label?: string) => toNetworkMetric('lender', schema, fingerprint, pick(map, key), label);
  return {
    hub: 'lender',
    name: 'LenderTrustHub',
    eyebrow: 'Lending',
    href: 'https://www.lendertrusthub.com',
    action: 'Research lenders',
    origin,
    schemaVersion: schema,
    fingerprint,
    generatedAt: String(raw.generatedAt),
    newestSourceAsOf: typeof raw.newestDocumentedSourceAsOf === 'string' ? raw.newestDocumentedSourceAsOf : null,
    newestSourceAsOfNote:
      typeof raw.newestDocumentedSourceAsOfNote === 'string'
        ? raw.newestDocumentedSourceAsOfNote
        : 'Newest documented official source-effective date among metrics that carry a calendar sourceAsOf. Not every identity row.',
    universes: [],
    primary: [
      metric('lenders_lending_institutions', CONSUMER_METRIC_LABELS.lenders_lending_institutions),
      metric('hmda_2025_county_applications', CONSUMER_METRIC_LABELS.hmda_2025_county_applications),
      metric('hmda_2025_county_originations', CONSUMER_METRIC_LABELS.hmda_2025_county_originations),
      metric('cfpb_mortgage_complaint_observations', CONSUMER_METRIC_LABELS.cfpb_mortgage_complaint_observations),
    ],
    secondary: [
      metric('federal_enforcement_events', CONSUMER_METRIC_LABELS.federal_enforcement_events),
      metric('nmls_institution_identifiers', CONSUMER_METRIC_LABELS.nmls_institution_identifiers),
      metric('public_national_render_profiles', 'Public national profiles'),
    ],
    caveats: [
      'Applications are not originations. A complaint observation is not a finding of wrongdoing.',
      'MLO identities and branch entities are not lenders and are not shown as public lender counts.',
      'NMLS institution identifiers are not additional institutions.',
      'County-grain HMDA is not added to state-grain HMDA.',
      'New Jersey RMLA and California CRMLA live rosters are not acquired and are not shown as zero.',
    ],
  };
}

export function adaptInsuranceCard(
  raw: Record<string, unknown>,
  origin: MetricOrigin,
): SpecialistHubPresentation {
  const map = byKey(raw);
  const fingerprint = String(raw.sourceFingerprint);
  const schema = String(raw.schemaVersion);
  const metric = (key: string, label?: string) => toNetworkMetric('insurance', schema, fingerprint, pick(map, key), label);
  return {
    hub: 'insurance',
    name: 'InsuranceTrustHub',
    eyebrow: 'Insurance',
    href: 'https://www.insurancetrusthub.com',
    action: 'Research insurance',
    origin,
    schemaVersion: schema,
    fingerprint,
    generatedAt: String(raw.generatedAt),
    newestSourceAsOf: typeof raw.newestDocumentedSourceAsOf === 'string' ? raw.newestDocumentedSourceAsOf : null,
    newestSourceAsOfNote:
      typeof raw.newestDocumentedSourceAsOfNote === 'string'
        ? raw.newestDocumentedSourceAsOfNote
        : 'Newest documented official source-effective date among metrics that carry a sourceAsOf. Not a single network clock.',
    universes: [],
    primary: [
      metric('insurance_agencies', CONSUMER_METRIC_LABELS.insurance_agencies),
      metric('licensed_insurance_companies', CONSUMER_METRIC_LABELS.licensed_insurance_companies),
      metric('insurance_producer_records', CONSUMER_METRIC_LABELS.insurance_producer_records),
      metric(
        'cms_marketplace_evidence_observations',
        CONSUMER_METRIC_LABELS.cms_marketplace_evidence_observations,
      ),
    ],
    secondary: [
      metric('appointments', CONSUMER_METRIC_LABELS.appointments),
      metric('consumer_complaint_observations', CONSUMER_METRIC_LABELS.consumer_complaint_observations),
      metric('rate_filing_observations', CONSUMER_METRIC_LABELS.rate_filing_observations),
      metric('market_conduct_examinations', CONSUMER_METRIC_LABELS.market_conduct_examinations),
    ],
    caveats: [
      'Agency, producer, and licensed insurance company remain separate identities and are not one insurance-company total.',
      'Appointments are not agencies or insurers. A complaint observation is not wrongdoing.',
      'CMS Marketplace evidence observations are not plans, companies, or agencies.',
      'Texas TDI agency license rows are not the national graph agency count.',
      'Texas authorized companies and California admitted-insurer universe are NOT_ACQUIRED and are not shown as zero.',
    ],
  };
}

export function adaptInvestorCard(
  raw: Record<string, unknown>,
  origin: MetricOrigin,
): SpecialistHubPresentation {
  const map = byKey(raw);
  const fingerprint = String(raw.sourceFingerprint);
  const schema = String(raw.schemaVersion);
  const metric = (key: string, label?: string) => toNetworkMetric('investor', schema, fingerprint, pick(map, key), label);
  return {
    hub: 'investor',
    name: 'InvestorTrustHub',
    eyebrow: 'Investment',
    href: 'https://www.investortrusthub.com',
    action: 'Research advisers',
    origin,
    schemaVersion: schema,
    fingerprint,
    generatedAt: String(raw.generatedAt),
    newestSourceAsOf: typeof raw.newestDocumentedSourceAsOf === 'string' ? raw.newestDocumentedSourceAsOf : null,
    newestSourceAsOfNote:
      typeof raw.newestDocumentedSourceAsOfNote === 'string'
        ? raw.newestDocumentedSourceAsOfNote
        : 'Newest documented official source-effective date among metrics that carry a calendar sourceAsOf. Not the SEC roster date.',
    universes: [],
    primary: [
      metric('investment_advisory_firms', CONSUMER_METRIC_LABELS.investment_advisory_firms),
      metric('ria_records', CONSUMER_METRIC_LABELS.ria_records),
      metric('era_records', CONSUMER_METRIC_LABELS.era_records),
    ],
    secondary: [
      metric('form_adv_attribute_observations', CONSUMER_METRIC_LABELS.form_adv_attribute_observations),
      metric('form_adv_filings', CONSUMER_METRIC_LABELS.form_adv_filings),
      metric('ownership_control_observations', CONSUMER_METRIC_LABELS.ownership_control_observations),
      metric('indexable_firm_profiles', CONSUMER_METRIC_LABELS.indexable_firm_profiles),
    ],
    caveats: [
      'RIA and ERA are filing classes of the same current SEC/IARD roster. ERA is not an RIA.',
      'The 17,018 RIA records include pending rows; pending is not SEC approval.',
      'Form ADV attribute observations are not advisers, firms, filings, clients, or accounts.',
      'A Form ADV filing is not another investment advisory firm. An amendment is not an additional adviser.',
      'Ownership/control observations are not firms and not 158,560 separate companies.',
      'RAUM is not investment performance. A national summed RAUM/AUM dollar total is not published.',
      'New Jersey and California state-RIA universes are not acquired and are not shown as zero. Principal office is not state registration.',
      'An empty disclosure table is not a clean-record claim. Item 11 is a filer-reported checkbox, not a finding.',
    ],
  };
}
