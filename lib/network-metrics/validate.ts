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

const MOVE_REQUIRED_PUBLIC = [
  'federal_publishable_directory_profiles',
  'federal_directory_authority_active',
  'florida_fdacs_im_active_registrations',
  'nj_operation_safe_move_novs_acquired',
  'ca_bhgs_19237_citation_rows',
] as const;

const LENDER_REQUIRED_PUBLIC = [
  'lenders_lending_institutions',
  'hmda_2025_county_applications',
  'hmda_2025_county_originations',
  'cfpb_mortgage_complaint_observations',
  'federal_enforcement_events',
  'nmls_institution_identifiers',
] as const;

const INSURANCE_REQUIRED_PUBLIC = [
  'insurance_agencies',
  'licensed_insurance_companies',
  'insurance_producer_records',
  'cms_marketplace_evidence_observations',
  'appointments',
  'consumer_complaint_observations',
  'rate_filing_observations',
  'market_conduct_examinations',
] as const;

const INVESTOR_REQUIRED_PUBLIC = [
  'investment_advisory_firms',
  'ria_records',
  'era_records',
  'form_adv_attribute_observations',
  'form_adv_filings',
  'ownership_control_observations',
  'indexable_firm_profiles',
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
  valueState?: unknown;
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

function forbidNumericMissing(map: Map<string, RawMetric>, key: string): void {
  const metric = map.get(key);
  if (!metric) return;
  const state = String(metric.valueState ?? '');
  if (['NOT_ACQUIRED', 'REQUEST_ONLY', 'UNKNOWN'].includes(state) && typeof metric.value === 'number') {
    throw new Error(`${key}: missing universe must not be a number`);
  }
}

export function validateMoveManifest(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) throw new Error('move manifest must be an object');
  if (raw.schemaVersion !== 'move-network-metrics-v1') {
    throw new Error(`unknown schema version: ${String(raw.schemaVersion)}`);
  }
  requireString(raw.sourceFingerprint, 'move fingerprint required');
  requireString(raw.generatedAt, 'move generatedAt required');
  const map = metricMap(raw.metrics);
  requirePublicCount(map, 'federal_publishable_directory_profiles', 'directory_profile');
  requirePublicCount(map, 'federal_directory_authority_active', 'directory_profile_authority_active');
  requirePublicCount(map, 'florida_fdacs_im_active_registrations', 'fdacs_intrastate_mover_registration_active');
  for (const key of MOVE_REQUIRED_PUBLIC) requirePublicCount(map, key);
  forbidNumericMissing(map, 'nj_pmw_authority_roster');
  forbidNumericMissing(map, 'ca_cal_t_household_mover_universe');
  const federal = map.get('federal_publishable_directory_profiles')!.value as number;
  const florida = map.get('florida_fdacs_im_active_registrations')!.value as number;
  if (federal === florida) throw new Error('FDACS registrations must not equal federal directory profiles');
  const combined = map.get('combined_national_state_movers');
  if (combined && combined.publicationStatus === 'PUBLIC' && combined.value != null) {
    throw new Error('combined national/state mover total must not be public');
  }
  return raw;
}

export function validateLenderManifest(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) throw new Error('lender manifest must be an object');
  if (raw.schemaVersion !== 'lender-network-metrics-v1') {
    throw new Error(`unknown schema version: ${String(raw.schemaVersion)}`);
  }
  requireString(raw.sourceFingerprint, 'lender fingerprint required');
  requireString(raw.generatedAt, 'lender generatedAt required');
  const map = metricMap(raw.metrics);
  requirePublicCount(map, 'lenders_lending_institutions', 'canonical_institution_entity');
  requirePublicCount(map, 'hmda_2025_county_applications', 'hmda_2025_county_observation');
  requirePublicCount(map, 'hmda_2025_county_originations', 'hmda_2025_county_observation');
  requirePublicCount(map, 'cfpb_mortgage_complaint_observations', 'cfpb_mortgage_complaint_observation');
  for (const key of LENDER_REQUIRED_PUBLIC) requirePublicCount(map, key);
  forbidNumericMissing(map, 'nj_rmla_license_roster');
  forbidNumericMissing(map, 'ca_crmla_live_roster');
  const institutions = map.get('lenders_lending_institutions')!.value as number;
  const nmls = map.get('nmls_institution_identifiers')!.value as number;
  const applications = map.get('hmda_2025_county_applications')!.value as number;
  const originations = map.get('hmda_2025_county_originations')!.value as number;
  if (institutions === nmls) throw new Error('NMLS identifiers must not equal institution denominator');
  if (applications === originations) throw new Error('HMDA applications must not equal originations');
  const mlos = map.get('person_mlo_entities');
  if (mlos && mlos.publicationStatus === 'PUBLIC') throw new Error('MLO identities must not be a public lender count');
  const branches = map.get('branch_entities');
  if (branches && branches.publicationStatus === 'PUBLIC') throw new Error('branch entities must not be public lenders');
  return raw;
}

export function validateInsuranceManifest(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) throw new Error('insurance manifest must be an object');
  if (raw.schemaVersion !== 'insurance-network-metrics-v1') {
    throw new Error(`unknown schema version: ${String(raw.schemaVersion)}`);
  }
  requireString(raw.sourceFingerprint, 'insurance fingerprint required');
  requireString(raw.generatedAt, 'insurance generatedAt required');
  const rejected = isRecord(raw.rejectedTotals) ? raw.rejectedTotals : {};
  const combined = isRecord(rejected.combinedInsuranceCompanies) ? rejected.combinedInsuranceCompanies : {};
  if (combined.status !== 'REJECTED' || combined.publishAsHeadline !== false) {
    throw new Error('combined insurance companies must remain unpublished');
  }
  const map = metricMap(raw.metrics);
  requirePublicCount(map, 'insurance_agencies', 'canonical_agency_entity');
  requirePublicCount(map, 'licensed_insurance_companies', 'canonical_legal_insurer_entity');
  requirePublicCount(map, 'insurance_producer_records', 'canonical_person_entity');
  requirePublicCount(map, 'cms_marketplace_evidence_observations', 'cms_marketplace_observation');
  requirePublicCount(map, 'appointments', 'agency_appointment');
  for (const key of INSURANCE_REQUIRED_PUBLIC) requirePublicCount(map, key);
  forbidNumericMissing(map, 'texas_authorized_companies');
  forbidNumericMissing(map, 'ca_admitted_insurer_universe');
  forbidNumericMissing(map, 'nj_surplus_lines_eligible_companies');
  const agencies = map.get('insurance_agencies')!.value as number;
  const insurers = map.get('licensed_insurance_companies')!.value as number;
  const producers = map.get('insurance_producer_records')!.value as number;
  const appointments = map.get('appointments')!.value as number;
  const cms = map.get('cms_marketplace_evidence_observations')!.value as number;
  const tdi = map.get('texas_tdi_agency_license_rows');
  if (agencies === insurers) throw new Error('agencies must not equal licensed insurance companies');
  if (agencies === producers) throw new Error('agencies must not equal producer records');
  if (appointments === agencies) throw new Error('appointments must not equal agencies');
  if (cms === agencies || cms === insurers) throw new Error('CMS observations must not equal identity counts');
  if (tdi && tdi.value === agencies) throw new Error('Texas TDI agency rows must not equal national graph agencies');
  const combinedMetric = map.get('combined_insurance_companies');
  if (combinedMetric && combinedMetric.publicationStatus === 'PUBLIC' && combinedMetric.value != null) {
    throw new Error('combined insurance companies must not be public');
  }
  return raw;
}

export function validateInvestorManifest(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) throw new Error('investor manifest must be an object');
  if (raw.schemaVersion !== 'investor-network-metrics-v1') {
    throw new Error(`unknown schema version: ${String(raw.schemaVersion)}`);
  }
  requireString(raw.sourceFingerprint, 'investor fingerprint required');
  requireString(raw.generatedAt, 'investor generatedAt required');
  const map = metricMap(raw.metrics);
  requirePublicCount(map, 'investment_advisory_firms', 'sec_iard_roster_firm');
  requirePublicCount(map, 'ria_records', 'ria_firm_fact');
  requirePublicCount(map, 'era_records', 'era_firm_fact');
  requirePublicCount(map, 'form_adv_attribute_observations', 'form_adv_attribute_observation');
  requirePublicCount(map, 'form_adv_filings', 'form_adv_filing');
  requirePublicCount(map, 'ownership_control_observations', 'ownership_control_observation');
  for (const key of INVESTOR_REQUIRED_PUBLIC) requirePublicCount(map, key);
  forbidNumericMissing(map, 'nj_state_ria_roster');
  forbidNumericMissing(map, 'ca_state_ria_roster');
  const roster = map.get('investment_advisory_firms')!.value as number;
  const ria = map.get('ria_records')!.value as number;
  const era = map.get('era_records')!.value as number;
  const attributes = map.get('form_adv_attribute_observations')!.value as number;
  const filings = map.get('form_adv_filings')!.value as number;
  if (ria + era !== roster) throw new Error('RIA XOR ERA partition must equal the current SEC/IARD roster');
  if (ria === era) throw new Error('RIA records must not equal ERA records');
  if (attributes === roster || attributes === filings) {
    throw new Error('Form ADV attribute observations must not equal firms or filings');
  }
  if (filings === roster) throw new Error('Form ADV filings must not equal advisory firms');
  if (roster === 25777) throw new Error('canonical extra identities must not replace the public roster');
  const disclosures = map.get('disclosure_events');
  if (disclosures && disclosures.publicationStatus === 'PUBLIC' && disclosures.value === 0) {
    throw new Error('empty disclosure table must not be a public clean-record headline');
  }
  const summedRaum = map.get('national_summed_raum_aum');
  if (summedRaum && summedRaum.publicationStatus === 'PUBLIC' && summedRaum.value != null) {
    throw new Error('national summed RAUM must not be public');
  }
  return raw;
}

export {
  CONTRACTOR_REQUIRED_PUBLIC,
  SENIOR_REQUIRED_PUBLIC,
  MOVE_REQUIRED_PUBLIC,
  LENDER_REQUIRED_PUBLIC,
  INSURANCE_REQUIRED_PUBLIC,
  INVESTOR_REQUIRED_PUBLIC,
};
